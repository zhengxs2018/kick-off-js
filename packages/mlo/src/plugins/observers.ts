import type {
  MloRef,
  MloPluginObject,
  MloSetupContext,
} from '../types/index.js'
import {
  ref,
  inBrowser,
  NativeResizeObserver,
  NativeMutationObserver,
  writable,
} from '../base/index.js'

export type ObserversOptions = {
  /**
   * 是否启用大小观察者。
   *
   * 注意：启用此功能将导致CPU使用量显著增加。
   */
  resize?: boolean

  /**
   * 是否启用DOM变动观察者。
   *
   * 注意：启用此功能将导致CPU使用量显著增加。
   */
  mutation?: boolean
}

export function observers(options?: ObserversOptions): MloPluginObject {
  return {
    name: 'observers',
    setup({ subscriptions }: MloSetupContext) {
      if (!inBrowser) {
        console.debug(
          '[mlo] observers plugin is designed to work in browser environment, skipping setup.'
        )
        return
      }

      if (options?.mutation) {
        subscriptions.push(MonitorMutationObserver())
      }

      if (options?.resize) {
        subscriptions.push(MonitorResizeObserver())
      }
    },
  }
}

function MonitorResizeObserver() {
  class ResizeObserver extends NativeResizeObserver {
    private __mlo_refs__?: {
      cb: MloRef<object>
      ob: MloRef<object>
    }

    constructor(callback: ResizeObserverCallback) {
      super(callback)

      const cbRef = ref(callback)!
      const obRef = ref(this)!

      cbRef.linkTo(obRef)

      Object.defineProperty(
        this,
        '__mlo_refs__',
        writable({ cb: cbRef, ob: obRef })
      )
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      const { __mlo_refs__ } = this

      if (!__mlo_refs__) return super.observe(target, options)

      const elRef = ref(target)

      if (elRef) {
        const { cb, ob } = __mlo_refs__

        cb.linkTo(elRef)
        ob.linkTo(elRef)
      }

      return super.observe(target, options)
    }

    disconnect(): void {
      this.__mlo_refs__ = undefined
      return super.disconnect()
    }
  }

  globalThis.ResizeObserver = ResizeObserver

  return () => {
    globalThis.ResizeObserver = NativeResizeObserver
  }
}

function MonitorMutationObserver() {
  class MloMutationObserver extends NativeMutationObserver {
    private __mlo_refs__?: {
      cb: MloRef<object>
      ob: MloRef<object>
    }

    constructor(callback: MutationCallback) {
      super(callback)

      const cbRef = ref(callback)!
      const obRef = ref(this)!

      cbRef.linkTo(obRef)

      Object.defineProperty(
        this,
        '__mlo_refs__',
        writable({ cb: cbRef, ob: obRef })
      )
    }

    observe(target: Element, options?: MutationObserverInit): void {
      const { __mlo_refs__ } = this

      if (!__mlo_refs__) return super.observe(target, options)

      const elRef = ref(target)

      if (elRef) {
        const { cb, ob } = __mlo_refs__

        cb.linkTo(elRef)
        ob.linkTo(elRef)
      }

      return super.observe(target, options)
    }

    disconnect(): void {
      this.__mlo_refs__ = undefined
      return super.disconnect()
    }
  }

  globalThis.MutationObserver = MloMutationObserver

  return () => {
    globalThis.MutationObserver = NativeMutationObserver
  }
}
