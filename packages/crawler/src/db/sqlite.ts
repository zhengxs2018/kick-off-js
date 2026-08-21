import type { DBAdapter, Data, FindOptions, Where } from './adapter.js';
import type { DBSchema, DBFieldAttribute } from './schema.js';
import { SchemaValidationError } from '../common/errors.js';

/**
 * sqlite 最小驱动抽象
 *
 * - 绑定参数以 `ReadonlyArray<unknown>` 传入，由实现方内部适配自身绑定类型
 * - `run` 返回受影响行数
 */
export interface SQLiteDatabaseLike {
  exec(sql: string): void;
  run(sql: string, params: ReadonlyArray<unknown>): number;
  all(sql: string, params: ReadonlyArray<unknown>): Array<Record<string, unknown>>;
  close(): void;
}

/**
 * 由 sqlite 驱动创建 DBAdapter
 *
 * @param driver - sqlite 驱动实现
 * @param schema - 可选，传入则按字段校验；不传则不做字段校验
 */
export function createSqliteAdapter(
  driver: SQLiteDatabaseLike,
  schema?: DBSchema  ,
): DBAdapter {
  const schemas = new Map<string, Set<string>>();

  const fieldsByTable = new Map<string, Record<string, DBFieldAttribute>>();
  if (schema !== undefined) {
    for (const [key, model] of Object.entries(schema)) {
      const table = model.modelName !== undefined ? model.modelName : key;
      fieldsByTable.set(table, model.fields);
    }
  }
  let seq = 0;

  function ensureTable(model: string): void {
    if (schemas.has(model)) return;
    driver.exec(`CREATE TABLE IF NOT EXISTS "${model}" (id TEXT PRIMARY KEY)`);
    schemas.set(model, new Set(['id']));
  }

  function ensureColumns(model: string, data: Record<string, unknown>): void {
    const cols = schemas.get(model);
    if (!cols) return;
    for (const key of Object.keys(data)) {
      if (cols.has(key)) continue;
      driver.exec(`ALTER TABLE "${model}" ADD COLUMN "${safeColumn(key)}"`);
      cols.add(key);
    }
  }

  /** 序列化值：对象/数组转 JSON 文本，标量原样 */
  function encode(value: unknown): unknown {
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return value;
  }

  /** 反序列化读出的行：JSON 文本还原为对象（若形似 JSON） */
  function decode(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === 'string' && looksLikeJson(v) ? JSON.parse(v) : v;
    }
    return out;
  }

  function looksLikeJson(s: string): boolean {
    const t = s.trim();
    return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
  }

  function safeColumn(field: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
      throw new Error(`invalid column name: ${field}`);
    }
    return field;
  }

  /** 由 Where 构造 SQL 片段与参数 */
  function buildWhere(where: readonly Where[], params: Array<unknown>): string {
    if (!where || where.length === 0) return '';
    const clauses = where.map(w => {
      const col = `"${safeColumn(w.field)}"`;
      const op = w.operator;
      const kind = op !== undefined ? op.op : 'eq';
      if (kind === 'isNull') {
        params.push(null);
        return `${col} IS NULL`;
      }
      const expected = op !== undefined && op.op !== 'isNull' ? op.value : w.value;
      switch (kind) {
        case 'eq':
          params.push(encode(expected));
          return `${col} = ?`;
        case 'ne':
          params.push(encode(expected));
          return `${col} != ?`;
        case 'in': {
          const list = expected as readonly unknown[];
          params.push(...list.map(encode));
          return `${col} IN (${list.map(() => '?').join(', ')})`;
        }
        case 'gt':
          params.push(encode(expected));
          return `${col} > ?`;
        case 'gte':
          params.push(encode(expected));
          return `${col} >= ?`;
        case 'lt':
          params.push(encode(expected));
          return `${col} < ?`;
        case 'lte':
          params.push(encode(expected));
          return `${col} <= ?`;
      }
    });
    return `WHERE ${clauses.join(' AND ')}`;
  }

  return {
    async create<T = Data>(model: string, data: Partial<Omit<T, 'id'>>): Promise<{ id: string }> {
      ensureTable(model);
      const source = validateWrite(fieldsByTable.get(model), data as Record<string, unknown>, true);
      const id = typeof source.id === 'string' ? source.id : String(++seq);
      const row: Record<string, unknown> = { ...source, id };
      ensureColumns(model, row);
      const cols = schemas.get(model)!;
      const names = [...cols];
      const placeholders = names.map(() => '?').join(', ');
      driver.run(
        `INSERT OR REPLACE INTO "${model}" (${names.map(safeColumn).join(', ')}) VALUES (${placeholders})`,
        names.map(n => encode(row[n])),
      );
      return { id };
    },
    async findOne<T = Data>(model: string, where: readonly Where[]): Promise<T | undefined> {
      ensureTable(model);
      const params: Array<unknown> = [];
      const rows = driver.all(
        `SELECT * FROM "${model}" ${buildWhere(where, params)} LIMIT 1`,
        params,
      );
      const first = rows[0];
      return first ? (validateRead(fieldsByTable.get(model), decode(first)) as T) : undefined;
    },
    async findMany<T = Data>(model: string, opts?: FindOptions): Promise<Array<T>> {
      ensureTable(model);
      const params: Array<unknown> = [];
      const where = buildWhere(opts?.where ?? [], params);
      const order = opts?.orderBy
        ? `ORDER BY "${safeColumn(opts.orderBy.field)}" ${opts.orderBy.dir === 'desc' ? 'DESC' : 'ASC'}`
        : '';
      const limit = opts?.limit !== undefined ? `LIMIT ${opts.limit}` : '';
      const rows = driver.all(`SELECT * FROM "${model}" ${where} ${order} ${limit}`.trim(), params);
      return rows.map(r => validateRead(fieldsByTable.get(model), decode(r)) as T);
    },
    async count(model, where) {
      ensureTable(model);
      const params: Array<unknown> = [];
      const rows = driver.all(
        `SELECT COUNT(*) AS n FROM "${model}" ${buildWhere(where ?? [], params)}`.trim(),
        params,
      );
      return Number(rows[0]?.n ?? 0);
    },
    async update<T = Data>(
      model: string,
      where: readonly Where[],
      patch: Partial<T>,
    ): Promise<number> {
      const params: Array<unknown> = [];
      const source = validateWrite(
        fieldsByTable.get(model),
        patch as Record<string, unknown>,
        false,
      );
      ensureColumns(model, source);
      const setSql = Object.keys(source)
        .map(k => {
          params.push(encode(source[k]));
          return `"${safeColumn(k)}" = ?`;
        })
        .join(', ');
      const whereSql = buildWhere(where, params);
      return driver.run(`UPDATE "${model}" SET ${setSql} ${whereSql}`.trim(), params);
    },
    async delete(model, where) {
      const params: Array<unknown> = [];
      const whereSql = buildWhere(where ?? [], params);
      return driver.run(`DELETE FROM "${model}" ${whereSql}`.trim(), params);
    },
  };

  function validateWrite(
    fields: Record<string, DBFieldAttribute> | undefined,
    row: Record<string, unknown>,
    isCreate: boolean,
  ): Record<string, unknown> {
    if (fields === undefined) return row;
    for (const [name, attr] of Object.entries(fields)) {
      const value = row[name];
      if (value === undefined) {
        if (isCreate && attr.defaultValue !== undefined) {
          row[name] = attr.defaultValue;
          continue;
        }
        if (isCreate && attr.required) {
          throw new SchemaValidationError([{ message: `missing required field "${name}"` }], row);
        }
        continue;
      }
      if (attr.validator?.input !== undefined) {
        const result = attr.validator.input['~standard'].validate(value);
        if (result.issues !== undefined) throw new SchemaValidationError(result.issues, value);
        row[name] = result.value;
      }
    }
    return row;
  }

  function validateRead(
    fields: Record<string, DBFieldAttribute> | undefined,
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    if (fields === undefined) return row;
    for (const [name, attr] of Object.entries(fields)) {
      if (attr.validator?.output !== undefined) {
        const value = row[name];
        const result = attr.validator.output['~standard'].validate(value);
        if (result.issues !== undefined) throw new SchemaValidationError(result.issues, value);
        row[name] = result.value;
      }
    }
    return row;
  }
}
