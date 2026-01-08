from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.contrib.auth.decorators import login_required

from classroom.services import send_chat_message, get_last_chat_messages, edit_chat_message, delete_chat_message

@login_required
@require_GET
def chat_messages(request, classroom_id):
    messages = get_last_chat_messages(
        classroom_id=classroom_id,
        limit=50
    )

    data = [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.username,
            "text": m.text,
            "created_at": m.created_at.isoformat(),
        }
        for m in reversed(messages)
    ]

    return JsonResponse({"messages": data})

@login_required
@require_POST
def chat_send(request, classroom_id):
    text = request.POST.get("text", "")[:250]

    message = send_chat_message(
        sender=request.user,
        classroom_id=classroom_id,
        text=text
    )

    return JsonResponse({
        "message": {
            "id": message.id,
            "sender_id": message.sender_id,
            "sender_name": message.sender.username,
            "text": message.text,
            "created_at": message.created_at.isoformat(),
        }
    })

@login_required
@require_POST
def chat_edit(request, message_id):
    new_text = request.POST.get("text", "")

    message = edit_chat_message(
        user=request.user,
        message_id=message_id,
        new_text=new_text
    )

    return JsonResponse({
        "id": message.id,
        "text": message.text,
    })

@login_required
@require_POST
def chat_delete(request, message_id):
    delete_chat_message(
        user=request.user,
        message_id=message_id
    )

    return JsonResponse({"success": True})
