import { getCsrfToken, escapeHtml, confirmAction } from 'js/tasks/utils.js';
import { requireAuth, showAuthModal } from 'auth/telegram.js';

let lessonsContainer;
let lessonsScrollContainer;
let createUrl;
let reorderUrl;
let scrollBtn;
let reorderTrigger;
let addTrigger;
let lessonForm;
let previewModal;
let isReorderMode = false;
let dragSrcElement = null;
let dropbarOverlay = null;
let selectClassroomModal;
let selectedLessonId = null;
let isAttaching = false;
let telegramAuthModalInstance = null;

function initPreviewModal() {
    if (previewModal) return;
    const el = document.getElementById('lessonPreviewModal');
    if (el) previewModal = new bootstrap.Modal(el);
}

function initSelectClassroomModal() {
    if (selectClassroomModal) return;
    const el = document.getElementById('selectClassroomModal');
    if (!el) return;
    selectClassroomModal = new bootstrap.Modal(el);

    el.addEventListener('click', async (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href') || '';
        const match = href.match(/(\d+)(?:\/)?$/);
        if (!match) return;
        e.preventDefault();
        const classroomId = match[1];
        if (!selectedLessonId) {
            alert('Урок не выбран');
            return;
        }
        await attachLessonAndGo(classroomId, href);
    });

    el.addEventListener('hide.bs.modal', (ev) => {
        if (isAttaching) ev.preventDefault();
    });

    const createBtn = el.querySelector('#createClassroomBtn');
    if (createBtn) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedLessonId) {
                const errEl = document.getElementById('classroomError');
                if (errEl) {
                    errEl.textContent = 'Урок не выбран';
                    errEl.classList.remove('d-none');
                }
                return;
            }
            createClassroomAndRedirect();
        });
    }

    const input = document.getElementById('newClassroomTitle');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createClassroomAndRedirect();
            }
        });
    }
}

async function attachLessonAndGo(classroomId, href = null) {
    if (isAttaching) return;
    const modalEl = document.getElementById('selectClassroomModal');
    if (!modalEl) return;

    const modalContent = modalEl.querySelector('.modal-content') || modalEl;
    const spinnerOverlay = document.createElement('div');
    spinnerOverlay.className = 'position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center rounded-4';
    spinnerOverlay.style.background = 'rgba(255,255,255,0.85)';
    spinnerOverlay.style.zIndex = '1055';
    spinnerOverlay.innerHTML = `
        <div class="text-center">
            <div class="spinner-border" role="status" aria-hidden="true"></div>
            <div class="mt-2 small">Подождите, прикрепляем урок...</div>
        </div>
    `;

    const interactive = Array.from(modalEl.querySelectorAll('button, a, input, textarea, select'));
    try {
        isAttaching = true;
        modalContent.appendChild(spinnerOverlay);
        interactive.forEach(el => el.setAttribute('disabled', 'disabled'));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const url = `/classroom/api/${encodeURIComponent(classroomId)}/attach-lesson/${encodeURIComponent(selectedLessonId)}/`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({}),
            signal: controller.signal
        }).catch((err) => {
            if (err.name === 'AbortError') throw new Error('Превышено время ожидания (5 секунд)');
            throw err;
        }).finally(() => {
            clearTimeout(timeoutId);
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
            const msg = (data && (data.detail || data.error)) || 'Ошибка при прикреплении урока';
            throw new Error(msg);
        }

        if (data.status === 'update_required') {
            const courseId = data.course_id;
            alert('У вас есть копия курса, но доступна новая версия. Обновите курс перед прикреплением.');
            return;
        }

        if (data.status === 'ok') {
            try {
                selectClassroomModal.hide();
            } catch (e) {}
            if (href) {
                window.location.href = href;
            } else {
                window.location.href = `/classrooms/${encodeURIComponent(classroomId)}/`;
            }
            return;
        }

        throw new Error('Неизвестный ответ сервера');
    } catch (err) {
        alert(err.message);
    } finally {
        isAttaching = false;
        try { spinnerOverlay.remove(); } catch (e) {}
        interactive.forEach(el => el.removeAttribute('disabled'));
    }
}

