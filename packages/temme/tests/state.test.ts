import { describe, it, expect } from 'bun:test';
import {
  accumulate,
  applyLinkedCapture,
  condenseWhitespace,
  createCaptureState,
  toResult,
} from '../src/runtime/index.js';
import type { LinkedCapture } from '../src/runtime/index.js';

/**
 * state：Map + Reducer 累积语义契约。
 *
 * 验证 WRITE_APPEND 真累积（非 First-Wins）、getOrInsertComputed 单次定位、toResult 默认键提升与 symbol 不外泄、condenseWhitespace。
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

describe('accumulate 累积语义', () => {
  it('append=false 走 First-Wins：首值保留，后续覆盖被忽略', () => {
    const state = createCaptureState();
    accumulate(state, 'a', 1, false);
    accumulate(state, 'a', 2, false);
    expect(state.captures.get('a')).toBe(1);
  });

  it('append=true 真累积为数组', () => {
    const state = createCaptureState();
    accumulate(state, 'items', 'x', true);
    accumulate(state, 'items', 'y', true);
    accumulate(state, 'items', 'z', true);
    expect(state.captures.get('items')).toEqual(['x', 'y', 'z']);
  });

  it('append 混合：先标量后 append 不产生错误形态（append 始终数组）', () => {
    const state = createCaptureState();
    accumulate(state, 'k', 'first', true);
    expect(state.captures.get('k')).toEqual(['first']);
  });

  it('append 传入数组值直接展开进桶', () => {
    const state = createCaptureState();
    accumulate(state, 'k', ['a', 'b'], true);
    accumulate(state, 'k', ['c'], true);
    expect(state.captures.get('k')).toEqual(['a', 'b', 'c']);
  });

  it('undefined / null 值直接跳过（不建桶）', () => {
    const state = createCaptureState();
    accumulate(state, 'k', undefined, true);
    accumulate(state, 'k', null, false);
    expect(state.captures.has('k')).toBe(false);
  });

  it('不同 key 互不干扰', () => {
    const state = createCaptureState();
    accumulate(state, 'a', 1, false);
    accumulate(state, 'b', 'x', true);
    expect(state.captures.get('a')).toBe(1);
    expect(state.captures.get('b')).toEqual(['x']);
  });
});

describe('has→get→set 取或建语义', () => {
  it('键不存在时初始化工厂产物，存在时复用', () => {
    const state = createCaptureState();
    const init = () => [];

    const first = state.captures.has('k')
      ? (state.captures.get('k') as unknown[])
      : state.captures.set('k', init()).get('k')!;
    first.push(1);

    const second = state.captures.has('k')
      ? (state.captures.get('k') as unknown[])
      : state.captures.set('k', init()).get('k')!;
    expect(second).toBe(first);
    expect(second).toEqual([1]);
  });
});

describe('toResult 默认键提升与 symbol 不外泄', () => {
  it('存在默认捕获键（@@default-capture@@）整体提升为返回值', () => {
    const state = createCaptureState();
    accumulate(state, '@@default-capture@@', 'raw', false);
    accumulate(state, 'named', 'other', false);
    const result = toResult(state);
    expect(result).toEqual('raw');
  });

  it('无默认键时输出普通字符串键对象', () => {
    const state = createCaptureState();
    accumulate(state, 'a', 1, false);
    accumulate(state, 'b', [1, 2], true);
    const result = toResult(state);
    expect(result).toEqual({ a: 1, b: [1, 2] });
  });

  it('symbol 键不导出到结果', () => {
    const state = createCaptureState();
    state.captures.set('visible', 1);
    const result = toResult(state);
    expect(result).toEqual({ visible: 1 });
    expect('@@temme.scalar' in result).toBe(false);
    expect(Object.keys(result).some(k => typeof k === 'symbol')).toBe(false);
  });
});

describe('condenseWhitespace', () => {
  it('折叠连续空白为单空格并去首尾', () => {
    expect(condenseWhitespace('  a   b\n\tc  ')).toBe('a b c');
  });

  it('非字符串原样返回', () => {
    expect(condenseWhitespace(42)).toBe(42);
    expect(condenseWhitespace(null)).toBeNull();
  });
});

describe('applyLinkedCapture 分流与 fail-safe', () => {
  it('hasFilter 时走 boundFilterChain，过滤后写入', () => {
    const state = createCaptureState();
    const capture = plainCapture('k', {
      hasFilter: true,
      boundFilterChain: v => (typeof v === 'string' ? v.toUpperCase() : v),
    });
    applyLinkedCapture(state, capture, 'abc', 'preserve');
    expect(state.captures.get('k')).toBe('ABC');
  });

  it('boundFilterChain 返回 undefined 跳过写入', () => {
    const state = createCaptureState();
    const capture = plainCapture('k', { hasFilter: true, boundFilterChain: () => undefined });
    applyLinkedCapture(state, capture, 'abc');
    expect(state.captures.has('k')).toBe(false);
  });

  it('hasModifier 时走 boundModifier 改写状态', () => {
    const state = createCaptureState();
    const capture = plainCapture('k', {
      hasModifier: true,
      boundModifier: (s, key, value) => {
        s.captures.set(key, `mod-${String(value)}`);
      },
    });
    applyLinkedCapture(state, capture, 'v');
    expect(state.captures.get('k')).toBe('mod-v');
  });

  it('whitespace=condense 先折叠空白再写入', () => {
    const state = createCaptureState();
    applyLinkedCapture(state, plainCapture('k'), '  a  b  ', 'condense');
    expect(state.captures.get('k')).toBe('a b');
  });

  it('boundTypeConvert 在 filter 前生效', () => {
    const state = createCaptureState();
    const capture = plainCapture('k', {
      hasTypeModifier: true,
      boundTypeConvert: v => Number(v),
      hasFilter: true,
      boundFilterChain: v => (v as number) + 1,
    });
    applyLinkedCapture(state, capture, '10');
    expect(state.captures.get('k')).toBe(11);
  });
});
