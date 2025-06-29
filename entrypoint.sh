#!/bin/bash
set -x
echo "🚀 ENTRYPOINT: Running Django migrations and starting server..."

echo "Running database migrations..."
python manage.py migrate zero
python manage.py makemigrations
python manage.py migrate

echo "Creating superuser..."
python manage.py shell < create_superuser.py

echo "Starting gunicorn..."
exec gunicorn main.wsgi:application --bind 0.0.0.0:$PORT
