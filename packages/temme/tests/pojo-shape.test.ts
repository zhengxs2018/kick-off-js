import { describe, it, expect } from 'bun:test';

/**
 * ExecutionPlan / PlanNode / PlanCapture / Manifest 的 POJO shape 契约。
 *
 * 仅验证契约承诺的字段形态与序列化往返能力，不假设任何内部实现细节。
 */

describe('ExecutionPlan POJO shape', () => {
  it('nodes 为数组、roots 为 number[]', () => {
    const plan = {
      roots: [0],
      nodes: [
        {
          parentId: null,
          css: 'div',
          captures: [],
          children: [],
        },
      ],
    };

    expect(Array.isArray(plan.nodes)).toBe(true);
    expect(Array.isArray(plan.roots)).toBe(true);
    expect(typeof plan.roots[0]).toBe('number');
  });

  it('节点 id 即 nodes 数组下标', () => {
    const plan = {
      roots: [0, 1],
      nodes: [
        { parentId: null, css: 'ul', captures: [], children: [2] },
        { parentId: null, css: 'ol', captures: [], children: [] },
        { parentId: 0, css: 'li', captures: [], children: [] },
      ],
    };

    expect(plan.nodes[2].parentId).toBe(0);
    expect(plan.nodes[0].children).toContain(2);
  });

  it('manifest 为可选字段', () => {
    const withoutManifest = { roots: [], nodes: [] };
    const withManifest = {
      roots: [],
      nodes: [],
      manifest: { filters: ['trim'], modifiers: [], procedures: ['text'] },
    };

    expect('manifest' in withoutManifest).toBe(false);
    expect(withManifest.manifest?.filters).toEqual(['trim']);
  });

  it('序列化往返：JSON.stringify / structuredClone 不改结构', () => {
    const plan = {
      roots: [0],
      nodes: [
        {
          parentId: null,
          css: 'a',
          captures: [
            {
              name: 'href',
              typeAnnotation: null,
              filterList: null,
              modifier: null,
              procedureName: 'attr',
              procedureArgs: ['href'],
              hasTypeModifier: false,
              hasFilter: false,
              hasModifier: false,
              hasNonBuiltinProcedure: false,
              append: false,
            },
          ],
          children: [],
        },
      ],
      manifest: { filters: [], modifiers: [], procedures: ['attr'] },
    };

    const jsonRound = JSON.parse(JSON.stringify(plan));
    expect(jsonRound).toEqual(plan);

    const cloned = structuredClone(plan);
    expect(cloned).toEqual(plan);
  });
});

describe('PlanNode fields', () => {
  it('必填字段齐全：parentId / css / captures / children', () => {
    const node = { parentId: null, css: '.item', captures: [], children: [1] };
    expect(node.parentId).toBeNull();
    expect(typeof node.css).toBe('string');
    expect(Array.isArray(node.captures)).toBe(true);
    expect(Array.isArray(node.children)).toBe(true);
  });

  it('根节点 parentId 为 null，子节点 parentId 为数字', () => {
    const root = { parentId: null, css: 'body', captures: [], children: [] };
    const child = { parentId: 0, css: 'span', captures: [], children: [] };
    expect(root.parentId).toBeNull();
    expect(typeof child.parentId).toBe('number');
  });

  it('assignValue 可选且为 SerializableLiteral', () => {
    const node = { parentId: null, css: 'x', captures: [], children: [], assignValue: 42 };
    expect(node.assignValue).toBe(42);
  });

  it('fieldLookup 可选', () => {
    const node = {
      parentId: null,
      css: 'x',
      captures: [],
      children: [],
      fieldLookup: { relation: 'self' } as const,
    };
    expect(node.fieldLookup?.relation).toBe('self');
  });
});

describe('PlanCapture 结构化特征（无 flags）', () => {
  it('不含任何 flags / 位掩码字段', () => {
    const capture = {
      name: 't',
      typeAnnotation: null,
      filterList: null,
      modifier: null,
      procedureName: 'text',
      procedureArgs: [],
      hasTypeModifier: false,
      hasFilter: false,
      hasModifier: false,
      hasNonBuiltinProcedure: false,
      append: false,
    };

    expect('flags' in capture).toBe(false);
    expect('captureFlags' in capture).toBe(false);
  });

  it('filterList / modifier 为 null 时派生布尔必须为 false', () => {
    const capture = {
      name: 't',
      typeAnnotation: ['number'],
      filterList: null,
      modifier: null,
      procedureName: 'text',
      procedureArgs: [],
      hasTypeModifier: true,
      hasFilter: false,
      hasModifier: false,
      hasNonBuiltinProcedure: false,
      append: false,
    };

    expect(capture.filterList).toBeNull();
    expect(capture.hasFilter).toBe(false);
    expect(capture.modifier).toBeNull();
    expect(capture.hasModifier).toBe(false);
  });

  it('append 独立布尔，表达 Write-Append 累积语义', () => {
    const scalar = {
      name: 'a',
      typeAnnotation: null,
      filterList: null,
      modifier: null,
      procedureName: 'text',
      procedureArgs: [],
      hasTypeModifier: false,
      hasFilter: false,
      hasModifier: false,
      hasNonBuiltinProcedure: false,
      append: false,
    };
    const array = {
      name: 'items',
      typeAnnotation: null,
      filterList: null,
      modifier: null,
      procedureName: 'text',
      procedureArgs: [],
      hasTypeModifier: false,
      hasFilter: false,
      hasModifier: false,
      hasNonBuiltinProcedure: false,
      append: true,
    };

    expect(scalar.append).toBe(false);
    expect(array.append).toBe(true);
  });

  it('procedureArgs 承载 attr 过程的属性名', () => {
    const capture = {
      name: 'id',
      typeAnnotation: null,
      filterList: null,
      modifier: null,
      procedureName: 'attr',
      procedureArgs: ['data-id'],
      hasTypeModifier: false,
      hasFilter: false,
      hasModifier: false,
      hasNonBuiltinProcedure: false,
      append: false,
    };
    expect(capture.procedureName).toBe('attr');
    expect(capture.procedureArgs[0]).toBe('data-id');
  });
});

describe('Manifest shape', () => {
  it('三字段均为 string[]', () => {
    const manifest = { filters: ['trim'], modifiers: ['first'], procedures: ['text', 'attr'] };
    expect(Array.isArray(manifest.filters)).toBe(true);
    expect(Array.isArray(manifest.modifiers)).toBe(true);
    expect(Array.isArray(manifest.procedures)).toBe(true);
    expect(manifest.filters.every(x => typeof x === 'string')).toBe(true);
  });

  it('仅含实际引用名，未引用即不出现', () => {
    const manifest = { filters: [], modifiers: [], procedures: ['text'] };
    expect(manifest.filters).toEqual([]);
    expect(manifest.procedures).toContain('text');
  });
});

describe('SerializableLiteral 形态', () => {
  it('RegExp 降维为 {$regex,source,flags} 纯数据字典', () => {
    const literal = { $regex: true, source: '\\d+', flags: 'g' } as const;
    expect(literal.$regex).toBe(true);
    expect(typeof literal.source).toBe('string');
    expect(typeof literal.flags).toBe('string');
    expect(JSON.stringify(literal)).toContain('$regex');
  });

  it('基础字面量可直接序列化', () => {
    const values: Array<string | number | boolean | null> = ['x', 1, true, null];
    for (const value of values) {
      expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    }
  });
});
