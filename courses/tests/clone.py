"""
Тесты для функционала клонирования курсов.
"""
import os
import shutil
from django.conf import settings
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.contenttypes.models import ContentType
from courses.models import Course, Lesson, Section, Task, NoteTask, FileTask
from courses.services import CloneService
from courses.services import CopyService

User = get_user_model()


class CloneCourseTests(TestCase):
    """
    Тесты клонирования курсов.
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

    def test_can_clone_original_course(self):
        """
        Проверяет, что можно склонировать оригинальный курс.
        Ожидается создание клона курса.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс',
            description='Описание курса',
            subject='math'
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        self.assertEqual(clone_course.root_type, 'clone')
        self.assertEqual(clone_course.linked_to, original_course)
        self.assertEqual(clone_course.creator, self.admin)
        self.assertEqual(clone_course.title, 'Оригинальный курс')

    def test_cannot_clone_clone_course(self):
        """
        Проверяет, что нельзя создать клон из клона курса.
        Ожидается исключение ValidationError.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        with self.assertRaises(ValidationError):
            CloneService.create_clone(clone_course, self.admin)

    def test_clone_updates(self):
        """
        Проверяет, что при синхронизации клона автоматически обновляются копии.
        Ожидается, что изменения в оригинале передаются в клон и копию.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        lesson = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Оригинальный урок',
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)
        CloneService.sync_clone_with_original(clone_course)

        copy_course = CopyService.create_copy_for_user(clone_course, self.student)

        original_course.title = 'Обновленный оригинал'
        original_course.save()

        lesson.title = 'Обновленный урок'
        lesson.save()

        CloneService.sync_clone_with_original(clone_course)
        CopyService.sync_copy_with_clone(copy_course)

        clone_course.refresh_from_db()
        copy_course.refresh_from_db()

        self.assertEqual(clone_course.title, 'Обновленный оригинал')
        self.assertEqual(copy_course.title, 'Обновленный оригинал')

        clone_lesson = clone_course.lessons.first()
        copy_lesson = copy_course.lessons.first()

        self.assertEqual(clone_lesson.title, 'Обновленный урок')
        self.assertEqual(copy_lesson.title, 'Обновленный урок')

    def test_existing_copies_updated_when_clone_synchronized(self):
        """
        Проверяет, что существующие копии курса обновляются при синхронизации клона.
        Ожидается, что все ранее созданные копии получают обновления.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        lesson = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок 1',
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        copy1 = CopyService.create_copy_for_user(clone_course, self.student)
        student2 = User.objects.create_user(username='student2', password='testpass')
        copy2 = CopyService.create_copy_for_user(clone_course, student2)

        self.assertEqual(copy1.title, 'Оригинальный курс')
        self.assertEqual(copy2.title, 'Оригинальный курс')

        original_course.title = 'Обновленный курс'
        original_course.save()

        lesson.title = 'Обновленный урок 1'
        lesson.save()

        Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Новый урок 2',
            order=2
        )

        CloneService.sync_clone_with_original(clone_course)

        copy1.refresh_from_db()
        copy2.refresh_from_db()

        self.assertEqual(copy1.title, 'Обновленный курс')
        self.assertEqual(copy2.title, 'Обновленный курс')

        copy1_lessons = copy1.lessons.all().order_by('order')
        copy2_lessons = copy2.lessons.all().order_by('order')

        self.assertEqual(copy1_lessons.count(), 2)
        self.assertEqual(copy2_lessons.count(), 2)

        self.assertEqual(copy1_lessons[0].title, 'Обновленный урок 1')
        self.assertEqual(copy1_lessons[1].title, 'Новый урок 2')
        self.assertEqual(copy2_lessons[0].title, 'Обновленный урок 1')
        self.assertEqual(copy2_lessons[1].title, 'Новый урок 2')

    def test_new_copies_get_latest_version_after_sync(self):
        """
        Проверяет, что новые копии, созданные после синхронизации,
        получают актуальную версию клона.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        lesson = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Старый урок',
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        original_course.title = 'Обновленный курс'
        original_course.save()

        lesson.title = 'Обновленный урок'
        lesson.save()

        Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Новый урок 2',
            order=2
        )

        CloneService.sync_clone_with_original(clone_course)

        student2 = User.objects.create_user(username='student2', password='testpass')
        new_copy = CopyService.create_copy_for_user(clone_course, student2)

        self.assertEqual(new_copy.title, 'Обновленный курс')

        new_copy_lessons = new_copy.lessons.all().order_by('order')
        self.assertEqual(new_copy_lessons.count(), 2)
        self.assertEqual(new_copy_lessons[0].title, 'Обновленный урок')
        self.assertEqual(new_copy_lessons[1].title, 'Новый урок 2')

    def test_copies_updated_when_content_removed_from_original(self):
        """
        Проверяет, что при удалении контента из оригинала,
        он также удаляется из копий через синхронизацию клона.
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

        lesson3 = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок 3',
            order=3
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        copy = CopyService.create_copy_for_user(clone_course, self.student)

        Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок 4',
            order=4
        )

        lesson2.delete()

        CloneService.sync_clone_with_original(clone_course)

        copy.refresh_from_db()
        copy_lessons = copy.lessons.all().order_by('order')

        self.assertEqual(copy_lessons.count(), 3)
        self.assertEqual(copy_lessons[0].title, 'Урок 1')
        self.assertEqual(copy_lessons[1].title, 'Урок 3')
        self.assertEqual(copy_lessons[2].title, 'Урок 4')

    def test_specific_objects_are_cloned(self):
        """
        Проверяет, что specific объекты клонируются, а не используются те же.
        Ожидается создание новых объектов specific.
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

        note_task = NoteTask.objects.create(content='Оригинальная заметка')

        task = Task.objects.create(
            section=section,
            root_type='original',
            task_type='note',
            content_type=ContentType.objects.get_for_model(NoteTask),
            object_id=note_task.id,
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        clone_task = clone_course.lessons.first().sections.first().tasks.first()
        cloned_note = clone_task.get_specific()

        self.assertIsNotNone(cloned_note)
        self.assertNotEqual(cloned_note.id, note_task.id)
        self.assertEqual(cloned_note.content, 'Оригинальная заметка')

    def test_files_are_cloned_with_new_names(self):
        """
        Проверяет, что файлы specific объектов клонируются с новыми именами.
        Ожидается создание копий файлов.
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

        with open(self.test_file_path, 'rb') as f:
            file_content = f.read()
        uploaded_file = SimpleUploadedFile(
            name='test_image.jpg',
            content=file_content,
            content_type='image/jpeg'
        )

        file_task = FileTask.objects.create(file=uploaded_file)

        task = Task.objects.create(
            section=section,
            root_type='original',
            task_type='file',
            content_type=ContentType.objects.get_for_model(FileTask),
            object_id=file_task.id,
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        clone_task = clone_course.lessons.first().sections.first().tasks.first()
        cloned_file = clone_task.get_specific()

        self.assertIsNotNone(cloned_file)
        self.assertNotEqual(cloned_file.id, file_task.id)
        self.assertNotEqual(cloned_file.file.name, file_task.file.name)
        self.assertTrue('_clone_' in cloned_file.file.name)
        self.assertTrue(os.path.exists(cloned_file.file.path))

    def test_clone_specific_persists_when_original_deleted(self):
        """
        Проверяет, что specific клона остается при удалении specific оригинального курса.
        Ожидается, что клон сохранит свой specific объект.
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

        note_task = NoteTask.objects.create(content='Оригинальная заметка')

        task = Task.objects.create(
            section=section,
            root_type='original',
            task_type='note',
            content_type=ContentType.objects.get_for_model(NoteTask),
            object_id=note_task.id,
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        clone_task = clone_course.lessons.first().sections.first().tasks.first()
        cloned_note = clone_task.get_specific()
        cloned_note_id = cloned_note.id

        note_task.delete()

        clone_task.refresh_from_db()
        cloned_note = clone_task.get_specific()

        self.assertIsNotNone(cloned_note)
        self.assertEqual(cloned_note.id, cloned_note_id)
        self.assertEqual(cloned_note.content, 'Оригинальная заметка')

    def test_new_specific_recreated_on_sync_with_file_deletion(self):
        """
        Проверяет, что при создании нового specific в оригинальном курсе
        он будет пересоздан при синхронизации клона, и файл старого specific будет удален.
        Ожидается удаление старого файла и создание нового.
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

        file1_path = os.path.join(self.media_test_dir, 'test_image1.jpg')
        with open(file1_path, 'wb') as f:
            f.write(b'first image content')

        with open(file1_path, 'rb') as f:
            uploaded_file1 = SimpleUploadedFile(
                name='test_image1.jpg',
                content=f.read(),
                content_type='image/jpeg'
            )

        file_task1 = FileTask.objects.create(file=uploaded_file1)

        task = Task.objects.create(
            section=section,
            root_type='original',
            task_type='file',
            content_type=ContentType.objects.get_for_model(FileTask),
            object_id=file_task1.id,
            order=1
        )

        clone_course = CloneService.create_clone(original_course, self.admin)

        clone_task = clone_course.lessons.first().sections.first().tasks.first()
        cloned_file1 = clone_task.get_specific()
        cloned_file_path1 = cloned_file1.file.path

        self.assertTrue(os.path.exists(cloned_file_path1))

        file_task1.delete()

        file2_path = os.path.join(self.media_test_dir, 'test_image2.jpg')
        with open(file2_path, 'wb') as f:
            f.write(b'second image content')

        with open(file2_path, 'rb') as f:
            uploaded_file2 = SimpleUploadedFile(
                name='test_image2.jpg',
                content=f.read(),
                content_type='image/jpeg'
            )

        file_task2 = FileTask.objects.create(file=uploaded_file2)

        task.content_type = ContentType.objects.get_for_model(FileTask)
        task.object_id = file_task2.id
        task.save()

        CloneService.sync_clone_with_original(clone_course)

        clone_task.refresh_from_db()
        cloned_file2 = clone_task.get_specific()

        self.assertIsNotNone(cloned_file2)
        self.assertNotEqual(cloned_file2.id, cloned_file1.id)
        self.assertNotEqual(cloned_file2.file.name, cloned_file1.file.name)
        self.assertFalse(os.path.exists(cloned_file_path1))
        self.assertTrue(os.path.exists(cloned_file2.file.path))