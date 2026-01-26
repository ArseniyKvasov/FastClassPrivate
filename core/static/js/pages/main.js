import { getCsrfToken, confirmAction, escapeHtml } from '/static/js/tasks/utils.js';

/**
 * Открывает универсальную модалку для создания / редактирования курса или класса.
 *
 * @param {Object} options
 * @param {'create'|'edit'} options.mode
 * @param {'course'|'classroom'} options.entity
 * @param {string|null} options.id
 * @param {string} options.title
 * @param {string} options.subject
 * @param {string} options.description
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
    const btnText = document.getElementById('universalModalButtonText');
    const errorEl = document.getElementById('universalModalError');

    modeInput.value = mode;
    entityInput.value = entity;
    idInput.value = id || '';

    nameInput.value = title;
    nameInput.placeholder = entity === 'course' ? 'Название курса' : 'Название класса';

    subjectSelect.value = subject;
    descInput.value = description || '';

    errorEl.classList.add('d-none');
    if (entity === 'classroom') {
        subjectWrapper.classList.add('d-none');
        descWrapper.classList.add('d-none');
    } else {
        subjectWrapper.classList.remove('d-none');
        descWrapper.classList.toggle('d-none', mode === 'create');
    }

    if (mode === 'create') {
        titleEl.textContent = entity === 'course' ? 'Новый курс' : 'Новый класс';
        btnText.textContent = 'Создать';
    } else {
        titleEl.textContent = entity === 'course' ? 'Редактировать курс' : 'Редактировать класс';
        btnText.textContent = 'Сохранить';
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/**
 * Преобразует шаблон URL с '0' в конец пути в конкретный URL с id.
 *
 * Простая замена первого вхождения '0', которое используется в Django url шаблонах.
 *
 * @param {string} template
 * @param {string|number} id
 * @returns {string}
 */
function fillUrlTemplate(template, id) {
    return template.replace(/0(?!\d)/, id);
}

