// Полевой режим: то, что сотрудник открывает на телефоне.
// Отдельно от «штаба» — на площадке нужны крупные кнопки и три действия,
// а не дашборд. Маршруты в хеше, чтобы работало на любой статике без переписывания URL.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  api,
  apiConfigured,
  clearSession,
  getStoredUser,
  getToken
} from '../api/client.ts';
import type { Equipment, HistoryEvent, Kit, SessionUser } from '../api/client.ts';

const STATUS_LABEL: Record<string, string> = {
  stock: 'На складе',
  project: 'На проекте',
  repair: 'В ремонте',
  reserved: 'В резерве',
  transit: 'В пути'
};

const STATUS_TONE: Record<string, string> = {
  stock: 'var(--ok)',
  project: 'var(--acc)',
  repair: 'var(--bad)',
  reserved: 'var(--vio)',
  transit: 'var(--warn)'
};

const EVENT_LABEL: Record<string, string> = {
  created: 'заведено',
  updated: 'изменено',
  status: 'смена статуса',
  check: 'проверка',
  defect: 'дефект',
  kit_out: 'погрузка',
  kit_in: 'возврат',
  note: 'заметка'
};

const fmtDate = (iso: string | null): string => {
  if (!iso) return 'не отмечалась';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

const daysSince = (iso: string | null): number | null => {
  if (!iso) return null;
  const then = new Date(`${iso}T00:00:00`).getTime();
  return Math.round((Date.now() - then) / 86400000);
};

type Route =
  | { name: 'home' }
  | { name: 'equipment'; code: string }
  | { name: 'kit'; id: string }
  | { name: 'stock' };

const parseHash = (): Route => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [section, value] = hash.split('/');
  if (section === 'eq' && value) return { name: 'equipment', code: decodeURIComponent(value) };
  if (section === 'kit' && value) return { name: 'kit', id: value };
  if (section === 'stock') return { name: 'stock' };
  return { name: 'home' };
};

const go = (path: string): void => {
  window.location.hash = path;
};

const Button: React.FC<{
  onClick?: () => void;
  tone?: 'accent' | 'plain' | 'danger' | 'ok';
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, tone = 'plain', disabled, children }) => {
  const tones: Record<string, string> = {
    accent: 'bg-[var(--acc)] text-white',
    ok: 'bg-[var(--ok-dim)] text-[var(--ok)] border border-[var(--ok)]',
    danger: 'bg-[var(--bad-dim)] text-[var(--bad)] border border-[var(--bad)]',
    plain: 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[52px] w-full rounded-2xl px-4 text-base font-semibold transition active:scale-[0.99] disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

const Notice: React.FC<{ text: string; tone: 'error' | 'ok' }> = ({ text, tone }) => (
  <div
    role="status"
    className="rounded-2xl px-4 py-3 text-sm"
    style={{
      background: tone === 'error' ? 'var(--bad-dim)' : 'var(--ok-dim)',
      color: tone === 'error' ? 'var(--bad)' : 'var(--ok)'
    }}
  >
    {text}
  </div>
);

const Shell: React.FC<{
  user: SessionUser | null;
  onLogout: () => void;
  children: React.ReactNode;
}> = ({ user, onLogout, children }) => (
  <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
      <button
        type="button"
        onClick={() => go('/')}
        className="flex items-center gap-2 text-left"
        aria-label="На главную"
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--acc)] text-sm font-bold text-white">
          360
        </span>
        <span className="text-sm font-semibold leading-tight">
          Склад
          <span className="block text-xs font-normal text-[var(--muted2)]">полевой режим</span>
        </span>
      </button>
      {user && (
        <button
          type="button"
          onClick={onLogout}
          className="ml-auto text-right text-xs text-[var(--muted)]"
        >
          {user.name}
          <span className="block text-[var(--muted2)]">выйти</span>
        </button>
      )}
    </header>
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5 pb-16">{children}</main>
  </div>
);

