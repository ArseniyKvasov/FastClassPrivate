import os
import uuid
from datetime import datetime

from django.contrib.contenttypes.models import ContentType
from django.core.files.storage import default_storage
from django.http import JsonResponse
from rest_framework import serializers

from courses.models import Section, Task, TASK_MODEL_MAP
from courses.serializers import SERIALIZER_MAP
from fastlesson import settings


class TaskProcessor:
    """
    Сервис для создания и редактирования задач в курсах.

    Единый обработчик всех операций CRUD для задач любого типа:
    - Создание новых задач (original)
    - Редактирование существующих задач (original)
    - Редактирование копий задач (copy -> original)

    Логика работы:
    1. Создание задачи:
       - Создается specific объект (NoteTask, TestTask, FileTask и т.д.)
       - Создается Task с root_type="original", ссылающийся на specific

    2. Редактирование оригинальной задачи:
       - Обновляется существующий specific объект
       - Для FileTask: старый файл удаляется, новый сохраняется

    3. Редактирование копии задачи:
       - Проверяется наличие изменений
       - Создается НОВЫЙ specific объект с обновленными данными
       - Для FileTask: создается новый файл, старый НЕ удаляется
       - Task переключается на новый specific
       - root_type меняется на "original"
       - linked_to сбрасывается (отвязка от клона)

    4. Удаление задачи:
       - При root_type="original" или "clone": удаляется specific объект и файл
       - При root_type="copy": удаляется только Task, specific остается
    """

    def __init__(self, user, section_id, task_type, task_id=None, raw_data=None):
        self.user = user
        self.section_id = section_id
        self.task_type = task_type
        self.task_id = task_id
        self.raw_data = raw_data or []
        self.section = None
        self.task = None

    def _validate_access(self):
        try:
            self.section = Section.objects.select_related('lesson__course').get(pk=self.section_id)
        except Section.DoesNotExist:
            raise ValueError("Раздел не найден")

        course = self.section.lesson.course
        if not course or course.creator != self.user:
            raise PermissionError("Только создатель курса может редактировать задания")

    def _get_serializer_class(self):
        if self.task_type not in SERIALIZER_MAP:
            raise ValueError(f"Неизвестный тип задания: {self.task_type}")
        return SERIALIZER_MAP[self.task_type]

    def _normalize_data(self):
        if isinstance(self.raw_data, list):
            if not self.raw_data:
                if self.task_type in ['test', 'true_false']:
                    if self.task_type == 'test':
                        return {'questions': []}
                    elif self.task_type == 'true_false':
                        return {'statements': []}
                return {}

            if self.task_type in ['test', 'true_false']:
                if self.task_type == 'test':
                    return {'questions': self.raw_data}
                elif self.task_type == 'true_false':
                    return {'statements': self.raw_data}

            if isinstance(self.raw_data[0], dict):
                return self.raw_data[0]
            return {}

        if isinstance(self.raw_data, dict):
            return self.raw_data

        return {}

    def _process_test_data(self, data):
        if not isinstance(data, dict):
            return data

        if self.task_type == 'test':
            questions = data.get('questions', [])
            if isinstance(questions, list):
                for question in questions:
                    if isinstance(question, dict):
                        options = question.get('options', [])
                        if options and isinstance(options[0], str):
                            question['options'] = [
                                {'option': opt, 'is_correct': False}
                                for opt in options
                            ]
        elif self.task_type == 'true_false':
            statements = data.get('statements', [])
            if isinstance(statements, list) and statements and isinstance(statements[0], str):
                data['statements'] = [
                    {'statement': stmt, 'is_true': False}
                    for stmt in statements
                ]

        return data

    def _process_file_if_needed(self, data):
        if self.task_type != 'file':
            return data

        if not isinstance(data, dict):
            raise ValueError("Данные должны быть словарем для типа 'file'")

        file_obj = data.get('file')
        if not file_obj:
            raise ValueError("Файл не загружен")

        data['file'] = file_obj
        return data

    def _save_file(self, file_obj):
        ext = os.path.splitext(file_obj.name)[1]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{uuid.uuid4().hex}_{timestamp}{ext}"
        file_path = f"tasks/files/{filename}"

        saved_path = default_storage.save(file_path, file_obj)
        print(saved_path)

        if os.path.sep in saved_path:
            saved_path = os.path.basename(saved_path)

        return f"tasks/files/{saved_path}"

    def _create_new_task(self, validated_data):
        ModelClass = TASK_MODEL_MAP.get(self.task_type)
        if not ModelClass:
            raise ValueError(f"Неизвестная модель для типа {self.task_type}")

        if self.task_type == 'file':
            file_obj = validated_data.pop('file', None)
            file_path = self._save_file(file_obj)
            specific_obj = ModelClass.objects.create(file=file_path)
        else:
            specific_obj = ModelClass.objects.create(**validated_data)

        self.task = Task.objects.create(
            section=self.section,
            task_type=self.task_type,
            root_type="original",
            content_type=ContentType.objects.get_for_model(specific_obj),
            object_id=specific_obj.id,
        )

        return specific_obj

    def _update_existing_task(self, validated_data):
        if self.task.root_type == 'copy':
            has_changes = self._has_changes(validated_data)
            if not has_changes:
                return None

            ModelClass = TASK_MODEL_MAP.get(self.task_type)

            if self.task_type == 'file':
                file_obj = validated_data.pop('file', None)
                if file_obj:
                    file_path = self._save_file(file_obj)
                    validated_data['file'] = file_path
                specific_obj = ModelClass.objects.create(**validated_data)
            else:
                specific_obj = ModelClass.objects.create(**validated_data)

            self.task.content_type = ContentType.objects.get_for_model(specific_obj)
            self.task.object_id = specific_obj.id
            self.task.root_type = 'original'
            self.task.linked_to = None

            self.task.save(update_fields=['content_type', 'object_id', 'root_type', 'linked_to'])

            self.task.refresh_from_db()

            return specific_obj

        specific_obj = self.task.specific
        if specific_obj:
            if self.task_type == 'file':
                file_obj = validated_data.pop('file', None)
                if file_obj:
                    if specific_obj.file:
                        specific_obj.file.delete(save=False)
                    file_path = self._save_file(file_obj)
                    validated_data['file'] = file_path

            for key, value in validated_data.items():
                setattr(specific_obj, key, value)
            specific_obj.save()
            return specific_obj

        return None

    def _has_changes(self, new_data):
        if not self.task.specific:
            return True

        current_data = self.task.get_serialized_data()
        return current_data != new_data

    def process(self):
        try:
            self._validate_access()
            SerializerClass = self._get_serializer_class()

            if self.task_id:
                self.task = Task.objects.get(id=self.task_id)
                if str(self.task.section_id) != str(self.section_id):
                    raise ValueError("Задача не принадлежит указанному разделу")

            data = self._normalize_data()
            data = self._process_test_data(data)
            data = self._process_file_if_needed(data)

            if self.task:
                specific_obj = self.task.specific
                if specific_obj:
                    serializer = SerializerClass(specific_obj, data=data, partial=True)
                else:
                    serializer = SerializerClass(data=data)
            else:
                serializer = SerializerClass(data=data)

            serializer.is_valid(raise_exception=True)
            validated_data = serializer.validated_data

            if self.task:
                result = self._update_existing_task(validated_data)
            else:
                result = self._create_new_task(validated_data)

            return JsonResponse({
                "success": True,
                "task_id": str(self.task.id),
                "task_type": self.task.task_type,
                "data": self.task.get_serialized_data(),
            })

        except serializers.ValidationError as e:
            errors = {}
            for field, error_list in e.detail.items():
                if isinstance(error_list, list):
                    errors[field] = [str(error) for error in error_list]
                else:
                    errors[field] = [str(error_list)]

            return JsonResponse({
                "success": False,
                "errors": errors
            }, status=400)

        except (ValueError, PermissionError) as e:
            return JsonResponse({
                "success": False,
                "errors": {"general": [str(e)]}
            }, status=400)

        except Exception as e:
            print(e)
            return JsonResponse({
                "success": False,
                "errors": {"general": ["Внутренняя ошибка сервера"]}
            }, status=500)