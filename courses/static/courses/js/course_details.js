import { getCsrfToken, escapeHtml, confirmAction } from '/static/js/tasks/utils.js';

let lessonsContainer = null;
let createUrl = null;
let reorderUrl = null;
let courseId = null;
let scrollBtn = null;
let reorderTrigger = null;
let isReorderMode = false;
let dragSrcElement = null;
let currentPreviewLessonId = null;
let previewModal = null;
let viewUpdateBtn = null;
let downloadUpdateBtn = null;
let lessonForm = null;
let addTrigger = null;

function initPreviewModal() {
    const modalElement = document.getElementById('lessonPreviewModal');
    if (modalElement && !previewModal) {
        previewModal = new bootstrap.Modal(modalElement);
    }
}

function openLessonPreview(lessonId) {
    initPreviewModal();
    if (!previewModal) {
        console.error('Модальное окно предпросмотра не найдено');
        return;
    }

    currentPreviewLessonId = lessonId;
    const frame = document.getElementById('lessonPreviewFrame');
    const loading = document.getElementById('lessonPreviewLoading');
    const errorDiv = document.getElementById('lessonPreviewError');
    const selectBtn = document.getElementById('selectClassroomBtn');

    loading.classList.remove('d-none');
    frame.style.display = 'none';
    errorDiv.classList.add('d-none');

    const previewUrl = `/courses/lesson/${lessonId}/preview/`;

    const selectHandler = () => {
        console.log('Выбрать урок:', lessonId);
        previewModal.hide();
    };

    selectBtn.removeEventListener('click', selectHandler);
    selectBtn.addEventListener('click', selectHandler);

    frame.src = '';
    setTimeout(() => {
        frame.src = previewUrl;
    }, 100);

    frame.onload = () => {
        loading.classList.add('d-none');
        frame.style.display = 'block';
    };

    frame.onerror = () => {
        loading.classList.add('d-none');
        errorDiv.classList.remove('d-none');
    };

    previewModal.show();
}

function setupUpdateButtons() {
    if (viewUpdateBtn) {
        viewUpdateBtn.addEventListener('click', () => {
            console.log('Кнопка "Посмотреть" нажата для курса:', courseId);
        });
    }

    if (downloadUpdateBtn) {
        downloadUpdateBtn.addEventListener('click', () => {
            console.log('Кнопка "Загрузить" нажата для курса:', courseId);
        });
    }
}

function setupLessonButtons() {
    lessonsContainer.addEventListener('click', (e) => {
        const selectBtn = e.target.closest('.select-lesson-btn');
        const previewBtn = e.target.closest('[title="Предпросмотр"]');

        if (selectBtn) {
            const lessonId = selectBtn.dataset.lessonId;
            console.log('Кнопка "Выбрать" нажата для урока:', lessonId);
            return;
        }

        if (previewBtn) {
            const lessonId = previewBtn.dataset.lessonId;
            openLessonPreview(lessonId);
            return;
        }
    });
}

