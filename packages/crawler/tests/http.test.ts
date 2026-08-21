import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { createHttpClient } from '../src/capabilities/http.js';

type FetchMock = typeof globalThis.fetch;

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers,
  });
}

function textResponse(text: string, init?: { status?: number }): Response {
  return new Response(text, { status: init?.status ?? 200 });
}

describe('createHttpClient', () => {
  let original: FetchMock;
  let calls: Array<{ url: string; init?: RequestInit }>;

  beforeEach(() => {
    original = globalThis.fetch;
    calls = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return jsonResponse({ ok: true });
    }) as FetchMock;
  });

  afterEach(() => {
    globalThis.fetch = original;
    mock.restore();
  });

  it('get 发 GET 请求，默认带 UA 与 Accept 头', async () => {
    const client = createHttpClient({});
    const res = await client.get('https://example.com/page');
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://example.com/page');
    const headers = new Headers(calls[0]!.init!.headers);
    expect(headers.get('User-Agent')).toContain('Mozilla');
    expect(headers.get('Accept')).toContain('text/html');
  });

  it('相对路径按 baseURL 拼成绝对 URL', async () => {
    const client = createHttpClient({ baseURL: 'https://api.test/v1' });
    await client.get('/users');
    expect(calls[0]!.url).toBe('https://api.test/users');
  });

  it('toURL 已是绝对 URL 则原样返回', () => {
    const client = createHttpClient({ baseURL: 'https://api.test' });
    expect(client.toURL('https://other.test/x').href).toBe('https://other.test/x');
  });

  it('post 发送请求体与方法', async () => {
    const client = createHttpClient({});
    const res = await client.post('https://example.com/submit', JSON.stringify({ a: 1 }), {
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(200);
    expect(calls[0]!.init!.method).toBe('POST');
    expect(calls[0]!.init!.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('init 的 headers 可覆盖默认 UA', async () => {
    const client = createHttpClient({ headers: { 'User-Agent': 'custom/1.0' } });
    await client.get('https://example.com');
    const headers = new Headers(calls[0]!.init!.headers);
    expect(headers.get('User-Agent')).toBe('custom/1.0');
  });

  it('fetch 抛网络错误时按 maxRetries 重试并最终抛出', async () => {
    let attempt = 0;
    globalThis.fetch = (async () => {
      attempt++;
      throw new Error('network down');
    }) as FetchMock;
    const client = createHttpClient({ maxRetries: 2 });
    await expect(client.get('https://example.com')).rejects.toThrow('network down');
    expect(attempt).toBe(3); // 初始 1 + 重试 2
  });

  it('signal 已 abort 时 acquire 立即抛 AbortError，不发起 fetch', async () => {
    let attempt = 0;
    globalThis.fetch = (async () => {
      attempt++;
      throw new Error('boom');
    }) as FetchMock;
    const signal = AbortSignal.abort();
    const client = createHttpClient({ maxRetries: 5 });
    await expect(client.get('https://example.com', { signal })).rejects.toThrow('Aborted');
    expect(attempt).toBe(0);
  });

  it('重试期间某次成功即返回（不抛）', async () => {
    let attempt = 0;
    globalThis.fetch = (async () => {
      attempt++;
      if (attempt < 2) throw new Error('transient');
      return textResponse('recovered');
    }) as FetchMock;
    const client = createHttpClient({ maxRetries: 3 });
    const res = await client.get('https://example.com');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('recovered');
    expect(attempt).toBe(2);
  });

  it('返回非 JSON 文本响应体可读', async () => {
    globalThis.fetch = (async () => textResponse('<html>hi</html>')) as FetchMock;
    const client = createHttpClient({});
    const res = await client.get('https://example.com');
    expect(await res.text()).toBe('<html>hi</html>');
  });
});
