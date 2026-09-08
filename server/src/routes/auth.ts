import type { FastifyInstance } from 'fastify';
import { nowIso, uid } from '../db.ts';
import {
  clearAttempts,
  issueToken,
  noteFailedAttempt,
  tooManyAttempts,
  verifyPin
} from '../auth.ts';
import type { Role } from '../auth.ts';

interface UserRow {
  id: string;
  name: string;
  phone: string;
  role: Role;
  pin_hash: string;
  active: number;
}

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  const { db, secret } = app.ctx;

  // Пишем и удачные, и неудачные входы: по вторым видно подбор PIN, по первым —
  // кто работал под учёткой. Больше ничего не собираем: ни геолокации, ни истории.
  const logAccess = (params: {
    userId: string | null;
    phone: string;
    success: boolean;
    ip: string;
    userAgent: string;
  }): void => {
    db.prepare(
      `INSERT INTO access_log (id, user_id, phone, success, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uid(),
      params.userId,
      params.phone.slice(0, 32),
      params.success ? 1 : 0,
      params.ip.slice(0, 64),
      params.userAgent.slice(0, 200),
      nowIso()
    );
  };

  app.post(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['phone', 'pin'],
          properties: {
            phone: { type: 'string', minLength: 3, maxLength: 32 },
            pin: { type: 'string', minLength: 4, maxLength: 12 }
          }
        }
      }
    },
    async (req, reply) => {
      const { phone, pin } = req.body as { phone: string; pin: string };

      if (tooManyAttempts(phone)) {
        return reply.code(429).send({ error: 'Слишком много попыток, попробуйте через 15 минут' });
      }

      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as
        | UserRow
        | undefined;

      // Ответ одинаковый для «нет такого телефона» и «неверный PIN»:
      // иначе форма входа превращается в справочник сотрудников.
      const ip = String(req.headers['x-real-ip'] ?? req.ip ?? '');
      const agent = String(req.headers['user-agent'] ?? '');

      if (!user || !user.active || !verifyPin(pin, user.pin_hash)) {
        noteFailedAttempt(phone);
        logAccess({ userId: user?.id ?? null, phone, success: false, ip, userAgent: agent });
        return reply.code(401).send({ error: 'Неверный телефон или PIN' });
      }

      clearAttempts(phone);
      logAccess({ userId: user.id, phone, success: true, ip, userAgent: agent });
      const session = { id: user.id, name: user.name, role: user.role };
      // Время сервера: телефон по нему поправит свои часы, иначе отметки,
      // сделанные без связи, лягут в журнал с чужим временем.
      return { token: issueToken(session, secret), user: session, serverTime: nowIso() };
    }
  );

  app.get('/me', { preHandler: app.guard([]) }, async (req) => ({
    user: req.user,
    serverTime: nowIso()
  }));
};
