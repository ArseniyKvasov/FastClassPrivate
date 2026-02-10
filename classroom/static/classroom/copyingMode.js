import { showNotification } from "js/tasks/utils.js";


/**
 * Запрещает копирование, выделение текста и автоперевод
 */
export function disableCopying() {
    document.body.classList.remove("copy-allowed");
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.msUserSelect = "none";
    document.body.setAttribute("translate", "no");
    document.body.addEventListener("copy", preventCopy, true);
    document.body.addEventListener("cut", preventCopy, true);
    document.body.addEventListener("contextmenu", preventContextMenu, true);
}

export function enableCopying() {
    document.body.classList.add("copy-allowed");
    document.body.style.userSelect = "text";
    document.body.style.webkitUserSelect = "text";
    document.body.style.msUserSelect = "text";
    document.body.removeEventListener("copy", preventCopy, true);
    document.body.removeEventListener("cut", preventCopy, true);
    document.body.removeEventListener("contextmenu", preventContextMenu, true);
}

function preventCopy(e) {
    e.preventDefault();
    showNotification("Копирование недоступно");
}

function preventContextMenu(e) {
    e.preventDefault();
}