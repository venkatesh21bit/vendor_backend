# main/create_superuser.py
from django.contrib.auth import get_user_model

User = get_user_model()

if not User.objects.filter(username="admin").exists():
    User.objects.create_superuser("venkatesh", "venkatesh.k21062005@gmail.com", "venkat*2005")
    print("Superuser created.")
else:
    print("Superuser already exists.")
