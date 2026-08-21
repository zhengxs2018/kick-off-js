import { describe, expect, it } from 'bun:test';
import { createCrawler } from '../src/index.ts';
import { defineSpider, defineTask } from '../src/index.ts';
import { createMemoryAdapter } from '../src/db/memory.js';

const TASKS_MODEL = 'tasks';

describe('defineSpider 内部 task 状态机（L2 自驱）', () => {
  it('run 驱动 seed task 落盘到 done', async () => {
    const db = createMemoryAdapter();

    const spider = defineSpider({
      name: 'mock',
      defaultTask: 'seed',
      tasks: [defineTask('seed', async () => {})],
    });

    await spider.run({ db, id: 'mock-1', signal: new AbortController().signal });

    const stored = await db.findMany(TASKS_MODEL);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.name).toBe('seed');
    expect(stored[0]!.state).toBe('done');
    expect(stored[0]!.finishedAt).toBeDefined();
  });

  it('task handler 抛错 → task 落盘 failed', async () => {
    const db = createMemoryAdapter();

    const spider = defineSpider({
      name: 'mock',
      defaultTask: 'seed',
      tasks: [
        defineTask('seed', async () => {
          throw new Error('boom');
        }),
      ],
    });

    await spider.run({ db, id: 'mock-2', signal: new AbortController().signal });

    const stored = await db.findMany(TASKS_MODEL);
    expect(stored[0]!.state).toBe('failed');
    expect(stored[0]!.error).toContain('boom');
  });
});

describe('createCrawler smoke（离线，内存存储）', () => {
  it('start() 调度种子任务，task 落盘 done', async () => {
    const db = createMemoryAdapter();

    const spider = defineSpider({
      name: 'mock',
      defaultTask: 'seed',
      tasks: [defineTask('seed', async () => {})],
    });

    const crawler = createCrawler({ db, spiders: [spider] });
    await crawler.start();
    await crawler.dispose();
  });
});
