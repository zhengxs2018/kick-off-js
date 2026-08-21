import { Database } from 'bun:sqlite';
import type { SQLQueryBindings, DatabaseOptions } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DBAdapter } from '../../db/adapter.js';
import { createSqliteAdapter } from '../../db/sqlite.js';
import type { SQLiteDatabaseLike } from '../../db/sqlite.js';

/**
 * 创建 bun sqlite DBAdapter
 *
 * @param source - 数据库文件名或已有实例，默认 `:memory:`
 * @param options - 打开选项或超时毫秒（仅字符串路径时有效）
 */
export function createBunSqliteAdapter(
  source?: Database | string,
  options?: number | DatabaseOptions,
): DBAdapter {
  return createSqliteAdapter(toDriver(resolveDb(source, options)));
}

function resolveDb(source?: Database | string, options?: number | DatabaseOptions): Database {
  if (typeof source === 'string' || !source) {
    const filename = source || ':memory:';
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true });
    }

    const db = new Database(filename, options);

    db.run('PRAGMA foreign_keys = ON;');
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA synchronous = NORMAL;');

    return db;
  }

  return source;
}

/** 把 bun Database 适配为 runtime 无关的 SQLiteDatabaseLike */
function toDriver(db: Database): SQLiteDatabaseLike {
  return {
    exec(sql) {
      db.run(sql);
    },
    run(sql, params) {
      const result = db.query(sql).run(...(params as Array<SQLQueryBindings>));
      return Number(result.changes);
    },
    all(sql, params) {
      return db.query(sql).all(...(params as Array<SQLQueryBindings>)) as unknown as Array<
        Record<string, unknown>
      >;
    },
    close() {
      db.close();
    },
  };
}
