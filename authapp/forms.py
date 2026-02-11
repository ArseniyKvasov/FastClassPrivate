from django import forms

class TelegramAuthForm(forms.Form):
    id = forms.IntegerField()
    first_name = forms.CharField(required=False)
    last_name = forms.CharField(required=False)
    username = forms.CharField(required=False)
    photo_url = forms.URLField(required=False)
    auth_date = forms.IntegerField()
    hash = forms.CharField()
