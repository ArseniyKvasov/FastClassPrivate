import { getCsrfToken, showNotification, confirmAction, getInfoElement, getIsTeacher, getIsClassroom, getLessonId, getSectionId } from '/static/js/tasks/utils.js';
import { loadSectionTasks } from '/static/js/tasks/display/showTasks.js';
import { eventBus } from '/static/js/tasks/events/eventBus.js';

const infoEl = getInfoElement();
const isTeacher = getIsTeacher();
const isClassroom = getIsClassroom();

const sectionList = document.getElementById('section-list');
const saveSectionBtn = document.getElementById('saveManualSection');
const saveSectionBtnText = document.getElementById('saveManualSectionText');
const sectionModalEl = document.getElementById('manualSectionModal');
const sectionModal = sectionModalEl ? new bootstrap.Modal(sectionModalEl) : null;
const nameInput = document.getElementById('manualSectionName');
const modalTitleEl = sectionModalEl ? sectionModalEl.querySelector('.modal-title') : null;

let isSubmitting = false;

function renderSectionItem(section) {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center border-0 px-2 my-1";
    li.dataset.sectionId = section.id;
    li.draggable = isTeacher;

    const teacherHandle = isTeacher
        ? `<span class="drag-handle me-1" role="button">☰</span>`
        : "";

    li.innerHTML = `
        <div class="d-flex align-items-center gap-2" style="flex:1; min-width:0; overflow:hidden;">
            ${teacherHandle}
            <button type="button"
                    class="btn btn-link section-link text-decoration-none text-truncate p-0"
                    style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                    data-section-id="${section.id}">
                ${section.title}
            </button>
        </div>
        ${isTeacher ? `
            <div class="d-flex gap-2 flex-shrink-0">
                <button type="button" class="btn btn-link p-0 edit-section-button">
                    <i class="bi bi-pencil-fill text-secondary"></i>
                </button>
                <button type="button" class="btn btn-link p-0 delete-btn">
                    <i class="bi bi-trash3-fill text-secondary"></i>
                </button>
            </div>
        ` : ""}
    `;

    sectionList?.appendChild(li);

    if (section.id === getSectionId()) {
        li.querySelector(".section-link")?.classList.add("fw-bold", "text-primary");
    }

    if (isTeacher) {
        initDragHandlers(li);
    }
}

export async function renderSectionsList(sections) {
    if (!sectionList) return;
    sectionList.innerHTML = '';
    sections.forEach(renderSectionItem);
}

export async function fetchSections() {
    const lessonId = getLessonId();
    if (!lessonId || lessonId === "None") return [];

    try {
        const res = await fetch(`/courses/lesson/${lessonId}/sections/`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.sections) ? data.sections : [];
    } catch (err) {
        return [];
    }
}

function highlightSelectedSection(sectionId) {
    sectionList?.querySelectorAll('.section-link').forEach(btn => {
        const active = btn.dataset.sectionId == sectionId;
        btn.classList.toggle('fw-bold', active);
        btn.classList.toggle('text-primary', active);
    });

    if (sectionId) infoEl.dataset.sectionId = sectionId;
}

export async function selectSection(sectionId) {
    if (!sectionId) return;

    const sectionList = document.querySelectorAll('#section-list li[data-section-id]');
    const sectionExists = Array.from(sectionList).some(
        li => li.dataset.sectionId === String(sectionId)
    );
    if (!sectionExists) return;

    highlightSelectedSection(sectionId);

    if (sectionId === getSectionId()) return;

    await loadSectionTasks(sectionId);
}

/**
 * Создаёт раздел на сервере и обновляет список.
 */
async function createSection(title) {
    const lessonId = getLessonId();

    const res = await fetch('/courses/section/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({ lesson_id: lessonId, title })
    });

    if (!res.ok) throw new Error('create failed');

    const data = await res.json();
    const sections = await fetchSections();
    await renderSectionsList(sections);
    selectSection(data.id);

    eventBus.emit('section_list:change');
}

/**
 * Редактирует раздел на сервере и обновляет список.
 *
 * Поведение: после редактирования выделение останется на том разделе,
 * который был выделен до редактирования (если он всё ещё существует).
 * В противном случае — выделяется отредактированный раздел.
 */
async function editSection(sectionId, title) {
    const prevSelected = getSectionId();

    const res = await fetch(`/courses/section/${sectionId}/edit/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({ title })
    });

    if (!res.ok) throw new Error('edit failed');

    const sections = await fetchSections();
    await renderSectionsList(sections);

    if (prevSelected && sections.some(s => String(s.id) === String(prevSelected))) {
        highlightSelectedSection(prevSelected);
    } else {
        highlightSelectedSection(sectionId);
    }

    eventBus.emit('section_list:change');
}

/**
 * Удаляет раздел.
 *
 * Нельзя удалить единственный раздел — пользователю показывается уведомление.
 * Если удаляется текущий выделенный раздел — загружается первый из оставшихся.
 */
async function deleteSection(sectionId) {
    const sectionsBefore = await fetchSections();
    if (sectionsBefore.length <= 1) {
        showNotification('Нельзя удалить единственный раздел');
        return;
    }

    const confirmed = await confirmAction('Вы уверены, что хотите удалить раздел?');
    if (!confirmed) return;

    try {
        const res = await fetch(`/courses/section/${sectionId}/delete/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            }
        });

        if (!res.ok) throw new Error('delete failed');

        const sections = await fetchSections();
        await renderSectionsList(sections);
        const currentSectionId = getSectionId();

        if (String(currentSectionId) === String(sectionId) && sections.length) {
            selectSection(sections[0].id);
        } else {
            highlightSelectedSection(currentSectionId);
        }
    } catch (err) {
        showNotification('Ошибка при удалении раздела');
    }

    eventBus.emit('section_list:change');
}

