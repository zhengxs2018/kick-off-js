import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import { createRpcRegistry } from '../core/registry.js';
import type { RpcProcedure } from '../core/schema.js';

function makeProc(name: string): RpcProcedure {
  return { name, handler: () => undefined };
}

describe('createRpcRegistry', () => {
  test('register then get returns the same procedure', () => {
    const reg = createRpcRegistry();
    const proc = makeProc('echo');
    reg.register(proc);
    expect(reg.get('echo')).toBe(proc);
  });

  test('list reflects registered names', () => {
    const reg = createRpcRegistry();
    reg.register(makeProc('a'));
    reg.register(makeProc('b'));
    expect(reg.list().sort()).toEqual(['a', 'b']);
  });

  test('duplicate registration throws', () => {
    const reg = createRpcRegistry();
    reg.register(makeProc('echo'));
    expect(() => reg.register(makeProc('echo'))).toThrow(/Duplicate RPC procedure: echo/);
  });

  test('unregister removes the procedure', () => {
    const reg = createRpcRegistry();
    const off = reg.register(makeProc('echo'));
    off();
    expect(reg.get('echo')).toBeUndefined();
    expect(reg.list()).toEqual([]);
  });

  test('re-register after unregister succeeds', () => {
    const reg = createRpcRegistry();
    const off = reg.register(makeProc('echo'));
    off();
    reg.register(makeProc('echo'));
    expect(reg.get('echo')).toBeDefined();
  });

  test('clear wipes all procedures', () => {
    const reg = createRpcRegistry();
    reg.register(makeProc('a'));
    reg.register(makeProc('b'));
    reg.clear();
    expect(reg.list()).toEqual([]);
  });

  test('preserves typed input schema reference', () => {
    const reg = createRpcRegistry();
    const input = z.number();
    const proc: RpcProcedure<typeof input> = { name: 'add', input, handler: () => 0 };
    reg.register(proc);
    const stored = reg.get('add') as RpcProcedure<typeof input> | undefined;
    expect(stored?.input).toBe(input);
  });

  test('register accepts void-typed procedure', () => {
    const reg = createRpcRegistry();
    const proc: RpcProcedure = { name: 'tick', handler: () => undefined };
    reg.register(proc);
    expect(reg.get('tick')).toBe(proc);
  });
});
