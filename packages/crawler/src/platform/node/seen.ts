import { DatabaseSync } from 'node:sqlite';
import type { SeenSet } from '../../core/seen.js';

export function createNodeSqliteSeenSet(db: DatabaseSync, table: string): SeenSet {
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY)`);
  const hasStmt = db.prepare(`SELECT 1 FROM ${table} WHERE key=?`);
  const addStmt = db.prepare(`INSERT OR IGNORE INTO ${table} (key) VALUES (?)`);
  return {
    has(key) {
      return hasStmt.get(key) !== undefined;
    },
    add(key) {
      addStmt.run(key);
    },
  };
}
