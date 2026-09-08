-- Статус «не вернулось».
--
-- До этой миграции пропавшая на выезде единица оставалась в статусе «на проекте»
-- навсегда: проект давно закрыт, а железка по документам всё ещё там. Найти её
-- в списке невозможно, посчитать потери — тоже.
--
-- Поменять CHECK в SQLite можно только перестройкой таблицы, поэтому копия,
-- перенос данных и переименование. Внешние ключи на время миграций выключены
-- в openDb, целостность проверяется после.

CREATE TABLE equipment_rebuilt (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  serial          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'stock'
                    CHECK (status IN ('stock', 'project', 'repair', 'reserved', 'transit', 'lost')),
  project_id      TEXT REFERENCES projects (id) ON DELETE SET NULL,
  responsible_id  TEXT REFERENCES users (id) ON DELETE SET NULL,
  last_check_on   TEXT,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

INSERT INTO equipment_rebuilt
  (id, code, name, category, serial, status, project_id, responsible_id, last_check_on, note, created_at, updated_at)
SELECT
  id, code, name, category, serial, status, project_id, responsible_id, last_check_on, note, created_at, updated_at
FROM equipment;

DROP TABLE equipment;
ALTER TABLE equipment_rebuilt RENAME TO equipment;

CREATE INDEX idx_equipment_status ON equipment (status);
CREATE INDEX idx_equipment_project ON equipment (project_id);
CREATE INDEX idx_equipment_category ON equipment (category);