function openLessonPreview(lessonId) {
    initPreviewModal();
    if (!previewModal) return;
    selectedLessonId = lessonId;

    const frame = document.getElementById('lessonPreviewFrame');
    const loading = document.getElementById('lessonPreviewLoading');
    const errorDiv = document.getElementById('lessonPreviewError');
    const selectBtnPreview = document.querySelector('.select-lesson-btn-preview');

    if (loading) loading.classList.remove('d-none');
    if (errorDiv) errorDiv.classList.add('d-none');

    if (selectBtnPreview) {
        selectBtnPreview.dataset.lessonId = lessonId;
    }

    if (frame) {
        frame.style.display = 'none';
        frame.src = '';
    }

    setTimeout(() => {
        if (frame) frame.src = `/courses/lesson/${lessonId}/preview/`;
    }, 100);

    if (frame) {
        frame.onload = () => {
            if (loading) loading.classList.add('d-none');
            frame.style.display = 'block';
        };
        frame.onerror = () => {
            if (loading) loading.classList.add('d-none');
            if (errorDiv) errorDiv.classList.remove('d-none');
        };
    }
    previewModal.show();
}

function openLessonModal({ mode = 'create', id = '', title = '', description = '' } = {}) {
    const modalEl = document.getElementById('lessonModal');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    document.getElementById('lessonModeInput').value = mode;
    document.getElementById('lessonIdInput').value = id;
    document.getElementById('lessonTitleInput').value = title;
    const lessonDescriptionInput = document.getElementById('lessonDescriptionInput');
    if (lessonDescriptionInput) {
        if (mode === 'create') {
            lessonDescriptionInput.style.display = 'none';
            lessonDescriptionInput.value = '';
        } else {
            lessonDescriptionInput.style.display = 'block';
            lessonDescriptionInput.value = description || '';
        }
    }
    const label = document.getElementById('lessonModalLabel');
    if (label) label.textContent = mode === 'create' ? 'Создать урок' : 'Редактировать урок';
    modal.show();
    setTimeout(() => {
        const titleInput = document.getElementById('lessonTitleInput');
        if (titleInput) titleInput.focus();
    }, 550);
}

document.addEventListener('click', async (e) => {
    const selectBtnPreview = e.target.closest('.select-lesson-btn-preview');
    if (selectBtnPreview) {
        e.preventDefault();
        const lessonId = selectBtnPreview.dataset.lessonId;

        const isAuthenticated = await requireAuth({
            entity: 'select_lesson',
            message: 'Чтобы выбрать урок, необходимо авторизоваться',
            hidePreviewModal: true,
            onHide: () => {
                initPreviewModal();
                if (previewModal) {
                    previewModal.show();
                }
            }
        });

        if (!isAuthenticated) {
            return;
        }

        if (previewModal) {
            previewModal.hide();
        }

        initSelectClassroomModal();
        if (!selectClassroomModal) return;

        selectedLessonId = lessonId;
        selectClassroomModal.show();
    }
});

function setFormSubmitting(state) {
    if (!lessonForm) return;
    const submitButtons = Array.from(lessonForm.querySelectorAll('[type="submit"]'));
    submitButtons.forEach(b => {
        b.disabled = state;
        if (state) b.classList.add('disabled'); else b.classList.remove('disabled');
        if (state) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    });
}

function addLessonToDOM(created) {
    const isPublic = lessonsContainer.dataset.isPublic === 'true';
    const lessonDiv = document.createElement('div');
    lessonDiv.className = 'list-group-item p-2 mb-1 rounded-2 shadow-sm d-flex flex-column flex-md-row align-items-start';
    lessonDiv.dataset.lessonId = String(created.id);
    const dropIndicator = isPublic ? '' : `<div class="me-2"></div>`;
    const dragHandle = isPublic ? '' : `<div class="me-2 d-none drag-handle"><i class="bi bi-grip-vertical text-muted"></i></div>`;
    const descHtml = created.description ? `
        <span class="description-short">${escapeHtml(String(created.description).slice(0, 50))}...</span>
        <span class="description-full d-none">${escapeHtml(created.description)}</span>
        <button type="button" class="btn btn-link p-0 small toggle-desc">Подробнее</button>
    ` : '';
    const dropdownHtml = isPublic ? '' : `
        <div class="dropdown">
            <button class="btn btn-sm btn-link text-muted p-0" data-bs-toggle="dropdown">
                <i class="bi bi-three-dots"></i>
            </button>
            <ul class="dropdown-menu">
                <li>
                    <a class="dropdown-item text-dark bg-white" href="#" data-action="edit" data-lesson-id="${created.id}"
                       data-title="${escapeHtml(created.title)}"
                       data-description="${escapeHtml(created.description || '')}">
                        Редактировать
                    </a>
                </li>
                <li>
                    <a class="dropdown-item text-danger bg-white" href="#" data-action="delete" data-lesson-id="${created.id}">
                        Удалить
                    </a>
                </li>
            </ul>
        </div>
    `;

    lessonDiv.innerHTML = `
        ${dropIndicator}
        <div class="flex-grow-1 me-2">
            <div class="d-flex align-items-center">
                ${dragHandle}
                <div class="fw-semibold text-truncate fs-6 w-100">${escapeHtml(created.title)}</div>
            </div>
            <div class="text-muted mt-1 small lesson-description">
                ${descHtml}
            </div>
        </div>

        <div class="d-flex align-items-center ms-auto gap-2">
            ${dropdownHtml}

            <button class="btn btn-outline-primary btn-sm select-lesson-btn"
                    data-lesson-id="${ created.id }">
                Выбрать
            </button>

            <button class="btn btn-success btn-sm preview-icon-btn"
                    data-lesson-id="${ created.id }">
                Посмотреть
            </button>
        </div>
    `;
    lessonsContainer.appendChild(lessonDiv);
    updateControlsVisibility();
    initDragAndDrop();
}

