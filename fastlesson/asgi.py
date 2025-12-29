import os
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fastlesson.settings')

from django.core.asgi import get_asgi_application
import fastlesson.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            fastlesson.routing.websocket_urlpatterns
        )
    ),
})