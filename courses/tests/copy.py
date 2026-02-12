"""
Тесты для функционала копирования курсов.
"""
import os
import shutil
from django.conf import settings
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.models import ContentType
from courses.models import Course, Lesson, Section, Task, NoteTask, FileTask
from courses.services import CloneService
from courses.services import CopyService

User = get_user_model()


class CopyCourseTests(TestCase):
    """
    Тесты копирования курсов.
    """

    def setUp(self):
        """
        Настройка тестовых данных.
        """
        self.user = User.objects.create_user(username='teacher', password='testpass')
        self.admin = User.objects.create_user(username='admin', password='testpass', is_staff=True)
        self.student = User.objects.create_user(username='student', password='testpass')

        self.media_test_dir = os.path.join(settings.MEDIA_ROOT, 'test_files')
        os.makedirs(self.media_test_dir, exist_ok=True)

        self.test_file_path = os.path.join(self.media_test_dir, 'test_image.jpg')
        with open(self.test_file_path, 'wb') as f:
            f.write(b'test image content')

    def tearDown(self):
        """
        Очистка тестовых данных.
        """
        if os.path.exists(self.media_test_dir):
            shutil.rmtree(self.media_test_dir)

    def test_copy_course_is_not_public(self):
        """
        Проверяет, что при копировании создается курс с is_public=False.
        Ожидается создание приватной копии курса.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс',
            is_public=True
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        self.assertEqual(copy_course.root_type, 'copy')
        self.assertEqual(copy_course.is_public, False)
        self.assertEqual(copy_course.creator, self.student)
        self.assertEqual(copy_course.linked_to, clone_course)

    def test_cannot_copy_original_course(self):
        """
        Проверяет, что нельзя скопировать оригинальный курс.
        Ожидается исключение ValidationError.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        with self.assertRaises(ValidationError):
            CopyService.create_copy_for_user(original_course, self.student)

    def test_cannot_copy_copy_course(self):
        """
        Проверяет, что нельзя скопировать копию курса.
        Ожидается исключение ValidationError.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        clone_course = CloneService.create_clone(original_course, self.admin)
        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        student2 = User.objects.create_user(username='student2', password='testpass')

        with self.assertRaises(ValidationError):
            CopyService.create_copy_for_user(copy_course, student2)

    def test_all_content_copied_correctly(self):
        """
        Проверяет, что все уроки, разделы и задания корректно создаются при копировании.
        Ожидается полная копия структуры курса.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        lesson = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок',
            order=1
        )

        section = Section.objects.create(
            lesson=lesson,
            root_type='original',
            title='Секция',
            order=1
        )

        note_task = NoteTask.objects.create(content='Тестовая заметка')
        note_task_id = note_task.id

        original_task = Task.objects.create(
            section=section,
            root_type='original',
            task_type='note',
            content_type=ContentType.objects.get_for_model(NoteTask),
            object_id=note_task.id,
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        clone_task = clone_course.lessons.first().sections.first().tasks.first()
        clone_specific = clone_task.specific
        clone_specific_id = clone_specific.id

        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        copy_lessons = copy_course.lessons.all()
        self.assertEqual(copy_lessons.count(), 1)

        copy_sections = copy_lessons[0].sections.all()
        self.assertEqual(copy_sections.count(), 1)

        copy_tasks = copy_sections[0].tasks.all()
        self.assertEqual(copy_tasks.count(), 1)

        copy_task = copy_tasks[0]

        self.assertEqual(copy_task.task_type, 'note')
        self.assertEqual(copy_task.root_type, 'copy')
        self.assertIsNotNone(copy_task.linked_to)

        self.assertEqual(copy_task.linked_to_id, clone_task.id)

        copied_note = copy_task.specific
        self.assertIsNotNone(copied_note)
        self.assertIsInstance(copied_note, NoteTask)
        self.assertEqual(copied_note.content, 'Тестовая заметка')

        self.assertEqual(copied_note.id, clone_specific_id)

        self.assertNotEqual(copied_note.id, note_task_id)

    def test_user_cannot_create_multiple_copies(self):
        """
        Проверяет, что один пользователь не может создать несколько копий одного курса.
        Ожидается возврат существующей копии при повторной попытке.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        copy1 = CopyService.create_copy_for_user(clone_course, self.student)
        copy2 = CopyService.create_copy_for_user(clone_course, self.student)

        self.assertEqual(copy1.id, copy2.id)
        self.assertEqual(Course.objects.filter(
            creator=self.student,
            root_type='copy',
            linked_to=clone_course
        ).count(), 1)

    def test_user_original_content_persists_after_sync(self):
        """
        Проверяет, что оригинальный контент пользователя сохраняется после синхронизации.
        Ожидается, что пользовательские уроки/разделы/задания не удаляются.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        lesson = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок из клона',
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)
        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        user_lesson = Lesson.objects.create(
            course=copy_course,
            root_type='original',
            title='Пользовательский урок',
            order=2
        )

        user_section = Section.objects.create(
            lesson=user_lesson,
            root_type='original',
            title='Пользовательская секция',
            order=1
        )

        CopyService.sync_copy_with_clone(copy_course)

        copy_course.refresh_from_db()
        copy_lessons = copy_course.lessons.all().order_by('order')

        self.assertEqual(copy_lessons.count(), 2)
        self.assertEqual(copy_lessons[0].title, 'Урок из клона')
        self.assertEqual(copy_lessons[1].title, 'Пользовательский урок')

        user_lesson.refresh_from_db()
        user_sections = user_lesson.sections.all()
        self.assertEqual(user_sections.count(), 1)
        self.assertEqual(user_sections[0].title, 'Пользовательская секция')

    def test_content_removed_from_copy_when_removed_from_clone(self):
        """
        Проверяет, что при удалении контента из клона, он также удаляется из копий.
        Ожидается синхронизация удаления.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        lesson1 = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок 1',
            order=1
        )

        lesson2 = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок 2',
            order=2
        )

        clone_course = CloneService.create_clone(original_course, self.admin)
        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        self.assertEqual(copy_course.lessons.count(), 2)

        lesson2.delete()
        CloneService.sync_clone_with_original(clone_course)
        CopyService.sync_copy_with_clone(copy_course)

        self.assertEqual(copy_course.lessons.count(), 1)
        self.assertEqual(copy_course.lessons.first().title, 'Урок 1')

    def test_user_content_order_preserved_for_lessons(self):
        """
        Проверяет сохранение порядка пользовательских уроков при синхронизации.
        Ожидается сохранение относительного порядка.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Клон урок 1',
            order=1
        )

        Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Клон урок 2',
            order=2
        )

        Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Клон урок 3',
            order=3
        )

        clone_course = CloneService.create_clone(original_course, self.admin)
        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        user_lesson = Lesson.objects.create(
            course=copy_course,
            root_type='original',
            title='Пользовательский урок',
            order=1
        )

        CopyService.sync_copy_with_clone(copy_course)

        copy_lessons_after = list(copy_course.lessons.all().order_by('order'))

        user_lessons = [lesson for lesson in copy_lessons_after
                        if lesson.title == 'Пользовательский урок']

        self.assertEqual(len(user_lessons), 1)
        self.assertEqual(user_lessons[0].id, user_lesson.id)

    def test_user_content_order_preserved_for_sections(self):
        """
        Проверяет сохранение порядка пользовательских разделов при синхронизации.
        Ожидается сохранение относительного порядка.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        lesson = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок',
            order=1
        )

        Section.objects.create(
            lesson=lesson,
            root_type='original',
            title='Клон секция 1',
            order=1
        )

        Section.objects.create(
            lesson=lesson,
            root_type='original',
            title='Клон секция 2',
            order=2
        )

        clone_course = CloneService.create_clone(original_course, self.admin)
        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        copy_lesson = copy_course.lessons.first()
        user_section = Section.objects.create(
            lesson=copy_lesson,
            root_type='original',
            title='Пользовательская секция',
            order=1
        )

        CopyService.sync_copy_with_clone(copy_course)

        copy_lesson.refresh_from_db()
        copy_sections_after = list(copy_lesson.sections.all().order_by('order'))

        self.assertEqual(len(copy_sections_after), 3)
        self.assertEqual(copy_sections_after[1].title, 'Пользовательская секция')
        self.assertEqual(copy_sections_after[1].id, user_section.id)

    def test_user_content_order_preserved_for_tasks(self):
        """
        Проверяет сохранение порядка пользовательских задач при синхронизации.
        Ожидается сохранение относительного порядка.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        lesson = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок',
            order=1
        )

        section = Section.objects.create(
            lesson=lesson,
            root_type='original',
            title='Секция',
            order=1
        )

        note_task1 = NoteTask.objects.create(content='Клон задача 1')
        note_task2 = NoteTask.objects.create(content='Клон задача 2')

        Task.objects.create(
            section=section,
            root_type='original',
            task_type='note',
            content_type=ContentType.objects.get_for_model(NoteTask),
            object_id=note_task1.id,
            order=1
        )

        Task.objects.create(
            section=section,
            root_type='original',
            task_type='note',
            content_type=ContentType.objects.get_for_model(NoteTask),
            object_id=note_task2.id,
            order=2
        )

        clone_course = CloneService.create_clone(original_course, self.admin)
        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        copy_section = copy_course.lessons.first().sections.first()

        user_note_task = NoteTask.objects.create(content='Пользовательская задача')
        user_task = Task.objects.create(
            section=copy_section,
            root_type='original',
            task_type='note',
            content_type=ContentType.objects.get_for_model(NoteTask),
            object_id=user_note_task.id,
            order=1
        )

        CopyService.sync_copy_with_clone(copy_course)

        copy_section.refresh_from_db()
        copy_tasks_after = list(copy_section.tasks.all().order_by('order'))

        self.assertEqual(len(copy_tasks_after), 3)
        self.assertEqual(copy_tasks_after[0].get_specific().content, 'Клон задача 1')
        self.assertEqual(copy_tasks_after[1].get_specific().content, 'Пользовательская задача')
        self.assertEqual(copy_tasks_after[1].id, user_task.id)
        self.assertEqual(copy_tasks_after[2].get_specific().content, 'Клон задача 2')