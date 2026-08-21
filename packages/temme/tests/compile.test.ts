import { describe, it, expect } from 'bun:test';
import { compile } from '../src/compiler/index.js';
import type {
  Assignment,
  Capture,
  DefineSelector,
  Filter,
  NormalSelector,
  ParentRefSelector,
  Procedure,
  SnippetDefine,
  SnippetExpand,
  Section,
} from '../src/compiler/index.js';

/**
 * compile：AST → 纯 POJO 执行计划的契约行为。
 *
 * 仅验证产出形状与特征标注（结构化布尔、RegExp 降维、fieldLookup 三种降维、manifest 收集实际引用）。
 * define / snippet 不产生节点，静默丢弃。
 */

function section(
  element: string,
  qualifiers: Section['qualifiers'] = [],
  combinator: Section['combinator'] = ' ',
): Section {
  return { combinator, element, qualifiers };
}

function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return {
    name,
    typeAnnotation: null,
    filterList: null,
    modifier: null,
    ...extra,
  };
}

function normalSelector(extra: Partial<NormalSelector> = {}): NormalSelector {
  return {
    type: 'normal-selector',
    sections: [section('div')],
    procedure: null,
    arrayCapture: null,
    children: [],
    ...extra,
  };
}

describe('compile RegExp 降维', () => {
  it('捕获参数中的 RegExp 降维为 {$regex,source,flags}', () => {
    const regexLiteral: Filter = { isArrayFilter: false, name: 'test', args: [/\d+/g] };
    const captureWithFilter = capture('price', { filterList: [regexLiteral] });
    const plan = compile([
      normalSelector({ procedure: { name: 'find', args: [captureWithFilter] } }),
    ]);
    const planCapture = plan.nodes[0]!.captures[0]!;
    const planFilter = planCapture.filterList![0]!;

    expect(planFilter.args[0]).toEqual({ $regex: true, source: '\\d+', flags: 'g' });
  });

  it('降维后计划可 JSON.stringify（RegExp 不静默丢失）', () => {
    const regexLiteral: Filter = { isArrayFilter: false, name: 'test', args: [/a/g] };
    const plan = compile([
      normalSelector({
        procedure: { name: 'find', args: [capture('x', { filterList: [regexLiteral] })] },
      }),
    ]);
    const json = JSON.stringify(plan);
    expect(json).toContain('$regex');
    expect(JSON.parse(json).nodes[0].captures[0].filterList[0].args[0]).toEqual({
      $regex: true,
      source: 'a',
      flags: 'g',
    });
  });
});

describe('compile 结构化布尔特征', () => {
  it('带 filter 时 hasFilter=true 且 filterList 非空', () => {
    const plan = compile([
      normalSelector({
        procedure: {
          name: 'text',
          args: [capture('t', { filterList: [{ isArrayFilter: false, name: 'trim', args: [] }] })],
        },
      }),
    ]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.hasFilter).toBe(true);
    expect(c.filterList).not.toBeNull();
  });

  it('无 filter 时 hasFilter=false 且 filterList 为 null', () => {
    const plan = compile([normalSelector({ procedure: { name: 'text', args: [capture('t')] } })]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.hasFilter).toBe(false);
    expect(c.filterList).toBeNull();
  });

  it('带修饰符链时 hasModifier=true', () => {
    const modifierChain: Filter = { isModifier: true, modifiers: ['first'] };
    const plan = compile([
      normalSelector({
        procedure: { name: 'text', args: [capture('t', { filterList: [modifierChain] })] },
      }),
    ]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.hasModifier).toBe(true);
    expect(c.modifier?.[0]?.name).toBe('first');
  });

  it('带类型注解时 hasTypeModifier=true', () => {
    const plan = compile([
      normalSelector({
        procedure: { name: 'text', args: [capture('n', { typeAnnotation: ['number'] })] },
      }),
    ]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.hasTypeModifier).toBe(true);
  });

  it('非内置过程（如 find）hasNonBuiltinProcedure=true', () => {
    const plan = compile([normalSelector({ procedure: { name: 'find', args: [capture('p')] } })]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.hasNonBuiltinProcedure).toBe(true);
    expect(c.procedureName).toBe('find');
  });

  it('内置过程 text 时 hasNonBuiltinProcedure=false', () => {
    const plan = compile([normalSelector({ procedure: { name: 'text', args: [capture('p')] } })]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.hasNonBuiltinProcedure).toBe(false);
  });

  it('数组捕获 append=true', () => {
    const plan = compile([normalSelector({ arrayCapture: capture('items') })]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.append).toBe(true);
  });

  it('标量捕获 append=false', () => {
    const plan = compile([normalSelector({ procedure: { name: 'text', args: [capture('t')] } })]);
    const c = plan.nodes[0]!.captures[0]!;
    expect(c.append).toBe(false);
  });
});

