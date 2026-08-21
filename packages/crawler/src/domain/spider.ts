import type { TaskItemFields, TaskUnit } from './task.js';
import { createLogger } from '../common/logger.js';
import { createScheduler } from '../core/scheduler.js';
import type { DBAdapter } from '../db/adapter.js';
import { dbToStore } from '../db/store.js';

const DEFAULT_MAX_ITEMS = 200;

const DEFAULT_MAX_TASKS = 1;

export function defineSpider(spec: SpiderSpec): Spider {
  const tasks = new Map(spec.tasks.map(task => [task.name, task]));

  const defaultTask = spec.defaultTask !== undefined ? spec.defaultTask : spec.tasks[0]?.name;

  if (defaultTask === undefined) {
    throw new Error(`spider ${spec.name} has no default task`);
  }

  const logger = createLogger(spec.name);
  const concurrency = Math.max(1, spec.concurrency !== undefined ? spec.concurrency : 1);
  const maxItems = Math.max(1, spec.maxItems !== undefined ? spec.maxItems : DEFAULT_MAX_ITEMS);
  const maxTasksCount = Math.max(
    1,
    spec.maxTasksCount !== undefined ? spec.maxTasksCount : DEFAULT_MAX_TASKS,
  );

  return {
    name: spec.name,
    async run(env) {
      const { db, id, signal } = env;

      await spec.setup?.();

      await using scheduler = createScheduler<TaskItemFields>({
        signal,
        store: dbToStore<TaskItemFields>('tasks', db, [{ field: 'spiderId', value: id }]),
        concurrency,
        maxItems,
        maxTasksCount,
        async handler(item, controller) {
          const unit = tasks.get(item.name);

          if (unit === undefined) {
            logger.error(`unknown task ${item.name}`);
            return;
          }

          const name = item.name;

          // 默认派发到当前 task；payload 带 name 则覆盖路由。
          await unit.process(item.data, {
            enqueue(payload) {
              controller.enqueue({ spiderId: id, name, ...payload });
            },
          });
        },
      });

      await scheduler.push({ name: defaultTask, data: {} });
      await scheduler.run();

      await spec.teardown?.();
    },
  };
}

export interface SpiderSpec {
  name: string;

  tasks: Array<TaskUnit<any>>;

  defaultTask?: string;

  concurrency?: number;

  maxTasksCount?: number;

  maxItems?: number;

  setup?(): Promise<void>;

  teardown?(): Promise<void>;
}

export interface SpiderRunEnv {
  db: DBAdapter;

  id: string;

  signal: AbortSignal;
}

export interface Spider {
  name: string;

  run(env: SpiderRunEnv): Promise<void>;
}
