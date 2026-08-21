import { Database } from 'bun:sqlite';
import type { SeenSet } from '../../core/seen.js';

/**
 * 创建基于 bun:sqlite 的去重集合
 *
 * @param db - bun:sqlite 数据库连接
 * @param table - 表名（自动 CREATE IF NOT EXISTS）
 */
export function createBunSqliteSeenSet(db: Database, table: string): SeenSet {
  db.run(`CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY)`);

  const hasStmt = db.query(`SELECT 1 FROM ${table} WHERE key=?`);
  const addStmt = db.query(`INSERT OR IGNORE INTO ${table} (key) VALUES (?)`);

  return {
    has(key) {
      return hasStmt.get(key) !== undefined;
    },
    add(key) {
      addStmt.run(key);
    },
  };
}
