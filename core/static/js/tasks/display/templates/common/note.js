/**
 * Рендерит информационную заметку (note)
 * @param {Object} task - Объект задания
 * @param {Object} task.data - Данные задания
 * @param {string} task.data.content - HTML-контент заметки
 * @param {HTMLElement} container - Контейнер для рендеринга
 */
export function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";
    const noteDiv = document.createElement("div");
    noteDiv.className = "note-content";
    noteDiv.innerHTML = task.data.content;
    container.appendChild(noteDiv);
}
