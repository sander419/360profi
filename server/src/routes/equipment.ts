import type { FastifyInstance } from 'fastify';
import { nowIso, uid } from '../db.ts';
import {
  DomainError,
  EQUIPMENT_STATUSES,
  changeStatus,
  getEquipment,
  logEvent,
  markChecked,
  openDefect,
  openDefectCounts,
  sanitizeOccurredAt,
  serializeEquipment
} from '../domain.ts';
import type { EquipmentRow, EquipmentStatus } from '../domain.ts';

// Категорию вводят руками и по-разному: «свет», «Свет », «СВЕТ». Без нормализации
// фильтр по категориям через месяц превращается в кашу.
const normalizeCategory = (value: string): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return 'Разное';
  return trimmed[0]!.toLocaleUpperCase('ru') + trimmed.slice(1).toLocaleLowerCase('ru');
};

// Код единицы — то, что печатается на QR-наклейке. Если не задан вручную,
// выдаём следующий свободный номер вида EQ-0007.
const nextCode = (db: FastifyInstance['ctx']['db']): string => {
  const row = db
    .prepare("SELECT code FROM equipment WHERE code LIKE 'EQ-%' ORDER BY code DESC LIMIT 1")
    .get() as { code: string } | undefined;
  const last = row ? Number(row.code.slice(3)) : 0;
  return `EQ-${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, '0')}`;
};

