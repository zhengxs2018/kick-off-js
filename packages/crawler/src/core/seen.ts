/**
 * 去重集合契约。用于跨请求去重（如已访问 URL 集合），实现可替换（内存/外部存储）。
 */
export interface SeenSet {
  has(key: string): boolean;
  add(key: string): void;
}

export interface MemorySeenSetOptions {
  /** 是否启用 LRU 淘汰（当前实现按插入顺序淘汰最旧条目） */
  lru?: boolean;
  /** 容量上限；>0 时超出淘汰最旧条目，0 表示不限制 */
  maxSize?: number;
}

/**
 * 创建内存去重集合。
 *
 * @returns 满足 SeenSet 契约的实例
 */
export function createMemorySeenSet(options: MemorySeenSetOptions = {}): SeenSet {
  const { maxSize = 0 } = options;
  const keys = new Set<string>();
  return {
    has(key) {
      return keys.has(key);
    },
    add(key) {
      keys.add(key);
      if (maxSize > 0 && keys.size > maxSize) {
        const first = keys.values().next().value;
        if (first !== undefined) keys.delete(first);
      }
    },
  };
}
