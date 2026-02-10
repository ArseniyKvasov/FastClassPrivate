import { getClassroomId } from 'classroom/utils.js';
import { getCsrfToken, getCurrentUserId, getIsTeacher, showNotification, escapeHtml, confirmAction } from 'js/tasks/utils.js';
import { eventBus } from 'js/tasks/events/eventBus.js';

const chatPanel = document.getElementById('chatPanel');
const chatButton = document.getElementById('chatButton');
const closeChat = document.getElementById('closeChatPanel');
const chatSend = document.getElementById('chatSendButton');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

let handlersAttached = false;
let editingMessageId = null;
let chatCancelBtn = null;
let isChatOpen = false;
let newMessageIndicator = null;
let rateLimitActions = [];
let lastSenderId = null;
const isTeacher = getIsTeacher();
let needsScroll = false;

const MAX_MESSAGES = 50;
const MAX_NAME_LENGTH = 20;
const MESSAGE_RATE_LIMIT = isTeacher ? 10 : 5;
const RATE_LIMIT_WINDOW = 60000;
const MAX_DISPLAY_CHARS = 1024;

function formatName(name) {
    if (!name) return '';
    return name.length <= MAX_NAME_LENGTH ? name : name.slice(0, MAX_NAME_LENGTH - 1) + '…';
}

function safeDatasetValue(value) {
    return value ? String(value).replace(/[^a-zA-Z0-9-_]/g, '-') : '';
}

function checkRateLimit() {
    const now = Date.now();
    const currentUserId = getCurrentUserId();

    const userActions = rateLimitActions.filter(action =>
        action.senderId === currentUserId && (now - action.timestamp) < RATE_LIMIT_WINDOW
    );

    if (userActions.length >= MESSAGE_RATE_LIMIT) {
        showNotification(`Нельзя отправлять больше ${MESSAGE_RATE_LIMIT} сообщений в минуту`);
        return false;
    }

    return true;
}

function addActionToRateLimit() {
    const currentUserId = getCurrentUserId();
    const now = Date.now();

    rateLimitActions.push({
        senderId: currentUserId,
        timestamp: now
    });

    rateLimitActions = rateLimitActions.filter(action => (now - action.timestamp) < RATE_LIMIT_WINDOW * 2);
}

function autoResizeTextarea(el, maxHeight = 100) {
    if (!el) return;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const newH = Math.min(scrollH, maxHeight);
    el.style.height = newH + 'px';
    el.style.overflowY = scrollH > maxHeight ? 'auto' : 'hidden';
}

