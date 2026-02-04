import { showNotification } from "/static/js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Доска».
 *
 * @param {Object|null} taskData
 * @param {Object} [taskData.content]
 * @param {Array} [taskData.file_paths]
 */
export function renderWhiteboardTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const contentData = taskData?.content || {};
    const filePaths = taskData?.file_paths || [];
    const whiteboardId = `whiteboard-${Date.now()}`;

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0"><i class="bi bi-easel me-1"></i> Виртуальная доска</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="whiteboard-description mb-3">
            <p class="text-muted small mb-2">
                Создайте интерактивную доску с рисунками, схемами и заметками.
            </p>
        </div>

        <div class="whiteboard-container border rounded bg-white mb-3" style="height: 500px;">
            <div id="${whiteboardId}" style="width: 100%; height: 100%;"></div>
        </div>

        <div class="attached-files mt-3">
            <h6 class="fw-semibold mb-2">Прикрепленные файлы:</h6>
            <div class="files-list mb-2">
            </div>
            <div class="no-files text-muted small text-center py-2">
                <i class="bi bi-info-circle me-1"></i>Файлы не прикреплены
            </div>
            <div class="file-upload-area mt-2 p-2 border rounded bg-white">
                <input type="file" multiple class="form-control file-input" style="display: none;" accept="image/*">
                <button class="btn btn-sm btn-outline-secondary add-file-btn w-100">
                    <i class="bi bi-plus-circle me-1"></i>Добавить файлы
                </button>
            </div>
        </div>

        <div class="whiteboard-controls mt-3 d-flex gap-2">
            <button class="btn btn-outline-secondary clear-whiteboard-btn flex-grow-1">
                <i class="bi bi-trash me-2"></i>Очистить доску
            </button>
            <button class="btn btn-outline-secondary undo-btn flex-grow-1">
                <i class="bi bi-arrow-counterclockwise me-2"></i>Отменить
            </button>
            <button class="btn btn-outline-secondary redo-btn flex-grow-1">
                <i class="bi bi-arrow-clockwise me-2"></i>Повторить
            </button>
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить доску
        </button>
    `;

    const whiteboardContainer = card.querySelector(`#${whiteboardId}`);
    const filesList = card.querySelector(".files-list");
    const noFiles = card.querySelector(".no-files");
    const fileInput = card.querySelector(".file-input");
    const addFileBtn = card.querySelector(".add-file-btn");
    const clearBtn = card.querySelector(".clear-whiteboard-btn");
    const undoBtn = card.querySelector(".undo-btn");
    const redoBtn = card.querySelector(".redo-btn");

    let tldrawEditor = null;

    function initializeTLDraw() {
        if (typeof window.tldraw === 'undefined') {
            showNotification("TLDraw не загружен. Проверьте подключение файлов.");
            return;
        }

        try {
            const { Tldraw } = window.tldraw;

            tldrawEditor = new Tldraw({
                target: whiteboardContainer,
                props: {
                    persistenceKey: whiteboardId,
                    onMount: (editor) => {
                        if (contentData && Object.keys(contentData).length > 0) {
                            try {
                                editor.loadSnapshot(contentData);
                            } catch (error) {
                                console.error('Error loading snapshot:', error);
                            }
                        }

                        editor.on('change', () => {
                            const snapshot = editor.store.getSnapshot();
                            contentData = snapshot;
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Error initializing TLDraw:', error);
            whiteboardContainer.innerHTML = `
                <div class="text-center text-danger p-4">
                    <i class="bi bi-exclamation-triangle fs-1 d-block mb-2"></i>
                    <p>Ошибка загрузки редактора доски</p>
                    <p class="small">${error.message}</p>
                </div>
            `;
        }
    }

    function updateFilesDisplay() {
        if (filePaths.length > 0) {
            filesList.innerHTML = filePaths
                .filter(item => item && typeof item === 'object')
                .map(item => `
                    <div class="file-item d-flex align-items-center justify-content-between mb-2 p-2 border rounded">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-image me-2"></i>
                            <div>
                                <div class="small fw-medium">${item.name || 'Файл'}</div>
                                <div class="text-muted x-small">${formatFileSize(item.size)}</div>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger remove-file-btn" data-asset-id="${item.asset_id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `).join('');
            noFiles.classList.add("d-none");
        } else {
            filesList.innerHTML = '';
            noFiles.classList.remove("d-none");
        }
    }

    function formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    async function handleFileUpload(files) {
        for (const file of Array.from(files)) {
            const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"];
            if (!allowedTypes.includes(file.type)) {
                showNotification("Разрешены только изображения (PNG, JPEG, GIF, WEBP, SVG)");
                continue;
            }

            const fileInfo = {
                path: `uploads/whiteboards/${Date.now()}_${file.name.replace(/\s+/g, '_')}`,
                name: file.name,
                mime_type: file.type,
                size: file.size,
                asset_id: `image:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };

            filePaths.push(fileInfo);
            updateFilesDisplay();

            if (tldrawEditor && tldrawEditor.editor) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        tldrawEditor.editor.createImageShape({
                            x: 100,
                            y: 100,
                            width: img.width > 500 ? 500 : img.width,
                            height: img.height > 400 ? 400 : img.height,
                            props: {
                                src: e.target.result,
                                w: img.width > 500 ? 500 : img.width,
                                h: img.height > 400 ? 400 : img.height
                            }
                        });
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
    }

    function loadTLDraw() {
        if (document.querySelector('script[src*="tldraw.js"]')) {
            setTimeout(initializeTLDraw, 100);
        } else {
            const script = document.createElement('script');
            script.src = '/static/js/vendor/tldraw/tldraw.js';
            script.onload = () => {
                setTimeout(initializeTLDraw, 100);
            };
            script.onerror = () => {
                whiteboardContainer.innerHTML = `
                    <div class="text-center text-danger p-4">
                        <i class="bi bi-exclamation-triangle fs-1 d-block mb-2"></i>
                        <p>Не удалось загрузить TLDraw</p>
                        <p class="small">Файл не найден: /static/js/vendor/tldraw/tldraw.js</p>
                    </div>
                `;
            };
            document.head.appendChild(script);

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/static/js/vendor/tldraw/tldraw.css';
            document.head.appendChild(link);
        }
    }

    loadTLDraw();
    updateFilesDisplay();

    addFileBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) handleFileUpload(e.target.files);
        fileInput.value = '';
    });

    filesList.addEventListener("click", (e) => {
        if (e.target.closest(".remove-file-btn")) {
            const assetId = e.target.closest(".remove-file-btn").dataset.assetId;
            const index = filePaths.findIndex(item => item.asset_id === assetId);
            if (index > -1) {
                filePaths.splice(index, 1);
                updateFilesDisplay();

                if (tldrawEditor && tldrawEditor.editor) {
                    const shape = tldrawEditor.editor.getShape(assetId);
                    if (shape) {
                        tldrawEditor.editor.deleteShape(shape.id);
                    }
                }
            }
        }
    });

    clearBtn.addEventListener("click", () => {
        if (tldrawEditor && tldrawEditor.editor && confirm("Очистить всю доску? Это действие нельзя отменить.")) {
            tldrawEditor.editor.deleteAllShapes();
            filePaths.length = 0;
            updateFilesDisplay();
        }
    });

    undoBtn.addEventListener("click", () => {
        if (tldrawEditor && tldrawEditor.editor) {
            tldrawEditor.editor.undo();
        }
    });

    redoBtn.addEventListener("click", () => {
        if (tldrawEditor && tldrawEditor.editor) {
            tldrawEditor.editor.redo();
        }
    });

    card.querySelector(".remove-task-btn").addEventListener("click", () => {
        if (tldrawEditor && tldrawEditor.$destroy) {
            tldrawEditor.$destroy();
        }
        card.remove();
    });

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}