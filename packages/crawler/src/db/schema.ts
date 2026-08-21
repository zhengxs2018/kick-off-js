import type { StandardSchemaV1 } from '../common/schema.js';

export type DBFieldType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'string[]';

/**
 * 字段定义，携带可选 Standard Schema 校验契约
 */
export interface DBFieldAttribute {
  readonly type: DBFieldType;
  readonly required?: boolean;
  readonly defaultValue?: unknown;
  readonly validator?: {
    readonly input?: StandardSchemaV1;
    readonly output?: StandardSchemaV1;
  };
}

export interface DBModel {
  readonly modelName?: string;
  readonly fields: Record<string, DBFieldAttribute>;
}

export type DBSchema = Record<string, DBModel>;

/**
 * 取模型落地表名
 *
 * @param modelKey - schema 集合键名
 * @returns 显式 modelName 优先，否则用键名
 */
export function resolveModelName(schema: DBSchema, modelKey: string): string {
  return schema[modelKey]?.modelName !== undefined ? schema[modelKey].modelName : modelKey;
}
