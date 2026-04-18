export const NativeMutationObserver = globalThis.MutationObserver

export const NativeResizeObserver = globalThis.ResizeObserver

export const NativeAddEventListener = EventTarget.prototype.addEventListener

export const NativeRemoveEventListener =
  EventTarget.prototype.removeEventListener

export const NativeSetInterval = globalThis.setInterval

export const NativeClearInterval = globalThis.clearInterval

export const NativeSetTimeout = globalThis.setTimeout

export const NativeClearTimeout = globalThis.clearTimeout