function updateLessonInDOM(id, updated) {
    const item = lessonsContainer.querySelector(`[data-lesson-id="${id}"]`);
    if (!item) return;
    const titleEl = item.querySelector('.fw-semibold');
    if (titleEl && updated.title) titleEl.textContent = updated.title;
    const descContainer = item.querySelector('.lesson-description');
    if (descContainer) {
        if (updated.description && updated.description.trim()) {
            const short = updated.description.slice(0, 50);
            if (updated.description.length > 50) {
                descContainer.innerHTML = `
                    <span class="description-short">${escapeHtml(short)}...</span>
                    <span class="description-full d-none">${escapeHtml(updated.description)}</span>
                    <button type="button" class="btn btn-link p-0 small toggle-desc">Подробнее</button>
                `;
            } else {
                descContainer.textContent = updated.description;
            }
        } else {
            descContainer.innerHTML = '';
        }
    }
    const editLink = item.querySelector('[data-action="edit"]');
    if (editLink) {
        if (updated.title) editLink.dataset.title = updated.title;
        if (updated.description !== undefined) editLink.dataset.description = updated.description || '';
    }
}

function removeLessonFromDOM(id) {
    const item = lessonsContainer.querySelector(`[data-lesson-id="${id}"]`);
    if (item) item.remove();
    updateControlsVisibility();
}

function handleToggleDescription(e) {
    const btn = e.target.closest('.toggle-desc');
    if (!btn) return;
    const container = btn.parentElement;
    const shortDesc = container.querySelector('.description-short');
    const fullDesc = container.querySelector('.description-full');
    if (fullDesc && fullDesc.classList.contains('d-none')) {
        fullDesc.classList.remove('d-none');
        if (shortDesc) shortDesc.classList.add('d-none');
        btn.textContent = 'Свернуть';
    } else {
        if (fullDesc) fullDesc.classList.add('d-none');
        if (shortDesc) shortDesc.classList.remove('d-none');
        btn.textContent = 'Подробнее';
    }
}

function toggleReorderMode() {
    isReorderMode = !isReorderMode;
    const handles = lessonsContainer.querySelectorAll('.drag-handle');
    const items = lessonsContainer.querySelectorAll('.list-group-item[data-lesson-id]');
    if (reorderTrigger) {
        reorderTrigger.classList.toggle('text-primary', isReorderMode);
        reorderTrigger.classList.toggle('text-muted', !isReorderMode);
    }
    handles.forEach(h => h.classList.toggle('d-none', !isReorderMode));
    items.forEach(item => {
        item.draggable = isReorderMode;
        item.style.cursor = isReorderMode ? 'move' : '';
    });
    if (isReorderMode) {
        showDropbar();
    } else {
        hideDropbar();
        saveNewOrder();
    }
}

function saveNewOrder() {
    const lessonIds = Array.from(lessonsContainer.querySelectorAll('.list-group-item[data-lesson-id]'))
        .map(i => i.dataset.lessonId);
    if (!reorderUrl) return;
    fetch(reorderUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({ order: lessonIds })
    });
}

function handleDragStart(e) {
    dragSrcElement = this;
    e.dataTransfer.effectAllowed = 'move';
    this.classList.add('dragging');
    showDropbar();
}

function handleDragOver(e) {
    e.preventDefault();
    if (this === dragSrcElement) return false;
    const rect = this.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const middle = rect.height / 2;
    if (offset < middle) {
        this.parentNode.insertBefore(dragSrcElement, this);
    } else {
        this.parentNode.insertBefore(dragSrcElement, this.nextSibling);
    }
    return false;
}

function handleDragEnd() {
    const items = lessonsContainer.querySelectorAll('.list-group-item');
    items.forEach(item => item.classList.remove('dragging'));
    dragSrcElement = null;
    if (!isReorderMode) hideDropbar();
    checkScroll();
}

