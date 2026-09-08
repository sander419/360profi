// Сводка выезда: короткий итог, который не стыдно кинуть в общий чат.
//
// В компании без отчётности это единственная бумажка, которую увидит руководитель.
// Поэтому текст собирается на сервере: и приложение, и оповещение шлют одно и то же,
// без пересказов и разночтений.

import type { DatabaseSync } from 'node:sqlite';
import { DomainError } from './domain.ts';

interface KitRow {
  id: string;
  project_id: string;
  name: string;
}

interface SummaryItem {
  code: string;
  name: string;
  note: string;
}

export interface TripSummary {
  kitId: string;
  kitName: string;
  projectCode: string | null;
  projectTitle: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  counts: {
    planned: number;
    taken: number;
    returnedOk: number;
    damaged: number;
    missing: number;
    pending: number;
  };
  damaged: SummaryItem[];
  missing: SummaryItem[];
  pending: SummaryItem[];
  defects: { code: string; name: string; severity: string; description: string }[];
  people: string[];
  text: string;
}

const line = (items: SummaryItem[]): string =>
  items.map((i) => `  ${i.code} ${i.name}${i.note ? ` — ${i.note}` : ''}`).join('\n');

export const buildTripSummary = (db: DatabaseSync, kitId: string): TripSummary => {
  const kit = db.prepare('SELECT id, project_id, name FROM kits WHERE id = ?').get(kitId) as unknown as
    | KitRow
    | undefined;
  if (!kit) throw new DomainError('Выезд не найден', 404);

  const project = db
    .prepare('SELECT code, title FROM projects WHERE id = ?')
    .get(kit.project_id) as unknown as { code: string; title: string } | undefined;

  const rows = db
    .prepare(
      `SELECT ki.checked_out_at, ki.checked_in_at, ki.return_state, ki.note,
              e.id AS equipment_id, e.code, e.name,
              po.name AS loader, pi.name AS receiver
         FROM kit_items ki
         JOIN equipment e ON e.id = ki.equipment_id
         LEFT JOIN users po ON po.id = ki.checked_out_by
         LEFT JOIN users pi ON pi.id = ki.checked_in_by
        WHERE ki.kit_id = ?
        ORDER BY e.code`
    )
    .all(kitId) as unknown as {
    checked_out_at: string | null;
    checked_in_at: string | null;
    return_state: string | null;
    note: string;
    equipment_id: string;
    code: string;
    name: string;
    loader: string | null;
    receiver: string | null;
  }[];

  const taken = rows.filter((r) => r.checked_out_at);
  const toItem = (r: (typeof rows)[number]): SummaryItem => ({
    code: r.code,
    name: r.name,
    note: r.note ?? ''
  });

  const damaged = taken.filter((r) => r.return_state === 'damaged').map(toItem);
  const missing = taken.filter((r) => r.return_state === 'missing').map(toItem);
  const pending = taken.filter((r) => !r.checked_in_at).map(toItem);
  const returnedOk = taken.filter((r) => r.return_state === 'ok').length;

  const startedAt = taken.reduce<string | null>(
    (min, r) => (r.checked_out_at && (!min || r.checked_out_at < min) ? r.checked_out_at : min),
    null
  );
  const finishedAt = taken.reduce<string | null>(
    (max, r) => (r.checked_in_at && (!max || r.checked_in_at > max) ? r.checked_in_at : max),
    null
  );

  // Поломки, заведённые с начала погрузки по этим единицам: то, ради чего
  // сводку и читают.
  const equipmentIds = taken.map((r) => r.equipment_id);
  const defects =
    equipmentIds.length > 0 && startedAt
      ? (db
          .prepare(
            `SELECT e.code, e.name, d.severity, d.description
               FROM defects d
               JOIN equipment e ON e.id = d.equipment_id
              WHERE d.equipment_id IN (${equipmentIds.map(() => '?').join(', ')})
                AND d.created_at >= ?
              ORDER BY d.created_at`
          )
          .all(...equipmentIds, startedAt) as unknown as {
          code: string;
          name: string;
          severity: string;
          description: string;
        }[])
      : [];

  const people = [
    ...new Set(taken.flatMap((r) => [r.loader, r.receiver]).filter((n): n is string => Boolean(n)))
  ];

  const header = `Выезд «${kit.name}»${project ? ` · ${project.code}` : ''}`;
  const parts = [
    header,
    `Уехало: ${taken.length} · вернулось целыми: ${returnedOk}`
  ];
  if (damaged.length > 0) parts.push(`В ремонт: ${damaged.length}\n${line(damaged)}`);
  if (missing.length > 0) parts.push(`Не вернулось: ${missing.length}\n${line(missing)}`);
  if (pending.length > 0) parts.push(`Ещё не принято: ${pending.length}\n${line(pending)}`);
  if (defects.length > 0) {
    parts.push(
      `Поломки за выезд: ${defects.length}\n` +
        defects.map((d) => `  ${d.code} — ${d.description}`).join('\n')
    );
  }
  if (people.length > 0) parts.push(`Отмечали: ${people.join(', ')}`);

  return {
    kitId,
    kitName: kit.name,
    projectCode: project?.code ?? null,
    projectTitle: project?.title ?? null,
    startedAt,
    finishedAt,
    counts: {
      planned: rows.length,
      taken: taken.length,
      returnedOk,
      damaged: damaged.length,
      missing: missing.length,
      pending: pending.length
    },
    damaged,
    missing,
    pending,
    defects,
    people,
    text: parts.join('\n')
  };
};
