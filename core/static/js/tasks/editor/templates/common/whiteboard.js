/**
 * Рендерит редактор задания «Виртуальная доска» (Excalidraw).
 *
 * @param {Object|null} taskData
 * @returns {HTMLElement}
 */
export function renderWhiteboardTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    let boardData = taskData?.content || null;
    let unmount = null;

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold mb-0">
                <i class="bi bi-easel me-1"></i> Виртуальная доска
            </h6>
            <button class="btn-close remove-task-btn"></button>
        </div>

        <div class="border rounded" style="height: 500px;">
            <div class="excalidraw-root" style="width:100%; height:100%;"></div>
        </div>

        <button class="btn btn-success w-100 mt-3 fw-semibold">
            Сохранить доску
        </button>
    `;

    const root = card.querySelector(".excalidraw-root");

    unmount = window.ExcalidrawApp.mountExcalidraw(
        root,
        boardData,
        (data) => {
            boardData = data;
        }
    );

    card.querySelector(".remove-task-btn").addEventListener("click", () => {
        if (unmount) unmount();
        card.remove();
    });

    return card;
}