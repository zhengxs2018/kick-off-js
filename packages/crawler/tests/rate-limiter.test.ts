import { describe, expect, it } from 'bun:test';

import { createHostRateLimiter, type HostRateLimiter } from '../src/capabilities/http.js';

/** 记录并发 acquire 的实际发起时刻，验证最小间隔符合令牌桶速率。 */
function timeSpread(
  acquire: (host: string) => Promise<void>,
  host: string,
  n: number,
): Promise<number[]> {
  const marks: Array<number> = [];
  const started = performance.now();
  return new Promise(resolve => {
    let done = 0;
    for (let i = 0; i < n; i++) {
      acquire(host).then(() => {
        marks.push(performance.now() - started);
        done++;
        if (done === n) resolve(marks);
      });
    }
  });
}

describe('createHostRateLimiter', () => {
  it('rate 缺省时用默认 1 QPS（首次立即，第二次需等约 1s）', async () => {
    const limiter: HostRateLimiter = createHostRateLimiter();
    const start = performance.now();
    await limiter.acquire('a.test');
    // 首次不应有明显延迟（令牌桶初始有额度）
    expect(performance.now() - start).toBeLessThan(50);
    await limiter.acquire('a.test');
    // 第二次受默认 1 QPS 约束
    expect(performance.now() - start).toBeGreaterThanOrEqual(800);
  });

  it('rate: 0 全局关闭限速，并发立即可用', async () => {
    const limiter = createHostRateLimiter(0);
    const start = performance.now();
    await Promise.all([
      limiter.acquire('a.test'),
      limiter.acquire('a.test'),
      limiter.acquire('a.test'),
    ]);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('rate 为 number 时对所有 host 生效（不依赖 host 列表）', async () => {
    const limiter = createHostRateLimiter(10); // 间隔 100ms
    const start = performance.now();
    await limiter.acquire('any.test');
    await limiter.acquire('any.test');
    expect(performance.now() - start).toBeGreaterThanOrEqual(80);
  });

  it('rate 为对象时未列出的 host 不限速（对象即完整声明）', async () => {
    const limiter = createHostRateLimiter({ 'other.test': 1 });
    const start = performance.now();
    await limiter.acquire('missing.test');
    await limiter.acquire('missing.test');
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("rate 对象支持通配键 '*' 兜底未列出的 host", async () => {
    // fast.test 覆盖为 20 QPS（50ms），其余 host 走 '*' 的 10 QPS（100ms）
    const limiter = createHostRateLimiter({ 'fast.test': 20, '*': 10 });
    const fastStart = performance.now();
    await limiter.acquire('fast.test');
    await limiter.acquire('fast.test');
    const fastCost = performance.now() - fastStart;
    expect(fastCost).toBeGreaterThanOrEqual(40);
    expect(fastCost).toBeLessThan(100);

    const otherStart = performance.now();
    await limiter.acquire('other.test');
    await limiter.acquire('other.test');
    expect(performance.now() - otherStart).toBeGreaterThanOrEqual(80);
  });

  it("rate 对象内某 host 设 0 可覆盖 '*' 兜底关闭该 host 限速", async () => {
    const limiter = createHostRateLimiter({ 'free.test': 0, '*': 1 });
    const start = performance.now();
    await limiter.acquire('free.test');
    await limiter.acquire('free.test');
    await limiter.acquire('free.test');
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('同 host 并发按 qps 串行化，最小间隔 ≈ 1000/qps（修复 TOCTOU 竞态）', async () => {
    const qps = 10; // 间隔 100ms
    const limiter = createHostRateLimiter({ 'x.test': qps });
    const marks = await timeSpread(limiter.acquire.bind(limiter), 'x.test', 4);
    marks.sort((a, b) => a - b);
    // 第 2~4 次的间隔应 >= 间隔的 80%（容忍定时器抖动），证明未被并发打满
    const gap1 = marks[1] - marks[0];
    const gap2 = marks[2] - marks[1];
    const gap3 = marks[3] - marks[2];
    const minGap = (1000 / qps) * 0.8;
    expect(gap1).toBeGreaterThanOrEqual(minGap);
    expect(gap2).toBeGreaterThanOrEqual(minGap);
    expect(gap3).toBeGreaterThanOrEqual(minGap);
    // 总耗时 ≈ (n-1) * 间隔
    expect(marks[3]).toBeGreaterThanOrEqual((1000 / qps) * 2.5);
  });

  it('不同 host 之间互不阻塞', async () => {
    const limiter = createHostRateLimiter({ 'a.test': 2, 'b.test': 2 });
    const aStart = performance.now();
    await limiter.acquire('a.test');
    await limiter.acquire('a.test');
    const aCost = performance.now() - aStart;
    const bStart = performance.now();
    await limiter.acquire('b.test');
    const bCost = performance.now() - bStart;
    // a 两次被限速（≈500ms），b 单次不受 a 影响（<100ms）
    expect(aCost).toBeGreaterThanOrEqual(400);
    expect(bCost).toBeLessThan(100);
  });
});
