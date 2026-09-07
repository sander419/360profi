// Доменные правила модуля оборудования: смена статуса, журнал, дефекты.
// Всё, что меняет статус единицы, проходит здесь — чтобы журнал нельзя было обойти.

import type { DatabaseSync } from 'node:sqlite';
import { uid, nowIso, todayIso, isoDateOf } from './db.ts';

export type EquipmentStatus = 'stock' | 'project' | 'repair' | 'reserved' | 'transit';

export const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  'stock',
  'project',
  'repair',
  'reserved',
  'transit'
];

export type EventKind =
  | 'created'
  | 'updated'
  | 'status'
  | 'check'
  | 'defect'
  | 'kit_out'
  | 'kit_in'
  | 'note';

export interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  category: string;
  serial: string;
  status: EquipmentStatus;
  project_id: string | null;
  responsible_id: string | null;
  last_check_on: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

// Время действия приходит с телефона, который мог пролежать без связи и с
// неверными часами. Принимаем только правдоподобное, иначе журнал станет ложью.
export const sanitizeOccurredAt = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length === 0) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  const now = Date.now();
  if (ts > now + 5 * 60 * 1000) return null;
  if (ts < now - 60 * 86400000) return null;
  return new Date(ts).toISOString();
};

export class DomainError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const getEquipment = (db: DatabaseSync, id: string): EquipmentRow => {
  const row = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id) as unknown as EquipmentRow | undefined;
  if (!row) throw new DomainError('Единица оборудования не найдена', 404);
  return row;
};

export const logEvent = (
  db: DatabaseSync,
  event: {
    equipmentId: string;
    kind: EventKind;
    fromStatus?: string | null;
    toStatus?: string | null;
    projectId?: string | null;
    userId?: string | null;
    note?: string;
    occurredAt?: string | null;
  }
): void => {
  const at = nowIso();
  db.prepare(
    `INSERT INTO equipment_events
       (id, equipment_id, kind, from_status, to_status, project_id, user_id, note, created_at, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uid(),
    event.equipmentId,
    event.kind,
    event.fromStatus ?? null,
    event.toStatus ?? null,
    event.projectId ?? null,
    event.userId ?? null,
    event.note ?? '',
    at,
    event.occurredAt ?? at
  );
};

// Единственная точка смены статуса: пишет и саму единицу, и строку журнала.
export const changeStatus = (
  db: DatabaseSync,
  params: {
    equipmentId: string;
    status: EquipmentStatus;
    projectId?: string | null;
    userId: string | null;
    note?: string;
    kind?: EventKind;
    occurredAt?: string | null;
  }
): EquipmentRow => {
  const current = getEquipment(db, params.equipmentId);

  if (!EQUIPMENT_STATUSES.includes(params.status)) {
    throw new DomainError(`Неизвестный статус: ${params.status}`);
  }

  // На проекте и в резерве единица обязана быть привязана к проекту,
  // иначе «оборудование на выезде» превращается в необнаружимую пропажу.
  const needsProject = params.status === 'project' || params.status === 'reserved';
  const projectId = params.projectId === undefined ? current.project_id : params.projectId;
  if (needsProject && !projectId) {
    throw new DomainError(`Для статуса «${params.status}» нужен проект`);
  }
  const nextProject = needsProject || params.status === 'transit' ? projectId : null;

  if (nextProject) {
    const exists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(nextProject);
    if (!exists) throw new DomainError('Проект не найден', 404);
  }

  db.prepare('UPDATE equipment SET status = ?, project_id = ?, updated_at = ? WHERE id = ?').run(
    params.status,
    nextProject,
    nowIso(),
    params.equipmentId
  );

  logEvent(db, {
    equipmentId: params.equipmentId,
    kind: params.kind ?? 'status',
    fromStatus: current.status,
    toStatus: params.status,
    projectId: nextProject,
    userId: params.userId,
    note: params.note ?? '',
    occurredAt: params.occurredAt ?? null
  });

  return getEquipment(db, params.equipmentId);
};

export const markChecked = (
  db: DatabaseSync,
  params: {
    equipmentId: string;
    userId: string | null;
    note?: string;
    occurredAt?: string | null;
  }
): EquipmentRow => {
  const current = getEquipment(db, params.equipmentId);
  // Проверка, сделанная вчера без связи, должна остаться вчерашней.
  const checkedOn = params.occurredAt ? isoDateOf(new Date(params.occurredAt)) : todayIso();
  db.prepare('UPDATE equipment SET last_check_on = ?, updated_at = ? WHERE id = ?').run(
    checkedOn,
    nowIso(),
    params.equipmentId
  );
  logEvent(db, {
    equipmentId: params.equipmentId,
    kind: 'check',
    fromStatus: current.status,
    toStatus: current.status,
    projectId: current.project_id,
    userId: params.userId,
    note: params.note ?? '',
    occurredAt: params.occurredAt ?? null
  });
  return getEquipment(db, params.equipmentId);
};

export const openDefect = (
  db: DatabaseSync,
  params: {
    equipmentId: string;
    severity: 'low' | 'high' | 'blocker';
    description: string;
    userId: string | null;
    occurredAt?: string | null;
  }
): { id: string } => {
  getEquipment(db, params.equipmentId);
  const id = uid();
  db.prepare(
    `INSERT INTO defects (id, equipment_id, severity, description, status, reported_by, created_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?)`
  ).run(id, params.equipmentId, params.severity, params.description, params.userId, nowIso());

  logEvent(db, {
    equipmentId: params.equipmentId,
    kind: 'defect',
    userId: params.userId,
    note: `${params.severity}: ${params.description}`,
    occurredAt: params.occurredAt ?? null
  });

  return { id };
};

// Открытые дефекты по списку единиц — чтобы не делать запрос на каждую строку списка.
export const openDefectCounts = (db: DatabaseSync, ids: string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT equipment_id, COUNT(*) AS cnt FROM defects
        WHERE status != 'closed' AND equipment_id IN (${placeholders})
        GROUP BY equipment_id`
    )
    .all(...ids) as { equipment_id: string; cnt: number }[];
  for (const row of rows) counts.set(row.equipment_id, Number(row.cnt));
  return counts;
};

export const serializeEquipment = (row: EquipmentRow, openDefects = 0) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  category: row.category,
  serial: row.serial,
  status: row.status,
  projectId: row.project_id,
  responsibleId: row.responsible_id,
  lastCheckOn: row.last_check_on,
  note: row.note,
  openDefects,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
