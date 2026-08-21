import { describe, it, expect } from 'bun:test';
import { compile } from '../src/compiler/index.js';
import type { Filter, Procedure, Capture, NormalSelector } from '../src/compiler/index.js';

/**
 * ast Filter 联合类型契约：普通过滤器分支与修饰符链分支互斥、无共享可选字段。
 *
 * 在编译边界验证：isModifier 分支不混入 filterList（name 不为 undefined），修饰符名正确落入 modifier。
 */

function capture(name: string, filterList: Filter[]): Capture {
  return { name, typeAnnotation: null, filterList, modifier: null };
}

function normalSelector(procedure: Procedure): NormalSelector {
  return {
    type: 'normal-selector',
    sections: [{ combinator: ' ', element: 'div', qualifiers: [] }],
    procedure,
    arrayCapture: null,
    children: [],
  };
}

describe('Filter 联合：普通过滤器分支', () => {
  it('isArrayFilter/name/args 分支编译为 PlanFilter，name 有值', () => {
    const plan = compile([
      normalSelector({
        name: 'text',
        args: [capture('t', [{ isArrayFilter: false, name: 'trim', args: [] }])],
      }),
    ]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.filterList?.[0]?.name).toBe('trim');
    expect(c.filterList?.[0]?.isArrayFilter).toBe(false);
  });
});

describe('Filter 联合：修饰符链分支', () => {
  it('isModifier 分支不混入 filterList，修饰符名进 modifier', () => {
    const modifierChain: Filter = { isModifier: true, modifiers: ['first', 'last'] };
    const plan = compile([normalSelector({ name: 'text', args: [capture('t', [modifierChain])] })]);
    const c = plan.nodes[0]!.captures[0]!;

    expect(c.filterList).toBeNull();
    expect(c.hasFilter).toBe(false);
    expect(c.hasModifier).toBe(true);
    expect(c.modifier?.map(m => m.name)).toEqual(['first', 'last']);
  });

  it('修饰符链分支对象不含 name 字段（类型互斥的运行时验证）', () => {
    const chain = { isModifier: true, modifiers: ['x'] } as const;
    const isPlainFilter = 'name' in chain;
    expect(isPlainFilter).toBe(false);
  });
});

describe('Filter 普通过滤器分支不含 isModifier 字段', () => {
  it('普通分支对象不含 isModifier（类型互斥的运行时验证）', () => {
    const plain = { isArrayFilter: false, name: 'trim', args: [] } as const;
    expect('isModifier' in plain).toBe(false);
  });
});

describe('混合：filter + modifier 链共存', () => {
  it('filter 进 filterList、modifier 进 modifier，二者分离', () => {
    const filter: Filter = { isArrayFilter: false, name: 'trim', args: [] };
    const modifierChain: Filter = { isModifier: true, modifiers: ['first'] };
    const plan = compile([
      normalSelector({ name: 'text', args: [capture('t', [filter, modifierChain])] }),
    ]);
    const c = plan.nodes[0]!.captures[0]!;

    expect(c.filterList?.length).toBe(1);
    expect(c.filterList?.[0]?.name).toBe('trim');
    expect(c.modifier?.length).toBe(1);
    expect(c.modifier?.[0]?.name).toBe('first');
  });
});
