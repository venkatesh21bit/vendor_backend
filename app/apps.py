from django.apps import AppConfig


class SonyappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app'
    def ready(self):
        import app.signals