function scrollToBottom(smooth = true) {
    if (!chatMessages) return;
    try {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    } catch {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function scrollToBottomIfNeeded() {
    if (!chatMessages) return;

    const scrollDifference = chatMessages.scrollHeight - (chatMessages.scrollTop + chatMessages.clientHeight);
    const lastMessage = chatMessages.lastElementChild;
    const lastMessageHeight = lastMessage ? lastMessage.offsetHeight : 0;

    if (scrollDifference < lastMessageHeight + 50) {
        try {
            chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        } catch {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
}

function createIconElement(iconClass, title) {
    const el = document.createElement('i');
    el.className = iconClass;
    el.title = title || '';
    el.style.fontSize = '14px';
    el.style.lineHeight = '1';
    el.style.cursor = 'pointer';
    el.style.display = 'inline-block';
    el.style.padding = '4px';
    el.style.borderRadius = '6px';
    el.style.transition = 'background .12s, opacity .12s';
    el.addEventListener('mouseenter', () => el.style.opacity = '1');
    el.addEventListener('mouseleave', () => el.style.opacity = '0.85');
    return el;
}

/**
 * Создаёт HTML-пузырь для сообщения.
 *
 * Ограничивает отображаемый текст до MAX_DISPLAY_CHARS и экранирует HTML.
 */
export function createBubbleNode(message, showSenderName = true) {
    const currentUserId = getCurrentUserId();
    const isOwn = currentUserId && String(message.sender_id) === String(currentUserId);
    const canDeleteOthers = isTeacher && !isOwn;

    const container = document.createElement('div');
    container.className = `d-flex align-items-center mb-1 ${isOwn ? 'justify-content-end' : 'justify-content-start'}`;
    container.dataset.messageId = safeDatasetValue(message.id);
    container.dataset.senderId = safeDatasetValue(message.sender_id);

    const bubble = document.createElement('div');
    bubble.className = 'chat-message bubble p-2';
    bubble.style.maxWidth = '75%';
    bubble.style.wordBreak = 'break-word';
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.style.fontSize = '0.9rem';
    bubble.style.borderRadius = '12px';
    bubble.style.marginTop = showSenderName ? '4px' : '2px';

    if (isOwn) {
        bubble.classList.add('bg-primary', 'text-light');
    } else {
        bubble.classList.add('bg-light', 'text-dark');

        if (showSenderName) {
            const sender = document.createElement('div');
            sender.className = 'text-muted chat-sender small mb-1';
            sender.title = escapeHtml(message.sender_name || message.senderName || '');
            sender.innerHTML = escapeHtml(formatName(message.sender_name || message.senderName || 'Unknown'));
            bubble.appendChild(sender);
        }
    }

    const text = document.createElement('div');
    text.className = 'chat-text';

    const raw = String(message.text || '');
    const truncated = raw.length > MAX_DISPLAY_CHARS ? raw.slice(0, MAX_DISPLAY_CHARS - 1) + '…' : raw;

    const convertUrlsToLinks = (textContent) => {
        const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+\.[^\s<]+)/gi;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        while ((match = urlRegex.exec(textContent)) !== null) {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(textContent.substring(lastIndex, match.index)));
            }

            const link = document.createElement('a');
            const url = match[0].startsWith('www.') ? `https://${match[0]}` : match[0];
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = match[0];
            link.className = 'text-decoration-none';
            link.style.color = isOwn ? '#ffffff' : '#0d6efd';
            link.style.textDecoration = 'underline';

            fragment.appendChild(link);
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < textContent.length) {
            fragment.appendChild(document.createTextNode(textContent.substring(lastIndex)));
        }

        return fragment;
    };

    const cleanText = escapeHtml(truncated);
    const textFragment = convertUrlsToLinks(cleanText);

    if (textFragment.childNodes.length > 0) {
        text.appendChild(textFragment);
    } else {
        text.innerHTML = cleanText;
    }

    bubble.appendChild(text);

    const controls = document.createElement('div');
    controls.className = 'chat-controls d-flex align-items-center';
    controls.style.gap = '6px';
    controls.style.opacity = '0';
    controls.style.transition = 'opacity 0.12s';
    controls.style.pointerEvents = 'none';

    if (isOwn) {
        const editIcon = createIconElement('bi bi-pencil', 'Редактировать');
        editIcon.addEventListener('click', (e) => { e.stopPropagation(); startEditMessage(message); });
        controls.appendChild(editIcon);
    }

    if (isOwn || canDeleteOthers) {
        const delIcon = createIconElement('bi bi-trash', isTeacher && !isOwn ? 'Удалить сообщение ученика' : 'Удалить');
        delIcon.addEventListener('click', async (e) => { e.stopPropagation(); await handleDeleteMessage(message.id); });
        controls.appendChild(delIcon);
    }

    if (controls.children.length > 0) {
        container.addEventListener('mouseenter', () => {
            controls.style.opacity = '1';
            controls.style.pointerEvents = 'auto';
        });
        container.addEventListener('mouseleave', () => {
            if (!container.classList.contains('controls-visible')) {
                controls.style.opacity = '0';
                controls.style.pointerEvents = 'none';
            }
        });
        container.addEventListener('click', () => {
            const prev = chatMessages.querySelector('.controls-visible');
            if (prev && prev !== container) {
                prev.classList.remove('controls-visible');
                const prevControls = prev.querySelector('.chat-controls');
                if (prevControls) {
                    prevControls.style.opacity = '0';
                    prevControls.style.pointerEvents = 'none';
                }
            }
            const show = !container.classList.contains('controls-visible');
            container.classList.toggle('controls-visible', show);
            controls.style.opacity = show ? '1' : '0';
            controls.style.pointerEvents = show ? 'auto' : 'none';
        });
    }

    if (isOwn) {
        if (controls.children.length > 0) {
            controls.style.marginRight = '6px';
            container.appendChild(controls);
        }
        container.appendChild(bubble);
    } else {
        container.appendChild(bubble);
        if (controls.children.length > 0) {
            controls.style.marginLeft = '6px';
            container.appendChild(controls);
        }
    }

    return container;
}

function removeOldMessages() {
    if (!chatMessages) return;
    while (chatMessages.children.length > MAX_MESSAGES) {
        const firstChild = chatMessages.firstElementChild;
        if (firstChild && firstChild.classList.contains('chat-info-message')) {
            const secondChild = chatMessages.children[1];
            if (secondChild) {
                chatMessages.removeChild(secondChild);
            } else {
                break;
            }
        } else {
            chatMessages.removeChild(firstChild);
        }
    }
}

export function clearChat() {
    if (chatMessages) chatMessages.innerHTML = '';
    lastSenderId = null;
}

/**
 * Начинает режим редактирования: заполняет textarea, ставит иконку подтверждения
 */
function startEditMessage(message) {
    editingMessageId = message.id;
    if (!chatInput) return;
    chatInput.value = message.text || '';
    autoResizeTextarea(chatInput);
    updateSendButtonState();

    if (chatSend) {
        chatSend.innerHTML = '<i class="bi bi-check-lg"></i>';
        chatSend.style.width = '36px';
        chatSend.style.height = '36px';
        chatSend.style.display = 'inline-flex';
        chatSend.style.alignItems = 'center';
        chatSend.style.justifyContent = 'center';
        chatSend.style.padding = '0';
    }

    if (!chatCancelBtn) {
        chatCancelBtn = document.createElement('button');
        chatCancelBtn.type = 'button';
        chatCancelBtn.className = 'btn border-0 d-flex align-items-center justify-content-center';
        chatCancelBtn.title = 'Отменить';
        chatCancelBtn.style.height = '36px';
        chatCancelBtn.style.padding = '0 8px';
        chatCancelBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
        chatCancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelEditMode();
        });
    }

    const footer = chatSend && chatSend.parentElement;
    if (footer && !footer.contains(chatCancelBtn)) {
        footer.insertBefore(chatCancelBtn, chatSend.nextSibling);
    }
}

