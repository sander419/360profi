-- Поддержка работы без связи.
--
-- operations: журнал выполненных клиентских операций по ключу идемпотентности.
-- Телефон на площадке отправляет отметку с ключом; если ответ не дошёл и клиент
-- повторит запрос, сервер вернёт сохранённый ответ, а не применит действие дважды.
CREATE TABLE operations (
  key         TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users (id) ON DELETE SET NULL,
  method      TEXT NOT NULL,
  path        TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_operations_created ON operations (created_at);

-- Когда действие произошло на площадке. created_at остаётся временем записи
-- на сервере: разрыв между ними и есть время, которое телефон провёл без связи.
ALTER TABLE equipment_events ADD COLUMN occurred_at TEXT;
