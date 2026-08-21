/**
 * node 周期调度（对等 bun 的 `createCronScheduler`）。node 无 `bun:cron`，以 setInterval 等价触发，
 * 接口形态与 bun 版对齐（返回 `{ stop() }`），abort 时自动停止；不保持 node 事件循环存活（与 bun cron 行为一致）。
 *
 * @param intervalMs - 触发间隔（毫秒），硬下限 1
 * @param onTick - 每次触发的回调
 * @param signal - 可选取消信号；abort 时停止调度
 * @returns 满足 IntervalScheduler 的调度器实例
 */
export function createIntervalScheduler(
  intervalMs: number,
  onTick: () => void,
  signal?: AbortSignal,
): IntervalScheduler {
  const timer = setInterval(
    () => {
      if (signal?.aborted) return;
      onTick();
    },
    Math.max(1, intervalMs),
  );
  if (typeof timer.unref === 'function') timer.unref();

  function stop(): void {
    clearInterval(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
  function onAbort(): void {
    stop();
  }
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  return { stop };
}

/**
 * node 周期调度器契约。stop 后不再触发。
 */
export interface IntervalScheduler {
  /**
   * 停止调度（清除定时器并移除 abort 监听）。
   */
  stop(): void;
}
