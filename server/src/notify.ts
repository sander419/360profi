// Оповещения о том, что нельзя пропустить.
//
// Без них контур не замкнут: техник отметил, что экран не работает, а узнают об
// этом, когда откроют список — то есть перед следующим выездом, когда поздно.
//
// Куда слать, решает окружение, а не код:
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID — прямо в чат;
//   WEBHOOK_URL — POST {text, type, code, url} куда угодно.
// Не задано ничего — оповещения просто выключены, сервер работает как раньше.

export type NotifyKind = 'defect' | 'missing';

export interface NotifyEvent {
  kind: NotifyKind;
  text: string;
  code?: string;
  url?: string;
}

type Sender = (event: NotifyEvent) => void | Promise<void>;

const appUrl = (): string =>
  (process.env.PUBLIC_APP_URL ?? '').replace(/\/+$/, '/') || '';

const httpSender: Sender = async (event) => {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChat = process.env.TELEGRAM_CHAT_ID;
  const webhook = process.env.WEBHOOK_URL;
  if (!telegramToken && !webhook) return;

  // Оповещение не должно задерживать ответ сотруднику и тем более ронять запрос:
  // отметка важнее уведомления.
  const timeout = AbortSignal.timeout(5000);

  try {
    if (telegramToken && telegramChat) {
      const text = event.url ? `${event.text}\n${event.url}` : event.text;
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChat, text, disable_web_page_preview: true }),
        signal: timeout
      });
    }
    if (webhook) {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        signal: timeout
      });
    }
  } catch {
    // Молча: недоступный мессенджер не повод терять отметку о поломке.
  }
};

let sender: Sender = httpSender;

/** Подменяется в тестах, чтобы проверять факт оповещения без сети. */
export const setNotifier = (next: Sender): void => {
  sender = next;
};

export const resetNotifier = (): void => {
  sender = httpSender;
};

export const notify = (event: Omit<NotifyEvent, 'url'>): void => {
  const base = appUrl();
  const full: NotifyEvent = {
    ...event,
    url: base && event.code ? `${base}#/eq/${encodeURIComponent(event.code)}` : undefined
  };
  void Promise.resolve(sender(full)).catch(() => undefined);
};
