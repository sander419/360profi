// Аналитика: что чаще ломается, что стоит в ремонте, что давно не проверяли.
//
// Главное правило этого модуля — не делать выводов из двух событий. Пока данных
// мало, честнее показать «данных мало», чем нарисовать красивый график, по
// которому кто-то примет решение о закупке.

import type { DatabaseSync } from 'node:sqlite';

/** Ниже этого числа событий любые «топы» — случайный шум, а не закономерность. */
export const ENOUGH_EVENTS = 10;

export interface AnalyticsResult {
  periodDays: number;
  enoughData: boolean;
  totals: {
    equipment: number;
    inRepair: number;
    defectsInPeriod: number;
    openDefects: number;
    neverChecked: number;
    staleChecks: number;
    checksInPeriod: number;
  };
  breakdownByCategory: { label: string; defects: number; units: number }[];
  topBroken: { code: string; name: string; category: string; defects: number; open: number }[];
  repair: { finished: number; averageDays: number | null; longestDays: number | null };
  trips: { total: number; closed: number; missingItems: number; damagedItems: number };
  activity: { total: number; byPerson: { name: string; actions: number }[] };
}

interface DefectRow {
  id: string;
  equipment_id: string;
  status: string;
  code: string;
  name: string;
  category: string;
}

interface StatusEventRow {
  equipment_id: string;
  to_status: string | null;
  created_at: string;
}

export const buildAnalytics = (db: DatabaseSync, periodDays: number): AnalyticsResult => {
  const days = Math.min(Math.max(Math.round(periodDays) || 90, 1), 3650);
  const since = `datetime('now', '-${days} days')`;

  const one = (sql: string, ...params: unknown[]): number =>
    Number((db.prepare(sql).get(...(params as never[])) as unknown as { c: number }).c);

  const defects = db
    .prepare(
      `SELECT d.id, d.equipment_id, d.status, e.code, e.name, e.category
         FROM defects d
         JOIN equipment e ON e.id = d.equipment_id
        WHERE d.created_at >= ${since}`
    )
    .all() as unknown as DefectRow[];

  // --- по категориям и по единицам -------------------------------------------
  const byCategory = new Map<string, { defects: number; units: Set<string> }>();
  const byUnit = new Map<string, { row: DefectRow; defects: number; open: number }>();

  for (const d of defects) {
    const cat = byCategory.get(d.category) ?? { defects: 0, units: new Set<string>() };
    cat.defects += 1;
    cat.units.add(d.equipment_id);
    byCategory.set(d.category, cat);

    const unit = byUnit.get(d.equipment_id) ?? { row: d, defects: 0, open: 0 };
    unit.defects += 1;
    if (d.status !== 'closed') unit.open += 1;
    byUnit.set(d.equipment_id, unit);
  }

  // --- сколько держится ремонт -----------------------------------------------
  // Считаем по журналу: переход в ремонт и следующий за ним выход из него.
  const statusEvents = db
    .prepare(
      `SELECT equipment_id, to_status, created_at
         FROM equipment_events
        WHERE to_status IN ('repair', 'stock')
        ORDER BY equipment_id, created_at`
    )
    .all() as unknown as StatusEventRow[];

  const durations: number[] = [];
  const openedAt = new Map<string, string>();
  for (const event of statusEvents) {
    if (event.to_status === 'repair') {
      // Повторный вход в ремонт без выхода — считаем по первому.
      if (!openedAt.has(event.equipment_id)) openedAt.set(event.equipment_id, event.created_at);
      continue;
    }
    const started = openedAt.get(event.equipment_id);
    if (!started) continue;
    openedAt.delete(event.equipment_id);
    const hours = (Date.parse(event.created_at) - Date.parse(started)) / 3600000;
    if (hours >= 0) durations.push(hours / 24);
  }

  const average = durations.length
    ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
    : null;
  const longest = durations.length ? Math.round(Math.max(...durations) * 10) / 10 : null;

  // --- выезды ------------------------------------------------------------------
  const tripsTotal = one(`SELECT COUNT(*) AS c FROM kits WHERE created_at >= ${since}`);
  const tripsClosed = one(
    `SELECT COUNT(*) AS c FROM kits k
      WHERE k.created_at >= ${since}
        AND EXISTS (SELECT 1 FROM kit_items i WHERE i.kit_id = k.id AND i.checked_out_at IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM kit_items i
           WHERE i.kit_id = k.id AND i.checked_out_at IS NOT NULL AND i.checked_in_at IS NULL
        )`
  );

  const returnedAs = (state: string): number =>
    one(
      `SELECT COUNT(*) AS c FROM kit_items i
         JOIN kits k ON k.id = i.kit_id
        WHERE k.created_at >= ${since} AND i.return_state = ?`,
      state
    );

  // --- активность людей ---------------------------------------------------------
  const activityRows = db
    .prepare(
      `SELECT u.name, COUNT(*) AS c
         FROM equipment_events e
         JOIN users u ON u.id = e.user_id
        WHERE e.created_at >= ${since}
        GROUP BY u.id
        ORDER BY c DESC
        LIMIT 5`
    )
    .all() as unknown as { name: string; c: number }[];

  const activityTotal = one(
    `SELECT COUNT(*) AS c FROM equipment_events WHERE created_at >= ${since}`
  );

  return {
    periodDays: days,
    // Мало событий — интерфейс обязан сказать об этом, а не рисовать «топы».
    enoughData: activityTotal >= ENOUGH_EVENTS,
    totals: {
      equipment: one('SELECT COUNT(*) AS c FROM equipment'),
      inRepair: one("SELECT COUNT(*) AS c FROM equipment WHERE status = 'repair'"),
      defectsInPeriod: defects.length,
      openDefects: one("SELECT COUNT(*) AS c FROM defects WHERE status != 'closed'"),
      neverChecked: one('SELECT COUNT(*) AS c FROM equipment WHERE last_check_on IS NULL'),
      staleChecks: one(
        "SELECT COUNT(*) AS c FROM equipment WHERE last_check_on IS NOT NULL AND last_check_on < date('now', '-60 days')"
      ),
      checksInPeriod: one(
        `SELECT COUNT(*) AS c FROM equipment_events WHERE kind = 'check' AND created_at >= ${since}`
      )
    },
    breakdownByCategory: [...byCategory.entries()]
      .map(([label, v]) => ({ label, defects: v.defects, units: v.units.size }))
      .sort((a, b) => b.defects - a.defects),
    topBroken: [...byUnit.values()]
      .sort((a, b) => b.defects - a.defects)
      .slice(0, 7)
      .map((u) => ({
        code: u.row.code,
        name: u.row.name,
        category: u.row.category,
        defects: u.defects,
        open: u.open
      })),
    repair: { finished: durations.length, averageDays: average, longestDays: longest },
    trips: {
      total: tripsTotal,
      closed: tripsClosed,
      missingItems: returnedAs('missing'),
      damagedItems: returnedAs('damaged')
    },
    activity: {
      total: activityTotal,
      byPerson: activityRows.map((r) => ({ name: r.name, actions: Number(r.c) }))
    }
  };
};
