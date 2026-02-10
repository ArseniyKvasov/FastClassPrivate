import { showNotification } from "js/tasks/utils.js";
import { sendNewOrderToServer } from "js/tasks/editor/api.js";

let isOrderEditing = false;
const originalTaskStyles = new Map();
let finishOrderButton = null;
let draggedCard = null;
let dropPlaceholder = null;
let dragImageNode = null;

/**
 *  Инициализирует режим редактирования порядка заданий.
 *
 *  - drag доступен только с видимой кнопочной ручки (справа сверху);
 *  - скрывает ненужные элементы панели;
 *  - ограничивает высоту карточки до 250px;
 *  - добавляет плавные переходы, оверлей для блокировки кликов и видимые ручки;
 *  - рендерит минималистичную кнопку "Готово".
 */
export function startTasksOrderEditing() {
    if (isOrderEditing) return;

    const taskCards = Array.from(document.querySelectorAll('.task-card'));
    if (taskCards.length < 2) {
        showNotification('Для смены порядка нужно минимум два задания');
        return;
    }

    isOrderEditing = true;

    document.getElementById('add-task-btn')?.classList.add('d-none');
    document.getElementById('sidebar')?.classList.add('d-none');
    document.getElementById('studentDropdown')?.classList.add('d-none');
    document.getElementById('menuDropdown')?.classList.add('d-none');

    taskCards.forEach(card => {
        originalTaskStyles.set(card, {
            opacity: card.style.opacity || '',
            maxHeight: card.style.maxHeight || '',
            overflow: card.style.overflow || '',
            position: card.style.position || '',
            transition: card.style.transition || ''
        });

        card.style.opacity = '0.97';
        card.style.maxHeight = '250px'; // ограничение высоты при редактировании
        card.style.overflow = 'hidden';
        if (!card.style.position) card.style.position = 'relative';

        card.style.transition = 'transform 160ms ease, box-shadow 160ms ease, opacity 120ms ease';

        card.querySelectorAll('.task-card-controls').forEach(c => c.classList.add('d-none'));

        addDragHandle(card);
        addClickBlocker(card);
        attachDragEvents(card);
    });

    renderFinishOrderButton();
}

/**
 *  Завершает режим редактирования порядка заданий:
 *  - откатывает изменения стилей и DOM-элементов;
 *  - удаляет временные слушатели;
 *  - собирает новый порядок (массив id) и отправляет на сервер;
 *  - аккуратно очищает placeholder и drag image.
 */
export async function finishTasksOrderEditing() {
    if (!isOrderEditing) return;

    isOrderEditing = false;

    const taskCards = Array.from(document.querySelectorAll('.task-card'));

    taskCards.forEach(card => {
        const orig = originalTaskStyles.get(card) || {};
        card.style.opacity = orig.opacity;
        card.style.maxHeight = orig.maxHeight;
        card.style.overflow = orig.overflow;
        card.style.position = orig.position;
        card.style.transition = orig.transition || '';

        card.classList.remove('dragging', 'drop-target');

        const handle = card.querySelector('.task-drag-handle');
        if (handle) {
            handle.removeEventListener('dragstart', onHandleDragStart);
            handle.removeEventListener('dragend', onHandleDragEnd);
            handle.remove();
        }

        const blocker = card.querySelector('.task-click-blocker');
        if (blocker) blocker.remove();

        card.querySelectorAll('.task-card-controls').forEach(c => c.classList.remove('d-none'));

        card.removeEventListener('dragover', onDragOver);
        card.removeEventListener('dragleave', onDragLeave);
        card.removeEventListener('drop', onDrop);
    });

    originalTaskStyles.clear();

    document.getElementById('add-task-btn')?.classList.remove('d-none');
    document.getElementById('sidebar')?.classList.remove('d-none');
    document.getElementById('studentDropdown')?.classList.remove('d-none');
    document.getElementById('menuDropdown')?.classList.remove('d-none');

    if (dropPlaceholder && dropPlaceholder.parentNode) dropPlaceholder.remove();
    dropPlaceholder = null;

    if (dragImageNode && dragImageNode.parentNode) {
        dragImageNode.parentNode.removeChild(dragImageNode);
    }
    dragImageNode = null;

    if (finishOrderButton) {
        finishOrderButton.remove();
        finishOrderButton = null;
    }

    document.body.style.cursor = '';

    const newOrder = Array.from(document.querySelectorAll('.task-card'))
        .map(card => card.dataset.taskId || null)
        .filter(id => id !== null);

    try {
        await sendNewOrderToServer(newOrder);
    } catch (err) {
        console.error('Ошибка отправки нового порядка:', err);
        showNotification('Не удалось сохранить порядок заданий');
    }
}

