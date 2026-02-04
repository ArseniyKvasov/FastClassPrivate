from .base import Course, Lesson, Section, Task, SUBJECT_CHOICES, TYPE_CHOICES, ROOT_TYPE_CHOICES
from .tasks.common import TestTask, TrueFalseTask, NoteTask, FillGapsTask, MatchCardsTask, TextInputTask, \
    IntegrationTask, FileTask
from .tasks.languages import WordListTask

TASK_MODEL_MAP = {
    "test": TestTask,
    "true_false": TrueFalseTask,
    "fill_gaps": FillGapsTask,
    "match_cards": MatchCardsTask,
    "note": NoteTask,
    "text_input": TextInputTask,
    "integration": IntegrationTask,
    "file": FileTask,
    "word_list": WordListTask,
}