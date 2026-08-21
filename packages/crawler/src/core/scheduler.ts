import { createQueue } from './queue.js';
import type { EnqueueInput, QueueItemFields, Queue } from './queue.js';
import { createSemaphore } from './semaphore.js';
import type { Semaphore } from './semaphore.js';

/**
 * 队列消费引擎；按 `item.name` 动态路由到对应队列。
 *
 * @typeParam Item - 队列条目类型（须满足 QueueItemFields）
 */
export function createScheduler<Item extends QueueItemFields>(
  opts: SchedulerOptions<Item>,
): Scheduler<Item> {
  const maxTasksCount = Math.max(1, opts.maxTasksCount);
  const queues = new Map<string, Queue<Item>>();

  const activeRuns = new Map<PendingRun, AbortController>();
  const runPromises = new Set<Promise<void>>();

  let pendingRuns: PendingRun[] = [];
  let running = false;

  return {
    push,
    run,
    stop,
    dispose,
    async [Symbol.asyncDispose]() {
      await stop();
    },
  };

  function getQueue(name: string): Queue<Item> {
    return queues.getOrInsertComputed(name, createItemQueue);
  }

  function createItemQueue(name: string): Queue<Item> {
    return createQueue(name, opts.store, opts.maxItems);
  }

  /** enqueue 按 item.name 路由到对应队列（id 缺省由 queue 生成） */
  function makeEnqueue(): ScheduleController['enqueue'] {
    return function (input: Record<string, unknown>): void {
      const name = typeof input.name === 'string' ? input.name : '';
      if (!name) throw new Error('enqueue payload must include a non-empty name');
      getQueue(name).enqueue({ ...input } as unknown as EnqueueInput<Item>);
    };
  }

  async function processItem(item: Item, signal: AbortSignal): Promise<void> {
    const q = getQueue(item.name);

    await opts.handler(item, {
      enqueue: makeEnqueue(),
    });

    q.commit(item.id);

    void signal;
  }

  function process(signal: AbortSignal): Promise<void> {
    const semaphore: Semaphore = createSemaphore(opts.concurrency);

    const inFlight = new Set<Promise<void>>();

    const ts = new TransformStream<Item, Item>({
      async transform(item) {
        const acquired = await semaphore.acquire(signal);
        if (!acquired) return; // 被 abort 唤醒，未取得许可，不 release
        const q = getQueue(item.name);

        async function run(): Promise<void> {
          try {
            await processItem(item, signal);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            try {
              q.fail(item.id, message);
            } catch {
              // 落盘失败不阻断
            }
          } finally {
            // 先归还并发许可：落盘 IO 不再占用并发窗口。
            semaphore.release();
          }
          await q.flush();
        }

        const p = run();
        inFlight.add(p);
        p.finally(() => inFlight.delete(p)).catch(() => {});
      },
      async flush() {},
    });

    const writer = ts.writable.getWriter();
    const reader = ts.readable.getReader();

    const allQueues = () => [...queues.values()];

    async function pump(): Promise<void> {
      try {
        for await (const item of mergeQueues(allQueues, signal)) {
          if (signal.aborted) break;
          await writer.write(item);
        }
        if (!signal.aborted) {
          await writer.close();
        } else {
          await writer.abort();
        }
      } catch {
        // writable 可能已 errored（abort 路径），不再 close
      }
    }

    async function drain(): Promise<void> {
      try {
        for (;;) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }
    }

    const pumpP = pump();
    const drainP = drain();

    return (async () => {
      await Promise.all([pumpP, drainP]);
      await Promise.all(inFlight);
      await Promise.all(allQueues().map(q => q.flush()));
    })();
  }

  async function executeRun(signal: AbortSignal): Promise<void> {
    // 对已创建的队列做 recover（播种产生的队列；若无队列则跳过，等待外部 enqueue 播种）。
    for (const q of queues.values()) {
      await q.recover(signal);
    }

    await process(signal);
  }

  async function run(names?: Iterable<string>): Promise<void> {
    pendingRuns.push(names ? { names } : {});

    if (running) return; // 已在 run 则只排队
    running = true;

    try {
      while (pendingRuns.length) {
        const slice = pendingRuns.splice(0, Math.min(maxTasksCount, pendingRuns.length));
        await Promise.all(slice.map(runSingle));
      }
    } finally {
      running = false;
    }
  }

  async function runSingle(pr: PendingRun): Promise<void> {
    const ac = new AbortController();

    activeRuns.set(pr, ac);

    // 构造注入 signal 与内部 per-run controller 合并：外部 stop 或 crawl 的 controller.abort() 都能中断本轮 run。
    const signal = opts.signal ? AbortSignal.any([ac.signal, opts.signal]) : ac.signal;

    async function run(): Promise<void> {
      try {
        await executeRun(signal);
      } finally {
        activeRuns.delete(pr);
      }
    }

    const p = run();

    runPromises.add(p);

    return p.finally(() => runPromises.delete(p)).catch(() => {});
  }

  function runMatches(pr: PendingRun, target: Set<string>): boolean {
    if (!pr.names) return true; // 空 = 全部
    for (const n of pr.names) if (target.has(n)) return true;
    return false;
  }

  async function stop(names?: Iterable<string>): Promise<void> {
    if (!names) {
      pendingRuns = [];
      for (const [, ac] of activeRuns) ac.abort();
    } else {
      const target = new Set(names);
      pendingRuns = pendingRuns.filter(pr => !runMatches(pr, target));
      for (const [pr, ac] of activeRuns) {
        if (runMatches(pr, target)) ac.abort();
      }
    }
    await Promise.all(runPromises);
  }

  async function push(item: Item): Promise<void> {
    const q = getQueue(item.name);

    q.enqueue(item);

    await q.flush();
  }

  async function dispose(): Promise<void> {
    await stop();
  }
}

