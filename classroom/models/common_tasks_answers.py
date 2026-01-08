import re
import time
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from .base import BaseAnswer
from courses.models import TestTask, TrueFalseTask, FillGapsTask, MatchCardsTask, TextInputTask
from classroom.utils import normalize_str


class TestTaskAnswer(BaseAnswer):
    answers = models.JSONField(default=list)
    is_checked = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_test_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        if self.is_checked:
            raise ValidationError("Ответ уже проверен и не может быть изменен")

        input_answers = data.get("answers", [])
        test_task = self.task.specific
        questions = getattr(test_task, "questions", [])

        if not self.answers or len(self.answers) != len(questions):
            self.answers = [
                {"question_index": i, "selected_option": None, "is_correct": False}
                for i in range(len(questions))
            ]

        for ans in input_answers:
            q_index = ans.get("question_index")
            selected_idx = ans.get("selected_option")
            if 0 <= q_index < len(questions):
                self.answers[q_index]["selected_option"] = selected_idx

        self.total_answers = self.get_task_total_answers()
        self.answered_at = timezone.now()
        self.save()

    def mark_as_checked(self):
        if self.is_checked:
            return
        self.is_checked = True
        self.correct_answers = 0
        self.wrong_answers = 0

        test_task = self.task.specific
        questions = getattr(test_task, "questions", [])

        for i, answer_data in enumerate(self.answers):
            selected_idx = answer_data.get("selected_option")
            opts = questions[i].get("options", [])
            is_correct = (0 <= selected_idx < len(opts) and bool(opts[selected_idx].get("is_correct", False)))
            answer_data["is_correct"] = is_correct
            if is_correct:
                self.correct_answers += 1
            else:
                self.wrong_answers += 1

        self.save()

    def get_answer_data(self):
        return {
            "answers": self.answers,
            "is_checked": self.is_checked
        }

    def delete_answers(self):
        self.answers = []
        self.is_checked = False
        self.correct_answers = 0
        self.wrong_answers = 0
        self.save()


class TrueFalseTaskAnswer(BaseAnswer):
    answers = models.JSONField(default=list)
    is_checked = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_truefalse_answer_per_user_task")
        ]

    def save_answer_data(self, data):
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

        self.total_answers = self.get_task_total_answers()
        self.answered_at = timezone.now()
        self.save()

    def mark_as_checked(self):
        if self.is_checked:
            return
        self.is_checked = True
        self.correct_answers = 0
        self.wrong_answers = 0

        truefalse_task = self.task.specific
        statements = getattr(truefalse_task, "statements", [])

        for i, answer_data in enumerate(self.answers):
            selected_value = answer_data.get("selected_value")
            correct_value = bool(statements[i].get("is_true", False))
            is_correct = selected_value is correct_value
            answer_data["is_correct"] = is_correct
            if is_correct:
                self.correct_answers += 1
            else:
                self.wrong_answers += 1

        self.save()

    def get_answer_data(self):
        return {
            "answers": self.answers,
            "is_checked": self.is_checked
        }

    def delete_answers(self):
        self.answers = []
        self.is_checked = False
        self.correct_answers = 0
        self.wrong_answers = 0
        self.save()


class FillGapsTaskAnswer(BaseAnswer):
    answers = models.JSONField(default=dict)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_fillgaps_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        current_answers = dict(self.answers or {})

        for key, value in data.items():
            match = re.match(r"^gap-(\d+)$", key)
            if match:
                gap_id = match.group(1)
                user_value = str(value)

                old_answer = current_answers.get(gap_id, {}).get("value")
                if old_answer != user_value:
                    current_answers[gap_id] = {
                        "value": user_value,
                        "is_correct": None
                    }
                    self._check_and_update_single_gap(gap_id, current_answers)

        self.total_answers = self.get_task_total_answers()
        self.answers = current_answers
        self.answered_at = timezone.now()
        self.save()

    def _check_and_update_single_gap(self, gap_id, answers_dict):
        try:
            fill_task = self.task.specific
            if not isinstance(fill_task, FillGapsTask):
                return

            correct_answers = fill_task.answers or []
            gap_index = int(gap_id)

            if 0 <= gap_index < len(correct_answers):
                user_value = answers_dict[gap_id].get("value", "")
                correct_value = correct_answers[gap_index]
                is_correct = normalize_str(correct_value) == normalize_str(user_value)

                old_correct_status = answers_dict[gap_id].get("is_correct")
                if old_correct_status != is_correct:
                    answers_dict[gap_id]["is_correct"] = is_correct
                    if is_correct:
                        self.increment_correct_answers()
                    else:
                        self.increment_wrong_answers()

        except Exception:
            answers_dict[gap_id]["is_correct"] = None

    def get_answer_data(self):
        return {
            "answers": self.answers
        }

    def get_correct_count(self):
        return self.correct_answers

    def get_total_gaps(self):
        return self.get_task_total_answers()

    def is_completed(self):
        total_gaps = self.get_total_gaps()
        if total_gaps == 0:
            return False
        return len(self.answers) >= total_gaps

    def delete_answers(self):
        self.answers = {}
        self.correct_answers = 0
        self.wrong_answers = 0
        self.save()