function cancelEditMode() {
    editingMessageId = null;
    if (chatInput) {
        chatInput.value = '';
        autoResizeTextarea(chatInput);
    }
    if (chatSend) {
        chatSend.innerHTML = '<i class="bi bi-send"></i>';
        chatSend.style.width = '';
        chatSend.style.height = '';
        chatSend.style.padding = '';
    }
    if (chatCancelBtn && chatCancelBtn.parentElement) {
        chatCancelBtn.parentElement.removeChild(chatCancelBtn);
    }
    updateSendButtonState();
}

async function editMessageRequest(messageId, newText) {
    if (!messageId) throw new Error('No message id');
    const safeId = safeDatasetValue(messageId);
    const url = `/classroom/messages/${encodeURIComponent(safeId)}/edit/`;
    const body = new URLSearchParams({ text: String(newText || '') });

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCsrfToken() },
        body: body.toString(),
        credentials: 'same-origin'
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Edit failed: ${resp.status} ${txt}`);
    }
    return resp.json();
}

async function handleDeleteMessage(messageId) {
    if (!messageId) return;

    try {
        const currentUserId = getCurrentUserId();
        const isTeacher = getIsTeacher();

        const messageElement = document.querySelector(`[data-message-id="${safeDatasetValue(messageId)}"]`);
        const messageSenderId = messageElement ? messageElement.dataset.senderId : null;
        const isOwnMessage = currentUserId && messageSenderId && String(messageSenderId) === String(currentUserId);

        let confirmMessage = 'Удалить сообщение?';
        if (isTeacher && !isOwnMessage) {
            confirmMessage = 'Удалить сообщение ученика?';
        }

        const ok = await confirmAction(confirmMessage);
        if (!ok) return;

        const safeId = safeDatasetValue(messageId);
        const url = `/classroom/messages/${encodeURIComponent(safeId)}/delete/`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCsrfToken() },
            credentials: 'same-origin'
        });

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Delete failed: ${resp.status} ${txt}`);
        }

        await refreshChat();
        eventBus.emit('chat:update');
    } catch (err) {
        console.error('Ошибка удаления', err);
        showNotification('Ошибка удаления сообщения');
    }
}

