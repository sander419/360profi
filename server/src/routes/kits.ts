// Комплект на выезд: собрали список → отметили по QR при погрузке → приняли обратно.
// Это пп. 13-14 из письма: предвыездная и постивентная проверка.

import type { FastifyInstance } from 'fastify';
import { nowIso, uid } from '../db.ts';
import { buildTripSummary } from '../summary.ts';
import { notify, notificationsConfigured } from '../notify.ts';
import {
  DomainError,
  changeStatus,
  getEquipment,
  openDefect,
  logEvent,
  sanitizeOccurredAt
} from '../domain.ts';

interface KitRow {
  id: string;
  project_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

interface KitItemRow {
  equipment_id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  checked_out_at: string | null;
  checked_in_at: string | null;
  return_state: string | null;
  note: string;
}

const getKit = (db: FastifyInstance['ctx']['db'], id: string): KitRow => {
  const kit = db.prepare('SELECT * FROM kits WHERE id = ?').get(id) as unknown as KitRow | undefined;
  if (!kit) throw new DomainError('Комплект не найден', 404);
  return kit;
};

const kitPayload = (db: FastifyInstance['ctx']['db'], kit: KitRow) => {
  const items = db
    .prepare(
      `SELECT ki.equipment_id, ki.checked_out_at, ki.checked_in_at, ki.return_state, ki.note,
              e.code, e.name, e.category, e.status
         FROM kit_items ki
         JOIN equipment e ON e.id = ki.equipment_id
        WHERE ki.kit_id = ?
        ORDER BY e.category, e.name`
    )
    .all(kit.id) as unknown as KitItemRow[];

  const project = db.prepare('SELECT code, title FROM projects WHERE id = ?').get(kit.project_id) as
    | { code: string; title: string }
    | undefined;

  const loaded = items.filter((i) => i.checked_out_at).length;
  const returned = items.filter((i) => i.checked_in_at).length;

  return {
    id: kit.id,
    name: kit.name,
    projectId: kit.project_id,
    projectCode: project?.code ?? null,
    projectTitle: project?.title ?? null,
    createdAt: kit.created_at,
    progress: {
      total: items.length,
      loaded,
      returned,
      // Готовность к выезду в процентах — то, что нужно видеть за 10 секунд.
      readiness: items.length === 0 ? 0 : Math.round((loaded / items.length) * 100)
    },
    items: items.map((i) => ({
      equipmentId: i.equipment_id,
      code: i.code,
      name: i.name,
      category: i.category,
      status: i.status,
      checkedOutAt: i.checked_out_at,
      checkedInAt: i.checked_in_at,
      returnState: i.return_state,
      note: i.note
    }))
  };
};

export const kitRoutes = async (app: FastifyInstance): Promise<void> => {
  const { db } = app.ctx;
  const anyUser = app.guard([]);

  app.get('/', { preHandler: anyUser }, async (req) => {
    const { projectId } = req.query as { projectId?: string };
    const kits = db
      .prepare(
        `SELECT * FROM kits ${projectId ? 'WHERE project_id = ?' : ''} ORDER BY created_at DESC`
      )
      .all(...(projectId ? [projectId] : [])) as unknown as KitRow[];
    return { kits: kits.map((k) => kitPayload(db, k)) };
  });

  app.get('/:id', { preHandler: anyUser }, async (req) => {
    const { id } = req.params as { id: string };
    return { kit: kitPayload(db, getKit(db, id)) };
  });

  app.post(
    '/',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['projectId', 'name'],
          properties: {
            projectId: { type: 'string' },
            name: { type: 'string', minLength: 1, maxLength: 120 },
            equipmentIds: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },
    async (req, reply) => {
      const body = req.body as { projectId: string; name: string; equipmentIds?: string[] };
      if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(body.projectId)) {
        throw new DomainError('Проект не найден', 404);
      }

      const id = uid();
      const ts = nowIso();
      db.prepare('INSERT INTO kits (id, project_id, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id,
        body.projectId,
        body.name.trim(),
        req.user!.id,
        ts
      );

      for (const equipmentId of body.equipmentIds ?? []) {
        getEquipment(db, equipmentId);
        db.prepare('INSERT OR IGNORE INTO kit_items (kit_id, equipment_id, added_at) VALUES (?, ?, ?)').run(
          id,
          equipmentId,
          ts
        );
      }

      return reply.code(201).send({ kit: kitPayload(db, getKit(db, id)) });
    }
  );

