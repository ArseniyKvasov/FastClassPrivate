import { showNotification, getCsrfToken, escapeHtml } from '/static/js/tasks/utils.js';
import { getClassroomId } from '/static/classroom/utils.js';

const API_URL = '/courses/api/get/all/';
const LESSONS_LIMIT = 10;
const ATTACH_TIMEOUT = 5000;
const SEARCH_DEBOUNCE_MS = 250;

const modalEl = document.getElementById('lessonSelectModal');
const selectLessonButton = document.getElementById('selectLessonButton');
const loadingEl = modalEl.querySelector('.js-loading');
const contentEl = modalEl.querySelector('.js-content');
const accordionEl = modalEl.querySelector('#coursesAccordion');
const searchInputEl = modalEl.querySelector('#lessonSearchInput');
const lessonSelectModal = bootstrap.Modal.getOrCreateInstance(modalEl);

let allCourses = [];
let currentPreview = null;
let searchDebounced = null;

/**
 * Debounce helper — вызывает fn не чаще, чем раз в wait миллисекунд.
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn(...args);
        }, wait);
    };
}

selectLessonButton && selectLessonButton.addEventListener('click', () => lessonSelectModal.show());
modalEl.addEventListener('show.bs.modal', () => { hidePreview(); loadCourses(); });

if (searchInputEl) {
    searchDebounced = debounce((v) => applySearch(v), SEARCH_DEBOUNCE_MS);
    searchInputEl.addEventListener('input', (e) => searchDebounced(e.target.value));
}

accordionEl.addEventListener('click', onAccordionClick);

/**
 * Загружает список курсов и рендерит их в модалке.
 */
async function loadCourses() {
    loadingEl.classList.remove('d-none');
    contentEl.classList.add('d-none');
    accordionEl.innerHTML = '';
    try {
        allCourses = await fetchCourses();
        renderCourses(allCourses);
    } catch (err) {
        showNotification(err.message || 'Ошибка загрузки курсов');
        accordionEl.innerHTML = '<div class="text-center text-muted py-4">Не удалось загрузить курсы</div>';
    } finally {
        loadingEl.classList.add('d-none');
        contentEl.classList.remove('d-none');
        if (searchInputEl) searchInputEl.classList.remove('d-none');
    }
}

/**
 * Выполняет запрос за курсами.
 * @returns {Promise<Array>}
 */
async function fetchCourses() {
    const resp = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || !Array.isArray(data.courses)) throw new Error('Некорректный формат ответа сервера');
    return data.courses;
}

function applySearch(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) { renderCourses(allCourses); return; }

    const matchedCourses = [];
    allCourses.forEach(course => {
        const courseText = `${course.title} ${course.description || ''}`.toLowerCase();
        const lessons = (course.lessons || []).filter(lesson => {
            const lessonText = `${lesson.title} ${lesson.description || ''}`.toLowerCase();
            return lessonText.includes(q) || courseText.includes(q);
        });
        if (lessons.length) matchedCourses.push({ ...course, lessons });
    });

    if (!matchedCourses.length) {
        accordionEl.innerHTML = '<div class="text-center text-muted py-4">Нет уроков, подходящих под описание</div>';
        return;
    }

    renderCourses(matchedCourses);

    const totalMatchedLessons = matchedCourses.reduce((acc, c) => acc + (c.lessons || []).length, 0);
    if (totalMatchedLessons === 1) {
        const found = matchedCourses.find(c => (c.lessons || []).length === 1);
        if (found) {
            const collapseEl = document.getElementById(`course-${found.id}`);
            if (collapseEl) bootstrap.Collapse.getOrCreateInstance(collapseEl).show();
        }
    }
}

function renderCourses(courses) {
    accordionEl.innerHTML = '';
    if (!courses || !courses.length) {
        accordionEl.innerHTML = '<div class="text-center text-muted py-4">Курсы не найдены</div>';
        return;
    }
    const frag = document.createDocumentFragment();
    courses.forEach(course => {
        const item = document.createElement('div');
        item.className = 'accordion-item';
        item.innerHTML = `
            <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#course-${course.id}" aria-expanded="false" aria-controls="course-${course.id}">
                    ${escapeHtml(course.title)}
                </button>
            </h2>
            <div id="course-${course.id}" class="accordion-collapse collapse" data-bs-parent="#coursesAccordion">
                <div class="accordion-body p-0">
                    ${renderLessons(course.lessons || [], course.id)}
                </div>
            </div>
        `;
        frag.appendChild(item);
    });
    accordionEl.appendChild(frag);
}

function renderLessons(lessons, courseId) {
    if (!lessons || !lessons.length) return '<div class="small text-muted py-2 px-2">Нет уроков</div>';
    const visible = lessons.slice(0, LESSONS_LIMIT);
    const hiddenCount = Math.max(0, lessons.length - visible.length);
    return `
        <div class="d-flex flex-column gap-2 p-2">
            ${visible.map(renderLessonItem).join('')}
            ${hiddenCount > 0 ? `<div class="text-center"><button class="btn btn-sm btn-link js-show-more" data-course-id="${courseId}">Показать ещё (${hiddenCount})</button></div>` : ''}
        </div>
    `;
}

