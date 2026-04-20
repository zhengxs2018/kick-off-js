export const NativeMutationObserver = globalThis.MutationObserver

export const NativeResizeObserver = globalThis.ResizeObserver

export const NativeAddEventListener = EventTarget.prototype.addEventListener

export const NativeRemoveEventListener =
  EventTarget.prototype.removeEventListener

export const NativeSetInterval = globalThis.setInterval

export const NativeClearInterval = globalThis.clearInterval

export const NativeSetTimeout = globalThis.setTimeout

export const NativeClearTimeout = globalThis.clearTimeout

export const NativePromise = globalThis.Promise

export const NativeThen = NativePromise.prototype.then

export const NativeCatch = NativePromise.prototype.catch

export const NativeFinally = NativePromise.prototype.finally

export function addEventListener<K extends keyof WindowEventMap>(
  type: K,
  listener: (this: Window, ev: WindowEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
): void
export function addEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): void {
  return NativeAddEventListener.call(window, type, listener, options)
}
