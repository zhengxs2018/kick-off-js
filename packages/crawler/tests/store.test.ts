import { describe, expect, it } from 'bun:test';

import { dbToStore } from '../src/db/store.js';
import { createMemoryAdapter } from '../src/db/index.js';
import type { QueueItemFields } from '../src/core/queue.js';

describe('dbToStore', () => {
  it('writeInsert 返回 id，readPending 按 name/state 查询', async () => {
    const db = createMemoryAdapter();
    const store = dbToStore<QueueItemFields>('items', db, []);
    const id = await store.writeInsert(
      { name: 'x', data: { a: 1 }, state: 'pending', createdAt: 1, updatedAt: 1 },
      'i1',
    );
    expect(id).toBe('i1');
    const items = await store.readPending('x', 10);
    expect(items.length).toBe(1);
    expect(items[0]!.id).toBe('i1');
    expect(items[0]!.state).toBe('pending');
    expect(items[0]!.data).toEqual({ a: 1 });
    expect(typeof items[0]!.createdAt).toBe('number');
  });

  it('scope 行级过滤：写入不带 scope 字段则 readPending 不返回', async () => {
    const db = createMemoryAdapter();
    const store = dbToStore<QueueItemFields>('items', db, [{ field: 'parentId', value: 'p1' }]);
    await store.writeInsert(
      { name: 'x', data: {}, state: 'pending', createdAt: 1, updatedAt: 1 },
      'i1',
    );
    const items = await store.readPending('x', 10);
    expect(items).toHaveLength(0);
  });

  it('readById 取单条', async () => {
    const db = createMemoryAdapter();
    const store = dbToStore<QueueItemFields>('items', db, []);
    await store.writeInsert({ name: 'a' }, 'a');
    const one = await store.readById('a');
    expect(one?.id).toBe('a');
  });

  it('writeState 合并 patch，writeDelete 删除', async () => {
    const db = createMemoryAdapter();
    const store = dbToStore<QueueItemFields>('items', db, []);
    await store.writeInsert({ name: 'a' }, 'a');
    await store.writeState('a', { state: 'failed', error: 'x' });
    const one = await store.readById('a');
    expect(one?.state).toBe('failed');
    expect(one?.error).toBe('x');
    await store.writeDelete('a');
    expect(await store.readById('a')).toBeUndefined();
  });
});
