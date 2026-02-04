import os
import uuid
from datetime import datetime
from urllib.parse import urljoin

from django.contrib.contenttypes.models import ContentType
from django.core.files.storage import default_storage
from django.http import JsonResponse
from rest_framework import serializers

from courses.models import Section, Task, TASK_MODEL_MAP
from courses.serializers import SERIALIZER_MAP
from fastlesson import settings


class TaskProcessor:
    """
    Единый обработчик создания/обновления задач.
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
        if self.task_type in ['test', 'true_false']:
            return self.raw_data

        if isinstance(self.raw_data, list):
            return self.raw_data[0] if self.raw_data else {}
        return self.raw_data

    def _process_file_if_needed(self, data):
        if self.task_type != 'file':
            return data

        file_obj = data.get('file')
        if not file_obj:
            raise ValueError("Файл не загружен")

        try:
            file_path = self._save_file(file_obj)
            data['file_path'] = file_path
            del data['file']
        except Exception as e:
            raise ValueError(f"Ошибка сохранения файла: {str(e)}")

        return data

    def _save_file(self, file_obj):
        ext = os.path.splitext(file_obj.name)[1]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"tasks/files/{uuid.uuid4().hex}_{timestamp}{ext}"

        saved_path = default_storage.save(file_name, file_obj)
        return urljoin(settings.MEDIA_URL, saved_path)

    def _create_new_task(self, validated_data):
        ModelClass = TASK_MODEL_MAP.get(self.task_type)
        if not ModelClass:
            raise ValueError(f"Неизвестная модель для типа {self.task_type}")

        specific_obj = ModelClass.objects.create(**validated_data)

        self.task = Task.objects.create(
            section=self.section,
            task_type=self.task_type,
            root_type="original",
            content_type=ContentType.objects.get_for_model(specific_obj),
            object_id=specific_obj.id,
            edited_content={},
        )

        return specific_obj

    def _update_existing_task(self, validated_data):
        if self.task.root_type == 'copy':
            self.task.edited_content = validated_data
            self.task.save(update_fields=['edited_content'])
            return None

        specific_obj = self.task.specific
        if specific_obj:
            for key, value in validated_data.items():
                setattr(specific_obj, key, value)
            specific_obj.save()
            return specific_obj

        return None

    def process(self):
        try:
            self._validate_access()

            SerializerClass = self._get_serializer_class()

            if self.task_id:
                self.task = Task.objects.select_related('specific').get(id=self.task_id)
                if self.task.section_id != self.section_id:
                    raise ValueError("Задача не принадлежит указанному разделу")

            data = self._normalize_data()
            if self.task_type == 'file':
                data = self._process_file_if_needed(data)

            if self.task and hasattr(self.task, 'specific'):
                serializer = SerializerClass(self.task.specific, data=data, partial=True)
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

        except (ValueError, PermissionError, serializers.ValidationError) as e:
            return JsonResponse({
                "success": False,
                "errors": str(e)
            }, status=400)
        except Exception as e:
            return JsonResponse({
                "success": False,
                "errors": "Внутренняя ошибка сервера"
            }, status=500)


def serialize_task_data(task: Task):
    """
    Сериализация данных задачи.
    """
    SerializerClass = SERIALIZER_MAP.get(task.task_type)
    if not SerializerClass:
        return {}

    if task.root_type == 'copy' and task.edited_content:
        data = task.edited_content
    else:
        data = task.specific

    serializer = SerializerClass(data)
    return serializer.data