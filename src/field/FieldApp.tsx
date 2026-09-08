// Полевой режим: то, что сотрудник открывает на телефоне.
//
// Главное требование к этому экрану — работать без связи. На площадке сеть
// пропадает регулярно, и отметка, которую в этот момент нельзя поставить,
// не ставится уже никогда. Поэтому чтение идёт через кеш, а запись — через
// очередь с досылкой (src/api/offline.ts).

import React, { useCallback, useEffect, useState } from 'react';
import {
  API_URL,
  ApiError,
  api,
  apiConfigured,
  clearSession,
  getStoredUser,
  getToken
} from '../api/client.ts';
import type {
  Defect,
  Equipment,
  HistoryEvent,
  Kit,
  Photo,
  SessionUser,
  TripSummary
} from '../api/client.ts';
import {
  acknowledge,
  changeDefectStatus,
  closeAnnouncement,
  createAnnouncement,
  checkoutByCode,
  createEquipment,
  createTrip,
  dropFailed,
  loadDefects,
  loadEquipmentByCode,
  loadEquipmentList,
  loadHistory,
  loadKit,
  loadKits,
  loadAnalytics,
  loadAnnouncementReads,
  loadAnnouncements,
  loadPhotos,
  loadSentAnnouncements,
  loadSystemStatus,
  loadTripSummary,
  newDefectId,
  receiveRest,
  sendTripSummary,
  similarEquipment,
  optimistic,
  outbox,
  perform,
  retryFailed,
  startAutoSync,
  subscribeQueue,
  syncNow,
  uploadPhoto
} from '../api/offline.ts';
import { preparePhoto } from './photo.ts';
import type { OutboxEntry } from '../api/outbox.ts';
import type { Analytics, Announcement, SentAnnouncement, SystemStatus } from '../api/offline.ts';

const STATUS_LABEL: Record<string, string> = {
  stock: 'На складе',
  project: 'На проекте',
  repair: 'В ремонте',
  reserved: 'Забронировано',
  transit: 'В пути',
  lost: 'Не вернулось'
};

const STATUS_TONE: Record<string, string> = {
  stock: 'var(--ok)',
  project: 'var(--acc)',
  repair: 'var(--bad)',
  reserved: 'var(--vio)',
  transit: 'var(--warn)',
  lost: 'var(--bad)'
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

const QUEUED_HINT = 'Сохранено в телефоне. Отправим, как появится сеть';

type Route =
  | { name: 'home' }
  | { name: 'equipment'; code: string }
  | { name: 'kit'; id: string }
  | { name: 'stock' }
  | { name: 'defects' }
  | { name: 'trip' }
  | { name: 'status' }
  | { name: 'analytics' }
  | { name: 'say' }
  | { name: 'queue' };

const parseHash = (): Route => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [section, value] = hash.split('/');
  if (section === 'eq' && value) return { name: 'equipment', code: decodeURIComponent(value) };
  if (section === 'kit' && value) return { name: 'kit', id: value };
  if (section === 'stock') return { name: 'stock' };
  if (section === 'defects') return { name: 'defects' };
  if (section === 'trip') return { name: 'trip' };
  if (section === 'status') return { name: 'status' };
  if (section === 'analytics') return { name: 'analytics' };
  if (section === 'say') return { name: 'say' };
  if (section === 'queue') return { name: 'queue' };
  return { name: 'home' };
};

const go = (path: string): void => {
  window.location.hash = path;
};

const useOnline = (): boolean => {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
};

