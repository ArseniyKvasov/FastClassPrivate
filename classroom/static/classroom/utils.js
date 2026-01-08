export function getClassroomId() {
    const info = document.getElementById("info");
    return info?.dataset?.classroomId || null;
}

export function getViewedUserId() {
    const info = document.getElementById("info");
    return info?.dataset?.viewedUserId || null;
}