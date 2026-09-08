// Клиент API склада. Адрес сервера берётся из VITE_API_URL:
// если переменной нет, полевой режим просто не включается, а демо на localStorage
// продолжает работать как раньше.

export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const apiConfigured = (): boolean => API_URL.length > 0;

const TOKEN_KEY = 'profi360_token';
const USER_KEY = 'profi360_user';
const SKEW_KEY = 'profi360_clock_skew';

export type Role = 'admin' | 'manager' | 'tech';

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: string;
  serial: string;
  status: 'stock' | 'project' | 'repair' | 'reserved' | 'transit';
  projectId: string | null;
  lastCheckOn: string | null;
  note: string;
  openDefects: number;
}

export interface HistoryEvent {
  id: string;
  kind: string;
  /** Когда действие произошло на площадке (может быть раньше записи на сервере). */
  occurredAt: string;
  fromStatus: string | null;
  toStatus: string | null;
  projectCode: string | null;
  userName: string | null;
  note: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  url: string;
  author?: string | null;
  bytes?: number;
  occurredAt?: string;
}

export interface Defect {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  severity: 'low' | 'high' | 'blocker';
  description: string;
  status: 'open' | 'in_repair' | 'closed';
  reporter: string | null;
  createdAt: string;
  closedAt: string | null;
  photos: Photo[];
}

export interface TripSummary {
  kitId: string;
  kitName: string;
  projectCode: string | null;
  counts: {
    planned: number;
    taken: number;
    returnedOk: number;
    damaged: number;
    missing: number;
    pending: number;
  };
  damaged: { code: string; name: string; note: string }[];
  missing: { code: string; name: string; note: string }[];
  pending: { code: string; name: string; note: string }[];
  defects: { code: string; name: string; severity: string; description: string }[];
  people: string[];
  /** Готовый текст для чата: одна формулировка для приложения и оповещения. */
  text: string;
}

export interface KitItem {
  equipmentId: string;
  code: string;
  name: string;
  category: string;
  status: string;
  checkedOutAt: string | null;
  checkedInAt: string | null;
  returnState: string | null;
  note: string;
}

export interface Kit {
  id: string;
  name: string;
  projectId: string;
  projectCode: string | null;
  projectTitle: string | null;
  progress: { total: number; loaded: number; returned: number; readiness: number };
  items: KitItem[];
}

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getStoredUser = (): SessionUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
};

const storeSession = (token: string, user: SessionUser): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // приватный режим браузера — работаем в рамках сессии
  }
};

export const clearSession = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
};

// Часы на телефоне сотрудника могут быть сбиты на часы и дни. Запоминаем
// разницу с сервером и учитываем её во времени отметок, сделанных без связи.
const rememberServerTime = (serverTime?: string): void => {
  if (!serverTime) return;
  const parsed = Date.parse(serverTime);
  if (Number.isNaN(parsed)) return;
  try {
    localStorage.setItem(SKEW_KEY, String(parsed - Date.now()));
  } catch {
    // без хранилища просто останемся на часах телефона
  }
};

export const clockSkewMs = (): number => {
  try {
    const raw = Number(localStorage.getItem(SKEW_KEY));
    return Number.isFinite(raw) ? raw : 0;
  } catch {
    return 0;
  }
};

/** Текущее время с поправкой на расхождение часов телефона и сервера. */
export const serverNow = (): Date => new Date(Date.now() + clockSkewMs());

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const request = async <T,>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> => {
  if (!apiConfigured()) {
    throw new ApiError('Адрес сервера не настроен (VITE_API_URL)', 0);
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new ApiError('Сервер недоступен. Проверьте связь и попробуйте ещё раз', 0);
  }

  // Токен протух или отозван — выкидываем на экран входа, а не показываем пустой список.
  if (res.status === 401 && options.auth !== false) {
    clearSession();
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new ApiError((data.error as string) || `Ошибка ${res.status}`, res.status);
  }
  return data as T;
};

// Доменные запросы живут в offline.ts: они обязаны проходить через кеш и очередь.
// Здесь остаётся только то, что без связи невозможно в принципе.
export const api = {
  login: async (phone: string, pin: string): Promise<SessionUser> => {
    const data = await request<{ token: string; user: SessionUser; serverTime?: string }>(
      '/api/v1/auth/login',
      { method: 'POST', body: { phone, pin }, auth: false }
    );
    storeSession(data.token, data.user);
    rememberServerTime(data.serverTime);
    return data.user;
  },

  me: () =>
    request<{ user: SessionUser; serverTime?: string }>('/api/v1/auth/me').then((d) => {
      rememberServerTime(d.serverTime);
      return d.user;
    })
};
