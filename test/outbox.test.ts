import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Outbox } from '../src/api/outbox.ts';
import type { OutboxEntry, OutboxStorage, SendResult } from '../src/api/outbox.ts';

const memoryStorage = (): OutboxStorage => {
  let value: string | null = null;
  return {
    read: () => value,
    write: (next) => {
      value = next;
    }
  };
};

let storage: OutboxStorage;
let outbox: Outbox;

const addEntry = (id: string, label = id) =>
  outbox.add(
    {
      id,
      method: 'POST',
      path: `/api/v1/equipment/${id}/check`,
      body: {},
      label,
      occurredAt: '2026-09-08T10:00:00.000Z'
    },
    '2026-09-08T10:00:00.000Z'
  );

beforeEach(() => {
  storage = memoryStorage();
  outbox = new Outbox(storage);
});

describe('очередь отметок', () => {
  test('переживает перезапуск приложения', () => {
    addEntry('a');
    addEntry('b');
    const restored = new Outbox(storage);
    assert.deepEqual(
      restored.pending().map((e) => e.id),
      ['a', 'b']
    );
  });

  test('битое хранилище не роняет приложение', () => {
    storage.write('это не json');
    assert.deepEqual(outbox.list(), []);
  });

  test('успешная отправка убирает записи и держит порядок', async () => {
    addEntry('a');
    addEntry('b');
    addEntry('c');
    const order: string[] = [];

    const report = await outbox.flush(async (entry) => {
      order.push(entry.id);
      return { outcome: 'sent' };
    });

    assert.deepEqual(order, ['a', 'b', 'c'], 'порядок отправки — как отмечали');
    assert.equal(report.sent, 3);
    assert.equal(outbox.list().length, 0);
  });

  test('пропажа связи останавливает очередь и сохраняет остаток', async () => {
    addEntry('a');
    addEntry('b');
    addEntry('c');
    const tried: string[] = [];

    const report = await outbox.flush(async (entry): Promise<SendResult> => {
      tried.push(entry.id);
      if (entry.id === 'b') return { outcome: 'retry', error: 'Сервер недоступен' };
      return { outcome: 'sent' };
    });

    assert.deepEqual(tried, ['a', 'b'], 'после обрыва не пытаемся отправлять следующие');
    assert.equal(report.sent, 1);
    assert.ok(report.stopped);
    assert.deepEqual(
      outbox.pending().map((e) => e.id),
      ['b', 'c'],
      'остаток очереди сохраняется в исходном порядке'
    );
    assert.equal(outbox.pending()[0]!.attempts, 1);
  });

  test('отказ по существу не блокирует очередь', async () => {
    addEntry('a');
    addEntry('b');

    const report = await outbox.flush(async (entry): Promise<SendResult> => {
      if (entry.id === 'a') {
        return { outcome: 'rejected', error: 'Позиция уже отмечена как отгруженная' };
      }
      return { outcome: 'sent' };
    });

    assert.equal(report.failed, 1);
    assert.equal(report.sent, 1, 'следующая отметка всё равно ушла');
    assert.equal(outbox.pending().length, 0);
    assert.deepEqual(
      outbox.failed().map((e) => e.error),
      ['Позиция уже отмечена как отгруженная']
    );
  });

  test('повторная отправка не трогает проблемные, пока их не вернули в очередь', async () => {
    addEntry('a');
    await outbox.flush(async (): Promise<SendResult> => ({
      outcome: 'rejected',
      error: 'Недостаточно прав'
    }));

    let calls = 0;
    await outbox.flush(async () => {
      calls += 1;
      return { outcome: 'sent' };
    });
    assert.equal(calls, 0, 'проблемная запись сама не переотправляется');

    outbox.retryFailed();
    const report = await outbox.flush(async () => ({ outcome: 'sent' }));
    assert.equal(report.sent, 1);
    assert.equal(outbox.list().length, 0);
  });

  test('ключ идемпотентности не меняется между попытками', async () => {
    addEntry('a');
    const keys: string[] = [];

    const collect = async (entry: OutboxEntry): Promise<SendResult> => {
      keys.push(entry.id);
      return { outcome: 'retry', error: 'нет связи' };
    };

    await outbox.flush(collect);
    await outbox.flush(collect);

    assert.deepEqual(keys, ['a', 'a'], 'сервер увидит один и тот же ключ и не применит дважды');
  });
});
