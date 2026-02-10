"use strict";

import { showNotification, getCurrentUserId } from "js/tasks/utils.js";
import { getClassroomId, refreshClassroom } from 'classroom/utils.js'
import { handleWSMessage } from "classroom/websocket/handleMessage.js";
import { eventBus } from "js/tasks/events/eventBus.js";

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

        if (hasEverConnected) {
            try {
                await refreshClassroom();
                showNotification("Соединение восстановлено");
            } catch (e) {
                console.error("Failed to restore data after reconnect", e);
            }
        }

        hasEverConnected = true;
        eventBus.emit("WS_connected");
    };

    virtualClassWS.onclose = () => {
        virtualClassWS = null;

        const jitter = Math.random() * 1000;
        const delayWithJitter = reconnectDelay + jitter;

        setTimeout(initVirtualClassWebSocket, delayWithJitter);
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
    };

    virtualClassWS.onerror = (e) => {
        console.error("WS error", e);
    };

    virtualClassWS.onmessage = handleWSMessage;
}