const useQueue = (): { pending: OutboxEntry[]; failed: OutboxEntry[] } => {
  const read = () => ({ pending: outbox.pending(), failed: outbox.failed() });
  const [state, setState] = useState(read);
  useEffect(() => subscribeQueue(() => setState(read())), []);
  return state;
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

const Notice: React.FC<{ text: string; tone: 'error' | 'ok' | 'warn' }> = ({ text, tone }) => {
  const palette = {
    error: ['var(--bad-dim)', 'var(--bad)'],
    ok: ['var(--ok-dim)', 'var(--ok)'],
    warn: ['var(--warn-dim)', 'var(--warn)']
  }[tone];
  return (
    <div
      role="status"
      className="rounded-2xl px-4 py-3 text-sm"
      style={{ background: palette[0], color: palette[1] }}
    >
      {text}
    </div>
  );
};

const StaleBanner: React.FC<{ savedAt: string | null }> = ({ savedAt }) => (
  <Notice
    tone="warn"
    text={`Нет связи — показываем данные из телефона${savedAt ? ` от ${fmtDateTime(savedAt)}` : ''}. Отметки сохранятся и уйдут позже.`}
  />
);

const Shell: React.FC<{
  user: SessionUser | null;
  onLogout: () => void;
  children: React.ReactNode;
}> = ({ user, onLogout, children }) => {
  const online = useOnline();
  const { pending, failed } = useQueue();
  const waiting = pending.length + failed.length;

  return (
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
            <span className="block text-xs font-normal text-[var(--muted2)]">
              {online ? 'полевой режим' : 'без связи'}
            </span>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-3">
          {waiting > 0 && (
            <button
              type="button"
              onClick={() => go('/queue')}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: failed.length > 0 ? 'var(--bad-dim)' : 'var(--warn-dim)',
                color: failed.length > 0 ? 'var(--bad)' : 'var(--warn)'
              }}
            >
              {waiting} ждёт отправки
            </button>
          )}
          {user && (
            <button type="button" onClick={onLogout} className="text-right text-xs text-[var(--muted)]">
              {user.name}
              <span className="block text-[var(--muted2)]">выйти</span>
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5 pb-16 lg:max-w-5xl">
        {children}
      </main>
    </div>
  );
};

const LoginScreen: React.FC<{ onDone: (user: SessionUser) => void }> = ({ onDone }) => {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const online = useOnline();

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
      {!online && (
        <Notice
          tone="warn"
          text="Нет связи. Для первого входа нужна сеть — дальше приложение работает и без неё."
        />
      )}
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

const QueueScreen: React.FC = () => {
  const { pending, failed } = useQueue();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const online = useOnline();

  const send = async () => {
    setBusy(true);
    setMessage('');
    const report = await syncNow();
    setMessage(
      report.sent === 0 && report.stopped
        ? 'Связи всё ещё нет — отметки остались в телефоне'
        : `Отправлено: ${report.sent}${report.failed > 0 ? `, отклонено: ${report.failed}` : ''}`
    );
    setBusy(false);
  };

  return (
    <>
      <div>
        <h1 className="text-lg font-bold">Ждут отправки</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Отметки хранятся в телефоне и уходят сами, когда появляется сеть. Порядок сохраняется.
        </p>
      </div>

      {message && <Notice text={message} tone="ok" />}

      {pending.length === 0 && failed.length === 0 && (
        <Notice text="Всё отправлено, очередь пуста" tone="ok" />
      )}

      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted2)]">
            В очереди · {pending.length}
          </h2>
          {pending.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <p className="font-medium">{entry.label}</p>
              <p className="text-xs text-[var(--muted2)]">
                отмечено {fmtDateTime(entry.occurredAt)}
                {entry.attempts > 0 && ` · попыток: ${entry.attempts}`}
              </p>
            </div>
          ))}
          <Button tone="accent" disabled={busy || !online} onClick={send}>
            {online ? 'Отправить сейчас' : 'Нет связи'}
          </Button>
        </section>
      )}

      {failed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--bad)]">
            Сервер не принял · {failed.length}
          </h2>
          <p className="px-1 text-sm text-[var(--muted)]">
            Обычно это значит, что кто-то уже отметил то же самое. Покажите список руководителю,
            если не уверены.
          </p>
          {failed.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-[var(--bad)] bg-[var(--bad-dim)] px-3 py-2 text-sm"
            >
              <p className="font-medium">{entry.label}</p>
              <p className="text-xs" style={{ color: 'var(--bad)' }}>
                {entry.error}
              </p>
              <p className="text-xs text-[var(--muted2)]">отмечено {fmtDateTime(entry.occurredAt)}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void retryFailed()}>
              Попробовать снова
            </Button>
            <Button tone="danger" disabled={busy} onClick={dropFailed}>
              Убрать
            </Button>
          </div>
        </section>
      )}
    </>
  );
};

