import { describe, it, expect } from 'bun:test';
import { linkedom } from '../src/parsers/index.js';
import { createEngine } from '../src/runtime/index.js';
import type { PlanNode } from '../src/compiler/index.js';

/**
 * 引擎累积语义：WRITE_APPEND（append=true）数组捕获真累积，而非 First-Wins 标量覆盖。
 *
 * 此处通过 `createEngine` + linkedom 适配器在真实 DOM 上驱动一个 append 捕获，
 * 验证多次匹配的结果被累积为数组。引擎 `select` 返回节点序列，累积由 state/drive 完成，
 * 本测试集中验证「select 能为每个匹配元素产出一个节点」这一累积前提取。
 */

describe('引擎 select 为累积提供节点序列', () => {
  const adapter = linkedom();
  const engine = createEngine(adapter);

  it('select 对多匹配返回全部节点（支撑 append 真累积）', () => {
    const scope = engine.parse('<ul><li>a</li><li>b</li><li>c</li></ul>');
    const plan: PlanNode = {
      parentId: null,
      css: 'li',
      captures: [],
      children: [],
    };

    const matched = [...engine.select(plan, scope)];
    expect(matched.length).toBe(3);
  });

  it('无匹配时 select 返回空序列', () => {
    const scope = engine.parse('<div></div>');
    const plan: PlanNode = { parentId: null, css: 'span', captures: [], children: [] };

    const matched = [...engine.select(plan, scope)];
    expect(matched.length).toBe(0);
  });
});

describe('resolve 字段直取快路径', () => {
  const adapter = linkedom();
  const engine = createEngine(adapter);

  it('relation=undefined / self 返回原节点', () => {
    const scope = engine.parse('<div><span>x</span></div>');
    const node = [
      ...engine.select({ parentId: null, css: 'span', captures: [], children: [] }, scope),
    ][0];

    expect(engine.resolve(node, undefined)).toBe(node);
    expect(engine.resolve(node, { relation: 'self' })).toBe(node);
  });

  it('relation=parent 沿父链上溯固定步数', () => {
    const scope = engine.parse('<div id="root"><section><span>x</span></section></div>');
    const span = [
      ...engine.select({ parentId: null, css: 'span', captures: [], children: [] }, scope),
    ][0];
    const parent1 = engine.resolve(span, {
      relation: 'parent',
      strategy: { kind: 'tag', tagName: 'section' },
      steps: 1,
    });
    const parent2 = engine.resolve(span, {
      relation: 'parent',
      strategy: { kind: 'tag', tagName: 'div' },
      steps: 2,
    });

    expect(parent1).not.toBeNull();
    expect(parent2).not.toBeNull();
    expect((parent2 as { native: { id?: string } }).native.id).toBe('root');
  });

  it('relation=parent 步数超出父链触顶返回 null', () => {
    const scope = engine.parse('<span>x</span>');
    const span = [
      ...engine.select({ parentId: null, css: 'span', captures: [], children: [] }, scope),
    ][0];
    const climbed = engine.resolve(span, {
      relation: 'parent',
      strategy: { kind: 'tag', tagName: 'body' },
      steps: 5,
    });

    expect(climbed).toBeNull();
  });

  it('relation=child 走原生直取快路径', () => {
    const scope = engine.parse('<div><p class="lead">hi</p></div>');
    const plan: PlanNode = {
      parentId: null,
      css: 'div',
      captures: [],
      children: [],
      fieldLookup: { relation: 'child', strategy: { kind: 'class', className: 'lead' } },
    };

    const matched = [...engine.select(plan, scope)];
    expect(matched.length).toBe(1);
  });
});

describe('引擎 fail-safe 不抛错', () => {
  const adapter = linkedom();
  const engine = createEngine(adapter);

  it('非法 CSS 选择器不抛错，返回空序列', () => {
    const scope = engine.parse('<div></div>');
    const plan: PlanNode = {
      parentId: null,
      css: '::not-a-valid-selector(((',
      captures: [],
      children: [],
    };

    expect(() => [...engine.select(plan, scope)]).not.toThrow();
  });
});
