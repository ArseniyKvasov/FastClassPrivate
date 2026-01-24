import os
import tempfile

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.contenttypes.models import ContentType
from django.conf import settings

from courses.models import Course, Lesson, Section, Task, ImageTask
from courses.services import (
    create_course_copy_for_user,
    sync_course_copy_with_user,
    _save_image_file,
)
from fastlesson.settings import MEDIA_URL


@override_settings(MEDIA_ROOT=tempfile.gettempdir())
class CourseCopyUserTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            username="owner",
            password="123"
        )
        self.student = get_user_model().objects.create_user(
            username="student",
            password="123"
        )

        self.course = Course.objects.create(
            creator=self.owner,
            title="Course",
        )

        lesson = Lesson.objects.create(
            course=self.course,
            title="Lesson",
            order=1,
        )
        section = Section.objects.create(
            lesson=lesson,
            title="Section",
            order=1,
        )

        original_file = SimpleUploadedFile(
            "orig.png",
            b"original-image",
            content_type="image/png",
        )

        image = ImageTask.objects.create(
            file_path="",
            caption="original",
        )
        image.file_path = _save_image_file(original_file)
        image.save()

        self.original_local_path = os.path.join(
            settings.MEDIA_ROOT,
            image.file_path.replace(MEDIA_URL, "").lstrip("/")
        )

        self.task = Task.objects.create(
            section=section,
            task_type="image",
            content_type=ContentType.objects.get_for_model(ImageTask),
            object_id=image.id,
            order=1,
        )

    def test_copy_references_original_task_without_copying_file(self):
        """
        1) Копия задания ссылается на оригинал,
           файл физически не копируется.
        """
        copy = create_course_copy_for_user(self.course, self.student)
        task_copy = Task.objects.get(section__lesson__course=copy)

        self.assertEqual(task_copy.original_task, self.task)
        self.assertEqual(task_copy.edited_content, {})

        self.assertTrue(os.path.exists(self.original_local_path))

    def test_delete_by_copy_user_does_not_remove_original_file(self):
        """
        2) Пользователь, удаляющий копию задания,
           НЕ удаляет файл оригинала.
        """
        copy = create_course_copy_for_user(self.course, self.student)
        task_copy = Task.objects.get(section__lesson__course=copy)

        task_copy.delete()

        self.assertTrue(os.path.exists(self.original_local_path))

    def test_delete_by_owner_removes_specific_and_file(self):
        """
        2) Создатель задания при удалении
           удаляет specific и файл.
        """
        self.task.delete()

        self.assertFalse(os.path.exists(self.original_local_path))
        self.assertEqual(ImageTask.objects.count(), 0)

    def test_user_edit_creates_own_file_and_deletes_it_on_delete(self):
        """
        3) Пользователь добавляет file_path в edited_content.
           При удалении его копии файл удаляется,
           оригинальный файл остаётся.
        """
        copy = create_course_copy_for_user(self.course, self.student)
        task_copy = Task.objects.get(section__lesson__course=copy)

        new_file = SimpleUploadedFile(
            "user.png",
            b"user-image",
            content_type="image/png",
        )

        user_file_path = _save_image_file(new_file)
        user_local_path = os.path.join(
            settings.MEDIA_ROOT,
            user_file_path.replace(MEDIA_URL, "").lstrip("/")
        )

        task_copy.edited_content["file_path"] = user_file_path
        task_copy.save(update_fields=["edited_content"])

        self.assertTrue(os.path.exists(user_local_path))

        task_copy.delete()

        self.assertFalse(os.path.exists(user_local_path))
        self.assertTrue(os.path.exists(self.original_local_path))

    def test_sync_keep_user_content_true_preserves_edited_content(self):
        """
        4) При keep_user_content=True edited_content сохраняется.
        """
        copy = create_course_copy_for_user(self.course, self.student)
        task_copy = Task.objects.get(section__lesson__course=copy)

        new_file = SimpleUploadedFile(
            "user2.png",
            b"user-image-2",
            content_type="image/png",
        )
        user_file_path = _save_image_file(new_file)

        task_copy.edited_content["file_path"] = user_file_path
        task_copy.save(update_fields=["edited_content"])

        sync_course_copy_with_user(
            copy,
            self.course,
            keep_user_content=True,
        )

        task_copy.refresh_from_db()
        self.assertEqual(task_copy.edited_content.get("file_path"), user_file_path)

    def test_sync_keep_user_content_false_resets_edited_content(self):
        """
        4) При keep_user_content=False edited_content сбрасывается.
        """
        copy = create_course_copy_for_user(self.course, self.student)
        task_copy = Task.objects.get(section__lesson__course=copy)

        new_file = SimpleUploadedFile(
            "user3.png",
            b"user-image-3",
            content_type="image/png",
        )
        user_file_path = _save_image_file(new_file)

        task_copy.edited_content["file_path"] = user_file_path
        task_copy.save(update_fields=["edited_content"])

        sync_course_copy_with_user(
            copy,
            self.course,
            keep_user_content=False,
        )

        task_copy.refresh_from_db()
        self.assertEqual(task_copy.edited_content, {})