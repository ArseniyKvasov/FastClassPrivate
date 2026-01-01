const answerHandlers = {
    test: handleTestAnswer,
    true_false: handleTrueFalseAnswer,
    text_input: handleTextInputAnswer,
    fill_gaps: handleFillGapsAnswer,
    match_cards: handleMatchCardsAnswer
};

async function handleSectionAnswers(sectionId, userId = getId()) {
    if (!virtualClassId) {
        showNotification("Произошла ошибка. Не указан виртуальный класс.");
        return;
    }

    try {
        const data = await fetchSectionAnswers(sectionId);

        if (!data || !Array.isArray(data.answers)) {
            showNotification("Нет данных для отображения.");
            return;
        }

        data.answers.forEach(answerData => {
            const { task_id, task_type, answer } = answerData;

            const container = document.querySelector(`[data-task-id="${task_id}"]`);
            if (!container) {
                console.warn(`Контейнер не найден для task_id: ${task_id}`);
                return;
            }

            const handler = answerHandlers[task_type];
            if (typeof handler === "function") {
                try {
                    handler(answerData);
                } catch (error) {
                    console.warn(`Ошибка в обработчике для task_type ${task_type}, task_id ${task_id}:`, error);
                    showNotification("Не удалось отобразить ответ.");
                }
            } else {
                console.warn(`Не найден обработчик для типа задания: ${task_type}`);
                showNotification("Не удалось отобразить ответ.");
            }
        });

    } catch (error) {
        console.warn("Ошибка в handleSectionAnswers:", error);
        showNotification("Не удалось загрузить ответы раздела.");
    }
}