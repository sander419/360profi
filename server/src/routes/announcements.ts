// Команды и объявления руководства.
//
// Правило одно: отправитель обязан видеть, кто прочитал. Поэтому у объявления
// есть подтверждение, а у автора — поимённый список тех, до кого не дошло.
// Без этого получается ещё один чат, а их в компании и так хватает.

import type { FastifyInstance } from 'fastify';
import { nowIso, uid } from '../db.ts';
import { DomainError } from '../domain.ts';
import { notify } from '../notify.ts';

interface AnnouncementRow {
  id: string;
  text: string;
  kind: 'info' | 'task' | 'urgent';
  audience: 'all' | 'tech' | 'manager';
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  active: number;
  author: string | null;
}

const serialize = (row: AnnouncementRow, acknowledged: boolean) => ({
  id: row.id,
  text: row.text,
  kind: row.kind,
  audience: row.audience,
  author: row.author,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  acknowledged
});

export const announcementRoutes = async (app: FastifyInstance): Promise<void> => {
  const { db } = app.ctx;
  const anyUser = app.guard([]);
  const managers = app.guard(['admin', 'manager']);

  // Что сейчас висит лично у меня.
  app.get('/', { preHandler: anyUser }, async (req) => {
    const user = req.user!;
    const rows = db
      .prepare(
        `SELECT a.*, u.name AS author,
                (SELECT COUNT(*) FROM announcement_reads r
                  WHERE r.announcement_id = a.id AND r.user_id = ?) AS mine
           FROM announcements a
           LEFT JOIN users u ON u.id = a.created_by
          WHERE a.active = 1
            AND (a.expires_at IS NULL OR a.expires_at >= date('now'))
            AND (a.audience = 'all'
                 OR (a.audience = 'tech' AND ? = 'tech')
                 OR (a.audience = 'manager' AND ? IN ('manager', 'admin')))
          ORDER BY CASE a.kind WHEN 'urgent' THEN 0 WHEN 'task' THEN 1 ELSE 2 END,
                   a.created_at DESC`
      )
      .all(user.id, user.role, user.role) as unknown as (AnnouncementRow & { mine: number })[];

    return { announcements: rows.map((r) => serialize(r, r.mine > 0)) };
  });

  app.post(
    '/:id/ack',
    {
      preHandler: anyUser,
      schema: { body: { type: 'object', properties: { occurredAt: { type: 'string', maxLength: 40 } } } }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      if (!db.prepare('SELECT 1 FROM announcements WHERE id = ?').get(id)) {
        throw new DomainError('Объявление не найдено', 404);
      }
      db.prepare(
        'INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at) VALUES (?, ?, ?)'
      ).run(id, req.user!.id, nowIso());
      return { ok: true };
    }
  );

  app.post(
    '/',
    {
      preHandler: managers,
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 3, maxLength: 2000 },
            kind: { type: 'string', enum: ['info', 'task', 'urgent'] },
            audience: { type: 'string', enum: ['all', 'tech', 'manager'] },
            days: { type: 'integer', minimum: 1, maximum: 365 }
          }
        }
      }
    },
    async (req, reply) => {
      const body = req.body as {
        text: string;
        kind?: 'info' | 'task' | 'urgent';
        audience?: 'all' | 'tech' | 'manager';
        days?: number;
      };

      const id = uid();
      const days = body.days ?? 14;
      db.prepare(
        `INSERT INTO announcements (id, text, kind, audience, created_by, created_at, expires_at, active)
         VALUES (?, ?, ?, ?, ?, ?, date('now', '+' || ? || ' days'), 1)`
      ).run(
        id,
        body.text.trim(),
        body.kind ?? 'info',
        body.audience ?? 'all',
        req.user!.id,
        nowIso(),
        days
      );

      // Автор объявления считается прочитавшим: он его и написал.
      db.prepare(
        'INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at) VALUES (?, ?, ?)'
      ).run(id, req.user!.id, nowIso());

      // Срочное дублируем в чат: до тех, кто сегодня не откроет приложение,
      // иначе «срочное» доходит к вечеру.
      if ((body.kind ?? 'info') === 'urgent') {
        notify({ kind: 'summary', text: `Срочно от ${req.user!.name}:\n${body.text.trim()}` });
      }

      return reply.code(201).send({ id });
    }
  );

  // Кто прочитал, а кто нет — то, ради чего всё это и делается.
  app.get('/:id/reads', { preHandler: managers }, async (req) => {
    const { id } = req.params as { id: string };
    const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as unknown as
      | AnnouncementRow
      | undefined;
    if (!announcement) throw new DomainError('Объявление не найдено', 404);

    const audience = announcement.audience;
    const people = db
      .prepare(
        `SELECT u.id, u.name, u.role, r.read_at
           FROM users u
           LEFT JOIN announcement_reads r ON r.user_id = u.id AND r.announcement_id = ?
          WHERE u.active = 1
            AND (? = 'all'
                 OR (? = 'tech' AND u.role = 'tech')
                 OR (? = 'manager' AND u.role IN ('manager', 'admin')))
          ORDER BY r.read_at IS NULL DESC, u.name`
      )
      .all(id, audience, audience, audience) as unknown as {
      id: string;
      name: string;
      role: string;
      read_at: string | null;
    }[];

    return {
      announcement: serialize(announcement, true),
      read: people.filter((p) => p.read_at).map((p) => ({ name: p.name, readAt: p.read_at })),
      notRead: people.filter((p) => !p.read_at).map((p) => ({ name: p.name, role: p.role }))
    };
  });

  app.get('/sent', { preHandler: managers }, async () => {
    const rows = db
      .prepare(
        // Считаем только тех читателей, кто входит в аудиторию объявления:
        // иначе автор, писавший техникам, попадал в числитель и «2 из 5»
        // означало «прочитал один техник плюс я сам».
        `SELECT a.*, u.name AS author,
                (SELECT COUNT(*)
                   FROM announcement_reads r
                   JOIN users ru ON ru.id = r.user_id AND ru.active = 1
                  WHERE r.announcement_id = a.id
                    AND (a.audience = 'all'
                         OR (a.audience = 'tech' AND ru.role = 'tech')
                         OR (a.audience = 'manager' AND ru.role IN ('manager', 'admin')))
                ) AS reads
           FROM announcements a
           LEFT JOIN users u ON u.id = a.created_by
          WHERE a.active = 1
          ORDER BY a.created_at DESC
          LIMIT 30`
      )
      .all() as unknown as (AnnouncementRow & { reads: number })[];

    const audienceSize = (audience: string): number =>
      Number(
        (
          db
            .prepare(
              `SELECT COUNT(*) AS c FROM users
                WHERE active = 1
                  AND (? = 'all'
                       OR (? = 'tech' AND role = 'tech')
                       OR (? = 'manager' AND role IN ('manager', 'admin')))`
            )
            .get(audience, audience, audience) as unknown as { c: number }
        ).c
      );

    return {
      announcements: rows.map((r) => ({
        ...serialize(r, true),
        reads: Number(r.reads),
        audienceSize: audienceSize(r.audience)
      }))
    };
  });

  app.delete('/:id', { preHandler: managers }, async (req) => {
    const { id } = req.params as { id: string };
    db.prepare('UPDATE announcements SET active = 0 WHERE id = ?').run(id);
    return { ok: true };
  });
};
