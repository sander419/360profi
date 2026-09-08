import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { openDb, uid, nowIso } from '../src/db.ts';
import { hashPin } from '../src/auth.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';

let app: FastifyInstance;
let db: DatabaseSync;
let photoTempDir = '';

const ids = {
  manager: uid(),
  tech: uid(),
  project: uid(),
  otherProject: uid(),
  led: uid(),
  camera: uid(),
  broken: uid()
};

const tokens: Record<string, string> = {};

const seedFixtures = (database: DatabaseSync): void => {
  const ts = nowIso();
  const insertUser = database.prepare(
    'INSERT INTO users (id, name, phone, role, pin_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  insertUser.run(ids.manager, 'Анна Менеджер', '+70000000001', 'manager', hashPin('123456'), ts);
  insertUser.run(ids.tech, 'Сергей Техник', '+70000000002', 'tech', hashPin('654321'), ts);

  const insertProject = database.prepare(
    'INSERT INTO projects (id, code, title, venue, starts_on, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertProject.run(ids.project, 'P-900', 'Тестовый форум', 'Площадка', '2026-10-01', 'active', ts);
  insertProject.run(ids.otherProject, 'P-901', 'Другой проект', '', null, 'active', ts);

  const insertEquipment = database.prepare(
    `INSERT INTO equipment (id, code, name, category, serial, status, project_id, responsible_id, last_check_on, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, '', ?, ?)`
  );
  insertEquipment.run(ids.led, 'LED-9001', 'LED-кабинет тест', 'LED', 'stock', null, ids.tech, '2026-08-01', ts, ts);
  insertEquipment.run(ids.camera, 'CAM-9001', 'Камера тест', 'Камеры', 'stock', null, ids.tech, null, ts, ts);
  insertEquipment.run(ids.broken, 'LED-9002', 'Сломанный кабинет', 'LED', 'repair', null, ids.tech, null, ts, ts);
};

const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  options: { token?: string; body?: unknown; key?: string } = {}
) => {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.key) headers['idempotency-key'] = options.key;
  return app.inject({ method, url, headers, payload: options.body as object | undefined });
};

before(async () => {
  // Снимки в тестах пишутся во временный каталог, а не в рабочий data/.
  photoTempDir = fs.mkdtempSync(path.join(os.tmpdir(), '360profi-photos-'));
  process.env.PHOTO_DIR = photoTempDir;
  db = openDb(':memory:');
  seedFixtures(db);
  app = await buildApp({ db });

  for (const [key, phone, pin] of [
    ['manager', '+70000000001', '123456'],
    ['tech', '+70000000002', '654321']
  ]) {
    const res = await call('POST', '/api/v1/auth/login', { body: { phone, pin } });
    assert.equal(res.statusCode, 200, `вход ${key}: ${res.body}`);
    tokens[key] = res.json().token;
  }
});

after(async () => {
  await app.close();
  db.close();
  fs.rmSync(photoTempDir, { recursive: true, force: true });
});

