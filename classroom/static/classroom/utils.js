import { getSectionId, getInfoElement, getCsrfToken } from "/static/js/tasks/utils.js"
import { fetchSections, renderSectionsList, selectSection } from "/static/js/tasks/display/renderSections.js"
import { refreshChat } from "/static/classroom/integrations/chat.js"


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

    taskCard.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    return taskCard;
}

/**
 * Получает ID текущего урока для указанного класса
 * @param {string} classroomId
 * @returns {Promise<string|null>} lesson_id или null, если урока нет
 */
export async function fetchCurrentLessonId() {
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

    const sectionToSelect = sections.find(
        section => section.id === previousSectionId
    )?.id || sections[0].id;

    return sectionToSelect;
}

export async function refreshClassroom() {
    const infoEl = getInfoElement();
    const classroomId = getClassroomId();
    if (infoEl && classroomId) {
        infoEl.dataset.sectionId = "";

        const currentLessonId = await fetchCurrentLessonId(classroomId);
        if (currentLessonId) {
            infoEl.dataset.lessonId = currentLessonId;
        }

        const sectionToSelect = await refreshSections();
        await selectSection(sectionToSelect);
    }
    await refreshChat();
}

/**
 * Получение имени нового пользователя
 * @param {string|number} userId - ID пользователя
 * @returns {Promise<string|null>}
 */
export async function getUsernameById(userId) {
    try {
        const response = await fetch(`/api/users/${userId}/get-username-by-id/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
        });

        if (response.ok) {
            const data = await response.json();
            const username = data.username;
            return username;
        }
    } catch (e) {
        console.log("Не удалось определить имя ученика");
    }

    return `Ученик #${userId}`;
}