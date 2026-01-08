import { showNotification, getInfoElement } from "/static/js/tasks/utils.js";
import { fetchSections, renderSectionsList, selectSection } from "/static/js/tasks/display/renderSections.js";
import { getClassroomId } from '/static/classroom/utils.js'
import { handleWSMessage } from "/static/classroom/websocket/handleMessage.js";
import { refreshChat } from "/static/classroom/integrations/chat.js"
import { virtualClassWS } from "/static/classroom/websocket/init.js"
import { window } from "/static/js/tasks/utils.js";

export let virtualClassWS = null;

let reconnectDelay = 1000;
let maxReconnectDelay = 30000;
let baseReconnectDelay = 1000;
let hasEverConnected = false;

async function restoreAfterReconnect() {
    const infoEl = getInfoElement();
    if (infoEl) infoEl.dataset.sectionId = "";

    const sections = await fetchSections();
    if (!sections.length) return;

    await renderSectionsList(sections);
    await selectSection(sections[0].id);
    await refreshChat();

    if (window.__teacherPanel?.setOnlineSet) {
        window.__teacherPanel.setOnlineSet(Array.from(window.__teacherPanel.onlineStudents));
    }
}

export function initVirtualClassWebSocket() {
    if (virtualClassWS) return;

    const classroomId = getClassroomId();
    if (!classroomId) {
        showNotification("Не удалось присоединиться к классу");
        return;
    }

    const proto = location.protocol === "https:" ? "wss" : "ws";
    virtualClassWS = new WebSocket(`${proto}://${location.host}/ws/virtual-class/${classroomId}/`);

    virtualClassWS.onopen = async () => {
        console.log("WS connected");
        reconnectDelay = baseReconnectDelay;

        if (hasEverConnected) {
            try { await restoreAfterReconnect(); } catch(e) { console.error(e); }
        }

        hasEverConnected = true;
    };

    virtualClassWS.onclose = () => {
        virtualClassWS = null;

        const jitter = Math.random() * 1000;
        setTimeout(initVirtualClassWebSocket, reconnectDelay + jitter);
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
    };

    virtualClassWS.onerror = (e) => console.error("WS error", e);

    virtualClassWS.onmessage = handleWSMessage;
}
