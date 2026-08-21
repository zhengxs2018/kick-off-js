import { cron } from 'bun';

/**
 * 创建 bun cron 周期调度器
 *
 * @param spec - cron 表达式
 * @param onTick - 每次触发的回调
 */
export function createCronScheduler(spec: string, onTick: () => void): CronScheduler {
  const job = cron(spec, onTick);
  return {
    stop() {
      job.stop();
    },
  };
}

export interface CronScheduler {
  stop(): void;
}
