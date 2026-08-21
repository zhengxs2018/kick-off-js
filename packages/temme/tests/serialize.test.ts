import { describe, it, expect } from 'bun:test';
import { compile } from '../src/compiler/index.js';
import { deserialize, serialize } from '../src/compiler/index.js';
import type { Capture, Filter, NormalSelector } from '../src/compiler/index.js';

/**
 * serialize / deserialize：纯 POJO 计划的序列化往返契约。
 *
 * 验证点（H1'）：编译期正则降维为 {$regex} 字典，serialize 后保持字典态，
 * deserialize 经 `JSON.parse` reviver 在解析流中原子级还原为 RegExp，无后续遍历。
 */

function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return { name, typeAnnotation: null, filterList: null, modifier: null, ...extra };
}

function normalSelector(extra: Partial<NormalSelector> = {}): NormalSelector {
  return {
    type: 'normal-selector',
    sections: [{ combinator: ' ', element: 'div', qualifiers: [] }],
    procedure: null,
    arrayCapture: null,
    children: [],
    ...extra,
  };
}

describe('serialize 保持纯数据（正则字典态）', () => {
  it('含正则的计划 serialize 后仍是 {$regex} 字典，非 RegExp 实例', () => {
    const regexFilter: Filter = { isArrayFilter: false, name: 'test', args: [/\d+/g] };
    const plan = compile([
      normalSelector({
        procedure: { name: 'find', args: [capture('p', { filterList: [regexFilter] })] },
      }),
    ]);

    const json = serialize(plan);
    const parsed = JSON.parse(json);
    const arg = parsed.nodes[0].captures[0].filterList[0].args[0];

    expect(arg).toEqual({ $regex: true, source: '\\d+', flags: 'g' });
    expect(arg instanceof RegExp).toBe(false);
  });

  it('基础字面量在序列化后形态不变', () => {
    const plan = compile([normalSelector({ procedure: { name: 'text', args: [capture('t')] } })]);
    const json = serialize(plan);
    expect(JSON.parse(json).nodes[0].css).toBe('div');
  });
});

describe('deserialize 还原纯数据计划', () => {
  it('反序列化后正则已原子级还原为 RegExp 实例', () => {
    const regexFilter: Filter = { isArrayFilter: false, name: 'match', args: [/a/i] };
    const plan = compile([
      normalSelector({
        procedure: { name: 'find', args: [capture('p', { filterList: [regexFilter] })] },
      }),
    ]);
    const restored = deserialize(serialize(plan));

    expect(restored.nodes[0].captures[0].filterList![0].args[0] instanceof RegExp).toBe(true);
    expect((restored.nodes[0].captures[0].filterList![0].args[0] as unknown as RegExp).source).toBe(
      'a',
    );
    expect(restored.manifest?.procedures).toContain('find');
  });

  it('deserialize 不补默认值、信任输入（缺 manifest 即无）', () => {
    const json = JSON.stringify({
      roots: [0],
      nodes: [{ parentId: null, css: 'x', captures: [], children: [] }],
    });
    const restored = deserialize(json);
    expect('manifest' in restored).toBe(false);
  });
});

describe('deserialize 内建还原 RegExp', () => {
  it('{$regex} 字典被还原为可执行的 RegExp 实例', () => {
    const regexFilter: Filter = { isArrayFilter: false, name: 'match', args: [/\d+/g] };
    const plan = compile([
      normalSelector({
        procedure: { name: 'find', args: [capture('p', { filterList: [regexFilter] })] },
      }),
    ]);
    const restored = deserialize(serialize(plan));

    const regexArg = restored.nodes[0].captures[0].filterList![0].args[0];
    expect(regexArg instanceof RegExp).toBe(true);
    expect((regexArg as RegExp).source).toBe('\\d+');
    expect((regexArg as RegExp).flags).toBe('g');
    expect((regexArg as RegExp).test('abc123')).toBe(true);
  });

  it('多正则分别还原且 source/flags 正确', () => {
    const f1: Filter = { isArrayFilter: false, name: 'a', args: [/\w+/] };
    const f2: Filter = { isArrayFilter: false, name: 'b', args: [/[A-Z]/i] };
    const plan = compile([
      normalSelector({
        procedure: { name: 'find', args: [capture('p', { filterList: [f1, f2] })] },
      }),
    ]);
    const restored = deserialize(serialize(plan));

    const args = restored.nodes[0].captures[0].filterList!.map(f => f.args[0]);
    expect((args[0] as RegExp).flags).toBe('');
    expect((args[1] as RegExp).flags).toBe('i');
  });

  it('字面量（非正则）不受影响', () => {
    const plan = compile([normalSelector({ procedure: { name: 'text', args: [capture('t')] } })]);
    const restored = deserialize(serialize(plan));
    expect(restored.nodes[0].captures[0].procedureName).toBe('text');
  });
});

describe('往返等价性', () => {
  it('serialize → deserialize 与原始 compile 产出等价（含正则维度）', () => {
    const regexFilter: Filter = { isArrayFilter: false, name: 'match', args: [/\s+/] };
    const original = compile([
      normalSelector({
        procedure: { name: 'find', args: [capture('p', { filterList: [regexFilter] })] },
      }),
    ]);
    const round = deserialize(serialize(original));

    expect(round.nodes[0].captures[0].procedureName).toBe(
      original.nodes[0].captures[0].procedureName,
    );
    expect(round.nodes[0].captures[0].hasNonBuiltinProcedure).toBe(true);
    expect(round.nodes[0].captures[0].filterList![0].args[0] instanceof RegExp).toBe(true);
  });
});
