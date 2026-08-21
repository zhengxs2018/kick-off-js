import { describe, expect, test } from 'bun:test';

import { RpcError } from '../core/error.js';

describe('RpcError', () => {
  test('构造后保留 code / message / data', () => {
    const err = new RpcError(-32601, 'Method not found', { method: 'missing' });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RpcError);
    expect(err.name).toBe('RpcError');
    expect(err.code).toBe(-32601);
    expect(err.message).toBe('Method not found');
    expect(err.data).toEqual({ method: 'missing' });
  });

  test('data 缺省为 undefined', () => {
    const err = new RpcError(-32700, 'Parse error');
    expect(err.data).toBeUndefined();
  });

  test('fromResponse 从 JSON-RPC 错误响应构造', () => {
    const err = RpcError.fromResponse({
      code: -32000,
      message: 'Server error',
      data: { cause: 'boom' },
    });

    expect(err).toBeInstanceOf(RpcError);
    expect(err.code).toBe(-32000);
    expect(err.message).toBe('Server error');
    expect(err.data).toEqual({ cause: 'boom' });
  });

  test('format 输出含 code / message / data 的可读文本', () => {
    const err = new RpcError(-32602, 'Invalid params', { field: 'age' });
    const text = err.format();

    expect(text).toContain('RpcError [-32602]: Invalid params');
    expect(text).toContain('"field":"age"');
  });

  test('toString 等价于 format', () => {
    const err = new RpcError(-1, 'boom');
    expect(err.toString()).toBe(err.format());
  });
});