class MatchCardsTaskAnswer(BaseAnswer):
    answers = models.JSONField(default=dict)
    last_pair = models.JSONField(null=True, blank=True)
    last_pair_timestamp = models.FloatField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_matchcards_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        selected_pair = data.get("selected_pair")
        if not isinstance(selected_pair, dict):
            raise ValidationError("selected_pair должен быть объектом")

        left = selected_pair.get("card_left")
        right = selected_pair.get("card_right")

        if left is None or right is None:
            raise ValidationError("В selected_pair нужны поля card_left и card_right")

        current_answers = dict(self.answers or {})

        old_right = current_answers.get(left, {}).get("card_right")
        if old_right != right:
            self.last_pair = {
                "card_left": left,
                "card_right": right
            }
            self.last_pair_timestamp = time.time()

            current_answers[left] = {
                "card_right": right,
                "is_correct": None
            }

            self._check_and_update_single_pair(left, current_answers)

        self.total_answers = self.get_task_total_answers()
        self.answers = current_answers
        self.answered_at = timezone.now()
        self.save()

    def _check_and_update_single_pair(self, left_card, answers_dict):
        try:
            match_task = self.task.specific
            if not isinstance(match_task, MatchCardsTask):
                return

            answer_data = answers_dict[left_card]
            right_card = answer_data.get("card_right", "")
            is_correct = self._is_pair_correct(match_task, left_card, right_card)

            old_correct_status = answer_data.get("is_correct")
            if old_correct_status != is_correct:
                answer_data["is_correct"] = is_correct
                if is_correct:
                    self.increment_correct_answers()
                else:
                    self.increment_wrong_answers()

        except Exception:
            answers_dict[left_card]["is_correct"] = None

    def get_answer_data(self):
        response_data = {
            "answers": self.answers
        }

        current_time = time.time()
        if (self.last_pair and self.last_pair_timestamp and
                current_time - self.last_pair_timestamp <= 1.2):

            last_left = self.last_pair.get("card_left")
            if last_left and last_left in self.answers:
                answer_data = self.answers[last_left]
                if answer_data.get("is_correct") is False:
                    response_data["last_pair"] = self.last_pair

        return response_data

    def _is_pair_correct(self, match_task, left_card, right_card):
        left_selected = normalize_str(left_card)
        right_selected = normalize_str(right_card)

        for correct_pair in match_task.cards or []:
            left_expected = normalize_str(correct_pair.get("card_left", ""))
            right_expected = normalize_str(correct_pair.get("card_right", ""))

            if left_expected == left_selected:
                return right_expected == right_selected

        return False

    def delete_answers(self):
        self.answers = {}
        self.last_pair = None
        self.last_pair_timestamp = None
        self.correct_answers = 0
        self.wrong_answers = 0
        self.save()


class TextInputTaskAnswer(BaseAnswer):
    current_text = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_textinput_answer_per_user_task")
        ]

    def save_answer_data(self, data):
        current_text = data.get("current_text", "")
        self.current_text = current_text
        self.answered_at = timezone.now()
        self.save()

    def get_answer_data(self):
        return {
            "current_text": self.current_text,
        }

    def delete_answers(self):
        self.current_text = ""
        self.save()

    def __str__(self):
        return f"TextInputAnswer {self.user} -> {self.task_id}"
