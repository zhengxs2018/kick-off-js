import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue, DatabaseSyncOptions } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DBAdapter } from '../../db/adapter.js';
import { createSqliteAdapter } from '../../db/sqlite.js';
import type { SQLiteDatabaseLike } from '../../db/sqlite.js';

/**
 * 创建 node sqlite DBAdapter
 *
 * @param source - 数据库文件路径（默认 `:memory:`）或已有 DatabaseSync 实例
 * @param options - node:sqlite 打开选项（仅路径时有效）
 */
export function createNodeSqliteAdapter(
  source?: string | DatabaseSync,
  options?: DatabaseSyncOptions,
): DBAdapter {
  return createSqliteAdapter(toDriver(resolveDb(source, options)));
}

function resolveDb(source?: DatabaseSync | string, options?: DatabaseSyncOptions): DatabaseSync {
  if (typeof source === 'string' || !source) {
    const filename = source || ':memory:';
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true });
    }

    const db = new DatabaseSync(filename, options);

    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');

    return db;
  }

  return source;
}

/** 把 node DatabaseSync 适配为 runtime 无关的 SQLiteDatabaseLike */
function toDriver(db: DatabaseSync): SQLiteDatabaseLike {
  return {
    exec(sql) {
      db.exec(sql);
    },
    run(sql, params) {
      const result = db.prepare(sql).run(...(params as Array<SQLInputValue>));
      return Number(result.changes);
    },
    all(sql, params) {
      return db.prepare(sql).all(...(params as Array<SQLInputValue>)) as Array<
        Record<string, unknown>
      >;
    },
    close() {
      db.close();
    },
  };
}
