function showStatistics(taskId, stats) {
    try {
        const container = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!container) {
            console.warn(`Task container not found for taskId ${taskId}`);
            return;
        }

        const taskType = container.dataset.taskType;
        if (!taskClearHandlers[taskType]) return;

        let statsContainer = container.querySelector('.horizontal-cards');
        if (statsContainer) statsContainer.remove();

        statsContainer = document.createElement('div');
        statsContainer.className = 'horizontal-cards';

        // Сортируем статистику по проценту выполнения (от максимума к минимуму)
        const sortedStats = [...stats].sort((a, b) => {
            return b.success_percentage - a.success_percentage;
        });

        sortedStats.forEach(student => {
            const card = document.createElement('div');
            card.className = 'student-card';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'name';
            nameDiv.textContent = student.user.username;

            const statsDiv = document.createElement('div');
            statsDiv.className = 'stats';
            statsDiv.innerHTML = `
                <span class="correct text-success">${student.correct_answers}</span>
                <span>|</span>
                <span class="wrong text-danger">${student.wrong_answers}</span>
                <span>|</span>
                <span class="percent text-primary">${student.success_percentage}%</span>
            `;

            card.appendChild(nameDiv);
            card.appendChild(statsDiv);
            statsContainer.appendChild(card);
        });

        container.appendChild(statsContainer);
    } catch (error) {
        console.error('Ошибка при отображении статистики:', error);
        showNotification('Не удалось отобразить статистику');
    }
}

function clearStatistics(taskId = null) {
    try {
        if (taskId) {
            const container = document.querySelector(`[data-task-id="${taskId}"]`);
            if (!container) return;

            const statsContainer = container.querySelector('.horizontal-cards');
            if (statsContainer) statsContainer.remove();
        } else {
            document.querySelectorAll('.task-card .horizontal-cards').forEach(statsContainer => {
                statsContainer.remove();
            });
        }
    } catch (error) {
        console.error('Ошибка при очистке статистики:', error);
    }
}

export async function loadSectionStatistics() {
    try {
        clearSectionTasks();

        const response = await fetch(`/classroom/${virtualClassId}/section/${sectionId}/statistics/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (!data.tasks) return;

        data.tasks.forEach(task => {
            showStatistics(task.id, task.statistics);
        });
    } catch (error) {
        console.error("Ошибка загрузки статистики раздела:", error);
        showNotification("Не удалось отобразить статистику");
    }
}

export async function loadTaskStatistics(taskId) {
    try {
        clearTask(taskId);

        const response = await fetch(`/classroom/${classroomId}/task/${taskId}/statistics/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        const container = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!container) return;

        const taskType = container.dataset.taskType;
        if (!taskClearHandlers[taskType]) {
            return;
        }

        showStatistics(data.task.id, data.statistics);
    } catch (error) {
        console.error(`Ошибка загрузки статистики для задания ${taskId}:`, error);
        showNotification("Не удалось отобразить статистику");
    }
}