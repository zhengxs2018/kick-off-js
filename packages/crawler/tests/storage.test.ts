import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import {
  createJsonlStorage,
  createMemoryStorage,
  createMemoryKeyValueStorage,
} from '../src/storage/index.js';
import { SchemaValidationError } from '../src/common/errors.js';
import type { StandardSchemaV1 } from '../src/common/schema.js';

const rowSchema: StandardSchemaV1<unknown, { id: string; name: string }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate(value) {
      if (typeof value !== 'object' || value === null) {
        return { issues: [{ message: 'must be object' }] };
      }
      const v = value as Record<string, unknown>;
      if (typeof v.id !== 'string' || typeof v.name !== 'string') {
        return { issues: [{ message: 'id/name must be string' }] };
      }
      return { value: v as { id: string; name: string } };
    },
  },
};

describe('createMemoryStorage', () => {
  it('不传 schema 直接放行任意结构', async () => {
    const store = createMemoryStorage();
    await store.write({ anything: 1 });
    await store[Symbol.asyncDispose]();
  });

  it('传 schema 校验通过', async () => {
    const store = createMemoryStorage(rowSchema);
    await store.write({ id: '1', name: 'a' });
    await store[Symbol.asyncDispose]();
  });

  it('传 schema 校验失败抛 SchemaValidationError', async () => {
    const store = createMemoryStorage(rowSchema);
    let threw = false;
    try {
      await store.write({ id: 1, name: 'a' } as never);
    } catch (e) {
      threw = true;
      expect((e as Error).message).toContain('Schema validation failed');
    }
    expect(threw).toBe(true);
  });
});

describe('createJsonlStorage', () => {
  it('不传 schema 直接落盘任意结构', async () => {
    const file = join(tmpdir(), `crawler-jsonl-${randomUUID()}.jsonl`);
    const store = createJsonlStorage(file);
    await store.write({ hello: 'world' });
    await store[Symbol.asyncDispose]();
    const text = await Bun.file(file).text();
    expect(text.trim()).toBe(JSON.stringify({ hello: 'world' }));
    await Bun.file(file).delete();
  });

  it('传 schema 校验通过并落盘', async () => {
    const file = join(tmpdir(), `crawler-jsonl-${randomUUID()}.jsonl`);
    const store = createJsonlStorage(file, rowSchema);
    await store.write({ id: 'x', name: 'y' });
    await store[Symbol.asyncDispose]();
    const text = await Bun.file(file).text();
    expect(text.trim()).toBe(JSON.stringify({ id: 'x', name: 'y' }));
    await Bun.file(file).delete();
  });

  it('传 schema 校验失败抛 SchemaValidationError（不落盘）', async () => {
    const file = join(tmpdir(), `crawler-jsonl-${randomUUID()}.jsonl`);
    const store = createJsonlStorage(file, rowSchema);
    let threw = false;
    try {
      await store.write({ id: 'x' } as never);
    } catch (e) {
      threw = true;
      expect((e as Error).message).toContain('Schema validation failed');
    }
    expect(threw).toBe(true);
    await store[Symbol.asyncDispose]().catch(() => undefined);
    const exists = await Bun.file(file).exists();
    if (exists) await Bun.file(file).delete();
  });
});

describe('createMemoryKeyValueStorage', () => {
  it('get/set/delete/has/clear 基础语义', async () => {
    const kv = createMemoryKeyValueStorage();
    expect(await kv.get('k')).toBeUndefined();
    expect(await kv.has('k')).toBe(false);
    await kv.set('k', { a: 1 });
    expect(await kv.has('k')).toBe(true);
    expect(await kv.get('k')).toEqual({ a: 1 });
    await kv.delete('k');
    expect(await kv.has('k')).toBe(false);
    await kv.set('x', 1);
    await kv.clear();
    expect(await kv.has('x')).toBe(false);
  });
});
