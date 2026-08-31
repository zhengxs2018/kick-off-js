import { describe, expect, test } from 'bun:test';

import { disposeAll } from '../../src/common/event.js';

class Tracked implements Disposable {
  disposed = false;
  [Symbol.dispose](): void {
    this.disposed = true;
  }
}

class Throwing implements Disposable {
  [Symbol.dispose](): void {
    throw new Error('dispose failed');
  }
}

class AbortThrowing implements Disposable {
  [Symbol.dispose](): void {
    throw new DOMException('already aborted', 'AbortError');
  }
}

describe('disposeAll', () => {
  test('disposes every disposable', () => {
    const a = new Tracked();
    const b = new Tracked();
    disposeAll([a, b]);
    expect(a.disposed).toBe(true);
    expect(b.disposed).toBe(true);
  });

  test('ignores AbortError from disposables', () => {
    const a = new Tracked();
    const b = new AbortThrowing();
    expect(() => disposeAll([a, b])).not.toThrow();
    expect(a.disposed).toBe(true);
  });

  test('collects non-abort errors into AggregateError', () => {
    const a = new Throwing();
    const b = new Throwing();
    let caught: unknown;
    try {
      disposeAll([a, b]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    const agg = caught as AggregateError;
    expect(agg.errors).toHaveLength(2);
    expect(agg.message).toContain('during disposal');
  });

  test('tolerates empty input', () => {
    expect(() => disposeAll([])).not.toThrow();
  });
});
