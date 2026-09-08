// Работа без связи: локальный кеш для чтения, очередь отметок для записи.
//
// Логика простая и намеренно консервативная. Отметка, сделанная в подвале без
// сети, обязана дойти до сервера ровно один раз, в том же порядке и с тем
// временем, когда её сделали, — иначе журнал перестаёт быть доказательством.

import { API_URL, ApiError, apiConfigured, clearSession, getToken, serverNow } from './client.ts';
import type { Defect, Equipment, HistoryEvent, Kit, Photo, TripSummary } from './client.ts';
import { Outbox } from './outbox.ts';
import type { OutboxEntry, OutboxStorage, SendResult } from './outbox.ts';

const CACHE_KEY = 'profi360_cache_v1';
const OUTBOX_KEY = 'profi360_outbox_v1';

const localStorageAdapter = (key: string): OutboxStorage => ({
  read: () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write: (value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // приватный режим или кончилось место
    }
  }
});

export const outbox = new Outbox(localStorageAdapter(OUTBOX_KEY));

// --- кеш чтения -------------------------------------------------------------

interface CacheShape {
  equipment: Record<string, Equipment>;
  kits: Record<string, Kit>;
  defects: Defect[];
  savedAt: string | null;
}

const emptyCache: CacheShape = { equipment: {}, kits: {}, defects: [], savedAt: null };

const readCache = (): CacheShape => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { ...emptyCache };
    const parsed = JSON.parse(raw) as CacheShape;
    return {
      equipment: parsed.equipment ?? {},
      kits: parsed.kits ?? {},
      defects: parsed.defects ?? [],
      savedAt: parsed.savedAt ?? null
    };
  } catch {
    return { ...emptyCache };
  }
};

const writeCache = (cache: CacheShape): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...cache, savedAt: new Date().toISOString() }));
  } catch {
    // кеш — удобство, а не данные: молча переживаем нехватку места
  }
};

const cacheEquipment = (items: Equipment[]): void => {
  const cache = readCache();
  for (const item of items) cache.equipment[item.id] = item;
  writeCache(cache);
};

const cacheKit = (kit: Kit): void => {
  const cache = readCache();
  cache.kits[kit.id] = kit;
  writeCache(cache);
};

const patchEquipment = (id: string, patch: Partial<Equipment>): void => {
  const cache = readCache();
  const current = cache.equipment[id];
  if (!current) return;
  cache.equipment[id] = { ...current, ...patch };
  writeCache(cache);
};

const recount = (kit: Kit): Kit => {
  const loaded = kit.items.filter((i) => i.checkedOutAt).length;
  const returned = kit.items.filter((i) => i.checkedInAt).length;
  return {
    ...kit,
    progress: {
      total: kit.items.length,
      loaded,
      returned,
      readiness: kit.items.length === 0 ? 0 : Math.round((loaded / kit.items.length) * 100)
    }
  };
};

const patchKitItem = (
  kitId: string,
  equipmentId: string,
  patch: Partial<Kit['items'][number]>
): void => {
  const cache = readCache();
  const kit = cache.kits[kitId];
  if (!kit) return;
  cache.kits[kitId] = recount({
    ...kit,
    items: kit.items.map((i) => (i.equipmentId === equipmentId ? { ...i, ...patch } : i))
  });
  writeCache(cache);
};

export const cacheSavedAt = (): string | null => readCache().savedAt;

// --- чтение с подстраховкой кешем -------------------------------------------

export interface Loaded<T> {
  data: T;
  /** Данные из кеша: сеть недоступна. */
  stale: boolean;
  savedAt: string | null;
}

const fresh = <T,>(data: T): Loaded<T> => ({ data, stale: false, savedAt: null });

const isOffline = (err: unknown): boolean => err instanceof ApiError && err.status === 0;

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
};

