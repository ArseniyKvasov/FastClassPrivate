import { getCsrfToken, confirmAction, escapeHtml } from '/static/js/tasks/utils.js';

/**
 * Открывает модальное окно для создания/редактирования сущности
 */
export function openEntityModal({
    mode,
    entity = 'course',
    id = null,
    title = '',
    subject = 'other',
    description = ''
}) {
    const modalEl = document.getElementById('universalModal');
    const titleEl = document.getElementById('universalModalTitle');
    const nameInput = document.getElementById('universalModalName');
    const subjectWrapper = document.getElementById('universalModalSubjectWrapper');
    const subjectSelect = document.getElementById('universalModalSubject');
    const descWrapper = document.getElementById('universalModalDescriptionWrapper');
    const descInput = document.getElementById('universalModalDescription');
    const modeInput = document.getElementById('universalModalMode');
    const entityInput = document.getElementById('universalModalEntity');
    const idInput = document.getElementById('universalModalCourseId');
    const submitBtn = document.getElementById('universalModalButton');
    const errorEl = document.getElementById('universalModalError');

    submitBtn.disabled = false;
    modeInput.value = mode;
    entityInput.value = entity;
    idInput.value = id || '';
    nameInput.value = title;
    subjectSelect.value = subject;
    descInput.value = description || '';
    errorEl.classList.add('d-none');

    nameInput.placeholder = entity === 'course' ? 'Название курса' : 'Название класса';

    if (entity === 'classroom') {
        subjectWrapper.classList.add('d-none');
        descWrapper.classList.add('d-none');
    } else {
        subjectWrapper.classList.remove('d-none');
        descWrapper.classList.toggle('d-none', mode === 'create');
    }

    if (mode === 'create') {
        titleEl.textContent = entity === 'course' ? 'Новый курс' : 'Новый класс';
        submitBtn.innerText = 'Создать';
    } else {
        titleEl.textContent = entity === 'course' ? 'Редактировать курс' : 'Редактировать класс';
        submitBtn.innerText = 'Сохранить';
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
    setTimeout(() => nameInput.focus(), 550);
}

/**
 * Находит элемент карточки по entity и id
 */
function findMaterialItem(entity, id) {
    const selector = `[data-entity="${entity}"][data-id="${id}"]`;
    const actionEl = document.querySelector(selector);
    return actionEl ? actionEl.closest('.material-item') : null;
}

/**
 * Обновляет карточку курса после редактирования
 */
function updateCourseCard(itemEl, updatedData) {
    if (!itemEl) return;

    const titleEl = itemEl.querySelector('.card-body h5');
    if (titleEl && updatedData.title) {
        titleEl.textContent = updatedData.title;
    }

    const subjectBadge = itemEl.querySelector('.card-body .badge');
    const subjectDisplay = updatedData.subject_display || updatedData.subject;
    if (subjectBadge && subjectDisplay) {
        subjectBadge.textContent = subjectDisplay;
    }

    const editButton = itemEl.querySelector('[data-action="edit"]');
    if (editButton) {
        if (updatedData.title) editButton.dataset.title = updatedData.title;
        if (updatedData.subject) editButton.dataset.subject = updatedData.subject;
        if (updatedData.description !== undefined) editButton.dataset.description = updatedData.description;
    }
}

/**
 * Создает HTML для новой карточки курса
 */
function createCourseCardHtml(data, entity) {
    const subjectBadge = entity === 'course' && data.subject_display
        ? `<span class="badge bg-primary small">${escapeHtml(data.subject_display)}</span>`
        : '';

    const roleBadge = entity === 'classroom'
        ? `<span class="badge bg-success small">Ученик</span>`
        : '';

    const editUrl = entity === 'course'
        ? data.edit_meta_url || '#'
        : '#';

    return `
        <div class="col-12 col-md-6 col-lg-4 material-item" data-category="${entity === 'course' ? 'my_courses' : 'classrooms'}">
            <div class="card h-100 rounded-4 shadow-sm d-flex flex-column">
                <div class="card-body d-flex flex-column flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="mb-0">${escapeHtml(data.title)}</h5>
                        ${subjectBadge || roleBadge}
                    </div>
                    ${entity === 'course' && data.short_info ? `<p class="text-muted small mb-0">${escapeHtml(data.short_info)}</p>` : ''}
                </div>
                <div class="card-footer bg-transparent border-0 pt-0">
                    <div class="d-flex justify-content-between align-items-center">
                        <a href="${data.detail_url || '#'}" class="btn btn-sm btn-outline-white border-0 fw-bold text-primary">Перейти</a>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-link text-muted p-0" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item text-dark bg-white" href="#"
                                       data-action="edit"
                                       data-entity="${entity}"
                                       data-id="${data.id}"
                                       data-title="${escapeHtml(data.title)}"
                                       ${entity === 'course' ? `data-description="${escapeHtml(data.description || '')}"` : ''}
                                       ${entity === 'course' ? `data-subject="${escapeHtml(data.subject || 'other')}"` : ''}>
                                        Редактировать
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item text-danger bg-white" href="#"
                                       data-action="delete"
                                       data-entity="${entity}"
                                       data-id="${data.id}">
                                        Удалить
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Возвращает контейнер для вставки новой карточки
 */
function getInsertContainer(entity) {
    const category = entity === 'course' ? 'my_courses' : 'classrooms';
    const items = document.querySelectorAll(`.material-item[data-category="${category}"]`);
    if (items.length === 0) return null;

    const lastItem = items[items.length - 1];
    return lastItem.parentElement;
}

/**
 * Вставляет карточку в правильную позицию
 */
function insertCard(cardHtml, entity) {
    const container = getInsertContainer(entity);
    if (!container) return null;

    const category = entity === 'course' ? 'my_courses' : 'classrooms';
    const linkItem = container.querySelector(`.material-item[data-category="${category}"] a[data-create]`)?.closest('.material-item');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHtml;
    const newCard = tempDiv.firstElementChild;

    if (linkItem) {
        container.insertBefore(newCard, linkItem);
    } else {
        container.appendChild(newCard);
    }

    return newCard;
}

/**
 * Обработчик фильтрации по категориям
 */
function setupCategoryFilters() {
    const buttons = document.querySelectorAll('[data-target]');
    const items = document.querySelectorAll('.material-item');

    function showCategory(category) {
        items.forEach(item => {
            item.style.display = item.dataset.category === category ? 'block' : 'none';
        });
    }

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showCategory(btn.dataset.target);
        });
    });

    const container = document.getElementById('materials-container');
    const prioritySubject = container?.dataset.prioritySubject || '';

    let initialCategory = 'classrooms';

    if (prioritySubject === 'math') {
        initialCategory = 'math';
    } else if (prioritySubject === 'english') {
        initialCategory = 'english';
    } else if (prioritySubject === 'other') {
        initialCategory = 'other';
    }

    const categoryItems = document.querySelectorAll(`.material-item[data-category="${initialCategory}"]`);

    if (categoryItems.length === 0) {
        initialCategory = 'classrooms';
    }

    showCategory(initialCategory);

    const initialButton = document.querySelector(`[data-target="${initialCategory}"]`);
    if (initialButton) {
        buttons.forEach(b => b.classList.remove('active'));
        initialButton.classList.add('active');
    }
}

/**
 * Обработчик отправки формы модального окна
 */
function setupModalForm() {
    const modalForm = document.getElementById('universalModalForm');
    const nameInput = document.getElementById('universalModalName');
    const descInput = document.getElementById('universalModalDescription');
    const subjectSelect = document.getElementById('universalModalSubject');
    const modeInput = document.getElementById('universalModalMode');
    const entityInput = document.getElementById('universalModalEntity');
    const idInput = document.getElementById('universalModalCourseId');
    const errorEl = document.getElementById('universalModalError');
    const modalEl = document.getElementById('universalModal');
    const submitBtn = document.getElementById('universalModalButton');
    const lessonIdInput = document.getElementById('universalModalLessonId');

    let submitTimeout = null;

    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = nameInput.value.trim();
        if (!title) {
            errorEl.textContent = 'Введите название';
            errorEl.classList.remove('d-none');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Обработка...';

        submitTimeout = setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Повторить';
            errorEl.textContent = 'Таймаут запроса. Попробуйте еще раз.';
            errorEl.classList.remove('d-none');
        }, 5000);

        const mode = modeInput.value;
        const entity = entityInput.value || 'course';
        const csrfToken = getCsrfToken();

        let url = '';
        if (mode === 'create') {
            url = entity === 'course' ? '/courses/api/create/' : '/classroom/api/create/';
        } else {
            const template = entity === 'course' ? '/courses/edit-meta/0/' : '/classroom/api/0/edit/';
            url = template.replace('0', idInput.value);
        }

        try {
            const requestBody = {
                title: title
            };

            if (entity === 'classroom' && lessonIdInput && lessonIdInput.value) {
                requestBody.lesson_id = parseInt(lessonIdInput.value);
            }

            if (entity === 'course' && mode === 'create') {
                requestBody.description = descInput.value.trim();
                requestBody.subject = subjectSelect.value;
            }

            const resp = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: {
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json'
                }
            });

            clearTimeout(submitTimeout);
            submitBtn.disabled = false;
            submitBtn.innerHTML = mode === 'create' ? 'Создать' : 'Сохранить';

            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({}));
                errorEl.textContent = errorData.error || 'Ошибка сервера';
                errorEl.classList.remove('d-none');
                return;
            }

            const data = await resp.json();

            if (data.error) {
                errorEl.textContent = data.error;
                errorEl.classList.remove('d-none');
                return;
            }

            if (data.redirect_url) {
                window.location.href = data.redirect_url;
                return;
            }

            if (data.url) {
                window.location.href = data.url;
                return;
            }

            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            modalInstance.hide();

            if (mode === 'create') {
                const cardHtml = createCourseCardHtml({
                    ...data,
                    id: data.id,
                    title: data.title,
                    subject: data.subject,
                    subject_display: data.subject_display,
                    description: data.description,
                    detail_url: entity === 'course'
                        ? `/courses/${data.id}/`
                        : `/classroom/${data.id}/`
                }, entity);

                insertCard(cardHtml, entity);
            } else {
                const itemEl = findMaterialItem(entity, idInput.value);
                if (itemEl) {
                    if (entity === 'course') {
                        updateCourseCard(itemEl, data.updated || data);
                    } else {
                        const titleEl = itemEl.querySelector('.card-body h5');
                        if (titleEl && data.updated?.title) {
                            titleEl.textContent = data.updated.title;
                        }
                        const editButton = itemEl.querySelector('[data-action="edit"]');
                        if (editButton && data.updated?.title) {
                            editButton.dataset.title = data.updated.title;
                        }
                    }
                }
            }

        } catch (err) {
            clearTimeout(submitTimeout);
            submitBtn.disabled = false;
            submitBtn.innerHTML = mode === 'create' ? 'Создать' : 'Сохранить';
            errorEl.textContent = 'Сетевая ошибка';
            errorEl.classList.remove('d-none');
        }
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
        clearTimeout(submitTimeout);
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.originalText || 'Сохранить';
        errorEl.classList.add('d-none');
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            modalForm.dispatchEvent(new Event('submit'));
        }
    });
}

/**
 * Обработчик кликов по действиям (редактирование, удаление)
 */
function setupActionHandlers() {
    document.querySelectorAll('[data-create]').forEach(el => {
        el.addEventListener('click', (ev) => {
            ev.preventDefault();
            const what = el.dataset.create;
            if (what === 'course' || what === 'classroom') {
                openEntityModal({ mode: 'create', entity: what });
            }
        });
    });

    document.addEventListener('click', async (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        const entity = actionEl.dataset.entity;
        const id = actionEl.dataset.id;

        if (action === 'edit') {
            e.preventDefault();
            openEntityModal({
                mode: 'edit',
                entity: entity,
                id,
                title: actionEl.dataset.title || '',
                description: actionEl.dataset.description || '',
                subject: actionEl.dataset.subject || 'other'
            });

            if (entity === 'course') {
                document.getElementById('universalModalDescriptionWrapper').classList.remove('d-none');
            }
            return;
        }

        if (action === 'delete') {
            e.preventDefault();
            const ok = await confirmAction('Удалить без возможности восстановления?');
            if (!ok) return;

            const csrfToken = getCsrfToken();
            const url = entity === 'course'
                ? `/courses/api/${id}/delete/`
                : `/classroom/api/${id}/delete/`;

            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                const data = await resp.json();

                if (!resp.ok || data.error) {
                    alert(data.error || 'Ошибка удаления');
                    return;
                }

                const item = findMaterialItem(entity, id);
                if (item) item.remove();

            } catch (err) {
                alert('Сетевая ошибка при удалении');
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupCategoryFilters();
    setupModalForm();
    setupActionHandlers();
});