import { showNotification, postJSON, getLessonId } from "js/tasks/utils.js";
import { eventBus } from "js/tasks/events/eventBus.js";
import { ANSWER_HANDLER_MAP, getTaskTypeFromContainer } from "classroom/answers/utils.js";
import { getClassroomId, getViewedUserId } from 'classroom/utils.js'
import { handleAnswer } from "classroom/answers/handleAnswer.js"

const moduleCache = new Map();

/**
 * Загружает модуль обработки ответов для типа задания
 * и возвращает публичный API модуля.
 *
 * @param {string} taskType
 * @returns {Promise<{
 *     bindAnswerSubmission?: Function,
 *     handleAnswer?: Function,
 *     clearTask?: Function,
 *     collectAnswers?: Function
 * } | null>}
 */
export async function loadAnswerModule(taskType) {
    if (!taskType) {
        return null;
    }

    if (moduleCache.has(taskType)) {
        return moduleCache.get(taskType);
    }

    const entry = ANSWER_HANDLER_MAP[taskType];
    if (!entry?.file) {
        return null;
    }

    try {
        const module = await import(
            `classroom/answers/templates/${entry.file}`
        );

        const api = {
            bindAnswerSubmission: module.bindAnswerSubmission,
            handleAnswer: module.handleAnswer,
            clearTask: module.clearTask,
            collectAnswers: module.collectAnswers
        };

        moduleCache.set(taskType, api);
        return api;
    } catch (err) {
        console.error(`Ошибка загрузки answer-модуля: ${taskType}`, err);
        return null;
    }
}

/**
 * Отправляет ответ пользователя на сервер и обновляет отображение задания.
 * При успешной отправке генерирует событие "answer:sent" с taskId.
 *
 * @param {Object} params
 * @param {number|string} params.taskId - ID задания
 * @param {any} params.data - Данные ответа
 * @returns {Promise<Object|null>} Результат от сервера или null при ошибке
 */
export async function sendAnswer({ taskId, data }) {
    const classroomId = getClassroomId();
    const viewedUserId = getViewedUserId();

    if (!classroomId) {
        showNotification("Произошла ошибка. Вы не можете сохранять ответы.");
        return null;
    }

    if (viewedUserId === "all") {
        showNotification("Выберите ученика на панели справа снизу.");
        return null;
    }

    const url = `/classroom/${classroomId}/save-answer/`;

    const payload = {
        task_id: taskId,
        data,
        user_id: viewedUserId
    };

    try {
        const result = await postJSON(url, payload);

        if (result?.success && result.answer) {
            const taskType = getTaskTypeFromContainer(taskId);

            const answerData = {
                answer: result.answer,
                task_id: taskId,
                task_type: taskType
            };

            await handleAnswer(answerData);

            eventBus.emit("answer:sent", { taskId });
        }

        return result;
    } catch (err) {
        console.error("Ошибка при отправке ответа:", err);
        showNotification("Не удалось отправить ответ.");
        return null;
    }
}

export async function fetchSectionAnswers(sectionId) {
    const classroomId = getClassroomId();
    const userId = getViewedUserId();

    if (userId === "all") {
        return;
    }
    const url = `/classroom/get-section-answers/?section_id=${sectionId}&classroom_id=${classroomId}&user_id=${userId}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

export async function fetchTaskAnswer(taskId) {
   /**
    * Получает данные ответа для задания с сервера
    * Возвращает: { task_id, task_type, answer: {...} }
    */
    const classroomId = getClassroomId();
    const userId = getViewedUserId();

    if (!classroomId) {
        throw new Error("Не указан виртуальный класс");
    }

    if (userId === "all") {
        return;
    }

    const url = `/classroom/get-task-answer/?task_id=${taskId}&classroom_id=${classroomId}&user_id=${userId}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (!data?.task_type) {
        throw new Error("Некорректный ответ от сервера");
    }

    return data;
}

