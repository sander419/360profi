// Наполнение базы демо-данными, теми же, что во фронтовом прототипе.
// PIN-коды генерируются случайно и печатаются один раз: в базе только хеши.
//
//   node src/seed.ts          — наполнить пустую базу
//   node src/seed.ts --force  — стереть данные и налить заново

import { openDb, uid, nowIso, todayIso } from './db.ts';
import { hashPin, randomPin } from './auth.ts';
import type { Role } from './auth.ts';

const shiftDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const USERS: { key: string; name: string; role: Role }[] = [
  { key: 'u0', name: 'Александр Соколов', role: 'admin' },
  { key: 'u1', name: 'Сергей Панов', role: 'tech' },
  { key: 'u2', name: 'Илья Морозов', role: 'tech' },
  { key: 'u3', name: 'Денис Крот', role: 'tech' },
  { key: 'u4', name: 'Анна Левина', role: 'manager' },
  { key: 'u5', name: 'Марат Гизатуллин', role: 'tech' },
  { key: 'u8', name: 'Павел Раскин', role: 'tech' },
  { key: 'u9', name: 'Игорь Белов', role: 'manager' }
];

const PROJECTS = [
  { code: 'P-241', title: 'Форум «Технологии будущего»', venue: 'ТК Сколково', startsOn: shiftDays(3) },
  { code: 'P-242', title: 'Юбилей компании «Альфа Энерго»', venue: 'Лофт «Фабрика»', startsOn: shiftDays(6) },
  { code: 'P-243', title: 'Фестиваль «Город Звука» (open-air)', venue: 'Парк Горького', startsOn: shiftDays(12) },
  { code: 'P-244', title: 'Презентация X-Drive', venue: 'Дилерский центр', startsOn: shiftDays(17) }
];

const EQUIPMENT = [
  { code: 'LED-0001', name: 'LED-кабинеты P3.9 (компл. 40 шт, #101–#140)', category: 'LED', status: 'project', project: 'P-241', check: -2, resp: 'u1', note: '' },
  { code: 'LED-0002', name: 'LED-кабинеты P4.8 outdoor (компл. 60 шт)', category: 'LED', status: 'stock', project: null, check: -9, resp: 'u2', note: '' },
  { code: 'LED-0104', name: 'LED-кабинет #104', category: 'LED', status: 'repair', project: null, check: -21, resp: 'u1', note: 'блок питания, ждём запчасть' },
  { code: 'LED-0003', name: 'Процессор Novastar H2', category: 'LED', status: 'project', project: 'P-241', check: -2, resp: 'u1', note: '' },
  { code: 'LGT-0001', name: 'Пульт grandMA2 light', category: 'Свет', status: 'stock', project: null, check: -40, resp: 'u5', note: 'просрочена плановая проверка' },
  { code: 'LGT-0002', name: 'Moving head Beam 230 (12 шт)', category: 'Свет', status: 'project', project: 'P-242', check: -4, resp: 'u5', note: '' },
  { code: 'CAM-0001', name: 'Камеры Sony PXW-Z280 (#1, #2)', category: 'Камеры', status: 'stock', project: null, check: -6, resp: 'u3', note: '' },
  { code: 'BRD-0001', name: 'Передатчик LiveU LU800', category: 'Трансляции', status: 'project', project: 'P-241', check: -3, resp: 'u3', note: '' },
  { code: 'BRD-0002', name: 'Микшер ATEM Constellation 8K', category: 'Трансляции', status: 'reserved', project: 'P-242', check: -12, resp: 'u3', note: '' },
  { code: 'SND-0001', name: 'Line array L-Acoustics Kiva (аренда партнёра)', category: 'Звук', status: 'reserved', project: 'P-243', check: -30, resp: 'u9', note: '' },
  { code: 'PWR-0001', name: 'Генератор 30 кВт', category: 'Питание', status: 'stock', project: null, check: -45, resp: 'u8', note: 'требуется ТО' },
  { code: 'RIG-0001', name: 'Фермы 3 м (24 секции)', category: 'Риггинг', status: 'stock', project: null, check: -15, resp: 'u8', note: '' }
];

