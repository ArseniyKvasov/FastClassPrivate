from classroom.models import Classroom

def get_current_lesson(classroom_id):
    classroom = Classroom.objects.get(pk=classroom_id)
    return classroom.lesson