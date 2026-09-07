import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { openDb, uid, nowIso } from '../src/db.ts';
import { hashPin } from '../src/auth.ts';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';

let app: FastifyInstance;
let db: DatabaseSync;

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
  options: { token?: string; body?: unknown } = {}
) =>
  app.inject({
    method,
    url,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
    payload: options.body as object | undefined
  });

before(async () => {
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
