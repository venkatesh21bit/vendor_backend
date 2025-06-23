#!/bin/bash

echo "Running database migrations..."
python manage.py migrate

echo "Creating superuser..."
python manage.py shell < create_superuser.py

echo "Starting gunicorn..."
gunicorn main.wsgi:application --bind 0.0.0.0:$PORT
