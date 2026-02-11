function getCsrfToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];
    return cookieValue || '';
}

let telegramModal = null;
let currentNextPath = '/';

function setError(message) {
    const errorEl = document.getElementById('telegramLoginError');
    if (!errorEl) return;
    if (!message) {
        errorEl.textContent = '';
        errorEl.classList.add('d-none');
        return;
    }

    errorEl.textContent = message;
    errorEl.classList.remove('d-none');
}

function renderTelegramWidget(botName) {
    const container = document.getElementById('telegram-login-widget');
    if (!container || !botName) return;

    console.info('[TelegramLogin] Render widget for bot:', botName);

    container.innerHTML = '';

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'window.FastClassTelegramAuth.onAuth(user)');

    container.appendChild(script);
}

async function onTelegramAuth(userData) {
    console.info('[TelegramLogin] onAuth payload received:', userData);
    setError('');

    try {
        console.info('[TelegramLogin] Sending auth payload to backend...');
        const response = await fetch('/auth/telegram/widget-login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                ...userData,
                next: currentNextPath || window.location.pathname,
            }),
        });

        const data = await response.json().catch(() => ({}));
        console.info('[TelegramLogin] Backend response:', response.status, data);
        if (!response.ok || data.error) {
            throw new Error(data.error || 'Не удалось авторизоваться через Telegram.');
        }

        console.info('[TelegramLogin] Success. Redirecting to:', data.next || currentNextPath || '/');
        window.location.href = data.next || currentNextPath || '/';
    } catch (error) {
        console.error('[TelegramLogin] Auth failed:', error);
        setError(error.message);
    }
}

export function initTelegramLoginModal() {
    const modalEl = document.getElementById('telegramLoginModal');
    if (!modalEl) return;

    telegramModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const botName = modalEl.dataset.botName;

    window.FastClassTelegramAuth = {
        onAuth: onTelegramAuth,
    };

    modalEl.addEventListener('shown.bs.modal', () => {
        renderTelegramWidget(botName);
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
        setError('');
    });
}

export function openTelegramLoginModal(nextPath = null) {
    if (!telegramModal) {
        initTelegramLoginModal();
    }
    if (!telegramModal) return;

    currentNextPath = nextPath || window.location.pathname || '/';
    console.info('[TelegramLogin] Open modal. nextPath =', currentNextPath);
    telegramModal.show();
}
