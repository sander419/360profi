// Массовое заведение сотрудников из списка + печатные памятки с PIN.
//
//   node src/import-users.ts --sample            создать шаблон people.csv
//   node src/import-users.ts people.csv          завести всех из файла
//   node src/import-users.ts people.csv --reset   ещё и перевыпустить PIN существующим
//
// CSV: имя;телефон;роль   (роль: tech | manager | admin), разделитель ; или ,
// На выходе: out/pins.csv для руководителя и out/handouts.html — памятки,
// которые печатаются и раздаются по одной на человека.

import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { openDb, uid, nowIso, SERVER_ROOT } from './db.ts';
import { hashPin, randomPin } from './auth.ts';
import type { Role } from './auth.ts';

const ROLES: Role[] = ['tech', 'manager', 'admin'];
const ROLE_RU: Record<Role, string> = {
  tech: 'техник',
  manager: 'менеджер',
  admin: 'администратор'
};

const APP_URL = (process.env.PUBLIC_APP_URL ?? 'https://sander419.github.io/360profi/').replace(
  /\/+$/,
  '/'
);

const OUT_DIR = path.join(SERVER_ROOT, 'out');

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const sampleCsv = `имя;телефон;роль
Сергей Панов;+79000000001;tech
Анна Левина;+79000000004;manager
Александр Соколов;+79000000000;admin
`;

const args = process.argv.slice(2);

if (args.includes('--sample')) {
  const file = path.join(SERVER_ROOT, 'people.csv');
  fs.writeFileSync(file, sampleCsv, 'utf8');
  console.log(`Шаблон записан: ${file}\nЗаполните и запустите: node src/import-users.ts people.csv`);
  process.exit(0);
}

const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Укажите файл: node src/import-users.ts people.csv (или --sample для шаблона)');
  process.exit(1);
}

const resetExisting = args.includes('--reset');

const rows = fs
  .readFileSync(path.resolve(file), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/[;,]/).map((cell) => cell.trim()))
  .filter((cells, index) => !(index === 0 && /имя|name/i.test(cells[0] ?? '')));

const db = openDb();

interface Issued {
  name: string;
  phone: string;
  role: Role;
  pin: string;
  status: 'создан' | 'PIN перевыпущен';
}

const issued: Issued[] = [];
const skipped: string[] = [];
const problems: string[] = [];

