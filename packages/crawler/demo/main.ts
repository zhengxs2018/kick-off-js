import { createCrawler } from '../src/index.ts';
import { createBunSqliteAdapter } from '../src/platform/bun/index.ts';

import { zhSpider } from './zh.ts';

await using crawler = createCrawler({
  db: createBunSqliteAdapter('data/crawler.db'),
  maxSpidersCount: 4,
  maxSpiderItemsCount: 200,
  spiders: [zhSpider],
});

try {
  await crawler.start();
  console.log('done');
} catch (err) {
  console.error(err);
  process.exit(1);
}
