import type { EventListener, DisposeLike } from '../common/events.js';
import { isFunction } from '../common/utils.js';
import { emitter } from '../internal/emitter.js';

/**
 * 创建事件监听器
 *
 * @internal
 * @deprecated 仅供插件开发者使用，普通用户请勿使用
 * @param type - 事件类型
 * @returns 事件监听器函数
 */
export function createEvent<T>(type: PropertyKey) {
  return function event(listener: EventListener<T>) {
    return on(type, listener);
  };
}

export function on<T>(type: PropertyKey, listener: EventListener<T>): DisposeLike {
  return emitter.on(type, listener);
}

/**
 * 触发事件
 *
 * @internal
 * @deprecated 仅供插件开发者使用，普通用户请勿使用
 * @param type - 事件类型
 * @returns 是否成功触发事件
 */
export function emit(type: PropertyKey, data?: unknown): boolean {
  return emitter.emit(type, data);
}

export const Disposable = {
  from(...disposables: DisposeLike[]): DisposeLike {
    return {
      dispose() {
        disposeAll(disposables);
        disposables.length = 0;
      },
    };
  },
  dispose(cb: () => void): DisposeLike {
    return {
      dispose() {
        try {
          cb();
        } catch (error) {
          console.error('Error during disposal:', error);
        }
      },
    };
  },
  noop(): DisposeLike {
    return {
      dispose() {},
    };
  },
};

export function disposeAll(disposables: (DisposeLike | (() => void))[]) {
  const errors: Error[] = [];

  for (const disposable of disposables) {
    try {
      if (isFunction(disposable)) {
        disposable();
      } else {
        disposable.dispose();
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  if (errors.length === 1) {
    throw errors[0];
  } else if (errors.length > 1) {
    throw new AggregateError(errors, 'Multiple errors occurred during disposal');
  }
}
