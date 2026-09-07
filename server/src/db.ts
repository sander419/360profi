// Открытие базы и накат миграций.
//
// Используется встроенный в Node модуль node:sqlite: не нужен ни отдельный
// сервер БД, ни нативная сборка (better-sqlite3 требует компилятора).

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'migrations');

export type Db = DatabaseSync;

export const uid = (): string => crypto.randomUUID();

export const nowIso = (): string => new Date().toISOString();

// Календарная дата в часовом поясе сервера. Резать ISO-строку нельзя:
// она в UTC, и вечерняя отметка попала бы на предыдущий день.
export const isoDateOf = (date: Date): string => {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${day}`;
};

export const todayIso = (): string => isoDateOf(new Date());

export const defaultDbPath = (): string =>
  process.env.DB_PATH || path.join(SERVER_ROOT, 'data', '360profi.db');

// Версия схемы хранится в pragma user_version: миграция с номером N
// накатывается, если user_version < N.
const migrate = (db: DatabaseSync): number => {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const current = Number(
    (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  );
  let applied = 0;

  for (const file of files) {
    const version = Number(file.slice(0, 3));
    if (!Number.isInteger(version) || version <= current) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Миграция ${file} не применилась: ${(err as Error).message}`);
    }
    applied += 1;
  }

  return applied;
};

export const openDb = (dbPath = defaultDbPath()): DatabaseSync => {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
};