/** 等待 abort 触发：abort 时已 resolve，否则监听一次性 abort 事件 */
function abortSignal(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  const { promise, resolve } = Promise.withResolvers<void>();
  signal.addEventListener('abort', () => resolve(), { once: true });
  return promise;
}

/**
 * 竞争式合并所有队列：先 take 活跃 pending，取空后再 fillWindow 从存储补足；
 * 全部队列无在途且无可补足时停机，abort 时提前返回。队列列表每次动态获取，handler 运行中新建的队列也会被覆盖。
 */
async function* mergeQueues<Item extends QueueItemFields>(
  allQueues: () => ReadonlyArray<Queue<Item>>,
  signal: AbortSignal,
): AsyncGenerator<Item> {
  while (!signal.aborted) {
    let produced = false;
    for (const q of allQueues()) {
      if (signal.aborted) return;
      const item = q.take();
      if (item) {
        produced = true;
        yield item;
      }
    }
    if (produced) continue;

    // 无产出：fillWindow 补足（存储读接收 signal）。
    let filled = 0;
    for (const q of allQueues()) {
      if (signal.aborted) return;
      filled += await q.fillWindow(signal);
    }
    if (filled > 0) continue;

    // 补足也无：若所有队列均无 processing，停机；否则等待 processing 终结（可能 re-enqueue）。
    const current = allQueues();
    const idle = current.every(q => q.size().processing === 0);
    if (idle) return;
    await Promise.race([Promise.race(current.map(q => q.nextChange())), abortSignal(signal)]);
  }
}

export interface SchedulerStore<Item extends QueueItemFields> {
  readPending(name: string, limit: number): Promise<ReadonlyArray<Item>>;
  readById(id: string): Promise<Item | undefined>;
  writeInsert(item: Item, id: string): Promise<string>;
  writeState(id: string, patch: Partial<Item>): Promise<void>;
  writeDelete(id?: string): Promise<void>;
}

export interface SchedulerOptions<Item extends QueueItemFields> {
  /** 队列存储访问面 */
  store: SchedulerStore<Item>;

  /** 单队列并发上限 */
  concurrency: number;

  /** 单队列活跃 pending 上限 */
  maxItems: number;

  /** run 启动并发上限 */
  maxTasksCount: number;

  /** 处理每条 item */
  handler(item: Item, controller: ScheduleController): Promise<void>;

  /** 取消信号 */
  signal?: AbortSignal;
}

interface PendingRun {
  readonly names?: Iterable<string>;
}

export interface Scheduler<Item extends QueueItemFields> {
  /**
   * 入队单条
   *
   * @param item - 条目
   */
  push(item: EnqueueInput<Item>): Promise<void>;

  /**
   * 启动调度
   *
   * @param names - 限定队列
   */
  run(names?: Iterable<string>): Promise<void>;

  /**
   * 中断调度
   *
   * @param names - 限定队列
   */
  stop(names?: Iterable<string>): Promise<void>;

  /** 中断并等待收尾 */
  dispose(): Promise<void>;

  [Symbol.asyncDispose](): Promise<void>;
}

export interface ScheduleController<P = Record<string, unknown>> {
  /**
   * 入队一条派发载荷
   *
   * @param payload - 派发载荷
   */
  enqueue(payload: P): void;
}
