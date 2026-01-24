import os
import tempfile
import shutil

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.conf import settings
from django.contrib.contenttypes.models import ContentType

from courses.models import Course, Lesson, Section, Task, ImageTask
from courses.services import clone_course_for_platform


class CloneCourseTests(TestCase):
    def setUp(self):
        self.temp_media = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.temp_media)
        self.settings_override.enable()

        self.owner = get_user_model().objects.create_user(
            username="owner", password="123"
        )
        self.student = get_user_model().objects.create_user(
            username="student", password="123"
        )

        self.course = Course.objects.create(
            creator=self.owner,
            title="Original Course",
            version=1,
        )

        lesson = Lesson.objects.create(
            course=self.course,
            title="Lesson 1",
            order=1,
        )
        section = Section.objects.create(
            lesson=lesson,
            title="Section 1",
            order=1,
        )

        test_dir = os.path.join(settings.MEDIA_ROOT, "tasks", "images")
        os.makedirs(test_dir, exist_ok=True)

        original_file_path = os.path.join(test_dir, "image.png")
        with open(original_file_path, "wb") as f:
            f.write(b"image-data")

        self.image_task = ImageTask.objects.create(
            file_path="tasks/images/image.png",
            caption="original"
        )

        self.task = Task.objects.create(
            section=section,
            task_type="image",
            content_type=ContentType.objects.get_for_model(ImageTask),
            object_id=self.image_task.id,
            order=1,
        )

        self.original_local_path = original_file_path

    def tearDown(self):
        self.settings_override.disable()
        if os.path.exists(self.temp_media):
            shutil.rmtree(self.temp_media)

    def test_clone_creates_new_files_and_increases_version(self):
        """
        Проверяем:
        1) Оригинальный курс увеличивает версию на 1
        2) Клон создаёт новый файл с другим именем и той же версией
        3) Оба курса остаются активными (оригинал активен, клон неактивен по умолчанию)
        4) Файлы правильно клонируются
        """
        original_version = self.course.version

        clone_course = clone_course_for_platform(self.course, self.student)

        self.course.refresh_from_db()
        self.assertEqual(self.course.version, original_version + 1)
        self.assertTrue(self.course.is_active)

        self.assertNotEqual(clone_course.id, self.course.id)
        self.assertFalse(clone_course.is_active)
        self.assertEqual(clone_course.version, self.course.version)

        self.assertEqual(clone_course.lessons.count(), 1)
        cloned_lesson = clone_course.lessons.first()
        self.assertEqual(cloned_lesson.sections.count(), 1)
        cloned_section = cloned_lesson.sections.first()
        self.assertEqual(cloned_section.tasks.count(), 1)

        cloned_task = cloned_section.tasks.first()
        cloned_spec = cloned_task.get_specific()
        self.assertIsNotNone(cloned_spec)

        self.assertIsNotNone(cloned_spec.file_path)
        self.assertNotEqual(cloned_spec.file_path, self.image_task.file_path)

        self.assertTrue(os.path.exists(self.original_local_path))

        cloned_local_path = os.path.join(settings.MEDIA_ROOT, cloned_spec.file_path)

        self.assertIn("_clone_v2", cloned_spec.file_path)

        self.assertTrue(os.path.exists(cloned_local_path))

        with open(cloned_local_path, "rb") as f:
            content = f.read()
            self.assertEqual(content, b"image-data")

    def test_clone_without_files(self):
        """
        Проверяем клонирование задания без файла.
        """
        image_task_no_file = ImageTask.objects.create(
            file_path="",
            caption="no file"
        )

        section = self.course.lessons.first().sections.first()
        Task.objects.create(
            section=section,
            task_type="image",
            content_type=ContentType.objects.get_for_model(ImageTask),
            object_id=image_task_no_file.id,
            order=2,
        )

        original_version = self.course.version

        clone_course = clone_course_for_platform(self.course, self.student)

        self.course.refresh_from_db()
        self.assertEqual(self.course.version, original_version + 1)

        self.assertEqual(clone_course.lessons.first().sections.first().tasks.count(), 2)

        cloned_tasks = list(clone_course.lessons.first().sections.first().tasks.order_by("order"))
        self.assertEqual(len(cloned_tasks), 2)

        cloned_task_no_file = cloned_tasks[1]
        cloned_spec_no_file = cloned_task_no_file.get_specific()
        self.assertEqual(cloned_spec_no_file.caption, "no file")
        self.assertEqual(cloned_spec_no_file.file_path, "")

    def test_multiple_clones_increment_version(self):
        """
        Проверяем, что при каждом клонировании версия увеличивается.
        """
        original_version = self.course.version
        clone1 = clone_course_for_platform(self.course, self.student)

        self.course.refresh_from_db()
        self.assertEqual(self.course.version, original_version + 1)
        self.assertEqual(clone1.version, self.course.version)

        clone2 = clone_course_for_platform(self.course, self.student)

        self.course.refresh_from_db()
        self.assertEqual(self.course.version, original_version + 2)
        self.assertEqual(clone2.version, self.course.version)

        clone3 = clone_course_for_platform(self.course, self.student)

        self.course.refresh_from_db()
        self.assertEqual(self.course.version, original_version + 3)
        self.assertEqual(clone3.version, self.course.version)

        self.assertNotEqual(clone1.id, clone2.id)
        self.assertNotEqual(clone2.id, clone3.id)
        self.assertNotEqual(clone1.id, clone3.id)