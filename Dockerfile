FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    libssl-dev \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/

RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

RUN mkdir -p /app/staticfiles /app/media /app/logs && \
    touch /app/logs/django_errors.log && \
    chmod -R 777 /app/logs && \
    chmod 666 /app/logs/django_errors.log

EXPOSE 8000

CMD ["uvicorn", "fastlesson.asgi:application", "--host", "0.0.0.0", "--port", "8000"]