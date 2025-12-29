from django.urls import re_path

from classroom.consumers import VirtualClassConsumer

websocket_urlpatterns = [
    re_path(r"ws/virtual-class/(?P<classroom_id>[A-Za-z0-9_-]+)/$", VirtualClassConsumer.as_asgi()),
]
