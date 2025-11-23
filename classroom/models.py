import uuid
import random
import string
import re
from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone

from courses.models import Task, TestTask, TrueFalseTask, FillGapsTask, MatchCardsTask, TextInputTask

User = get_user_model()


def generate_short_uuid():
    """Генерирует уникальный 8-символьный id для класса"""
    from .models import Classroom
    while True:
        new_id = uuid.uuid4().hex[:8]
        if not Classroom.objects.filter(id=new_id).exists():
            return new_id


def generate_invite_code():
    """Генерирует уникальный 6-символьный пригласительный код"""
    chars = string.ascii_uppercase + string.digits
    from .models import Classroom
    while True:
        new_code = ''.join(random.choices(chars, k=6))
        if not Classroom.objects.filter(invite_code=new_code).exists():
            return new_code


def normalize_str(s):
    """Нормализация строки для сравнения"""
    if s is None:
        return ""
    return str(s).strip().lower()


class Classroom(models.Model):
    id = models.CharField(
        primary_key=True,
        max_length=8,
        default=generate_short_uuid,
        editable=False,
        unique=True,
    )
    title = models.CharField(max_length=255)
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="classrooms",
    )
    lesson = models.ForeignKey(
        "courses.Lesson",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="classrooms",
    )
    students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="joined_classrooms",
        blank=True,
    )
    invite_code = models.CharField(
        max_length=6,
        unique=True,
        default=generate_invite_code,
        editable=False,
    )

    class Meta:
        verbose_name = "Класс"
        verbose_name_plural = "Классы"

    def __str__(self):
        return f"{self.title} ({self.teacher.username})"

    @property
    def student_count(self):
        """Количество учеников в классе"""
        return self.students.count()

    @classmethod
    def join_by_code(cls, code, user):
        """Присоединяет пользователя по коду"""
        try:
            classroom = cls.objects.get(invite_code=code)
        except cls.DoesNotExist:
            raise ValidationError("Неверный код приглашения.")

        if classroom.teacher == user:
            raise ValidationError("Учитель не может присоединиться к своему классу как ученик.")

        if classroom.students.filter(id=user.id).exists():
            raise ValidationError("Вы уже присоединились к этому классу.")

        classroom.students.add(user)
        return classroom

    def remove_student(self, user):
        """Удаляет ученика из класса"""
        if not self.students.filter(id=user.id).exists():
            raise ValidationError("Этот пользователь не состоит в классе.")

        self.students.remove(user)
        return self

    def get_available_users(self, user):
        """
        Определяет доступных пользователей для просмотра
        Для учителя - возвращает учителя и всех учеников
        Для ученика - возвращает только самого ученика
        """
        if self.teacher == user:
            available_users = list(self.students.all())
            available_users.append(self.teacher)
        else:
            available_users = [user]

        return available_users


