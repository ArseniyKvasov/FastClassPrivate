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

RUN useradd -m -u 1000 fastclass && \
    mkdir -p /app/staticfiles /app/media && \
    chown -R fastclass:fastclass /app && \
    chmod -R 755 /app/staticfiles /app/media

USER fastclass

EXPOSE 8000