export const equipmentRoutes = async (app: FastifyInstance): Promise<void> => {
  const { db } = app.ctx;
  const anyUser = app.guard([]);

  app.get('/', { preHandler: anyUser }, async (req) => {
    const q = req.query as {
      status?: string;
      category?: string;
      projectId?: string;
      search?: string;
    };

    const where: string[] = [];
    const params: string[] = [];
    if (q.status) {
      where.push('status = ?');
      params.push(q.status);
    }
    if (q.category) {
      where.push('category = ?');
      params.push(q.category);
    }
    if (q.projectId) {
      where.push('project_id = ?');
      params.push(q.projectId);
    }
    if (q.search) {
      where.push('(name LIKE ? OR code LIKE ? OR serial LIKE ?)');
      const like = `%${q.search}%`;
      params.push(like, like, like);
    }

    const rows = db
      .prepare(
        `SELECT * FROM equipment ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY category, name`
      )
      .all(...params) as unknown as EquipmentRow[];

    const defects = openDefectCounts(db, rows.map((r) => r.id));
    return { items: rows.map((r) => serializeEquipment(r, defects.get(r.id) ?? 0)) };
  });

  app.get('/categories', { preHandler: anyUser }, async () => ({
    categories: (
      db.prepare('SELECT DISTINCT category FROM equipment ORDER BY category').all() as {
        category: string;
      }[]
    ).map((r) => r.category)
  }));

  // Точка входа для QR: наклейка ведёт на код, а не на внутренний id.
  app.get('/by-code/:code', { preHandler: anyUser }, async (req) => {
    const { code } = req.params as { code: string };
    const row = db.prepare('SELECT * FROM equipment WHERE code = ?').get(code) as
      | EquipmentRow
      | undefined;
    if (!row) throw new DomainError('Оборудование с таким кодом не найдено', 404);
    const defects = openDefectCounts(db, [row.id]);
    return { item: serializeEquipment(row, defects.get(row.id) ?? 0) };
  });

  app.get('/:id', { preHandler: anyUser }, async (req) => {
    const { id } = req.params as { id: string };
    const row = getEquipment(db, id);
    const defects = openDefectCounts(db, [row.id]);
    return { item: serializeEquipment(row, defects.get(row.id) ?? 0) };
  });

  app.get('/:id/history', { preHandler: anyUser }, async (req) => {
    const { id } = req.params as { id: string };
    getEquipment(db, id);
    const events = db
      .prepare(
        `SELECT e.*, u.name AS user_name, p.code AS project_code
           FROM equipment_events e
           LEFT JOIN users u ON u.id = e.user_id
           LEFT JOIN projects p ON p.id = e.project_id
          WHERE e.equipment_id = ?
          ORDER BY e.created_at DESC, e.rowid DESC
          LIMIT 200`
      )
      .all(id) as unknown as Record<string, unknown>[];

    return {
      events: events.map((e) => ({
        id: e.id,
        kind: e.kind,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        projectCode: e.project_code,
        userName: e.user_name,
        note: e.note,
        createdAt: e.created_at,
        occurredAt: e.occurred_at ?? e.created_at
      }))
    };
  });

  app.post(
    '/',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['name', 'category'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            category: { type: 'string', minLength: 1, maxLength: 60 },
            code: { type: 'string', maxLength: 40 },
            serial: { type: 'string', maxLength: 80 },
            note: { type: 'string', maxLength: 500 },
            responsibleId: { type: 'string' }
          }
        }
      }
    },
    async (req, reply) => {
      const body = req.body as {
        name: string;
        category: string;
        code?: string;
        serial?: string;
        note?: string;
        responsibleId?: string;
      };

      const code = body.code?.trim() || nextCode(db);
      if (db.prepare('SELECT 1 FROM equipment WHERE code = ?').get(code)) {
        throw new DomainError(`Код ${code} уже занят`, 409);
      }

      const id = uid();
      const ts = nowIso();
      db.prepare(
        `INSERT INTO equipment (id, code, name, category, serial, status, responsible_id, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'stock', ?, ?, ?, ?)`
      ).run(
        id,
        code,
        body.name.trim(),
        normalizeCategory(body.category),
        body.serial ?? '',
        body.responsibleId ?? null,
        body.note ?? '',
        ts,
        ts
      );

      logEvent(db, { equipmentId: id, kind: 'created', toStatus: 'stock', userId: req.user!.id });
      return reply.code(201).send({ item: serializeEquipment(getEquipment(db, id)) });
    }
  );

  app.patch(
    '/:id',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            category: { type: 'string', minLength: 1, maxLength: 60 },
            serial: { type: 'string', maxLength: 80 },
            note: { type: 'string', maxLength: 500 },
            responsibleId: { type: ['string', 'null'] }
          }
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      getEquipment(db, id);
      const body = req.body as Record<string, string | null>;

      const fields: Record<string, string> = {
        name: 'name',
        category: 'category',
        serial: 'serial',
        note: 'note',
        responsibleId: 'responsible_id'
      };

      const sets: string[] = [];
      const params: (string | null)[] = [];
      for (const [key, column] of Object.entries(fields)) {
        if (body[key] !== undefined) {
          sets.push(`${column} = ?`);
          params.push(key === 'category' && body[key] ? normalizeCategory(body[key]) : body[key]);
        }
      }
      if (sets.length === 0) throw new DomainError('Нечего обновлять');

      params.push(nowIso(), id);
      db.prepare(`UPDATE equipment SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(
        ...params
      );
      logEvent(db, { equipmentId: id, kind: 'updated', userId: req.user!.id });
      return { item: serializeEquipment(getEquipment(db, id)) };
    }
  );

  app.post(
    '/:id/status',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: EQUIPMENT_STATUSES },
            projectId: { type: ['string', 'null'] },
            note: { type: 'string', maxLength: 500 },
            occurredAt: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as {
        status: EquipmentStatus;
        projectId?: string | null;
        note?: string;
        occurredAt?: string;
      };
      const row = changeStatus(db, {
        equipmentId: id,
        status: body.status,
        projectId: body.projectId,
        userId: req.user!.id,
        note: body.note,
        occurredAt: sanitizeOccurredAt(body.occurredAt)
      });
      return { item: serializeEquipment(row) };
    }
  );

  app.post(
    '/:id/check',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          properties: {
            note: { type: 'string', maxLength: 500 },
            occurredAt: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const { note, occurredAt } = (req.body ?? {}) as { note?: string; occurredAt?: string };
      const row = markChecked(db, {
        equipmentId: id,
        userId: req.user!.id,
        note,
        occurredAt: sanitizeOccurredAt(occurredAt)
      });
      return { item: serializeEquipment(row) };
    }
  );

  app.post(
    '/:id/defects',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['severity', 'description'],
          properties: {
            id: { type: 'string', pattern: '^[0-9a-fA-F-]{16,64}$' },
            severity: { type: 'string', enum: ['low', 'high', 'blocker'] },
            description: { type: 'string', minLength: 1, maxLength: 1000 },
            occurredAt: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as {
        id?: string;
        severity: 'low' | 'high' | 'blocker';
        description: string;
        occurredAt?: string;
      };
      if (body.id && db.prepare('SELECT 1 FROM defects WHERE id = ?').get(body.id)) {
        throw new DomainError('Дефект с таким идентификатором уже заведён', 409);
      }
      const defect = openDefect(db, {
        id: body.id,
        equipmentId: id,
        severity: body.severity,
        description: body.description,
        userId: req.user!.id,
        occurredAt: sanitizeOccurredAt(body.occurredAt)
      });
      return reply.code(201).send(defect);
    }
  );
};