function openLessonModal({ mode = 'create', id = '', title = '', description = '' } = {}) {
    const modalEl = document.getElementById('lessonModal');
    const titleEl = document.getElementById('lessonModalLabel');
    const titleInput = document.getElementById('lessonTitleInput');
    const descInput = document.getElementById('lessonDescriptionInput');
    const modeInput = document.getElementById('lessonModeInput');
    const idInput = document.getElementById('lessonIdInput');
    const submitBtn = document.getElementById('lessonModalSubmit');

    if (!modalEl) {
        console.error('Модальное окно редактирования урока не найдено');
        return;
    }

    modeInput.value = mode;
    idInput.value = id || '';
    titleInput.value = title || '';
    descInput.value = description || '';

    if (mode === 'create') {
        titleEl.textContent = 'Создать урок';
        submitBtn.textContent = 'Создать';
        descInput.classList.add('d-none');
    } else {
        titleEl.textContent = 'Редактировать урок';
        submitBtn.textContent = 'Сохранить';
        descInput.classList.remove('d-none');
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function addLessonToDOM(created) {
    const lessonDiv = document.createElement('div');
    lessonDiv.className = 'list-group-item d-flex flex-column flex-md-row justify-content-between align-items-start p-2 shadow-sm mb-1 rounded-2 drop-zone';
    lessonDiv.dataset.lessonId = String(created.id);
    lessonDiv.draggable = false;

    const descHtml = created.description ? `
        <div class="text-muted mt-1 small lesson-description">
            <span class="description-short">${escapeHtml(String(created.description).slice(0, 50))}...</span>
            <span class="description-full d-none">${escapeHtml(created.description)}</span>
            <button type="button" class="btn btn-link p-0 tiny toggle-desc">Подробнее</button>
        </div>` : '<div class="text-muted mt-1 small lesson-description"></div>';

    lessonDiv.innerHTML = `
        <div class="drop-indicator"></div>
        <div class="d-flex align-items-center flex-grow-1 me-2">
            <div class="drag-handle me-2 d-none">
                <i class="bi bi-grip-vertical text-muted"></i>
            </div>
            <div>
                <div class="fw-semibold text-truncate fs-6" style="max-width: 100%;">${escapeHtml(created.title)}</div>
                ${descHtml}
            </div>
        </div>

        <div class="mt-2 mt-md-0 d-flex align-items-center justify-content-start justify-content-md-end flex-md-column ms-auto ms-md-0">
            <div class="d-flex align-items-center gap-2">
                <div class="dropdown dropstart">
                    <button class="btn btn-sm btn-link text-muted p-0" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-three-dots"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <a class="dropdown-item"
                               href="#"
                               data-action="edit"
                               data-lesson-id="${created.id}"
                               data-title="${escapeHtml(created.title)}"
                               data-description="${escapeHtml(created.description || '')}">
                                Редактировать
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item text-danger"
                               href="#"
                               data-action="delete"
                               data-lesson-id="${created.id}">
                                Удалить
                            </a>
                        </li>
                    </ul>
                </div>
                <button class="btn btn-outline-success btn-sm preview-icon-btn"
                        data-lesson-id="${created.id}"
                        title="Предпросмотр">
                    Посмотреть
                </button>
                <button class="btn btn-primary btn-sm fw-bold select-lesson-btn"
                        data-lesson-id="${created.id}">
                    Выбрать
                </button>
            </div>
        </div>
    `;

    lessonsContainer.appendChild(lessonDiv);

    const toggleBtn = lessonDiv.querySelector('.toggle-desc');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', handleToggleDescription);
    }

    const previewBtn = lessonDiv.querySelector('.preview-icon-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            openLessonPreview(created.id);
        });
    }

    const selectBtn = lessonDiv.querySelector('.select-lesson-btn');
    if (selectBtn) {
        selectBtn.addEventListener('click', () => {
            console.log('Выбран урок:', created.id);
        });
    }

    checkScroll();
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
                    <button type="button" class="btn btn-link p-0 tiny toggle-desc">Подробнее</button>
                `;
                const toggleBtn = descContainer.querySelector('.toggle-desc');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', handleToggleDescription);
                }
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
    checkScroll();
}

function handleToggleDescription(e) {
    const btn = e.target.closest('.toggle-desc');
    if (!btn) return;

    const shortDesc = btn.previousElementSibling.previousElementSibling;
    const fullDesc = btn.previousElementSibling;

    if (fullDesc.classList.contains('d-none')) {
        fullDesc.classList.remove('d-none');
        shortDesc.classList.add('d-none');
        btn.textContent = 'Свернуть';
    } else {
        fullDesc.classList.add('d-none');
        shortDesc.classList.remove('d-none');
        btn.textContent = 'Подробнее';
    }
}

function toggleReorderMode() {
    isReorderMode = !isReorderMode;
    const handles = lessonsContainer.querySelectorAll('.drag-handle');
    const items = lessonsContainer.querySelectorAll('.list-group-item');

    if (isReorderMode) {
        reorderTrigger.classList.remove('text-muted');
        reorderTrigger.classList.add('text-primary');
        reorderTrigger.title = 'Завершить перестановку';

        handles.forEach(handle => handle.classList.remove('d-none'));
        items.forEach(item => {
            item.draggable = true;
            item.style.cursor = 'move';
        });
    } else {
        reorderTrigger.classList.remove('text-primary');
        reorderTrigger.classList.add('text-muted');
        reorderTrigger.title = 'Поменять порядок';

        handles.forEach(handle => handle.classList.add('d-none'));
        items.forEach(item => {
            item.draggable = false;
            item.style.cursor = '';
        });

        saveNewOrder();
    }
}

function saveNewOrder() {
    const lessonIds = Array.from(lessonsContainer.querySelectorAll('.list-group-item'))
        .map(item => item.dataset.lessonId)
        .filter(id => id);

    const csrf = getCsrfToken();
    fetch(reorderUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf
        },
        body: JSON.stringify({ order: lessonIds })
    }).then(response => {
        if (!response.ok) {
            throw new Error('Ошибка сохранения порядка уроков');
        }
    }).catch(error => {
        alert(error.message);
    });
}

function handleDragStart(e) {
    dragSrcElement = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dropZone = e.currentTarget;
    const rect = dropZone.getBoundingClientRect();
    const dropZoneHeight = rect.height;
    const mouseY = e.clientY - rect.top;

    dropZone.classList.remove('over-top', 'over-bottom');

    if (dropZone === dragSrcElement) {
        return false;
    }

    const threshold = dropZoneHeight * 0.3;
    const isTopHalf = mouseY < threshold;

    if (isTopHalf) {
        dropZone.classList.add('over-top');
    } else {
        dropZone.classList.add('over-bottom');
    }

    return false;
}

function handleDragEnter(e) {
    if (this !== dragSrcElement) {
        this.classList.add('over');
    }
}

function handleDragLeave(e) {
    if (!this.contains(e.relatedTarget)) {
        this.classList.remove('over', 'over-top', 'over-bottom');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (dragSrcElement === this) {
        this.classList.remove('over', 'over-top', 'over-bottom', 'dragging');
        return false;
    }

    const isTopHalf = this.classList.contains('over-top');

    if (isTopHalf) {
        this.parentNode.insertBefore(dragSrcElement, this);
    } else {
        this.parentNode.insertBefore(dragSrcElement, this.nextSibling);
    }

    this.classList.remove('over', 'over-top', 'over-bottom');
    dragSrcElement.classList.remove('dragging');

    return false;
}

function handleDragEnd(e) {
    const items = lessonsContainer.querySelectorAll('.list-group-item');
    items.forEach(item => {
        item.classList.remove('over', 'over-top', 'over-bottom', 'dragging');
    });
}

function initDragAndDrop() {
    const items = lessonsContainer.querySelectorAll('.list-group-item');
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

async function createLesson(formData) {
    const csrf = getCsrfToken();
    try {
        const resp = await fetch(createUrl, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrf },
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
    }
}

async function editLesson(lessonId, formData) {
    const csrf = getCsrfToken();
    try {
        const resp = await fetch(`/courses/lesson/${lessonId}/edit/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrf },
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
    }
}