class BaseAnswer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey("courses.Task", on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

    def save_answer_data(self, data):
        """Абстрактный метод для сохранения данных ответа"""
        raise NotImplementedError("Subclasses must implement save_answer_data")

    def get_answer_data(self):
        """Абстрактный метод для получения данных ответа"""
        raise NotImplementedError("Subclasses must implement get_answer_data")

    def check_correctness(self):
        """Абстрактный метод для проверки правильности ответа"""
        raise NotImplementedError("Subclasses must implement check_correctness")

    def delete_answers(self):
        """Абстрактный метод для удаления ответов"""
        raise NotImplementedError("Subclasses must implement delete_answers")


class TestTaskAnswer(BaseAnswer):
    answers = models.JSONField(
        default=list)  # [{"question_index": int, "selected_option": int, "is_correct": bool}, ...]
    is_checked = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_test_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        """
        Обновляет ответ для конкретного вопроса без сброса остальных.
        data: {"answers": [{"question_index": int, "selected_option": int}, ...]}
        """
        if self.is_checked:
            raise ValidationError("Ответ уже проверен и не может быть изменен")

        input_answers = data.get("answers", [])
        test_task = self.task.specific
        questions = getattr(test_task, "questions", [])

        # Инициализация answers, если ещё пусто
        if not self.answers or len(self.answers) != len(questions):
            self.answers = [
                {"question_index": i, "selected_option": None, "is_correct": False}
                for i in range(len(questions))
            ]

        for ans in input_answers:
            q_index = ans.get("question_index")
            selected_idx = ans.get("selected_option")
            if 0 <= q_index < len(questions):
                # Обновляем только выбранный вариант, is_correct оставляем на False до проверки
                self.answers[q_index]["selected_option"] = selected_idx

        self.answered_at = timezone.now()
        self.save()

    def mark_as_checked(self):
        """Помечает ответ как проверенный и вычисляет правильность для каждого вопроса"""
        test_task = self.task.specific
        questions = getattr(test_task, "questions", [])

        for ans in self.answers:
            q_index = ans.get("question_index")
            selected_idx = ans.get("selected_option")
            if 0 <= q_index < len(questions):
                opts = questions[q_index].get("options", [])
                ans["is_correct"] = 0 <= selected_idx < len(opts) and bool(opts[selected_idx].get("is_correct", False))
            else:
                ans["is_correct"] = False

        self.is_checked = True
        self.save()

    def get_answer_data(self):
        return {
            "answers": self.answers,
            "is_checked": self.is_checked
        }

    def delete_answers(self):
        """Удаляет все ответы пользователя для этого теста"""
        self.answers = []
        self.is_checked = False
        self.save()


class TrueFalseTaskAnswer(BaseAnswer):
    answers = models.JSONField(
        default=list)  # [{"statement_index": int, "selected_value": bool, "is_correct": bool}, ...]
    is_checked = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_truefalse_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        """
        Обновляет ответ для конкретного утверждения без сброса остальных.
        data: {"answers": [{"statement_index": int, "selected_value": bool}, ...]}
        """
        if self.is_checked:
            raise ValidationError("Ответ уже проверен и не может быть изменен")

        input_answers = data.get("answers", [])
        truefalse_task = self.task.specific
        statements = getattr(truefalse_task, "statements", [])

        if not self.answers or len(self.answers) != len(statements):
            self.answers = [
                {"statement_index": i, "selected_value": None, "is_correct": False}
                for i in range(len(statements))
            ]

        for ans in input_answers:
            idx = ans.get("statement_index")
            val = bool(ans.get("selected_value", False))
            if 0 <= idx < len(statements):
                self.answers[idx]["selected_value"] = val

        self.answered_at = timezone.now()
        self.save()

    def mark_as_checked(self):
        truefalse_task = self.task.specific
        statements = getattr(truefalse_task, "statements", [])

        for ans in self.answers:
            idx = ans.get("statement_index")
            val = ans.get("selected_value")
            if 0 <= idx < len(statements):
                ans["is_correct"] = val is bool(statements[idx].get("is_true", False))
            else:
                ans["is_correct"] = False

        self.is_checked = True
        self.save()

    def get_answer_data(self):
        return {
            "answers": self.answers,
            "is_checked": self.is_checked
        }

    def delete_answers(self):
        """Удаляет все ответы пользователя для этого задания True/False"""
        self.answers = []
        self.is_checked = False
        self.save()


class FillGapsTaskAnswer(BaseAnswer):
    answers = models.JSONField(default=dict)  # {"0": {"value": "...", "is_correct": true}, "1": {...}}

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_fillgaps_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        """Сохраняет данные ответа для задания с пропусками

        Поддерживает только формат: {"gap-0": "answer1", "gap-1": "answer2"}
        """
        current_answers = dict(self.answers or {})

        for key, value in data.items():
            match = re.match(r"^gap-(\d+)$", key)
            if match:
                gap_id = match.group(1)
                current_answers[gap_id] = {
                    "value": str(value),
                    "is_correct": None
                }

        self.answers = current_answers
        self.answered_at = timezone.now()
        self.check_correctness()
        self.save()

    def get_answer_data(self):
        """Возвращает данные ответа в нормализованном формате

        Возвращает: {"answers": {"0": {"value": "...", "is_correct": true/false/null}, ...}}
        """
        return {
            "answers": self.answers
        }

    def check_correctness(self):
        """Проверяет правильность всех ответов для задания с пропусками"""
        try:
            fill_task = self.task.specific
            if not isinstance(fill_task, FillGapsTask):
                return

            correct_answers = fill_task.answers or []
            user_answers = self.answers or {}

            for i, correct_answer in enumerate(correct_answers):
                gap_id = str(i)
                if gap_id in user_answers:
                    user_value = user_answers[gap_id].get("value", "")
                    is_correct = normalize_str(correct_answer) == normalize_str(user_value)
                    user_answers[gap_id]["is_correct"] = is_correct

            self.answers = user_answers

        except Exception:
            for gap_id in self.answers:
                self.answers[gap_id]["is_correct"] = None

    def get_correct_count(self):
        """Возвращает количество правильных ответов"""
        if not self.answers:
            return 0

        correct_count = 0
        for gap_data in self.answers.values():
            if gap_data.get("is_correct"):
                correct_count += 1
        return correct_count

    def get_total_gaps(self):
        """Возвращает общее количество пропусков в задании"""
        try:
            fill_task = self.task.specific
            if isinstance(fill_task, FillGapsTask):
                return len(fill_task.answers or [])
        except Exception:
            pass
        return 0

    def is_completed(self):
        """Проверяет, заполнены ли все пропуски"""
        total_gaps = self.get_total_gaps()
        if total_gaps == 0:
            return False

        return len(self.answers) >= total_gaps

    def delete_answers(self):
        """Удаляет все ответы пользователя для этого задания с пропусками"""
        self.answers = {}
        self.save()

    def __str__(self):
        return f"FillGapsAnswer {self.user} -> {self.task_id}"


class MatchCardsTaskAnswer(BaseAnswer):
    answers = models.JSONField(default=dict)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_matchcards_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        """Сохраняет выбранную пару карточек

        data должен быть в формате:
        {
            "selected_pair": {
                "card_left": "значение левой карточки",
                "card_right": "значение правой карточки"
            }
        }
        """
        selected_pair = data.get("selected_pair")
        if not isinstance(selected_pair, dict):
            raise ValidationError("selected_pair должен быть объектом")

        left = selected_pair.get("card_left")
        right = selected_pair.get("card_right")

        if left is None or right is None:
            raise ValidationError("В selected_pair нужны поля card_left и card_right")

        current_answers = dict(self.answers or {})
        current_answers[left] = {
            "card_right": right,
            "is_correct": None
        }

        self.answers = current_answers
        self.answered_at = timezone.now()
        self.check_correctness()
        self.save()

    def get_answer_data(self):
        """Возвращает все выбранные пары карточек с флагами правильности"""
        return {
            "answers": self.answers
        }

    def check_correctness(self):
        """Проверяет правильность всех выбранных пар карточек"""
        try:
            match_task = self.task.specific
            if not isinstance(match_task, MatchCardsTask):
                return

            user_answers = self.answers or {}

            for left_card, answer_data in user_answers.items():
                right_card = answer_data.get("card_right", "")
                is_correct = self._is_pair_correct(match_task, left_card, right_card)
                user_answers[left_card]["is_correct"] = is_correct

            self.answers = user_answers

        except Exception:
            for left_card in self.answers:
                self.answers[left_card]["is_correct"] = None

    def _is_pair_correct(self, match_task, left_card, right_card):
        """Проверяет правильность одной пары карточек"""
        left_selected = normalize_str(left_card)
        right_selected = normalize_str(right_card)

        for correct_pair in match_task.cards or []:
            left_expected = normalize_str(correct_pair.get("card_left", ""))
            right_expected = normalize_str(correct_pair.get("card_right", ""))

            if left_expected == left_selected:
                return right_expected == right_selected

        return False

    def delete_answers(self):
        """Удаляет все ответы пользователя для этого задания с карточками"""
        self.answers = {}
        self.save()

    def __str__(self):
        return f"MatchCardsAnswer {self.user} -> {self.task_id}"


class TextInputTaskAnswer(BaseAnswer):
    current_text = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_textinput_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        """Сохраняет данные ответа для текстового задания"""
        current_text = data.get("current_text", "")
        self.current_text = current_text
        self.answered_at = timezone.now()
        self.save()

    def get_answer_data(self):
        """Возвращает данные ответа в нормализованном формате"""
        return {
            "current_text": self.current_text,
        }

    def delete_answers(self):
        """Удаляет ответ пользователя для этого текстового задания"""
        self.current_text = ""
        self.save()

    def __str__(self):
        return f"TextInputAnswer {self.user} -> {self.task_id}"