// Выезд заводит тот, кто грузит. Одно поле: куда едем. Код проекта,
// комплект и всё остальное система придумывает сама.
const NewTripScreen: React.FC = () => {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const kit = await createTrip(title.trim());
      go(`/kit/${kit.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не получилось создать выезд');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={create} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Новый выезд</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Напишите, что за мероприятие. Список оборудования соберётся сам, пока вы грузите.
        </p>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Свадьба в Лофте, 12 сентября"
        className="min-h-[52px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--text)]"
      />
      {error && <Notice text={error} tone="error" />}
      <button
        type="submit"
        disabled={busy || title.trim().length < 3}
        className="min-h-[52px] rounded-2xl bg-[var(--acc)] text-base font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Создаём…' : 'Создать и грузить'}
      </button>
    </form>
  );
};

const KIND_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  urgent: { bg: 'var(--bad-dim)', color: 'var(--bad)', label: 'Срочно' },
  task: { bg: 'var(--warn-dim)', color: 'var(--warn)', label: 'Задача' },
  info: { bg: 'var(--acc-dim)', color: 'var(--acc)', label: 'К сведению' }
};

// Объявление висит на рабочем экране, пока человек не нажмёт «Понял».
// Это единственное, что отличает команду от сообщения в чате.
const AnnouncementCard: React.FC<{
  item: Announcement;
  onAck: (item: Announcement) => void;
  busy: boolean;
}> = ({ item, onAck, busy }) => {
  const style = KIND_STYLE[item.kind] ?? KIND_STYLE.info!;
  return (
    <article
      className="flex flex-col gap-3 rounded-3xl border p-4"
      style={{ borderColor: style.color, background: style.bg }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: style.color }}>
          {style.label}
        </span>
        <span className="text-xs text-[var(--muted2)]">
          {item.author ?? 'руководство'} · {fmtDateTime(item.createdAt)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{item.text}</p>
      {item.acknowledged ? (
        <p className="text-xs text-[var(--muted)]">Прочитано</p>
      ) : (
        <Button tone="accent" disabled={busy} onClick={() => onAck(item)}>
          Понял
        </Button>
      )}
    </article>
  );
};

const AUDIENCES: [string, string][] = [
  ['all', 'Всем'],
  ['tech', 'Техникам'],
  ['manager', 'Менеджерам']
];

const KINDS: [string, string][] = [
  ['info', 'К сведению'],
  ['task', 'Задача'],
  ['urgent', 'Срочно']
];

// Экран руководителя: сказать всем и увидеть, до кого дошло.
const SayScreen: React.FC = () => {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'info' | 'task' | 'urgent'>('info');
  const [audience, setAudience] = useState<'all' | 'tech' | 'manager'>('all');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState<SentAnnouncement[] | null>(null);
  const [openReads, setOpenReads] = useState<string | null>(null);
  const [reads, setReads] = useState<{
    read: { name: string; readAt: string }[];
    notRead: { name: string; role: string }[];
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSent(await loadSentAnnouncements());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    try {
      await createAnnouncement({ text: text.trim(), kind, audience, days: 14 });
      setText('');
      setDone('Отправлено. Ниже видно, кто уже прочитал');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не отправилось');
    } finally {
      setBusy(false);
    }
  };

  const showReads = async (id: string) => {
    if (openReads === id) {
      setOpenReads(null);
      return;
    }
    setOpenReads(id);
    setReads(null);
    try {
      setReads(await loadAnnouncementReads(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить');
    }
  };

  return (
    <>
      <div>
        <h1 className="text-lg font-bold">Сказать команде</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Объявление появится на рабочем экране и не уйдёт, пока человек не нажмёт «Понял».
          Видно поимённо, до кого не дошло.
        </p>
      </div>

      <form onSubmit={send} className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="В пятницу инвентаризация, склад закрыт с 15:00"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-base text-[var(--text)]"
        />

        <div className="flex gap-2">
          {KINDS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value as typeof kind)}
              className={`min-h-[44px] flex-1 rounded-2xl border px-2 text-sm font-medium ${
                kind === value
                  ? 'border-[var(--acc)] bg-[var(--acc-dim)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {AUDIENCES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setAudience(value as typeof audience)}
              className={`min-h-[44px] flex-1 rounded-2xl border px-2 text-sm font-medium ${
                audience === value
                  ? 'border-[var(--acc)] bg-[var(--acc-dim)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {kind === 'urgent' && (
          <p className="px-1 text-xs text-[var(--muted2)]">
            Срочное дублируется в рабочий чат — до тех, кто сегодня не откроет приложение.
          </p>
        )}

        {done && <Notice text={done} tone="ok" />}
        {error && <Notice text={error} tone="error" />}

        <button
          type="submit"
          disabled={busy || text.trim().length < 3}
          className="min-h-[52px] rounded-2xl bg-[var(--acc)] text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Отправляем…' : 'Отправить команде'}
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted2)]">
          Отправленные
        </h2>
        {sent?.length === 0 && <p className="px-1 text-sm text-[var(--muted)]">Пока ничего.</p>}
        {sent?.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <p className="whitespace-pre-wrap text-sm">{item.text}</p>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void showReads(item.id)}
                className="text-xs underline decoration-[var(--border2)] underline-offset-4"
                style={{
                  color: item.reads >= item.audienceSize ? 'var(--ok)' : 'var(--warn)'
                }}
              >
                прочитали {item.reads} из {item.audienceSize}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await closeAnnouncement(item.id);
                  await refresh();
                }}
                className="text-xs text-[var(--muted2)]"
              >
                снять
              </button>
            </div>

            {openReads === item.id && (
              <div className="rounded-2xl bg-[var(--bg)] p-3 text-xs">
                {!reads && <p className="text-[var(--muted)]">Смотрим…</p>}
                {reads && reads.notRead.length > 0 && (
                  <p style={{ color: 'var(--warn)' }}>
                    Не прочитали: {reads.notRead.map((p) => p.name).join(', ')}
                  </p>
                )}
                {reads && reads.notRead.length === 0 && (
                  <p style={{ color: 'var(--ok)' }}>Прочитали все</p>
                )}
                {reads && reads.read.length > 0 && (
                  <p className="mt-1 text-[var(--muted2)]">
                    Прочитали: {reads.read.map((p) => p.name).join(', ')}
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
    </>
  );
};

// Строка-столбик: доля от максимума, значение подписано прямо в строке.
// Один показатель у разных предметов — значит одна серия и один цвет.
// Раскрашивать позиции в разные цвета здесь нечем: это не разные сущности.
const BarRow: React.FC<{ label: string; sub?: string; value: number; max: number }> = ({
  label,
  sub,
  value,
  max
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 truncate text-sm">
        {label}
        {sub && <span className="ml-2 font-mono text-xs text-[var(--muted2)]">{sub}</span>}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full bg-[var(--acc)]"
        style={{ width: `${max > 0 ? Math.max(4, (value / max) * 100) : 0}%` }}
      />
    </div>
  </div>
);

const Tile: React.FC<{ label: string; value: string | number; tone?: 'plain' | 'bad' | 'warn' }> = ({
  label,
  value,
  tone = 'plain'
}) => {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--text)';
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
};

const PERIODS: [number, string][] = [
  [30, '30 дней'],
  [90, '90 дней'],
  [365, 'год']
];

const AnalyticsScreen: React.FC = () => {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    loadAnalytics(days)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить'));
  }, [days]);

  if (error) return <Notice text={error} tone="error" />;

  const maxBroken = data ? Math.max(1, ...data.topBroken.map((t) => t.defects)) : 1;
  const maxCategory = data ? Math.max(1, ...data.breakdownByCategory.map((c) => c.defects)) : 1;
  const maxPerson = data ? Math.max(1, ...data.activity.byPerson.map((p) => p.actions)) : 1;

  return (
    <>
      <h1 className="text-lg font-bold">Что происходит с оборудованием</h1>

      <div className="flex gap-2">
        {PERIODS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDays(value)}
            className={`min-h-[44px] flex-1 rounded-2xl border px-2 text-sm font-medium ${
              days === value
                ? 'border-[var(--acc)] bg-[var(--acc-dim)] text-[var(--text)]'
                : 'border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!data && <p className="text-sm text-[var(--muted)]">Считаем…</p>}

      {data && !data.enoughData && (
        <Notice
          tone="warn"
          text="Данных пока мало: за период меньше десяти отметок. Цифры верны, но выводы по ним делать рано — нужен хотя бы месяц работы."
        />
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="Единиц на учёте" value={data.totals.equipment} />
            <Tile
              label="Сейчас в ремонте"
              value={data.totals.inRepair}
              tone={data.totals.inRepair > 0 ? 'bad' : 'plain'}
            />
            <Tile label="Поломок за период" value={data.totals.defectsInPeriod} />
            <Tile
              label="Открытых дефектов"
              value={data.totals.openDefects}
              tone={data.totals.openDefects > 0 ? 'warn' : 'plain'}
            />
          </div>

          <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="font-semibold">Проверки</h2>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Отметок за период" value={data.totals.checksInPeriod} />
              <Tile
                label="Не проверяли 60+ дней"
                value={data.totals.staleChecks}
                tone={data.totals.staleChecks > 0 ? 'warn' : 'plain'}
              />
              <Tile
                label="Ни разу не проверяли"
                value={data.totals.neverChecked}
                tone={data.totals.neverChecked > 0 ? 'warn' : 'plain'}
              />
            </div>
          </section>

          {data.topBroken.length > 0 && (
            <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold">Что ломается чаще</h2>
              <p className="-mt-2 text-xs text-[var(--muted2)]">Поломок за период, по единицам</p>
              {data.topBroken.map((item) => (
                <BarRow
                  key={item.code}
                  label={item.name}
                  sub={item.code}
                  value={item.defects}
                  max={maxBroken}
                />
              ))}
            </section>
          )}

          {data.breakdownByCategory.length > 0 && (
            <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold">По категориям</h2>
              <p className="-mt-2 text-xs text-[var(--muted2)]">
                Поломок за период; рядом — сколько разных единиц
              </p>
              {data.breakdownByCategory.map((cat) => (
                <BarRow
                  key={cat.label}
                  label={cat.label}
                  sub={`${cat.units} ед.`}
                  value={cat.defects}
                  max={maxCategory}
                />
              ))}
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="font-semibold">Ремонт и выезды</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Ремонтов завершено</dt>
                <dd className="font-mono font-semibold">{data.repair.finished}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Средний ремонт</dt>
                <dd className="font-mono font-semibold">
                  {data.repair.averageDays === null ? 'нет данных' : `${data.repair.averageDays} дн`}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Самый долгий</dt>
                <dd className="font-mono font-semibold">
                  {data.repair.longestDays === null ? 'нет данных' : `${data.repair.longestDays} дн`}
                </dd>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Выездов за период</dt>
                <dd className="font-mono font-semibold">
                  {data.trips.total}, закрыто {data.trips.closed}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Вернулось повреждённым</dt>
                <dd className="font-mono font-semibold">{data.trips.damagedItems}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Не вернулось совсем</dt>
                <dd
                  className="font-mono font-semibold"
                  style={{ color: data.trips.missingItems > 0 ? 'var(--bad)' : undefined }}
                >
                  {data.trips.missingItems}
                </dd>
              </div>
            </dl>
          </section>

          {data.activity.byPerson.length > 0 && (
            <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold">Кто отмечает</h2>
              <p className="-mt-2 text-xs text-[var(--muted2)]">
                Отметок за период. Это про то, живёт ли система, а не про то, кто лучше работает.
              </p>
              {data.activity.byPerson.map((person) => (
                <BarRow
                  key={person.name}
                  label={person.name}
                  value={person.actions}
                  max={maxPerson}
                />
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
};

// Состояние системы для того, кто за неё отвечает: проверить с телефона,
// а не идти по ssh. Показываем то, по чему видно беду: сторож молчит, бэкап
// старый, диск кончается, сертификат истекает.
const StatusScreen: React.FC = () => {
  const [state, setState] = useState<SystemStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSystemStatus()
      .then(setState)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить'));
  }, []);

  if (error) return <Notice text={error} tone="error" />;
  if (!state) return <p className="text-sm text-[var(--muted)]">Проверяем…</p>;

  const w = state.watchdog;
  const bad = state.watchdogStale || w?.status === 'problem';

  const rows: [string, string][] = [
    ['Оборудование', `${state.data.equipment}`],
    ['Сотрудники', `${state.data.users}`],
    ['Открытые дефекты', `${state.data.openDefects}`],
    ['Выезды', `${state.data.trips}`],
    ['Снимки', `${state.data.photos}`],
    ['Входов за неделю', `${state.data.loginsLast7Days}`],
    ['Сервер работает', `${state.server.uptimeHours} ч`],
    ['Размер базы', `${Math.max(1, Math.round(state.server.dbBytes / 1024))} КБ`]
  ];

  if (w) {
    rows.push(
      ['Ответ сервера', `${w.apiMs} мс`],
      ['Занято на диске', `${w.diskUsedPercent}%`],
      [
        'Последний бэкап',
        w.backupAgeHours < 0 ? 'нет' : `${w.backupAgeHours} ч назад`
      ],
      ['Сертификат', w.certDaysLeft < 0 ? 'неизвестно' : `${w.certDaysLeft} дн`]
    );
  }

  return (
    <>
      <h1 className="text-lg font-bold">Состояние системы</h1>

      {state.watchdogStale ? (
        <Notice
          tone="error"
          text={
            w
              ? `Сторож молчит с ${fmtDateTime(w.checkedAt)} — проверки не идут, состояние неизвестно`
              : 'Сторож не настроен: проверки живости не выполняются'
          }
        />
      ) : w?.status === 'problem' ? (
        <Notice tone="error" text={`Сторож нашёл проблемы: ${w.problems.join('; ')}`} />
      ) : (
        <Notice tone="ok" text={`Всё в порядке, проверено ${fmtDateTime(w!.checkedAt)}`} />
      )}

      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <dt className="text-sm text-[var(--muted)]">{label}</dt>
            <dd className="font-mono text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {!bad && (
        <p className="px-1 text-xs text-[var(--muted2)]">
          Сторож проверяет систему каждые пять минут и сам перезапускает сервис, если тот
          перестал отвечать.
        </p>
      )}
    </>
  );
};

const SEVERITY_LABEL: Record<string, string> = {
  low: 'мелочь',
  high: 'серьёзно',
  blocker: 'не работает'
};

const DEFECT_STATUS: Record<string, string> = {
  open: 'Открыт',
  in_repair: 'В ремонте',
  closed: 'Закрыт'
};

const DefectsScreen: React.FC<{ user: SessionUser }> = ({ user }) => {
  const [defects, setDefects] = useState<Defect[] | null>(null);
  const [stale, setStale] = useState<{ savedAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await loadDefects();
      setDefects(result.data);
      setStale(result.stale ? { savedAt: result.savedAt } : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (defect: Defect, status: 'in_repair' | 'closed') => {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const result = await changeDefectStatus(defect, status);
      setDone(
        `${defect.equipmentCode}: ${status === 'closed' ? 'дефект закрыт' : 'отправлен в ремонт'}${
          result.queued ? `. ${QUEUED_HINT}` : ''
        }`
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div>
        <h1 className="text-lg font-bold">Дефекты</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Всё, что отметили на складе и на площадке. Закрывает тот, кто починил.
        </p>
      </div>

      {stale && <StaleBanner savedAt={stale.savedAt} />}
      {done && <Notice text={done} tone="ok" />}
      {error && <Notice text={error} tone="error" />}
      {defects === null && !error && <p className="text-sm text-[var(--muted)]">Загружаем…</p>}
      {defects?.length === 0 && <Notice text="Открытых дефектов нет" tone="ok" />}

      <div className="grid gap-2 lg:grid-cols-2">
        {defects?.map((defect) => (
          <article
            key={defect.id}
            className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => go(`/eq/${encodeURIComponent(defect.equipmentCode)}`)}
                  className="text-left text-sm font-semibold underline decoration-[var(--border2)] underline-offset-4"
                >
                  {defect.equipmentName}
                </button>
                <p className="font-mono text-xs text-[var(--muted2)]">
                  {defect.equipmentCode} · {DEFECT_STATUS[defect.status]}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold"
                style={{
                  background: defect.severity === 'low' ? 'var(--warn-dim)' : 'var(--bad-dim)',
                  color: defect.severity === 'low' ? 'var(--warn)' : 'var(--bad)'
                }}
              >
                {SEVERITY_LABEL[defect.severity]}
              </span>
            </div>

            <p className="text-sm">{defect.description}</p>

            {defect.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {defect.photos.map((photo) => (
                  <a key={photo.id} href={`${API_URL}${photo.url}`} target="_blank" rel="noreferrer">
                    <img
                      src={`${API_URL}${photo.url}`}
                      alt="Снимок поломки"
                      className="h-24 w-24 rounded-2xl border border-[var(--border)] object-cover"
                    />
                  </a>
                ))}
              </div>
            )}

            <p className="text-xs text-[var(--muted2)]">
              {defect.reporter ?? 'неизвестно кто'} · {fmtDateTime(defect.createdAt)}
            </p>

            {defect.status !== 'closed' && (user.role === 'manager' || user.role === 'admin') && (
              <div className="flex gap-2">
                {defect.status === 'open' && (
                  <Button disabled={busy} onClick={() => void move(defect, 'in_repair')}>
                    В ремонт
                  </Button>
                )}
                <Button tone="ok" disabled={busy} onClick={() => void move(defect, 'closed')}>
                  Починено
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
};

const HomeScreen: React.FC<{ user: SessionUser }> = ({ user }) => {
  const [code, setCode] = useState('');
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [stale, setStale] = useState<{ savedAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [ackBusy, setAckBusy] = useState(false);

  const boss = user.role === 'admin' || user.role === 'manager';

  const refreshAnnouncements = useCallback(async () => {
    try {
      const result = await loadAnnouncements();
      setAnnouncements(result.data);
    } catch {
      // Объявления — не повод показывать ошибку на весь экран: работа важнее.
    }
  }, []);

  useEffect(() => {
    loadKits()
      .then((result) => {
        setKits(result.data);
        setStale(result.stale ? { savedAt: result.savedAt } : null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить'));
    void refreshAnnouncements();
  }, [refreshAnnouncements]);

  const ack = async (item: Announcement) => {
    setAckBusy(true);
    try {
      await acknowledge(item);
      setAnnouncements((list) =>
        list.map((a) => (a.id === item.id ? { ...a, acknowledged: true } : a))
      );
    } finally {
      setAckBusy(false);
    }
  };

  const unread = announcements.filter((a) => !a.acknowledged);

  return (
    <>
      {stale && <StaleBanner savedAt={stale.savedAt} />}

      {unread.map((item) => (
        <AnnouncementCard key={item.id} item={item} onAck={ack} busy={ackBusy} />
      ))}

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

      <Button tone="accent" onClick={() => go('/trip')}>
        Новый выезд
      </Button>
      <Button onClick={() => go('/stock')}>Весь склад</Button>

      {boss && (
        <section className="mt-2 flex flex-col gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted2)]">
            Управление
          </h2>
          <Button tone="accent" onClick={() => go('/say')}>
            Сказать команде
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => go('/defects')}>Дефекты</Button>
            <Button onClick={() => go('/analytics')}>Аналитика</Button>
          </div>
          <Button onClick={() => go('/status')}>Состояние системы</Button>
        </section>
      )}
    </>
  );
};

const StockScreen: React.FC = () => {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [stale, setStale] = useState<{ savedAt: string | null } | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadEquipmentList()
      .then((result) => {
        setItems(result.data);
        setStale(result.stale ? { savedAt: result.savedAt } : null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить'));
  }, []);

  const visible = (items ?? []).filter((item) =>
    `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <h1 className="text-lg font-bold">Склад</h1>
      {stale && <StaleBanner savedAt={stale.savedAt} />}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию или коду"
        className="min-h-[52px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--text)]"
      />
      {error && <Notice text={error} tone="error" />}
      {items === null && !error && <p className="text-sm text-[var(--muted)]">Загружаем…</p>}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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

// Человек стоит с железкой в руках и сканирует наклейку, которой нет в базе.
// Это лучший момент, чтобы её завести, — и единственный, когда это точно сделают.
const UnknownCodeScreen: React.FC<{ code: string; onCreated: () => void }> = ({
  code,
  onCreated
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Дубли в такой системе появляются на второй неделе. Дешевле показать
  // похожее прямо во время ввода, чем потом склеивать записи.
  const similar = name.trim().length >= 3 ? similarEquipment(name) : [];

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createEquipment({ code, name: name.trim(), category: category.trim() || 'Разное' });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не получилось завести');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={create} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Такого кода ещё нет</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Наклейка <span className="font-mono">{code}</span> не привязана. Заведите единицу прямо
          сейчас — потом никто этого не сделает.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Что это
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="LED-кабинет P3.9 №117"
          className="min-h-[52px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--text)]"
        />
      </label>
      {similar.length > 0 && (
        <div className="rounded-2xl border border-[var(--warn)] bg-[var(--warn-dim)] p-3 text-sm">
          <p className="font-medium" style={{ color: 'var(--warn)' }}>
            Похожее уже заведено — может, это оно?
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {similar.map((found) => (
              <li key={found.id}>
                <button
                  type="button"
                  onClick={() => go(`/eq/${encodeURIComponent(found.code)}`)}
                  className="text-left underline decoration-[var(--border2)] underline-offset-4"
                >
                  {found.name}{' '}
                  <span className="font-mono text-xs text-[var(--muted2)]">{found.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Категория
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="equipment-categories"
          placeholder="LED, Свет, Звук, Камеры…"
          className="min-h-[52px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--text)]"
        />
        <datalist id="equipment-categories">
          {['LED', 'Свет', 'Звук', 'Камеры', 'Трансляции', 'Питание', 'Риггинг', 'Разное'].map(
            (c) => (
              <option key={c} value={c} />
            )
          )}
        </datalist>
      </label>
      {error && <Notice text={error} tone="error" />}
      <button
        type="submit"
        disabled={busy || name.trim().length < 2}
        className="min-h-[52px] rounded-2xl bg-[var(--acc)] text-base font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Заводим…' : 'Завести'}
      </button>
    </form>
  );
};

const EquipmentScreen: React.FC<{ code: string }> = ({ code }) => {
  const [item, setItem] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [stale, setStale] = useState<{ savedAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [defectOpen, setDefectOpen] = useState(false);
  const [defectText, setDefectText] = useState('');
  const [severity, setSeverity] = useState<'low' | 'high' | 'blocker'>('high');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [attached, setAttached] = useState<{ dataUrl: string; bytes: number } | null>(null);
  const [unknown, setUnknown] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const found = await loadEquipmentByCode(code);
      setItem(found.data);
      setStale(found.stale ? { savedAt: found.savedAt } : null);
      const events = await loadHistory(found.data.id);
      setHistory(events.data);
      setPhotos(await loadPhotos(found.data.id));
    } catch (err) {
      // Кода нет в базе — предлагаем завести, а не показываем ошибку.
      if (err instanceof ApiError && err.status === 404) {
        setUnknown(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить карточку');
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (run: () => Promise<{ queued: boolean }>, message: string) => {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const result = await run();
      setDone(result.queued ? `${message}. ${QUEUED_HINT}` : message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };

  if (unknown && !item) {
    return (
      <UnknownCodeScreen
        code={code}
        onCreated={() => {
          setUnknown(false);
          void load();
        }}
      />
    );
  }
  if (error && !item) return <Notice text={error} tone="error" />;
  if (!item) return <p className="text-sm text-[var(--muted)]">Загружаем…</p>;

  const since = daysSince(item.lastCheckOn);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
      {stale && <StaleBanner savedAt={stale.savedAt} />}

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
          onClick={() =>
            act(
              () =>
                perform({
                  path: `/api/v1/equipment/${item.id}/check`,
                  label: `${item.code} · проверка`,
                  apply: optimistic.check(item.id)
                }),
              'Проверка отмечена'
            )
          }
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

            <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 text-sm font-medium text-[var(--muted)]">
              {attached ? `Снимок приложен · ${Math.round(attached.bytes / 1024)} КБ` : 'Сфотографировать поломку'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const chosen = e.target.files?.[0];
                  e.target.value = '';
                  if (!chosen) return;
                  try {
                    setAttached(await preparePhoto(chosen));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Снимок не подошёл');
                  }
                }}
              />
            </label>
            {attached && (
              <img
                src={attached.dataUrl}
                alt="Приложенный снимок"
                className="max-h-56 rounded-2xl border border-[var(--border)] object-contain"
              />
            )}
            <div className="flex gap-2">
              <Button
                tone="danger"
                disabled={busy || defectText.trim().length < 3}
                onClick={() =>
                  act(async () => {
                    // Идентификатор придумываем здесь: снимок уходит следующим в
                    // очереди и ссылается на дефект, которого на сервере ещё нет.
                    const defectId = newDefectId();
                    const result = await perform({
                      path: `/api/v1/equipment/${item.id}/defects`,
                      body: { id: defectId, severity, description: defectText.trim() },
                      label: `${item.code} · дефект`,
                      apply: optimistic.defect(item.id, item.openDefects)
                    });
                    if (attached) {
                      await uploadPhoto(item.id, item.code, attached.dataUrl, defectId);
                    }
                    setDefectOpen(false);
                    setDefectText('');
                    setAttached(null);
                    return result;
                  }, 'Дефект записан')
                }
              >
                Отправить
              </Button>
              <Button onClick={() => setDefectOpen(false)}>Отмена</Button>
            </div>
          </section>
        )}

        {item.status === 'lost' ? (
          <Button
            tone="ok"
            disabled={busy}
            onClick={() =>
              act(
                () =>
                  perform({
                    path: `/api/v1/equipment/${item.id}/status`,
                    body: { status: 'stock', projectId: null, note: 'Нашлась' },
                    label: `${item.code} · нашлась`,
                    apply: optimistic.status(item.id, 'stock')
                  }),
                'Единица снова на складе'
              )
            }
          >
            Нашлась — вернуть на склад
          </Button>
        ) : item.status !== 'repair' ? (
          <Button
            disabled={busy}
            onClick={() =>
              act(
                () =>
                  perform({
                    path: `/api/v1/equipment/${item.id}/status`,
                    body: { status: 'repair', projectId: null, note: 'Отправлено в ремонт с площадки' },
                    label: `${item.code} · в ремонт`,
                    apply: optimistic.status(item.id, 'repair')
                  }),
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
              act(
                () =>
                  perform({
                    path: `/api/v1/equipment/${item.id}/status`,
                    body: { status: 'stock', projectId: null, note: 'Вернулось из ремонта' },
                    label: `${item.code} · на склад`,
                    apply: optimistic.status(item.id, 'stock')
                  }),
                'На складе'
              )
            }
          >
            Вернуть из ремонта на склад
          </Button>
        )}
      </div>

      </div>

      <div className="flex flex-col gap-4">
      {photos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted2)]">
            Снимки
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo) => (
              <a key={photo.id} href={`${API_URL}${photo.url}`} target="_blank" rel="noreferrer">
                <img
                  src={`${API_URL}${photo.url}`}
                  alt="Снимок оборудования"
                  className="h-28 w-28 rounded-2xl border border-[var(--border)] object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted2)]">
          История
        </h2>
        {stale && history.length === 0 && (
          <p className="px-1 text-sm text-[var(--muted)]">История появится, когда будет связь.</p>
        )}
        <ol className="flex flex-col gap-2">
          {history.slice(0, 12).map((event) => (
            <li
              key={event.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <div className="flex justify-between gap-2 text-xs text-[var(--muted2)]">
                <span>{EVENT_LABEL[event.kind] ?? event.kind}</span>
                <span>{fmtDateTime(event.occurredAt ?? event.createdAt)}</span>
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
      </div>
    </div>
  );
};

const KitScreen: React.FC<{ id: string }> = ({ id }) => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [stale, setStale] = useState<{ savedAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [scanCode, setScanCode] = useState('');
  const [summary, setSummary] = useState<{ summary: TripSummary; canSend: boolean } | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryNote, setSummaryNote] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await loadKit(id);
      setKit(result.data);
      setStale(result.stale ? { savedAt: result.savedAt } : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить комплект');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (run: () => Promise<{ queued: boolean }>, message: string) => {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const result = await run();
      setDone(result.queued ? `${message}. ${QUEUED_HINT}` : message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };

  const openSummary = useCallback(async () => {
    setSummaryOpen(true);
    setSummaryNote('');
    try {
      setSummary(await loadTripSummary(id));
    } catch (err) {
      setSummaryNote(err instanceof ApiError ? err.message : 'Сводка не собралась');
    }
  }, [id]);

  // Выезд закрыт — сводка нужна сразу: именно в этот момент её и отправляют в чат.
  const closed = Boolean(kit && kit.progress.loaded > 0 && kit.progress.loaded === kit.progress.returned);
  useEffect(() => {
    if (closed && !summaryOpen) void openSummary();
  }, [closed, summaryOpen, openSummary]);

  // Отметили ещё одну позицию — открытая сводка обязана пересобраться,
  // иначе в чат уедет вчерашняя правда.
  const returnedCount = kit?.progress.returned ?? 0;
  const loadedCount = kit?.progress.loaded ?? 0;
  useEffect(() => {
    if (summaryOpen) void openSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedCount, loadedCount]);

  if (error && !kit) return <Notice text={error} tone="error" />;
  if (!kit) return <p className="text-sm text-[var(--muted)]">Загружаем…</p>;

  const pendingReturn = kit.items.filter((i) => i.checkedOutAt && !i.checkedInAt).length;

  const checkin = (equipmentId: string, code: string, state: 'ok' | 'damaged' | 'missing') => {
    const words = {
      ok: 'принято на склад',
      damaged: 'ушло в ремонт, дефект заведён',
      missing: 'отмечено как не вернувшееся'
    };
    return act(async () => {
      const result = await perform({
        path: `/api/v1/kits/${kit.id}/checkin`,
        body: { equipmentId, returnState: state },
        label: `${code} · приём (${state === 'ok' ? 'целое' : state === 'damaged' ? 'повреждено' : 'не вернулось'})`,
        apply: optimistic.checkin(kit.id, equipmentId, state)
      });
      setReturning(null);
      return result;
    }, `${code}: ${words[state]}`);
  };

  return (
    <>
      {stale && <StaleBanner savedAt={stale.savedAt} />}

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

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const code = scanCode.trim().toUpperCase();
          if (!code) return;
          void act(async () => {
            const result = await checkoutByCode(kit.id, code);
            setScanCode('');
            return result;
          }, `${code}: погружено`);
        }}
      >
        <input
          value={scanCode}
          onChange={(e) => setScanCode(e.target.value)}
          placeholder="Код с наклейки"
          autoCapitalize="characters"
          className="min-h-[52px] flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 font-mono text-base uppercase text-[var(--text)]"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-[52px] rounded-2xl bg-[var(--acc)] px-5 font-semibold text-white disabled:opacity-50"
        >
          Погрузить
        </button>
      </form>
      <p className="-mt-2 px-1 text-xs text-[var(--muted2)]">
        Сканируйте всё, что кладёте в машину. Позиции, которой нет в списке, добавятся сами.
      </p>

      {summaryOpen && (
        <section className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Сводка выезда</h2>
            <button
              type="button"
              onClick={() => setSummaryOpen(false)}
              className="text-xs text-[var(--muted2)]"
            >
              свернуть
            </button>
          </div>

          {summaryNote && <Notice text={summaryNote} tone="warn" />}
          {!summary && !summaryNote && (
            <p className="text-sm text-[var(--muted)]">Собираем…</p>
          )}

          {summary && (
            <>
              <pre className="whitespace-pre-wrap break-words rounded-2xl bg-[var(--bg)] p-3 font-sans text-sm leading-relaxed text-[var(--text)]">
                {summary.summary.text}
              </pre>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(summary.summary.text);
                      setSummaryNote('Скопировано — вставьте в чат');
                    } catch {
                      setSummaryNote('Скопировать не вышло: выделите текст выше вручную');
                    }
                  }}
                >
                  Скопировать
                </Button>
                {summary.canSend && (
                  <Button
                    tone="accent"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await sendTripSummary(kit.id);
                        setSummaryNote('Сводка ушла в чат');
                      } catch (err) {
                        setSummaryNote(err instanceof ApiError ? err.message : 'Не отправилось');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Отправить в чат
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {!summaryOpen && kit.progress.loaded > 0 && (
        <Button onClick={() => void openSummary()}>Сводка выезда</Button>
      )}

      {pendingReturn > 0 && kit.progress.loaded > 0 && (
        <div className="flex flex-col gap-1">
          <Button
            tone="ok"
            disabled={busy}
            onClick={() =>
              act(() => receiveRest(kit), `Принято целыми: ${pendingReturn}`)
            }
          >
            Принять остальные целыми ({pendingReturn})
          </Button>
          <p className="px-1 text-xs text-[var(--muted2)]">
            Сначала отметьте повреждённое и то, что не вернулось, — потом одну кнопку.
          </p>
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-2">
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
                  act(
                    () =>
                      perform({
                        path: `/api/v1/kits/${kit.id}/checkout`,
                        body: { equipmentId: item.equipmentId },
                        label: `${item.code} · погрузка`,
                        apply: optimistic.checkout(kit.id, item.equipmentId)
                      }),
                    `${item.code}: погружено`
                  )
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
                  onClick={() => checkin(item.equipmentId, item.code, 'ok')}
                >
                  Целое
                </Button>
                <Button
                  tone="danger"
                  disabled={busy}
                  onClick={() => checkin(item.equipmentId, item.code, 'damaged')}
                >
                  Повреждено
                </Button>
                <Button
                  tone="danger"
                  disabled={busy}
                  onClick={() => checkin(item.equipmentId, item.code, 'missing')}
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

  // Токен живёт месяц, но мог протухнуть. Проверяем — и только если сервер
  // прямо сказал «не пущу», выкидываем на вход: без связи пользователь
  // остаётся в приложении и работает по кешу.
  useEffect(() => {
    if (!getToken()) {
      setChecked(true);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          setUser(null);
        }
      })
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => (user ? startAutoSync() : undefined), [user]);

  // Пока связь есть, тихо складываем в телефон весь склад и выезды. Иначе офлайн
  // работал бы только для того, что техник успел открыть руками, — а он не успеет.
  useEffect(() => {
    if (!user) return;
    void loadEquipmentList().catch(() => undefined);
    void loadKits().catch(() => undefined);
  }, [user]);

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
      {route.name === 'home' && <HomeScreen user={user} />}
      {route.name === 'stock' && <StockScreen />}
      {route.name === 'defects' && <DefectsScreen user={user} />}
      {route.name === 'trip' && <NewTripScreen />}
      {route.name === 'status' && <StatusScreen />}
      {route.name === 'analytics' && <AnalyticsScreen />}
      {route.name === 'say' && <SayScreen />}
      {route.name === 'queue' && <QueueScreen />}
      {route.name === 'equipment' && <EquipmentScreen code={route.code} />}
      {route.name === 'kit' && <KitScreen id={route.id} />}
    </Shell>
  );
};