/**
 * Находит .material-item элемент по сущности (course|classroom) и id.
 *
 * @param {'course'|'classroom'} entity
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function findMaterialItem(entity, id) {
    const selector = `[data-entity="${entity}"][data-id="${id}"]`;
    const actionEl = document.querySelector(selector);
    if (!actionEl) return null;
    return actionEl.closest('.material-item');
}

/**
 * Обновляет DOM карточки курса после редактирования
 *
 * @param {HTMLElement} itemEl - элемент карточки
 * @param {Object} updatedData - обновленные данные курса
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

document.addEventListener('DOMContentLoaded', () => {
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

    showCategory('classrooms');
    document.querySelector('[data-target="classrooms"]')?.classList.add('active');

    const modalForm = document.getElementById('universalModalForm');
    const nameInput = document.getElementById('universalModalName');
    const descInput = document.getElementById('universalModalDescription');
    const subjectSelect = document.getElementById('universalModalSubject');
    const modeInput = document.getElementById('universalModalMode');
    const entityInput = document.getElementById('universalModalEntity');
    const idInput = document.getElementById('universalModalCourseId');
    const errorEl = document.getElementById('universalModalError');
    const modalEl = document.getElementById('universalModal');

    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = nameInput.value.trim();
        if (!title) {
            errorEl.textContent = 'Введите название';
            errorEl.classList.remove('d-none');
            return;
        }

        const mode = modeInput.value;
        const entity = entityInput.value || 'course';
        const csrfToken = getCsrfToken();

        const form = new FormData();
        form.append('title', title);
        if (entity === 'course') {
            form.append('description', descInput.value.trim());
            form.append('subject', subjectSelect.value);
        }

        let url = '';
        if (mode === 'create') {
            if (entity === 'course') {
                url = '/courses/api/create/';
            } else {
                url = '/classroom/api/create/';
            }
        } else {
            const rawTemplate = entity === 'course'
                ? '/courses/edit-meta/0/'
                : '/classroom/api/0/edit/';
            url = fillUrlTemplate(rawTemplate, idInput.value);
        }

        let resp;
        try {
            resp = await fetch(url, {
                method: 'POST',
                body: form,
                headers: {
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
        } catch (err) {
            errorEl.textContent = 'Сетевая ошибка';
            errorEl.classList.remove('d-none');
            return;
        }

        let data;
        try {
            data = await resp.json();
        } catch (err) {
            errorEl.textContent = 'Невалидный ответ сервера';
            errorEl.classList.remove('d-none');
            return;
        }

        if (!resp.ok || data.error) {
            errorEl.textContent = data.error || 'Ошибка сохранения';
            errorEl.classList.remove('d-none');
            return;
        }

        if (mode === 'create') {
            if (data.url) {
                window.location.href = data.url;
                return;
            }

            const listCategory = entity === 'course' ? 'my_courses' : 'classrooms';
            const grid = Array.from(document.querySelectorAll('.material-item')).find(i => i.dataset.category === listCategory)?.parentElement;
            if (grid) {
                const newCard = document.createElement('div');
                newCard.className = 'col-12 col-sm-6 col-md-4 col-lg-3 material-item';
                newCard.dataset.category = listCategory;
                const itemId = String(data.id || Date.now());

                const subjectBadge = entity === 'course' && data.subject_display
                    ? `<span class="badge bg-primary small">${data.subject_display}</span>`
                    : '';

                const roleBadge = entity === 'classroom'
                    ? `<span class="badge bg-success small">Ученик</span>`
                    : '';

                newCard.innerHTML = `
                    <div class="card h-100 rounded-4 shadow-sm d-flex flex-column">
                        <div class="card-body d-flex flex-column flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="mb-0">${escapeHtml(data.title)}</h5>
                                ${subjectBadge || roleBadge}
                            </div>
                        </div>
                        <div class="card-footer bg-transparent border-0 pt-0">
                            <div class="d-flex justify-content-between align-items-center">
                                <a href="${data.detail_url || '#'}" class="btn btn-sm btn-outline-primary border-0 fw-bold">Перейти</a>
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-link text-muted p-0" data-bs-toggle="dropdown">
                                        <i class="bi bi-three-dots"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end">
                                        <li>
                                            <a class="dropdown-item" href="#"
                                               data-action="edit"
                                               data-entity="${entity}"
                                               data-id="${itemId}"
                                               data-title="${escapeAttr(data.title)}"
                                               ${entity === 'course' ? `data-description="${escapeAttr(data.description || '')}"` : ''}
                                               ${entity === 'course' ? `data-subject="${escapeAttr(data.subject || 'other')}"` : ''}>
                                                Редактировать
                                            </a>
                                        </li>
                                        <li>
                                            <a class="dropdown-item text-danger" href="#"
                                               data-action="delete"
                                               data-entity="${entity}"
                                               data-id="${itemId}">
                                                Удалить
                                            </a>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(newCard);
            }
            bootstrap.Modal.getInstance(modalEl).hide();
            return;
        }

        const entityType = entity;
        const entityId = idInput.value;

        const itemEl = findMaterialItem(entityType, entityId);

        if (itemEl) {
            if (entityType === 'course') {
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

        bootstrap.Modal.getInstance(modalEl).hide();
    });

    document.querySelectorAll('[data-create]').forEach(el => {
        el.addEventListener('click', (ev) => {
            ev.preventDefault();
            const what = el.dataset.create;
            if (what === 'course') {
                openEntityModal({ mode: 'create', entity: 'course' });
            } else if (what === 'classroom') {
                openEntityModal({ mode: 'create', entity: 'classroom' });
            }
        });
    });

    document.addEventListener('click', async (e) => {
        const target = e.target;
        const actionEl = target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        const entity = actionEl.dataset.entity;
        const id = actionEl.dataset.id;

        if (action === 'edit') {
            e.preventDefault();
            const title = actionEl.dataset.title || '';
            const description = actionEl.dataset.description || '';
            const subject = actionEl.dataset.subject || 'other';

            openEntityModal({
                mode: 'edit',
                entity: entity,
                id,
                title,
                subject,
                description
            });

            const descWrapper = document.getElementById('universalModalDescriptionWrapper');
            if (entity === 'course') {
                descWrapper.classList.remove('d-none');
            }

            return;
        }

        if (action === 'delete') {
            e.preventDefault();
            const ok = await confirmAction('Удалить без возможности восстановления?');
            if (!ok) return;

            const csrfToken = getCsrfToken();
            let url = '';
            if (entity === 'course') {
                url = `/courses/api/${id}/delete/`;
            } else {
                url = `/classroom/api/${id}/delete/`;
            }

            let resp;
            try {
                resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
            } catch (err) {
                alert('Сетевая ошибка при удалении');
                return;
            }

            let data;
            try {
                data = await resp.json();
            } catch (err) {
                alert('Невалидный ответ сервера');
                return;
            }

            if (!resp.ok || data.error) {
                alert(data.error || 'Ошибка удаления');
                return;
            }

            const item = findMaterialItem(entity, id);
            if (item) {
                item.remove();
            }
        }
    });
});

/**
 * Экранирует текст для использования в атрибутах.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
    return escapeHtml(str).replaceAll('\n', '&#10;').replaceAll('\r', '');
}