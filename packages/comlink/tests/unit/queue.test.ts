import { describe, expect, test } from 'bun:test';

import { createPendingQueue } from '../../src/common/queue.js';

describe('createPendingQueue', () => {
  test('create returns a pending task with unique id', () => {
    const q = createPendingQueue();
    const a = q.create('1');
    const b = q.create('2');
    expect(a.id).toBe('1');
    expect(b.id).toBe('2');
    expect(a.promise).toBeInstanceOf(Promise);
  });

  test('resolve settles the matching promise', async () => {
    const q = createPendingQueue();
    const { id, promise } = q.create<number>('1');
    q.resolve(id, 42);
    await expect(promise).resolves.toBe(42);
  });

  test('reject settles the matching promise with Error', async () => {
    const q = createPendingQueue();
    const { id, promise } = q.create('1');
    void promise.catch(() => {});
    q.reject(id, 'boom');
    await expect(promise).rejects.toBeInstanceOf(Error);
  });

  test('wraps non-Error reject reasons', async () => {
    const q = createPendingQueue();
    const { id, promise } = q.create('1');
    let captured: unknown;
    void promise.catch(e => {
      captured = e;
    });
    q.reject(id, 7);
    await promise.catch(() => {});
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe('7');
  });

  test('resolve on unknown id is a no-op', () => {
    const q = createPendingQueue();
    expect(() => q.resolve('missing', 1)).not.toThrow();
  });

  test('reject on unknown id is a no-op', () => {
    const q = createPendingQueue();
    expect(() => q.reject('missing', 'x')).not.toThrow();
  });

  test('rejectAll rejects every pending promise with the same reason', async () => {
    const q = createPendingQueue();
    const a = q.create('1');
    const b = q.create('2');
    const reason = new DOMException('closed', 'AbortError');
    q.rejectAll(reason);
    await expect(a.promise).rejects.toBe(reason);
    await expect(b.promise).rejects.toBe(reason);
  });

  test('task is removed from queue after settle', async () => {
    const q = createPendingQueue();
    const { id, promise } = q.create('1');
    q.resolve(id, 1);
    await promise;
    // 已删除，再次操作不再影响已 settle 的 promise
    q.reject(id, 'late');
    await expect(promise).resolves.toBe(1);
  });
});
