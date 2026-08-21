import { describe, expect, it } from 'bun:test';

import { createCrawler } from '../src/crawler.js';
import { createMemoryAdapter } from '../src/db/index.js';

describe('createCrawler', () => {
  it('薄包装 SpiderRunner 并暴露 dispose / toStringTag', async () => {
    const db = createMemoryAdapter();
    const crawler = createCrawler({ spiders: [], db });
    expect(crawler[Symbol.toStringTag]).toBe('Crawler');
    const states = await crawler.getRunStates();
    expect(states).toEqual([]);
    await crawler.dispose();
  });

  it('同步 dispose 委托 runner.dispose', () => {
    const db = createMemoryAdapter();
    const crawler = createCrawler({ spiders: [], db });
    expect(() => crawler[Symbol.dispose]()).not.toThrow();
  });
});
