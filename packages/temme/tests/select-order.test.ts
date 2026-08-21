import { describe, it, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { linkedom, domParser } from '../src/parsers/index.js';
import { createExtractor } from '../src/extractor.js';
import type { TemmeSelector } from '../src/compiler/index.js';

/**
 * 锁定列表（append）捕获的累积顺序方向，分解析器对比：
 * 预期分别验证 linkedom 与 domParser(jsdom) 各自的 select 返回序列，
 * 经 drive 累积后的最终数组顺序，以确定逆序是"解析器返回顺序问题"还是"drive 遍历规范问题"。
 *
 * 若两个解析器表现一致 → 属 drive 规范问题，应在 drive 层修正遍历。
 * 若仅其一逆序 → 属解析器问题，转换应落在对应解析器或 drive 的规范化。
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
  it('drive 层累积为文档逆序（已知契约，由 toResult(rows) 修正为正序）', () => {
    const out = extractor.select<Record<string, unknown>>(extractor.load(html), listSelector);
    expect(out).toEqual({ item: ['c', 'b', 'a'] });
  });
});

describe('列表 append 捕获的累积顺序（domParser / jsdom）', () => {
  // bun 运行时无全局 DOMParser / CSS.escape，用 jsdom window 补齐
  const { window } = new JSDOM('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, { DOMParser: window.DOMParser, CSS: window.CSS });

  const adapter = domParser();
  const extractor = createExtractor({ parser: adapter });
  it('与 linkedom 一致（确认逆序非解析器问题，属 drive 遍历规范）', () => {
    const out = extractor.select<Record<string, unknown>>(extractor.load(html), listSelector);
    expect(out).toEqual({ item: ['c', 'b', 'a'] });
  });
});
