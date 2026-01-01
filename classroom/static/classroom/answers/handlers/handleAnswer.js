const taskHandlers = {
    test: handleTestTask,
    true_false: handleTrueFalseTask,
    text_input: handleTextInputTask,
    fill_gaps: handleFillGapsTask,
    match_cards: handleMatchCardsTask
};

function attachTaskHandler(container, task) {
    const handler = taskHandlers[task.task_type];
    if (handler) handler(container, task);
}