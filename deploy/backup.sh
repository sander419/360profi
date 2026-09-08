#!/usr/bin/env bash
# Бэкап базы и снимков.
#
# Копия делается через VACUUM INTO: при включённом WAL обычный cp файла может
# дать битую копию. Делаем это тем же Node, что и сервер, а не системным sqlite3:
# в старых дистрибутивах он не знает VACUUM INTO, и бэкап молча ломается.
set -euo pipefail

DB_PATH="${DB_PATH:-/var/lib/360profi/360profi.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/360profi}"
KEEP_DAYS="${KEEP_DAYS:-30}"
PHOTO_DIR="${PHOTO_DIR:-$(dirname "$DB_PATH")/photos}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
TARGET="$BACKUP_DIR/360profi_$STAMP.db"

node -e '
  const { DatabaseSync } = require("node:sqlite");
  const [source, target] = process.argv.slice(1);
  const db = new DatabaseSync(source);
  db.exec(`VACUUM INTO ${"'"'"'" + target.replace(/'"'"'/g, "'"'"''"'"'") + "'"'"'"}`);
  db.close();
' "$DB_PATH" "$TARGET"

gzip -f "$TARGET"
find "$BACKUP_DIR" -name '360profi_*.db.gz' -mtime "+$KEEP_DAYS" -delete

echo "База: $TARGET.gz ($(du -h "$TARGET.gz" | cut -f1)), храним $KEEP_DAYS дней"

# Проверка, что копия читается: бэкап, который не открывается, хуже отсутствия бэкапа.
gzip -t "$TARGET.gz"
echo "Целостность архива подтверждена"

# Снимки поломок лежат файлами рядом с базой, и без них восстановленная база
# будет ссылаться в пустоту. Держим зеркало: копируются только новые файлы.
if [ -d "$PHOTO_DIR" ]; then
  mkdir -p "$BACKUP_DIR/photos"
  cp -ru "$PHOTO_DIR/." "$BACKUP_DIR/photos/"
  echo "Снимки: $(find "$BACKUP_DIR/photos" -type f | wc -l) шт, $(du -sh "$BACKUP_DIR/photos" | cut -f1)"
fi
