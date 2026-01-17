from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.http import JsonResponse

from courses.models import Section, Task, TestTask, TrueFalseTask, ImageTask
from courses.task_serializers import TASK_SERIALIZER_MAP

from core.services import get_display_name_from_username
from classroom.models import Classroom, TestTaskAnswer, TrueFalseTaskAnswer, FillGapsTaskAnswer, MatchCardsTaskAnswer, \
    TextInputTaskAnswer

User = get_user_model()


def get_classroom_section_statistics(request, classroom_id, section_id):
    """
    Возвращает статистику выполнения всех заданий раздела для всех студентов класса.

    Формат выдачи:
    {
        "classroom": {"id": str, "title": str},
        "section": {"id": str, "title": str},
        "tasks": [
            {
                "id": str,
                "task_type": str,
                "statistics": [
                    {
                        "user": {"id": int, "username": str},
                        "correct_answers": int,
                        "wrong_answers": int,
                        "success_percentage": int
                    }, ...
                ]
            }, ...
        ]
    }
    """
    try:
        classroom = Classroom.objects.get(id=classroom_id)
        if request.user != classroom.teacher:
            return JsonResponse({'error': 'Access denied'}, status=403)

        section = Section.objects.get(id=section_id)
        students = classroom.students.all()
        tasks = Task.objects.filter(section=section)

        answer_models = [TestTaskAnswer, TrueFalseTaskAnswer, FillGapsTaskAnswer, MatchCardsTaskAnswer]

        tasks_data = []

        for task in tasks:
            aggregated = {}
            for model in answer_models:
                for item in model.objects.filter(task=task, classroom=classroom).values('user').annotate(
                        total_correct=Sum('correct_answers'),
                        total_wrong=Sum('wrong_answers'),
                        total_answers=Sum('total_answers')
                ):
                    aggregated[item['user']] = {
                        'correct': item['total_correct'] or 0,
                        'wrong': item['total_wrong'] or 0,
                        'total': item['total_answers'] or 0
                    }

            task_stats = []
            for student in students:
                data = aggregated.get(student.id, {'correct': 0, 'wrong': 0, 'total': 0})
                correct = data['correct']
                wrong = data['wrong']
                total = data['total']
                success_percentage = round((correct / (total + wrong)) * 100) if total + wrong > 0 else 0

                task_stats.append({
                    'user': {'id': student.id, 'username': get_display_name_from_username(student.username)},
                    'correct_answers': correct,
                    'wrong_answers': wrong,
                    'success_percentage': success_percentage
                })

            task_stats.sort(key=lambda x: x['success_percentage'], reverse=True)
            tasks_data.append({'id': task.id, 'task_type': task.task_type, 'statistics': task_stats})

        return JsonResponse({
            'classroom': {'id': classroom.id, 'title': classroom.title},
            'section': {'id': section.id, 'title': section.title},
            'tasks': tasks_data
        })

    except (Classroom.DoesNotExist, Section.DoesNotExist):
        return JsonResponse({'error': 'Не найдено'}, status=404)
    except Exception as e:
        print(e)
        return JsonResponse({'error': str(e)}, status=500)


def get_classroom_task_statistics(request, classroom_id, task_id):
    """
    Возвращает статистику выполнения конкретного задания для всех студентов класса.

    Формат выдачи:
    {
        "classroom": {"id": str, "title": str},
        "task": {"id": str, "title": str, "task_type": str},
        "statistics": [
            {
                "user": {"id": int, "username": str},
                "correct_answers": int,
                "wrong_answers": int,
                "success_percentage": int
            }, ...
        ]
    }
    """
    try:
        classroom = Classroom.objects.get(id=classroom_id)
        if request.user != classroom.teacher:
            return JsonResponse({'error': 'Access denied'}, status=403)

        task = Task.objects.get(id=task_id)
        students = classroom.students.all()
        answer_models = [TestTaskAnswer, TrueFalseTaskAnswer, FillGapsTaskAnswer, MatchCardsTaskAnswer]

        aggregated = {}
        for model in answer_models:
            for item in model.objects.filter(task=task, classroom=classroom).values('user').annotate(
                    total_correct=Sum('correct_answers'),
                    total_wrong=Sum('wrong_answers'),
                    total_answers=Sum('total_answers')
            ):
                aggregated[item['user']] = {
                    'correct': item['total_correct'] or 0,
                    'wrong': item['total_wrong'] or 0,
                    'total': item['total_answers'] or 0
                }

        statistics = []
        for student in students:
            data = aggregated.get(student.id, {'correct': 0, 'wrong': 0, 'total': 0})
            correct = data['correct']
            wrong = data['wrong']
            total = data['total']
            success_percentage = round((correct / (total + wrong)) * 100) if total + wrong > 0 else 0

            statistics.append({
                'user': {'id': student.id, 'username': get_display_name_from_username(student.username)},
                'correct_answers': correct,
                'wrong_answers': wrong,
                'success_percentage': success_percentage
            })

        statistics.sort(key=lambda x: x['success_percentage'], reverse=True)

        return JsonResponse({
            'classroom': {'id': classroom.id, 'title': classroom.title},
            'task': {'id': task.id, 'title': task.title, 'task_type': task.task_type},
            'statistics': statistics
        })

    except Classroom.DoesNotExist:
        return JsonResponse({'error': 'Класс не найден'}, status=404)
    except Task.DoesNotExist:
        return JsonResponse({'error': 'Задача не найдена'}, status=404)
    except Exception as e:
        print(e)
        return JsonResponse({'error': str(e)}, status=500)
