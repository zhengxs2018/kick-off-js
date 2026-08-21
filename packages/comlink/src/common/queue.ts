import { castToError } from './util.js';

export interface PendingTask<T = unknown> {
  readonly id: string;
  readonly promise: Promise<T>;
}

export interface PendingQueue {
  create<T = unknown>(id: string): PendingTask<T>;

  resolve(id: string, value: unknown): void;

  reject(id: string, reason: unknown): void;

  rejectAll(reason: Error): void;
}

export function createPendingQueue(): PendingQueue {
  const tasks = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();

  return { create, resolve, reject, rejectAll };

  function create<T = unknown>(id: string): PendingTask<T> {
    const { promise, resolve, reject } = Promise.withResolvers<T>();

    tasks.set(id, { resolve, reject });

    return { id, promise };
  }

  function resolve(id: string, value: unknown): void {
    const task = tasks.get(id);
    if (!task) return;

    task.resolve(value);
    tasks.delete(id);
  }

  function reject(id: string, reason: unknown): void {
    const task = tasks.get(id);
    if (!task) return;

    task.reject(castToError(reason));
    tasks.delete(id);
  }

  function rejectAll(reason: Error): void {
    for (const [id, task] of tasks) {
      task.reject(reason);
      tasks.delete(id);
    }
  }
}