async function deleteLesson(lessonId) {
    const ok = await confirmAction('Удалить урок без возможности восстановления?');
    if (!ok) return;
    const csrf = getCsrfToken();
    try {
        const resp = await fetch(`/courses/lesson/${lessonId}/delete/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrf }
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

function checkScroll() {
    if (!scrollBtn) return;
    const needsScroll = lessonsContainer.scrollHeight > lessonsContainer.clientHeight;
    if (needsScroll) scrollBtn.classList.remove('d-none'); else scrollBtn.classList.add('d-none');
}

function handleScroll() {
    lessonsContainer.scrollBy({ top: 150, behavior: 'smooth' });
}

function handleLessonsContainerClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    e.preventDefault();

    const action = actionEl.dataset.action;
    const lessonId = actionEl.dataset.lessonId;

    if (action === 'edit') {
        const title = actionEl.dataset.title || '';
        const description = actionEl.dataset.description || '';
        openLessonModal({ mode: 'edit', id: lessonId, title, description });
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

function initCourseDetails() {
    lessonsContainer = document.getElementById('lessons-container');
    if (!lessonsContainer) return;

    createUrl = lessonsContainer.dataset.createUrl;
    reorderUrl = lessonsContainer.dataset.reorderUrl;
    courseId = lessonsContainer.dataset.courseId;
    scrollBtn = document.getElementById('scroll-down-btn');
    reorderTrigger = document.getElementById('reorder-trigger');
    viewUpdateBtn = document.getElementById('view-update-btn');
    downloadUpdateBtn = document.getElementById('download-update-btn');
    lessonForm = document.getElementById('lessonModalForm');
    addTrigger = document.getElementById('add-lesson-trigger');

    setupUpdateButtons();
    setupLessonButtons();

    document.querySelectorAll('.toggle-desc').forEach(btn => {
        btn.addEventListener('click', handleToggleDescription);
    });

    if (lessonsContainer) {
        lessonsContainer.addEventListener('click', handleLessonsContainerClick);
    }

    if (lessonForm) {
        lessonForm.addEventListener('submit', handleLessonFormSubmit);
    }

    if (addTrigger) {
        addTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            openLessonModal({ mode: 'create' });
        });
    }

    if (reorderTrigger) {
        reorderTrigger.addEventListener('click', toggleReorderMode);
    }

    if (scrollBtn) {
        scrollBtn.addEventListener('click', handleScroll);
    }

    initDragAndDrop();

    window.addEventListener('resize', checkScroll);
    checkScroll();
}

document.addEventListener('DOMContentLoaded', initCourseDetails);