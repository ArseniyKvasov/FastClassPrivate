import os
import tempfile
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from courses.models import ImageTask
from fastlesson.settings import MEDIA_URL


@override_settings(MEDIA_ROOT=tempfile.gettempdir())
class ImageTaskFileTests(TestCase):
    def setUp(self):
        self.test_file = SimpleUploadedFile(
            "test.png", b"fake image content", content_type="image/png"
        )

    def test_image_task_create_and_file_url(self):
        task = ImageTask.objects.create(
            file_path="",
            caption="Тест"
        )

        from courses.services import _save_image_file
        file_url = _save_image_file(self.test_file)
        task.file_path = file_url
        task.save()

        self.assertTrue(task.file_path.startswith(MEDIA_URL))

        from django.conf import settings
        local_path = os.path.join(settings.MEDIA_ROOT, file_url.replace(MEDIA_URL, '').lstrip("/"))
        self.assertTrue(os.path.exists(local_path))

    def test_image_task_delete_removes_file(self):
        task = ImageTask.objects.create(
            file_path="", caption="Тест"
        )
        from courses.services import _save_image_file
        file_url = _save_image_file(self.test_file)
        task.file_path = file_url
        task.save()

        from django.conf import settings
        local_path = os.path.join(settings.MEDIA_ROOT, file_url.replace(MEDIA_URL, '').lstrip("/"))
        self.assertTrue(os.path.exists(local_path))

        task.delete()

        self.assertFalse(os.path.exists(local_path))

    def test_image_task_update_replaces_file_and_removes_old(self):
        from courses.services import _save_image_file
        from django.conf import settings

        first_file = SimpleUploadedFile(
            "first.png", b"first image", content_type="image/png"
        )
        first_file_url = _save_image_file(first_file)

        task = ImageTask.objects.create(
            file_path=first_file_url,
            caption="Первое изображение"
        )

        first_local_path = os.path.join(
            settings.MEDIA_ROOT,
            first_file_url.replace(MEDIA_URL, "").lstrip("/")
        )

        self.assertTrue(os.path.exists(first_local_path))

        second_file = SimpleUploadedFile(
            "second.png", b"second image", content_type="image/png"
        )
        second_file_url = _save_image_file(second_file)

        old_file_path = task.file_path
        task.file_path = second_file_url
        task.save()

        old_local_path = os.path.join(
            settings.MEDIA_ROOT,
            old_file_path.replace(MEDIA_URL, "").lstrip("/")
        )
        new_local_path = os.path.join(
            settings.MEDIA_ROOT,
            second_file_url.replace(MEDIA_URL, "").lstrip("/")
        )

        self.assertFalse(os.path.exists(old_local_path))

        self.assertTrue(os.path.exists(new_local_path))
