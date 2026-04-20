import {
  inBrowser,
  MLO_COMPONENT_MOUNTED_EVENT,
  on,
  ref,
  emit,
} from '../base/index.js'
import type { MloPluginObject } from '../types/plugin.js'

export function vue2(): MloPluginObject {
  const refs = new WeakSet<Vue2Component>()

  return {
    name: 'vue2',
    setup({ subscriptions }) {
      if (!inBrowser) {
        console.debug(
          '[mlo] vue2 plugin is designed to work in browser environment, skipping setup.'
        )
        return
      }

      subscriptions.push(
        on<Element>('element:added', (element) => {
          const { __vue__: component } = element as {
            __vue__?: Vue2Component
          }
          if (component) observe(component)
        })
      )

      function observe(instance: Vue2Component) {
        if (refs.has(instance) === false) {
          record(instance)
          emit(MLO_COMPONENT_MOUNTED_EVENT, instance)
        }

        traversal(instance)
      }

      function record(instance: Vue2Component) {
        const componentRef = ref(instance)
        const elementRef = ref(instance.$el)

        componentRef.name = instance.$options.name || 'Anonymous'
        componentRef.category = 'component'

        componentRef.linkTo(elementRef)

        const version = instance.$options._base.version

        componentRef.meta.framework = {
          name: 'vue',
          version,
          majorVersion: 2,
        }

        refs.add(instance)
      }

      function traversal(component: Vue2Component) {
        const children = component.$children
        if (!children || children.length === 0) return

        for (const child of children) {
          observe(child)
          traversal(child)
        }
      }
    },
  }
}

type Vue2Component = Vue2.Component

declare namespace Vue2 {
  export type App = {
    version: string
  }

  export type ComponentOptions = {
    name?: string
    _base: App
  }

  export type Component = {
    $el: Element

    $options: ComponentOptions

    $parent: Vue2Component | null
    $children: Vue2Component[]

    $on(event: string, callback: Function): void
    $off(event: string, callback: Function): void
    $once(event: string, callback: Function): void
    $emit(event: string, ...args: any[]): void

    _isMounted: boolean
    _isDestroyed: boolean
  }
}
