import type { Spider } from './spider.js';
import { createLogger } from '../common/logger.js';
import type { Logger } from '../common/logger.js';
import type { DBAdapter } from '../db/adapter.js';
import { createMemoryAdapter } from '../db/memory.js';

const DEFAULT_MAX_SPIDERS = 4;

const DEFAULT_MAX_ITEMS = 200;

const RUNS_MODEL = 'spiders';

/**
 * 创建爬虫运行器
 */
export function createSpiderRunner({
  spiders,
  db = createMemoryAdapter(),
  maxSpidersCount = DEFAULT_MAX_SPIDERS,
  maxSpiderItemsCount = DEFAULT_MAX_ITEMS,
  logger = createLogger('runner'),
}: SpiderRunnerOptions): SpiderRunner {
  const runnings = new Map<string, Map<string, Run>>();
  const spidersMap = new Map<string, Spider>(spiders.map(s => [s.name, s]));

  return {
    start,
    run,
    stop,
    recover,
    getRunStates,
    dispose,
  };

  async function start(namedList?: Iterable<string>): Promise<void> {
    await recover();

    if (namedList) {
      await Promise.all(Array.from(namedList).map(name => run(name)));
    } else {
      await Promise.all(spiders.values().map(spider => run(spider.name)));
    }
  }

  async function run(nameOrId: string): Promise<void> {
    const spider = spidersMap.get(nameOrId);

    if (spider !== undefined) {
      return launchSpider(spider);
    }

    return recover(nameOrId);
  }

  async function launchSpider(spider: Spider): Promise<void> {
    const name = spider.name;

    if (runnings.size >= maxSpidersCount) {
      logger.warn(`max spiders reached: ${maxSpidersCount}`);
      return;
    }

    const group = runnings.get(name);

    if (group !== undefined && group.size >= maxSpiderItemsCount) {
      logger.warn(`max spider items reached: ${name}`);
      return;
    }

    try {
      const { id } = await db.create<RunState>(RUNS_MODEL, {
        name,
        state: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await runSpider(spider, id).promise;
    } catch (err) {
      logger.error(`failed to create run record: ${name}`, err);
    }
  }

  async function stop(nameOrId: string): Promise<void> {
    const group = runnings.get(nameOrId);

    if (group !== undefined) {
      await Promise.all(stopRunable(group));
      return;
    }

    for (const runs of runnings.values()) {
      const run = runs.get(nameOrId);
      if (run !== undefined) {
        run.controller.abort();
        await run.promise;
        return;
      }
    }
  }

  async function recover(nameOrId?: string): Promise<void> {
    const pendingWhere = [{ field: 'state', value: 'pending' }];
    const states: Array<RunState> = [];

    if (nameOrId !== undefined) {
      states.push(
        ...(await db.findMany<RunState>(RUNS_MODEL, {
          where: [{ field: 'name', value: nameOrId }, ...pendingWhere],
        })),
      );
      states.push(
        ...(await db.findMany<RunState>(RUNS_MODEL, {
          where: [{ field: 'id', value: nameOrId }, ...pendingWhere],
        })),
      );
    } else {
      states.push(...(await db.findMany<RunState>(RUNS_MODEL, { where: pendingWhere })));
    }

    const seen = new Set<string>();

    for (const state of states) {
      if (seen.has(state.id)) continue;
      seen.add(state.id);

      const spider = spidersMap.get(state.name);

      if (spider === undefined) {
        logger.warn(`spider not found for recovery: ${state.name}`);
        continue;
      }

      runSpider(spider, state.id);
    }
  }

  async function getRunStates(name?: string): Promise<Array<RunState>> {
    return db.findMany<RunState>(RUNS_MODEL, {
      ...(name !== undefined ? { where: [{ field: 'name', value: name }] } : {}),
      orderBy: { field: 'createdAt', dir: 'desc' },
    });
  }

  async function dispose(): Promise<void> {
    if (runnings.size === 0) return;

    await Promise.all([...runnings.values()].flatMap(stopRunable));
  }

  function stopRunable(group: Map<string, Run>): Array<Promise<void>> {
    const out: Array<Promise<void>> = [];

    for (const { controller, promise } of group.values()) {
      controller.abort();
      out.push(promise.then(() => undefined));
    }

    return out;
  }

  function runSpider(spider: Spider, id: string): Run {
    return runnings
      .getOrInsertComputed(spider.name, () => new Map())
      .getOrInsertComputed(id, (): Run => {
        const controller = new AbortController();
        const name = spider.name;

        const promise: Promise<unknown> = spider
          .run({ db, id, signal: controller.signal })
          .then<Partial<RunState>>(() => {
            return {
              state: 'done',
              finishedAt: Date.now(),
              updatedAt: Date.now(),
            };
          })
          .catch<Partial<RunState>>(err => {
            return {
              state: 'failed',
              error: err instanceof Error ? err.message : String(err),
              finishedAt: Date.now(),
              updatedAt: Date.now(),
            };
          })
          .then(state => {
            return db.update(RUNS_MODEL, [{ field: 'id', value: id }], state);
          })
          .finally(() => {
            /**
             * runnings 是 name → id → Run 两级：删内层 id，空组再删外层 name
             */
            const group = runnings.get(name);
            if (group === undefined) return;
            group.delete(id);
            if (group.size === 0) runnings.delete(name);
          });

        return { id, name, controller, promise };
      });
  }
}

export interface SpiderRunnerOptions {
  /**
   * 数据库适配器
   */
  db?: DBAdapter;

  /**
   * 爬虫列表
   */
  spiders: Spider[];

  /**
   * 日志记录器
   */
  logger?: Logger;

  /**
   * 不同名并发上限
   *
   * @default 4
   */
  maxSpidersCount?: number;

  /**
   * 同名实例上限
   *
   * @default 200
   */
  maxSpiderItemsCount?: number;
}

export interface SpiderRunner {
  /**
   * 启动
   *
   * @param namedList - 启动的爬虫名称列表
   */
  start(namedList?: Iterable<string>): Promise<void>;

  /**
   * 启动一个实例；按 id 传参则续跑该记录
   *
   * @param nameOrId - 爬虫名称或记录 id
   */
  run(nameOrId: string): Promise<void>;

  /**
   * 停止目标爬虫或单个实例
   *
   * @param nameOrId - 爬虫名称或记录 id
   */
  stop(nameOrId: string): Promise<void>;

  /**
   * 恢复上次中断的实例
   *
   * @param nameOrId - 爬虫名称或记录 id
   */
  recover(nameOrId?: string): Promise<void>;

  /**
   * 查询运行记录
   *
   * @param nameOrId - 爬虫名称
   */
  getRunStates(nameOrId?: string): Promise<Array<RunState>>;

  dispose(): Promise<void>;
}

export type RunState =
  | { id: string; name: string; state: 'pending'; createdAt: number; updatedAt: number }
  | { id: string; name: string; state: 'processing'; createdAt: number; updatedAt: number }
  | {
      id: string;
      name: string;
      state: 'done' | 'failed';
      createdAt: number;
      updatedAt: number;
      finishedAt: number;
      error?: string;
    };

interface Run {
  id: string;
  name: string;
  controller: AbortController;
  promise: Promise<unknown>;
}
