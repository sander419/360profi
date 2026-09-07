// Комплект на выезд: собрали список → отметили по QR при погрузке → приняли обратно.
// Это пп. 13-14 из письма: предвыездная и постивентная проверка.

import type { FastifyInstance } from 'fastify';
import { nowIso, uid } from '../db.ts';
import { DomainError, changeStatus, getEquipment, openDefect, logEvent } from '../domain.ts';

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
  const kit = db.prepare('SELECT * FROM kits WHERE id = ?').get(id) as KitRow | undefined;
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
    .all(kit.id) as KitItemRow[];

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
  const managers = app.guard(['admin', 'manager']);

  app.get('/', { preHandler: anyUser }, async (req) => {
    const { projectId } = req.query as { projectId?: string };
    const kits = db
      .prepare(
        `SELECT * FROM kits ${projectId ? 'WHERE project_id = ?' : ''} ORDER BY created_at DESC`
      )
      .all(...(projectId ? [projectId] : [])) as KitRow[];
    return { kits: kits.map((k) => kitPayload(db, k)) };
  });

  app.get('/:id', { preHandler: anyUser }, async (req) => {
    const { id } = req.params as { id: string };
    return { kit: kitPayload(db, getKit(db, id)) };
  });

  app.post(
    '/',
    {
      preHandler: managers,
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
      preHandler: managers,
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

  app.delete('/:id/items/:equipmentId', { preHandler: managers }, async (req) => {
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
            note: { type: 'string', maxLength: 500 }
          }
        }
      }
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as { equipmentId: string; note?: string };
      const kit = getKit(db, id);

      const item = db
        .prepare('SELECT checked_out_at FROM kit_items WHERE kit_id = ? AND equipment_id = ?')
        .get(id, body.equipmentId) as { checked_out_at: string | null } | undefined;
      if (!item) throw new DomainError('Этой позиции нет в комплекте', 404);
      if (item.checked_out_at) throw new DomainError('Позиция уже отмечена как отгруженная', 409);

      const equipment = getEquipment(db, body.equipmentId);
      if (equipment.status === 'repair') {
        throw new DomainError('Оборудование в ремонте — на выезд его брать нельзя');
      }
      if (equipment.status === 'project' && equipment.project_id !== kit.project_id) {
        throw new DomainError('Оборудование уже на другом проекте', 409);
      }

      db.prepare(
        'UPDATE kit_items SET checked_out_at = ?, checked_out_by = ?, note = ? WHERE kit_id = ? AND equipment_id = ?'
      ).run(nowIso(), req.user!.id, body.note ?? '', id, body.equipmentId);

      changeStatus(db, {
        equipmentId: body.equipmentId,
        status: 'project',
        projectId: kit.project_id,
        userId: req.user!.id,
        note: `Погрузка: ${kit.name}`,
        kind: 'kit_out'
      });

      return { kit: kitPayload(db, kit) };
    }
  );

  // Возврат со съёмки. Повреждённое сразу уходит в ремонт с заведённым дефектом,
  // иначе «потом посмотрим» превращается в поломку на следующем выезде.
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
            note: { type: 'string', maxLength: 500 }
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
      };
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

      db.prepare(
        `UPDATE kit_items SET checked_in_at = ?, checked_in_by = ?, return_state = ?, note = ?
          WHERE kit_id = ? AND equipment_id = ?`
      ).run(nowIso(), req.user!.id, body.returnState, body.note ?? '', id, body.equipmentId);

      if (body.returnState === 'missing') {
        logEvent(db, {
          equipmentId: body.equipmentId,
          kind: 'kit_in',
          projectId: kit.project_id,
          userId: req.user!.id,
          note: `Не вернулось с проекта: ${body.note ?? ''}`.trim()
        });
        openDefect(db, {
          equipmentId: body.equipmentId,
          severity: 'blocker',
          description: `Не вернулось с выезда «${kit.name}». ${body.note ?? ''}`.trim(),
          userId: req.user!.id
        });
      } else {
        changeStatus(db, {
          equipmentId: body.equipmentId,
          status: body.returnState === 'damaged' ? 'repair' : 'stock',
          projectId: null,
          userId: req.user!.id,
          note: `Возврат: ${kit.name}. ${body.note ?? ''}`.trim(),
          kind: 'kit_in'
        });

        if (body.returnState === 'damaged') {
          openDefect(db, {
            equipmentId: body.equipmentId,
            severity: 'high',
            description: `Повреждение при возврате с выезда «${kit.name}». ${body.note ?? ''}`.trim(),
            userId: req.user!.id
          });
        }
      }

      return { kit: kitPayload(db, kit) };
    }
  );
};
