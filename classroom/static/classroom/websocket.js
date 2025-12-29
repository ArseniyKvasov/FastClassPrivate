"use strict";

let virtualClassWS = null;

function initVirtualClassWebSocket() {
    if (virtualClassWS) return;

    const proto = location.protocol === "https:" ? "wss" : "ws";
    virtualClassWS = new WebSocket(`${proto}://${location.host}/ws/virtual-class/${virtualClassId}/`);

    virtualClassWS.onopen = () => console.log("WS connected");
    virtualClassWS.onclose = () => {
        virtualClassWS = null;
        setTimeout(initVirtualClassWebSocket, 2000);
    };
    virtualClassWS.onerror = (e) => console.error("WS error", e);
    virtualClassWS.onmessage = handleWSMessage;
}

function handleWSMessage(ev) {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    const { type, data } = msg;
    if (!type || !data?.task_id) return;
    if (!shouldProcessMessage(data)) return;

    if (type === "answer_submitted") {
        processTaskAnswer(data.task_id, data);
        return;
    }

    if (type === "task_cleared") {
        handleTaskCleared(data.task_id);
    }
}

function shouldProcessMessage({ student_id }) {
    if (isTeacher) {
        if (currentStudentId === "all") return true;
        return String(student_id) === String(getId());
    }
    return String(student_id) === String(getId());
}

async function processTaskAnswer(taskId, wsData) {
    try {
        const answerData = await fetchTaskAnswer(taskId);
        const handler = answerHandlers?.[answerData.task_type];

        if (typeof handler === "function") {
            handler(answerData, wsData);
        }
    } catch (e) {
        console.error("processTaskAnswer failed", e);
    }
}

function handleTaskCleared(taskId) {
    if (typeof clearTask === "function") {
        clearTask(taskId);
    }
}

function sendWS(type, payload) {
    if (!virtualClassWS || virtualClassWS.readyState !== WebSocket.OPEN) return;
    virtualClassWS.send(JSON.stringify({ type, data: payload }));
}

function notifyAnswerSubmitted(taskId) {
    sendWS("answer_submitted", {
        task_id: taskId,
        student_id: getId()
    });
}

function notifyTaskCleared(taskId, studentId = "all") {
    if (!isTeacher) return;

    sendWS("task_cleared", {
        task_id: taskId,
        student_id: studentId
    });
}

document.addEventListener("DOMContentLoaded", initVirtualClassWebSocket);