describe('вход', () => {
  test('неверный PIN не пускает', async () => {
    const res = await call('POST', '/api/v1/auth/login', {
      body: { phone: '+70000000001', pin: '000000' }
    });
    assert.equal(res.statusCode, 401);
  });

  test('несуществующий телефон отвечает так же, как неверный PIN', async () => {
    const res = await call('POST', '/api/v1/auth/login', {
      body: { phone: '+79999999999', pin: '123456' }
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error, 'Неверный телефон или PIN');
  });

  test('без токена список оборудования закрыт', async () => {
    const res = await call('GET', '/api/v1/equipment');
    assert.equal(res.statusCode, 401);
  });

  test('подделанный токен отклоняется', async () => {
    const res = await call('GET', '/api/v1/equipment', { token: `${tokens.tech}x` });
    assert.equal(res.statusCode, 401);
  });
});

describe('оборудование', () => {
  test('список фильтруется по статусу и поиску', async () => {
    const all = await call('GET', '/api/v1/equipment', { token: tokens.tech });
    assert.equal(all.statusCode, 200);
    assert.equal(all.json().items.length, 3);

    const repair = await call('GET', '/api/v1/equipment?status=repair', { token: tokens.tech });
    assert.equal(repair.json().items.length, 1);

    const search = await call('GET', '/api/v1/equipment?search=CAM-90', { token: tokens.tech });
    assert.equal(search.json().items[0].code, 'CAM-9001');
  });

  test('поиск по коду с QR отдаёт карточку', async () => {
    const res = await call('GET', '/api/v1/equipment/by-code/LED-9001', { token: tokens.tech });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().item.id, ids.led);

    const missing = await call('GET', '/api/v1/equipment/by-code/NOPE', { token: tokens.tech });
    assert.equal(missing.statusCode, 404);
  });

  test('техник не может заводить оборудование, менеджер может', async () => {
    const denied = await call('POST', '/api/v1/equipment', {
      token: tokens.tech,
      body: { name: 'Новый прибор', category: 'Свет' }
    });
    assert.equal(denied.statusCode, 403);

    const created = await call('POST', '/api/v1/equipment', {
      token: tokens.manager,
      body: { name: 'Новый прибор', category: 'Свет' }
    });
    assert.equal(created.statusCode, 201);
    assert.match(created.json().item.code, /^EQ-\d{4}$/);
  });

  test('статус «на проекте» без проекта отклоняется', async () => {
    const res = await call('POST', `/api/v1/equipment/${ids.camera}/status`, {
      token: tokens.tech,
      body: { status: 'project' }
    });
    assert.equal(res.statusCode, 400);
  });

  test('смена статуса пишется в журнал', async () => {
    const res = await call('POST', `/api/v1/equipment/${ids.camera}/status`, {
      token: tokens.tech,
      body: { status: 'project', projectId: ids.project, note: 'уехала на площадку' }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().item.status, 'project');

    const history = await call('GET', `/api/v1/equipment/${ids.camera}/history`, {
      token: tokens.tech
    });
    const last = history.json().events[0];
    assert.equal(last.kind, 'status');
    assert.equal(last.fromStatus, 'stock');
    assert.equal(last.toStatus, 'project');
    assert.equal(last.userName, 'Сергей Техник');
    assert.equal(last.projectCode, 'P-900');
  });

  test('отметка проверки ставит сегодняшнюю дату', async () => {
    const res = await call('POST', `/api/v1/equipment/${ids.led}/check`, {
      token: tokens.tech,
      body: { note: 'предвыездная' }
    });
    assert.equal(res.statusCode, 200);
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    assert.equal(res.json().item.lastCheckOn, expected);
  });

  test('дефект попадает в счётчик открытых', async () => {
    const created = await call('POST', `/api/v1/equipment/${ids.led}/defects`, {
      token: tokens.tech,
      body: { severity: 'high', description: 'Битый пиксель' }
    });
    assert.equal(created.statusCode, 201);

    const item = await call('GET', `/api/v1/equipment/${ids.led}`, { token: tokens.tech });
    assert.equal(item.json().item.openDefects, 1);

    const list = await call('GET', '/api/v1/defects', { token: tokens.tech });
    assert.equal(list.json().defects.length, 1);
  });
});

describe('комплект на выезд', () => {
  let kitId = '';

  test('менеджер собирает комплект', async () => {
    const res = await call('POST', '/api/v1/kits', {
      token: tokens.manager,
      body: {
        projectId: ids.project,
        name: 'Основной комплект',
        equipmentIds: [ids.led, ids.broken]
      }
    });
    assert.equal(res.statusCode, 201);
    kitId = res.json().kit.id;
    assert.equal(res.json().kit.progress.total, 2);
    assert.equal(res.json().kit.progress.readiness, 0);
  });

  test('погрузка переводит единицу на проект и считает готовность', async () => {
    const res = await call('POST', `/api/v1/kits/${kitId}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: ids.led }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().kit.progress.loaded, 1);
    assert.equal(res.json().kit.progress.readiness, 50);

    const item = await call('GET', `/api/v1/equipment/${ids.led}`, { token: tokens.tech });
    assert.equal(item.json().item.status, 'project');
    assert.equal(item.json().item.projectId, ids.project);
  });

  test('повторная погрузка той же позиции отклоняется', async () => {
    const res = await call('POST', `/api/v1/kits/${kitId}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: ids.led }
    });
    assert.equal(res.statusCode, 409);
  });

  test('оборудование в ремонте на выезд не берётся', async () => {
    const res = await call('POST', `/api/v1/kits/${kitId}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: ids.broken }
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /ремонте/);
  });

  test('позицию, уже уехавшую на выезд, нельзя убрать из комплекта', async () => {
    const res = await call('DELETE', `/api/v1/kits/${kitId}/items/${ids.led}`, {
      token: tokens.manager
    });
    assert.equal(res.statusCode, 400);
  });

  test('возврат с повреждением уводит в ремонт и заводит дефект', async () => {
    const res = await call('POST', `/api/v1/kits/${kitId}/checkin`, {
      token: tokens.tech,
      body: { equipmentId: ids.led, returnState: 'damaged', note: 'разбит модуль' }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().kit.progress.returned, 1);

    const item = await call('GET', `/api/v1/equipment/${ids.led}`, { token: tokens.tech });
    assert.equal(item.json().item.status, 'repair');
    assert.equal(item.json().item.projectId, null);
    assert.equal(item.json().item.openDefects, 2);
  });

  test('приём позиции, которую не грузили, отклоняется', async () => {
    const res = await call('POST', `/api/v1/kits/${kitId}/checkin`, {
      token: tokens.tech,
      body: { equipmentId: ids.broken, returnState: 'ok' }
    });
    assert.equal(res.statusCode, 400);
  });
});

describe('работа без связи', () => {
  test('повтор с тем же ключом не применяется дважды', async () => {
    const key = 'op-' + uid();
    const body = { severity: 'low', description: 'Скол на корпусе' };

    const first = await call('POST', `/api/v1/equipment/${ids.camera}/defects`, {
      token: tokens.tech,
      body,
      key
    });
    assert.equal(first.statusCode, 201);

    const repeat = await call('POST', `/api/v1/equipment/${ids.camera}/defects`, {
      token: tokens.tech,
      body,
      key
    });
    assert.equal(repeat.statusCode, 201);
    assert.equal(repeat.headers['idempotent-replay'], 'true');
    assert.deepEqual(repeat.json(), first.json(), 'повтор отдаёт сохранённый ответ');

    const item = await call('GET', `/api/v1/equipment/${ids.camera}`, { token: tokens.tech });
    assert.equal(item.json().item.openDefects, 1, 'дефект должен быть один');
  });

  test('разные ключи — разные операции', async () => {
    await call('POST', `/api/v1/equipment/${ids.camera}/defects`, {
      token: tokens.tech,
      body: { severity: 'low', description: 'Второй скол' },
      key: 'op-' + uid()
    });
    const item = await call('GET', `/api/v1/equipment/${ids.camera}`, { token: tokens.tech });
    assert.equal(item.json().item.openDefects, 2);
  });

  test('отметка, сделанная вчера без связи, остаётся вчерашней', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    const res = await call('POST', `/api/v1/equipment/${ids.broken}/check`, {
      token: tokens.tech,
      body: { note: 'осмотр на площадке', occurredAt: yesterday.toISOString() }
    });
    assert.equal(res.statusCode, 200);

    const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    assert.equal(res.json().item.lastCheckOn, expected);

    const history = await call('GET', `/api/v1/equipment/${ids.broken}/history`, {
      token: tokens.tech
    });
    const last = history.json().events[0];
    assert.equal(last.kind, 'check');
    assert.ok(
      new Date(last.occurredAt).getTime() < new Date(last.createdAt).getTime(),
      'время на площадке должно быть раньше времени записи на сервере'
    );
  });

  test('время из будущего игнорируется, берётся серверное', async () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    const res = await call('POST', `/api/v1/equipment/${ids.broken}/check`, {
      token: tokens.tech,
      body: { occurredAt: future }
    });
    assert.equal(res.statusCode, 200);
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    assert.equal(res.json().item.lastCheckOn, expected);
  });
});

describe('снимки поломок', () => {
  // Однопиксельный PNG: содержимое неважно, важен путь через API и диск.
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const defectId = uid();

  test('дефект можно завести с идентификатором от клиента', async () => {
    const res = await call('POST', `/api/v1/equipment/${ids.camera}/defects`, {
      token: tokens.tech,
      body: { id: defectId, severity: 'high', description: 'Трещина на объективе' }
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().id, defectId, 'сервер сохраняет id, придуманный телефоном');
  });

  test('повтор того же идентификатора отклоняется', async () => {
    const res = await call('POST', `/api/v1/equipment/${ids.camera}/defects`, {
      token: tokens.tech,
      body: { id: defectId, severity: 'high', description: 'Трещина на объективе' }
    });
    assert.equal(res.statusCode, 409);
  });

  test('снимок загружается и виден в дефекте', async () => {
    const upload = await call('POST', `/api/v1/equipment/${ids.camera}/photos`, {
      token: tokens.tech,
      body: { data: `data:image/png;base64,${pngBase64}`, defectId }
    });
    assert.equal(upload.statusCode, 201);
    const { url } = upload.json().photo;
    assert.match(url, /^\/api\/v1\/photos\/[0-9a-f-]+\?t=/);

    const list = await call('GET', `/api/v1/equipment/${ids.camera}/photos`, {
      token: tokens.tech
    });
    assert.equal(list.json().photos.length, 1);
    assert.equal(list.json().photos[0].author, 'Сергей Техник');

    const defects = await call('GET', '/api/v1/defects', { token: tokens.manager });
    const withPhoto = defects.json().defects.find((d: { id: string }) => d.id === defectId);
    assert.equal(withPhoto.photos.length, 1, 'снимок виден менеджеру в списке дефектов');
  });

  test('снимок отдаётся только по правильному токену', async () => {
    const list = await call('GET', `/api/v1/equipment/${ids.camera}/photos`, {
      token: tokens.tech
    });
    const url: string = list.json().photos[0].url;

    const ok = await call('GET', url);
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.headers['content-type'], 'image/png');

    const wrong = await call('GET', `${url.split('?')[0]}?t=подделка`);
    assert.equal(wrong.statusCode, 403);
  });

  test('чужой формат не принимается', async () => {
    const res = await call('POST', `/api/v1/equipment/${ids.camera}/photos`, {
      token: tokens.tech,
      body: { data: 'data:application/pdf;base64,JVBERi0xLjQK' }
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /формат/);
  });

  test('снимок к дефекту другой единицы отклоняется', async () => {
    const res = await call('POST', `/api/v1/equipment/${ids.led}/photos`, {
      token: tokens.tech,
      body: { data: `data:image/png;base64,${pngBase64}`, defectId }
    });
    assert.equal(res.statusCode, 409);
  });
});

describe('служебное', () => {
  test('health отвечает без токена', async () => {
    const res = await call('GET', '/api/v1/health');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
  });

  test('список сотрудников закрыт от техника', async () => {
    assert.equal((await call('GET', '/api/v1/users', { token: tokens.tech })).statusCode, 403);
    assert.equal((await call('GET', '/api/v1/users', { token: tokens.manager })).statusCode, 200);
  });

  test('создавать сотрудников может только админ', async () => {
    const res = await call('POST', '/api/v1/users', {
      token: tokens.manager,
      body: { name: 'Кто-то', phone: '+70000000003', role: 'tech' }
    });
    assert.equal(res.statusCode, 403);
  });
});
