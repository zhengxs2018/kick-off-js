import type {
  DisposeLike,
  Emitter,
  MloEventListener,
} from '../../types/event.js'
import { isFunction } from '../common/utils.js'

/**
 * 事件系统
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
export const emitter: Emitter = createEmitter()

/**
 * 创建事件监听器
 *
 * @internal
 * @deprecated 仅供插件开发者使用，普通用户请勿使用
 * @param type - 事件类型
 * @returns 事件监听器函数
 */
export function createEvent<T>(type: PropertyKey) {
  return function event(listener: MloEventListener<T>) {
    return on(type, listener)
  }
}

export function on<T>(
  type: PropertyKey,
  listener: MloEventListener<T>
): DisposeLike {
  return emitter.on(type, listener)
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
  return emitter.emit(type, data)
}

export function createEmitter<Events extends object = object>() {
  /**
   * 事件系统
   *
   * @internal
   * @deprecated 内部API，请勿在外部使用
   */
  const EventsMap = new Map<PropertyKey, Set<MloEventListener>>()

  return {
    on,
    off,
    emit,
    dispose,
  }

  function on<T extends keyof Events>(
    type: T,
    listener: MloEventListener<Events[T]>
  ): DisposeLike
  function on<T>(type: string, listener: MloEventListener<T>): DisposeLike
  function on(type: PropertyKey, listener: MloEventListener): DisposeLike {
    const listeners = GetOrCreateListeners(type, true)

    listeners.add(listener)

    return { dispose }

    function dispose() {
      off(type, listener)
    }
  }

  function off(type: PropertyKey, listener: MloEventListener) {
    const listeners = GetOrCreateListeners(type)

    if (!listeners) return

    listeners.delete(listener)

    if (listeners.size === 0) {
      EventsMap.delete(type)
    }
  }

  function dispose() {
    for (const listeners of EventsMap.values()) {
      listeners.clear()
    }

    EventsMap.clear()
  }

  function emit(type: PropertyKey, data: unknown): boolean {
    const listeners = GetOrCreateListeners(type)

    if (!listeners || listeners.size === 0) return true

    let returnValue = true

    const errors: Error[] = []

    for (const listener of listeners) {
      try {
        if (listener(data) === false) {
          returnValue = false
          break
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }

    if (errors.length === 1) {
      throw errors[0]
    }

    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        'Multiple errors occurred during event emission'
      )
    }

    return returnValue
  }

  /**
   * @internal
   * @deprecated 内部API，请勿在外部使用
   */
  function GetOrCreateListeners(
    type: PropertyKey
  ): Set<MloEventListener> | undefined
  function GetOrCreateListeners(
    type: PropertyKey,
    Create: true
  ): Set<MloEventListener>
  function GetOrCreateListeners(
    type: PropertyKey,
    Create?: boolean
  ): Set<MloEventListener> | undefined {
    if (EventsMap.has(type)) return EventsMap.get(type)

    if (!Create) return

    const listeners = new Set<MloEventListener>()

    EventsMap.set(type, listeners)

    return listeners
  }
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
