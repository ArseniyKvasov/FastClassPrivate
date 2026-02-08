from django.contrib import admin
from courses.models import Course, Lesson, Section, TestTask

admin.site.register(Course)
admin.site.register(Lesson)
admin.site.register(Section)
admin.site.register(TestTask)
