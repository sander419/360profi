// Клиент API склада. Адрес сервера берётся из VITE_API_URL:
// если переменной нет, полевой режим просто не включается, а демо на localStorage
// продолжает работать как раньше.

export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const apiConfigured = (): boolean => API_URL.length > 0;

const TOKEN_KEY = 'profi360_token';
const USER_KEY = 'profi360_user';

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
  fromStatus: string | null;
  toStatus: string | null;
  projectCode: string | null;
  userName: string | null;
  note: string;
  createdAt: string;
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

export const api = {
  login: async (phone: string, pin: string): Promise<SessionUser> => {
    const data = await request<{ token: string; user: SessionUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: { phone, pin },
      auth: false
    });
    storeSession(data.token, data.user);
    return data.user;
  },

  me: () => request<{ user: SessionUser }>('/api/v1/auth/me').then((d) => d.user),

  equipmentByCode: (code: string) =>
    request<{ item: Equipment }>(`/api/v1/equipment/by-code/${encodeURIComponent(code)}`).then(
      (d) => d.item
    ),

  equipmentList: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{ items: Equipment[] }>(`/api/v1/equipment${query ? `?${query}` : ''}`).then(
      (d) => d.items
    );
  },

  history: (id: string) =>
    request<{ events: HistoryEvent[] }>(`/api/v1/equipment/${id}/history`).then((d) => d.events),

  check: (id: string, note?: string) =>
    request<{ item: Equipment }>(`/api/v1/equipment/${id}/check`, {
      method: 'POST',
      body: { note: note ?? '' }
    }).then((d) => d.item),

  reportDefect: (id: string, severity: 'low' | 'high' | 'blocker', description: string) =>
    request<{ id: string }>(`/api/v1/equipment/${id}/defects`, {
      method: 'POST',
      body: { severity, description }
    }),

  setStatus: (id: string, status: string, projectId?: string | null, note?: string) =>
    request<{ item: Equipment }>(`/api/v1/equipment/${id}/status`, {
      method: 'POST',
      body: { status, projectId, note: note ?? '' }
    }).then((d) => d.item),

  kits: () => request<{ kits: Kit[] }>('/api/v1/kits').then((d) => d.kits),

  kit: (id: string) => request<{ kit: Kit }>(`/api/v1/kits/${id}`).then((d) => d.kit),

  checkout: (kitId: string, equipmentId: string, note?: string) =>
    request<{ kit: Kit }>(`/api/v1/kits/${kitId}/checkout`, {
      method: 'POST',
      body: { equipmentId, note: note ?? '' }
    }).then((d) => d.kit),

  checkin: (
    kitId: string,
    equipmentId: string,
    returnState: 'ok' | 'damaged' | 'missing',
    note?: string
  ) =>
    request<{ kit: Kit }>(`/api/v1/kits/${kitId}/checkin`, {
      method: 'POST',
      body: { equipmentId, returnState, note: note ?? '' }
    }).then((d) => d.kit)
};
