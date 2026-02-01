"use strict";

import { eventBus } from "/static/js/tasks/events/eventBus.js";
import { getCurrentUserId } from "/static/js/tasks/utils.js";
import { showNotification } from "/static/js/tasks/utils.js"
import { getViewedUserId, refreshClassroom } from '/static/classroom/utils.js'
import { virtualClassWS } from "/static/classroom/websocket/init.js";

/**
 * Отправляет сообщение в WebSocket, если соединение открыто.
 *
 * @param {string} type
 * @param {Object} payload
 */
export function sendWS(type, payload) {
    if (!virtualClassWS || virtualClassWS.readyState !== WebSocket.OPEN) return;
    virtualClassWS.send(JSON.stringify({ type, data: payload }));
}

/**
 * Регистрирует обработчики локальных событий.
 */
export function initEvents(isTeacher = false) {
    eventBus.on("answer:sent", async (payload) => {
        try {
            if (!payload?.taskId) return;
            sendWS("answer:sent", {
                task_id: payload.taskId,
                student_id: getViewedUserId()
            });
        } catch (e) {
            console.error("eventBus answer:sent message failed", e);
        }
    });

    eventBus.on("answer:reset", async (payload) => {
        try {
            if (!payload?.taskId) return;
            sendWS("answer:reset", {
                task_id: payload.taskId,
                student_id: getViewedUserId()
            });
        } catch (e) {
            console.error("eventBus answer:reset message failed", e);
        }
    });

    eventBus.on("section_list:change", async () => {
        try {
            sendWS("section_list:change", {
                student_id: "all"
            });
        } catch (e) {
            console.error("eventBus section_list:change message failed", e);
        }
    });

    eventBus.on("task:attention", async (payload) => {
        try {
            if (!payload?.taskId) return;
            sendWS("task:attention", {
                task_id: payload.taskId,
                student_id: "all",
                section_id: payload.sectionId
            });
            showNotification("Ученики переведены к заданию");
        } catch (e) {
            console.error("eventBus task:attention message failed", e);
        }
    });

    eventBus.on("section:change", async (payload) => {
        try {
            if (!payload?.sectionId) return;
            sendWS("section:change", {
                student_id: "all",
                section_id: payload.sectionId
            });
        } catch (e) {
            console.error("eventBus section:change message failed", e);
        }
    });

    eventBus.on("chat:send_message", async (payload) => {
        try {
            if (!payload?.text) return;
            sendWS("chat:send_message", {
                message_id: payload.messageId,
                text: payload.text,
                sender_id: getCurrentUserId(),
                student_id: "all",
            });
        } catch (e) {
            console.error("eventBus chat:send_message failed", e);
        }
    });

    /**
     * Обрабатывает изменение чата (редактирование или удаление сообщения)
     */
    eventBus.on("chat:update", async (payload) => {
        try {
            sendWS("chat:update", {
                student_id: "all"
            });
        } catch (e) {
            console.error("eventBus chat:update failed", e);
        }
    });

    /**
     * Отправляет событие изменения режима копирования ученикам.
     * @param {Object} payload { allowed: boolean }
     */
    eventBus.on("copying:changed", async (payload) => {
        try {
            if (typeof payload?.allowed !== "boolean") return;
            sendWS("copying:changed", {
                allowed: payload.allowed,
                student_id: "all"
            });
        } catch (e) {
            console.error("eventBus copying:changed failed", e);
        }
    });

    /**
     * Обрабатывает удаление ученика.
     * @param {string|number} studentId - ID удалённого ученика
     */
    eventBus.on("user:delete", async (studentId) => {
        try {
            if (!studentId) return;
            sendWS("user:delete", {
                student_id: studentId,
            });
            sendWS("chat:update", {
                student_id: "all"
            });
            refreshClassroom();
        } catch (e) {
            console.error("eventBus user:delete failed", e);
        }
    });
}