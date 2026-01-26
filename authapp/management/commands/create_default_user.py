from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import os


class Command(BaseCommand):
    help = 'Создает тестового пользователя при запуске'

    def handle(self, *args, **options):
        User = get_user_model()

        email = os.environ.get('DEFAULT_USER_EMAIL', 'testuser@gmail.com')
        password = os.environ.get('DEFAULT_USER_PASSWORD', '1234')
        username = email.split('@')[0]

        if not User.objects.filter(email=email).exists():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                is_active=True,
            )
            self.stdout.write(
                self.style.SUCCESS(f'✅ Создан пользователь: {email} / {password}')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'⚠️ Пользователь {email} уже существует')
            )