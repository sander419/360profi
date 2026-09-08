// Сборка HTTP-приложения. Отдельно от запуска сервера, чтобы тесты
// поднимали то же самое приложение через app.inject(), без свободного порта.

import Fastify from 'fastify';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import type { DatabaseSync } from 'node:sqlite';
import { openDb, defaultDbPath } from './db.ts';
import { loadSecret, verifyToken } from './auth.ts';
import type { Role, SessionUser } from './auth.ts';
import { DomainError } from './domain.ts';
import { registerIdempotency, purgeOldOperations } from './idempotency.ts';
import { authRoutes } from './routes/auth.ts';
import { equipmentRoutes } from './routes/equipment.ts';
import { kitRoutes } from './routes/kits.ts';
import { catalogRoutes } from './routes/catalog.ts';
import { photoRoutes } from './routes/photos.ts';
import { statusRoutes } from './routes/status.ts';
import { announcementRoutes } from './routes/announcements.ts';

export interface AppContext {
  db: DatabaseSync;
  secret: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyInstance {
    ctx: AppContext;
    guard: (roles: Role[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface BuildOptions {
  dbPath?: string;
  db?: DatabaseSync;
  logger?: boolean;
  corsOrigin?: string;
}

export const buildApp = async (options: BuildOptions = {}): Promise<FastifyInstance> => {
  const db = options.db ?? openDb(options.dbPath ?? defaultDbPath());
  const secret = loadSecret();

  const app = Fastify({ logger: options.logger ?? false });

  const origin = options.corsOrigin ?? process.env.CORS_ORIGIN ?? '*';
  await app.register(cors, {
    origin: origin === '*' ? true : origin.split(',').map((o) => o.trim())
  });

  purgeOldOperations(db);

  app.decorate('ctx', { db, secret });
  app.decorateRequest('user', null);

  // Токен разбирается для всех запросов, а доступ проверяет guard на маршруте:
  // так публичные и защищённые ручки живут рядом без дублирования кода.
  const activeUser = db.prepare('SELECT name, role FROM users WHERE id = ? AND active = 1');

  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;

    const session = verifyToken(header.slice(7), secret);
    if (!session) return;

    // Токен живёт месяц, и одной подписи мало: уволенный сотрудник с телефоном
    // в кармане сохранял бы доступ до тридцати дней. Сверяем с базой на каждом
    // запросе — это один поиск по первичному ключу.
    const fresh = activeUser.get(session.id) as unknown as
      | { name: string; role: 'admin' | 'manager' | 'tech' }
      | undefined;
    if (!fresh) return;

    // Роль берём из базы, а не из токена: понижение в правах должно
    // действовать сразу, а не после следующего входа.
    req.user = { id: session.id, name: fresh.name, role: fresh.role };
  });

  app.decorate('guard', (roles: Role[]) => async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      await reply.code(401).send({ error: 'Нужен вход в систему' });
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      await reply.code(403).send({ error: 'Недостаточно прав' });
    }
  });

  registerIdempotency(app, db);

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof DomainError) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    if (err.validation) {
      return reply.code(400).send({ error: 'Некорректные данные запроса', details: err.message });
    }
    req.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ error: err.message || 'Внутренняя ошибка' });
  });

  app.get('/api/v1/health', async () => ({
    ok: true,
    equipment: (db.prepare('SELECT COUNT(*) AS c FROM equipment').get() as { c: number }).c,
    time: new Date().toISOString()
  }));

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(equipmentRoutes, { prefix: '/api/v1/equipment' });
  await app.register(kitRoutes, { prefix: '/api/v1/kits' });
  await app.register(catalogRoutes, { prefix: '/api/v1' });
  await app.register(photoRoutes, { prefix: '/api/v1' });
  await app.register(statusRoutes, { prefix: '/api/v1' });
  await app.register(announcementRoutes, { prefix: '/api/v1/announcements' });

  return app;
};