const get = async <T,>(path: string): Promise<T> => {
  if (!apiConfigured()) throw new ApiError('Адрес сервера не настроен', 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  } catch {
    throw new ApiError('Сервер недоступен', 0);
  }
  if (res.status === 401) {
    clearSession();
    throw new ApiError('Нужен вход в систему', 401);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(data.error ?? `Ошибка ${res.status}`, res.status);
  return data as T;
};

export const loadEquipmentList = async (): Promise<Loaded<Equipment[]>> => {
  try {
    const { items } = await get<{ items: Equipment[] }>('/api/v1/equipment');
    cacheEquipment(items);
    return fresh(items);
  } catch (err) {
    if (!isOffline(err)) throw err;
    const cache = readCache();
    return { data: Object.values(cache.equipment), stale: true, savedAt: cache.savedAt };
  }
};

export const loadEquipmentByCode = async (code: string): Promise<Loaded<Equipment>> => {
  try {
    const { item } = await get<{ item: Equipment }>(
      `/api/v1/equipment/by-code/${encodeURIComponent(code)}`
    );
    cacheEquipment([item]);
    return fresh(item);
  } catch (err) {
    if (!isOffline(err)) throw err;
    const cache = readCache();
    const found = Object.values(cache.equipment).find((i) => i.code === code);
    if (!found) {
      throw new ApiError(
        `Нет связи, а ${code} не сохранён в телефоне. Откройте список склада, когда будет сеть.`,
        0
      );
    }
    return { data: found, stale: true, savedAt: cache.savedAt };
  }
};

export const loadHistory = async (id: string): Promise<Loaded<HistoryEvent[]>> => {
  try {
    const { events } = await get<{ events: HistoryEvent[] }>(`/api/v1/equipment/${id}/history`);
    return fresh(events);
  } catch (err) {
    if (!isOffline(err)) throw err;
    return { data: [], stale: true, savedAt: cacheSavedAt() };
  }
};

export const loadKits = async (): Promise<Loaded<Kit[]>> => {
  try {
    const { kits } = await get<{ kits: Kit[] }>('/api/v1/kits');
    const cache = readCache();
    for (const kit of kits) cache.kits[kit.id] = kit;
    writeCache(cache);
    return fresh(kits);
  } catch (err) {
    if (!isOffline(err)) throw err;
    const cache = readCache();
    return { data: Object.values(cache.kits), stale: true, savedAt: cache.savedAt };
  }
};

export const loadKit = async (id: string): Promise<Loaded<Kit>> => {
  try {
    const { kit } = await get<{ kit: Kit }>(`/api/v1/kits/${id}`);
    cacheKit(kit);
    return fresh(kit);
  } catch (err) {
    if (!isOffline(err)) throw err;
    const cache = readCache();
    const kit = cache.kits[id];
    if (!kit) throw new ApiError('Нет связи, и этот выезд не сохранён в телефоне', 0);
    return { data: kit, stale: true, savedAt: cache.savedAt };
  }
};

export const loadDefects = async (): Promise<Loaded<Defect[]>> => {
  try {
    const { defects } = await get<{ defects: Defect[] }>('/api/v1/defects');
    const cache = readCache();
    cache.defects = defects;
    writeCache(cache);
    return fresh(defects);
  } catch (err) {
    if (!isOffline(err)) throw err;
    const cache = readCache();
    return { data: cache.defects, stale: true, savedAt: cache.savedAt };
  }
};

export const loadPhotos = async (equipmentId: string): Promise<Photo[]> => {
  try {
    const { photos } = await get<{ photos: Photo[] }>(`/api/v1/equipment/${equipmentId}/photos`);
    return photos;
  } catch (err) {
    // Снимки без связи не покажем: они лежат на сервере, а не в телефоне.
    if (!isOffline(err)) throw err;
    return [];
  }
};

/** Сводка считается на сервере: она должна быть одинаковой в приложении и в чате. */
export const loadTripSummary = async (
  kitId: string
): Promise<{ summary: TripSummary; canSend: boolean }> => {
  try {
    return await get<{ summary: TripSummary; canSend: boolean }>(`/api/v1/kits/${kitId}/summary`);
  } catch (err) {
    if (isOffline(err)) {
      throw new ApiError('Сводка соберётся, когда появится связь', 0);
    }
    throw err;
  }
};

// --- создание сущностей ------------------------------------------------------
//
// Заведение оборудования, проекта и выезда идёт напрямую, без очереди: сервер
// возвращает идентификатор, на который тут же ссылаются следующие действия.
// Отложить это невозможно, поэтому при отсутствии связи честно говорим об этом.

const post = async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
  if (!apiConfigured()) throw new ApiError('Адрес сервера не настроен', 0);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body)
    });
  } catch {
    throw new ApiError('Нужна связь: завести это без сети нельзя', 0);
  }
  if (res.status === 401) {
    clearSession();
    throw new ApiError('Нужен вход в систему', 401);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(data.error ?? `Ошибка ${res.status}`, res.status);
  return data as T;
};

export const createEquipment = async (input: {
  code?: string;
  name: string;
  category: string;
}): Promise<Equipment> => {
  const { item } = await post<{ item: Equipment }>('/api/v1/equipment', input);
  cacheEquipment([item]);
  return item;
};

export const createTrip = async (title: string): Promise<Kit> => {
  const { project } = await post<{ project: { id: string; code: string } }>('/api/v1/projects', {
    title
  });
  const { kit } = await post<{ kit: Kit }>('/api/v1/kits', {
    projectId: project.id,
    name: title
  });
  cacheKit(kit);
  return kit;
};

