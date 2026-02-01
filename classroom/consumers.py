import json
import asyncio
from typing import Optional
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.apps import apps


class VirtualClassConsumer(AsyncWebsocketConsumer):
    _active_connections = {}
    _lock = asyncio.Lock()

    async def connect(self):
        Classroom = apps.get_model("classroom", "Classroom")

        self.classroom_id = (
            self.scope.get("url_route", {}).get("kwargs", {}).get("classroom_id")
        )
        self.user = self.scope.get("user")
        self.user_id = getattr(self.user, "id", None)

        if not self.classroom_id or not self.user or not self.user.is_authenticated:
            await self.close()
            return

        try:
            self.classroom = await database_sync_to_async(Classroom.objects.get)(id=self.classroom_id)
        except Classroom.DoesNotExist:
            await self.close()
            return

        self.is_teacher = await self._is_teacher()
        self.is_student = await self._is_student()
        if not (self.is_teacher or self.is_student):
            await self.close()
            return

        self.groups_map = {
            "classroom": f"classroom_{self.classroom_id}",
            "user": f"user_{self.user_id}",
            "students": f"classroom_{self.classroom_id}_students",
            "teacher": f"classroom_{self.classroom_id}_teacher",
        }

        await self.channel_layer.group_add(self.groups_map["classroom"], self.channel_name)
        await self.channel_layer.group_add(self.groups_map["user"], self.channel_name)

        if self.is_student:
            await self.channel_layer.group_add(self.groups_map["students"], self.channel_name)
        if self.is_teacher:
            await self.channel_layer.group_add(self.groups_map["teacher"], self.channel_name)

        await self.accept()

        await self.send(text_data=json.dumps({
            "type": "connected",
            "data": {
                "classroom_id": self.classroom_id,
                "user_id": self.user_id,
                "is_teacher": self.is_teacher,
            }
        }))

        if self.is_student:
            await self._send_online_status_to_teacher(online=True)

    async def disconnect(self, close_code):
        if hasattr(self, 'is_student') and self.is_student:
            await self._send_online_status_to_teacher(online=False)

        if not hasattr(self, "groups_map"):
            return
        for group in self.groups_map.values():
            try:
                await self.channel_layer.group_discard(group, self.channel_name)
            except Exception:
                pass

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
            return

        action_type = payload.get("type")
        data = payload.get("data", {}) or {}
        task_id = data.get("task_id")
        student_id = data.get("student_id")

        if not action_type:
            await self.send_error("Message 'type' is required")
            return

        if action_type in ["chat:send_message", "chat:update"]:
            await self._handle_chat_message(action_type, data)
            return

        if action_type == "user:delete":
            await self._handle_user_delete(data)
            return

        if self.is_teacher:
            if action_type == "users:online":
                await self._handle_users_online()
                return

            if student_id is None:
                await self.send_error("student_id обязателен для учительского сообщения")
                return
            await self._handle_teacher_message(action_type, task_id, student_id, data)
            return

        if self.is_student:
            await self._handle_student_message(action_type, task_id, data)
            return

        await self.send_error("Доступ запрещен.")

    async def _handle_user_delete(self, payload):
        if not self.is_teacher:
            await self.send_error("Только учитель может удалить ученика")
            return

        student_id = payload.get("student_id")
        if not student_id:
            await self.send_error("student_id is required for user:delete")
            return

        await self.channel_layer.group_send(
            f"user_{student_id}",
            {
                "type": "user_deleted_event",
                "action": "user:delete",
                "student_id": student_id,
                "sender_id": self.user_id,
                "sender_username": getattr(self.user, "username", "Anonymous"),
                "payload": payload,
            }
        )

        await self.channel_layer.group_send(
            self.groups_map["teacher"],
            {
                "type": "user_deleted_event",
                "action": "user:delete",
                "student_id": student_id,
                "sender_id": self.user_id,
                "sender_username": getattr(self.user, "username", "Anonymous"),
                "payload": payload,
            }
        )

    async def _handle_users_online(self):
        if not self.is_teacher:
            await self.send_error("Only teacher can request users online")
            return

        students = await database_sync_to_async(list)(
            self.classroom.students.all().values_list("id", flat=True)
        )

        online_list = []
        async with self._lock:
            for student_id in students:
                key = (self.classroom_id, student_id)
                online_list.append({
                    "student_id": student_id,
                    "online": self._active_connections.get(key, 0) > 0,
                })

        await self.send(text_data=json.dumps({
            "type": "users:online",
            "data": online_list
        }))

    async def _handle_chat_message(self, action_type, payload):
        text = payload.get("text")
        message_id = payload.get("message_id")

        if action_type == "chat:send_message":
            if not text:
                await self.send_error("Добавьте текст сообщения")
                return

            sender_name = await self._get_user_name()

            await self.channel_layer.group_send(
                self.groups_map["classroom"],
                {
                    "type": "chat_message_event",
                    "action": action_type,
                    "message_id": message_id,
                    "sender_id": self.user_id,
                    "sender_name": sender_name,
                    "text": text,
                    "student_id": "all",
                    "payload": payload,
                }
            )
        elif action_type == "chat:update":
            await self.channel_layer.group_send(
                self.groups_map["classroom"],
                {
                    "type": "chat_update_event",
                    "action": action_type,
                    "sender_id": self.user_id,
                    "student_id": "all",
                    "payload": payload,
                }
            )

    async def _handle_teacher_message(self, action_type, task_id, student_id, payload):
        if student_id == "all":
            await self.channel_layer.group_send(
                self.groups_map["students"],
                self._format_event("classroom_broadcast", action_type, task_id, student_id, payload)
            )
            return

        if not await self._student_in_class(student_id):
            await self.send_error("Ученик не находится в классе")
            return

        await self.channel_layer.group_send(
            f"user_{student_id}",
            self._format_event("user_targeted", action_type, task_id, student_id, payload)
        )

    async def _handle_student_message(self, action_type, task_id, payload):
        await self.channel_layer.group_send(
            self.groups_map["teacher"],
            self._format_event("student_to_teacher", action_type, task_id, str(self.user_id), payload)
        )

    def _format_event(self, event_type, action, task_id, student_id, payload):
        return {
            "type": f"{event_type}_event",
            "action": action,
            "task_id": task_id,
            "student_id": student_id,
            "sender_id": self.user_id,
            "sender_username": getattr(self.user, "username", "Anonymous"),
            "payload": payload,
        }

    async def classroom_broadcast_event(self, event):
        await self._send_event(event)

    async def user_targeted_event(self, event):
        await self._send_event(event)

    async def student_to_teacher_event(self, event):
        await self._send_event(event)

    async def chat_message_event(self, event):
        if event.get("sender_id") == self.user_id:
            return
        await self.send(text_data=json.dumps({
            "type": "chat:send_message",
            "data": {
                "message_id": event.get("message_id"),
                "text": event.get("text"),
                "sender_id": event.get("sender_id"),
                "sender_name": event.get("sender_name"),
                "student_id": event.get("student_id"),
            }
        }))

    async def chat_update_event(self, event):
        if event.get("sender_id") == self.user_id:
            return
        await self.send(text_data=json.dumps({
            "type": "chat:update",
            "data": {
                "sender_id": event.get("sender_id"),
                "student_id": event.get("student_id"),
                "payload": event.get("payload"),
            }
        }))

    async def user_online_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "user:online:event",
            "data": {
                "student_id": event.get("student_id"),
                "student_username": event.get("student_username"),
            }
        }))

    async def user_offline_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "user:offline:event",
            "data": {
                "student_id": event.get("student_id"),
            }
        }))

    async def user_deleted_event(self, event):
        if self.is_student and str(self.user_id) == str(event.get("student_id")):
            try:
                await self.send(text_data=json.dumps({
                    "type": "user:deleted",
                    "data": {
                        "student_id": event.get("student_id"),
                        "message": "Вы были удалены из класса",
                    }
                }))
            except:
                pass
            return

        if self.is_teacher and str(self.user_id) != str(event.get("sender_id")):
            try:
                await self.send(text_data=json.dumps({
                    "type": "user:delete:event",
                    "data": {
                        "student_id": event.get("student_id"),
                        "deleted_by": event.get("sender_id"),
                    }
                }))
            except:
                pass

    async def lesson_attached(self, event):
        try:
            await self.send(text_data=json.dumps({
                "type": "lesson:attached",
                "data": {
                    "lesson_id": event.get("lesson_id"),
                    "payload": event.get("payload", {}),
                }
            }))
        except:
            pass

    async def _send_event(self, event):
        sender_id = event.get("sender_id")
        if event.get("action") in ["answer:sent", "answer:reset"]:
            if self.is_student and sender_id == self.user_id:
                return
        try:
            await self.send(text_data=json.dumps({
                "type": event.get("action"),
                "data": {
                    "task_id": event.get("task_id"),
                    "student_id": event.get("student_id"),
                    "sender_id": event.get("sender_id"),
                    "sender_username": event.get("sender_username"),
                    "payload": event.get("payload"),
                }
            }))
        except:
            pass

    async def send_error(self, message: str):
        try:
            await self.send(text_data=json.dumps({"type": "error", "message": message}))
        except:
            pass

    async def _send_online_status_to_teacher(self, online: bool):
        async with self._lock:
            key = (self.classroom_id, self.user_id)
            current_count = self._active_connections.get(key, 0)

            if online:
                if current_count == 0:
                    try:
                        sender_name = await self._get_user_name()

                        await self.channel_layer.group_send(
                            self.groups_map["teacher"],
                            {
                                "type": "user_online_event",
                                "student_id": str(self.user_id),
                                "student_username": sender_name,
                                "online": True,
                            }
                        )
                    except:
                        pass
                self._active_connections[key] = current_count + 1
            else:
                if current_count == 1:
                    try:
                        await self.channel_layer.group_send(
                            self.groups_map["teacher"],
                            {
                                "type": "user_offline_event",
                                "student_id": str(self.user_id),
                                "online": False,
                            }
                        )
                    except:
                        pass
                    del self._active_connections[key]
                elif current_count > 1:
                    self._active_connections[key] = current_count - 1

    @database_sync_to_async
    def _is_teacher(self) -> bool:
        return self.classroom.teacher_id == self.user_id

    @database_sync_to_async
    def _is_student(self) -> bool:
        return self.classroom.students.filter(id=self.user_id).exists()

    @database_sync_to_async
    def _student_in_class(self, student_id) -> bool:
        try:
            sid = int(student_id)
        except (ValueError, TypeError):
            return False
        return self.classroom.students.filter(id=sid).exists()

    @database_sync_to_async
    def _get_user_name(self) -> str:
        from core.services import get_display_name_from_username
        if self.user.username:
            return get_display_name_from_username(self.user.username)
        return "Anonymous"
