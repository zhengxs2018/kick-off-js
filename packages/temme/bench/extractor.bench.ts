import { readFileSync } from 'node:fs';
import { bench, group, run } from 'mitata';

import { compile, parse } from '../src/compiler/index.js';
import { link } from '../src/runtime/link.js';
import { createEnv } from '../src/runtime/env.js';
import { createExtractor } from '../src/extractor.js';
import type { TemmeSelector } from '../src/compiler/index.js';
import type { LinkedPlan } from '../src/runtime/linked.js';

/**
 * 管线分层性能对比（基于原版 realworld 案例 + 自定义 extractor）
 *
 * 数据：sources/temme/tests/realworld 的 StackOverflow 问答页（真实 HTML）。
 * 规则：合并原版 realworld.test.ts 中全部选择器为一条（含 find 过程、|Number 等过滤器、
 * 数组捕获、递归数组捕获、属性捕获），并注册对应过程/过滤器到 env，使规则真实执行。
 *
 * 六个形态（同一规则，每级逐步把 parse→compile→link 前移，仅留 drive 为最快）：
 * - 字符串规则：每次 parse(RULE) → compile → link → drive
 * - 预编译规则：plan 一次 compile 完成，每次 link + drive
 * - 预热 + 预编译：同预编译，先预热让 JIT 优化
 * - 手写 selector + compile：AST 一次 parse 完成（等价手写），每次 compile → link → drive
 * - 手写 selector + compile + 预热：同手写，先预热
 * - 手写 + linkedplan 预热：plan + link 均一次完成，每次仅 drive
 *
 * 每个 bench 单次循环调用 100 次，取稳定均值。
 * 运行：`bun run bench/extractor.bench.ts`
 */

const STACKOVERFLOW_HTML = readFileSync(
  new URL('../assets/question-page-of-stackoverflow.html', import.meta.url),
  'utf8',
);

// 合并原版 realworld.test.ts 全部规则为一条
const RULE = `
  .article_head h1 find($name, '-');
  .author find('阅读：', $count|Number, '次');
  #question-header .question-hyperlink[href=$url] $title;
  .answer $answers { .votecell .vote-count-post $upvote; .user-info .user-details>a $userName };
  .answer $ { .votecell .vote-count-post $upvote; .post-test $postText; .user-info .user-details>a $userName;
    .comment $comments { .comment-score $score|trim|Number; .comment-copy $content|substring(0,10);
      .comment-user[href=$userUrl] $userName; .comment-data span[title=$data] } };
`;

// 等价手写 AST：一次性 parse 产物（避免手写合并规则时结构与字符串规则漂移）
const SELECTORS: TemmeSelector[] = parse(RULE);

const env = createEnv({
  procedures: {
    find(input: unknown, before: unknown, after: unknown) {
      const s = String(input);
      const prefix = String(before);
      const start = s.indexOf(prefix);
      if (start === -1) return undefined;
      if (after === undefined) return s.substring(start + prefix.length);
      const end = s.indexOf(String(after), start + prefix.length);
      return end === -1 ? undefined : s.substring(start + prefix.length, end);
    },
    html(input: unknown) {
      return input;
    },
  },
  filters: {
    Number(value: unknown) {
      return Number(value);
    },
    trim(value: unknown) {
      return String(value).trim();
    },
    substring(value: unknown, start: unknown, end: unknown) {
      return String(value).substring(Number(start), end === undefined ? undefined : Number(end));
    },
    split(value: unknown, sep: unknown) {
      return String(value).split(String(sep));
    },
    pack(input: unknown) {
      return Object.assign({}, ...(input as object[]));
    },
  },
});

const extractor = createExtractor({ env });
const document = extractor.load(STACKOVERFLOW_HTML);

// 预编译 / 预热 / linkedplan 形态复用的产物
const plan = compile(SELECTORS);
const linkedPlan: LinkedPlan = link(plan, env);

/** 预热：先跑 count 次让 JIT 优化热路径，再正式计时 */
function warmup(fn: () => unknown, count = 200): void {
  for (let index = 0; index < count; index += 1) {
    fn();
  }
}

group('字符串规则（每次含 parse）', () => {
  bench('parse + select ×100', () => {
    for (let index = 0; index < 100; index += 1) {
      extractor.select(document, parse(RULE));
    }
  });
});

group('预编译规则（compile 一次，每次 link + drive）', () => {
  bench('extract(plan) ×100', () => {
    for (let index = 0; index < 100; index += 1) {
      extractor.extract(document, plan);
    }
  });
});

group('预热 + 预编译规则', () => {
  warmup(() => extractor.extract(document, plan));
  bench('extract(plan) 预热后 ×100', () => {
    for (let index = 0; index < 100; index += 1) {
      extractor.extract(document, plan);
    }
  });
});

group('手写 selector + compile（跳过 parse）', () => {
  bench('select(selectors) ×100', () => {
    for (let index = 0; index < 100; index += 1) {
      extractor.select(document, SELECTORS);
    }
  });
});

group('手写 selector + compile + 预热', () => {
  warmup(() => extractor.select(document, SELECTORS));
  bench('select(selectors) 预热后 ×100', () => {
    for (let index = 0; index < 100; index += 1) {
      extractor.select(document, SELECTORS);
    }
  });
});

group('手写 + linkedplan 预热（仅 drive，最快）', () => {
  warmup(() => extractor.execute(document, linkedPlan));
  bench('execute(linkedPlan) ×100', () => {
    for (let index = 0; index < 100; index += 1) {
      extractor.execute(document, linkedPlan);
    }
  });
});

await run();
