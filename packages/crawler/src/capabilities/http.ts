/**
 * 创建原生 http 客户端
 *
 * @returns 满足 HttpClient 契约的客户端实例
 */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

  const {
    baseURL,
    maxRetries = 3,
    headers: defaultHeaders = {},
    limiter = createHostRateLimiter(1),
  } = options;

  return { toURL, get, post };

  function toURL(pathOrUrl: string | URL): URL {
    return pathOrUrl instanceof URL ? pathOrUrl : new URL(pathOrUrl, baseURL);
  }

  async function request(
    method: string,
    pathOrUrl: string | URL,
    body?: BodyInit | null,
    init?: RequestInit,
  ): Promise<Response> {
    const url = toURL(pathOrUrl);
    await limiter.acquire(url.hostname, init?.signal === null ? undefined : init?.signal);
    const headers = new Headers(defaultHeaders);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has('User-Agent')) headers.set('User-Agent', DEFAULT_UA);
    if (!headers.has('Accept'))
      headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const init2: RequestInit = { ...init, method, headers, redirect: 'follow' };
        if (body !== undefined && body !== null) init2.body = body;
        return await fetch(url, init2);
      } catch (error) {
        lastError = error;
        if (init?.signal?.aborted) throw error;
        if (attempt < maxRetries) continue;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`request failed: ${url}`);
  }

  function get(pathOrUrl: string | URL, init?: RequestInit): Promise<Response> {
    return request('GET', pathOrUrl, undefined, init);
  }

  function post(
    pathOrUrl: string | URL,
    body?: BodyInit | null,
    init?: RequestInit,
  ): Promise<Response> {
    return request('POST', pathOrUrl, body, init);
  }
}

export interface HttpClientOptions {
  /** 基准 URL：相对路径经 toURL 拼接为绝对 URL */
  readonly baseURL?: string;
  /** 失败重试次数（网络错误 / 503 等），默认 3 */
  readonly maxRetries?: number;
  /**
   * 主机级礼貌限速器。缺省 `createHostRateLimiter(1)`（默认 1 QPS）；外部可注入自定义限速器
   * （如 `createHostRateLimiter({ 'a.com': 5, '*': 1 })` 或任意实现 HostRateLimiter 的实例）。
   */
  readonly limiter?: HostRateLimiter;
  /** 默认请求头（UA 等），可被每次请求覆盖 */
  readonly headers?: Record<string, string>;
}

export interface HttpClient {
  /**
   * 把相对路径按 baseURL 拼成绝对 URL；已是绝对 URL 则原样返回
   *
   * @param pathOrUrl - 相对路径或绝对 URL
   * @returns 标准化后的绝对 URL
   */
  toURL(pathOrUrl: string | URL): URL;
  /**
   * GET 请求（带 baseURL 拼接 / 限速 / 重试 / 默认头）。
   *
   * @param pathOrUrl - 相对路径或绝对 URL
   * @param init - 标准 RequestInit
   * @returns 标准 Response
   */
  get(pathOrUrl: string | URL, init?: RequestInit): Promise<Response>;
  /**
   * POST 请求。
   *
   * @param pathOrUrl - 相对路径或绝对 URL
   * @param body - 请求体
   * @param init - 标准 RequestInit
   * @returns 标准 Response
   */
  post(pathOrUrl: string | URL, body?: BodyInit | null, init?: RequestInit): Promise<Response>;
}

/**
 * 按 host 礼貌限速器。每 host 一条 Promise 链串行化「读-算-写」消除 TOCTOU；等待受 AbortSignal 控制。
 */
export interface HostRateLimiter {
  /**
   * 预约下一发请求的时刻。
   *
   * @param host - 目标主机
   * @param signal - 可选取消信号
   */
  acquire(host: string, signal?: AbortSignal): Promise<void>;
}

/**
 * 创建按 host 礼貌限速器
 *
 * @param rate - 限速配置，默认不限速
 * @returns 限速器实例
 */
export function createHostRateLimiter(rate?: RateConfig): HostRateLimiter {
  const gate = new Map<string, Promise<number>>();

  return {
    async acquire(host, signal) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const qps = resolveQps(rate, host);
      if (qps === undefined || qps <= 0) return;

      const prev = gate.get(host) || Promise.resolve(0);
      const inner = prev.then(base => {
        const now = performance.now();
        const ready = Math.max(now, base);
        const wait = ready - now;
        const target = ready + 1000 / qps;

        return wait > 0 ? waitFor(target, wait, signal) : target;
      });

      // abort 时链值折回 now 而非 reject，避免 rejected promise 驻留污染后续请求。
      gate.set(
        host,
        inner.catch(() => performance.now()),
      );
      await inner;
    },
  };

  /** 受 AbortSignal 控制的一次性等待（http 能力层内部，可中止、不卡 flush） */
  function waitFor(target: number, wait: number, signal?: AbortSignal): Promise<number> {
    const { promise, resolve, reject } = Promise.withResolvers<number>();

    const timer = setTimeout(() => {
      if (signal?.aborted) return;
      resolve(target);
    }, wait);

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    return promise;

    function onAbort(): void {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }
  }

  /**
   * 按 host 解析 qps。
   *
   * - number：全局限速（含绝对 URL 跨 host）。
   * - Record：按 host 取数，未列出的 host 用通配键 `'*'` 兜底；两条均为 undefined 则不限速。
   * - undefined：用默认 1 QPS。
   */
  function resolveQps(
    rate: number | Readonly<Record<string, number>> | undefined,
    host: string,
  ): number | undefined {
    if (typeof rate === 'number') return rate;
    if (rate === undefined) return 1;
    return rate[host] !== undefined ? rate[host] : rate['*'];
  }
}

export type RateConfig = number | Readonly<Record<string, number>>;
