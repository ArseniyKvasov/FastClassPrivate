"use strict";

import { showNotification, getCurrentUserId } from "/static/js/tasks/utils.js";
import { getClassroomId, refreshClassroom } from '/static/classroom/utils.js'
import { handleWSMessage } from "/static/classroom/websocket/handleMessage.js";
import { eventBus } from "/static/js/tasks/events/eventBus.js";

export let virtualClassWS = null;

let reconnectDelay = 1000;
let maxReconnectDelay = 30000;
let baseReconnectDelay = 1000;

let hasEverConnected = false;

/**
 * Инициализирует WebSocket для виртуального класса и настраивает обработчики.
 */
export function initVirtualClassWebSocket() {
    if (virtualClassWS) return;

    const classroomId = getClassroomId();
    if (!classroomId) {
        showNotification("Не удалось присоединиться к классу");
        return;
    }

    const proto = location.protocol === "https:" ? "wss" : "ws";
    virtualClassWS = new WebSocket(
        `${proto}://${location.host}/ws/virtual-class/${classroomId}/`
    );

    virtualClassWS.onopen = async () => {
        console.log("WS connected");
        reconnectDelay = baseReconnectDelay;

        if (virtualClassWS && virtualClassWS.readyState === WebSocket.OPEN) {
            const currentUserId = getCurrentUserId();
            virtualClassWS.send(JSON.stringify({
                type: "user:mark_online",
                data: { student_id: currentUserId }
            }));
        }

        if (hasEverConnected) {
            try {
                await refreshClassroom();
            } catch (e) {
                console.error("Failed to restore data after reconnect", e);
            }
        }

        hasEverConnected = true;

        eventBus.emit("WS_connected");
    };

    virtualClassWS.onclose = () => {
        if (virtualClassWS) {
            try {
                const currentUserId = getCurrentUserId();
                virtualClassWS.send(JSON.stringify({
                    type: "user:mark_offline",
                    data: { student_id: currentUserId }
                }));
            } catch (e) {
                console.warn("Failed to send mark_offline before WS close", e);
            }
        }

        virtualClassWS = null;

        const jitter = Math.random() * 1000;
        const delayWithJitter = reconnectDelay + jitter;

        setTimeout(initVirtualClassWebSocket, delayWithJitter);
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
    };

    virtualClassWS.onerror = (e) => {
        console.error("WS error", e);
        // showNotification("Ошибка соединения виртуального класса");
    };

    virtualClassWS.onmessage = handleWSMessage;
}

window.addEventListener("beforeunload", () => {
    if (virtualClassWS && virtualClassWS.readyState === WebSocket.OPEN) {
        virtualClassWS.send(JSON.stringify({
            type: "user:mark_offline",
            data: { student_id: getCurrentUserId() }
        }));
    }
});