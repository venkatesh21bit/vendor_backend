# Use official Python image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Create and set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential libpq-dev

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the rest of your project files
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Run migrations (optional)
RUN python manage.py migrate

# Start Gunicorn server
CMD ["gunicorn", "main.wsgi:application", "--bind", "0.0.0.0:8000"]