let draggedItem = null;
let hasMoved = false;

/**
 * Инициализирует drag-and-drop для элемента списка разделов
 * @param {HTMLLIElement} li
 */
function initDragHandlers(li) {
    const handle = li.querySelector(".drag-handle");
    if (!handle) return;

    handle.addEventListener("mousedown", () => {
        li.draggable = true;
    });

    handle.addEventListener("mouseup", () => {
        li.draggable = false;
    });

    li.addEventListener("dragstart", (e) => {
        draggedItem = li;
        hasMoved = false;
        li.classList.add("opacity-50");
        e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === li) return;

        const rect = li.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2;

        const referenceNode = isAfter ? li.nextSibling : li;
        if (referenceNode === draggedItem) return;

        sectionList.insertBefore(draggedItem, referenceNode);
        hasMoved = true;
    });

    li.addEventListener("dragend", async () => {
        li.classList.remove("opacity-50");
        li.draggable = false;

        if (!hasMoved) {
            draggedItem = null;
            return;
        }

        draggedItem = null;

        try {
            await sendSectionsOrder();
            eventBus.emit("section_list:change");
        } catch (e) {
            console.error("Failed to save sections order", e);
        }
    });
}

async function submitSectionForm() {
    if (isSubmitting) return;
    isSubmitting = true;

    const originalText = saveSectionBtnText?.textContent;

    try {
        const title = (nameInput?.value || '').trim();
        if (!title) {
            showNotification('Введите название раздела');
            return;
        }

        saveSectionBtn.disabled = true;
        if (saveSectionBtnText) {
            saveSectionBtnText.textContent = 'Сохранение...';
        }

        const action = saveSectionBtn?.dataset?.action;
        const sid = saveSectionBtn?.dataset?.sectionId;

        if (action === 'edit' && sid) {
            await editSection(sid, title);
        } else {
            await createSection(title);
        }

        sectionModal?.hide();
    } catch (err) {
        showNotification('Ошибка сохранения');
    } finally {
        isSubmitting = false;
        saveSectionBtn.disabled = false;
        if (saveSectionBtnText) {
            saveSectionBtnText.textContent = originalText;
        }
    }
}

/**
 * Собирает текущий порядок разделов и отправляет на сервер.
 */
async function sendSectionsOrder() {
    const order = Array.from(sectionList.children).map(
        li => li.dataset.sectionId
    );

    const lessonId = getLessonId();
    if (!lessonId) return;

    try {
        await fetch(`/courses/lesson/${lessonId}/sections/reorder/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCsrfToken()
            },
            body: JSON.stringify({ order })
        });
    } catch (e) {
        console.error("Failed to reorder sections", e);
        showNotification("Не удалось сохранить порядок разделов");
    }
}


function handleSectionListClick(e) {
    const li = e.target.closest('li[data-section-id]');
    if (!li) return;

    const sectionId = li.dataset.sectionId;

    if (e.target.closest('.delete-btn')) {
        deleteSection(sectionId);
        return;
    }

    if (e.target.closest('.edit-section-button')) {
        const title = li.querySelector('.section-link')?.textContent.trim() || '';
        nameInput.value = title;

        if (modalTitleEl) modalTitleEl.textContent = 'Изменение раздела';
        if (saveSectionBtn) {
            saveSectionBtn.dataset.action = 'edit';
            saveSectionBtn.dataset.sectionId = sectionId;
        }

        if (sectionModal) {
            sectionModalEl.addEventListener('shown.bs.modal', () => nameInput.focus(), { once: true });
            sectionModal.show();
        }
        return;
    }

    selectSection(sectionId);
}

function initAddSectionButton() {
    if (!isTeacher) return;

    let wrapper = document.getElementById('section-create-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'section-create-wrapper';
        wrapper.className = 'd-flex justify-content-center mt-2';
        sectionList?.parentElement?.appendChild(wrapper);
    }

    let addBtn = document.getElementById('add-section-btn');
    if (!addBtn) {
        addBtn = document.createElement('button');
        addBtn.id = 'add-section-btn';
        addBtn.type = 'button';
        addBtn.className = 'btn btn-sm text-primary fw-bold border-0';
        addBtn.innerHTML = `<i class="bi bi-plus-circle me-1"></i>Добавить раздел`;
        wrapper.appendChild(addBtn);
    }

    addBtn.addEventListener('click', () => {
        if (modalTitleEl) modalTitleEl.textContent = 'Новый раздел';
        if (saveSectionBtn) {
            saveSectionBtn.dataset.action = 'create';
            saveSectionBtn.dataset.sectionId = '';
        }
        if (nameInput) nameInput.value = '';

        if (sectionModal) {
            sectionModalEl.addEventListener('shown.bs.modal', () => nameInput.focus(), { once: true });
            sectionModal.show();
        }
    });
}

function initSectionEditor() {
    if (!isTeacher) return;
    if (!saveSectionBtn) return;

    saveSectionBtn.type = 'button';
    saveSectionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitSectionForm();
    });

    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitSectionForm();
        }
    });
}

export async function initRenderSections() {
    sectionList?.addEventListener('click', handleSectionListClick);
    initSectionEditor();
    initAddSectionButton();
    const currentSectionId = getSectionId();

    const sections = await fetchSections();
    await renderSectionsList(sections);

    if (!currentSectionId && sections.length) {
        selectSection(sections[0].id);
    } else {
        highlightSelectedSection(currentSectionId);
    }
}
