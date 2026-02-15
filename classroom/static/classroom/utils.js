import { getSectionId, getInfoElement, getCsrfToken, getIsTeacher, showNotification } from "js/tasks/utils.js";
import { fetchSections, renderSectionsList, selectSection } from "js/tasks/display/renderSections.js";
import { refreshChat } from "classroom/integrations/chat.js";
import { refreshStudentsList } from "classroom/answers/classroomPanel.js";


export function getClassroomId() {
    const info = document.getElementById("info");
    return info?.dataset?.classroomId || null;
}

export function getViewedUserId() {
    const info = document.getElementById("info");
    return info?.dataset?.viewedUserId || null;
}

/**
 * Прокручивает страницу до указанной карточки задания
 * @param {number|string} taskId
 * @returns {HTMLElement|null} элемент карточки задания
 */
export async function scrollToTask(sectionId, taskId) {
    if (!sectionId || !taskId) return null;

    await selectSection(sectionId);

    const taskCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (!taskCard) return null;

    const rect = taskCard.getBoundingClientRect();
    const isPartiallyVisible = (
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0
    );

    if (isPartiallyVisible) {
        return taskCard;
    }

    taskCard.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    return taskCard;
}

/**
 * Добавляет красный пульс на карточку задания на 2 секунды
 * @param {HTMLElement} taskCard
 */
export function highlightTaskRed(taskCard) {
    if (!taskCard) return;

    taskCard.classList.add("pulse-red");

    setTimeout(() => {
        taskCard.classList.remove("pulse-red");
    }, 2000);
}

/**
 * Получает ID текущего урока для указанного класса
 * @param {string} classroomId
 * @returns {Promise<string|null>} lesson_id или null, если урока нет;
 */
export async function fetchCurrentLesson() {
    const classroomId = getClassroomId();
    if (!classroomId) {
        showNotification("Не удалось найти classroom id. Обновите страницу.")
    }

    try {
        const response = await fetch(`/classroom/api/${classroomId}/get-current-lesson-id/`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin"
        });

        if (!response.ok) {
            console.error("Ошибка при получении урока:", response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        return data.lesson_id || null;

    } catch (error) {
        console.error("Ошибка сети при получении урока:", error);
        return null;
    }
}

export async function refreshSections() {
    const previousSectionId = getSectionId();
    const sections = await fetchSections();

    await renderSectionsList(sections);

    if (!sections.length) {
        return;
    }

    if (previousSectionId && sections.some(section => String(section.id) === String(previousSectionId))) {
        return previousSectionId;
    }

    return sections[0].id;
}

export async function refreshClassroom() {
    const infoEl = getInfoElement();
    const classroomId = getClassroomId();
    if (infoEl && classroomId) {
        const lessonId = await fetchCurrentLesson(classroomId);
        if (lessonId) {
            infoEl.dataset.lessonId = lessonId;
        }

        const isTeacher = getIsTeacher();
        if (isTeacher) {
            refreshStudentsList();
        }

        const sectionToSelect = await refreshSections();
        await selectSection(sectionToSelect);
    }
    await refreshChat();
}