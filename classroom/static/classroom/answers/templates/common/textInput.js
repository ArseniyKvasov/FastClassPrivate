import { debounce, adjustTextareaHeight, processTaskAnswer } from "/static/classroom/answers/utils.js";
import { sendAnswer } from "/static/classroom/answers/api.js";

let isApplyingServerUpdate = false;
let pendingChanges = new Map();
let userTypingTimeouts = new Map();

export function bindAnswerSubmission(container, task) {
    if (!container) return;

    const editor = container.querySelector("div[contenteditable='true']");
    if (!editor) return;

    const sendEditorAnswer = debounce(() => {
        if (isApplyingServerUpdate) return;

        const content = editor.innerHTML;

        sendAnswer({
            taskId: task.task_id,
            data: { current_text: content }
        });
    }, 400);

    editor.addEventListener("input", (e) => {
        if (isApplyingServerUpdate) return;

        sendEditorAnswer();

        const taskId = task.task_id;
        clearTimeout(userTypingTimeouts.get(taskId));
        userTypingTimeouts.set(taskId, setTimeout(() => {
            userTypingTimeouts.delete(taskId);
        }, 1000));
    });

    editor.addEventListener("keydown", (e) => {
        if (isApplyingServerUpdate) return;

        const taskId = task.task_id;
        if (e.key === "Enter") {
            setTimeout(sendEditorAnswer, 50);
        } else if (e.key.length === 1) {
            const timeout = userTypingTimeouts.get(taskId);
            if (timeout) {
                clearTimeout(timeout);
            }
            userTypingTimeouts.set(taskId, setTimeout(() => {
                userTypingTimeouts.delete(taskId);
                sendEditorAnswer();
            }, 200));
        }
    });
}

export async function handleAnswer(data) {
    if (!data || data.task_type !== "text_input") return;
    if (data.answer === null) return;

    const taskId = data.task_id;
    const serverHTML = data.answer?.current_text ?? "";
    const isChecked = data.answer?.is_checked ?? false;

    const container = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!container) return;

    const editor = container.querySelector("div[contenteditable='true']");
    if (!editor) return;

    if (userTypingTimeouts.has(taskId)) {
        pendingChanges.set(taskId, { serverHTML, isChecked });
        return;
    }

    const currentHTML = editor.innerHTML;

    if (currentHTML === serverHTML) {
        editor.contentEditable = !isChecked;
        return;
    }

    isApplyingServerUpdate = true;

    try {
        const userIsTyping = document.activeElement === editor;

        if (userIsTyping) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && selection.anchorNode) {
                const range = selection.getRangeAt(0);

                const isInEditor = editor.contains(selection.anchorNode);
                if (!isInEditor) {
                    editor.innerHTML = serverHTML;
                    editor.contentEditable = !isChecked;
                    return;
                }

                const anchorNode = selection.anchorNode;
                const anchorOffset = selection.anchorOffset;
                const focusNode = selection.focusNode;
                const focusOffset = selection.focusOffset;

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = currentHTML;
                const serverDiv = document.createElement('div');
                serverDiv.innerHTML = serverHTML;

                const editorRect = editor.getBoundingClientRect();
                const cursorTop = range.getBoundingClientRect().top;

                editor.innerHTML = serverHTML;

                if (cursorTop >= editorRect.top && cursorTop <= editorRect.bottom) {
                    try {
                        const nodes = [];
                        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
                        let node;
                        let position = 0;

                        while ((node = walker.nextNode())) {
                            nodes.push({ node, start: position, end: position + node.length });
                            position += node.length;
                        }

                        const originalRange = document.createRange();
                        originalRange.setStart(anchorNode, Math.min(anchorOffset, anchorNode.length || 0));
                        originalRange.setEnd(focusNode, Math.min(focusOffset, focusNode.length || 0));
                        const originalText = originalRange.toString();

                        let bestMatch = { node: null, offset: 0, distance: Infinity };

                        for (const { node: textNode, start } of nodes) {
                            const nodeText = textNode.textContent || '';
                            for (let i = 0; i <= nodeText.length; i++) {
                                const range = document.createRange();
                                range.setStart(textNode, i);
                                range.setEnd(textNode, i);
                                const rect = range.getBoundingClientRect();

                                if (rect.height > 0) {
                                    const distance = Math.abs(rect.top - cursorTop);
                                    if (distance < bestMatch.distance) {
                                        bestMatch = { node: textNode, offset: i, distance };
                                    }
                                }
                            }
                        }

                        if (bestMatch.node) {
                            const newRange = document.createRange();
                            newRange.setStart(bestMatch.node, bestMatch.offset);
                            newRange.setEnd(bestMatch.node, bestMatch.offset);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        }
                    } catch (e) {
                        console.warn("Could not restore cursor position:", e);
                    }
                }
            } else {
                editor.innerHTML = serverHTML;
            }
        } else {
            editor.innerHTML = serverHTML;
        }

        editor.contentEditable = !isChecked;

    } catch (error) {
        console.error("Error handling answer update:", error);
        editor.innerHTML = serverHTML;
        editor.contentEditable = !isChecked;
    } finally {
        setTimeout(() => {
            isApplyingServerUpdate = false;

            const pending = pendingChanges.get(taskId);
            if (pending) {
                pendingChanges.delete(taskId);
                setTimeout(() => handleAnswer({
                    ...data,
                    answer: {
                        current_text: pending.serverHTML,
                        is_checked: pending.isChecked
                    }
                }), 100);
            }
        }, 50);
    }
}

export function clearTask(container) {
    const editor = container.querySelector(".rich-text-editor-area");
    if (!editor) return;

    editor.contentEditable = true;
    editor.disabled = false;

    const taskId = container.getAttribute("data-task-id");
    if (taskId) {
        userTypingTimeouts.delete(taskId);
        pendingChanges.delete(taskId);
        processTaskAnswer(taskId);
    }
}