import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';

import { createMemoryAdapter, createSqliteAdapter } from '../src/db/index.js';
import type { DBAdapter } from '../src/db/adapter.js';
import type { DBSchema } from '../src/db/schema.js';
import type { SQLiteDatabaseLike } from '../src/db/sqlite.js';
import { SchemaValidationError } from '../src/common/errors.js';
import type { StandardSchemaV1 } from '../src/common/schema.js';

/** 非空字符串校验（自定义 StandardSchemaV1 实现，无第三方依赖） */
const nonEmptyString: StandardSchemaV1<unknown, string> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate(value) {
      if (typeof value !== 'string' || value.length === 0) {
        return { issues: [{ message: 'must be non-empty string' }] };
      }
      return { value };
    },
  },
};

/** 把数字翻倍（演示 input 转换） */
const doubleNumber: StandardSchemaV1<unknown, number> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate(value) {
      if (typeof value !== 'number') return { issues: [{ message: 'must be number' }] };
      return { value: value * 2 };
    },
  },
};

const schema: DBSchema = {
  users: {
    fields: {
      name: { type: 'string', required: true, validator: { input: nonEmptyString } },
      score: { type: 'number', defaultValue: 0, validator: { input: doubleNumber } },
      tag: { type: 'string', defaultValue: 'guest' },
    },
  },
};

function bunSqliteDriver(): SQLiteDatabaseLike {
  const db = new Database(':memory:');
  return {
    exec: sql => db.exec(sql),
    run: (sql, params) => db.run(sql, ...params).changes ?? 0,
    all: (sql, params) => db.query(sql).all(...params) as Array<Record<string, unknown>>,
    close: () => db.close(),
  };
}

function makeAdapters(): Array<{ label: string; db: DBAdapter }> {
  return [
    { label: 'memory', db: createMemoryAdapter() },
    { label: 'sqlite', db: createSqliteAdapter(bunSqliteDriver()) },
  ];
}

describe('db adapter CRUD（memory + sqlite 共用断言）', () => {
  for (const { label, db } of makeAdapters()) {
    describe(label, () => {
      it('create 返回 id，findOne 可取回', async () => {
        const { id } = await db.create('items', { name: 'a' });
        expect(typeof id).toBe('string');
        const row = await db.findOne('items', [{ field: 'id', value: id }]);
        expect(row?.name).toBe('a');
      });

      it('findMany 返回全部，count 计数', async () => {
        await db.create('items', { name: 'x' });
        await db.create('items', { name: 'y' });
        const all = await db.findMany('items');
        expect(all.length).toBeGreaterThanOrEqual(2);
        expect(await db.count('items')).toBe(all.length);
      });

      it('where 过滤（eq / ne / in / gt / gte / lt / lte / isNull）', async () => {
        for (const n of [1, 2, 3, 4]) await db.create('nums', { v: n });
        expect(await db.count('nums', [{ field: 'v', operator: { op: 'eq', value: 2 } }])).toBe(1);
        expect(await db.count('nums', [{ field: 'v', operator: { op: 'ne', value: 2 } }])).toBe(3);
        expect(
          await db.count('nums', [{ field: 'v', operator: { op: 'in', value: [1, 3] } }]),
        ).toBe(2);
        expect(await db.count('nums', [{ field: 'v', operator: { op: 'gt', value: 2 } }])).toBe(2);
        expect(await db.count('nums', [{ field: 'v', operator: { op: 'gte', value: 2 } }])).toBe(3);
        expect(await db.count('nums', [{ field: 'v', operator: { op: 'lt', value: 3 } }])).toBe(2);
        expect(await db.count('nums', [{ field: 'v', operator: { op: 'lte', value: 3 } }])).toBe(3);
        await db.create('nums', { v: null });
        expect(await db.count('nums', [{ field: 'v', operator: { op: 'isNull' } }])).toBe(1);
      });

      it('orderBy 排序与 limit 截断', async () => {
        for (const n of [3, 1, 2]) await db.create('ords', { v: n });
        const asc = await db.findMany('ords', { orderBy: { field: 'v', dir: 'asc' }, limit: 2 });
        expect(asc.map(r => r.v)).toEqual([1, 2]);
        const desc = await db.findMany('ords', { orderBy: { field: 'v', dir: 'desc' } });
        expect(desc[0]!.v).toBe(3);
      });

      it('update 按 where 更新，delete 按 where 删除', async () => {
        const { id } = await db.create('upd', { name: 'old' });
        const n = await db.update('upd', [{ field: 'id', value: id }], { name: 'new' });
        expect(n).toBe(1);
        expect((await db.findOne('upd', [{ field: 'id', value: id }]))?.name).toBe('new');
        const d = await db.delete('upd', [{ field: 'id', value: id }]);
        expect(d).toBe(1);
        expect(await db.findOne('upd', [{ field: 'id', value: id }])).toBeUndefined();
      });

      it('delete 无 where 清空该表', async () => {
        await db.create('clr', { name: 'a' });
        await db.create('clr', { name: 'b' });
        await db.delete('clr');
        expect(await db.count('clr')).toBe(0);
      });

      it('json / 数组字段往返', async () => {
        const data = { nested: { a: 1 }, list: [1, 2, 3] };
        const { id } = await db.create('obj', { payload: data });
        const row = await db.findOne('obj', [{ field: 'id', value: id }]);
        expect(row?.payload).toEqual(data);
      });
    });
  }
});

describe('db adapter + schema 校验（memory + sqlite 共用断言）', () => {
  for (const { label, db } of [
    { label: 'memory', db: createMemoryAdapter(schema) },
    { label: 'sqlite', db: createSqliteAdapter(bunSqliteDriver(), schema) },
  ]) {
    describe(label, () => {
      it('required 缺失抛 SchemaValidationError', async () => {
        await expect(db.create('users', {} as never)).rejects.toBeInstanceOf(SchemaValidationError);
      });

      it('字段经 input validator 转换后落盘', async () => {
        const { id } = await db.create('users', { name: 'alice' });
        const row = (await db.findOne('users', [{ field: 'id', value: id }])) as Record<
          string,
          unknown
        >;
        // score 未传 → defaultValue 0；tag 未传 → defaultValue guest
        expect(row.score).toBe(0);
        expect(row.tag).toBe('guest');
        // name 经 validator 保持字符串
        expect(row.name).toBe('alice');
      });

      it('input validator 校验失败抛 SchemaValidationError', async () => {
        await expect(db.create('users', { name: '' } as never)).rejects.toBeInstanceOf(
          SchemaValidationError,
        );
      });

      it('update 同样经 input validator', async () => {
        const { id } = await db.create('users', { name: 'bob' });
        await db.update('users', [{ field: 'id', value: id }], { score: 5 });
        const row = (await db.findOne('users', [{ field: 'id', value: id }])) as Record<
          string,
          unknown
        >;
        expect(row.score).toBe(10); // 5 * 2
      });
    });
  }
});

describe('db adapter 无 schema 时不做校验', () => {
  it('memory 无 schema 接受任意结构', async () => {
    const db = createMemoryAdapter();
    const { id } = await db.create('free', { name: '', score: 'any' });
    const row = await db.findOne('free', [{ field: 'id', value: id }]);
    expect(row?.score).toBe('any');
  });
});
