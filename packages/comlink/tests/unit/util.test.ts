import { describe, expect, test } from 'bun:test';

import {
  castToError,
  extractTransferables,
  isAbortError,
  isObject,
  unref,
} from '../../src/common/util.js';

describe('isObject', () => {
  test.each([
    [{}, true],
    [[], true],
    [new Date(), true],
    [null, false],
    [undefined, false],
    ['', false],
    [0, false],
    [() => {}, false],
  ])('isObject(%o) === %s', (value, expected) => {
    expect(isObject(value)).toBe(expected);
  });

  test('narrows type to object', () => {
    const value: unknown = { a: 1 };
    if (isObject(value)) {
      expect(value.a).toBe(1);
    }
  });
});

describe('isAbortError', () => {
  test('matches AbortError by name', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true);
  });

  test('rejects non-abort errors', () => {
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('castToError', () => {
  test('passes through Error instances', () => {
    const err = new Error('origin');
    expect(castToError(err)).toBe(err);
  });

  test('wraps string into Error', () => {
    const err = castToError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('boom');
  });

  test('wraps arbitrary values via String()', () => {
    expect(castToError(42).message).toBe('42');
    expect(castToError({ a: 1 }).message).toBe('[object Object]');
  });
});

describe('unref', () => {
  test('returns source when ref alive', () => {
    const target = {};
    const ref = new WeakRef(target);
    expect(unref(ref)).toBe(target);
  });

  test('throws AbortError when target collected', () => {
    let ref: WeakRef<object>;
    {
      const target = {};
      ref = new WeakRef(target);
    }
    // 主动提示 GC（无法保证回收，但 WeakRef 语义需覆盖分支）
    globalThis.gc?.();
    if (ref.deref()) {
      expect(unref(ref)).toBe(ref.deref());
    } else {
      expect(() => unref(ref)).toThrow(DOMException);
    }
  });

  test('returns undefined when ref is null', () => {
    expect(unref(null)).toBeUndefined();
  });
});

describe('extractTransferables', () => {
  test('extracts ArrayBuffer from array', () => {
    const buf = new ArrayBuffer(8);
    expect(extractTransferables([buf, 1, 'x'])).toEqual([buf]);
  });

  test('extracts single transferable value', () => {
    const buf = new ArrayBuffer(8);
    expect(extractTransferables(buf)).toEqual([buf]);
  });

  test('extracts from object values', () => {
    const a = new ArrayBuffer(4);
    const b = new ArrayBuffer(4);
    const result = extractTransferables({ a, b, nested: { c: a } });
    expect(result).toContain(a);
    expect(result).toContain(b);
  });

  test('returns empty for plain values', () => {
    expect(extractTransferables({ a: 1, b: 'x' })).toEqual([]);
    expect(extractTransferables(null)).toEqual([]);
  });

  test('supports MessagePort / streams', () => {
    const port = new MessageChannel().port1;
    expect(extractTransferables([port])).toEqual([port]);
    port.close();
  });
});