describe('compile fieldLookup 三种降维', () => {
  it('单片段可直取 → relation=child', () => {
    const plan = compile([
      normalSelector({
        sections: [section('span', [{ type: 'class-qualifier', className: 'x' }])],
      }),
    ]);
    const fl = plan.nodes[0]!.fieldLookup!;
    expect(fl.relation).toBe('child');
    if (fl.relation === 'child') {
      expect(fl.strategy.kind).toBe('class');
    }
  });

  it('多片段 → relation=parent + steps', () => {
    const plan = compile([
      normalSelector({
        sections: [section('ul'), section('li', [{ type: 'class-qualifier', className: 'x' }])],
      }),
    ]);
    const fl = plan.nodes[0]!.fieldLookup!;
    expect(fl.relation).toBe('parent');
    if (fl.relation === 'parent') {
      expect(fl.steps).toBe(1);
    }
  });

  it('无法直取的伪类 → relation=fallback 带回退 css', () => {
    const plan = compile([
      normalSelector({
        sections: [
          section('li', [{ type: 'pseudo-qualifier', name: 'first-child', content: null }]),
        ],
      }),
    ]);
    const fl = plan.nodes[0]!.fieldLookup!;
    expect(fl.relation).toBe('fallback');
    if (fl.relation === 'fallback') {
      expect(typeof fl.css).toBe('string');
    }
  });
});

describe('compile manifest 仅含实际引用名', () => {
  it('filters/modifiers/procedures 只登记被引用者', () => {
    const filter: Filter = { isArrayFilter: false, name: 'trim', args: [] };
    const modifierChain: Filter = { isModifier: true, modifiers: ['first'] };
    const plan = compile([
      normalSelector({
        procedure: { name: 'find', args: [capture('a', { filterList: [filter, modifierChain] })] },
      }),
    ]);
    const manifest = plan.manifest!;
    expect(manifest.filters).toContain('trim');
    expect(manifest.modifiers).toContain('first');
    expect(manifest.procedures).toContain('find');
    expect(manifest.filters).not.toContain('unusued-filter');
  });
});

describe('compile 丢弃 define / snippet', () => {
  it('filter-define / modifier-define / procedure-define 不产生节点', () => {
    const define: DefineSelector = {
      type: 'filter-define',
      name: 'f',
      argsPart: 'x',
      code: 'return x;',
    };
    const plan = compile([define]);
    expect(plan.nodes.length).toBe(0);
    expect(plan.roots.length).toBe(0);
  });

  it('snippet-define / snippet-expand 不产生节点', () => {
    const snippet: SnippetDefine = { type: 'snippet-define', name: 's', selectors: [] };
    const expand: SnippetExpand = { type: 'snippet-expand', name: 's' };
    const plan = compile([snippet, expand]);
    expect(plan.nodes.length).toBe(0);
  });

  it('混合：define 被丢弃、normal-selector 保留', () => {
    const define: DefineSelector = { type: 'procedure-define', name: 'p', argsPart: '', code: '' };
    const plan = compile([
      define,
      normalSelector({ procedure: { name: 'text', args: [capture('t')] } }),
    ]);
    expect(plan.nodes.length).toBe(1);
    expect(plan.roots.length).toBe(1);
  });
});

describe('compile 赋值语句', () => {
  it('assignment 产出带 assignValue 的节点，procedureName 默认 text', () => {
    const assignment: Assignment = { type: 'assignment', capture: capture('k'), value: 42 };
    const plan = compile([assignment]);
    const node = plan.nodes[0]!;
    expect(node.assignValue).toBe(42);
    expect(node.captures[0]!.procedureName).toBe('text');
  });
});

describe('compile 父引用选择器', () => {
  it('parent-ref-selector fieldLookup 归为 self', () => {
    const parentRef: ParentRefSelector = {
      type: 'parent-ref-selector',
      section: section('span'),
      procedure: { name: 'text', args: [capture('t')] },
    };
    const plan = compile([parentRef]);
    expect(plan.nodes[0]!.fieldLookup).toEqual({ relation: 'self' });
  });
});
