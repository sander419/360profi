// «Нулевой порог»: система должна работать, когда никто ничего не подготовил.
import fs from 'fs';

const edit = (file, pairs) => {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = crlf ? raw.split('\r\n').join('\n') : raw;
  for (const [from, to] of pairs) {
    const parts = s.split(from);
    if (parts.length !== 2) throw new Error(`anchor ${parts.length - 1}x in ${file}: ${from.slice(0, 60)}`);
    s = parts.join(to);
  }
  fs.writeFileSync(file, crlf ? s.split('\n').join('\r\n') : s);
  console.log('patched', file);
};

// 1. Оборудование заводит любой сотрудник: железка появляется в руках у техника,
//    а не в голове у менеджера. Автора пишет журнал.
edit('src/routes/equipment.ts', [
  [
    `  const anyUser = app.guard([]);
  const managers = app.guard(['admin', 'manager']);`,
    `  const anyUser = app.guard([]);`
  ],
  [
    `  app.post(
    '/',
    {
      preHandler: managers,`,
    `  app.post(
    '/',
    {
      preHandler: anyUser,`
  ],
  [
    `  app.patch(
    '/:id',
    {
      preHandler: managers,`,
    `  app.patch(
    '/:id',
    {
      preHandler: anyUser,`
  ]
]);

// 2. Проект — это просто «куда едем». Код придумывать не обязательно.
edit('src/routes/catalog.ts', [
  [
    `      preHandler: managers,
      schema: {
        body: {
          type: 'object',
          required: ['code', 'title'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 40 },`,
    `      preHandler: anyUser,
      schema: {
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 40 },`
  ],
  [
    `      const body = req.body as { code: string; title: string; venue?: string; startsOn?: string };
      if (db.prepare('SELECT 1 FROM projects WHERE code = ?').get(body.code)) {
        throw new DomainError(\`Проект с кодом \${body.code} уже есть\`, 409);
      }
      const id = uid();
      db.prepare(
        'INSERT INTO projects (id, code, title, venue, starts_on, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, body.code, body.title, body.venue ?? '', body.startsOn ?? null, 'active', nowIso());
      return reply.code(201).send({ project: { id, code: body.code, title: body.title } });`,
    `      const body = req.body as { code?: string; title: string; venue?: string; startsOn?: string };
      const code = body.code?.trim() || nextProjectCode(db);
      if (db.prepare('SELECT 1 FROM projects WHERE code = ?').get(code)) {
        throw new DomainError(\`Проект с кодом \${code} уже есть\`, 409);
      }
      const id = uid();
      db.prepare(
        'INSERT INTO projects (id, code, title, venue, starts_on, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, code, body.title, body.venue ?? '', body.startsOn ?? null, 'active', nowIso());
      return reply.code(201).send({ project: { id, code, title: body.title } });`
  ],
  [
    `export const catalogRoutes = async (app: FastifyInstance): Promise<void> => {`,
    `// Код проекта вида P-2609-3: месяц и порядковый номер. Придумывать его руками
// в компании без нумерации проектов — лишний барьер на пути к первой отметке.
const nextProjectCode = (db: FastifyInstance['ctx']['db']): string => {
  const now = new Date();
  const prefix = \`P-\${String(now.getFullYear()).slice(2)}\${String(now.getMonth() + 1).padStart(2, '0')}\`;
  const rows = db
    .prepare(\`SELECT code FROM projects WHERE code LIKE '\${prefix}-%'\`)
    .all() as unknown as { code: string }[];
  const last = rows.reduce((max, row) => {
    const n = Number(row.code.slice(prefix.length + 1));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return \`\${prefix}-\${last + 1}\`;
};

export const catalogRoutes = async (app: FastifyInstance): Promise<void> => {`
  ]
]);

// 3. Выезд собирает тот, кто грузит. Позиция, которой нет в списке, добавляется сканом.
edit('src/routes/kits.ts', [
  [
    `  const anyUser = app.guard([]);
  const managers = app.guard(['admin', 'manager']);`,
    `  const anyUser = app.guard([]);`
  ],
  [
    `  app.post(
    '/',
    {
      preHandler: managers,`,
    `  app.post(
    '/',
    {
      preHandler: anyUser,`
  ],
  [
    `  app.post(
    '/:id/items',
    {
      preHandler: managers,`,
    `  app.post(
    '/:id/items',
    {
      preHandler: anyUser,`
  ],
  [
    `  app.delete('/:id/items/:equipmentId', { preHandler: managers }, async (req) => {`,
    `  app.delete('/:id/items/:equipmentId', { preHandler: anyUser }, async (req) => {`
  ],
  [
    `      const item = db
        .prepare('SELECT checked_out_at FROM kit_items WHERE kit_id = ? AND equipment_id = ?')
        .get(id, body.equipmentId) as unknown as { checked_out_at: string | null } | undefined;
      if (!item) throw new DomainError('Этой позиции нет в комплекте', 404);
      if (item.checked_out_at) throw new DomainError('Позиция уже отмечена как отгруженная', 409);`,
    `      const item = db
        .prepare('SELECT checked_out_at FROM kit_items WHERE kit_id = ? AND equipment_id = ?')
        .get(id, body.equipmentId) as unknown as { checked_out_at: string | null } | undefined;

      // Позиции нет в списке — значит, список составлял не тот, кто грузит.
      // Добавляем на лету: важнее знать, что реально уехало, чем соблюсти план.
      if (!item) {
        getEquipment(db, body.equipmentId);
        db.prepare(
          'INSERT INTO kit_items (kit_id, equipment_id, added_at) VALUES (?, ?, ?)'
        ).run(id, body.equipmentId, occurredAt ?? nowIso());
      } else if (item.checked_out_at) {
        throw new DomainError('Позиция уже отмечена как отгруженная', 409);
      }`
  ]
]);
