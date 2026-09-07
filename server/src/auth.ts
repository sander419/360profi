// Аутентификация: телефон + PIN, дальше подписанный токен в заголовке.
//
// JWT собран на node:crypto вручную — библиотека ради HMAC-SHA256 не нужна,
// а так видно, что именно подписывается и как проверяется.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SERVER_ROOT } from './db.ts';

export type Role = 'admin' | 'manager' | 'tech';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

const TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 дней: техник на площадке не должен логиниться заново

// Секрет берётся из окружения, а если его нет — генерируется и кладётся рядом с базой,
// чтобы сервер поднимался без ручной настройки, но токены переживали перезапуск.
export const loadSecret = (): string => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(SERVER_ROOT, 'data', '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
};

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64url');

const sign = (data: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(data).digest('base64url');

export const issueToken = (user: SessionUser, secret: string): string => {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ sub: user.id, name: user.name, role: user.role, iat: now, exp: now + TOKEN_TTL_SEC })
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`;
};

export const verifyToken = (token: string, secret: string): SessionUser | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: data.sub, name: data.name, role: data.role };
  } catch {
    return null;
  }
};

// PIN хешируется scrypt с индивидуальной солью: даже утечка базы не отдаёт коды.
export const hashPin = (pin: string): string => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
};

export const verifyPin = (pin: string, stored: string): boolean => {
  const [algo, saltPart, hashPart] = stored.split('$');
  if (algo !== 'scrypt' || !saltPart || !hashPart) return false;
  const expected = Buffer.from(hashPart, 'base64url');
  const actual = crypto.scryptSync(pin, Buffer.from(saltPart, 'base64url'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const randomPin = (): string => String(crypto.randomInt(100000, 1000000));

// Простой счётчик неудачных попыток: PIN короткий, без этого он подбирается за минуты.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export const tooManyAttempts = (key: string): boolean => {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (rec.until < Date.now()) {
    attempts.delete(key);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
};

export const noteFailedAttempt = (key: string): void => {
  const rec = attempts.get(key);
  if (!rec || rec.until < Date.now()) {
    attempts.set(key, { count: 1, until: Date.now() + WINDOW_MS });
    return;
  }
  rec.count += 1;
};

export const clearAttempts = (key: string): void => {
  attempts.delete(key);
};
