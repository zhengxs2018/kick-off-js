import { describe, it, expect } from 'bun:test';
import { createEngine } from '../src/runtime/index.js';
import { linkedom, EMPTY_NODE_COLLECTION } from '../src/parsers/index.js';
import type { PlanNode } from '../src/compiler/index.js';

/**
 * fail-safe no-op 契约：未注册 / 未识别的 filter / modifier / 过程名一律静默透传，不抛错。
 *
 * 引擎层不直接消费 filter/modifier，但适配器 `extract` 对未识别过程名返回 undefined 即 fail-safe 体现；
 * 另验证 EMPTY_NODE_COLLECTION 作为快路径不支持时的安全返回值。
 */

describe('适配器 extract 未识别过程名返回 undefined', () => {
  const adapter = linkedom();
  const engine = createEngine(adapter);

  it('text / html / node / attr 为内置过程', () => {
    const scope = engine.parse('<a href="/x">hi</a>');
    const node = [
      ...engine.select({ parentId: null, css: 'a', captures: [], children: [] }, scope),
    ][0];

    expect(node.extract('text', [])).toBe('hi');
    expect(node.extract('html', [])).toBe('hi');
    expect(node.extract('node', [])).toBeTruthy();
    expect(node.extract('attr', ['href'])).toBe('/x');
  });

  it('未注册过程名返回 undefined（fail-safe no-op，不抛错）', () => {
    const scope = engine.parse('<span>v</span>');
    const node = [
      ...engine.select({ parentId: null, css: 'span', captures: [], children: [] }, scope),
    ][0];

    expect(node.extract('unknown-procedure', [])).toBeUndefined();
    expect(node.extract('', [])).toBeUndefined();
    expect(() => node.extract('totally-made-up', ['arg'])).not.toThrow();
  });

  it('attr 过程缺属性名返回 null（linkedom getAttribute 行为）', () => {
    const scope = engine.parse('<span>v</span>');
    const node = [
      ...engine.select({ parentId: null, css: 'span', captures: [], children: [] }, scope),
    ][0];

    expect(node.extract('attr', [])).toBeNull();
  });
});

describe('EMPTY_NODE_COLLECTION fail-safe 返回值', () => {
  it('length 为 0、item 返回 null、可迭代为空', () => {
    expect(EMPTY_NODE_COLLECTION.length).toBe(0);
    expect(EMPTY_NODE_COLLECTION.item(0)).toBeNull();
    expect([...EMPTY_NODE_COLLECTION]).toEqual([]);
  });
});

describe('引擎 select 对不支持快路径退回 CSS 匹配', () => {
  const adapter = linkedom();
  const engine = createEngine(adapter);

  it('attr 快路径无原生入口时回退 match，仍命中', () => {
    const scope = engine.parse('<input data-k="v" />');
    const plan: PlanNode = {
      parentId: null,
      css: 'input',
      captures: [],
      children: [],
      fieldLookup: { relation: 'child', strategy: { kind: 'attr', name: 'data-k', value: 'v' } },
    };

    const matched = [...engine.select(plan, scope)];
    expect(matched.length).toBe(1);
  });
});
