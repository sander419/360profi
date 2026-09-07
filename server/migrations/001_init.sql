-- Схема модуля оборудования.
-- Правило: миграции только добавляются новыми файлами, старые не редактируются.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'tech')),
  pin_hash    TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  venue       TEXT NOT NULL DEFAULT '',
  starts_on   TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'cancelled')),
  created_at  TEXT NOT NULL
);

CREATE TABLE equipment (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  serial          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'stock'
                    CHECK (status IN ('stock', 'project', 'repair', 'reserved', 'transit')),
  project_id      TEXT REFERENCES projects (id) ON DELETE SET NULL,
  responsible_id  TEXT REFERENCES users (id) ON DELETE SET NULL,
  last_check_on   TEXT,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX idx_equipment_status ON equipment (status);
CREATE INDEX idx_equipment_project ON equipment (project_id);
CREATE INDEX idx_equipment_category ON equipment (category);

-- Журнал: кто, когда и что сделал с единицей. Строки не редактируются и не удаляются.
CREATE TABLE equipment_events (
  id            TEXT PRIMARY KEY,
  equipment_id  TEXT NOT NULL REFERENCES equipment (id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN (
                  'created', 'updated', 'status', 'check', 'defect', 'kit_out', 'kit_in', 'note'
                )),
  from_status   TEXT,
  to_status     TEXT,
  project_id    TEXT REFERENCES projects (id) ON DELETE SET NULL,
  user_id       TEXT REFERENCES users (id) ON DELETE SET NULL,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_events_equipment ON equipment_events (equipment_id, created_at DESC);

CREATE TABLE defects (
  id            TEXT PRIMARY KEY,
  equipment_id  TEXT NOT NULL REFERENCES equipment (id) ON DELETE CASCADE,
  severity      TEXT NOT NULL CHECK (severity IN ('low', 'high', 'blocker')),
  description   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_repair', 'closed')),
  reported_by   TEXT REFERENCES users (id) ON DELETE SET NULL,
  closed_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  closed_at     TEXT
);

CREATE INDEX idx_defects_equipment ON defects (equipment_id, status);

-- Комплект на выезд: что берём на проект.
CREATE TABLE kits (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_kits_project ON kits (project_id);

-- Позиция комплекта. checked_out — предвыездная проверка, checked_in — возврат.
CREATE TABLE kit_items (
  kit_id          TEXT NOT NULL REFERENCES kits (id) ON DELETE CASCADE,
  equipment_id    TEXT NOT NULL REFERENCES equipment (id) ON DELETE CASCADE,
  added_at        TEXT NOT NULL,
  checked_out_at  TEXT,
  checked_out_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  checked_in_at   TEXT,
  checked_in_by   TEXT REFERENCES users (id) ON DELETE SET NULL,
  return_state    TEXT CHECK (return_state IN ('ok', 'damaged', 'missing')),
  note            TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (kit_id, equipment_id)
);
