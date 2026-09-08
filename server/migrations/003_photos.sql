-- Фотографии к дефектам и оборудованию.
--
-- Файлы лежат на диске рядом с базой (data/photos), в базе — только метаданные.
-- Раздувать SQLite мегабайтами картинок незачем: бэкап базы должен оставаться быстрым.
CREATE TABLE photos (
  id            TEXT PRIMARY KEY,
  equipment_id  TEXT NOT NULL REFERENCES equipment (id) ON DELETE CASCADE,
  defect_id     TEXT REFERENCES defects (id) ON DELETE SET NULL,
  user_id       TEXT REFERENCES users (id) ON DELETE SET NULL,
  mime          TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  -- Картинку нельзя запросить с заголовком авторизации из тега <img>, поэтому
  -- доступ даёт неугадываемый токен в ссылке. Ссылки живут только внутри приложения.
  token         TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  occurred_at   TEXT
);

CREATE INDEX idx_photos_equipment ON photos (equipment_id, created_at DESC);
CREATE INDEX idx_photos_defect ON photos (defect_id);
