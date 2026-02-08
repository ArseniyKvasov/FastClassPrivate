import os
import json
import tempfile
from unittest.mock import Mock, patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.contrib.contenttypes.models import ContentType
from urllib.parse import urljoin
from rest_framework import serializers

from courses.models import Section, Lesson, Course, Task, TestTask, NoteTask, TrueFalseTask, FillGapsTask, \
    MatchCardsTask, TextInputTask, IntegrationTask, FileTask, WordListTask
from courses.services import TaskProcessor, get_task_effective_data


def parse_json_response(response):
    return json.loads(response.content.decode('utf-8'))


class TaskProcessorTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.course = Course.objects.create(
            title='Test Course',
            description='Test Description',
            creator=self.user
        )
        self.lesson = Lesson.objects.create(
            title='Test Lesson',
            course=self.course
        )
        self.section = Section.objects.create(
            title='Test Section',
            lesson=self.lesson,
            order=1
        )

    def test_processor_initialization(self):
        """Тест корректной инициализации TaskProcessor."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            task_id=None,
            raw_data=[]
        )
        self.assertEqual(processor.user, self.user)
        self.assertEqual(processor.section_id, self.section.id)
        self.assertEqual(processor.task_type, 'test')
        self.assertIsNone(processor.task)
        self.assertEqual(processor.raw_data, [])

    def test_processor_initialization_with_dict(self):
        """Тест инициализации TaskProcessor со словарем."""
        raw_data = {"questions": []}
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            task_id=None,
            raw_data=raw_data
        )
        self.assertEqual(processor.raw_data, raw_data)

    def test_validate_access_success(self):
        """Тест успешной проверки доступа к разделу."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test'
        )
        processor._validate_access()
        self.assertEqual(processor.section, self.section)

    def test_validate_access_section_not_found(self):
        """Тест ошибки при отсутствии раздела."""
        processor = TaskProcessor(
            user=self.user,
            section_id=9999,
            task_type='test'
        )
        with self.assertRaises(ValueError):
            processor._validate_access()

    def test_validate_access_permission_denied(self):
        """Тест ошибки при отсутствии прав доступа у пользователя."""
        User = get_user_model()
        other_user = User.objects.create_user(
            username='otheruser',
            password='testpass123'
        )
        processor = TaskProcessor(
            user=other_user,
            section_id=self.section.id,
            task_type='test'
        )
        with self.assertRaises(PermissionError):
            processor._validate_access()

    def test_get_serializer_class_success(self):
        """Тест получения корректного сериализатора для типа задачи."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test'
        )
        from courses.serializers import TestTaskSerializer
        serializer_class = processor._get_serializer_class()
        self.assertEqual(serializer_class, TestTaskSerializer)

    def test_get_serializer_class_unknown_type(self):
        """Тест ошибки при неизвестном типе задачи."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='unknown_type'
        )
        with self.assertRaises(ValueError):
            processor._get_serializer_class()

    def test_normalize_data_for_list_test_data(self):
        """Тест нормализации данных списка для тестового типа задачи."""
        raw_data = [{"question": "Question 1?", "options": ["Option 1", "Option 2"], "is_correct": False}]
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            raw_data=raw_data
        )
        result = processor._normalize_data()
        self.assertIsInstance(result, dict)
        self.assertIn('questions', result)

    def test_normalize_data_for_empty_list(self):
        """Тест нормализации пустого списка."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            raw_data=[]
        )
        result = processor._normalize_data()
        self.assertEqual(result, {'questions': []})

    def test_normalize_data_for_dict(self):
        """Тест нормализации данных словаря для тестового типа задачи."""
        raw_data = {"questions": []}
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            raw_data=raw_data
        )
        result = processor._normalize_data()
        self.assertEqual(result, {"questions": []})

    def test_process_test_data_converts_string_options(self):
        """Тест преобразования строковых вариантов ответов в объекты."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test'
        )
        test_data = {
            "questions": [
                {
                    "question": "Test question?",
                    "options": ["Option 1", "Option 2"]
                }
            ]
        }
        result = processor._process_test_data(test_data)
        self.assertIsInstance(result['questions'][0]['options'][0], dict)
        self.assertEqual(result['questions'][0]['options'][0]['option'], 'Option 1')

    def test_process_test_data_converts_true_false_statements(self):
        """Тест преобразования утверждений для задач true/false."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='true_false'
        )
        test_data = {
            "statements": ["Statement 1", "Statement 2"]
        }
        result = processor._process_test_data(test_data)
        self.assertIsInstance(result['statements'][0], dict)
        self.assertEqual(result['statements'][0]['statement'], 'Statement 1')

    def test_process_file_if_needed_with_valid_file(self):
        """Тест обработки файла для задач типа file."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='file'
        )
        test_file = SimpleUploadedFile(
            "test.pdf",
            b"test content",
            content_type="application/pdf"
        )
        test_data = {"file": test_file}

        with patch.object(processor, '_save_file', return_value='/media/tasks/files/test.pdf'):
            result = processor._process_file_if_needed(test_data)
            self.assertIn('file_path', result)
            self.assertIn('file', result)

    def test_process_file_if_needed_without_file(self):
        """Тест ошибки при отсутствии файла для задач типа file."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='file'
        )
        test_data = {}
        with self.assertRaises(ValueError):
            processor._process_file_if_needed(test_data)

    def test_process_file_if_needed_wrong_task_type(self):
        """Тест пропуска обработки файла для других типов задач."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test'
        )
        test_data = {"key": "value"}
        result = processor._process_file_if_needed(test_data)
        self.assertEqual(result, test_data)

    def test_create_new_task_success(self):
        """Тест успешного создания новой задачи."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note'
        )
        processor._validate_access()
        validated_data = {"content": "Test note content"}

        task_count_before = Task.objects.count()
        note_task_count_before = NoteTask.objects.count()

        result = processor._create_new_task(validated_data)

        task_count_after = Task.objects.count()
        note_task_count_after = NoteTask.objects.count()

        self.assertEqual(task_count_after, task_count_before + 1)
        self.assertEqual(note_task_count_after, note_task_count_before + 1)
        self.assertIsInstance(result, NoteTask)
        self.assertEqual(processor.task.section, self.section)
        self.assertEqual(processor.task.task_type, 'note')

    def test_update_existing_task_original_root(self):
        """Тест обновления задачи с root_type 'original'."""
        create_processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            raw_data=[{"content": "Original content"}]
        )
        create_response = create_processor.process()
        response_data = parse_json_response(create_response)
        task_id = response_data['task_id']

        task = Task.objects.get(id=task_id)

        update_processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            task_id=task_id,
            raw_data=[{"content": "Updated content"}]
        )
        update_processor.task = task

        validated_data = {"content": "Updated content"}

        update_processor._update_existing_task(validated_data)

        task.refresh_from_db()
        if task.root_type == 'original' and hasattr(task, 'specific'):
            specific_obj = task.specific
            specific_obj.refresh_from_db()
            self.assertEqual(specific_obj.content, "Updated content")

    def test_update_existing_task_copy_root(self):
        """Тест обновления задачи с root_type 'copy'."""
        note_task = NoteTask.objects.create(content="Original note")
        content_type = ContentType.objects.get_for_model(NoteTask)

        task = Task.objects.create(
            section=self.section,
            task_type='note',
            root_type='copy',
            content_type=content_type,
            object_id=note_task.id,
            edited_content={"content": "Original edited content"}
        )

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            task_id=task.id
        )
        processor.task = task
        validated_data = {"content": "Updated edited content"}

        result = processor._update_existing_task(validated_data)

        task.refresh_from_db()
        self.assertEqual(task.edited_content, {"content": "Updated edited content"})

    def test_process_create_test_task(self):
        """Тест полного процесса создания тестовой задачи."""
        test_data = [
            {
                "question": "What is 2+2?",
                "options": [
                    {"option": "3", "is_correct": False},
                    {"option": "4", "is_correct": True},
                    {"option": "5", "is_correct": False}
                ]
            }
        ]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])
        self.assertIn('task_id', response_data)
        self.assertEqual(response_data['task_type'], 'test')

        task = Task.objects.get(id=response_data['task_id'])
        self.assertEqual(task.task_type, 'test')
        self.assertEqual(task.section, self.section)

    def test_process_create_test_task_with_dict(self):
        """Тест создания тестовой задачи со словарем."""
        test_data = {
            "questions": [
                {
                    "question": "What is 2+2?",
                    "options": [
                        {"option": "3", "is_correct": False},
                        {"option": "4", "is_correct": True},
                        {"option": "5", "is_correct": False}
                    ]
                }
            ]
        }

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

    def test_process_create_note_task(self):
        """Тест полного процесса создания задачи-заметки."""
        test_data = [{"content": "Test note content"}]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

        task = Task.objects.get(id=response_data['task_id'])
        self.assertEqual(task.task_type, 'note')

    def test_process_create_true_false_task(self):
        """Тест полного процесса создания задачи true/false."""
        test_data = [
            {"statement": "The sky is blue", "is_true": True},
            {"statement": "Water is dry", "is_true": False}
        ]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='true_false',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

    def test_process_create_fill_gaps_task(self):
        """Тест полного процесса создания задачи на заполнение пропусков."""
        test_data = [{
            "text": "The [capital] of France is [Paris].",
            "list_type": "open"
        }]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='fill_gaps',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

    def test_process_create_match_cards_task(self):
        """Тест полного процесса создания задачи на сопоставление карточек."""
        test_data = [{
            "cards": [
                {"card_left": "Dog", "card_right": "Perro"},
                {"card_left": "Cat", "card_right": "Gato"}
            ]
        }]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='match_cards',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

    def test_process_create_text_input_task(self):
        """Тест полного процесса создания задачи на ввод текста."""
        test_data = [{
            "prompt": "Write a short essay about your favorite book.",
            "default_text": ""
        }]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='text_input',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

    def test_process_create_integration_task(self):
        """Тест полного процесса создания интеграционной задачи."""
        test_data = [{
            "embed_code": '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" frameborder="0"></iframe>'
        }]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='integration',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

    def test_process_create_word_list_task(self):
        """Тест полного процесса создания задачи со списком слов."""
        test_data = [{
            "words": [
                {"word": "Hello", "translation": "Hola"},
                {"word": "Goodbye", "translation": "Adiós"}
            ]
        }]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='word_list',
            raw_data=test_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

    def test_process_update_task(self):
        """Тест полного процесса обновления существующей задачи."""
        create_processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            raw_data=[{"content": "Original content"}]
        )
        create_response = create_processor.process()
        create_data = parse_json_response(create_response)
        task_id = create_data['task_id']

        update_data = [{"content": "Updated content"}]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            task_id=task_id,
            raw_data=update_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

        task = Task.objects.get(id=task_id)
        if task.root_type == 'original' and hasattr(task, 'specific'):
            specific_obj = task.specific
            self.assertEqual(specific_obj.content, "Updated content")
        elif task.root_type == 'copy' and task.edited_content:
            self.assertEqual(task.edited_content.get('content'), "Updated content")

    def test_process_update_copy_task(self):
        """Тест полного процесса обновления копии задачи."""
        note_task = NoteTask.objects.create(content="Original note")
        content_type = ContentType.objects.get_for_model(NoteTask)

        task = Task.objects.create(
            section=self.section,
            task_type='note',
            root_type='copy',
            content_type=content_type,
            object_id=note_task.id,
            edited_content={"content": "Original"}
        )

        update_data = [{"content": "Updated copy"}]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            task_id=task.id,
            raw_data=update_data
        )

        response = processor.process()

        self.assertEqual(response.status_code, 200)
        response_data = parse_json_response(response)
        self.assertTrue(response_data['success'])

        task.refresh_from_db()
        self.assertEqual(task.edited_content, {"content": "Updated copy"})

    def test_process_validation_error(self):
        """Тест обработки ошибок валидации при создании задачи."""
        test_data = []

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            raw_data=test_data
        )

        response = processor.process()
        self.assertEqual(response.status_code, 400)

    def test_process_validation_error_with_empty_test(self):
        """Тест ошибки валидации при пустом тесте."""
        test_data = [{"question": "", "options": []}]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            raw_data=test_data
        )

        response = processor.process()
        self.assertEqual(response.status_code, 400)

    def test_process_permission_error(self):
        """Тест обработки ошибки прав доступа при создании задачи."""
        User = get_user_model()
        other_user = User.objects.create_user(
            username='otheruser',
            password='testpass123'
        )

        processor = TaskProcessor(
            user=other_user,
            section_id=self.section.id,
            task_type='test',
            raw_data=[]
        )

        response = processor.process()
        self.assertEqual(response.status_code, 400)

    def test_process_general_exception(self):
        """Тест обработки общих исключений при создании задачи."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='test',
            raw_data=[]
        )

        with patch.object(processor, '_validate_access', side_effect=Exception('Test error')):
            response = processor.process()
            self.assertEqual(response.status_code, 500)

    def test_get_task_effective_data_original_task(self):
        """Тест сериализации данных для оригинальной задачи."""
        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            raw_data=[{"content": "Test content"}]
        )
        response = processor.process()
        response_data = parse_json_response(response)
        task_id = response_data['task_id']

        task = Task.objects.get(id=task_id)
        result = get_task_effective_data(task)
        self.assertEqual(result['content'], "Test content")

    def test_get_task_effective_data_copy_task(self):
        """Тест сериализации данных для копии задачи."""
        note_task = NoteTask.objects.create(content="Original note")
        content_type = ContentType.objects.get_for_model(NoteTask)

        task = Task.objects.create(
            section=self.section,
            task_type='note',
            root_type='copy',
            content_type=content_type,
            object_id=note_task.id,
            edited_content={"content": "Edited content"}
        )

        result = get_task_effective_data(task)
        self.assertEqual(result['content'], "Edited content")

    def test_get_task_effective_data_unknown_type(self):
        """Тест сериализации данных для неизвестного типа задачи."""
        note_task = NoteTask.objects.create(content="Test")
        content_type = ContentType.objects.get_for_model(NoteTask)

        task = Task.objects.create(
            section=self.section,
            task_type='unknown_type',
            root_type='original',
            content_type=content_type,
            object_id=note_task.id
        )

        result = get_task_effective_data(task)
        self.assertEqual(result, {})

    def test_task_belongs_to_different_section(self):
        """Тест ошибки при обновлении задачи из другого раздела."""
        other_section = Section.objects.create(
            title='Other Section',
            lesson=self.lesson,
            order=2
        )

        processor_create = TaskProcessor(
            user=self.user,
            section_id=other_section.id,
            task_type='note',
            raw_data=[{"content": "Test content"}]
        )
        create_response = processor_create.process()
        create_data = parse_json_response(create_response)
        task_id = create_data['task_id']

        update_data = [{"content": "Updated content"}]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='note',
            task_id=task_id,
            raw_data=update_data
        )

        response = processor.process()
        self.assertEqual(response.status_code, 400)

    def test_create_task_with_file_upload(self):
        """Тест создания задачи с загрузкой файла."""
        test_file = SimpleUploadedFile(
            "test.pdf",
            b"test content",
            content_type="application/pdf"
        )

        test_data = [{"file": test_file}]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='file',
            raw_data=test_data
        )

        with patch.object(processor, '_save_file', return_value='/media/tasks/files/test.pdf'):
            response = processor.process()
            response_data = parse_json_response(response)
            self.assertTrue(response_data['success'])

    def test_update_task_with_new_file(self):
        """Тест обновления файловой задачи с новым файлом."""
        test_file1 = SimpleUploadedFile(
            "old.pdf",
            b"old content",
            content_type="application/pdf"
        )

        processor1 = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='file',
            raw_data=[{"file": test_file1}]
        )

        with patch.object(processor1, '_save_file', return_value='/media/tasks/files/old.pdf'):
            response1 = processor1.process()
            data1 = parse_json_response(response1)
            self.assertTrue('task_id' in data1)
            task_id = data1['task_id']

        test_file2 = SimpleUploadedFile(
            "new.pdf",
            b"new content",
            content_type="application/pdf"
        )

        update_data = [{"file": test_file2}]

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='file',
            task_id=task_id,
            raw_data=update_data
        )

        with patch.object(processor, '_save_file', return_value='/media/tasks/files/new.pdf'):
            response = processor.process()
            response_data = parse_json_response(response)
            self.assertTrue(response_data['success'])

    def test_create_task_with_file_upload_dict_format(self):
        """Тест создания файловой задачи с форматом словаря."""
        test_file = SimpleUploadedFile(
            "test.pdf",
            b"test content",
            content_type="application/pdf"
        )

        test_data = {"file": test_file}

        processor = TaskProcessor(
            user=self.user,
            section_id=self.section.id,
            task_type='file',
            raw_data=test_data
        )

        with patch.object(processor, '_save_file', return_value='/media/tasks/files/test.pdf'):
            response = processor.process()
            response_data = parse_json_response(response)
            self.assertTrue(response_data['success'])