import type { MloPluginObject, MloSetupContext } from '../types/index.js'
import {
  isObservable,
  NativeAddEventListener,
  ref,
  captureStack,
} from '../base/index.js'

export function eventTarget(): MloPluginObject {
  return {
    name: 'eventTarget',
    setup({ subscriptions }: MloSetupContext) {
      if (EventTarget.prototype.addEventListener !== NativeAddEventListener) {
        console.warn(
          '[mlo] eventTarget plugin has been applied, but addEventListener has already been wrapped by other plugin. Please make sure to apply eventTarget plugin before other plugins that wrap addEventListener.'
        )
        return
      }

      const wrappedAdd: typeof EventTarget.prototype.addEventListener =
        function (this: EventTarget, type, listener, options) {
          if (typeof listener !== 'function') {
            return NativeAddEventListener.call(this, type, listener, options)
          }

          const eventRef = ref(listener as EventListener)

          // Note:
          // 防止未传递事件监听器的情况，虽然 addEventListener 规范要求 listener 参数必须传递，
          // 但实际使用中可能会出现未传递的情况
          if (!eventRef) {
            return NativeAddEventListener.call(this, type, listener, options)
          }

          eventRef.name = type

          if (isObservable(this)) {
            const targetRef = ref(this)

            eventRef.labels.add(targetRef.type)

            eventRef.stacks.push({
              id: targetRef.id,
              type: `${targetRef.type}.addEventListener(${type})`,
              stack: captureStack(listener, 2)!,
              at: Date.now(),
            })

            eventRef.linkTo(targetRef)
          } else {
            eventRef.labels.add('globalThis')
            eventRef.stacks.push({
              type: `globalThis.addEventListener(${type})`,
              stack: captureStack(listener, 2)!,
              at: Date.now(),
            })
          }

          return NativeAddEventListener.call(this, type, listener, options)
        }

      EventTarget.prototype.addEventListener = wrappedAdd

      subscriptions.push(() => {
        EventTarget.prototype.addEventListener = NativeAddEventListener
      })
    },
  }
}