function renderLessonItem(lesson) {
    return `
        <div class="d-flex flex-column flex-md-row gap-2">
            <div class="fw-medium text-truncate w-100" style="min-width:0;">
                ${escapeHtml(lesson.title)}
            </div>
            <div class="d-flex gap-2 align-self-end align-self-md-center ms-md-auto">
                <button
                    id="attachLessonInModal"
                    class="btn btn-sm btn-outline-primary"
                    data-lesson-id="${lesson.id}"
                    type="button"
                >
                    Выбрать
                </button>
                <button
                    id="previewLessonInModal"
                    class="btn btn-sm btn-success"
                    data-lesson-id="${lesson.id}"
                    type="button"
                >
                    Посмотреть
                </button>
            </div>
        </div>
    `;
}

function expandCourseShowAll(courseId) {
    const course = allCourses.find(c => String(c.id) === String(courseId));
    if (!course) return;
    const collapseEl = document.getElementById(`course-${courseId}`);
    if (!collapseEl) return;
    const body = collapseEl.querySelector('.accordion-body');
    if (!body) return;
    body.innerHTML = renderLessons(course.lessons || [], courseId);
}

function onAccordionClick(ev) {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('js-show-more')) {
        expandCourseShowAll(btn.dataset.courseId);
        return;
    }
    const lessonId = btn.dataset.lessonId;
    if (!lessonId) return;
    if (btn.id === 'previewLessonInModal') {
        openPreview(parseInt(lessonId, 10));
        return;
    }
    if (btn.id === 'attachLessonInModal') {
        const classroomId = getClassroomId();
        if (!classroomId) { showNotification('Класс не указан'); return; }
        attachLesson(parseInt(lessonId, 10), classroomId);
    }
}

function openPreview(lessonId) {
    hidePreview();
    if (searchInputEl) searchInputEl.classList.add('d-none');

    const previewContainer = document.createElement('div');
    previewContainer.className = 'mb-3 px-2';
    previewContainer.innerHTML = `
        <div style="width:100%;">
            <iframe id="lessonPreviewFrame" src="/courses/lesson/${lessonId}/preview/" allowfullscreen class="rounded" style="width:100%;height:60vh;border:0;display:block;"></iframe>
        </div>
    `;

    const footer = document.createElement('div');
    footer.className = 'd-flex justify-content-between align-items-center border-top pt-2 px-2';
    footer.innerHTML = `
        <div><button type="button" class="btn btn-sm text-secondary text-decoration-none js-preview-back">Назад</button></div>
        <div><button type="button" class="btn btn-sm btn-primary js-preview-select" data-lesson-id="${lessonId}">Выбрать</button></div>
    `;

    contentEl.classList.add('d-none');
    const modalBody = modalEl.querySelector('.modal-body');
    modalBody.appendChild(previewContainer);
    modalBody.appendChild(footer);

    currentPreview = { lessonId, containerEl: previewContainer, footerEl: footer };

    footer.querySelector('.js-preview-back').addEventListener('click', hidePreview);
    footer.querySelector('.js-preview-select').addEventListener('click', () => {
        const classroomId = getClassroomId();
        if (!classroomId) { showNotification('Класс не указан'); hidePreview(); return; }
        attachLesson(parseInt(lessonId, 10), classroomId);
    });
}

function hidePreview() {
    if (!currentPreview) return;
    currentPreview.containerEl.remove();
    currentPreview.footerEl.remove();
    currentPreview = null;
    contentEl.classList.remove('d-none');
    if (searchInputEl) searchInputEl.classList.remove('d-none');
}

async function attachLesson(lessonId, classroomId) {
    disableModalWithLoader(true, 'Добавляем урок…');
    const url = `/classroom/api/${classroomId}/attach-lesson/${lessonId}/`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTACH_TIMEOUT);
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
            credentials: 'same-origin',
            body: JSON.stringify({}),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!resp.ok) { showNotification('Не удалось выбрать урок'); lessonSelectModal.hide(); return; }
        const data = await resp.json();
        if (data && data.status === 'ok') { lessonSelectModal.hide(); return; }
        showNotification('Не удалось выбрать урок'); lessonSelectModal.hide();
    } catch (err) {
        showNotification('Не удалось выбрать урок');
        lessonSelectModal.hide();
    } finally {
        clearTimeout(timer);
        disableModalWithLoader(false);
    }
}

function disableModalWithLoader(enable, text = '') {
    const modalContent = modalEl.querySelector('.modal-content');
    if (enable) {
        modalContent.classList.add('position-relative');
        const overlay = document.createElement('div');
        overlay.className = 'js-modal-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white bg-opacity-75';
        overlay.style.zIndex = 1057;
        overlay.innerHTML = `<div class="text-center"><div class="spinner-border" role="status" aria-hidden="true"></div><div class="mt-2">${escapeHtml(text)}</div></div>`;
        modalContent.appendChild(overlay);
    } else {
        const overlay = modalEl.querySelector('.js-modal-overlay');
        if (overlay) overlay.remove();
        modalContent.classList.remove('position-relative');
    }
}
