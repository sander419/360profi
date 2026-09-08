// Работа с персональными данными сотрудника: выдать и удалить.
//
// Закон обязывает оператора по требованию человека показать, какие его данные
// обрабатываются, и удалить их, когда основание для обработки закончилось.
// Делать это руками через SQL в проде — путь к ошибке, поэтому здесь две команды.
//
//   node src/privacy.ts export +79001234567     что хранится об этом человеке
//   node src/privacy.ts forget +79001234567     обезличить: имя и телефон стереть
//
// Обезличивание, а не удаление строки: журнал по оборудованию не должен
// рассыпаться. Записи остаются, но вместо имени в них «Сотрудник N» —
// историю выездов и поломок это сохраняет, личность больше не раскрывает.

import fs from 'node:fs';
import path from 'node:path';
import { openDb, nowIso, SERVER_ROOT } from './db.ts';

interface UserRow {
  id: string;
  name: string;
  phone: string;
  role: string;
  active: number;
  created_at: string;
}

const [command, phoneArg] = process.argv.slice(2);

if (!command || !phoneArg || !['export', 'forget'].includes(command)) {
  console.error(
    'Использование:\n' +
      '  node src/privacy.ts export <телефон>   выгрузить данные сотрудника\n' +
      '  node src/privacy.ts forget <телефон>   обезличить сотрудника'
  );
  process.exit(1);
}

const db = openDb();

const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phoneArg) as unknown as
  | UserRow
  | undefined;

if (!user) {
  console.error(`Сотрудник с телефоном ${phoneArg} не найден`);
  process.exit(1);
}

const count = (sql: string): number =>
  Number((db.prepare(sql).get(user.id) as unknown as { c: number }).c);

if (command === 'export') {
  const data = {
    выгружено: nowIso(),
    сотрудник: {
      имя: user.name,
      телефон: user.phone,
      роль: user.role,
      активен: Boolean(user.active),
      заведён: user.created_at
    },
    действия_с_оборудованием: db
      .prepare(
        `SELECT e.kind, e.from_status, e.to_status, e.note, e.created_at, e.occurred_at,
                q.code AS equipment_code
           FROM equipment_events e
           LEFT JOIN equipment q ON q.id = e.equipment_id
          WHERE e.user_id = ?
          ORDER BY e.created_at`
      )
      .all(user.id),
    заведённые_дефекты: db
      .prepare('SELECT severity, description, status, created_at FROM defects WHERE reported_by = ?')
      .all(user.id),
    входы_в_систему: db
      .prepare(
        'SELECT success, ip, user_agent, created_at FROM access_log WHERE user_id = ? ORDER BY created_at'
      )
      .all(user.id),
    снимки: count('SELECT COUNT(*) AS c FROM photos WHERE user_id = ?')
  };

  const outDir = path.join(SERVER_ROOT, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `персональные-данные-${user.phone.replace(/\D/g, '')}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

  console.log(`Данные сотрудника «${user.name}» выгружены: ${file}`);
  console.log(
    `Действий с оборудованием: ${(data.действия_с_оборудованием as unknown[]).length}, ` +
      `дефектов: ${(data.заведённые_дефекты as unknown[]).length}, ` +
      `входов: ${(data.входы_в_систему as unknown[]).length}, снимков: ${data.снимки}`
  );
  process.exit(0);
}

// forget
const events = count('SELECT COUNT(*) AS c FROM equipment_events WHERE user_id = ?');
const shortId = user.id.slice(0, 4).toUpperCase();
const placeholder = `Сотрудник ${shortId}`;

db.exec('BEGIN');
try {
  // Телефон обнуляем на уникальное служебное значение: колонка требует
  // уникальности, а пустая строка помешает обезличить второго человека.
  db.prepare(
    `UPDATE users SET name = ?, phone = ?, pin_hash = 'удалён', active = 0 WHERE id = ?`
  ).run(placeholder, `удалён-${shortId}`, user.id);

  // Журнал входов содержит телефон и устройство — это уже персональные данные,
  // и после обезличивания им незачем оставаться.
  db.prepare('DELETE FROM access_log WHERE user_id = ?').run(user.id);

  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

console.log(`Сотрудник «${user.name}» обезличен: теперь «${placeholder}».`);
console.log(`Записей в журнале оборудования сохранено: ${events} — история выездов не пострадала.`);
console.log('Войти под этой учёткой больше нельзя.');