function addDragHandle(card) {
    if (card.querySelector('.task-drag-handle')) return;

    const handle = document.createElement('button');
    handle.type = 'button';

    handle.className = 'task-drag-handle btn btn-sm btn-light border-0 edit-task-btn';
    handle.setAttribute('aria-label', 'Переместить задание');
    handle.setAttribute('title', 'Перетаскивать');
    handle.setAttribute('draggable', 'true');
    handle.innerHTML = '<i class="bi bi-grip-vertical" aria-hidden="true"></i>';

    Object.assign(handle.style, {
        position: 'absolute',
        top: '8px',
        right: '8px',
        width: '26px',
        height: '26px',
        padding: '3px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        zIndex: '120',
        fontSize: '0.85rem' // немного меньше иконка
    });

    handle.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    handle.addEventListener('dragstart', onHandleDragStart);
    handle.addEventListener('dragend', onHandleDragEnd);

    card.appendChild(handle);
}

function addClickBlocker(card) {
    if (card.querySelector('.task-click-blocker')) return;

    const blocker = document.createElement('div');
    blocker.className = 'task-click-blocker';
    Object.assign(blocker.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '50',
        pointerEvents: 'auto',
        background: 'transparent'
    });

    card.appendChild(blocker);

    const handle = card.querySelector('.task-drag-handle');
    if (handle) {
        handle.style.pointerEvents = 'auto';
        handle.style.zIndex = '120';
    }
}

function attachDragEvents(card) {
    card.addEventListener('dragover', onDragOver);
    card.addEventListener('dragleave', onDragLeave);
    card.addEventListener('drop', onDrop);
}

function ensurePlaceholder() {
    if (dropPlaceholder) return dropPlaceholder;

    dropPlaceholder = document.createElement('div');
    dropPlaceholder.className = 'drop-placeholder';
    Object.assign(dropPlaceholder.style, {
        height: '0px',
        transition: 'height 120ms ease, background 150ms ease',
        borderRadius: '8px',
        margin: '6px 0',
        background: 'linear-gradient(90deg, rgba(13,110,253,0.10), rgba(13,110,253,0.04))',
        zIndex: '30'
    });

    return dropPlaceholder;
}

/**
 * Создаёт клон карточки для drag image.
 */
function createDragImage(card) {
    if (dragImageNode && dragImageNode.parentNode) {
        dragImageNode.parentNode.removeChild(dragImageNode);
    }

    const clone = card.cloneNode(true);
    clone.style.width = `${Math.min(card.offsetWidth, 520)}px`;
    clone.style.boxSizing = 'border-box';
    clone.style.pointerEvents = 'none';
    clone.style.opacity = '0.92';
    clone.style.transform = 'scale(0.985)';
    clone.style.transition = 'transform 160ms ease, opacity 160ms ease';
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);
    dragImageNode = clone;
    return clone;
}

function onHandleDragStart(e) {
    const handle = e.currentTarget;
    const card = handle.closest('.task-card');
    if (!card) {
        e.preventDefault();
        return;
    }

    draggedCard = card;
    draggedCard.classList.add('dragging');
    document.body.style.cursor = 'grabbing';

    ensurePlaceholder();

    const clone = createDragImage(card);
    try {
        if (e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(clone, 20, 20);
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.taskId || '');
    } catch (err) {
        // ignore
    }

    requestAnimationFrame(() => {
        card.style.boxShadow = '0 8px 26px rgba(0,0,0,0.12)';
        card.style.transform = 'translateY(6px)';
    });
}

