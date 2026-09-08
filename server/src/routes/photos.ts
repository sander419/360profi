// Фотографии поломок: техник снимает на телефон прямо на площадке.
//
// Приходят как base64 в JSON — так снимок проходит тем же путём, что и остальные
// отметки, и умеет ждать связи в очереди клиента. Multipart сюда не годится:
// его нельзя положить в очередь вместе с обычными действиями.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { SERVER_ROOT, defaultDbPath, nowIso, uid } from '../db.ts';
import { DomainError, getEquipment, logEvent, sanitizeOccurredAt } from '../domain.ts';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

export const photoDir = (): string => {
  const fromEnv = process.env.PHOTO_DIR;
  if (fromEnv) return fromEnv;
  const dbPath = defaultDbPath();
  return dbPath === ':memory:'
    ? path.join(SERVER_ROOT, 'data', 'photos')
    : path.join(path.dirname(dbPath), 'photos');
};

interface PhotoRow {
  id: string;
  equipment_id: string;
  defect_id: string | null;
  mime: string;
  bytes: number;
  token: string;
  created_at: string;
  occurred_at: string | null;
  author: string | null;
}

const serialize = (row: PhotoRow) => ({
  id: row.id,
  equipmentId: row.equipment_id,
  defectId: row.defect_id,
  bytes: row.bytes,
  author: row.author,
  createdAt: row.created_at,
  occurredAt: row.occurred_at ?? row.created_at,
  url: `/api/v1/photos/${row.id}?t=${row.token}`
});

export const photoRoutes = async (app: FastifyInstance): Promise<void> => {
  const { db } = app.ctx;
  const anyUser = app.guard([]);

  app.post(
    '/equipment/:id/photos',
    {
      preHandler: anyUser,
      // Снимок с телефона после сжатия — сотни килобайт; запас на случай,
      // если клиент прислал без ужимания.
      bodyLimit: 8 * 1024 * 1024,
      schema: {
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'string', minLength: 32 },
            defectId: { type: 'string', maxLength: 64 },
            occurredAt: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as { data: string; defectId?: string; occurredAt?: string };
      const equipment = getEquipment(db, id);

      // Принимаем и data:URL, и голый base64.
      const match = /^data:([^;,]+);base64,(.*)$/s.exec(body.data);
      const mime = match ? match[1]! : 'image/jpeg';
      const base64 = match ? match[2]! : body.data;

      const extension = ALLOWED.get(mime);
      if (!extension) {
        throw new DomainError(`Такой формат не принимаем: ${mime}. Нужен JPEG, PNG или WebP`);
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64, 'base64');
      } catch {
        throw new DomainError('Не удалось разобрать снимок');
      }
      if (buffer.length === 0) throw new DomainError('Пустой файл');
      if (buffer.length > MAX_BYTES) {
        throw new DomainError(
          `Снимок слишком большой: ${Math.round(buffer.length / 1024)} КБ, предел ${MAX_BYTES / 1024 / 1024} МБ`
        );
      }

      if (body.defectId) {
        const defect = db
          .prepare('SELECT equipment_id FROM defects WHERE id = ?')
          .get(body.defectId) as unknown as { equipment_id: string } | undefined;
        // Дефект мог ещё не дойти из очереди — тогда просто вешаем снимок
        // на единицу, связь восстановится по времени и автору.
        if (defect && defect.equipment_id !== id) {
          throw new DomainError('Дефект относится к другой единице оборудования', 409);
        }
      }

      const photoId = uid();
      const token = crypto.randomBytes(16).toString('base64url');
      const dir = photoDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${photoId}${extension}`), buffer);

      const occurredAt = sanitizeOccurredAt(body.occurredAt);
      db.prepare(
        `INSERT INTO photos (id, equipment_id, defect_id, user_id, mime, bytes, token, created_at, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        photoId,
        id,
        body.defectId ?? null,
        req.user!.id,
        mime,
        buffer.length,
        token,
        nowIso(),
        occurredAt
      );

      logEvent(db, {
        equipmentId: id,
        kind: 'note',
        fromStatus: equipment.status,
        toStatus: equipment.status,
        userId: req.user!.id,
        note: 'Добавлен снимок',
        occurredAt
      });

      return reply.code(201).send({
        photo: {
          id: photoId,
          url: `/api/v1/photos/${photoId}?t=${token}`,
          bytes: buffer.length
        }
      });
    }
  );

  app.get('/equipment/:id/photos', { preHandler: anyUser }, async (req) => {
    const { id } = req.params as { id: string };
    getEquipment(db, id);
    const rows = db
      .prepare(
        `SELECT p.*, u.name AS author FROM photos p
           LEFT JOIN users u ON u.id = p.user_id
          WHERE p.equipment_id = ?
          ORDER BY p.created_at DESC
          LIMIT 50`
      )
      .all(id) as unknown as PhotoRow[];
    return { photos: rows.map(serialize) };
  });

  // Отдача картинки. Авторизация — по токену в ссылке: тег <img> не умеет
  // передавать заголовки, а ссылка неугадываема и живёт внутри приложения.
  app.get('/photos/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { t } = req.query as { t?: string };
    const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as unknown as
      | PhotoRow
      | undefined;
    if (!row) throw new DomainError('Снимок не найден', 404);

    const expected = Buffer.from(row.token);
    const given = Buffer.from(t ?? '');
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      throw new DomainError('Нет доступа к снимку', 403);
    }

    const file = path.join(photoDir(), `${row.id}${ALLOWED.get(row.mime) ?? '.jpg'}`);
    if (!fs.existsSync(file)) throw new DomainError('Файл снимка потерян', 404);

    return reply
      .header('content-type', row.mime)
      .header('cache-control', 'private, max-age=86400')
      .send(fs.createReadStream(file));
  });
};
