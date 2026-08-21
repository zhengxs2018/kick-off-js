import { describe, expect, it } from 'bun:test';

import { createMemorySeenSet } from '../src/core/seen.js';
import { createSemaphore } from '../src/core/semaphore.js';
import { createQueue } from '../src/core/queue.js';
import { createLogger } from '../src/common/logger.js';
import type { QueueItemFields } from '../src/core/queue.js';

type Item = QueueItemFields;

function memStore() {
  const items = new Map<string, Item>();
  return {
    items,
    async readPending(name: string, limit: number): Promise<ReadonlyArray<Item>> {
      return [...items.values()]
        .filter(i => i.name === name && i.state === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, limit);
    },
    async readById(id: string): Promise<Item | undefined> {
      return items.get(id);
    },
    async writeInsert(item: Item, id: string): Promise<string> {
      items.set(id, { ...item, id });
      return id;
    },
    async writeState(id: string, patch: Partial<QueueItemFields>): Promise<void> {
      const it = items.get(id);
      if (it) Object.assign(it, patch);
    },
  };
}

describe('createMemorySeenSet', () => {
  it('has/add 基础去重', () => {
    const seen = createMemorySeenSet();
    expect(seen.has('a')).toBe(false);
    seen.add('a');
    expect(seen.has('a')).toBe(true);
  });

  it('maxSize > 0 时超出淘汰最旧条目', () => {
    const seen = createMemorySeenSet({ maxSize: 2 });
    seen.add('1');
    seen.add('2');
    seen.add('3');
    expect(seen.has('1')).toBe(false);
    expect(seen.has('3')).toBe(true);
  });
});

describe('createSemaphore', () => {
  it('limit 内 acquire 立即取到许可', async () => {
    const sem = createSemaphore(2);
    expect(await sem.acquire()).toBe(true);
    expect(await sem.acquire()).toBe(true);
  });

  it('超出 limit 时等待，release 后唤醒', async () => {
    const sem = createSemaphore(1);
    expect(await sem.acquire()).toBe(true);
    const waiting = sem.acquire();
    sem.release();
    expect(await waiting).toBe(true);
  });

  it('已 abort 的 signal acquire 立即返回 false', async () => {
    const sem = createSemaphore(0);
    expect(await sem.acquire(AbortSignal.abort())).toBe(false);
  });

  it('等待中被 abort 返回 false 且不再取许可', async () => {
    const sem = createSemaphore(1);
    await sem.acquire();
    const controller = new AbortController();
    const waiting = sem.acquire(controller.signal);
    controller.abort();
    expect(await waiting).toBe(false);
  });
});

describe('createQueue', () => {
  it('enqueue 入队，take 取为 processing，commit 标记 done', () => {
    const q = createQueue<Item>('q1', memStore(), 10);
    q.enqueue({ id: '1', name: 'q1' });
    expect(q.size().pending).toBe(1);
    const item = q.take();
    expect(item?.id).toBe('1');
    expect(item?.state).toBe('processing');
    expect(q.size().processing).toBe(1);
    q.commit('1');
    expect(q.size().done).toBe(1);
    expect(q.size().total).toBe(1);
  });

  it('重复 id 去重，done 不重入', () => {
    const q = createQueue<Item>('q1', memStore(), 10);
    q.enqueue({ id: '1', name: 'q1' });
    q.enqueue({ id: '1', name: 'q1' });
    expect(q.size().pending).toBe(1);
    q.take();
    q.commit('1');
    q.enqueue({ id: '1', name: 'q1' });
    expect(q.size().done).toBe(1);
    expect(q.size().pending).toBe(0);
  });

  it('fail 标记失败且允许重入', () => {
    const q = createQueue<Item>('q1', memStore(), 10);
    q.enqueue({ id: '1', name: 'q1' });
    q.take();
    q.fail('1', 'boom');
    expect(q.size().failed).toBe(1);
    q.enqueue({ id: '1', name: 'q1' });
    expect(q.size().pending).toBe(1);
  });

  it('maxItems 限制 active，fillWindow 从存储补足', async () => {
    const store = memStore();
    const q = createQueue<Item>('q1', store, 1);
    q.enqueue({ id: '1', name: 'q1' });
    q.enqueue({ id: '2', name: 'q1' });
    expect(q.take()?.id).toBe('1');
    const filled = await q.fillWindow(AbortSignal.timeout(1000));
    expect(filled).toBe(1);
    expect(q.take()?.id).toBe('2');
  });

  it('recover 从存储重建 active 索引', async () => {
    const store = memStore();
    store.items.set('r1', {
      id: 'r1',
      name: 'q1',
      state: 'pending',
      createdAt: 1,
      updatedAt: 1,
    });
    const q = createQueue<Item>('q1', store, 10);
    await q.recover(AbortSignal.timeout(1000));
    expect(q.take()?.id).toBe('r1');
  });

  it('flush 等待在途落盘完成', async () => {
    const q = createQueue<Item>('q1', memStore(), 10);
    q.enqueue({ id: '1', name: 'q1' });
    await q.flush();
    expect(q.size().pending).toBe(1);
  });

  it('nextChange 在状态变化后 resolve', async () => {
    const q = createQueue<Item>('q1', memStore(), 10);
    const change = q.nextChange();
    q.enqueue({ id: '1', name: 'q1' });
    await expect(change).resolves.toBeUndefined();
  });
});

describe('createLogger', () => {
  it('返回具备四个级别的 logger', () => {
    const logger = createLogger('test');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(() => {
      logger.info('a');
      logger.warn('b');
      logger.error('c');
      logger.debug('d');
    }).not.toThrow();
  });
});
