from django.urls import re_path

from classroom.consumers import VirtualClassConsumer


websocket_urlpatterns = [
    re_path(
        r"ws/virtual-class/(?P<classroom_id>\d+)/$",
        VirtualClassConsumer.as_asgi(),
    ),
]
