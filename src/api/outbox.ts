// Очередь отметок, сделанных без связи.
//
// Модуль намеренно чистый: никакого fetch, localStorage и Date внутри — всё
// приходит снаружи. Так его можно прогнать тестами, а именно здесь живут
// правила, от которых зависит, не потеряется ли отметка техника на площадке.

export type OutboxState = 'pending' | 'failed';

export interface OutboxEntry {
  id: string;
  path: string;
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
  /** Что показать человеку: «LED-0104 · проверка». */
  label: string;
  occurredAt: string;
  createdAt: string;
  attempts: number;
  state: OutboxState;
  error?: string;
}

/**
 * Исход отправки одной записи:
 *  sent     — сервер принял, запись уходит из очереди;
 *  retry    — связи нет или сервер сломался, повторим позже, порядок сохраняем;
 *  rejected — сервер отказал по существу, повтор не поможет.
 */
export type SendResult =
  | { outcome: 'sent' }
  | { outcome: 'retry'; error: string }
  | { outcome: 'rejected'; error: string };

export interface OutboxStorage {
  read(): string | null;
  write(value: string): void;
}

export interface FlushReport {
  sent: number;
  failed: number;
  /** Остановились из-за отсутствия связи: остаток очереди не тронут. */
  stopped: boolean;
}

export class Outbox {
  private storage: OutboxStorage;

  constructor(storage: OutboxStorage) {
    this.storage = storage;
  }

  list(): OutboxEntry[] {
    try {
      const raw = this.storage.read();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
    } catch {
      return [];
    }
  }

  private save(entries: OutboxEntry[]): void {
    try {
      this.storage.write(JSON.stringify(entries));
    } catch {
      // Место кончилось — отметки в памяти всё равно уйдут при ближайшей отправке.
    }
  }

  pending(): OutboxEntry[] {
    return this.list().filter((e) => e.state === 'pending');
  }

  failed(): OutboxEntry[] {
    return this.list().filter((e) => e.state === 'failed');
  }

  add(entry: Omit<OutboxEntry, 'attempts' | 'state' | 'createdAt'>, createdAt: string): OutboxEntry {
    const full: OutboxEntry = { ...entry, createdAt, attempts: 0, state: 'pending' };
    this.save([...this.list(), full]);
    return full;
  }

  remove(id: string): void {
    this.save(this.list().filter((e) => e.id !== id));
  }

  /** Вернуть проблемные записи в очередь — после того как человек починил причину. */
  retryFailed(): void {
    this.save(
      this.list().map((e) =>
        e.state === 'failed' ? { ...e, state: 'pending', attempts: 0, error: undefined } : e
      )
    );
  }

  clearFailed(): void {
    this.save(this.list().filter((e) => e.state !== 'failed'));
  }

  /**
   * Отправляет очередь строго по порядку: погрузка должна уйти раньше приёма.
   *
   * Нет связи — останавливаемся и сохраняем остаток: порядок важнее скорости.
   * Сервер отверг по существу («уже отмечено», «нет прав») — повтор не поможет,
   * поэтому запись уходит в проблемные, а очередь идёт дальше и не встаёт колом.
   */
  async flush(send: (entry: OutboxEntry) => Promise<SendResult>): Promise<FlushReport> {
    const report: FlushReport = { sent: 0, failed: 0, stopped: false };

    for (const entry of this.pending()) {
      const result = await send(entry);

      if (result.outcome === 'sent') {
        this.remove(entry.id);
        report.sent += 1;
        continue;
      }

      if (result.outcome === 'retry') {
        this.save(
          this.list().map((e) =>
            e.id === entry.id ? { ...e, attempts: e.attempts + 1, error: result.error } : e
          )
        );
        report.stopped = true;
        break;
      }

      this.save(
        this.list().map((e) =>
          e.id === entry.id
            ? { ...e, state: 'failed', attempts: e.attempts + 1, error: result.error }
            : e
        )
      );
      report.failed += 1;
    }

    return report;
  }
}
