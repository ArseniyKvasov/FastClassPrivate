"""
Тесты для функционала клонирования курсов.
"""
import os
import shutil
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.exceptions import ValidationError
from courses.models import Course, Lesson, Section, Task, NoteTask, ImageTask
from django.contrib.contenttypes.models import ContentType

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

        self.media_test_dir = os.path.join(settings.MEDIA_ROOT, 'test_images')
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

        clone = Course.objects.create(
            creator=self.admin,
            linked_to=original_course,
            root_type='clone',
            title='Клон курса',
            description='Описание клона',
            subject='math'
        )

        self.assertEqual(clone.root_type, 'clone')
        self.assertEqual(clone.linked_to, original_course)
        self.assertEqual(clone.creator, self.admin)

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

        clone_course = Course.objects.create(
            creator=self.admin,
            linked_to=original_course,
            root_type='clone',
            title='Клон курса'
        )

        with self.assertRaises(ValidationError):
            clone_course.create_clone(self.student)

    def test_cannot_clone_copy_course(self):
        """
        Проверяет, что нельзя создать клон из копии курса.
        Ожидается исключение ValidationError.
        """
        original_course = Course.objects.create(
            creator=self.user,
            root_type='original',
            title='Оригинальный курс'
        )

        clone_course = Course.objects.create(
            creator=self.admin,
            linked_to=original_course,
            root_type='clone',
            title='Клон курса'
        )

        copy_course = Course.objects.create(
            creator=self.student,
            linked_to=clone_course,
            root_type='copy',
            title='Копия курса'
        )

        with self.assertRaises(ValidationError):
            copy_course.create_copy_for_user(User.objects.create_user(username='student2', password='testpass'))

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

        clone_course = Course.objects.create(
            creator=self.admin,
            linked_to=original_course,
            root_type='clone',
            title='Оригинальный курс',
            description=original_course.description,
            subject=original_course.subject,
            is_public=False
        )

        clone_course.synchronize_with_original()

        copy_course = Course.objects.create(
            creator=self.student,
            linked_to=clone_course,
            root_type='copy',
            title='Оригинальный курс',
            description=original_course.description,
            subject=original_course.subject,
            is_public=False
        )

        copy_course.synchronize_with_clone()

        original_course.title = 'Обновленный оригинал'
        original_course.save()

        lesson.title = 'Обновленный урок'
        lesson.save()

        clone_course.synchronize_with_original()
        copy_course.synchronize_with_clone()

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

        clone_course = original_course.create_clone(self.admin)

        copy1 = clone_course.create_copy_for_user(self.student)
        student2 = User.objects.create_user(username='student2', password='testpass')
        copy2 = clone_course.create_copy_for_user(student2)

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

        clone_course.synchronize_with_original()

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

        clone_course = original_course.create_clone(self.admin)

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

        clone_course.synchronize_with_original()

        student2 = User.objects.create_user(username='student2', password='testpass')
        new_copy = clone_course.create_copy_for_user(student2)

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

        clone_course = original_course.create_clone(self.admin)

        copy = clone_course.create_copy_for_user(self.student)

        lesson4 = Lesson.objects.create(
            course=original_course,
            root_type='original',
            title='Урок 4',
            order=4
        )

        lesson2.delete()

        clone_course.synchronize_with_original()

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

        clone_course = Course.objects.create(
            creator=self.admin,
            linked_to=original_course,
            root_type='clone',
            title='Клон курса'
        )

        clone_course.synchronize_with_original()

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

        image_task = ImageTask.objects.create(
            file_path=settings.MEDIA_URL + 'test_images/test_image.jpg',
            caption='Оригинальное изображение'
        )

        task = Task.objects.create(
            section=section,
            root_type='original',
            task_type='image',
            content_type=ContentType.objects.get_for_model(ImageTask),
            object_id=image_task.id,
            order=1
        )

        clone_course = Course.objects.create(
            creator=self.admin,
            linked_to=original_course,
            root_type='clone',
            title='Клон курса'
        )

        clone_course.synchronize_with_original()

        clone_task = clone_course.lessons.first().sections.first().tasks.first()
        cloned_image = clone_task.get_specific()

        self.assertIsNotNone(cloned_image)
        self.assertNotEqual(cloned_image.id, image_task.id)
        self.assertNotEqual(cloned_image.file_path, image_task.file_path)
        self.assertTrue('_clone_' in cloned_image.file_path)
        self.assertTrue(os.path.exists(
            os.path.join(settings.MEDIA_ROOT, cloned_image.file_path.replace(settings.MEDIA_URL, '').lstrip('/'))
        ))

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

        clone_course = Course.objects.create(
            creator=self.admin,
            linked_to=original_course,
            root_type='clone',
            title='Клон курса'
        )

        clone_course.synchronize_with_original()

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

        image_task1 = ImageTask.objects.create(
            file_path=settings.MEDIA_URL + 'test_images/test_image1.jpg',
            caption='Первое изображение'
        )

        task1_path = os.path.join(settings.MEDIA_ROOT, 'test_images/test_image1.jpg')
        with open(task1_path, 'wb') as f:
            f.write(b'first image content')

        task = Task.objects.create(
            section=section,
            root_type='original',
            task_type='image',
            content_type=ContentType.objects.get_for_model(ImageTask),
            object_id=image_task1.id,
            order=1
        )

        clone_course = Course.objects.create(
            creator=self.admin,
            linked_to=original_course,
            root_type='clone',
            title='Клон курса'
        )

        clone_course.synchronize_with_original()

        clone_task = clone_course.lessons.first().sections.first().tasks.first()
        cloned_image1 = clone_task.get_specific()
        cloned_file_path1 = cloned_image1.file_path
        cloned_full_path1 = os.path.join(
            settings.MEDIA_ROOT,
            cloned_file_path1.replace(settings.MEDIA_URL, '').lstrip('/')
        )

        self.assertTrue(os.path.exists(cloned_full_path1))

        image_task1.delete()

        image_task2 = ImageTask.objects.create(
            file_path=settings.MEDIA_URL + 'test_images/test_image2.jpg',
            caption='Второе изображение'
        )

        task2_path = os.path.join(settings.MEDIA_ROOT, 'test_images/test_image2.jpg')
        with open(task2_path, 'wb') as f:
            f.write(b'second image content')

        task.content_type = ContentType.objects.get_for_model(ImageTask)
        task.object_id = image_task2.id
        task.save()

        clone_course.synchronize_with_original()

        clone_task.refresh_from_db()
        cloned_image2 = clone_task.get_specific()

        self.assertIsNotNone(cloned_image2)
        self.assertNotEqual(cloned_image2.id, cloned_image1.id)
        self.assertNotEqual(cloned_image2.file_path, cloned_file_path1)
        self.assertEqual(cloned_image2.caption, 'Второе изображение')
        self.assertFalse(os.path.exists(cloned_full_path1))

        new_full_path = os.path.join(
            settings.MEDIA_ROOT,
            cloned_image2.file_path.replace(settings.MEDIA_URL, '').lstrip('/')
        )
        self.assertTrue(os.path.exists(new_full_path))