export const sendTripSummary = async (kitId: string): Promise<void> => {
  await post<{ sent: boolean }>(`/api/v1/kits/${kitId}/summary/send`, {});
};

/** Приём всего, что ещё не принято, целыми. Исключения отмечают до нажатия. */
export const receiveRest = (kit: Kit): Promise<PerformResult> =>
  perform({
    path: `/api/v1/kits/${kit.id}/checkin-rest`,
    label: `${kit.projectCode ?? kit.name} · приём остатка`,
    apply: optimistic.receiveRest(kit.id)
  });

/** Похожее из того, что уже заведено. Считается по кешу, поэтому работает и без связи:
 *  дубли обычно заводят именно в поле, где связи нет. */
export const similarEquipment = (name: string, limit = 3): Equipment[] => {
  const words = name
    .toLocaleLowerCase('ru')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  if (words.length === 0) return [];

  const cache = readCache();
  return Object.values(cache.equipment)
    .map((item) => {
      const haystack = item.name.toLocaleLowerCase('ru');
      const hits = words.filter((w) => haystack.includes(w)).length;
      return { item, hits };
    })
    .filter((row) => row.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((row) => row.item);
};

/** Погрузка по коду с наклейки: позиции может не быть в списке — сервер добавит. */
export const checkoutByCode = async (kitId: string, code: string): Promise<PerformResult> => {
  const found = await loadEquipmentByCode(code.trim().toUpperCase());
  return perform({
    path: `/api/v1/kits/${kitId}/checkout`,
    body: { equipmentId: found.data.id },
    label: `${found.data.code} · погрузка`,
    apply: optimistic.checkout(kitId, found.data.id)
  });
};

// --- запись через очередь ----------------------------------------------------

const sendEntry = async (entry: OutboxEntry): Promise<Response> => {
  return fetch(`${API_URL}${entry.path}`, {
    method: entry.method,
    headers: {
      'content-type': 'application/json',
      // Ключ операции постоянен между попытками: сервер по нему отличает
      // повтор от новой отметки.
      'idempotency-key': entry.id,
      ...authHeaders()
    },
    body: JSON.stringify(entry.body)
  });
};

const trySend = async (entry: OutboxEntry): Promise<SendResult> => {
  let res: Response;
  try {
    res = await sendEntry(entry);
  } catch {
    return { outcome: 'retry', error: 'Сервер недоступен' };
  }

  if (res.ok) return { outcome: 'sent' };

  // 5xx и таймауты лечатся повтором, 4xx — нет: сервер отказал по существу.
  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    return { outcome: 'retry', error: `Сервер ответил ${res.status}` };
  }

  let message = `Ошибка ${res.status}`;
  try {
    const data = JSON.parse(await res.text());
    if (data.error) message = data.error;
  } catch {
    // тело без json — оставляем код
  }
  if (res.status === 401) {
    clearSession();
    message = 'Сессия истекла, войдите заново';
  }
  return { outcome: 'rejected', error: message };
};

export interface PerformResult {
  queued: boolean;
}

