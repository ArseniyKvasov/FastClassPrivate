/**
 * Форматирует текст: каждое слово, начинающееся с "http://", "https://" или "www.", превращается в ссылку.
 * @param {string} text - Исходный текст (может содержать HTML или plain text)
 * @returns {string} Текст с обёрнутыми в <a> ссылками
 */
export function formatLinks(text) {
    if (text === null || text === undefined) return text;
    const parts = text.split(' ');
    return parts.map(part => {
        if (!part) return part;
        const m = part.match(/^((?:https?:\/\/|www\.)\S*)(.*)$/);
        if (m) {
            const urlText = m[1];
            const tail = m[2] || '';
            const href = urlText.startsWith('www.') ? `https://${urlText}` : urlText;
            return `<a href="${href}" target="_blank">${urlText}</a>${tail}`;
        }
        return part;
    }).join(' ');
}

/**
 * Рендерит информационную заметку (note)
 * @param {Object} task - Объект задания
 * @param {Object} task.data - Данные задания
 * @param {string} task.data.content - HTML-контент или plain text заметки
 * @param {HTMLElement} container - Контейнер для рендеринга
 */
export function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";
    const noteDiv = document.createElement("div");
    noteDiv.className = "note-content";
    const raw = (task && task.data && typeof task.data.content === 'string') ? task.data.content : '';
    const formatted = formatLinks(raw);
    noteDiv.innerHTML = formatted;
    container.appendChild(noteDiv);
}