function initDragAndDrop() {
    const items = Array.from(lessonsContainer.querySelectorAll('.list-group-item[data-lesson-id]'));
    items.forEach(item => {
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragover', handleDragOver);
        item.removeEventListener('dragend', handleDragEnd);
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragend', handleDragEnd);
    });
}

async function createLesson(formData) {
    setFormSubmitting(true);
    try {
        const resp = await fetch(createUrl, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() },
            body: formData
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.created) {
            const msg = (data && (data.error || data.detail)) || 'Ошибка при создании урока';
            throw new Error(msg);
        }
        addLessonToDOM(data.created);
        const modal = bootstrap.Modal.getInstance(document.getElementById('lessonModal'));
        if (modal) modal.hide();
    } catch (err) {
        alert(err.message);
    } finally {
        setFormSubmitting(false);
    }
}

async function editLesson(lessonId, formData) {
    setFormSubmitting(true);
    try {
        const resp = await fetch(`/courses/lesson/${lessonId}/edit/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() },
            body: formData
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.updated) {
            const msg = (data && (data.error || data.detail)) || 'Ошибка при сохранении изменений';
            throw new Error(msg);
        }
        updateLessonInDOM(lessonId, data.updated);
        const modal = bootstrap.Modal.getInstance(document.getElementById('lessonModal'));
        if (modal) modal.hide();
    } catch (err) {
        alert(err.message);
    } finally {
        setFormSubmitting(false);
    }
}

async function deleteLesson(lessonId) {
    const ok = await confirmAction('Удалить урок без возможности восстановления?');
    if (!ok) return;
    try {
        const resp = await fetch(`/courses/lesson/${lessonId}/delete/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() }
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data.error) {
            const msg = data.error || 'Ошибка при удалении';
            throw new Error(msg);
        }
        removeLessonFromDOM(lessonId);
    } catch (err) {
        alert(err.message);
    }
}

async function createClassroomAndRedirect() {
    const input = document.getElementById('newClassroomTitle');
    const errorEl = document.getElementById('classroomError');
    const btn = document.getElementById('createClassroomBtn');
    const modalEl = document.getElementById('selectClassroomModal');

    if (!input || !selectedLessonId || !btn || !modalEl) return;

    const title = input.value.trim();
    if (!title) {
        errorEl.textContent = 'Введите название класса';
        errorEl.classList.remove('d-none');
        return;
    }

    if (title.length > 40) {
        errorEl.textContent = 'Название класса не должно превышать 40 символов';
        errorEl.classList.remove('d-none');
        return;
    }

    const modalContent = modalEl.querySelector('.modal-content') || modalEl;
    const spinnerOverlay = document.createElement('div');
    spinnerOverlay.className = 'position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center rounded-3';
    spinnerOverlay.style.background = 'rgba(255,255,255,0.85)';
    spinnerOverlay.style.zIndex = '1055';
    spinnerOverlay.innerHTML = `
        <div class="text-center">
            <div class="spinner-border" role="status" aria-hidden="true"></div>
            <div class="mt-2 small">Создаём класс...</div>
        </div>
    `;

    const interactive = Array.from(modalEl.querySelectorAll('button, a, input, textarea, select'));

    btn.disabled = true;
    btn.classList.add('disabled');
    interactive.forEach(el => el.setAttribute('disabled', 'disabled'));
    modalContent.appendChild(spinnerOverlay);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const resp = await fetch('/classroom/api/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                title: title,
                lesson_id: selectedLessonId
            }),
            signal: controller.signal
        }).catch((err) => {
            if (err.name === 'AbortError') throw new Error('Превышено время ожидания (5 секунд)');
            throw err;
        }).finally(() => {
            clearTimeout(timeoutId);
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || data.error) {
            throw new Error(data.error || 'Ошибка создания класса');
        }

        if (data.redirect_url) {
            window.location.href = data.redirect_url;
        }

    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('d-none');
    } finally {
        clearTimeout(timeoutId);
        btn.disabled = false;
        btn.classList.remove('disabled');
        interactive.forEach(el => el.removeAttribute('disabled'));
        try { spinnerOverlay.remove(); } catch (e) {}
    }
}

function showDropbar() {
    if (!dropbarOverlay) dropbarOverlay = document.getElementById('dropbar-overlay');
    if (!dropbarOverlay) return;
    dropbarOverlay.classList.remove('d-none');
}

function hideDropbar() {
    if (!dropbarOverlay) dropbarOverlay = document.getElementById('dropbar-overlay');
    if (!dropbarOverlay) return;
    dropbarOverlay.classList.add('d-none');
}