const DEFECTS = [
  { code: 'LED-0104', severity: 'blocker' as const, description: 'Не запускается блок питания, ждём запчасть', status: 'in_repair' },
  { code: 'LED-0001', severity: 'low' as const, description: 'Кабинет #117: люфт замка', status: 'open' },
  { code: 'BRD-0001', severity: 'high' as const, description: 'Перегрев при длительной трансляции', status: 'open' },
  { code: 'PWR-0001', severity: 'low' as const, description: 'Просрочено ТО по моточасам', status: 'open' }
];

const force = process.argv.includes('--force');
const db = openDb();

const existing = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
if (existing > 0 && !force) {
  console.log(`В базе уже ${existing} сотрудников. Перезалить: node src/seed.ts --force`);
  process.exit(0);
}

if (force) {
  for (const table of ['kit_items', 'kits', 'defects', 'equipment_events', 'equipment', 'projects', 'users']) {
    db.exec(`DELETE FROM ${table}`);
  }
}

const ts = nowIso();
const userIds = new Map<string, string>();
const pins: { name: string; phone: string; role: Role; pin: string }[] = [];

USERS.forEach((u, index) => {
  const id = uid();
  const phone = `+7900000${String(index).padStart(4, '0')}`;
  const pin = randomPin();
  db.prepare(
    'INSERT INTO users (id, name, phone, role, pin_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(id, u.name, phone, u.role, hashPin(pin), ts);
  userIds.set(u.key, id);
  pins.push({ name: u.name, phone, role: u.role, pin });
});

const projectIds = new Map<string, string>();
for (const p of PROJECTS) {
  const id = uid();
  db.prepare(
    'INSERT INTO projects (id, code, title, venue, starts_on, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, p.code, p.title, p.venue, p.startsOn, 'active', ts);
  projectIds.set(p.code, id);
}

const equipmentIds = new Map<string, string>();
for (const e of EQUIPMENT) {
  const id = uid();
  db.prepare(
    `INSERT INTO equipment
       (id, code, name, category, serial, status, project_id, responsible_id, last_check_on, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    e.code,
    e.name,
    e.category,
    e.status,
    e.project ? projectIds.get(e.project)! : null,
    userIds.get(e.resp) ?? null,
    shiftDays(e.check),
    e.note,
    ts,
    ts
  );
  equipmentIds.set(e.code, id);

  db.prepare(
    `INSERT INTO equipment_events (id, equipment_id, kind, to_status, project_id, user_id, note, created_at)
     VALUES (?, ?, 'created', ?, ?, ?, 'Заведено при первичной описи', ?)`
  ).run(uid(), id, e.status, e.project ? projectIds.get(e.project)! : null, userIds.get('u0')!, ts);
}

for (const d of DEFECTS) {
  db.prepare(
    `INSERT INTO defects (id, equipment_id, severity, description, status, reported_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uid(), equipmentIds.get(d.code)!, d.severity, d.description, d.status, userIds.get('u1')!, ts);
}

// Комплект на ближайший выезд: часть позиций уже отмечена при погрузке.
const kitId = uid();
db.prepare('INSERT INTO kits (id, project_id, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)').run(
  kitId,
  projectIds.get('P-241')!,
  'Выезд P-241 · основной комплект',
  userIds.get('u4')!,
  ts
);

const kitCodes = ['LED-0001', 'LED-0003', 'BRD-0001', 'CAM-0001', 'RIG-0001'];
for (const code of kitCodes) {
  const loaded = ['LED-0001', 'LED-0003', 'BRD-0001'].includes(code);
  db.prepare(
    `INSERT INTO kit_items (kit_id, equipment_id, added_at, checked_out_at, checked_out_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(kitId, equipmentIds.get(code)!, ts, loaded ? ts : null, loaded ? userIds.get('u1')! : null);
}

console.log('Готово. Сотрудники и PIN-коды (показываются один раз):\n');
console.log('телефон          роль      PIN     имя');
for (const p of pins) {
  console.log(`${p.phone}  ${p.role.padEnd(8)}  ${p.pin}  ${p.name}`);
}
console.log(`\nОборудование: ${EQUIPMENT.length}, проекты: ${PROJECTS.length}, дефекты: ${DEFECTS.length}, комплект: 1 (${kitCodes.length} позиций), дата проверки на ${todayIso()}`);