function onHandleDragEnd() {
    if (draggedCard) {
        draggedCard.classList.remove('dragging');
        draggedCard.style.boxShadow = '';
        draggedCard.style.transform = '';
    }

    draggedCard = null;
    document.body.style.cursor = '';

    if (dropPlaceholder && dropPlaceholder.parentNode) {
        dropPlaceholder.parentNode.removeChild(dropPlaceholder);
    }
    dropPlaceholder = null;

    if (dragImageNode && dragImageNode.parentNode) {
        dragImageNode.parentNode.removeChild(dragImageNode);
    }
    dragImageNode = null;
}

function onDragOver(e) {
    e.preventDefault();
    if (!draggedCard) return;

    const current = e.currentTarget;
    if (current === draggedCard) return;

    const rect = current.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;

    const parent = current.parentNode;
    if (!parent) return;

    const placeholder = ensurePlaceholder();

    if (after) {
        if (current.nextSibling !== placeholder) {
            parent.insertBefore(placeholder, current.nextSibling);
        }
    } else {
        if (current !== placeholder) {
            parent.insertBefore(placeholder, current);
        }
    }

    requestAnimationFrame(() => {
        placeholder.style.height = '12px';
        placeholder.style.background = 'linear-gradient(90deg, rgba(13,110,253,0.14), rgba(13,110,253,0.06))';
    });

    parent.querySelectorAll('.task-card').forEach(c => c.classList.remove('drop-target'));
    current.classList.add('drop-target');
    current.style.transition = current.style.transition || 'transform 160ms ease';
    current.style.boxShadow = '0 6px 18px rgba(13,110,253,0.06)'; // лёгкая подсветка цели
}

function onDragLeave(e) {
    const related = e.relatedTarget;
    if (!related || !e.currentTarget.parentNode.contains(related)) {
        if (dropPlaceholder && dropPlaceholder.parentNode) {
            dropPlaceholder.parentNode.removeChild(dropPlaceholder);
            dropPlaceholder = null;
        }
        e.currentTarget.classList.remove('drop-target');
        e.currentTarget.style.boxShadow = '';
    }
}

function onDrop(e) {
    e.preventDefault();
    if (!draggedCard) return;

    const parent = e.currentTarget.parentNode;
    if (!parent) return;

    const placeholder = dropPlaceholder;

    if (placeholder && placeholder.parentNode === parent) {
        parent.insertBefore(draggedCard, placeholder);
        placeholder.parentNode.removeChild(placeholder);
    } else {
        parent.insertBefore(draggedCard, e.currentTarget);
    }

    parent.querySelectorAll('.task-card').forEach(c => {
        c.classList.remove('drop-target');
        c.style.boxShadow = '';
    });
    dropPlaceholder = null;

    if (dragImageNode && dragImageNode.parentNode) {
        dragImageNode.parentNode.removeChild(dragImageNode);
    }
    dragImageNode = null;

    draggedCard.classList.remove('dragging');
    draggedCard = null;
    document.body.style.cursor = '';
}

function renderFinishOrderButton() {
    if (finishOrderButton) return;

    const panelInner = document.querySelector('#panel > .d-flex') || document.querySelector('#panel');
    if (!panelInner) return;

    document.getElementById('studentDropdown')?.classList.add('d-none');
    document.getElementById('menuDropdown')?.classList.add('d-none');

    finishOrderButton = document.createElement('button');
    finishOrderButton.type = 'button';
    finishOrderButton.className = 'btn btn-sm btn-success border-0';
    finishOrderButton.setAttribute('aria-label', 'Завершить редактирование порядка');
    finishOrderButton.style.minWidth = '36px';
    finishOrderButton.style.padding = '4px 8px';
    finishOrderButton.innerHTML = 'Готово';

    finishOrderButton.addEventListener('click', finishTasksOrderEditing);

    const menuDropdown = document.getElementById('menuDropdown');
    if (menuDropdown && menuDropdown.parentNode === panelInner) {
        panelInner.insertBefore(finishOrderButton, menuDropdown);
    } else {
        panelInner.appendChild(finishOrderButton);
    }
}
