#!/usr/bin/env bash
# Бэкап базы. VACUUM INTO делает целостную копию на работающем сервере,
# просто cp файла при включённом WAL может дать битую копию.
set -euo pipefail

DB_PATH="${DB_PATH:-/var/lib/360profi/360profi.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/360profi}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
TARGET="$BACKUP_DIR/360profi_$STAMP.db"

# sqlite3 в системе может отсутствовать — тогда работаем тем же node, что и сервер.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" "VACUUM INTO '$TARGET'"
else
  node -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.argv[1]);
    db.exec(\`VACUUM INTO '\${process.argv[2].replace(/'/g, \"''\")}'\`);
    db.close();
  " "$DB_PATH" "$TARGET"
fi

gzip -f "$TARGET"
find "$BACKUP_DIR" -name '360profi_*.db.gz' -mtime "+$KEEP_DAYS" -delete

echo "Бэкап: $TARGET.gz ($(du -h "$TARGET.gz" | cut -f1)), храним $KEEP_DAYS дней"

# Проверка, что копия читается: бэкап, который не открывается, хуже отсутствия бэкапа.
gzip -t "$TARGET.gz"
echo "Целостность архива подтверждена"
