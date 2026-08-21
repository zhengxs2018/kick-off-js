import { describe, it, expect } from 'bun:test';
import { parse } from '../src/compiler/index.js';
import { compile } from '../src/compiler/index.js';
import { createExtractor } from '../src/extractor.js';
import type { NormalSelector, Procedure } from '../src/compiler/index.js';

/**
 * 列表模式（append 数组捕获）支持取值过程（attr / node）。
 *
 * 修复前：数组捕获分支（NormalSelector 首分支）无过程槽位，且过程分支强制
 * `arrayCapture: null`，导致 `attr(href)` / `node()` 永远无法落到 append 捕获上，
 * 列表模式一律取 textContent。本组锁定修复后行为。
 */

describe('列表捕获携带取值过程（attr/node）', () => {
  it('parse：`a $url attr(href)` 解析为带过程的数组捕获', () => {
    const ast = parse('a $url attr(href) { }') as NormalSelector[];
    const sel = ast[0]!;
    expect(sel.arrayCapture).toMatchObject({ name: 'url' });
    expect(sel.procedure).toEqual<Procedure>({ name: 'attr', args: ['href'] });
  });

  it('parse：无过程无子块的裸 `$name` 仍回落为标量捕获（非数组）', () => {
    const ast = parse('div .name $name') as NormalSelector[];
    const sel = ast[0]!;
    expect(sel.arrayCapture).toBeNull();
    expect(sel.procedure).toMatchObject({ name: 'text' });
  });

  it('compile：`attr(href)` 数组捕获 procedureName=attr 且 append=true', () => {
    const plan = compile(parse('a $url attr(href) { }'));
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.procedureName).toBe('attr');
    expect(c.procedureArgs).toEqual(['href']);
    expect(c.append).toBe(true);
  });

  it('compile：`node()` 数组捕获 procedureName=node 且 append=true', () => {
    const plan = compile(parse('div $node node() { }'));
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.procedureName).toBe('node');
    expect(c.procedureArgs).toEqual([]);
    expect(c.append).toBe(true);
  });

  it('end-to-end：列表模式抽取 href 属性值', () => {
    const html = `
      <ul>
        <li><a href="/a1">A1</a></li>
        <li><a href="/a2">A2</a></li>
      </ul>`;
    const extractor = createExtractor();
    // 捕获名 `$url` 在编译期归一为 `url`，故结果键为 `url`（非 `$url`）
    const r = extractor.select<{ url: string[] }>(
      extractor.load(html),
      parse(`a $url attr(href) { }`),
    );
    expect(r.url.length).toBe(2);
    expect(r.url).toContain('/a1');
    expect(r.url).toContain('/a2');
  });

  it('end-to-end：列表模式保留 DOM 节点（node 过程）', () => {
    const html = `<ul><li><a href="/a1">A1</a></li><li><a href="/a2">A2</a></li></ul>`;
    const extractor = createExtractor();
    const r = extractor.select<{ node: unknown[] }>(
      extractor.load(html),
      parse(`a $node node() { }`),
    );
    expect(r.node.length).toBe(2);
    expect((r.node[0] as { tagName: string }).tagName).toBe('A');
  });
});
