import { createSpiderRunner } from './domain/runner.js';
import type { SpiderRunner, SpiderRunnerOptions } from './domain/runner.js';
import type { Spider } from './domain/spider.js';

export function createCrawler(options: CrawlerOptions): Crawler {
  const runner = createSpiderRunner(options);

  return {
    ...runner,
    [Symbol.dispose]() {
      return runner.dispose();
    },
    [Symbol.asyncDispose]() {
      return runner.dispose();
    },
    [Symbol.toStringTag]: 'Crawler',
  };
}

export interface CrawlerOptions extends Omit<SpiderRunnerOptions, 'spiders'> {
  spiders: Spider[];
}

export interface Crawler extends SpiderRunner {
  [Symbol.dispose](): void;

  [Symbol.asyncDispose](): Promise<void>;

  readonly [Symbol.toStringTag]: string;
}
