from django.contrib import admin

from classroom.models import Classroom, TestTaskAnswer, TrueFalseTaskAnswer, FillGapsTaskAnswer, \
    MatchCardsTaskAnswer, TextInputTaskAnswer

admin.site.register(Classroom)
admin.site.register(TestTaskAnswer)
admin.site.register(TrueFalseTaskAnswer)
admin.site.register(FillGapsTaskAnswer)
admin.site.register(MatchCardsTaskAnswer)
admin.site.register(TextInputTaskAnswer)
