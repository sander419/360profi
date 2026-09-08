// Справочники: проекты, сотрудники, дефекты.

import type { FastifyInstance } from 'fastify';
import { nowIso, uid } from '../db.ts';
import { DomainError } from '../domain.ts';
import { hashPin, randomPin } from '../auth.ts';
import type { Role } from '../auth.ts';

export const catalogRoutes = async (app: FastifyInstance): Promise<void> => {
  const { db } = app.ctx;
  const anyUser = app.guard([]);
  const managers = app.guard(['admin', 'manager']);
  const admins = app.guard(['admin']);

  app.get('/projects', { preHandler: anyUser }, async (req) => {
    const { status } = req.query as { status?: string };
    const rows = db
      .prepare(
        `SELECT * FROM projects ${status ? 'WHERE status = ?' : ''} ORDER BY starts_on IS NULL, starts_on`
      )
      .all(...(status ? [status] : [])) as unknown as Record<string, unknown>[];
    return {
      projects: rows.map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        venue: p.venue,
        startsOn: p.starts_on,
        status: p.status
      }))
    };
  });

  app.post(
    '/projects',
    {
      preHandler: managers,
      schema: {
        body: {
          type: 'object',
          required: ['code', 'title'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 40 },
            title: { type: 'string', minLength: 1, maxLength: 200 },
            venue: { type: 'string', maxLength: 200 },
            startsOn: { type: 'string', maxLength: 10 }
          }
        }
      }
    },
    async (req, reply) => {
      const body = req.body as { code: string; title: string; venue?: string; startsOn?: string };
      if (db.prepare('SELECT 1 FROM projects WHERE code = ?').get(body.code)) {
        throw new DomainError(`Проект с кодом ${body.code} уже есть`, 409);
      }
      const id = uid();
      db.prepare(
        'INSERT INTO projects (id, code, title, venue, starts_on, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, body.code, body.title, body.venue ?? '', body.startsOn ?? null, 'active', nowIso());
      return reply.code(201).send({ project: { id, code: body.code, title: body.title } });
    }
  );

  app.get('/users', { preHandler: managers }, async () => ({
    users: (
      db.prepare('SELECT id, name, phone, role, active FROM users ORDER BY name').all() as Record<
        string,
        unknown
      >[]
    ).map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      active: Boolean(u.active)
    }))
  }));

  app.post(
    '/users',
    {
      preHandler: admins,
      schema: {
        body: {
          type: 'object',
          required: ['name', 'phone', 'role'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 120 },
            phone: { type: 'string', minLength: 3, maxLength: 32 },
            role: { type: 'string', enum: ['admin', 'manager', 'tech'] }
          }
        }
      }
    },
    async (req, reply) => {
      const body = req.body as { name: string; phone: string; role: Role };
      if (db.prepare('SELECT 1 FROM users WHERE phone = ?').get(body.phone)) {
        throw new DomainError('Такой телефон уже зарегистрирован', 409);
      }
      const id = uid();
      const pin = randomPin();
      db.prepare(
        'INSERT INTO users (id, name, phone, role, pin_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
      ).run(id, body.name, body.phone, body.role, hashPin(pin), nowIso());
      // PIN показывается один раз — в базе лежит только хеш.
      return reply.code(201).send({ user: { id, name: body.name, role: body.role }, pin });
    }
  );

  app.post('/users/:id/pin', { preHandler: admins }, async (req) => {
    const { id } = req.params as { id: string };
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(id)) {
      throw new DomainError('Сотрудник не найден', 404);
    }
    const pin = randomPin();
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), id);
    return { pin };
  });

  app.get('/defects', { preHandler: anyUser }, async (req) => {
    const { status } = req.query as { status?: string };
    const rows = db
      .prepare(
        `SELECT d.*, e.code AS equipment_code, e.name AS equipment_name, u.name AS reporter
           FROM defects d
           JOIN equipment e ON e.id = d.equipment_id
           LEFT JOIN users u ON u.id = d.reported_by
          ${status ? 'WHERE d.status = ?' : "WHERE d.status != 'closed'"}
          ORDER BY d.created_at DESC`
      )
      .all(...(status ? [status] : [])) as unknown as Record<string, unknown>[];

    const ids = rows.map((d) => String(d.id));
    const photos = new Map<string, { id: string; url: string }[]>();
    if (ids.length > 0) {
      const found = db
        .prepare(
          `SELECT id, defect_id, token FROM photos WHERE defect_id IN (${ids.map(() => '?').join(', ')})`
        )
        .all(...ids) as unknown as { id: string; defect_id: string; token: string }[];
      for (const p of found) {
        const list = photos.get(p.defect_id) ?? [];
        list.push({ id: p.id, url: `/api/v1/photos/${p.id}?t=${p.token}` });
        photos.set(p.defect_id, list);
      }
    }

    return {
      defects: rows.map((d) => ({
        id: d.id,
        photos: photos.get(String(d.id)) ?? [],
        equipmentId: d.equipment_id,
        equipmentCode: d.equipment_code,
        equipmentName: d.equipment_name,
        severity: d.severity,
        description: d.description,
        status: d.status,
        reporter: d.reporter,
        createdAt: d.created_at,
        closedAt: d.closed_at
      }))
    };
  });

  app.patch(
    '/defects/:id',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', enum: ['open', 'in_repair', 'closed'] } }
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: 'open' | 'in_repair' | 'closed' };
      const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(id) as
        | { id: string; equipment_id: string }
        | undefined;
      if (!defect) throw new DomainError('Дефект не найден', 404);

      db.prepare('UPDATE defects SET status = ?, closed_at = ?, closed_by = ? WHERE id = ?').run(
        status,
        status === 'closed' ? nowIso() : null,
        status === 'closed' ? req.user!.id : null,
        id
      );
      return { ok: true };
    }
  );
};
