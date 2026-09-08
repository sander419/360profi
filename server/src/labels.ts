// Лист QR-наклеек на оборудование: печатается, режется, клеится на кейсы.
//
//   node src/labels.ts                      все единицы
//   node src/labels.ts --category=LED       только категория
//   node src/labels.ts --new                только те, у кого ещё не печатали (по дате заведения)
//   node src/labels.ts --blank=24           пачка пустых наклеек: клеим на железку,
//                                           сканируем и заводим прямо на складе
//
// Размер ячейки — 70×37 мм, это стандартный лист самоклейки 3×8 (Avery L7160).
// QR ведёт на карточку в полевом режиме: PUBLIC_APP_URL + #/eq/<код>.

import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { openDb, SERVER_ROOT } from './db.ts';

const APP_URL = (process.env.PUBLIC_APP_URL ?? 'https://sander419.github.io/360profi/').replace(
  /\/+$/,
  '/'
);

const args = process.argv.slice(2);
const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
const onlyNew = args.includes('--new');
const blankCount = Number(args.find((a) => a.startsWith('--blank='))?.split('=')[1] ?? 0);

const db = openDb();

// Пустые наклейки: код есть, а оборудования за ним ещё нет. Клеятся на железку,
// сканируются, и приложение предлагает завести единицу прямо на месте. Так реестр
// набирается по ходу дела, а не вечерами в таблице.
const blankCodes = (count: number): { code: string; name: string; category: string }[] => {
  const taken = new Set(
    (db.prepare('SELECT code FROM equipment').all() as unknown as { code: string }[]).map(
      (r) => r.code
    )
  );
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих 0/O и 1/I
  const codes: { code: string; name: string; category: string }[] = [];
  while (codes.length < count) {
    let suffix = '';
    for (let i = 0; i < 5; i += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const code = `EQ-${suffix}`;
    if (taken.has(code)) continue;
    taken.add(code);
    codes.push({ code, name: 'Свободная наклейка — отсканируйте и заведите', category: '' });
  }
  return codes;
};

const where: string[] = [];
const params: string[] = [];
if (categoryArg) {
  where.push('category = ?');
  params.push(categoryArg);
}
if (onlyNew) {
  where.push("created_at > datetime('now', '-30 days')");
}

const items =
  blankCount > 0
    ? blankCodes(blankCount)
    : (db
        .prepare(
          `SELECT code, name, category FROM equipment
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY category, code`
        )
        .all(...params) as unknown as { code: string; name: string; category: string }[]);

if (items.length === 0) {
  console.log('Под фильтр ничего не попало — наклейки не нужны.');
  process.exit(0);
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const cells = await Promise.all(
  items.map(async (item) => {
    const url = `${APP_URL}#/eq/${encodeURIComponent(item.code)}`;
    const qr = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    return `
      <div class="label">
        <div class="qr">${qr}</div>
        <div class="text">
          <p class="code">${escapeHtml(item.code)}</p>
          <p class="name">${escapeHtml(item.name)}</p>
          <p class="hint">наведите камеру · 360PROFI</p>
        </div>
      </div>`;
  })
);

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>360PROFI · QR-наклейки (${items.length})</title>
<style>
  @page { size: A4; margin: 8mm 5mm; }
  :root { color-scheme: light; }
  body { margin: 0; font: 12px/1.3 "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
  .sheet { display: grid; grid-template-columns: repeat(3, 70mm); grid-auto-rows: 37mm; gap: 0; }
  .label { display: flex; align-items: center; gap: 3mm; padding: 3mm; box-sizing: border-box; page-break-inside: avoid; border: 1px dashed #e4e4e7; }
  .qr svg { width: 26mm; height: 26mm; display: block; }
  .text { min-width: 0; }
  .code { margin: 0; font: 700 15px Consolas, monospace; letter-spacing: .04em; }
  .name { margin: 1mm 0 0; font-size: 10px; line-height: 1.25; max-height: 12mm; overflow: hidden; }
  .hint { margin: 1mm 0 0; font-size: 8px; color: #71717a; }
  @media print { .label { border-color: transparent; } .note { display: none; } }
  .note { padding: 6mm 5mm; font-size: 12px; color: #52525b; }
</style>
</head>
<body>
<p class="note">Наклеек: ${items.length}. Печать 1:1, без «вписать в страницу». Лист 3×8, ячейка 70×37 мм.</p>
<div class="sheet">
${cells.join('\n')}
</div>
</body>
</html>
`;

const outDir = path.join(SERVER_ROOT, 'out');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(
  outDir,
  blankCount > 0 ? 'labels-blank.html' : categoryArg ? `labels-${categoryArg}.html` : 'labels.html'
);
fs.writeFileSync(outFile, html, 'utf8');

console.log(`Наклеек: ${items.length}`);
console.log(`Файл: ${outFile}`);
console.log(`QR ведут на ${APP_URL}#/eq/<код>`);
console.log('Перед печатью проверьте, что PUBLIC_APP_URL — это адрес, который открывается с телефона.');
