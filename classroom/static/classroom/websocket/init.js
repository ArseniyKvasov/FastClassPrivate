"use strict";

import { showNotification, getInfoElement, getCurrentUserId } from "/static/js/tasks/utils.js";
import { fetchSections, renderSectionsList, selectSection } from "/static/js/tasks/display/renderSections.js";
import { getClassroomId } from '/static/classroom/utils.js'
import { handleWSMessage } from "/static/classroom/websocket/handleMessage.js";
import { refreshChat } from "/static/classroom/integrations/chat.js"

export let virtualClassWS = null;

let reconnectDelay = 1000;
let maxReconnectDelay = 30000;
let baseReconnectDelay = 1000;

let hasEverConnected = false;

async function restoreAfterReconnect() {
    const infoEl = getInfoElement();
    if (infoEl) {
        infoEl.dataset.sectionId = "";
    }

    const sections = await fetchSections();
    if (!sections.length) return;

    await renderSectionsList(sections);
    await selectSection(sections[0].id);
    await refreshChat();
}

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
                await restoreAfterReconnect();
            } catch (e) {
                console.error("Failed to restore data after reconnect", e);
            }
        }

        hasEverConnected = true;
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