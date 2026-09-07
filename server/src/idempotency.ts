// Защита от двойного применения.
//
// Телефон без связи копит отметки и досылает их, когда сеть появится. Ответ на
// такую отправку может не дойти — клиент повторит запрос, и без этой проверки
// одна проверка оборудования превратилась бы в две записи в журнале.
//
// Клиент шлёт заголовок Idempotency-Key (свой uuid на операцию). Первый запрос
// выполняется и его ответ сохраняется; повтор с тем же ключом получает
// сохранённый ответ, ничего не выполняя.

import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from './db.ts';

const HEADER = 'idempotency-key';
const KEEP_DAYS = 30;
const MUTATIONS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

interface StoredOperation {
  status_code: number;
  response: string;
}

export const purgeOldOperations = (db: DatabaseSync): number => {
  const result = db
    .prepare(`DELETE FROM operations WHERE created_at < datetime('now', '-${KEEP_DAYS} days')`)
    .run();
  return Number(result.changes ?? 0);
};

export const registerIdempotency = (app: FastifyInstance, db: DatabaseSync): void => {
  const readKey = (headers: Record<string, unknown>): string | null => {
    const raw = headers[HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.length >= 8 && value.length <= 100 ? value : null;
  };

  app.addHook('preHandler', async (req, reply) => {
    if (!MUTATIONS.has(req.method)) return;
    const key = readKey(req.headers as Record<string, unknown>);
    if (!key) return;

    const seen = db
      .prepare('SELECT status_code, response FROM operations WHERE key = ?')
      .get(key) as unknown as StoredOperation | undefined;

    if (seen) {
      // Клиенту важно знать, что это повтор: он снимет операцию с очереди,
      // но не будет считать её новым событием.
      await reply
        .header('idempotent-replay', 'true')
        .code(seen.status_code)
        .send(JSON.parse(seen.response));
    }
  });

  app.addHook('onSend', async (req, reply, payload) => {
    if (!MUTATIONS.has(req.method)) return payload;
    if (reply.statusCode >= 400) return payload;
    if (reply.getHeader('idempotent-replay')) return payload;
    const key = readKey(req.headers as Record<string, unknown>);
    if (!key || typeof payload !== 'string') return payload;

    db.prepare(
      `INSERT OR IGNORE INTO operations (key, user_id, method, path, status_code, response, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(key, req.user?.id ?? null, req.method, req.url, reply.statusCode, payload, nowIso());

    return payload;
  });
};
