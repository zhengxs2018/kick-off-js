import type { SchedulerStore } from '../core/scheduler.js';
import { createMemoryAdapter } from '../db/memory.js';
import type { QueueItemFields } from '../core/queue.js';
import type { DBAdapter, Where } from './adapter.js';

/**
 * 从 DBAdapter 构造调度器最小访问面。
 *
 * `scope` 为行级过滤（如 `[{ spiderId: id }]`），读操作恒追加，用于多实例隔离。
 *
 * @param model - 表名
 * @param db - 数据库
 * @param scope - 行级过滤
 */
export function dbToStore<Item extends QueueItemFields>(
  model: string,
  db: DBAdapter = createMemoryAdapter(),
  scope: readonly Where[] = [],
): SchedulerStore<Item> {
  return {
    async readPending(name, limit) {
      const where = scoped([
        { field: 'name', value: name },
        { field: 'state', value: 'pending' },
      ]);
      return (await db.findMany(model, {
        where,
        orderBy: { field: 'createdAt', dir: 'asc' },
        limit,
      })) as Item[];
    },
    async readById(id) {
      return (await db.findOne(model, scoped([{ field: 'id', value: id }]))) as Item | undefined;
    },
    async writeInsert(item, id) {
      const row = { ...item, id } as unknown as Record<string, unknown>;
      await db.create(model, row);
      return id;
    },
    async writeState(id, patch) {
      await db.update(model, [{ field: 'id', value: id }], patch as Record<string, unknown>);
    },
    async writeDelete(id) {
      if (id !== undefined) await db.delete(model, [{ field: 'id', value: id }]);
    },
  };

  function scoped(base: readonly Where[]): readonly Where[] {
    return scope.concat(base);
  }
}
