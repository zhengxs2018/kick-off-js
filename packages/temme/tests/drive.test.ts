import { describe, it, expect } from 'bun:test';
import { linkedom } from '../src/parsers/index.js';
import { createEngine, drive } from '../src/runtime/index.js';
import type { LinkedCapture, LinkedNode, LinkedPlan } from '../src/runtime/index.js';

/**
 * drive：单一 visit 递归驱动契约。
 *
 * 验证：根/子节点 fieldLookup 一致消费（旧实现 visitRoot 曾忽略根 fieldLookup，此用例确保不回归）、
 * hasNonBuiltinProcedure 分流（内置过程走适配器直取，非内置走 boundProcedure 且失败 fail-safe）。
 * 直接用最小 LinkedPlan（不经 compile/link），只验证 drive 行为。
 */

function plainCapture(name: string, extra: Partial<LinkedCapture> = {}): LinkedCapture {
  return {
    name,
    procedureName: 'text',
    procedureArgs: [],
    boundTypeConvert: v => v,
    hasTypeModifier: false,
    hasFilter: false,
    hasModifier: false,
    hasNonBuiltinProcedure: false,
    append: false,
    ...extra,
  };
}

function node(id: number, extra: Partial<LinkedNode> = {}): LinkedNode {
  return {
    id,
    parentId: null,
    css: 'div',
    children: [],
    captures: [],
    ...extra,
  };
}

const adapter = linkedom();
const engine = createEngine(adapter);

describe('drive 根/子节点 fieldLookup 一致消费', () => {
  it('根节点 fieldLookup 被 engine.select 实际消费（非忽略）', () => {
    const html = `<ul><li class="a">1</li><li>2</li></ul>`;
    const plan: LinkedPlan = {
      roots: [0],
      nodes: [
        {
          ...node(0, {
            css: 'ul',
            fieldLookup: { relation: 'child', strategy: { kind: 'class', className: 'a' } },
          }),
          captures: [plainCapture('first', { procedureName: 'text' })],
        },
      ],
      whitespace: 'preserve',
    };
    const result = drive(plan, engine, engine.parse(html));
    expect(result.first).toBe('1');
  });

  it('嵌套子节点 fieldLookup 同样生效', () => {
    const html = `<div><section><span class="lead">hi</span></section></div>`;
    const plan: LinkedPlan = {
      roots: [0],
      nodes: [
        {
          ...node(0, {
            css: 'div',
            fieldLookup: { relation: 'child', strategy: { kind: 'tag', tagName: 'section' } },
          }),
          captures: [plainCapture('sec', { procedureName: 'text' })],
          children: [1],
        },
        {
          ...node(1, {
            parentId: 0,
            css: 'section',
            fieldLookup: { relation: 'child', strategy: { kind: 'class', className: 'lead' } },
          }),
          captures: [plainCapture('lead', { procedureName: 'text' })],
        },
      ],
      whitespace: 'preserve',
    };
    const result = drive(plan, engine, engine.parse(html));
    expect(result.lead).toBe('hi');
  });
});

describe('drive hasNonBuiltinProcedure 分流', () => {
  it('内置过程 text：走适配器 extract 直取', () => {
    const plan: LinkedPlan = {
      roots: [0],
      nodes: [node(0, { css: 'span', captures: [plainCapture('t', { procedureName: 'text' })] })],
      whitespace: 'preserve',
    };
    const result = drive(plan, engine, engine.parse('<span>txt</span>'));
    expect(result.t).toBe('txt');
  });

  it('非内置过程：走 boundProcedure(text 输入分流)，未注册返回 undefined 跳过', () => {
    const plan: LinkedPlan = {
      roots: [0],
      nodes: [
        node(0, {
          css: 'span',
          captures: [
            plainCapture('u', {
              procedureName: 'unknown',
              hasNonBuiltinProcedure: true,
              boundProcedure: undefined,
            }),
          ],
        }),
      ],
      whitespace: 'preserve',
    };
    const result = drive(plan, engine, engine.parse('<span>txt</span>'));
    expect('u' in result).toBe(false);
  });

  it('非内置过程已注册：boundProcedure 接收 text 输入与 args', () => {
    const plan: LinkedPlan = {
      roots: [0],
      nodes: [
        node(0, {
          css: 'span',
          captures: [
            plainCapture('u', {
              procedureName: 'wrap',
              hasNonBuiltinProcedure: true,
              procedureArgs: ['!'],
              boundProcedure: (input, suffix) => `${String(input)}${String(suffix)}`,
            }),
          ],
        }),
      ],
      whitespace: 'preserve',
    };
    const result = drive(plan, engine, engine.parse('<span>hi</span>'));
    expect(result.u).toBe('hi!');
  });
});

describe('drive 纯作用域节点下探子节点', () => {
  it('捕获为空的节点不写状态但仍递归子节点', () => {
    const html = `<div><span class="v">x</span></div>`;
    const plan: LinkedPlan = {
      roots: [0],
      nodes: [
        node(0, { css: 'div', captures: [], children: [1] }),
        node(1, {
          parentId: 0,
          css: 'div',
          fieldLookup: { relation: 'child', strategy: { kind: 'class', className: 'v' } },
          captures: [plainCapture('v')],
        }),
      ],
      whitespace: 'preserve',
    };
    const result = drive(plan, engine, engine.parse(html));
    expect(result.v).toBe('x');
  });
});

describe('drive 赋值语句跳过 DOM 抽取', () => {
  it('assignValue 直接写入（node.assignValue !== undefined 分支）', () => {
    const plan: LinkedPlan = {
      roots: [0],
      nodes: [
        node(0, {
          css: '',
          assignValue: 99,
          captures: [plainCapture('k', { procedureName: 'text' })],
        }),
      ],
      whitespace: 'preserve',
    };
    const result = drive(plan, engine, engine.parse('<div></div>'));
    expect(result.k).toBe(99);
  });
});
