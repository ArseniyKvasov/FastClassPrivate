from django.contrib.auth.backends import BaseBackend
from .models import User


class SocialIDBackend(BaseBackend):
    def authenticate(self, request, vk_id=None, yandex_id=None):
        try:
            if vk_id:
                return User.objects.get(vk_id=vk_id)
            if yandex_id:
                return User.objects.get(yandex_id=yandex_id)
        except User.DoesNotExist:
            return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
