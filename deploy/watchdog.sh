#!/usr/bin/env bash
# Сторож: раз в пять минут проверяет, что система жива, и чинит то, что чинится
# перезапуском. Результат кладёт в файл состояния, который приложение показывает
# администратору, и — если настроен канал — отправляет уведомление.
#
# Намеренно без set -e: если одна проверка сломалась, остальные должны отработать.
set -uo pipefail

PORT="${PORT:-4000}"
DATA_DIR="${DATA_DIR:-/var/lib/360profi}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/360profi}"
DOMAIN="${DOMAIN:-}"
STATE_FILE="${STATE_FILE:-$DATA_DIR/watchdog.json}"
RESTART_STAMP="$DATA_DIR/.watchdog-last-restart"

# Перезапускаем не чаще раза в час: если сервис падает сразу после старта,
# бесконечный цикл перезапусков только скроет проблему.
RESTART_COOLDOWN=3600

problems=()
now_iso="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- API отвечает? -----------------------------------------------------------
# Три попытки с паузой: сервис могли только что перезапустить, и одна неудачная
# проверка не повод дёргать systemctl. Сторож, дёргающий сервис по любому
# всплеску, вреднее его отсутствия.
check_api() {
  local start_ns
  start_ns=$(date +%s%N)
  if curl -fsS --max-time 8 "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1; then
    api_ms=$(( ($(date +%s%N) - start_ns) / 1000000 ))
    return 0
  fi
  return 1
}

api_ok=false
api_ms=0
for attempt in 1 2 3; do
  if check_api; then
    api_ok=true
    break
  fi
  (( attempt < 3 )) && sleep 3
done

service_state="$(systemctl is-active 360profi-api 2>/dev/null || echo unknown)"

restarted=false
if [[ "$api_ok" == false ]]; then
  problems+=("API не отвечает (сервис: $service_state)")

  last_restart=0
  [[ -f "$RESTART_STAMP" ]] && last_restart="$(cat "$RESTART_STAMP" 2>/dev/null || echo 0)"
  if (( $(date +%s) - last_restart > RESTART_COOLDOWN )); then
    systemctl restart 360profi-api >/dev/null 2>&1
    date +%s > "$RESTART_STAMP"
    restarted=true
    sleep 5
    if check_api; then
      api_ok=true
      problems+=("перезапустил сервис — поднялся")
    else
      problems+=("перезапустил сервис — не помогло, нужен человек")
    fi
  else
    problems+=("перезапуск пропущен: недавно уже перезапускали")
  fi
fi

# --- Место на диске ----------------------------------------------------------
disk_used=$(df --output=pcent "$DATA_DIR" 2>/dev/null | tail -1 | tr -dc '0-9')
disk_used=${disk_used:-0}
if (( disk_used >= 90 )); then
  problems+=("на диске занято ${disk_used}% — скоро писать будет некуда")
fi

# --- Свежесть бэкапа ---------------------------------------------------------
backup_age_h=-1
newest_backup="$(ls -t "$BACKUP_DIR"/360profi_*.db.gz 2>/dev/null | head -1)"
if [[ -n "$newest_backup" ]]; then
  backup_age_h=$(( ( $(date +%s) - $(stat -c %Y "$newest_backup") ) / 3600 ))
  # Бэкап раз в сутки; сутки с лишним без копии — уже повод сказать.
  if (( backup_age_h > 30 )); then
    problems+=("последний бэкап $backup_age_h ч назад")
  fi
elif [[ -f "$DATA_DIR/360profi.db" ]]; then
  # На свежей установке бэкапа ещё не было и быть не могло: таймер суточный.
  # Ругаемся, только если система живёт дольше, чем интервал бэкапа.
  db_age_h=$(( ( $(date +%s) - $(stat -c %Y "$DATA_DIR/360profi.db") ) / 3600 ))
  if (( db_age_h > 30 )); then
    problems+=("бэкапов нет, хотя система работает $db_age_h ч")
  fi
fi

# --- Срок сертификата --------------------------------------------------------
cert_days=-1
if [[ -n "$DOMAIN" && -f "/etc/letsencrypt/live/$DOMAIN/cert.pem" ]]; then
  cert_end="$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" 2>/dev/null | cut -d= -f2)"
  if [[ -n "$cert_end" ]]; then
    cert_days=$(( ( $(date -d "$cert_end" +%s) - $(date +%s) ) / 86400 ))
    # Обновление автоматическое, но если оно сломалось — узнать хочется заранее.
    (( cert_days < 14 )) && problems+=("сертификат кончается через $cert_days дн — автопродление не сработало")
  fi
fi

# --- Состояние в файл --------------------------------------------------------
status="ok"
(( ${#problems[@]} > 0 )) && status="problem"

mkdir -p "$(dirname "$STATE_FILE")"
{
  printf '{\n'
  printf '  "checkedAt": "%s",\n' "$now_iso"
  printf '  "status": "%s",\n' "$status"
  printf '  "apiOk": %s,\n' "$api_ok"
  printf '  "apiMs": %s,\n' "$api_ms"
  printf '  "service": "%s",\n' "$service_state"
  printf '  "diskUsedPercent": %s,\n' "$disk_used"
  printf '  "backupAgeHours": %s,\n' "$backup_age_h"
  printf '  "certDaysLeft": %s,\n' "$cert_days"
  printf '  "restarted": %s,\n' "$restarted"
  printf '  "problems": ['
  for i in "${!problems[@]}"; do
    (( i > 0 )) && printf ', '
    printf '"%s"' "${problems[$i]//\"/\\\"}"
  done
  printf ']\n}\n'
} > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

chown profi360:profi360 "$STATE_FILE" 2>/dev/null || true

# --- Уведомление -------------------------------------------------------------
# Шлём только при появлении проблемы и при возвращении к норме. Сторож, который
# пишет каждые пять минут «всё хорошо», превращается в шум и его отключают.
PREV_STATUS_FILE="$DATA_DIR/.watchdog-last-status"
prev_status="$(cat "$PREV_STATUS_FILE" 2>/dev/null || echo ok)"
echo "$status" > "$PREV_STATUS_FILE"

if [[ -n "${WEBHOOK_URL:-}" && "$status" != "$prev_status" ]]; then
  if [[ "$status" == "problem" ]]; then
    text="360PROFI: проблема на сервере"$'\n'"$(printf '%s\n' "${problems[@]}")"
  else
    text="360PROFI: всё восстановилось, система работает"
  fi
  curl -fsS --max-time 10 -X POST "$WEBHOOK_URL" \
    -H 'content-type: application/json' \
    -d "$(printf '{"kind":"watchdog","text":%s}' "$(printf '%s' "$text" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "${text//$'\n'/ }")")" \
    >/dev/null 2>&1 || true
fi

if [[ "$status" == "ok" ]]; then
  echo "$now_iso ok (api ${api_ms}ms, диск ${disk_used}%, бэкап ${backup_age_h}ч, сертификат ${cert_days}дн)"
else
  printf '%s ПРОБЛЕМА: %s\n' "$now_iso" "$(printf '%s; ' "${problems[@]}")"
fi
