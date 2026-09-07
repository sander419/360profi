#!/usr/bin/env bash
# Установка 360PROFI на чистый Ubuntu 22.04/24.04. Скрипт идемпотентный:
# повторный запуск обновляет код и перезапускает сервис, ничего не ломая.
#
#   sudo DOMAIN=sklad.example.ru bash deploy/install.sh
#
# Что делает: ставит Node 22, заводит пользователя profi360, кладёт код в
# /opt/360profi, базу в /var/lib/360profi, собирает фронт, включает systemd-юниты
# и бэкап по таймеру. TLS выпускается отдельно: certbot --nginx -d $DOMAIN
set -euo pipefail

DOMAIN="${DOMAIN:-}"
REPO="${REPO:-https://github.com/sander419/360profi.git}"
APP_DIR=/opt/360profi
DATA_DIR=/var/lib/360profi
WWW_DIR=/var/www/360profi
ENV_FILE=/etc/360profi.env

if [[ $EUID -ne 0 ]]; then
  echo "Запускать через sudo" >&2
  exit 1
fi

if [[ -z "$DOMAIN" ]]; then
  echo "Укажите домен: sudo DOMAIN=sklad.example.ru bash deploy/install.sh" >&2
  exit 1
fi

echo "==> Пакеты"
apt-get update -qq
apt-get install -y -qq curl git nginx ca-certificates >/dev/null

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt 22 ]]; then
  echo "==> Node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "    node $(node -v)"

echo "==> Пользователь и каталоги"
id -u profi360 >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin profi360
mkdir -p "$APP_DIR" "$DATA_DIR" "$WWW_DIR" /var/backups/360profi

echo "==> Код"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --quiet origin
  git -C "$APP_DIR" reset --hard --quiet origin/main
else
  git clone --quiet "$REPO" "$APP_DIR"
fi

echo "==> Секрет и переменные"
if [[ ! -f "$ENV_FILE" ]]; then
  SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '=+/' | cut -c1-64)"
  cat > "$ENV_FILE" <<EOF
# Подпись токенов. Смена секрета разлогинивает всех — так и отзывают доступ разом.
JWT_SECRET=$SECRET
# Фронт и API на одном домене, поэтому сторонние источники не разрешаем.
CORS_ORIGIN=https://$DOMAIN
EOF
  chmod 600 "$ENV_FILE"
  echo "    создан $ENV_FILE"
else
  echo "    $ENV_FILE уже есть, не трогаем"
fi

echo "==> Зависимости и сборка"
npm --prefix "$APP_DIR/server" ci --omit=dev --silent
# Фронт собирается с адресом API на том же домене: полевой режим включается этим.
# npm install, а не ci: у фронта в репозитории лок-файл bun, package-lock.json нет.
VITE_API_URL="https://$DOMAIN" npm --prefix "$APP_DIR" install --silent --no-audit --no-fund
VITE_API_URL="https://$DOMAIN" npm --prefix "$APP_DIR" run build --silent
rm -rf "${WWW_DIR:?}"/*
cp -r "$APP_DIR/dist/." "$WWW_DIR/"

echo "==> Права"
chown -R profi360:profi360 "$APP_DIR" "$DATA_DIR" /var/backups/360profi
chmod +x "$APP_DIR/deploy/backup.sh"

echo "==> systemd"
cp "$APP_DIR/deploy/360profi-api.service" /etc/systemd/system/
cp "$APP_DIR/deploy/360profi-backup.service" /etc/systemd/system/
cp "$APP_DIR/deploy/360profi-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now 360profi-api.service
systemctl enable --now 360profi-backup.timer
systemctl restart 360profi-api.service

echo "==> nginx"
sed "s/sklad.example.ru/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/360profi
ln -sf /etc/nginx/sites-available/360profi /etc/nginx/sites-enabled/360profi
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Проверка"
sleep 2
curl -fsS http://127.0.0.1:4000/api/v1/health && echo

cat <<EOF

Готово.

Дальше вручную:
  1. TLS:            certbot --nginx -d $DOMAIN
  2. Первые люди:    cd $APP_DIR/server && sudo -u profi360 node src/import-users.ts people.csv
  3. Наклейки:       PUBLIC_APP_URL=https://$DOMAIN/ sudo -u profi360 node src/labels.ts
  4. Открыть:        https://$DOMAIN/#/field

Логи:      journalctl -u 360profi-api -f
Бэкапы:    systemctl list-timers 360profi-backup, файлы в /var/backups/360profi
Обновление: sudo DOMAIN=$DOMAIN bash $APP_DIR/deploy/install.sh
EOF