function checkScroll() {
    if (!scrollBtn || !lessonsScrollContainer || !lessonsContainer) return;
    const visibleHeight = lessonsScrollContainer.clientHeight;
    const needsOverflow = lessonsContainer.scrollHeight > lessonsScrollContainer.clientHeight;
    const show = visibleHeight > 1000 && needsOverflow;
    if (show) scrollBtn.classList.remove('d-none'); else scrollBtn.classList.add('d-none');
}

function handleLessonsContainerClick(e) {
    const actionEl = e.target.closest('[data-action]');
    const previewBtn = e.target.closest('.preview-icon-btn');
    const toggleBtn = e.target.closest('.toggle-desc');
    const selectBtn = e.target.closest('.select-lesson-btn');

    if (toggleBtn) {
        handleToggleDescription(e);
        return;
    }

    if (previewBtn) {
        openLessonPreview(previewBtn.dataset.lessonId);
        return;
    }

    if (selectBtn) {
        e.preventDefault();

        requireAuth({
            entity: 'select_lesson',
            message: 'Чтобы выбрать урок, необходимо авторизоваться'
        }).then(isAuthenticated => {
            if (!isAuthenticated) return;

            if (previewModal) {
                previewModal.hide();
            }

            initSelectClassroomModal();
            if (!selectClassroomModal) return;

            selectedLessonId = selectBtn.dataset.lessonId;
            selectClassroomModal.show();
        });

        return;
    }

    if (!actionEl) return;
    e.preventDefault();
    const action = actionEl.dataset.action;
    const lessonId = actionEl.dataset.lessonId;

    if (action === 'edit') {
        openLessonModal({
            mode: 'edit',
            id: lessonId,
            title: actionEl.dataset.title || '',
            description: actionEl.dataset.description || ''
        });
        return;
    }

    if (action === 'delete') {
        deleteLesson(lessonId);
    }
}

function handleLessonFormSubmit(e) {
    e.preventDefault();
    const mode = document.getElementById('lessonModeInput').value;
    const lessonId = document.getElementById('lessonIdInput').value;
    const formData = new FormData(lessonForm);
    if (mode === 'create') {
        createLesson(formData);
    } else {
        if (!lessonId) return;
        editLesson(lessonId, formData);
    }
}

function updateControlsVisibility() {
    const items = Array.from(lessonsContainer.querySelectorAll('.list-group-item[data-lesson-id]'));
    const emptyText = document.getElementById('empty-lessons-text');
    if (items.length === 0) {
        if (!emptyText) {
            const p = document.createElement('p');
            p.id = 'empty-lessons-text';
            p.className = 'small ms-2 mt-2';
            p.textContent = 'Уроков пока нет.';
            lessonsContainer.appendChild(p);
        }
    } else {
        if (emptyText) emptyText.remove();
    }
    if (reorderTrigger) {
        if (items.length >= 2) {
            reorderTrigger.classList.remove('d-none');
        } else {
            reorderTrigger.classList.add('d-none');
            if (isReorderMode) toggleReorderMode();
        }
    }
    checkScroll();
}

function initCourseDetails() {
    lessonsContainer = document.getElementById('lessons-container');
    lessonsScrollContainer = document.getElementById('lessons-scroll-container');
    if (!lessonsContainer || !lessonsScrollContainer) return;
    createUrl = lessonsContainer.dataset.createUrl || null;
    reorderUrl = lessonsContainer.dataset.reorderUrl || null;
    scrollBtn = document.getElementById('scroll-down-btn');
    reorderTrigger = document.getElementById('reorder-trigger');
    addTrigger = document.getElementById('add-lesson-trigger');
    lessonForm = document.getElementById('lessonModalForm');
    dropbarOverlay = document.getElementById('dropbar-overlay');
    lessonsContainer.addEventListener('click', handleLessonsContainerClick);
    if (lessonForm) lessonForm.addEventListener('submit', handleLessonFormSubmit);
    if (addTrigger) {
        addTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            openLessonModal({ mode: 'create' });
        });
    }
    if (reorderTrigger) reorderTrigger.addEventListener('click', toggleReorderMode);
    if (scrollBtn) scrollBtn.addEventListener('click', () => {
        lessonsScrollContainer.scrollBy({ top: 150, behavior: 'smooth' });
    });
    updateControlsVisibility();
    initDragAndDrop();
    window.addEventListener('resize', checkScroll);
    document.addEventListener('dragend', () => {
        if (!isReorderMode) hideDropbar();
    });

    initSelectClassroomModal();
}

document.addEventListener('DOMContentLoaded', initCourseDetails);