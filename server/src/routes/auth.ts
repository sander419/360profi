import type { FastifyInstance } from 'fastify';
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
      if (!user || !user.active || !verifyPin(pin, user.pin_hash)) {
        noteFailedAttempt(phone);
        return reply.code(401).send({ error: 'Неверный телефон или PIN' });
      }

      clearAttempts(phone);
      const session = { id: user.id, name: user.name, role: user.role };
      return { token: issueToken(session, secret), user: session };
    }
  );

  app.get('/me', { preHandler: app.guard([]) }, async (req) => ({ user: req.user }));
};
