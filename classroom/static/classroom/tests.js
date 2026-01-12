import { fetchCurrentLessonId, refreshClassroom, getClassroomId } from "/static/classroom/utils.js";
import { getLessonId } from "/static/js/tasks/utils.js";
import { checkUserOnline } from "/static/classroom/answers/classroomPanel.js"

export async function isCurrentLessonCorrect() {
    const classroomId = getClassroomId();
    if (!classroomId) return;

    const frontendLessonId = getLessonId();
    const backendLessonId = await fetchCurrentLessonId(classroomId);
    if (String(frontendLessonId) !== String(backendLessonId)) {
        await refreshClassroom();
    }
}

// Проверка онлайн-статуса всех студентов
export async function checkAllStudentsStatus(studentsList = []) {
    studentsList.forEach(s => {
        checkUserOnline(s.id);
    });
}