-- Журнал входов.
--
-- Нужен по двум причинам. Первая: при разборе инцидента надо понимать, кто и
-- откуда заходил под учёткой. Вторая: закон о персональных данных требует от
-- оператора учёта доступа к ним, и «мы не знаем, кто заходил» — плохой ответ.
--
-- Пишем минимум: кто, когда, чем и результат. Ни геолокации, ни содержимого.
CREATE TABLE access_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users (id) ON DELETE SET NULL,
  -- Телефон из формы: по неудачным попыткам видно подбор PIN даже без учётки.
  phone       TEXT NOT NULL DEFAULT '',
  success     INTEGER NOT NULL,
  ip          TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_access_log_created ON access_log (created_at DESC);
CREATE INDEX idx_access_log_user ON access_log (user_id, created_at DESC);
