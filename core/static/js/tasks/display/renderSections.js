import { getCsrfToken, showNotification, confirmAction } from '../utils.js';
import { loadSectionTasks } from './showTasks.js';

const infoEl = document.getElementById('info') || {};
const isTeacher = infoEl?.dataset?.isTeacher === 'true';
const isClassroom = infoEl?.dataset?.isClassroom === 'true';
const lessonId = infoEl?.dataset?.lessonId || null;

const sectionList = document.getElementById('section-list');
const saveSectionBtn = document.getElementById('saveManualSection');
const sectionModalEl = document.getElementById('manualSectionModal');
const sectionModal = sectionModalEl ? new bootstrap.Modal(sectionModalEl) : null;
const nameInput = document.getElementById('manualSectionName');

let currentSectionId = infoEl?.dataset?.sectionId || null;
let isSubmitting = false;

function renderSectionItem(section) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center border-0 px-2 my-1 rounded';
    li.dataset.sectionId = section.id;

    const teacherHandle = (isTeacher && !isClassroom)
        ? `<span class="drag-handle me-2">☰</span>`
        : '';

    li.innerHTML = `
        <div class="d-flex align-items-center gap-2" style="flex:1; min-width:0;">
            ${teacherHandle}
            <button type="button"
                    class="btn btn-link section-link text-decoration-none text-truncate p-0"
                    data-section-id="${section.id}">
                ${section.title}
            </button>
        </div>
        ${isTeacher && !isClassroom ? `
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-link p-0 edit-section-button">
                    <i class="bi bi-pencil-fill text-secondary"></i>
                </button>
                <button type="button" class="btn btn-link p-0 delete-btn">
                    <i class="bi bi-trash3-fill text-secondary"></i>
                </button>
            </div>
        ` : ''}
    `;

    sectionList?.appendChild(li);

    if (section.id === currentSectionId) {
        li.querySelector('.section-link')?.classList.add('fw-bold', 'text-primary');
    }
}

async function renderSectionsList(sections) {
    if (!sectionList) return;
    sectionList.innerHTML = '';
    sections.forEach(renderSectionItem);
}

async function fetchSections() {
    if (!lessonId) return [];
    const res = await fetch(`/courses/lesson/${lessonId}/sections/`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.sections) ? data.sections : [];
}

function highlightSelectedSection(sectionId) {
    currentSectionId = sectionId;

    sectionList?.querySelectorAll('.section-link').forEach(btn => {
        const active = btn.dataset.sectionId === sectionId;
        btn.classList.toggle('fw-bold', active);
        btn.classList.toggle('text-primary', active);
    });

    if (sectionId) infoEl.dataset.sectionId = sectionId;
    else delete infoEl.dataset.sectionId;
}

function selectSection(sectionId) {
    if (!sectionId || sectionId === currentSectionId) return;
    highlightSelectedSection(sectionId);
    loadSectionTasks?.(sectionId);
}

async function createSection(title) {
    const res = await fetch('/courses/section/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({ lesson_id: lessonId, title })
    });

    if (!res.ok) throw new Error();

    const data = await res.json();
    const sections = await fetchSections();
    await renderSectionsList(sections);
    selectSection(data.id);
}

async function editSection(sectionId, title) {
    const res = await fetch(`/courses/section/${sectionId}/edit/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({ title })
    });

    if (!res.ok) throw new Error();

    const sections = await fetchSections();
    await renderSectionsList(sections);
    highlightSelectedSection(sectionId);
}

async function deleteSection(sectionId) {
    const confirmed = await confirmAction('Вы уверены, что хотите удалить раздел?');
    if (!confirmed) return;

    await fetch(`/courses/section/${sectionId}/delete/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        }
    });

    const sections = await fetchSections();
    await renderSectionsList(sections);

    if (currentSectionId === sectionId && sections.length) {
        selectSection(sections[0].id);
    }
}

async function submitSectionForm() {
    if (isSubmitting) return;
    isSubmitting = true;

    try {
        const title = nameInput.value.trim();
        if (!title) {
            showNotification('Введите название раздела');
            return;
        }

        const action = saveSectionBtn.dataset.action;
        const sid = saveSectionBtn.dataset.sectionId;

        if (action === 'edit' && sid) {
            await editSection(sid, title);
        } else {
            await createSection(title);
        }

        sectionModal?.hide();
    } catch {
        showNotification('Ошибка сохранения');
    } finally {
        isSubmitting = false;
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
        nameInput.value = li.querySelector('.section-link')?.textContent.trim() || '';
        saveSectionBtn.dataset.action = 'edit';
        saveSectionBtn.dataset.sectionId = sectionId;
        sectionModal.show();

        sectionModalEl.addEventListener(
            'shown.bs.modal',
            () => nameInput.focus(),
            { once: true }
        );
        return;
    }

    selectSection(sectionId);
}

function initAddSectionButton() {
    if (!isTeacher || isClassroom) return;

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
        saveSectionBtn.dataset.action = 'create';
        saveSectionBtn.dataset.sectionId = '';
        nameInput.value = '';
        sectionModal.show();

        sectionModalEl.addEventListener(
            'shown.bs.modal',
            () => nameInput.focus(),
            { once: true }
        );
    });
}

function initSectionEditor() {
    if (!isTeacher || isClassroom) return;

    saveSectionBtn.type = 'button';
    saveSectionBtn.addEventListener('click', submitSectionForm);

    nameInput.addEventListener('keydown', (e) => {
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

    if (!lessonId) return;

    const sections = await fetchSections();
    await renderSectionsList(sections);

    if (!currentSectionId && sections.length) {
        selectSection(sections[0].id);
    } else {
        highlightSelectedSection(currentSectionId);
    }
}
