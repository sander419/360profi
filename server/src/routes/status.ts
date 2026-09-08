// Состояние системы для человека, который за неё отвечает.
//
// Сторож (deploy/watchdog.sh) раз в пять минут пишет файл с результатами проверок.
// Здесь этот файл отдаётся вместе с тем, что знает сам сервер. Смысл — чтобы
// «всё ли в порядке» можно было проверить с телефона, а не по ssh.

import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { defaultDbPath } from '../db.ts';
import { buildAnalytics } from '../analytics.ts';

interface WatchdogState {
  checkedAt: string;
  status: 'ok' | 'problem';
  apiOk: boolean;
  apiMs: number;
  service: string;
  diskUsedPercent: number;
  backupAgeHours: number;
  certDaysLeft: number;
  restarted: boolean;
  problems: string[];
}

const statePath = (): string => {
  if (process.env.WATCHDOG_STATE) return process.env.WATCHDOG_STATE;
  const db = defaultDbPath();
  return db === ':memory:' ? '' : path.join(path.dirname(db), 'watchdog.json');
};

const readWatchdog = (): WatchdogState | null => {
  const file = statePath();
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as WatchdogState;
  } catch {
    // Файла нет или он битый — сторож не настроен либо ещё ни разу не отработал.
    return null;
  }
};

const dbBytes = (): number => {
  const file = defaultDbPath();
  if (file === ':memory:') return 0;
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
};

export const statusRoutes = async (app: FastifyInstance): Promise<void> => {
  const { db } = app.ctx;
  const managers = app.guard(['admin', 'manager']);

  // Аналитика рядом со статусом: и то и другое — «как оно всё в целом»,
  // и смотрит на них один и тот же человек.
  app.get('/analytics', { preHandler: managers }, async (req) => {
    const { days } = req.query as { days?: string };
    return { analytics: buildAnalytics(db, Number(days) || 90) };
  });

  app.get('/status', { preHandler: managers }, async () => {
    const one = (sql: string): number =>
      Number((db.prepare(sql).get() as unknown as { c: number }).c);

    const watchdog = readWatchdog();
    const checkedAt = watchdog ? Date.parse(watchdog.checkedAt) : 0;

    return {
      server: {
        uptimeHours: Math.round((process.uptime() / 3600) * 10) / 10,
        dbBytes: dbBytes(),
        time: new Date().toISOString()
      },
      data: {
        equipment: one('SELECT COUNT(*) AS c FROM equipment'),
        users: one('SELECT COUNT(*) AS c FROM users WHERE active = 1'),
        openDefects: one("SELECT COUNT(*) AS c FROM defects WHERE status != 'closed'"),
        photos: one('SELECT COUNT(*) AS c FROM photos'),
        trips: one('SELECT COUNT(*) AS c FROM kits'),
        loginsLast7Days: one(
          "SELECT COUNT(*) AS c FROM access_log WHERE success = 1 AND created_at > datetime('now', '-7 days')"
        )
      },
      watchdog,
      // Сторож молчит дольше пятнадцати минут — значит, замолчал он сам,
      // и это отдельная проблема, о которой надо сказать прямо.
      watchdogStale: watchdog ? Date.now() - checkedAt > 15 * 60 * 1000 : true
    };
  });
};