const LoginScreen: React.FC<{ onDone: (user: SessionUser) => void }> = ({ onDone }) => {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await api.login(phone.trim(), pin.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Вход</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Телефон и PIN выдаёт руководитель. PIN — шесть цифр.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Телефон
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="username"
          placeholder="+79000000000"
          className="min-h-[52px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--text)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        PIN
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          type="password"
          autoComplete="current-password"
          placeholder="••••••"
          className="min-h-[52px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base tracking-[0.3em] text-[var(--text)]"
        />
      </label>
      {error && <Notice text={error} tone="error" />}
      <button
        type="submit"
        disabled={busy || !phone || !pin}
        className="min-h-[52px] rounded-2xl bg-[var(--acc)] text-base font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Проверяем…' : 'Войти'}
      </button>
    </form>
  );
};

const HomeScreen: React.FC = () => {
  const [code, setCode] = useState('');
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .kits()
      .then(setKits)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить'));
  }, []);

  return (
    <>
      <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h1 className="text-lg font-bold">Найти оборудование</h1>
        <p className="text-sm text-[var(--muted)]">
          Наведите камеру на QR-наклейку или введите код с неё, например LED-0104.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) go(`/eq/${encodeURIComponent(code.trim().toUpperCase())}`);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Код с наклейки"
            autoCapitalize="characters"
            className="min-h-[52px] flex-1 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 font-mono text-base uppercase text-[var(--text)]"
          />
          <button
            type="submit"
            className="min-h-[52px] rounded-2xl bg-[var(--acc)] px-5 font-semibold text-white"
          >
            Открыть
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted2)]">
          Выезды
        </h2>
        {error && <Notice text={error} tone="error" />}
        {kits === null && !error && <p className="px-1 text-sm text-[var(--muted)]">Загружаем…</p>}
        {kits?.length === 0 && (
          <p className="px-1 text-sm text-[var(--muted)]">Активных комплектов нет.</p>
        )}
        {kits?.map((kit) => (
          <button
            key={kit.id}
            type="button"
            onClick={() => go(`/kit/${kit.id}`)}
            className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{kit.name}</span>
              <span className="font-mono text-sm text-[var(--muted)]">{kit.projectCode}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-[var(--acc)]"
                style={{ width: `${kit.progress.readiness}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Погружено {kit.progress.loaded} из {kit.progress.total} · принято{' '}
              {kit.progress.returned}
            </p>
          </button>
        ))}
      </section>

      <Button onClick={() => go('/stock')}>Весь склад</Button>
    </>
  );
};

const StockScreen: React.FC = () => {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .equipmentList()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить'));
  }, []);

  const visible = (items ?? []).filter((item) =>
    `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <h1 className="text-lg font-bold">Склад</h1>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию или коду"
        className="min-h-[52px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--text)]"
      />
      {error && <Notice text={error} tone="error" />}
      {items === null && !error && <p className="text-sm text-[var(--muted)]">Загружаем…</p>}
      <div className="flex flex-col gap-2">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(`/eq/${encodeURIComponent(item.code)}`)}
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left"
          >
            <span
              className="h-9 w-1.5 shrink-0 rounded-full"
              style={{ background: STATUS_TONE[item.status] }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{item.name}</span>
              <span className="block font-mono text-xs text-[var(--muted2)]">
                {item.code} · {STATUS_LABEL[item.status]}
              </span>
            </span>
            {item.openDefects > 0 && (
              <span className="rounded-full bg-[var(--bad-dim)] px-2 py-1 text-xs font-semibold text-[var(--bad)]">
                {item.openDefects}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
};

const EquipmentScreen: React.FC<{ code: string }> = ({ code }) => {
  const [item, setItem] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [defectOpen, setDefectOpen] = useState(false);
  const [defectText, setDefectText] = useState('');
  const [severity, setSeverity] = useState<'low' | 'high' | 'blocker'>('high');

  const load = useCallback(async () => {
    setError('');
    try {
      const found = await api.equipmentByCode(code);
      setItem(found);
      setHistory(await api.history(found.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить карточку');
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    setDone('');
    try {
      await fn();
      setDone(message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };

  if (error && !item) return <Notice text={error} tone="error" />;
  if (!item) return <p className="text-sm text-[var(--muted)]">Загружаем…</p>;

  const since = daysSince(item.lastCheckOn);

  return (
    <>
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: 'var(--acc-dim)', color: STATUS_TONE[item.status] }}
          >
            {STATUS_LABEL[item.status]}
          </span>
          <span className="font-mono text-xs text-[var(--muted2)]">{item.code}</span>
        </div>
        <h1 className="mt-2 text-xl font-bold leading-snug">{item.name}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted2)]">Категория</dt>
            <dd className="font-medium">{item.category}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted2)]">Проверено</dt>
            <dd className="font-medium">
              {fmtDate(item.lastCheckOn)}
              {since !== null && since > 30 && (
                <span className="ml-1 text-[var(--warn)]">· {since} дн назад</span>
              )}
            </dd>
          </div>
        </dl>
        {item.note && <p className="mt-3 text-sm text-[var(--muted)]">{item.note}</p>}
        {item.openDefects > 0 && (
          <p className="mt-3 rounded-2xl bg-[var(--bad-dim)] px-3 py-2 text-sm text-[var(--bad)]">
            Открытых дефектов: {item.openDefects}
          </p>
        )}
      </section>

      {done && <Notice text={done} tone="ok" />}
      {error && <Notice text={error} tone="error" />}

      <div className="flex flex-col gap-2">
        <Button
          tone="ok"
          disabled={busy}
          onClick={() => act(() => api.check(item.id), 'Проверка отмечена сегодняшним днём')}
        >
          Проверено
        </Button>

        {!defectOpen ? (
          <Button tone="danger" disabled={busy} onClick={() => setDefectOpen(true)}>
            Есть дефект
          </Button>
        ) : (
          <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="font-semibold">Что не так</h2>
            <div className="flex gap-2">
              {(
                [
                  ['low', 'Мелочь'],
                  ['high', 'Серьёзно'],
                  ['blocker', 'Не работает']
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSeverity(value)}
                  className={`min-h-[44px] flex-1 rounded-2xl border px-2 text-sm font-medium ${
                    severity === value
                      ? 'border-[var(--acc)] bg-[var(--acc-dim)] text-[var(--text)]'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={defectText}
              onChange={(e) => setDefectText(e.target.value)}
              rows={3}
              placeholder="Опишите коротко: что, где, когда заметили"
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3 text-base text-[var(--text)]"
            />
            <div className="flex gap-2">
              <Button
                tone="danger"
                disabled={busy || defectText.trim().length < 3}
                onClick={() =>
                  act(async () => {
                    await api.reportDefect(item.id, severity, defectText.trim());
                    setDefectOpen(false);
                    setDefectText('');
                  }, 'Дефект записан, ответственный увидит его в списке')
                }
              >
                Отправить
              </Button>
              <Button onClick={() => setDefectOpen(false)}>Отмена</Button>
            </div>
          </section>
        )}

        {item.status !== 'repair' ? (
          <Button
            disabled={busy}
            onClick={() =>
              act(
                () => api.setStatus(item.id, 'repair', null, 'Отправлено в ремонт с площадки'),
                'Единица уехала в ремонт'
              )
            }
          >
            Отправить в ремонт
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() =>
              act(() => api.setStatus(item.id, 'stock', null, 'Вернулось из ремонта'), 'На складе')
            }
          >
            Вернуть из ремонта на склад
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted2)]">
          История
        </h2>
        <ol className="flex flex-col gap-2">
          {history.slice(0, 12).map((event) => (
            <li
              key={event.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <div className="flex justify-between gap-2 text-xs text-[var(--muted2)]">
                <span>{EVENT_LABEL[event.kind] ?? event.kind}</span>
                <span>{fmtDateTime(event.createdAt)}</span>
              </div>
              <p className="mt-1">
                {event.userName ?? 'система'}
                {event.toStatus && event.fromStatus !== event.toStatus && (
                  <>
                    {' · '}
                    {STATUS_LABEL[event.toStatus] ?? event.toStatus}
                  </>
                )}
                {event.projectCode && ` · ${event.projectCode}`}
              </p>
              {event.note && <p className="mt-1 text-[var(--muted)]">{event.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
};

const KitScreen: React.FC<{ id: string }> = ({ id }) => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setKit(await api.kit(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить комплект');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    setDone('');
    try {
      await fn();
      setDone(message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };

  if (error && !kit) return <Notice text={error} tone="error" />;
  if (!kit) return <p className="text-sm text-[var(--muted)]">Загружаем…</p>;

  return (
    <>
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <span className="font-mono text-xs text-[var(--muted2)]">{kit.projectCode}</span>
        <h1 className="text-xl font-bold leading-snug">{kit.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{kit.projectTitle}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--acc)]"
            style={{ width: `${kit.progress.readiness}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Погружено {kit.progress.loaded} из {kit.progress.total} · принято {kit.progress.returned}
        </p>
      </section>

      {done && <Notice text={done} tone="ok" />}
      {error && <Notice text={error} tone="error" />}

      <div className="flex flex-col gap-2">
        {kit.items.map((item) => (
          <article
            key={item.equipmentId}
            className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div>
              <button
                type="button"
                onClick={() => go(`/eq/${encodeURIComponent(item.code)}`)}
                className="text-left text-sm font-semibold underline decoration-[var(--border2)] underline-offset-4"
              >
                {item.name}
              </button>
              <p className="font-mono text-xs text-[var(--muted2)]">
                {item.code} · {STATUS_LABEL[item.status] ?? item.status}
              </p>
            </div>

            {!item.checkedOutAt && (
              <Button
                tone="accent"
                disabled={busy}
                onClick={() =>
                  act(() => api.checkout(kit.id, item.equipmentId), `${item.code}: погружено`)
                }
              >
                Погрузили
              </Button>
            )}

            {item.checkedOutAt && !item.checkedInAt && returning !== item.equipmentId && (
              <Button disabled={busy} onClick={() => setReturning(item.equipmentId)}>
                Принять с выезда
              </Button>
            )}

            {returning === item.equipmentId && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-[var(--muted)]">В каком виде вернулось?</p>
                <Button
                  tone="ok"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api.checkin(kit.id, item.equipmentId, 'ok');
                      setReturning(null);
                    }, `${item.code}: принято на склад`)
                  }
                >
                  Целое
                </Button>
                <Button
                  tone="danger"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api.checkin(kit.id, item.equipmentId, 'damaged');
                      setReturning(null);
                    }, `${item.code}: ушло в ремонт, дефект заведён`)
                  }
                >
                  Повреждено
                </Button>
                <Button
                  tone="danger"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api.checkin(kit.id, item.equipmentId, 'missing');
                      setReturning(null);
                    }, `${item.code}: отмечено как не вернувшееся`)
                  }
                >
                  Не вернулось
                </Button>
                <Button onClick={() => setReturning(null)}>Отмена</Button>
              </div>
            )}

            {item.checkedInAt && (
              <p className="text-sm text-[var(--muted)]">
                Принято{' '}
                {item.returnState === 'ok'
                  ? 'целым'
                  : item.returnState === 'damaged'
                    ? 'с повреждением'
                    : 'как не вернувшееся'}
              </p>
            )}
          </article>
        ))}
      </div>
    </>
  );
};

export const FieldApp: React.FC = () => {
  const [route, setRoute] = useState<Route>(parseHash);
  const [user, setUser] = useState<SessionUser | null>(getStoredUser);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Токен мог протухнуть за месяц — проверяем его до того, как показать экраны.
  useEffect(() => {
    if (!getToken()) {
      setChecked(true);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setChecked(true));
  }, []);

  const logout = () => {
    clearSession();
    setUser(null);
  };

  if (!apiConfigured()) {
    return (
      <Shell user={null} onLogout={logout}>
        <Notice
          text="Полевой режим не настроен: не задан адрес сервера VITE_API_URL при сборке."
          tone="error"
        />
      </Shell>
    );
  }

  if (!checked) {
    return (
      <Shell user={null} onLogout={logout}>
        <p className="text-sm text-[var(--muted)]">Проверяем вход…</p>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell user={null} onLogout={logout}>
        <LoginScreen onDone={setUser} />
      </Shell>
    );
  }

  return (
    <Shell user={user} onLogout={logout}>
      {route.name === 'home' && <HomeScreen />}
      {route.name === 'stock' && <StockScreen />}
      {route.name === 'equipment' && <EquipmentScreen code={route.code} />}
      {route.name === 'kit' && <KitScreen id={route.id} />}
    </Shell>
  );
};