/**
 * Убирает пустые строки в начале и в конце текста
 */
function trimBlankLines(text) {
    if (typeof text !== 'string') return '';
    const lines = text.split(/\r\n|\n/);
    let start = 0;
    let end = lines.length - 1;

    while (start <= end && lines[start].trim() === '') start++;
    while (end >= start && lines[end].trim() === '') end--;

    return lines.slice(start, end + 1).join('\n');
}

async function sendMessage() {
    if (!chatInput) return;
    let text = chatInput.value;
    if (!text) return;

    text = trimBlankLines(text);
    if (!text) return;

    if (!checkRateLimit()) {
        return;
    }

    if (editingMessageId) {
        try {
            await editMessageRequest(editingMessageId, text);
            cancelEditMode();
            await refreshChat();
            addActionToRateLimit();
            eventBus.emit('chat:update');
        } catch (err) {
            console.error('Ошибка редактирования', err);
            showNotification('Ошибка редактирования сообщения');
        }
        return;
    }

    try {
        const classroomId = getClassroomId();
        if (!classroomId) throw new Error('No classroom id');

        const url = `/classroom/messages/${classroomId}/send/`;
        const body = new URLSearchParams({ text });

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCsrfToken() },
            body: body.toString(),
            credentials: 'same-origin'
        });

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Send failed: ${resp.status} ${txt}`);
        }

        addActionToRateLimit();

        const data = await resp.json();
        if (data.message && data.message.id) {
            const infoMessage = chatMessages.querySelector('.chat-info-message');
            if (infoMessage) {
                infoMessage.remove();
            }

            const currentUserId = getCurrentUserId();
            const showSenderName = lastSenderId !== data.message.sender_id;
            lastSenderId = data.message.sender_id;

            chatMessages.appendChild(createBubbleNode(data.message, showSenderName));
            removeOldMessages();

            chatInput.value = '';
            autoResizeTextarea(chatInput);
            updateSendButtonState();
            eventBus.emit('chat:send_message', { text, messageId: data.message.id });
            scrollToBottom(true);
        }
    } catch (err) {
        console.error('Ошибка отправки сообщения', err);
        showNotification('Ошибка отправки сообщения');
    }
}

function createNewMessageIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'new-message-indicator';
    indicator.style.position = 'absolute';
    indicator.style.top = '-2px';
    indicator.style.right = '-2px';
    indicator.style.width = '8px';
    indicator.style.height = '8px';
    indicator.style.backgroundColor = '#dc3545';
    indicator.style.borderRadius = '50%';
    indicator.style.zIndex = '1000';
    indicator.style.display = 'none';
    indicator.style.animation = 'pulse 0.5s ease-in-out';
    indicator.style.boxShadow = '0 0 0 0 rgba(220, 53, 69, 1)';

    indicator.addEventListener('animationend', () => {
        indicator.style.animation = 'none';
    });

    return indicator;
}

function showNewMessageIndicator() {
    if (!newMessageIndicator) {
        newMessageIndicator = createNewMessageIndicator();
        if (chatButton) {
            chatButton.style.position = 'relative';
            chatButton.appendChild(newMessageIndicator);
            needsScroll = true;
        }
    }
    newMessageIndicator.style.display = 'block';
}

function hideNewMessageIndicator() {
    if (newMessageIndicator) {
        newMessageIndicator.style.display = 'none';
    }
}

export function pointNewMessage(messageData) {
    if (!messageData || !messageData.text || !messageData.message_id) return;

    const message = {
        id: messageData.message_id,
        text: messageData.text,
        sender_id: messageData.sender_id,
        sender_name: messageData.sender_name || 'Пользователь',
        created_at: messageData.created_at || new Date().toISOString()
    };

    const infoMessage = chatMessages.querySelector('.chat-info-message');
    if (infoMessage) {
        infoMessage.remove();
    }

    const showSenderName = lastSenderId !== messageData.sender_id;
    lastSenderId = messageData.sender_id;

    chatMessages.appendChild(createBubbleNode(message, showSenderName));
    removeOldMessages();

    if (!isChatOpen) {
        showNewMessageIndicator();
    } else {
        scrollToBottomIfNeeded();
    }
}

export async function refreshChat() {
    try {
        const classroomId = getClassroomId();
        if (!classroomId) throw new Error('No classroom id');

        const url = `/classroom/messages/${encodeURIComponent(safeDatasetValue(classroomId))}/`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin'
        });

        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        const data = await resp.json();
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        const recent = msgs.slice(-MAX_MESSAGES);

        clearChat();
        lastSenderId = null;

        if (recent.length > 0) {
            let prevSenderId = null;
            for (const m of recent) {
                const showSenderName = prevSenderId !== m.sender_id;
                chatMessages.appendChild(createBubbleNode(m, showSenderName));
                prevSenderId = m.sender_id;
            }
        }

        removeOldMessages();
    } catch (e) {
        console.error('Ошибка обновления чата', e);
    }
}

function togglePanel() {
    if (!chatPanel) return;
    const isVisible = chatPanel.style.display === 'flex';
    chatPanel.style.display = isVisible ? 'none' : 'flex';
    isChatOpen = !isVisible;

    if (!isVisible) {
        setTimeout(() => {
            if (chatInput) chatInput.focus();
            if (needsScroll) {
                scrollToBottom(true);
                needsScroll = false;
            }
            hideNewMessageIndicator();
        }, 100);
    }
}

function closeChatPanel() {
    if (chatPanel) {
        chatPanel.style.display = 'none';
        isChatOpen = false;
    }
}

function updateSendButtonState() {
    if (!chatSend || !chatInput) return;
    const text = String(chatInput.value || '');
    const trimmed = trimBlankLines(text);
    const hasText = trimmed.trim().length > 0;
    if (hasText) {
        chatSend.removeAttribute('disabled');
    } else {
        chatSend.setAttribute('disabled', 'disabled');
    }
}

function attachEventHandlers() {
    if (handlersAttached) return;

    if (chatButton) chatButton.addEventListener('click', togglePanel);
    if (closeChat) closeChat.addEventListener('click', closeChatPanel);
    if (chatSend) {
        chatSend.addEventListener('click', (e) => {
            if (chatSend.hasAttribute('disabled')) return;
            sendMessage();
        });
    }
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!chatSend || chatSend.hasAttribute('disabled')) return;
                sendMessage();
            } else if (e.key === 'Escape' && editingMessageId) {
                cancelEditMode();
            }
        });

        chatInput.addEventListener('input', () => {
            autoResizeTextarea(chatInput);
            updateSendButtonState();
        });
    }

    // ensure send button disabled by default
    updateSendButtonState();
    handlersAttached = true;
}

export async function initChat() {
    if (!chatPanel || !chatButton || !chatMessages) {
        console.error('Не найдены необходимые элементы чата');
        return;
    }
    attachEventHandlers();
    await refreshChat();
    needsScroll = true;

    if (chatInput) {
        autoResizeTextarea(chatInput);
    }
    updateSendButtonState();
}
