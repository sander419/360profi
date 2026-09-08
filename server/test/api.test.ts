import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { openDb, uid, nowIso } from '../src/db.ts';
import { hashPin } from '../src/auth.ts';
import { resetNotifier, setNotifier } from '../src/notify.ts';
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

  // Железка появляется в руках у техника, а не в голове у менеджера: если
  // завести её может только менеджер, склад так и останется незаведённым.
  test('оборудование заводит любой сотрудник, автор попадает в журнал', async () => {
    const created = await call('POST', '/api/v1/equipment', {
      token: tokens.tech,
      body: { name: 'Новый прибор', category: 'Свет' }
    });
    assert.equal(created.statusCode, 201);
    assert.match(created.json().item.code, /^EQ-\d{4}$/);

    const history = await call('GET', `/api/v1/equipment/${created.json().item.id}/history`, {
      token: tokens.tech
    });
    assert.equal(history.json().events[0].kind, 'created');
    assert.equal(history.json().events[0].userName, 'Сергей Техник');
  });

  test('код с наклейки можно задать вручную', async () => {
    const created = await call('POST', '/api/v1/equipment', {
      token: tokens.tech,
      body: { code: 'SND-7777', name: 'Колонка со склада', category: 'Звук' }
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().item.code, 'SND-7777');

    const duplicate = await call('POST', '/api/v1/equipment', {
      token: tokens.tech,
      body: { code: 'SND-7777', name: 'Она же', category: 'Звук' }
    });
    assert.equal(duplicate.statusCode, 409);
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

  // Ночью на разгрузке двадцать позиций по одной не отметит никто.
  test('остаток принимается одной кнопкой, исключения отмечаются заранее', async () => {
    const project = (
      await call('POST', '/api/v1/projects', { token: tokens.tech, body: { title: 'Разгрузка' } })
    ).json().project;

    const codes = ['BULK-1', 'BULK-2', 'BULK-3'];
    const created = [];
    for (const code of codes) {
      const res = await call('POST', '/api/v1/equipment', {
        token: tokens.tech,
        body: { code, name: `Позиция ${code}`, category: 'Разное' }
      });
      created.push(res.json().item.id);
    }

    const kit = (
      await call('POST', '/api/v1/kits', {
        token: tokens.tech,
        body: { projectId: project.id, name: 'Ночная разгрузка', equipmentIds: created }
      })
    ).json().kit;

    for (const equipmentId of created) {
      await call('POST', `/api/v1/kits/${kit.id}/checkout`, {
        token: tokens.tech,
        body: { equipmentId }
      });
    }

    // Исключение отмечаем поштучно...
    await call('POST', `/api/v1/kits/${kit.id}/checkin`, {
      token: tokens.tech,
      body: { equipmentId: created[0], returnState: 'damaged', note: 'помяли корпус' }
    });

    // ...остальное — одной кнопкой.
    const rest = await call('POST', `/api/v1/kits/${kit.id}/checkin-rest`, {
      token: tokens.tech,
      body: {}
    });
    assert.equal(rest.statusCode, 200);
    assert.equal(rest.json().accepted, 2, 'принято ровно то, что оставалось');
    assert.equal(rest.json().kit.progress.returned, 3, 'выезд закрыт полностью');

    const damaged = await call('GET', `/api/v1/equipment/${created[0]}`, { token: tokens.tech });
    assert.equal(damaged.json().item.status, 'repair', 'повреждённое не уехало на склад');

    const fine = await call('GET', `/api/v1/equipment/${created[1]}`, { token: tokens.tech });
    assert.equal(fine.json().item.status, 'stock');
    assert.equal(fine.json().item.projectId, null);

    // Повторное нажатие ничего не портит: принимать больше нечего.
    const again = await call('POST', `/api/v1/kits/${kit.id}/checkin-rest`, {
      token: tokens.tech,
      body: {}
    });
    assert.equal(again.json().accepted, 0);
  });

  test('приём позиции, которую не грузили, отклоняется', async () => {
    const res = await call('POST', `/api/v1/kits/${kitId}/checkin`, {
      token: tokens.tech,
      body: { equipmentId: ids.broken, returnState: 'ok' }
    });
    assert.equal(res.statusCode, 400);
  });
});

// Компания без процессов не заведёт проект с кодом и не соберёт комплект заранее.
// Эти проверки закрепляют, что система работает, когда никто ничего не подготовил.
describe('работа без подготовки', () => {
  let kitId = '';
  let projectId = '';
  let freshId = '';

  test('проект заводит любой сотрудник, код придумывается сам', async () => {
    const res = await call('POST', '/api/v1/projects', {
      token: tokens.tech,
      body: { title: 'Свадьба в Лофте' }
    });
    assert.equal(res.statusCode, 201);
    assert.match(res.json().project.code, /^P-\d{4}-\d+$/);
    projectId = res.json().project.id;
  });

  test('выезд создаёт тот, кто грузит, пустым', async () => {
    const res = await call('POST', '/api/v1/kits', {
      token: tokens.tech,
      body: { projectId, name: 'Что взяли' }
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().kit.progress.total, 0);
    kitId = res.json().kit.id;
  });

  test('скан позиции, которой нет в списке, добавляет её и грузит', async () => {
    // Заводим единицу здесь же: ровно так это и происходит на складе —
    // человек наклеил стикер, завёл и сразу грузит.
    const created = await call('POST', '/api/v1/equipment', {
      token: tokens.tech,
      body: { code: 'RIG-7001', name: 'Стойка со склада', category: 'Риггинг' }
    });
    assert.equal(created.statusCode, 201);
    freshId = created.json().item.id;

    const res = await call('POST', `/api/v1/kits/${kitId}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: freshId }
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().kit.progress.total, 1, 'позиция появилась в комплекте');
    assert.equal(res.json().kit.progress.loaded, 1);

    const item = await call('GET', `/api/v1/equipment/${freshId}`, { token: tokens.tech });
    assert.equal(item.json().item.projectId, projectId, 'единица уехала на этот проект');
  });

  test('в ремонте на выезд не уходит даже сканом', async () => {
    const res = await call('POST', `/api/v1/kits/${kitId}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: ids.broken }
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /ремонте/);

    const kit = await call('GET', `/api/v1/kits/${kitId}`, { token: tokens.tech });
    assert.equal(kit.json().kit.progress.total, 1, 'отклонённая позиция в комплект не попала');
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

// Сводка — единственная бумажка, которую в такой компании увидит руководитель.
describe('сводка выезда', () => {
  const sent: string[] = [];
  let kitId = '';

  before(async () => {
    setNotifier((event) => {
      if (event.kind === 'summary') sent.push(event.text);
    });

    const project = (
      await call('POST', '/api/v1/projects', {
        token: tokens.tech,
        body: { title: 'Корпоратив в Атриуме' }
      })
    ).json().project;

    const made: string[] = [];
    for (const [code, name] of [
      ['SUM-1', 'Экран 3х2'],
      ['SUM-2', 'Комплект света'],
      ['SUM-3', 'Радиомикрофон']
    ]) {
      const res = await call('POST', '/api/v1/equipment', {
        token: tokens.tech,
        body: { code, name, category: 'Разное' }
      });
      made.push(res.json().item.id);
    }

    kitId = (
      await call('POST', '/api/v1/kits', {
        token: tokens.tech,
        body: { projectId: project.id, name: 'Корпоратив в Атриуме' }
      })
    ).json().kit.id;

    for (const equipmentId of made) {
      await call('POST', `/api/v1/kits/${kitId}/checkout`, {
        token: tokens.tech,
        body: { equipmentId }
      });
    }

    await call('POST', `/api/v1/kits/${kitId}/checkin`, {
      token: tokens.manager,
      body: { equipmentId: made[1], returnState: 'damaged', note: 'сгорел блок питания' }
    });
    await call('POST', `/api/v1/kits/${kitId}/checkin`, {
      token: tokens.manager,
      body: { equipmentId: made[2], returnState: 'missing', note: 'не нашли на площадке' }
    });
  });

  after(() => resetNotifier());

  test('считает уехавшее, вернувшееся и незакрытое', async () => {
    const res = await call('GET', `/api/v1/kits/${kitId}/summary`, { token: tokens.tech });
    assert.equal(res.statusCode, 200);
    const { counts } = res.json().summary;
    assert.deepEqual(counts, {
      planned: 3,
      taken: 3,
      returnedOk: 0,
      damaged: 1,
      missing: 1,
      pending: 1
    });
  });

  test('текст читается человеком и называет проблемные позиции', async () => {
    const { text } = (
      await call('GET', `/api/v1/kits/${kitId}/summary`, { token: tokens.tech })
    ).json().summary;

    assert.match(text, /Выезд «Корпоратив в Атриуме»/);
    assert.match(text, /Уехало: 3/);
    assert.match(text, /В ремонт: 1\n {2}SUM-2 Комплект света — сгорел блок питания/);
    assert.match(text, /Не вернулось: 1\n {2}SUM-3 Радиомикрофон/);
    assert.match(text, /Ещё не принято: 1\n {2}SUM-1 Экран 3х2/);
    assert.match(text, /Отмечали: .*Сергей Техник/);
    assert.match(text, /Поломки за выезд: 2/, 'повреждение и пропажа завели дефекты');
  });

  test('сводку можно отправить в чат одной кнопкой', async () => {
    sent.length = 0;
    const res = await call('POST', `/api/v1/kits/${kitId}/summary/send`, {
      token: tokens.tech,
      body: {}
    });
    assert.equal(res.statusCode, 200);
    assert.equal(sent.length, 1);
    assert.match(sent[0]!, /Корпоратив в Атриуме/);
  });

  test('после приёма остатка незакрытых не остаётся', async () => {
    await call('POST', `/api/v1/kits/${kitId}/checkin-rest`, { token: tokens.tech, body: {} });
    const { counts } = (
      await call('GET', `/api/v1/kits/${kitId}/summary`, { token: tokens.tech })
    ).json().summary;
    assert.equal(counts.pending, 0);
    assert.equal(counts.returnedOk, 1);
  });
});

describe('оповещения', () => {
  const sent: { kind: string; text: string; code?: string }[] = [];

  before(() => {
    setNotifier((event) => {
      sent.push({ kind: event.kind, text: event.text, code: event.code });
    });
  });

  after(() => resetNotifier());

  test('о серьёзной поломке сообщают сразу, о мелочи — нет', async () => {
    sent.length = 0;

    await call('POST', `/api/v1/equipment/${ids.led}/defects`, {
      token: tokens.tech,
      body: { severity: 'low', description: 'Царапина на раме' }
    });
    assert.equal(sent.length, 0, 'мелочь никого не будит');

    await call('POST', `/api/v1/equipment/${ids.led}/defects`, {
      token: tokens.tech,
      body: { severity: 'blocker', description: 'Не запускается процессор' }
    });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.kind, 'defect');
    assert.equal(sent[0]!.code, 'LED-9001');
    assert.match(sent[0]!.text, /не работает: Не запускается процессор/);
    assert.match(sent[0]!.text, /Сергей Техник/);
  });

  test('невозврат с выезда тоже сообщается', async () => {
    sent.length = 0;
    const project = (
      await call('POST', '/api/v1/projects', { token: tokens.tech, body: { title: 'Пропажа' } })
    ).json().project;
    const equipment = (
      await call('POST', '/api/v1/equipment', {
        token: tokens.tech,
        body: { code: 'LOST-1', name: 'Радиосистема', category: 'Звук' }
      })
    ).json().item;
    const kit = (
      await call('POST', '/api/v1/kits', {
        token: tokens.tech,
        body: { projectId: project.id, name: 'Выезд с пропажей' }
      })
    ).json().kit;

    await call('POST', `/api/v1/kits/${kit.id}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: equipment.id }
    });
    await call('POST', `/api/v1/kits/${kit.id}/checkin`, {
      token: tokens.tech,
      body: { equipmentId: equipment.id, returnState: 'missing', note: 'нет в машине' }
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.code, 'LOST-1');
    assert.match(sent[0]!.text, /Не вернулось с выезда/);
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

// Требования закона о персональных данных, проверяемые кодом, а не обещанием.
// Смысл объявлений не в отправке, а в том, что видно, до кого дошло.
// Дыры, найденные аудитом логики. Каждая приводила к сорванному выезду
// или к доступу, который должен был закрыться.
describe('целостность рабочего процесса', () => {
  let unit = '';
  let project = '';
  let kit = '';

  before(async () => {
    unit = (
      await call('POST', '/api/v1/equipment', {
        token: tokens.tech,
        body: { code: 'AUD-1', name: 'Экран для аудита', category: 'LED' }
      })
    ).json().item.id;

    project = (
      await call('POST', '/api/v1/projects', { token: tokens.manager, body: { title: 'Аудит' } })
    ).json().project.id;

    kit = (
      await call('POST', '/api/v1/kits', {
        token: tokens.manager,
        body: { projectId: project, name: 'Комплект аудита' }
      })
    ).json().kit.id;
  });

  test('блокирующая поломка уводит единицу в ремонт сама', async () => {
    await call('POST', `/api/v1/equipment/${unit}/defects`, {
      token: tokens.tech,
      body: { severity: 'blocker', description: 'Не включается' }
    });
    const item = await call('GET', `/api/v1/equipment/${unit}`, { token: tokens.tech });
    assert.equal(
      item.json().item.status,
      'repair',
      'иначе нерабочая единица числится на складе и уезжает на выезд'
    );
  });

  test('с блокирующей поломкой не погрузить и не запланировать', async () => {
    const load = await call('POST', `/api/v1/kits/${kit}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: unit }
    });
    assert.equal(load.statusCode, 400);

    const plan = await call('POST', `/api/v1/kits/${kit}/items`, {
      token: tokens.manager,
      body: { equipmentId: unit }
    });
    assert.equal(plan.statusCode, 400);
  });

  test('закрытие последнего дефекта возвращает единицу в строй', async () => {
    const defects = (await call('GET', '/api/v1/defects', { token: tokens.manager })).json()
      .defects as { id: string; equipmentId: string }[];
    for (const d of defects.filter((x) => x.equipmentId === unit)) {
      await call('PATCH', `/api/v1/defects/${d.id}`, {
        token: tokens.manager,
        body: { status: 'closed' }
      });
    }

    const item = await call('GET', `/api/v1/equipment/${unit}`, { token: tokens.tech });
    assert.equal(item.json().item.status, 'stock', 'починили — значит, снова на складе');
  });

  test('позиция в списке выезда бронируется, чужой выезд её не заберёт', async () => {
    const added = await call('POST', `/api/v1/kits/${kit}/items`, {
      token: tokens.manager,
      body: { equipmentId: unit }
    });
    assert.equal(added.statusCode, 200);

    const item = await call('GET', `/api/v1/equipment/${unit}`, { token: tokens.tech });
    assert.equal(item.json().item.status, 'reserved');
    assert.equal(item.json().item.projectId, project);

    const otherKit = (
      await call('POST', '/api/v1/kits', {
        token: tokens.manager,
        body: { projectId: ids.project, name: 'Чужой выезд' }
      })
    ).json().kit.id;

    const stolen = await call('POST', `/api/v1/kits/${otherKit}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: unit }
    });
    assert.equal(stolen.statusCode, 409);
    assert.match(stolen.json().error, /забронировано/);
  });

  test('снятие из списка снимает бронь', async () => {
    await call('DELETE', `/api/v1/kits/${kit}/items/${unit}`, { token: tokens.manager });
    const item = await call('GET', `/api/v1/equipment/${unit}`, { token: tokens.tech });
    assert.equal(item.json().item.status, 'stock');
    assert.equal(item.json().item.projectId, null);
  });

  test('многодневный выезд: принятую позицию можно погрузить снова', async () => {
    await call('POST', `/api/v1/kits/${kit}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: unit }
    });
    await call('POST', `/api/v1/kits/${kit}/checkin`, {
      token: tokens.tech,
      body: { equipmentId: unit, returnState: 'ok' }
    });

    const again = await call('POST', `/api/v1/kits/${kit}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: unit }
    });
    assert.equal(again.statusCode, 200, 'вечером увезли, утром привезли — обычное дело');
    const items = again.json().kit.items as { equipmentId: string; checkedInAt: string | null }[];
    assert.equal(items.find((i) => i.equipmentId === unit)?.checkedInAt, null);
  });

  test('не вернулось — отдельный статус, а не «вечно на проекте»', async () => {
    await call('POST', `/api/v1/kits/${kit}/checkin`, {
      token: tokens.tech,
      body: { equipmentId: unit, returnState: 'missing', note: 'нет в машине' }
    });

    const item = await call('GET', `/api/v1/equipment/${unit}`, { token: tokens.tech });
    assert.equal(item.json().item.status, 'lost');
    assert.equal(item.json().item.projectId, null, 'проект закроют, а железки нет');

    const load = await call('POST', `/api/v1/kits/${kit}/checkout`, {
      token: tokens.tech,
      body: { equipmentId: unit }
    });
    assert.equal(load.statusCode, 400, 'потерянное на выезд не отдаём');
  });
});

describe('отзыв доступа', () => {
  // Временные учётки убираем за собой: иначе они попадают в аудиторию
  // объявлений и ломают проверки охвата в соседнем наборе.
  after(() => {
    db.prepare("UPDATE users SET active = 0 WHERE phone IN ('+70000000777', '+70000000778')").run();
  });

  test('отключённый сотрудник теряет доступ сразу, а не через месяц', async () => {
    const created = await call('POST', '/api/v1/users', {
      token: tokens.manager,
      body: { name: 'Временный', phone: '+70000000777', role: 'tech' }
    });
    // Заводить людей может только админ — в этом наборе его нет, поэтому
    // добавляем напрямую и логинимся честно через API.
    assert.equal(created.statusCode, 403);

    const id = uid();
    db.prepare(
      'INSERT INTO users (id, name, phone, role, pin_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(id, 'Временный', '+70000000777', 'tech', hashPin('111111'), nowIso());

    const login = await call('POST', '/api/v1/auth/login', {
      body: { phone: '+70000000777', pin: '111111' }
    });
    const token = login.json().token;
    assert.equal((await call('GET', '/api/v1/equipment', { token })).statusCode, 200);

    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(id);

    assert.equal(
      (await call('GET', '/api/v1/equipment', { token })).statusCode,
      401,
      'старый токен в кармане уволенного больше не работает'
    );
  });

  test('роль берётся из базы, а не из токена', async () => {
    const id = uid();
    db.prepare(
      'INSERT INTO users (id, name, phone, role, pin_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(id, 'Бывший менеджер', '+70000000778', 'manager', hashPin('222222'), nowIso());

    const token = (
      await call('POST', '/api/v1/auth/login', { body: { phone: '+70000000778', pin: '222222' } })
    ).json().token;
    assert.equal((await call('GET', '/api/v1/status', { token })).statusCode, 200);

    db.prepare("UPDATE users SET role = 'tech' WHERE id = ?").run(id);
    assert.equal(
      (await call('GET', '/api/v1/status', { token })).statusCode,
      403,
      'понижение в правах действует сразу, а не после перевхода'
    );
  });
});

describe('объявления руководства', () => {
  let id = '';

  test('техник объявления не пишет', async () => {
    const res = await call('POST', '/api/v1/announcements', {
      token: tokens.tech,
      body: { text: 'Всем срочно на склад' }
    });
    assert.equal(res.statusCode, 403);
  });

  test('менеджер пишет, техник видит', async () => {
    const created = await call('POST', '/api/v1/announcements', {
      token: tokens.manager,
      body: { text: 'В пятницу инвентаризация, склад закрыт с 15:00', kind: 'task' }
    });
    assert.equal(created.statusCode, 201);
    id = created.json().id;

    const mine = await call('GET', '/api/v1/announcements', { token: tokens.tech });
    const found = mine.json().announcements.find((a: { id: string }) => a.id === id);
    assert.ok(found, 'объявление дошло до техника');
    assert.equal(found.acknowledged, false, 'пока не подтверждено');
    assert.equal(found.author, 'Анна Менеджер');
  });

  test('автор считается прочитавшим сразу', async () => {
    const reads = await call('GET', `/api/v1/announcements/${id}/reads`, {
      token: tokens.manager
    });
    assert.deepEqual(
      reads.json().read.map((r: { name: string }) => r.name),
      ['Анна Менеджер']
    );
    assert.deepEqual(
      reads.json().notRead.map((r: { name: string }) => r.name),
      ['Сергей Техник'],
      'видно поимённо, до кого не дошло'
    );
  });

  test('подтверждение отмечает прочтение и повтор ничего не ломает', async () => {
    assert.equal(
      (await call('POST', `/api/v1/announcements/${id}/ack`, { token: tokens.tech, body: {} }))
        .statusCode,
      200
    );
    assert.equal(
      (await call('POST', `/api/v1/announcements/${id}/ack`, { token: tokens.tech, body: {} }))
        .statusCode,
      200,
      'повторное подтверждение — не ошибка: оно могло уйти из очереди дважды'
    );

    const reads = await call('GET', `/api/v1/announcements/${id}/reads`, {
      token: tokens.manager
    });
    assert.equal(reads.json().read.length, 2);
    assert.equal(reads.json().notRead.length, 0);
  });

  test('адресность работает: объявление для менеджеров технику не показывают', async () => {
    const created = await call('POST', '/api/v1/announcements', {
      token: tokens.manager,
      body: { text: 'Планёрка по бюджету', audience: 'manager' }
    });
    const forManager = created.json().id;

    const techSees = (await call('GET', '/api/v1/announcements', { token: tokens.tech }))
      .json()
      .announcements.map((a: { id: string }) => a.id);
    assert.ok(!techSees.includes(forManager));

    const managerSees = (await call('GET', '/api/v1/announcements', { token: tokens.manager }))
      .json()
      .announcements.map((a: { id: string }) => a.id);
    assert.ok(managerSees.includes(forManager));
  });

  test('в списке отправленных виден охват', async () => {
    const sent = await call('GET', '/api/v1/announcements/sent', { token: tokens.manager });
    const row = sent.json().announcements.find((a: { id: string }) => a.id === id);
    assert.equal(row.reads, 2);
    assert.ok(row.audienceSize >= 2);
  });

  // Счётчик обязан мерить одно и то же в числителе и знаменателе.
  test('в охват попадают только читатели из аудитории, включая автора', async () => {
    const forTech = (
      await call('POST', '/api/v1/announcements', {
        token: tokens.manager,
        body: { text: 'Только для техников', audience: 'tech' }
      })
    ).json().id;

    const before = (await call('GET', '/api/v1/announcements/sent', { token: tokens.manager }))
      .json()
      .announcements.find((a: { id: string }) => a.id === forTech);
    assert.equal(before.reads, 0, 'менеджер-автор не считается прочитавшим у объявления для техников');

    await call('POST', `/api/v1/announcements/${forTech}/ack`, { token: tokens.tech, body: {} });

    const after = (await call('GET', '/api/v1/announcements/sent', { token: tokens.manager }))
      .json()
      .announcements.find((a: { id: string }) => a.id === forTech);
    assert.equal(after.reads, 1);
    assert.equal(after.audienceSize, 1, 'в аудитории один техник');
  });

  test('снятое объявление уходит с экранов', async () => {
    await call('DELETE', `/api/v1/announcements/${id}`, { token: tokens.manager });
    const mine = await call('GET', '/api/v1/announcements', { token: tokens.tech });
    assert.ok(!mine.json().announcements.some((a: { id: string }) => a.id === id));
  });
});

describe('аналитика', () => {
  test('закрыта от техника', async () => {
    assert.equal((await call('GET', '/api/v1/analytics', { token: tokens.tech })).statusCode, 403);
  });

  test('считает поломки по единицам и категориям', async () => {
    const { analytics } = (
      await call('GET', '/api/v1/analytics?days=365', { token: tokens.manager })
    ).json();

    assert.ok(analytics.totals.equipment > 0);
    assert.ok(analytics.totals.defectsInPeriod > 0, 'дефекты за период посчитаны');
    assert.ok(analytics.topBroken.length > 0, 'есть список того, что ломается чаще');
    assert.ok(
      analytics.topBroken[0].defects >= analytics.topBroken.at(-1).defects,
      'список отсортирован по убыванию'
    );
    assert.ok(analytics.breakdownByCategory.length > 0);
    assert.ok(
      analytics.breakdownByCategory.every((c: { units: number }) => c.units > 0),
      'в каждой категории считаются единицы, а не только дефекты'
    );
  });

  test('период сужает выборку', async () => {
    const wide = (
      await call('GET', '/api/v1/analytics?days=365', { token: tokens.manager })
    ).json().analytics;
    const narrow = (
      await call('GET', '/api/v1/analytics?days=1', { token: tokens.manager })
    ).json().analytics;

    assert.equal(narrow.periodDays, 1);
    assert.ok(narrow.totals.defectsInPeriod <= wide.totals.defectsInPeriod);
  });

  test('считает длительность ремонта по журналу', async () => {
    // Единицу отправляли в ремонт и возвращали в тестах выше.
    const { analytics } = (
      await call('GET', '/api/v1/analytics?days=365', { token: tokens.manager })
    ).json();
    assert.ok(analytics.repair.finished >= 0);
    if (analytics.repair.finished > 0) {
      assert.equal(typeof analytics.repair.averageDays, 'number');
    } else {
      assert.equal(analytics.repair.averageDays, null, 'без завершённых ремонтов среднего нет');
    }
  });

  test('на пустой базе не выдумывает выводов', async () => {
    const empty = openDb(':memory:');
    // Своя учётка: токен теперь сверяется с базой на каждом запросе,
    // поэтому чужой токен в чужую базу не пройдёт — и это правильно.
    empty
      .prepare(
        'INSERT INTO users (id, name, phone, role, pin_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
      )
      .run(uid(), 'Пустой Менеджер', '+70000009999', 'manager', hashPin('999999'), nowIso());

    const emptyApp = await buildApp({ db: empty });
    const login = await emptyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { phone: '+70000009999', pin: '999999' }
    });
    const res = await emptyApp.inject({
      method: 'GET',
      url: '/api/v1/analytics',
      headers: { authorization: `Bearer ${login.json().token}` }
    });
    const { analytics } = res.json();

    assert.equal(analytics.enoughData, false, 'честно говорит, что данных мало');
    assert.deepEqual(analytics.topBroken, []);
    assert.equal(analytics.repair.averageDays, null);

    await emptyApp.close();
    empty.close();
  });
});

describe('состояние системы', () => {
  test('техник состояние сервера не смотрит, менеджер смотрит', async () => {
    assert.equal((await call('GET', '/api/v1/status', { token: tokens.tech })).statusCode, 403);
    assert.equal((await call('GET', '/api/v1/status', { token: tokens.manager })).statusCode, 200);
  });

  test('отдаёт цифры, по которым видно, живое ли всё', async () => {
    const body = (await call('GET', '/api/v1/status', { token: tokens.manager })).json();

    assert.ok(body.data.equipment > 0, 'считает оборудование');
    assert.ok(body.data.users >= 2, 'считает активных сотрудников');
    assert.ok(body.data.loginsLast7Days >= 1, 'считает входы за неделю');
    assert.equal(typeof body.server.uptimeHours, 'number');
  });

  test('без сторожа честно говорит, что данных о проверках нет', async () => {
    const body = (await call('GET', '/api/v1/status', { token: tokens.manager })).json();
    // В тестах база в памяти, файла состояния нет — и это должно быть видно,
    // а не выглядеть как «всё хорошо».
    assert.equal(body.watchdog, null);
    assert.equal(body.watchdogStale, true);
  });
});

describe('персональные данные', () => {
  test('входы пишутся в журнал: и удачные, и нет', async () => {
    const before = (
      db.prepare('SELECT COUNT(*) AS c FROM access_log').get() as unknown as { c: number }
    ).c;

    await call('POST', '/api/v1/auth/login', {
      body: { phone: '+70000000002', pin: '654321' }
    });
    await call('POST', '/api/v1/auth/login', {
      body: { phone: '+70000000002', pin: '000000' }
    });

    const rows = db
      .prepare('SELECT success, user_id FROM access_log ORDER BY rowid DESC LIMIT 2')
      .all() as unknown as { success: number; user_id: string | null }[];
    const after = (
      db.prepare('SELECT COUNT(*) AS c FROM access_log').get() as unknown as { c: number }
    ).c;

    assert.equal(after - before, 2);
    assert.deepEqual(
      rows.map((r) => r.success).sort(),
      [0, 1],
      'записан и отказ, и успешный вход'
    );
    assert.ok(rows.every((r) => r.user_id === ids.tech));
  });

  test('журнал не хранит ничего лишнего', () => {
    const columns = (
      db.prepare('PRAGMA table_info(access_log)').all() as unknown as { name: string }[]
    ).map((c) => c.name);
    assert.deepEqual(columns.sort(), [
      'created_at',
      'id',
      'ip',
      'phone',
      'success',
      'user_agent',
      'user_id'
    ]);
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
