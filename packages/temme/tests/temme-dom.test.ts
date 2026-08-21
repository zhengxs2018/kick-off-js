import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { domParser } from '../src/parsers/index.js';
import { compile, parse } from '../src/compiler/index.js';
import { createEnv, link } from '../src/runtime/index.js';
import { createExtractor } from '../src/extractor.js';
import type { TemmeSelector } from '../src/compiler/index.js';

/**
 * domParser 驱动真实 StackOverflow 页：把 jsdom 解析出的 `document.body` 直接包装为提取器输入，
 * 复用 bench/extractor.bench.ts 的抽取意图（find 过程 + Number/trim/substring 过滤器 + 答案数组捕获）。
 *
 * 规则做了 DOM 兼容裁剪：bench 原规则含 `[href=$url]` / `[href=$userUrl]` / `[title=$data]` 属性捕获，
 * 这些编译为 `*.question-hyperlink[href=$url]` 形式的非标准 CSS，jsdom（严格 querySelectorAll）会抛
 * SyntaxError，而 linkedom 静默不匹配。故此处去除属性捕获，保留 title 与答案数组抽取。
 *
 * 验证：jsdom body 不经 parseFromString 直接喂入三层抽取（select / extract / execute）产出一致。
 */

const STACKOVERFLOW_HTML = readFileSync(
  new URL('../assets/question-page-of-stackoverflow.html', import.meta.url),
  'utf8',
);

// 与 bench 一致的扩展能力（find 过程、Number/trim/substring 过滤器）
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
  },
});

// DOM 兼容规则：bench 规则的属性捕获裁剪后的等价抽取
const RULE = `
  #question-header .question-hyperlink $title;
  .answer $answers { .votecell .vote-count-post $upvote; .user-info .user-details>a $userName }
`;

// jsdom 解析真实页面，直接把 body 包装为文档根
const { window } = new JSDOM(STACKOVERFLOW_HTML);
Object.assign(globalThis, {
  DOMParser: window.DOMParser,
  CSS: window.CSS,
});

const parser = domParser();
const extractor = createExtractor({ env, parser });
const document = parser.createNode(window.document.body);

const selectors: TemmeSelector[] = parse(RULE);
const plan = compile(selectors);
const linkedPlan = link(plan, env);

const EXPECTED_TITLE = 'Python: temporarily change variable scoping rules';
const EXPECTED_ANSWER_COUNT = 7;

type Result = Record<string, unknown>;

describe('domParser 驱动真实 SO 页：jsdom body 直接喂入', () => {
  it('select（字符串规则 → parse → compile → drive）', () => {
    const result = extractor.select(document, parse(RULE)) as Result;
    expect(result.title).toBe(EXPECTED_TITLE);
    expect(result.answers).toHaveLength(EXPECTED_ANSWER_COUNT);
  });

  it('select（等价手写 AST）', () => {
    const result = extractor.select(document, selectors) as Result;
    expect(result.title).toBe(EXPECTED_TITLE);
    expect(result.answers).toHaveLength(EXPECTED_ANSWER_COUNT);
  });

  it('extract（预编译计划）', () => {
    const result = extractor.extract(document, plan) as Result;
    expect(result.title).toBe(EXPECTED_TITLE);
    expect(result.answers).toHaveLength(EXPECTED_ANSWER_COUNT);
  });

  it('execute（已链接计划）', () => {
    const result = extractor.execute(document, linkedPlan) as Result;
    expect(result.title).toBe(EXPECTED_TITLE);
    expect(result.answers).toHaveLength(EXPECTED_ANSWER_COUNT);
  });

  it('三层入口产出一致', () => {
    const bySelect = extractor.select(document, parse(RULE));
    const byExtract = extractor.extract(document, plan);
    const byExecute = extractor.execute(document, linkedPlan);
    expect(byExtract).toEqual(bySelect);
    expect(byExecute).toEqual(bySelect);
  });
});

describe('domParser 抽取结果内容', () => {
  it('answers 为答案数组，每项为来自真实页面的非空答案文本', () => {
    const result = extractor.extract(document, plan) as Result;
    const answers = result.answers as Array<string>;
    expect(answers.length).toBe(EXPECTED_ANSWER_COUNT);
    for (const answer of answers) {
      expect(typeof answer).toBe('string');
      expect(answer.length).toBeGreaterThan(0);
    }
  });

  it('answers 与 question 的 title 同源于真实页面', () => {
    const result = extractor.extract(document, plan) as Result;
    expect(result.title).toContain('scoping rules');
    const answers = result.answers as Array<string>;
    expect(answers[0]).toContain('up vote 5 down vote');
  });
});
