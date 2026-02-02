set -e

echo "Starting FastClass application..."

mkdir -p /app/staticfiles
mkdir -p /app/media
chmod -R 755 /app/staticfiles
chmod -R 755 /app/media

echo "Запуск БД..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.5
done
echo "БД готова!"

echo "Запуск Redis..."
while ! nc -z $REDIS_HOST $REDIS_PORT; do
  sleep 0.5
done
echo "Redis готов!"

echo "Применение миграций..."
python manage.py migrate --noinput

echo "Сброс статики..."
python manage.py collectstatic --noinput --clear

if [ "$DEBUG" = "True" ]; then
    echo "Создание суперпользователя..."
    python manage.py createsuperuser --noinput || echo "Суперпользователь уже существует или произошла ошибка"
fi

if [ -z "$UVICORN_WORKERS" ]; then
    if [ "$DEBUG" = "True" ]; then
        WORKERS=1
    else
        WORKERS=$(($(nproc) * 2 + 1))
    fi
else
    WORKERS=$UVICORN_WORKERS
fi

echo "Запуск UVICORN с $WORKERS workers..."
exec uvicorn fastlesson.asgi:application \
    --host 0.0.0.0 \
    --port 8000 \
    --workers $WORKERS \
    --log-level ${UVICORN_LOG_LEVEL:-info}