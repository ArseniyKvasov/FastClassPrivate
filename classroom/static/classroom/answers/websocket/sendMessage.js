"use strict";

import { eventBus } from "@tasks/events/eventBus.js";
import { showNotification } from "@tasks/utils.js"
import { getViewedUserId } from "@classroom/answers/utils.js";
import { virtualClassWS } from "@classroom/answers/websocket/init.js";

/**
 * Отправляет сообщение в WebSocket, если соединение открыто.
 *
 * @param {string} type
 * @param {Object} payload
 */
function sendWS(type, payload) {
    if (!virtualClassWS || virtualClassWS.readyState !== WebSocket.OPEN) return;
    virtualClassWS.send(JSON.stringify({ type, data: payload }));
}

/**
 * Регистрирует обработчики локальных событий, связанных с ответами.
 */
export function initAnswerEvents() {
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
            showNotification("Все ученики переведены к заданию");
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
}