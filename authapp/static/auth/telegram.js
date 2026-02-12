class TelegramAuth {
    constructor(options = {}) {
        this.loginUrl = options.loginUrl || '/auth/login/';
        this.modalId = 'telegramAuthModal';
        this.modal = null;
    }

    async requireAuth(options = {}) {
        const isAuth = await this.checkAuth();
        if (!isAuth) this.showAuthModal(options);
        return isAuth;
    }

    async checkAuth() {
        try {
            const res = await fetch('/auth/api/check/', {
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                credentials: 'same-origin'
            });
            if (res.status === 401) return false;
            const data = await res.json();
            return data.authenticated === true;
        } catch {
            return false;
        }
    }

    showAuthModal(options = {}) {
        const entity = options.entity || '';
        const message = options.message || this._getMessage(entity);
        const redirect = options.redirectUrl || window.location.pathname + window.location.search;

        let el = document.getElementById(this.modalId);
        if (!el) {
            el = this._createModal();
            document.body.appendChild(el);
        }

        this._updateContent(el, message, redirect);
        this._showModal(el);
    }

    _createModal() {
        const el = document.createElement('div');
        el.id = this.modalId;
        el.className = 'modal fade';
        el.setAttribute('tabindex', '-1');
        el.setAttribute('data-bs-backdrop', 'static');
        el.innerHTML = `
            <div class="modal-dialog modal-dialog-centered modal-sm">
                <div class="modal-content border-0" style="border-radius: 20px;">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title fs-6 fw-semibold">
                            <i class="bi bi-shield-lock text-primary me-1"></i>
                            Требуется вход
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center pt-2 pb-3 px-4">
                        <div class="my-3">
                            <i class="bi bi-mortarboard" style="font-size: 44px; line-height: 1; color: #2AABEE;"></i>
                        </div>
                        <p class="small text-secondary mb-3" id="telegramAuthMessage">
                            Авторизуйтесь для продолжения
                        </p>
                        <a href="#" id="telegramAuthButton"
                           class="btn btn-primary w-100 rounded-pill py-2 d-inline-flex align-items-center justify-content-center gap-2"
                           style="background: #2AABEE; border: none;">
                            <i class="bi bi-telegram"></i>
                            <span>Войти с Telegram</span>
                            <i class="bi bi-box-arrow-up-right" style="font-size: 0.8rem;"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
        return el;
    }

    _updateContent(el, message, redirect) {
        const msgEl = el.querySelector('#telegramAuthMessage');
        if (msgEl) msgEl.textContent = message;

        const btn = el.querySelector('#telegramAuthButton');
        if (btn) btn.href = `${this.loginUrl}?next=${encodeURIComponent(redirect)}`;
    }

    _showModal(el) {
        if (!window.bootstrap?.Modal) {
            const btn = el.querySelector('#telegramAuthButton');
            if (btn) window.location.href = btn.href;
            return;
        }
        try {
            if (this.modal) this.modal.dispose();
            this.modal = new bootstrap.Modal(el, { backdrop: 'static', keyboard: false });
            this.modal.show();
        } catch {
            const btn = el.querySelector('#telegramAuthButton');
            if (btn) window.location.href = btn.href;
        }
    }

    _getMessage(entity) {
        const map = {
            course: 'Войдите, чтобы создать курс',
            classroom: 'Войдите, чтобы создать класс',
            lesson: 'Войдите, чтобы создать урок',
            select_lesson: 'Войдите, чтобы выбрать урок'
        };
        return map[entity] || 'Войдите для доступа к функциям';
    }
}

const auth = new TelegramAuth();
export const requireAuth = (o) => auth.requireAuth(o);
export const showAuthModal = (o) => auth.showAuthModal(o);
export const checkAuth = () => auth.checkAuth();
export default auth;