/**
 * Рендеринг заметки с LaTeX формулами
 * @param {Object} task - Объект задачи с данными заметки
 * @param {HTMLElement} container - Контейнер для рендеринга
 * @returns {Promise<void>}
 */
export async function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";
    const noteDiv = document.createElement("div");
    noteDiv.className = "note-content p-3 bg-light rounded";

    const rawContent = (task?.data?.content || '').trim();

    if (!rawContent) {
        noteDiv.textContent = "Нет содержимого";
        container.appendChild(noteDiv);
        return;
    }

    try {
        await initMathJax();

        const cleanContent = await sanitizeContent(rawContent);
        const htmlContent = convertMarkdownToHtml(cleanContent);
        const withMath = processMathFormulas(htmlContent);
        const safeHtml = await purifyHtml(withMath);

        noteDiv.innerHTML = safeHtml;

        noteDiv.style.cssText = `
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.5;
        `;

        container.appendChild(noteDiv);

        if (window.MathJax && window.MathJax.typesetPromise) {
            await window.MathJax.typesetPromise([noteDiv]);
        }

        processLinks(noteDiv);
    } catch (error) {
        console.error('Error rendering note:', error);
        noteDiv.textContent = rawContent;
        container.appendChild(noteDiv);
    }
}

/**
 * Инициализация MathJax
 * @returns {Promise<void>}
 */
function initMathJax() {
    return new Promise((resolve) => {
        if (window.MathJax) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';

        window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                processEscapes: true
            },
            options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            },
            svg: {
                fontCache: 'global'
            }
        };

        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
}

/**
 * Загрузка DOMPurify
 * @returns {Promise<Object>}
 */
function loadDOMPurify() {
    return new Promise((resolve) => {
        if (window.DOMPurify) {
            resolve(window.DOMPurify);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
        script.onload = () => resolve(window.DOMPurify || { sanitize: (html) => html });
        script.onerror = () => resolve({ sanitize: (html) => html });
        document.head.appendChild(script);
    });
}

/**
 * Очистка и нормализация контента
 * @param {string} content - Исходный текст
 * @returns {string}
 */
function sanitizeContent(content) {
    return content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/^\s+|\s+$/g, '');
}

/**
 * Преобразование Markdown в HTML
 * @param {string} content - Markdown текст
 * @returns {string}
 */
function convertMarkdownToHtml(content) {
    const lines = content.split('\n');
    const blocks = [];
    let currentBlock = [];
    let inCodeBlock = false;
    let inMathBlock = false;
    let mathBlockContent = [];

    for (let line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            if (inCodeBlock) {
                blocks.push(`<pre><code>${currentBlock.join('\n')}</code></pre>`);
                currentBlock = [];
                inCodeBlock = false;
            } else {
                if (currentBlock.length > 0) {
                    blocks.push(formatTextBlock(currentBlock.join('\n')));
                    currentBlock = [];
                }
                inCodeBlock = true;
            }
            continue;
        }

        if (trimmed.startsWith('$$') && !inCodeBlock) {
            if (inMathBlock) {
                mathBlockContent.push(line.slice(0, -2).trim());
                blocks.push(`<div class="math-display">$$${mathBlockContent.join('\n')}$$</div>`);
                mathBlockContent = [];
                inMathBlock = false;
            } else {
                if (currentBlock.length > 0) {
                    blocks.push(formatTextBlock(currentBlock.join('\n')));
                    currentBlock = [];
                }
                mathBlockContent.push(line.slice(2).trim());
                inMathBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            currentBlock.push(line);
        } else if (inMathBlock) {
            mathBlockContent.push(line);
        } else {
            currentBlock.push(line);
        }
    }

    if (currentBlock.length > 0 && !inCodeBlock) {
        blocks.push(formatTextBlock(currentBlock.join('\n')));
    }

    if (inMathBlock && mathBlockContent.length > 0) {
        blocks.push(`<div class="math-display">$$${mathBlockContent.join('\n')}$$</div>`);
    }

    if (inCodeBlock && currentBlock.length > 0) {
        blocks.push(`<pre><code>${currentBlock.join('\n')}</code></pre>`);
    }

    return blocks.join('\n');
}

/**
 * Форматирование текстового блока
 * @param {string} text - Текст блока
 * @returns {string}
 */
function formatTextBlock(text) {
    if (!text.trim()) return '';

    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return '';

    const formattedLines = lines.map(line => {
        let formatted = line;

        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_(.*?)_/g, '<u>$1</u>');
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');

        return formatted;
    });

    return `<div>${formattedLines.join('<br>')}</div>`;
}

/**
 * Обработка математических формул
 * @param {string} html - HTML с формулами
 * @returns {string}
 */
function processMathFormulas(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    tempDiv.querySelectorAll('.math-display').forEach(el => {
        const content = el.textContent.replace(/^\$\$|\$\$$/g, '').trim();
        el.setAttribute('data-tex', content);
        el.innerHTML = `\\[${content}\\]`;
    });

    const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    const textNodes = [];

    while ((node = walker.nextNode())) {
        if (node.parentElement && !node.parentElement.closest('.math-display, pre, code')) {
            textNodes.push(node);
        }
    }

    textNodes.forEach(node => {
        const text = node.textContent;
        const replaced = text.replace(/\$(.*?)\$/g, (match, tex) => {
            if (match.includes('\n')) return match;
            return `<span class="math-inline" data-tex="${tex.trim()}">$${tex}$</span>`;
        });

        if (replaced !== text) {
            const span = document.createElement('span');
            span.innerHTML = replaced;
            node.parentNode.replaceChild(span, node);
        }
    });

    return tempDiv.innerHTML;
}

/**
 * Очистка HTML с помощью DOMPurify
 * @param {string} html - HTML для очистки
 * @returns {Promise<string>}
 */
async function purifyHtml(html) {
    const DOMPurify = await loadDOMPurify();

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'span', 'p', 'br', 'strong', 'em', 'u', 'code',
            'pre', 'a', 'img', 'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
        ],
        ALLOWED_ATTR: [
            'class', 'style', 'href', 'target', 'rel',
            'src', 'alt', 'title', 'data-tex'
        ],
        ADD_ATTR: ['target', 'rel', 'data-tex']
    });
}

/**
 * Обработка ссылок в контенте
 * @param {HTMLElement} container - DOM элемент с контентом
 */
function processLinks(container) {
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    const textNodes = [];

    while ((node = walker.nextNode())) {
        if (node.parentElement && !node.parentElement.closest('a, code, pre, .math-display, .math-inline')) {
            textNodes.push(node);
        }
    }

    textNodes.forEach(node => {
        const text = node.textContent;
        const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+\.[^\s<]+)/gi;

        let lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let match;

        while ((match = urlRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }

            const link = document.createElement('a');
            const url = match[0].startsWith('www.') ? `https://${match[0]}` : match[0];
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = match[0];
            link.className = 'text-decoration-none link-primary';
            fragment.appendChild(link);

            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        if (fragment.childNodes.length > 0) {
            node.parentNode.replaceChild(fragment, node);
        }
    });

    container.querySelectorAll('a').forEach(a => {
        if (!a.classList.contains('link-primary') && !a.classList.contains('link-secondary')) {
            a.classList.add('text-decoration-none', 'link-primary');
        }
    });
}