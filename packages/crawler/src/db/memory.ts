import type { DBAdapter, Data, FindOptions, Where } from './adapter.js';
import type { DBSchema } from './schema.js';
import { SchemaValidationError } from '../common/errors.js';

/**
 * 内存 db adapter，进程内不持久
 *
 * @param schema - 可选，传入则按字段校验；不传则不做字段校验
 */
export function createMemoryAdapter(schema?: DBSchema  ): DBAdapter {
  const stores = new Map<string, Map<string, Record<string, unknown>>>();

  let seq = 0;

  const fieldsByTable = new Map<string, Record<string, import('./schema.js').DBFieldAttribute>>();
  if (schema !== undefined) {
    for (const [key, model] of Object.entries(schema)) {
      const table = model.modelName !== undefined ? model.modelName : key;
      fieldsByTable.set(table, model.fields);
    }
  }

  function store(model: string): Map<string, Record<string, unknown>> {
    return stores.getOrInsertComputed(model, () => new Map<string, Record<string, unknown>>());
  }

  return {
    async create<T = Data>(model: string, data: Partial<Omit<T, 'id'>>): Promise<{ id: string }> {
      const s = store(model);
      const row = validateWrite(fieldsByTable.get(model), data as Record<string, unknown>, true);
      const id = typeof row.id === 'string' ? row.id : String(++seq);
      s.set(id, { ...row, id });
      return { id };
    },
    async findOne<T = Data>(model: string, where: readonly Where[]): Promise<T | undefined> {
      const s = store(model);
      for (const row of s.values()) {
        if (matchesWhere(row, where)) return validateRead(fieldsByTable.get(model), row) as T;
      }
      return undefined;
    },
    async findMany<T = Data>(model: string, opts?: FindOptions): Promise<Array<T>> {
      const s = store(model);
      let rows = [...s.values()];
      if (opts?.where) rows = rows.filter(r => matchesWhere(r, opts.where!));
      if (opts?.orderBy) {
        const { field, dir } = opts.orderBy;
        rows = rows
          .slice()
          .sort((a, b) => compareUnknown(a[field], b[field]) * (dir === 'desc' ? -1 : 1));
      }
      if (opts?.limit !== undefined) rows = rows.slice(0, opts.limit);
      return rows.map(r => validateRead(fieldsByTable.get(model), r)) as Array<T>;
    },
    async count(model, where) {
      const s = store(model);
      if (!where || where.length === 0) return s.size;
      let n = 0;
      for (const r of s.values()) if (matchesWhere(r, where)) n++;
      return n;
    },
    async update(model, where, patch) {
      const s = store(model);
      const next = validateWrite(fieldsByTable.get(model), patch as Record<string, unknown>, false);
      let n = 0;
      for (const [id, row] of s) {
        if (matchesWhere(row, where)) {
          s.set(id, { ...row, ...next, id });
          n++;
        }
      }
      return n;
    },
    async delete(model, where) {
      const s = store(model);
      if (!where || where.length === 0) {
        const n = s.size;
        s.clear();
        return n;
      }
      let n = 0;
      for (const [id, row] of s) {
        if (matchesWhere(row, where)) {
          s.delete(id);
          n++;
        }
      }
      return n;
    },
  };

  function validateWrite(
    fields: Record<string, import('./schema.js').DBFieldAttribute> | undefined,
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
    fields: Record<string, import('./schema.js').DBFieldAttribute> | undefined,
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

function matchesWhere(row: Record<string, unknown>, where: readonly Where[]): boolean {
  for (const w of where) {
    const actual = row[w.field];
    const op = w.operator;
    const opKind = op !== undefined ? op.op : 'eq';
    if (opKind === 'isNull') {
      if (actual !== undefined && actual !== null) return false;
      continue;
    }
    const expected = op !== undefined && op.op !== 'isNull' ? op.value : w.value;
    switch (opKind) {
      case 'eq':
        if (actual !== expected) return false;
        break;
      case 'ne':
        if (actual === expected) return false;
        break;
      case 'in':
        if (!(expected as unknown[]).includes(actual)) return false;
        break;
      case 'gt':
        if (!(compareUnknown(actual, expected) > 0)) return false;
        break;
      case 'gte':
        if (!(compareUnknown(actual, expected) >= 0)) return false;
        break;
      case 'lt':
        if (!(compareUnknown(actual, expected) < 0)) return false;
        break;
      case 'lte':
        if (!(compareUnknown(actual, expected) <= 0)) return false;
        break;
    }
  }
  return true;
}

function compareUnknown(a: unknown, b: unknown): number {
  const av = a as number;
  const bv = b as number;
  return av < bv ? -1 : av > bv ? 1 : 0;
}
