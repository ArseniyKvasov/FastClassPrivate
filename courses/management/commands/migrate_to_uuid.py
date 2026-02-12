from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.contrib.contenttypes.models import ContentType
from django.core.files import File
import uuid
import os
from pathlib import Path

from courses.models import (
    TestTask, TrueFalseTask, NoteTask, FillGapsTask,
    MatchCardsTask, TextInputTask, IntegrationTask,
    FileTask, WordListTask, Task
)
from fastlesson import settings


class Command(BaseCommand):
    help = 'Migrate integer primary keys to UUID and convert FileTask file_path to FileField'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force migration without confirmation',
        )

    def handle(self, *args, **options):
        if not options['force']:
            self.stdout.write(self.style.WARNING(
                'ВНИМАНИЕ! Эта команда:\n'
                '1. Изменит primary keys на UUID для всех task моделей\n'
                '2. Конвертирует FileTask.file_path в FileField\n'
                'Убедитесь, что у вас есть бэкап базы данных и файлов!\n'
            ))
            confirm = input('Продолжить? (yes/no): ')
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.WARNING('Миграция отменена'))
                return

        # Сначала мигрируем FileTask (особый случай)
        try:
            self.migrate_file_task()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Ошибка при миграции FileTask: {e}'))

        models_to_migrate = [
            (TestTask, "TestTask"),
            (TrueFalseTask, "TrueFalseTask"),
            (NoteTask, "NoteTask"),
            (FillGapsTask, "FillGapsTask"),
            (MatchCardsTask, "MatchCardsTask"),
            (TextInputTask, "TextInputTask"),
            (IntegrationTask, "IntegrationTask"),
            (WordListTask, "WordListTask"),
        ]

        for model_class, model_name in models_to_migrate:
            try:
                self.migrate_model_to_uuid(model_class, model_name)
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'Ошибка при миграции {model_name}: {e}'
                ))

        self.stdout.write(self.style.SUCCESS('Миграция успешно завершена!'))

    def migrate_file_task(self):
        """Специальная миграция для FileTask: конвертация file_path в file"""
        self.stdout.write('\n=== Миграция FileTask (file_path -> file) ===')

        # Проверяем, есть ли еще поле file_path
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'courses_filetask' AND column_name = 'file_path';
            """)
            has_file_path = cursor.fetchone()

            if not has_file_path:
                self.stdout.write('Поле file_path уже удалено, пропускаем...')
                return

        file_tasks = list(FileTask.objects.all())
        self.stdout.write(f'Найдено FileTask объектов: {len(file_tasks)}')

        if not file_tasks:
            self.stdout.write('Нет объектов для миграции')
            return

        # Базовая директория для файлов
        base_media_dir = Path(settings.MEDIA_ROOT) / 'tasks' / 'files'
        base_media_dir.mkdir(parents=True, exist_ok=True)

        with transaction.atomic():
            with connection.cursor() as cursor:
                # Добавляем временное поле file
                cursor.execute('ALTER TABLE "courses_filetask" ADD COLUMN "temp_file" varchar(100);')

                for ft in file_tasks:
                    old_path = ft.file_path
                    if not old_path:
                        continue

                    try:
                        # Извлекаем имя файла из URL
                        # Формат: /media/tasks/files/имя_файла.ext ИЛИ media/tasks/files/имя_файла.ext
                        if 'tasks/files/' in old_path:
                            filename = old_path.split('tasks/files/')[-1]
                        else:
                            filename = os.path.basename(old_path)

                        # Очищаем filename от лишних символов
                        filename = filename.split('?')[0].split('#')[0]

                        # Полный путь к файлу
                        full_path = base_media_dir / filename

                        if full_path.exists():
                            # Сохраняем относительный путь в формате 'tasks/files/имя_файла.ext'
                            relative_path = f'tasks/files/{filename}'
                            cursor.execute(
                                'UPDATE "courses_filetask" SET "temp_file" = %s WHERE "id" = %s;',
                                [relative_path, ft.id]
                            )
                            self.stdout.write(f'  {ft.id}: {relative_path}')
                        else:
                            # Пробуем найти файл в старом месте
                            old_full_path = Path(old_path.replace(settings.MEDIA_URL, settings.MEDIA_ROOT, 1))
                            if old_full_path.exists():
                                # Копируем файл в новое место
                                import shutil
                                shutil.copy2(old_full_path, full_path)
                                relative_path = f'tasks/files/{filename}'
                                cursor.execute(
                                    'UPDATE "courses_filetask" SET "temp_file" = %s WHERE "id" = %s;',
                                    [relative_path, ft.id]
                                )
                                self.stdout.write(f'  {ft.id}: {relative_path} (скопирован)')
                            else:
                                self.stdout.write(self.style.WARNING(
                                    f'  Файл не найден: {full_path} (искали также: {old_full_path})'
                                ))

                    except Exception as e:
                        self.stdout.write(self.style.ERROR(
                            f'  Ошибка при обработке {ft.id}: {e}'
                        ))

                # Удаляем старое поле file_path
                cursor.execute('ALTER TABLE "courses_filetask" DROP COLUMN "file_path";')

                # Переименовываем temp_file в file
                cursor.execute('ALTER TABLE "courses_filetask" RENAME COLUMN "temp_file" TO "file";')

        # Теперь мигрируем UUID для FileTask
        self.migrate_model_to_uuid(FileTask, "FileTask")

        self.stdout.write(self.style.SUCCESS('✓ FileTask успешно мигрирован'))

    def migrate_model_to_uuid(self, model_class, model_name):
        """Миграция integer primary key в UUID"""
        self.stdout.write(f'\n=== Миграция {model_name} на UUID ===')

        content_type = ContentType.objects.get_for_model(model_class)
        tasks = Task.objects.filter(content_type=content_type)
        objects = list(model_class.objects.all())

        self.stdout.write(f'Найдено объектов: {len(objects)}')
        self.stdout.write(f'Связанных задач: {tasks.count()}')

        if not objects:
            self.stdout.write('Нет объектов для миграции')
            return

        with transaction.atomic():
            id_mapping = {}

            for obj in objects:
                old_id = obj.id
                new_id = uuid.uuid4()
                id_mapping[old_id] = new_id
                self.stdout.write(f'  {old_id} -> {new_id}')

            table_name = model_class._meta.db_table

            with connection.cursor() as cursor:
                # Добавляем временную колонку
                cursor.execute(f'ALTER TABLE "{table_name}" ADD COLUMN "new_id" uuid;')

                # Заполняем UUID
                for old_id, new_id in id_mapping.items():
                    cursor.execute(
                        f'UPDATE "{table_name}" SET "new_id" = %s WHERE "id" = %s;',
                        [str(new_id), old_id]
                    )

                # Обновляем Task.object_id
                for task in tasks:
                    try:
                        old_id = int(task.object_id)
                        if old_id in id_mapping:
                            task.object_id = id_mapping[old_id]
                            task.save()
                            self.stdout.write(f'  Task {task.id}: object_id {old_id} -> {task.object_id}')
                    except (ValueError, TypeError):
                        self.stdout.write(self.style.WARNING(
                            f'  Task {task.id} имеет некорректный object_id: {task.object_id}'
                        ))
                        continue

                # Переключаем primary key
                cursor.execute(f'ALTER TABLE "{table_name}" DROP CONSTRAINT "{table_name}_pkey" CASCADE;')
                cursor.execute(f'ALTER TABLE "{table_name}" DROP COLUMN "id";')
                cursor.execute(f'ALTER TABLE "{table_name}" RENAME COLUMN "new_id" TO "id";')
                cursor.execute(f'ALTER TABLE "{table_name}" ADD PRIMARY KEY ("id");')

        self.stdout.write(self.style.SUCCESS(f'✓ {model_name} успешно мигрирован на UUID'))