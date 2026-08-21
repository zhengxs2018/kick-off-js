export function createSemaphore(limit: number): Semaphore {
  const waiters: Waiter[] = [];
  let available = limit;

  return {
    async acquire(signal) {
      if (signal?.aborted) return false;
      if (available > 0) {
        available--;
        return true;
      }

      const { promise, resolve } = Promise.withResolvers<boolean>();
      const waiter: Waiter = { resolve, signal };
      const onAbort = (): void => {
        const idx = waiters.indexOf(waiter);
        if (idx !== -1) waiters.splice(idx, 1);
        resolve(false);
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      waiters.push(waiter);
      return promise;
    },
    release() {
      while (waiters.length > 0) {
        const next = waiters.shift()!;
        if (next.signal?.aborted) continue;
        next.resolve(true);
        available--;
        return;
      }
      available++;
    },
  };
}

/**
 * 并发信号量契约。预约取许可后必须释放；被取消唤醒的 acquire 不取许可，不得 release。
 */
export interface Semaphore {
  /**
   * 预约一个许可
   *
   * @param signal - 可选取消信号；已 abort 或等待中被 abort 则解析为 false（未取许可）
   * @returns 取到许可为 true，被取消为 false
   */
  acquire(signal?: AbortSignal): Promise<boolean>;

  /**
   * 释放一个许可，优先转移给等待者，否则归还池子。
   * 仅对成功 acquire 的调用方调用。
   */
  release(): void;
}

type Waiter = {
  resolve(acquired: boolean): void;
  readonly signal: AbortSignal | undefined;
};
