import {
  NativePromise,
  ref,
  captureStack,
  NativeThen,
  getter,
  constant,
} from '../base/index.js'
import type { MloPluginObject } from '../types/plugin.js'
import type { MloRef } from '../types/ref.js'

export function promises(): MloPluginObject {
  return {
    name: 'promises',
    setup({ subscriptions }) {
      if (globalThis.Promise !== NativePromise) {
        console.warn(
          '[mlo] promises plugin requires native Promise constructor and should be applied before other Promise wrappers.'
        )
        return
      }

      subscriptions.push(monitorPromise())

      function monitorPromise() {
        class MloPromise<T> extends NativePromise<T> {
          readonly __mlo_state__!: PromiseState

          readonly __mlo_stack__!: string

          readonly __mlo_refs__?: {
            instance: MloRef<object>
            executor: MloRef<Function>
          }

          constructor(
            executor: ConstructorParameters<typeof NativePromise<T>>[0]
          ) {
            let state: PromiseState = 'pending'

            super((resolve, reject) => {
              return executor(
                (value: T | PromiseLike<T>) => {
                  if (state === 'pending') state = 'fulfilled'
                  resolve(value)
                },
                (reason?: unknown) => {
                  if (state === 'pending') state = 'rejected'
                  reject(reason)
                }
              )
            })

            if (state !== 'pending') return

            const stack = captureStack(executor, 2)

            const instanceRef = ref(this)

            instanceRef.name = 'Promise'
            instanceRef.type = 'Promise'
            instanceRef.category = 'object'
            instanceRef.labels.add('promise')
            instanceRef.stacks.push({
              type: 'new Promise',
              stack,
              at: Date.now(),
            })

            const executorRef = ref(executor)

            executorRef.name = 'Promise.executor'
            executorRef.labels.add('promise')
            executorRef.labels.add('executor')

            executorRef.stacks.push({
              type: 'promise.executor',
              stack,
              at: Date.now(),
            })

            executorRef.linkTo(instanceRef)

            Object.defineProperties(this, {
              __mlo_state__: getter(() => state),
              __mlo_stack__: constant(captureStack(executor, 1)),
              __mlo_refs__: constant({
                instance: instanceRef,
                executor: executorRef,
              }),
            })

            NativeThen.call(
              this,
              () => {
                state = 'fulfilled'
                executorRef.dispose()
                executorRef.dispose()
              },
              () => {
                state = 'rejected'
                executorRef.dispose()
                executorRef.dispose()
              }
            )
          }
        }

        Object.defineProperty(MloPromise, Symbol.species, {
          value: NativePromise,
          configurable: true,
        })

        Object.defineProperty(MloPromise.prototype, '__mlo_class__', {
          value: 'Promise',
          writable: false,
          configurable: false,
          enumerable: false,
        })

        globalThis.Promise = MloPromise as unknown as PromiseConstructor

        return () => {
          globalThis.Promise = NativePromise
        }
      }
    },
  }
}

type PromiseState = 'pending' | 'fulfilled' | 'rejected'