export interface PerformOptions {
  path: string;
  method?: 'POST' | 'PATCH';
  body?: Record<string, unknown>;
  /** Человеческое описание для экрана очереди. */
  label: string;
  /** Оптимистичная правка кеша, чтобы экран сразу показал результат. */
  apply?: () => void;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Выполняет действие: онлайн — сразу, без связи — кладёт в очередь.
 * Бизнес-ошибку («уже отмечено») показываем человеку немедленно,
 * пропажу связи — молча превращаем в отложенную отправку.
 */
export const perform = async (options: PerformOptions): Promise<PerformResult> => {
  const occurredAt = serverNow().toISOString();
  const entry: OutboxEntry = {
    id: newId(),
    method: options.method ?? 'POST',
    path: options.path,
    body: { ...(options.body ?? {}), occurredAt },
    label: options.label,
    occurredAt,
    createdAt: occurredAt,
    attempts: 0,
    state: 'pending'
  };

  // localStorage — это несколько мегабайт на весь браузер. Снимок туда влезет,
  // десяток снимков — уже нет, и тогда молча потерялись бы и обычные отметки.
  const size = JSON.stringify(entry).length;
  if (size > 200_000) {
    const queued = JSON.stringify(outbox.list()).length;
    if (queued + size > 3_500_000) {
      throw new ApiError(
        'В телефоне уже слишком много неотправленных снимков. Отправьте очередь при связи, потом снимайте дальше',
        0
      );
    }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    outbox.add(entry, occurredAt);
    notify();
    return { queued: true };
  }

  const result = await trySend(entry);
  if (result.outcome === 'sent') return { queued: false };

  if (result.outcome === 'retry') {
    outbox.add(entry, occurredAt);
    notify();
    return { queued: true };
  }

  throw new ApiError(result.error, 400);
};

// Оптимистичные правки кеша под каждое действие.
export const optimistic = {
  check: (id: string, occurredAt = serverNow()) => () =>
    patchEquipment(id, {
      lastCheckOn: `${occurredAt.getFullYear()}-${String(occurredAt.getMonth() + 1).padStart(2, '0')}-${String(occurredAt.getDate()).padStart(2, '0')}`
    }),
  defect: (id: string, current: number) => () => patchEquipment(id, { openDefects: current + 1 }),
  status: (id: string, status: Equipment['status']) => () => patchEquipment(id, { status }),
  checkout: (kitId: string, equipmentId: string) => () => {
    patchKitItem(kitId, equipmentId, { checkedOutAt: new Date().toISOString(), status: 'project' });
    patchEquipment(equipmentId, { status: 'project' });
  },
  // Приём остатка: правим все погруженные и ещё не принятые позиции разом.
  receiveRest: (kitId: string) => () => {
    const cache = readCache();
    const kit = cache.kits[kitId];
    if (!kit) return;
    const now = new Date().toISOString();
    cache.kits[kitId] = recount({
      ...kit,
      items: kit.items.map((i) =>
        i.checkedOutAt && !i.checkedInAt
          ? { ...i, checkedInAt: now, returnState: 'ok', status: 'stock' }
          : i
      )
    });
    for (const item of kit.items) {
      if (item.checkedOutAt && !item.checkedInAt) {
        const current = cache.equipment[item.equipmentId];
        if (current) cache.equipment[item.equipmentId] = { ...current, status: 'stock' };
      }
    }
    writeCache(cache);
  },
  checkin: (kitId: string, equipmentId: string, state: 'ok' | 'damaged' | 'missing') => () => {
    const status: Equipment['status'] = state === 'damaged' ? 'repair' : 'stock';
    patchKitItem(kitId, equipmentId, {
      checkedInAt: new Date().toISOString(),
      returnState: state,
      status: state === 'missing' ? 'transit' : status
    });
    if (state !== 'missing') patchEquipment(equipmentId, { status });
  }
};

/** Идентификатор дефекта придумывает телефон: снимок должен уметь сослаться
 * на дефект, который ещё лежит в очереди и на сервер не попал. */
export const newDefectId = (): string => newId();

export const changeDefectStatus = (
  defect: Defect,
  status: 'open' | 'in_repair' | 'closed'
): Promise<PerformResult> => {
  const words = { open: 'открыт', in_repair: 'в ремонте', closed: 'закрыт' };
  return perform({
    method: 'PATCH',
    path: `/api/v1/defects/${defect.id}`,
    body: { status },
    label: `${defect.equipmentCode} · дефект ${words[status]}`,
    apply: () => {
      const cache = readCache();
      cache.defects = cache.defects.map((d) => (d.id === defect.id ? { ...d, status } : d));
      writeCache(cache);
    }
  });
};

export const uploadPhoto = (
  equipmentId: string,
  code: string,
  dataUrl: string,
  defectId?: string
): Promise<PerformResult> =>
  perform({
    path: `/api/v1/equipment/${equipmentId}/photos`,
    body: { data: dataUrl, defectId },
    label: `${code} · снимок`
  });

// --- синхронизация -----------------------------------------------------------

const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export const subscribeQueue = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

let syncing = false;

export const syncNow = async (): Promise<{ sent: number; failed: number; stopped: boolean }> => {
  if (syncing) return { sent: 0, failed: 0, stopped: false };
  syncing = true;
  try {
    const report = await outbox.flush(trySend);
    if (report.sent > 0 || report.failed > 0) notify();
    return report;
  } finally {
    syncing = false;
  }
};

export const retryFailed = async (): Promise<void> => {
  outbox.retryFailed();
  notify();
  await syncNow();
};

export const dropFailed = (): void => {
  outbox.clearFailed();
  notify();
};

/** Досылка при появлении сети, возвращении к вкладке и раз в полминуты. */
export const startAutoSync = (): (() => void) => {
  const attempt = () => {
    if (outbox.pending().length > 0 && navigator.onLine !== false) void syncNow();
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') attempt();
  };

  window.addEventListener('online', attempt);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(attempt, 30_000);
  attempt();

  return () => {
    window.removeEventListener('online', attempt);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
};
