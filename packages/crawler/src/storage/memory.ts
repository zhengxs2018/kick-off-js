import type { StreamStorage } from './stream.js';
import { createStreamStorage } from './stream.js';
import type { KeyValueStorage } from './storage.js';
import type { StandardSchemaV1 } from '../common/schema.js';

/**
 * 创建内存流式存储
 *
 * @param schema - 可选，传入则写入前校验；不传则直接放行
 */
export function createMemoryStorage<T = Record<string, unknown>>(
  schema?: StandardSchemaV1<unknown, T>  ,
): StreamStorage<T> {
  const data = new Set<T>();

  return createStreamStorage<T>(
    {
      write(chunk) {
        data.add(chunk);
      },
      close() {
        data.clear();
      },
    },
    schema,
  );
}

export function createMemoryKeyValueStorage(): KeyValueStorage {
  const map = new Map<string, unknown>();

  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
    async has(key) {
      return map.has(key);
    },
    async clear() {
      map.clear();
    },
  };
}
