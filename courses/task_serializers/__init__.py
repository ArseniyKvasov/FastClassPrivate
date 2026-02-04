from .common import TestTaskSerializer, NoteTaskSerializer, TrueFalseTaskSerializer, \
    FillGapsTaskSerializer, MatchCardsTaskSerializer, TextInputTaskSerializer, IntegrationTaskSerializer, \
    FileTaskSerializer
from .languages import WordListTaskSerializer

TASK_SERIALIZER_MAP = {
    "test": TestTaskSerializer,
    "note": NoteTaskSerializer,
    "true_false": TrueFalseTaskSerializer,
    "fill_gaps": FillGapsTaskSerializer,
    "match_cards": MatchCardsTaskSerializer,
    "text_input": TextInputTaskSerializer,
    "integration": IntegrationTaskSerializer,
    "file": FileTaskSerializer,
    "word_list": WordListTaskSerializer,
}