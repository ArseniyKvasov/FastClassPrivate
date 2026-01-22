"use strict";

import { showNotification, getIsTeacher, getLessonId, getSectionId, fetchSingleTask } from "/static/js/tasks/utils.js";
import { loadSectionTasks } from "/static/js/tasks/display/showTasks.js"
import { getViewedUserId, scrollToTask, refreshSections } from '/static/classroom/utils.js'
import { fetchTaskAnswer } from "/static/classroom/answers/api.js";
import { handleAnswer } from "/static/classroom/answers/handleAnswer.js";
import { clearTask } from "/static/classroom/answers/handlers/clearAnswers.js"
import { markUserOnline, markUserOffline } from "/static/classroom/answers/classroomPanel.js";
import { createBubbleNode, refreshChat, pointNewMessage } from "/static/classroom/integrations/chat.js"
import { enableCopying, disableCopying } from "/static/classroom/copyingMode.js";
import { sendWS } from "/static/classroom/websocket/sendMessage.js"

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
    if (!type) return;
    if (!shouldProcessMessage(data) && !["users:online", "user:online:event", "user:offline:event", "chat:send_message", "chat:update"].includes(type)) return;

    switch(type) {
        case "answer:sent":
            if (!data?.task_id) return;
            await processTaskAnswer(data.task_id);
            break;

        case "answer:reset":
            if (!data?.task_id) return;
            await clearTask(data.task_id);
            break;

        case "section_list:change":
            const sectionToSelect = await refreshSections();
            await selectSection(sectionToSelect);
            break;

        case "task:attention":
            if (!data?.task_id || !data?.payload?.section_id) return;
            const taskCard = await scrollToTask(data.payload.section_id, data.task_id);
            highlightTaskRed(taskCard);
            break;

        case "section:change":
            if (!data?.payload?.section_id) return;
            const currentSectionId = getSectionId();
            if (currentSectionId === data.payload.section_id) {
                await loadSectionTasks(currentSectionId);
            }
            break;

        case "chat:send_message":
            if (!data?.text || !data?.sender_id) return;
            await pointNewMessage(data);
            break;

        case "chat:update":
            await refreshChat();
            break;


        case "users:online":
            data.forEach(student => {
                handleUserStatusMessage(student.student_id, student.online);
            });
            break;

        case "user:online:event":
            markUserOnline(data?.student_id);
            if (data?.student_username) {
                showNotification(`Ученик ${data.student_username} присоединился.`);
            }
            break;
        case "user:offline:event":
            markUserOffline(data?.student_id);
            break;

        case "copying:changed":
            if (typeof data.allowed === "boolean") {
                if (data.allowed) {
                    enableCopying();
                } else {
                    disableCopying();
                }
            }
            break;

        case "user:deleted":
            window.location.href = "/";
            break;
    }
}

/**
 * Решает, нужно ли обрабатывать сообщение для текущего интерфейса.
 *
 * @param {{student_id: string|number}} payload
 * @returns {boolean}
 */
function shouldProcessMessage({ student_id }) {
    if (!student_id) return false;

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

/**
 * Добавляет красный пульс на карточку задания на 2 секунды
 * @param {HTMLElement} taskCard
 */
function highlightTaskRed(taskCard) {
    if (!taskCard) return;

    taskCard.classList.add("pulse-red");

    setTimeout(() => {
        taskCard.classList.remove("pulse-red");
    }, 2000);
}


/**
 * Обработка входящего сообщения о статусе пользователя
 * @param {student_id: string|number, is_online: boolean}
 */
export function handleUserStatusMessage(student_id, is_online) {
    if (!student_id) return;

    if (is_online) {
        markUserOnline(student_id);
    } else {
        markUserOffline(student_id);
    }
}
