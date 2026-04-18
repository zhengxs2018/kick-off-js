import type { DisposeLike, MloEventListener } from '../../types/event.js'
import { NativeAddEventListener } from '../common/native.js'
import { isFunction } from '../common/utils.js'

/**
 * 事件系统
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
const Emitter = new EventTarget()

/**
 * 创建事件监听器
 *
 * @internal
 * @deprecated 仅供插件开发者使用，普通用户请勿使用
 * @param type - 事件类型
 * @returns 事件监听器函数
 */
export function createEvent<T>(type: string) {
  return function event(
    listener: MloEventListener<T>,
    options?: boolean | AddEventListenerOptions
  ) {
    return on(type, listener, options)
  }
}

export function on<T>(
  type: string,
  listener: MloEventListener<T>,
  options?: boolean | AddEventListenerOptions
): DisposeLike {
  NativeAddEventListener.call(Emitter, type, listener as EventListener, options)
  return {
    dispose() {
      Emitter.removeEventListener(type, listener as EventListener)
    },
  }
}

/**
 * 触发事件
 *
 * @internal
 * @deprecated 仅供插件开发者使用，普通用户请勿使用
 * @param type - 事件类型
 * @returns 是否成功触发事件
 */
export function emit(
  type: string,
  eventInitDict?: CustomEventInit<unknown> | undefined
): boolean {
  return Emitter.dispatchEvent(new CustomEvent(type, eventInitDict))
}

export const Disposable = {
  from(...disposables: DisposeLike[]): DisposeLike {
    return {
      dispose() {
        disposeAll(disposables)
        disposables.length = 0
      },
    }
  },
  dispose(cb: () => void): DisposeLike {
    return {
      dispose() {
        try {
          cb()
        } catch (error) {
          console.error('Error during disposal:', error)
        }
      },
    }
  },
  noop(): DisposeLike {
    return {
      dispose() {},
    }
  },
}

export function disposeAll(disposables: (DisposeLike | (() => void))[]) {
  const errors: Error[] = []

  for (const disposable of disposables) {
    try {
      if (isFunction(disposable)) {
        disposable()
      } else {
        disposable.dispose()
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)))
    }
  }

  if (errors.length === 1) {
    throw errors[0]
  } else if (errors.length > 1) {
    throw new AggregateError(errors, 'Multiple errors occurred during disposal')
  }
}
