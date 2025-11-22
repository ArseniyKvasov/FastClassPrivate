function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";
    const noteDiv = document.createElement("div");
    noteDiv.className = "note-content";
    noteDiv.innerHTML = task.data.content;
    container.appendChild(noteDiv);
}
