import { getClassroomId } from '/static/classroom/utils.js';
import { getCsrfToken, getCurrentUserId, getIsTeacher, showNotification, escapeHtml, confirmAction } from '/static/js/tasks/utils.js';
import { eventBus } from '/static/js/tasks/events/eventBus.js';

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

/**
 * Форматирует имя пользователя
 */
function formatName(name) {
    if (!name) return '';
    return name.length <= MAX_NAME_LENGTH ? name : name.slice(0, MAX_NAME_LENGTH - 1) + '…';
}

/**
 * Безопасно преобразует значение для использования в data-атрибутах
 */
function safeDatasetValue(value) {
    return value ? String(value).replace(/[^a-zA-Z0-9-_]/g, '-') : '';
}

/**
 * Проверяет ограничение скорости отправки/редактирования сообщений
 */
function checkRateLimit() {
    const now = Date.now();
    const currentUserId = getCurrentUserId();

    const userActions = rateLimitActions.filter(action =>
        action.senderId === currentUserId && (now - action.timestamp) < RATE_LIMIT_WINDOW
    );

    if (userActions.length >= MESSAGE_RATE_LIMIT) {
        const oldestAction = userActions.reduce((oldest, current) =>
            current.timestamp < oldest.timestamp ? current : oldest
        );
        const timeLeft = RATE_LIMIT_WINDOW - (now - oldestAction.timestamp);
        showNotification(`Нельзя отправлять больше ${MESSAGE_RATE_LIMIT} сообщений в минуту`);
        return false;
    }

    return true;
}

/**
 * Добавляет запись о действии для отслеживания лимита
 */
function addActionToRateLimit() {
    const currentUserId = getCurrentUserId();
    const now = Date.now();

    rateLimitActions.push({
        senderId: currentUserId,
        timestamp: now
    });

    rateLimitActions = rateLimitActions.filter(action => (now - action.timestamp) < RATE_LIMIT_WINDOW * 2);
}

/**
 * Прокручивает чат к последнему сообщению
 */
function scrollToBottom(smooth = true) {
    if (!chatMessages) return;
    try {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    } catch {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Создает элемент иконки для управления сообщением
 */
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
 * Создает элемент сообщения с группировкой сообщений от одного пользователя
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
    text.innerHTML = escapeHtml(message.text || '');
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
        const delIcon = createIconElement('bi bi-trash', 'Удалить');
        const deleteTitle = canDeleteOthers ? 'Удалить сообщение ученика' : 'Удалить';
        delIcon.title = deleteTitle;
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

/**
 * Удаляет старые сообщения, превышающие лимит
 */
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

/**
 * Очищает окно чата
 */
export function clearChat() {
    if (chatMessages) chatMessages.innerHTML = '';
    lastSenderId = null;
}

/**
 * Начинает редактирование сообщения
 */
function startEditMessage(message) {
    editingMessageId = message.id;
    if (!chatInput) return;
    chatInput.value = message.text || '';
    chatInput.focus();
    chatInput.select();

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
        chatCancelBtn = document.createElement('i');
        chatCancelBtn.className = 'bi bi-x-lg';
        chatCancelBtn.title = 'Отменить';
        chatCancelBtn.style.cursor = 'pointer';
        chatCancelBtn.style.fontSize = '20px';
        chatCancelBtn.style.display = 'inline-flex';
        chatCancelBtn.style.alignItems = 'center';
        chatCancelBtn.style.justifyContent = 'center';
        chatCancelBtn.style.marginLeft = '8px';
        chatCancelBtn.addEventListener('click', (e) => { e.stopPropagation(); cancelEditMode(); });
    }

    const footer = chatSend && chatSend.parentElement;
    if (footer && !footer.contains(chatCancelBtn)) {
        footer.insertBefore(chatCancelBtn, chatSend.nextSibling);
    }
}

/**
 * Отменяет режим редактирования
 */
function cancelEditMode() {
    editingMessageId = null;
    if (chatInput) chatInput.value = '';
    if (chatSend) {
        chatSend.innerHTML = '<i class="bi bi-send"></i>';
        chatSend.style.width = '';
        chatSend.style.height = '';
        chatSend.style.padding = '';
    }
    if (chatCancelBtn && chatCancelBtn.parentElement) {
        chatCancelBtn.parentElement.removeChild(chatCancelBtn);
    }
}

/**
 * Отправляет запрос на редактирование сообщения
 */
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

/**
 * Обрабатывает удаление сообщения
 */
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
 * Отправляет новое сообщение или сохраняет отредактированное
 */
async function sendMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
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

        const url = `/classroom/messages/${encodeURIComponent(safeDatasetValue(classroomId))}/send/`;
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

        chatInput.value = '';

        addActionToRateLimit();

        const data = await resp.json();
        if (data.message) {
            const infoMessage = chatMessages.querySelector('.chat-info-message');
            if (infoMessage) {
                infoMessage.remove();
            }

            const currentUserId = getCurrentUserId();
            const showSenderName = lastSenderId !== currentUserId;
            lastSenderId = currentUserId;

            chatMessages.appendChild(createBubbleNode(data.message, showSenderName));
            removeOldMessages();
            eventBus.emit('chat:send_message', { text });
            scrollToBottom(true);
        }
    } catch (err) {
        console.error('Ошибка отправки сообщения', err);
        showNotification('Ошибка отправки сообщения');
    }
}

/**
 * Создает индикатор новых сообщений
 */
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

/**
 * Показывает индикатор новых сообщений
 */
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

/**
 * Скрывает индикатор новых сообщений
 */
function hideNewMessageIndicator() {
    if (newMessageIndicator) {
        newMessageIndicator.style.display = 'none';
    }
}

/**
 * Добавляет новое сообщение в чат
 */
export function pointNewMessage(messageData) {
    if (!messageData || !messageData.text) return;

    const message = {
        id: messageData.id || Date.now(),
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
    }
}

/**
 * Обновляет чат, загружая последние сообщения с сервера
 */
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
            const infoMessage = document.createElement('div');
            infoMessage.className = 'chat-info-message text-center text-muted small mb-3';
            infoMessage.style.fontSize = '0.8rem';
            infoMessage.style.opacity = '0.7';
            infoMessage.style.padding = '4px 8px';
            infoMessage.textContent = `Показаны последние ${Math.min(recent.length, MAX_MESSAGES)} сообщений`;
            chatMessages.appendChild(infoMessage);

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

/**
 * Переключает видимость панели чата
 */
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

/**
 * Закрывает панель чата
 */
function closeChatPanel() {
    if (chatPanel) {
        chatPanel.style.display = 'none';
        isChatOpen = false;
    }
}

/**
 * Прикрепляет обработчики событий к элементам чата
 */
function attachEventHandlers() {
    if (handlersAttached) return;

    if (chatButton) chatButton.addEventListener('click', togglePanel);
    if (closeChat) closeChat.addEventListener('click', closeChatPanel);
    if (chatSend) chatSend.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            } else if (e.key === 'Escape' && editingMessageId) {
                cancelEditMode();
            }
        });
    }

    handlersAttached = true;
}

/**
 * Инициализирует чат
 */
export async function initChat() {
    if (!chatPanel || !chatButton || !chatMessages) {
        console.error('Не найдены необходимые элементы чата');
        return;
    }
    attachEventHandlers();
    await refreshChat();
    needsScroll = true;
}