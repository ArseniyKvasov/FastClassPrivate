import json
from typing import Optional
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.apps import apps


class VirtualClassConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        Classroom = apps.get_model("classroom", "Classroom")

        self.classroom_id: Optional[str] = (
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

    async def disconnect(self, close_code):
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

        if self.is_teacher:
            if student_id is None:
                await self.send_error("student_id is required for teacher messages")
                return
            await self._handle_teacher_message(action_type, task_id, student_id, data)
            return

        if self.is_student:
            await self._handle_student_message(action_type, task_id, data)
            return

        await self.send_error("Unauthorized action")

    async def _handle_chat_message(self, action_type, payload):
        """Обработка сообщений чата"""
        text = payload.get("text")

        if action_type == "chat:send_message":
            if not text:
                await self.send_error("Message text is required for chat")
                return

            sender_name = await self._get_user_name()

            # Ученики и учителя отправляют сообщения всем КРОМЕ себя
            await self.channel_layer.group_send(
                self.groups_map["classroom"],
                {
                    "type": "chat_message_event",
                    "action": action_type,
                    "sender_id": self.user_id,
                    "sender_name": sender_name,
                    "text": text,
                    "student_id": "all",
                    "payload": payload,
                }
            )
        elif action_type == "chat:update":
            # Обновление чата (редактирование/удаление) отправляется всем КРОМЕ себя
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
            await self.send_error("Target student does not belong to this classroom")
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
            "sender_name": getattr(self.user, "first_name", "") or getattr(self.user, "username", "Anonymous"),
            "payload": payload,
        }

    async def classroom_broadcast_event(self, event):
        await self._send_event(event)

    async def user_targeted_event(self, event):
        await self._send_event(event)

    async def student_to_teacher_event(self, event):
        await self._send_event(event)

    async def chat_message_event(self, event):
        """Обработчик сообщений чата - отправляет всем КРОМЕ отправителя"""
        # Проверяем, не отправляем ли сообщение самому отправителю
        if event.get("sender_id") == self.user_id:
            return  # Пропускаем отправку себе

        await self.send(text_data=json.dumps({
            "type": "chat:send_message",
            "data": {
                "text": event.get("text"),
                "sender_id": event.get("sender_id"),
                "sender_name": event.get("sender_name"),
                "student_id": event.get("student_id"),
            }
        }))

    async def chat_update_event(self, event):
        """Обработчик обновлений чата - отправляет всем КРОМЕ отправителя"""
        # Проверяем, не отправляем ли сообщение самому отправителю
        if event.get("sender_id") == self.user_id:
            return  # Пропускаем отправку себе

        await self.send(text_data=json.dumps({
            "type": "chat:update",
            "data": {
                "sender_id": event.get("sender_id"),
                "student_id": event.get("student_id"),
                "payload": event.get("payload"),
            }
        }))

    async def _send_event(self, event):
        """Отправка обычных событий - также пропускаем отправку себе"""
        # Для teacher->student сообщений, учитель получает копию когда отправляет всем
        # Для student->teacher, студент НЕ должен получать копию
        sender_id = event.get("sender_id")

        # Если это teacher отправляет "all", teacher получает копию
        # Если это teacher отправляет конкретному student, teacher НЕ получает копию
        # Если это student отправляет teacher, student НЕ получает копию

        if event.get("action") in ["answer:sent", "answer:reset"]:
            # Student отправляет учителю - студент не должен получать
            if self.is_student and sender_id == self.user_id:
                return

        await self.send(text_data=json.dumps({
            "type": event.get("action"),
            "data": {
                "task_id": event.get("task_id"),
                "student_id": event.get("student_id"),
                "sender_id": event.get("sender_id"),
                "sender_username": event.get("sender_username"),
                "sender_name": event.get("sender_name"),
                "payload": event.get("payload"),
            }
        }))

    async def send_error(self, message: str):
        await self.send(text_data=json.dumps({"type": "error", "message": message}))

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
        """Получает отображаемое имя пользователя"""
        if self.user.username:
            return self.user.username
        return "Anonymous"