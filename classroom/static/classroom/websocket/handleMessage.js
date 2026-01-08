"use strict";

import { showNotification, getIsTeacher, getSectionId, fetchSingleTask } from "/static/js/tasks/utils.js";
import { fetchSections, renderSectionsList, selectSection } from "/static/js/tasks/display/renderSections.js"
import { loadSectionTasks } from "/static/js/tasks/display/showTasks.js"
import { getViewedUserId } from '/static/classroom/utils.js'
import { fetchTaskAnswer } from "/static/classroom/answers/api.js";
import { handleAnswer } from "/static/classroom/answers/handleAnswer.js";
import { clearTask } from "/static/classroom/answers/handlers/clearAnswers.js"
import { createBubbleNode, refreshChat, pointNewMessage } from "/static/classroom/integrations/chat.js"

/**
 * Обрабатывает входящее сообщение WebSocket.
 *
 * Ожидает JSON вида { type, data }.
 *
 * @param {MessageEvent} ev
 */
export async function handleWSMessage(ev) {
    let msg;
    try {
        msg = JSON.parse(ev.data);
    } catch {
        return;
    }

    const { type, data } = msg;
    if (!type || !data?.student_id) return;
    if (!shouldProcessMessage(data)) return;

    if (type === "answer:sent") {
        if (!data?.task_id) return;
        await processTaskAnswer(data.task_id);
        return;
    }

    if (type === "answer:reset") {
        if (!data?.task_id) return;
        await clearTask(data.task_id);
    }

    if (type === "section_list:change") {
        await refreshSectionsAndSelect();
    }

    if (type === "task:attention") {
        if (!data?.task_id || !data?.payload?.section_id) return;
        await moveToPointedTask(data.payload.section_id, data.task_id);
    }

    if (type === "section:change") {
        if (!data?.payload?.section_id) return;
        const currentSectionId = getSectionId();
        if (currentSectionId === data.payload.section_id) {
            await loadSectionTasks(currentSectionId);
        }
    }

    if (type === "chat:send_message") {
        if (!data?.text || !data?.sender_id) return;
        await pointNewMessage(data);
    }

    if (type === "chat:update") {
        await refreshChat();
    }
}

/**
 * Решает, нужно ли обрабатывать сообщение для текущего интерфейса.
 *
 * @param {{student_id: string|number}} payload
 * @returns {boolean}
 */
function shouldProcessMessage({ student_id }) {
    const isTeacher = getIsTeacher();
    if (isTeacher) {
        const userId = getViewedUserId();
        if (userId === "all" || String(student_id) === "all") return true;
        return String(student_id) === String(userId);
    }

    return String(student_id) === String(getViewedUserId()) || String(student_id) === "all";
}

/**
 * Загружает данные ответа задачи и передаёт их в handleAnswer.
 *
 * @param {string|number} taskId
 */
async function processTaskAnswer(taskId) {
    try {
        const answerData = await fetchTaskAnswer(taskId);
        if (!answerData) return;
        await handleAnswer(answerData);
    } catch (e) {
        console.error("processTaskAnswer failed", e);
        showNotification("Не удалось получить ответ задачи");
    }
}

async function refreshSectionsAndSelect() {
    const previousSectionId = getSectionId();
    const sections = await fetchSections();

    await renderSectionsList(sections);

    if (!sections.length) {
        return;
    }

    const sectionToSelect = sections.find(
        section => section.id === previousSectionId
    )?.id || sections[0].id;

    await selectSection(sectionToSelect);
}

/**
 * Переключает на нужный раздел, прокручивает и подсвечивает задание
 * @param {number|string} sectionId
 * @param {number|string} taskId
 */
async function moveToPointedTask(sectionId, taskId) {
    if (!sectionId || !taskId) return;

    await selectSection(sectionId);

    const taskSelector = `.task-card[data-task-id="${taskId}"]`;
    const taskCard = document.querySelector(taskSelector);
    if (!taskCard) return;

    taskCard.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}
