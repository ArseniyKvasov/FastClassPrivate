function loadDOMPurify() {
    return new Promise((resolve, reject) => {
        if (window.DOMPurify) {
            resolve(window.DOMPurify);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
        script.onload = () => {
            if (window.DOMPurify) {
                resolve(window.DOMPurify);
            } else {
                reject(new Error('DOMPurify failed to load'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load DOMPurify'));
        document.head.appendChild(script);
    });
}

function loadMathJax() {
    return new Promise((resolve) => {
        if (window.MathJax) {
            resolve(window.MathJax);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';

        const originalConfig = window.MathJax;
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
            },
            startup: {
                ready: () => {
                    MathJax.startup.defaultReady();
                    MathJax.startup.promise.then(() => {
                        resolve(window.MathJax);
                    });
                }
            }
        };

        if (originalConfig) {
            Object.assign(window.MathJax, originalConfig);
        }

        script.onload = () => {
            if (!window.MathJax.startup || !window.MathJax.startup.ready) {
                setTimeout(() => {
                    if (window.MathJax) {
                        resolve(window.MathJax);
                    } else {
                        resolve(null);
                    }
                }, 100);
            }
        };

        script.onerror = () => resolve(null);
        document.head.appendChild(script);
    });
}

async function renderMathJaxInContainer(container) {
    try {
        const mathjax = await loadMathJax();
        if (!mathjax) return;

        if (mathjax.typesetPromise) {
            await mathjax.typesetPromise([container]);
        } else if (mathjax.startup && mathjax.startup.promise) {
            await mathjax.startup.promise;
            if (mathjax.typesetPromise) {
                await mathjax.typesetPromise([container]);
            }
        }

        setTimeout(() => {
            if (mathjax.typesetPromise) {
                mathjax.typesetPromise([container]).catch(() => {});
            }
        }, 100);
    } catch (error) {
        console.warn('MathJax rendering error:', error);
    }
}

function convertUrlsToLinks(node) {
    if (node.nodeType === Node.TEXT_NODE) {
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
            return true;
        }
        return false;
    }

    if (node.nodeType === Node.ELEMENT_NODE &&
        node.tagName !== 'A' &&
        node.tagName !== 'SCRIPT' &&
        node.tagName !== 'IFRAME') {
        let changed = false;
        const childNodes = Array.from(node.childNodes);

        childNodes.forEach(child => {
            if (convertUrlsToLinks(child)) {
                changed = true;
            }
        });

        return changed;
    }

    return false;
}

function processHtmlWithLinks(html, DOMPurify) {
    const container = document.createElement('div');

    const cleanHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'b', 'i', 'u', 'strong', 'em', 'br', 'div', 'span',
                      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                      'blockquote', 'a', 'img'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'title'],
        ADD_ATTR: ['target', 'rel']
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanHtml, 'text/html');

    Array.from(doc.body.childNodes).forEach(child => {
        container.appendChild(child.cloneNode(true));
    });

    convertUrlsToLinks(container);

    return container;
}

function preprocessLaTeX(content) {
    const lines = content.split('\n');
    const processedLines = [];
    let inDisplayMath = false;
    let mathContent = [];

    for (const line of lines) {
        if (line.includes('$$')) {
            const parts = line.split('$$');
            if (parts.length % 2 === 0) {
                inDisplayMath = !inDisplayMath;
                if (inDisplayMath) {
                    mathContent.push(parts[0]);
                } else {
                    mathContent.push(parts[0]);
                    const tex = mathContent.join('\n').trim();
                    processedLines.push(`<div class="math-display" data-tex="${tex.replace(/"/g, '&quot;')}">$$${tex}$$</div>`);
                    if (parts[1]) {
                        processedLines.push(parts[1]);
                    }
                    mathContent = [];
                }
            } else {
                processedLines.push(line);
            }
        } else if (inDisplayMath) {
            mathContent.push(line);
        } else {
            let processedLine = line
                .replace(/\$(.*?)\$/g, (match, tex) => {
                    if (match.includes('\n')) return match;
                    return `<span class="math-inline" data-tex="${tex.trim().replace(/"/g, '&quot;')}">$${tex}$</span>`;
                })
                .replace(/\\\((.*?)\\\)/g, (match, tex) => {
                    if (match.includes('\n')) return match;
                    return `<span class="math-inline" data-tex="${tex.trim().replace(/"/g, '&quot;')}">\\(${tex}\\)</span>`;
                })
                .replace(/\\\[(.*?)\\\]/g, (match, tex) => {
                    return `<div class="math-display" data-tex="${tex.trim().replace(/"/g, '&quot;')}">\\[${tex}\\]</div>`;
                });
            processedLines.push(processedLine);
        }
    }

    if (inDisplayMath && mathContent.length > 0) {
        const tex = mathContent.join('\n').trim();
        processedLines.push(`<div class="math-display" data-tex="${tex.replace(/"/g, '&quot;')}">$$${tex}$$</div>`);
    }

    return processedLines.join('\n');
}

export async function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";
    const noteDiv = document.createElement("div");
    noteDiv.className = "note-content p-3 bg-light rounded";

    const raw = (task?.data?.content || '').trim();

    if (!raw) {
        noteDiv.textContent = "Нет содержимого";
        container.appendChild(noteDiv);
        return;
    }

    try {
        const DOMPurify = await loadDOMPurify();
        const processedContent = preprocessLaTeX(raw);
        const processed = processHtmlWithLinks(processedContent, DOMPurify);
        noteDiv.appendChild(processed);

        noteDiv.style.cssText = `
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.5;
        `;

        noteDiv.querySelectorAll('a').forEach(a => {
            if (!a.classList.contains('link-primary') && !a.classList.contains('link-secondary')) {
                a.classList.add('text-decoration-none', 'link-primary');
            }
        });

        container.appendChild(noteDiv);

        await renderMathJaxInContainer(noteDiv);
    } catch (error) {
        console.error('Error rendering note:', error);
        noteDiv.textContent = raw;
        container.appendChild(noteDiv);
    }
}