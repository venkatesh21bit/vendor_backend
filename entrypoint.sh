#!/bin/bash
set -e

python manage.py migrate
python manage.py shell < app/create_superuser.py
python manage.py collectstatic --noinput

exec "$@"