for (const [name, phone, roleRaw] of rows) {
  if (!name || !phone) {
    problems.push(`Пропущена строка без имени или телефона: ${[name, phone].join(';')}`);
    continue;
  }
  const role = (roleRaw || 'tech') as Role;
  if (!ROLES.includes(role)) {
    problems.push(`${name}: неизвестная роль «${roleRaw}», допустимо ${ROLES.join(', ')}`);
    continue;
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) as
    | { id: string }
    | undefined;

  const pin = randomPin();

  if (existing) {
    if (!resetExisting) {
      skipped.push(`${name} (${phone}) — уже заведён`);
      continue;
    }
    db.prepare('UPDATE users SET name = ?, role = ?, pin_hash = ?, active = 1 WHERE id = ?').run(
      name,
      role,
      hashPin(pin),
      existing.id
    );
    issued.push({ name, phone, role, pin, status: 'PIN перевыпущен' });
  } else {
    db.prepare(
      'INSERT INTO users (id, name, phone, role, pin_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(uid(), name, phone, role, hashPin(pin), nowIso());
    issued.push({ name, phone, role, pin, status: 'создан' });
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const pinsCsv = ['имя;телефон;роль;PIN;статус']
  .concat(issued.map((i) => [i.name, i.phone, ROLE_RU[i.role], i.pin, i.status].join(';')))
  .join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'pins.csv'), `${pinsCsv}\n`, 'utf8');

const instructionsFor = (role: Role): string[] => {
  if (role === 'tech') {
    return [
      'Откройте ссылку и войдите: телефон и PIN ниже.',
      'На складе наведите камеру на QR-наклейку — откроется карточка.',
      'Осмотрели — нажмите «Проверено». Нашли поломку — «Есть дефект» и коротко опишите.',
      'На выезде: откройте комплект, отмечайте «Погрузили» по каждой позиции.',
      'После мероприятия примите каждую позицию: целое / повреждено / не вернулось.'
    ];
  }
  if (role === 'manager') {
    return [
      'Откройте ссылку и войдите: телефон и PIN ниже.',
      'Заводите проекты и собирайте комплект на выезд из позиций склада.',
      'Перед выездом смотрите готовность комплекта в процентах — что уже погружено.',
      'После возврата проверьте список дефектов: всё, что отметили техники, там.',
      'Оборудование в ремонте система на выезд не отдаст — это защита, а не ошибка.'
    ];
  }
  return [
    'Откройте ссылку и войдите: телефон и PIN ниже.',
    'Заводите сотрудников и выдавайте им PIN, увольнение — деактивация учётки.',
    'PIN можно перевыпустить в любой момент, старый сразу перестаёт работать.',
    'Журнал по каждой единице не редактируется — это основа разбора инцидентов.'
  ];
};

const cards = await Promise.all(
  issued.map(async (person) => {
    const qr = await QRCode.toString(APP_URL + '#/field', { type: 'svg', margin: 0, width: 120 });
    const steps = instructionsFor(person.role)
      .map((step) => `<li>${escapeHtml(step)}</li>`)
      .join('');
    return `
      <article class="card">
        <header>
          <div>
            <p class="kicker">360PROFI · склад</p>
            <h2>${escapeHtml(person.name)}</h2>
            <p class="role">${ROLE_RU[person.role]}</p>
          </div>
          <div class="qr">${qr}<span>${escapeHtml(APP_URL)}#/field</span></div>
        </header>
        <div class="creds">
          <div><span>Телефон</span><b>${escapeHtml(person.phone)}</b></div>
          <div><span>PIN</span><b class="pin">${person.pin}</b></div>
        </div>
        <ol>${steps}</ol>
        <footer>Не передавайте PIN другим. Потеряли — попросите перевыпустить.</footer>
      </article>`;
  })
);

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>360PROFI · памятки сотрудникам</title>
<style>
  @page { size: A4; margin: 12mm; }
  :root { color-scheme: light; }
  body { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #111; background: #fff; margin: 0; }
  .card { background: #fff; border: 1px solid #d4d4d8; border-radius: 10px; padding: 14px 16px; margin-bottom: 10mm; page-break-inside: avoid; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .kicker { margin: 0; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #6366f1; font-weight: 700; }
  h2 { margin: 2px 0 0; font-size: 20px; }
  .role { margin: 0; color: #52525b; font-size: 13px; }
  .qr { text-align: center; font-size: 9px; color: #52525b; }
  .qr svg { width: 96px; height: 96px; display: block; }
  .creds { display: flex; gap: 24px; margin: 12px 0; padding: 10px 12px; background: #f4f4f5; border-radius: 8px; }
  .creds span { display: block; font-size: 11px; color: #52525b; }
  .creds b { font-size: 17px; font-family: Consolas, monospace; }
  .pin { letter-spacing: .12em; }
  ol { margin: 0; padding-left: 20px; }
  li { margin-bottom: 3px; }
  footer { margin-top: 10px; font-size: 11px; color: #71717a; }
</style>
</head>
<body>
${cards.join('\n')}
</body>
</html>
`;

fs.writeFileSync(path.join(OUT_DIR, 'handouts.html'), html, 'utf8');

console.log(`Заведено/обновлено: ${issued.length}`);
for (const s of skipped) console.log(`  пропущен: ${s}`);
for (const p of problems) console.log(`  ошибка: ${p}`);
console.log(`\nout/pins.csv — список для руководителя`);
console.log(`out/handouts.html — печатать и раздавать (по карточке на человека)`);
if (skipped.length > 0) {
  console.log('\nЧтобы перевыпустить PIN уже заведённым, добавьте --reset');
}