  app.post(
    '/:id/items',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['equipmentId'],
          properties: { equipmentId: { type: 'string' } }
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const { equipmentId } = req.body as { equipmentId: string };
      const kit = getKit(db, id);
      getEquipment(db, equipmentId);
      db.prepare('INSERT OR IGNORE INTO kit_items (kit_id, equipment_id, added_at) VALUES (?, ?, ?)').run(
        id,
        equipmentId,
        nowIso()
      );
      return { kit: kitPayload(db, kit) };
    }
  );

  app.delete('/:id/items/:equipmentId', { preHandler: anyUser }, async (req) => {
    const { id, equipmentId } = req.params as { id: string; equipmentId: string };
    const kit = getKit(db, id);
    const item = db
      .prepare('SELECT checked_out_at FROM kit_items WHERE kit_id = ? AND equipment_id = ?')
      .get(id, equipmentId) as { checked_out_at: string | null } | undefined;
    if (!item) throw new DomainError('Позиции нет в комплекте', 404);
    if (item.checked_out_at) throw new DomainError('Позиция уже отгружена, её нельзя убрать');
    db.prepare('DELETE FROM kit_items WHERE kit_id = ? AND equipment_id = ?').run(id, equipmentId);
    return { kit: kitPayload(db, kit) };
  });

  // Предвыездная отметка: техник сканирует QR при погрузке.
  app.post(
    '/:id/checkout',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['equipmentId'],
          properties: {
            equipmentId: { type: 'string' },
            note: { type: 'string', maxLength: 500 },
            occurredAt: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as { equipmentId: string; note?: string; occurredAt?: string };
      const occurredAt = sanitizeOccurredAt(body.occurredAt);
      const kit = getKit(db, id);

      const item = db
        .prepare('SELECT checked_out_at FROM kit_items WHERE kit_id = ? AND equipment_id = ?')
        .get(id, body.equipmentId) as { checked_out_at: string | null } | undefined;
      if (item?.checked_out_at) {
        throw new DomainError('Позиция уже отмечена как отгруженная', 409);
      }

      // Сначала все запреты, потом запись: иначе отклонённая единица всё равно
      // оседает в списке комплекта, потому что запрос не в транзакции.
      const equipment = getEquipment(db, body.equipmentId);
      if (equipment.status === 'repair') {
        throw new DomainError('Оборудование в ремонте — на выезд его брать нельзя');
      }
      if (equipment.status === 'project' && equipment.project_id !== kit.project_id) {
        throw new DomainError('Оборудование уже на другом проекте', 409);
      }

      // Позиции нет в списке — значит, список составлял не тот, кто грузит.
      // Добавляем на лету: важнее знать, что реально уехало, чем соблюсти план.
      if (!item) {
        db.prepare('INSERT INTO kit_items (kit_id, equipment_id, added_at) VALUES (?, ?, ?)').run(
          id,
          body.equipmentId,
          occurredAt ?? nowIso()
        );
      }

      db.prepare(
        'UPDATE kit_items SET checked_out_at = ?, checked_out_by = ?, note = ? WHERE kit_id = ? AND equipment_id = ?'
      ).run(occurredAt ?? nowIso(), req.user!.id, body.note ?? '', id, body.equipmentId);

      changeStatus(db, {
        equipmentId: body.equipmentId,
        status: 'project',
        projectId: kit.project_id,
        userId: req.user!.id,
        note: `Погрузка: ${kit.name}`,
        kind: 'kit_out',
        occurredAt
      });

      return { kit: kitPayload(db, kit) };
    }
  );

  // Приём одной позиции. Повреждённое сразу уходит в ремонт с заведённым дефектом,
  // иначе «потом посмотрим» превращается в поломку на следующем выезде.
  const receive = (params: {
    kit: KitRow;
    equipmentId: string;
    returnState: 'ok' | 'damaged' | 'missing';
    note?: string;
    userId: string;
    occurredAt: string | null;
  }): void => {
    const { kit, equipmentId, returnState, userId, occurredAt } = params;
    const note = params.note ?? '';

    db.prepare(
      `UPDATE kit_items SET checked_in_at = ?, checked_in_by = ?, return_state = ?, note = ?
        WHERE kit_id = ? AND equipment_id = ?`
    ).run(occurredAt ?? nowIso(), userId, returnState, note, kit.id, equipmentId);

    if (returnState === 'missing') {
      logEvent(db, {
        equipmentId,
        kind: 'kit_in',
        projectId: kit.project_id,
        userId,
        note: `Не вернулось с проекта: ${note}`.trim(),
        occurredAt
      });
      openDefect(db, {
        equipmentId,
        severity: 'blocker',
        description: `Не вернулось с выезда «${kit.name}». ${note}`.trim(),
        userId,
        occurredAt
      });
      return;
    }

    changeStatus(db, {
      equipmentId,
      status: returnState === 'damaged' ? 'repair' : 'stock',
      projectId: null,
      userId,
      note: `Возврат: ${kit.name}. ${note}`.trim(),
      kind: 'kit_in',
      occurredAt
    });

    if (returnState === 'damaged') {
      openDefect(db, {
        equipmentId,
        severity: 'high',
        description: `Повреждение при возврате с выезда «${kit.name}». ${note}`.trim(),
        userId,
        occurredAt
      });
    }
  };

  // Возврат со съёмки.
  // Приём всего остатка целыми. Ночью на разгрузке отмечать двадцать позиций
  // по одной никто не станет: сначала отмечают исключения, потом жмут одну кнопку.
  // Итог выезда одним текстом: его читают в чате, а не в интерфейсе.
  app.get('/:id/summary', { preHandler: anyUser }, async (req) => {
    const { id } = req.params as { id: string };
    return { summary: buildTripSummary(db, id), canSend: notificationsConfigured() };
  });

  app.post('/:id/summary/send', { preHandler: anyUser }, async (req) => {
    const { id } = req.params as { id: string };
    const summary = buildTripSummary(db, id);
    notify({ kind: 'summary', text: summary.text });
    return { sent: true };
  });

  app.post(
    '/:id/checkin-rest',
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
      const body = (req.body ?? {}) as { note?: string; occurredAt?: string };
      const occurredAt = sanitizeOccurredAt(body.occurredAt);
      const kit = getKit(db, id);

      const pending = db
        .prepare(
          `SELECT equipment_id FROM kit_items
            WHERE kit_id = ? AND checked_out_at IS NOT NULL AND checked_in_at IS NULL`
        )
        .all(id) as unknown as { equipment_id: string }[];

      for (const item of pending) {
        receive({
          kit,
          equipmentId: item.equipment_id,
          returnState: 'ok',
          note: body.note,
          userId: req.user!.id,
          occurredAt
        });
      }

      return { kit: kitPayload(db, getKit(db, id)), accepted: pending.length };
    }
  );

  app.post(
    '/:id/checkin',
    {
      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['equipmentId', 'returnState'],
          properties: {
            equipmentId: { type: 'string' },
            returnState: { type: 'string', enum: ['ok', 'damaged', 'missing'] },
            note: { type: 'string', maxLength: 500 },
            occurredAt: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as {
        equipmentId: string;
        returnState: 'ok' | 'damaged' | 'missing';
        note?: string;
        occurredAt?: string;
      };
      const occurredAt = sanitizeOccurredAt(body.occurredAt);
      const kit = getKit(db, id);

      const item = db
        .prepare(
          'SELECT checked_out_at, checked_in_at FROM kit_items WHERE kit_id = ? AND equipment_id = ?'
        )
        .get(id, body.equipmentId) as
        | { checked_out_at: string | null; checked_in_at: string | null }
        | undefined;
      if (!item) throw new DomainError('Этой позиции нет в комплекте', 404);
      if (!item.checked_out_at) throw new DomainError('Позиция не отмечалась при погрузке');
      if (item.checked_in_at) throw new DomainError('Позиция уже принята', 409);

      receive({
        kit,
        equipmentId: body.equipmentId,
        returnState: body.returnState,
        note: body.note,
        userId: req.user!.id,
        occurredAt
      });

      return { kit: kitPayload(db, kit) };
    }
  );
};
