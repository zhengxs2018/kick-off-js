import type { QueueItemFields } from '../core/queue.js';

export interface TaskItemFields<TData = unknown> extends QueueItemFields {
  data: TData;
  spiderId: string;
}

export interface TaskContext<TData = unknown> {
  /**
   * 派生下游任务
   *
   * @param payload - 派发载荷
   */
  enqueue(payload: Partial<TaskItemFields<TData>>): void;
}

export function defineTask<TData = unknown>(
  name: string,
  process: TaskProcessor<TData>,
): TaskUnit<TData> {
  return { name, process };
}

export interface QueueItem {
  readonly id: string;
  readonly name: string;
  state: 'pending' | 'processing' | 'done' | 'failed';
  readonly createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  error?: string;
}

export interface TaskItem<TData = unknown> {
  id: string;
  name: string;
  state: 'pending' | 'processing' | 'done' | 'failed';
  data: TData;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  error?: string;
}

export interface TaskUnit<TData = unknown> {
  name: string;
  process: TaskProcessor<TData>;
}

/** 任务处理函数签名，参数序为 (data, ctx) */
export type TaskProcessor<TData = unknown> = (
  data: TData,
  ctx: TaskContext<TData>,
) => Promise<void>;
