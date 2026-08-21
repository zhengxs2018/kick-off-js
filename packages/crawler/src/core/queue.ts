export function createQueue<Item extends QueueItemFields>(
  name: string,
  store: ItemStore<Item>,
  maxItems: number,
): Queue<Item> {
  /** 活跃 pending 实体，长度 ≤ maxItems */
  const active: Item[] = [];
  /** 活跃索引（id → 活跃 item，仅 pending/processing） */
  const index = new Map<string, Item>();
  /** 已完成 id 集合（仅承载「done 不重入」语义） */
  const doneIds = new Set<string>();
  /** 在途落盘 Promise */
  const persists = new Set<Promise<unknown>>();

  /** 失败计数（failed 允许重入，仅观测用） */
  let failedCount = 0;
  /** fillWindow 互斥链：单 Promise 串行化 */
  let fillChain: Promise<unknown> = Promise.resolve();
  let waiters: Array<() => void> = [];
  let loaded = false;

  return {
    get name() {
      return name;
    },
    enqueue,
    take,
    commit,
    fail,
    recover,
    fillWindow,
    size,
    nextChange,
    flush,
  };

  function notify(): void {
    const ws = waiters;
    waiters = [];
    for (const w of ws) w();
  }

  function nextChange(): Promise<void> {
    return new Promise<void>(resolve => {
      waiters.push(resolve);
    });
  }

  function track(p: Promise<unknown>): void {
    persists.add(p);
    p.finally(() => persists.delete(p)).catch(() => {
      // 落盘失败不应阻塞调度；由 flush 暴露
    });
  }

  function persistInsert(item: Item, id: string): void {
    track(store.writeInsert(item, id));
  }

  function persistState(id: string, patch: Partial<QueueItemFields>): void {
    track(store.writeState(id, patch));
  }

  function computeSize(): QueueSize {
    let pending = 0;
    let processing = 0;
    for (const it of index.values()) {
      if (it.state === 'pending') pending++;
      else if (it.state === 'processing') processing++;
    }
    return {
      pending,
      processing,
      done: doneIds.size,
      failed: failedCount,
      total: index.size + doneIds.size + failedCount,
    };
  }

  function enqueue(input: EnqueueInput<Item>): void {
    const now = Date.now();
    // id：外部显式传则用于去重；否则 randomUUID 兜底。
    const id = Object.hasOwn(input, 'id') ? input.id! : crypto.randomUUID();
    const item = { createdAt: now, ...input, id } as Item;
    const existing = index.get(id);
    // 去重：已存在且非 failed 不重入；done 视为幂等终态亦不重入。
    if ((existing && existing.state !== 'failed') || doneIds.has(id)) return;
    item.state = 'pending';
    item.createdAt = existing?.createdAt !== undefined ? existing.createdAt : now;
    item.updatedAt = now;
    index.set(id, item);
    // 内存未满则入 active，否则仅落存储（由 fillWindow 适时读回）。
    if (active.length < maxItems) {
      active.push(item);
    }
    persistInsert(item, id);
    notify();
  }

  function take(): Item | null {
    while (active.length > 0) {
      const item = active.shift()!;
      if (item.state !== 'pending') continue;
      item.state = 'processing';
      item.updatedAt = Date.now();
      persistState(item.id, { state: 'processing', updatedAt: item.updatedAt });
      notify();
      return item;
    }
    return null;
  }

  function commit(id: string): void {
    const item = index.get(id);
    if (!item) return;
    item.state = 'done';
    item.finishedAt = Date.now();
    item.updatedAt = item.finishedAt;
    persistState(id, { state: 'done', finishedAt: item.finishedAt, updatedAt: item.updatedAt });
    // 终态出 index，done 幂等去重移交 doneIds。
    doneIds.add(id);
    index.delete(id);
    notify();
  }

  function fail(id: string, error: string): void {
    const item = index.get(id);
    if (!item) return;
    item.state = 'failed';
    item.error = error;
    item.finishedAt = Date.now();
    item.updatedAt = item.finishedAt;
    persistState(id, {
      state: 'failed',
      error,
      finishedAt: item.finishedAt,
      updatedAt: item.updatedAt,
    });
    // 终态出 index；failed 允许重入故不进 doneIds。
    failedCount++;
    index.delete(id);
    notify();
  }

  /**
   * 从存储取最早 pending 补足 active 到 maxItems 缺额。
   */
  function fillWindow(signal: AbortSignal): Promise<number> {
    async function run(): Promise<number> {
      if (signal.aborted) return 0;
      const activePending = active.length;
      const quota = maxItems - activePending;
      if (quota <= 0) return 0;
      // 由存储层排序截断，不拉全量。
      const rows = await store.readPending(name, maxItems);
      let filled = 0;
      for (const row of rows) {
        if (signal.aborted) break;
        if (filled >= quota) break;
        const id = row.id;
        if (active.some(a => a.id === id)) continue;
        // 已 done 的 id 其存储旧 pending 快照不应再物化回 active（会导致已 commit 任务重复执行）。
        if (doneIds.has(id)) continue;
        const existing = index.get(id);
        if (existing && existing.state !== 'pending') continue;
        active.push(row);
        index.set(id, row);
        filled++;
      }
      if (filled > 0) notify();
      return filled;
    }
    const next = fillChain.then(run);
    fillChain = next.catch(() => undefined);
    return next;
  }

  /** 从存储重建索引：加载活跃态 + processing 回滚为 pending */
  async function recover(signal: AbortSignal): Promise<void> {
    if (loaded) return;
    loaded = true;
    const rows = await store.readPending(name, Number.MAX_SAFE_INTEGER);
    for (const row of rows) {
      if (signal.aborted) break;
      index.set(row.id, row);
    }
    // 残留 processing 回滚为 pending。
    for (const item of index.values()) {
      if (item.state === 'processing') {
        item.state = 'pending';
        item.updatedAt = Date.now();
        persistState(item.id, { state: 'pending', updatedAt: item.updatedAt });
      }
    }
    await fillWindow(signal);
  }

  function size(): QueueSize {
    return computeSize();
  }

  function flush(): Promise<void> {
    return Promise.all(persists).then(() => undefined);
  }
}

