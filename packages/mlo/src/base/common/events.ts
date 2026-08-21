export function createEmitter<Events extends object = object>(): Emitter<Events> {
  const events = new Map<PropertyKey, Set<EventListener>>();

  return {
    on,
    off,
    emit,
    dispose,
  };

  function on<T extends keyof Events>(type: T, listener: EventListener<Events[T]>): DisposeLike;
  function on<T>(type: string, listener: EventListener<T>): DisposeLike;
  function on(type: PropertyKey, listener: EventListener): DisposeLike {
    const listeners = GetOrCreateListeners(type, true);

    listeners.add(listener);

    return { dispose };

    function dispose() {
      off(type, listener);
    }
  }

  function off(type: PropertyKey, listener: EventListener) {
    const listeners = GetOrCreateListeners(type);

    if (!listeners) return;

    listeners.delete(listener);

    if (listeners.size === 0) {
      events.delete(type);
    }
  }

  function dispose() {
    for (const listeners of events.values()) {
      listeners.clear();
    }

    events.clear();
  }

  function emit(type: PropertyKey, data: unknown): boolean {
    const listeners = GetOrCreateListeners(type);

    if (!listeners || listeners.size === 0) return true;

    let returnValue = true;

    const errors: Error[] = [];

    for (const listener of listeners) {
      try {
        if (listener(data) === false) {
          returnValue = false;
          break;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length === 1) {
      throw errors[0];
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, 'Multiple errors occurred during event emission');
    }

    return returnValue;
  }

  /**
   * @internal
   * @deprecated 内部API，请勿在外部使用
   */
  function GetOrCreateListeners(type: PropertyKey): Set<EventListener> | undefined;
  function GetOrCreateListeners(type: PropertyKey, Create: true): Set<EventListener>;
  function GetOrCreateListeners(
    type: PropertyKey,
    Create?: boolean,
  ): Set<EventListener> | undefined {
    if (events.has(type)) return events.get(type);

    if (!Create) return;

    const listeners = new Set<EventListener>();

    events.set(type, listeners);

    return listeners;
  }
}

export type DisposeLike = {
  dispose(): void;
};

export interface Emitter<Events extends object = object> extends DisposeLike {
  on<T extends keyof Events>(type: T, listener: EventListener<Events[T]>): DisposeLike;
  on<T>(type: PropertyKey, listener: EventListener<T>): DisposeLike;
  on(type: PropertyKey, listener: EventListener): DisposeLike;

  off(type: PropertyKey, listener: EventListener): void;

  emit(type: PropertyKey, data: unknown): boolean;
}

/**
 * 事件监听器
 */
export type EventListener<T = any> = (event: T) => unknown;
