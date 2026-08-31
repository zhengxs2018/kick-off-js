import { describe, it, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { linkedom, domParser } from '../src/parsers/index.js';
import { createExtractor } from '../src/extractor.js';
import type { TemmeSelector } from '../src/compiler/index.js';

/**
 * 锁定列表（append）捕获的累积顺序方向，分解析器对比：
 * 预期分别验证 linkedom 与 domParser(jsdom) 各自的 select 返回序列，
 * 经 drive 累积后的最终数组顺序是否为文档正序。
 *
 * 两个解析器均应按文档序累积（drive 层正序遍历写捕获）。
 */

const html = '<ul><li>a</li><li>b</li><li>c</li></ul>';

const listSelector: TemmeSelector[] = [
  {
    type: 'normal-selector',
    sections: [{ combinator: ' ', element: 'li', qualifiers: [] }],
    procedure: null,
    arrayCapture: { name: 'item', typeAnnotation: null, filterList: null, modifier: null },
    children: [],
  },
];

describe('列表 append 捕获的累积顺序（linkedom）', () => {
  const adapter = linkedom();
  const extractor = createExtractor({ parser: adapter });
  it('drive 层按文档序累积（数组捕获为正序）', () => {
    const out = extractor.select<Record<string, unknown>>(extractor.load(html), listSelector);
    expect(out).toEqual({ item: ['a', 'b', 'c'] });
  });
});

describe('列表 append 捕获的累积顺序（domParser / jsdom）', () => {
  // bun 运行时无全局 DOMParser / CSS.escape，用 jsdom window 补齐
  const { window } = new JSDOM('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, { DOMParser: window.DOMParser, CSS: window.CSS });

  const adapter = domParser();
  const extractor = createExtractor({ parser: adapter });
  it('与 linkedom 一致（均按文档序累积）', () => {
    const out = extractor.select<Record<string, unknown>>(extractor.load(html), listSelector);
    expect(out).toEqual({ item: ['a', 'b', 'c'] });
  });
});