export interface QueueItemFields {
  id: string;

  name: string;

  state: 'pending' | 'processing' | 'done' | 'failed';

  createdAt: number;

  updatedAt: number;

  finishedAt?: number;

  error?: string;
}

export type EnqueueInput<Item extends QueueItemFields> = Partial<Item> & { name: string };

export interface QueueSize {
  pending: number;
  processing: number;
  done: number;
  failed: number;
  total: number;
}

export interface Queue<Item extends QueueItemFields> {
  name: string;

  /** 入队一条 item */
  enqueue(item: EnqueueInput<Item>): void;

  /**
   * 取一条活跃 pending 并标 processing
   *
   * @returns 条目或 null
   */
  take(): Item | null;

  /**
   * 标记为 done
   *
   * @param id - 主键
   */
  commit(id: string): void;

  /**
   * 标记为 failed
   *
   * @param id - 主键
   */
  fail(id: string, error: string): void;

  /**
   * 从存储重建索引
   *
   * @param signal - 取消信号
   */
  recover(signal: AbortSignal): Promise<void>;

  /**
   * 补足 active 到 maxItems
   *
   * @param signal - 取消信号
   */
  fillWindow(signal: AbortSignal): Promise<number>;

  /**
   * 返回统计
   *
   * @returns 计数视图
   */
  size(): QueueSize;

  /** 等待一次状态变化 */
  nextChange(): Promise<void>;

  /** 等待在途落盘完成 */
  flush(): Promise<void>;
}

/** 队列存储最小访问面 */
interface ItemStore<Item extends QueueItemFields> {
  readPending(name: string, limit: number): Promise<ReadonlyArray<Item>>;
  readById(id: string): Promise<Item | undefined>;
  writeInsert(item: Item, id: string): Promise<string>;
  writeState(id: string, patch: Partial<QueueItemFields>): Promise<void>;
}
