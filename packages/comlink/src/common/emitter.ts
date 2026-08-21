import type { Disposable } from './event.js';

export type Listener<T = unknown> = (data: T) => void;

export interface EmitterOptions {
  once?: boolean;
}

export interface Emitter extends Disposable {
  on(event: string, listener: Listener, options?: EmitterOptions): Disposable;
  emit(event: string, data: unknown): void;
  clear(event?: string): void;
}

export function createEmitter(): Emitter {
  const listeners = new Map<string, Listener[]>();

  const emitter: Emitter = {
    on,
    emit,
    clear,
    [Symbol.dispose]() {
      listeners.clear();
    },
  };
  return emitter;

  function on(event: string, listener: Listener, options?: EmitterOptions): Disposable {
    const bucket = listeners.getOrInsertComputed(event, () => []);

    if (options?.once) {
      const subscription = register(bucket, event, data => {
        subscription[Symbol.dispose]();
        listener(data);
      });
      return subscription;
    }

    return register(bucket, event, listener);
  }

  function register(bucket: Listener[], event: string, handler: Listener): Disposable {
    bucket.push(handler);

    return {
      [Symbol.dispose]() {
        const index = bucket.indexOf(handler);
        if (index >= 0) bucket.splice(index, 1);
        if (bucket.length === 0) listeners.delete(event);
      },
    };
  }

  function emit(event: string, data: unknown): void {
    const bucket = listeners.get(event);
    if (!bucket) return;

    for (const listener of [...bucket]) {
      listener(data);
    }
  }

  function clear(event?: string): void {
    if (event === undefined) listeners.clear();
    else listeners.delete(event);
  }
}
