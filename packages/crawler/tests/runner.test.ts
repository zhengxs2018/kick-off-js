import { describe, expect, it } from 'bun:test';

import { createSpiderRunner } from '../src/domain/index.js';
import { createMemoryAdapter } from '../src/db/index.js';

function mockSpider(
  name: string,
  run: (env: {
    db: ReturnType<typeof createMemoryAdapter>;
    id: string;
    signal: AbortSignal;
  }) => Promise<void>,
) {
  return {
    name,
    async run(env: {
      db: ReturnType<typeof createMemoryAdapter>;
      id: string;
      signal: AbortSignal;
    }) {
      await run(env);
    },
  };
}

describe('createSpiderRunner', () => {
  it('run 创建运行记录并标记 done', async () => {
    const db = createMemoryAdapter();
    const spider = mockSpider('s1', async () => undefined);
    const runner = createSpiderRunner({ spiders: [spider], db });
    await runner.run('s1');
    const states = await runner.getRunStates('s1');
    expect(states.length).toBe(1);
    expect(states[0]!.state).toBe('done');
  });

  it('run 内部抛错标记 failed', async () => {
    const db = createMemoryAdapter();
    const spider = mockSpider('s1', async () => {
      throw new Error('bad');
    });
    const runner = createSpiderRunner({ spiders: [spider], db });
    await runner.run('s1');
    const states = await runner.getRunStates('s1');
    expect(states[0]!.state).toBe('failed');
    expect(states[0]!.error).toContain('bad');
  });

  it('start 启动默认所有 spider', async () => {
    const db = createMemoryAdapter();
    const spider = mockSpider('s1', async () => undefined);
    const runner = createSpiderRunner({ spiders: [spider], db });
    await runner.start();
    const states = await runner.getRunStates('s1');
    expect(states.length).toBe(1);
  });

  it('stop 中止运行中的实例', async () => {
    const db = createMemoryAdapter();
    const spider = mockSpider('s1', async env => {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 200);
        env.signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        });
      });
    });
    const runner = createSpiderRunner({ spiders: [spider], db });
    const running = runner.run('s1');
    await new Promise(resolve => setTimeout(resolve, 20));
    await runner.stop('s1');
    await running;
    const states = await runner.getRunStates('s1');
    expect(states[0]!.state).toBe('failed');
  });

  it('recover 续跑 pending 记录', async () => {
    const db = createMemoryAdapter();
    await db.create('spiders', {
      id: 'r1',
      name: 's1',
      state: 'pending',
      createdAt: 1,
      updatedAt: 1,
    } as never);
    let ran = false;
    const spider = mockSpider('s1', async () => {
      ran = true;
    });
    const runner = createSpiderRunner({ spiders: [spider], db });
    await runner.recover('s1');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(ran).toBe(true);
  });

  it('dispose 无运行实例时直接返回', async () => {
    const db = createMemoryAdapter();
    const runner = createSpiderRunner({ spiders: [], db });
    await expect(runner.dispose()).resolves.toBeUndefined();
  });
});
