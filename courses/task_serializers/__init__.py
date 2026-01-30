from .common_tasks import TestTaskSerializer, NoteTaskSerializer, ImageTaskSerializer, TrueFalseTaskSerializer, \
    FillGapsTaskSerializer, MatchCardsTaskSerializer, TextInputTaskSerializer, IntegrationTaskSerializer, \
    FileTaskSerializer

TASK_SERIALIZER_MAP = {
    "test": TestTaskSerializer,
    "note": NoteTaskSerializer,
    "image": ImageTaskSerializer,
    "true_false": TrueFalseTaskSerializer,
    "fill_gaps": FillGapsTaskSerializer,
    "match_cards": MatchCardsTaskSerializer,
    "text_input": TextInputTaskSerializer,
    "integration": IntegrationTaskSerializer,
    "file": FileTaskSerializer,
}