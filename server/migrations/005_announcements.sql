-- Объявления руководства.
--
-- Смысл не в том, чтобы «отправить сообщение» — для этого есть чат. Смысл в том,
-- чтобы видеть, кто его прочитал. Команда, доставку которой нельзя проверить,
-- ничем не отличается от сообщения в общий чат, которое пролистали.
CREATE TABLE announcements (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  -- info: к сведению; task: надо сделать; urgent: касается сегодняшней работы.
  kind        TEXT NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'task', 'urgent')),
  -- Кому показывать: всем, только техникам или только менеджерам.
  audience    TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'tech', 'manager')),
  created_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  -- После этой даты объявление уходит с рабочего экрана само. Объявления,
  -- которые никто не снимает, превращают экран в свалку и перестают читаться.
  expires_at  TEXT,
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_announcements_active ON announcements (active, created_at DESC);

CREATE TABLE announcement_reads (
  announcement_id TEXT NOT NULL REFERENCES announcements (id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  read_at         TEXT NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);
