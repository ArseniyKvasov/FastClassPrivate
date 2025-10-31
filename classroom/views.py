from django.shortcuts import render

def classroom_view(request):
    return render(request, "classroom/classroom.html")
