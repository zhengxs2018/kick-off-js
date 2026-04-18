import type { MloPluginObject, MloSetupContext } from '../types/index.js'
import {
  emit,
  querySelector,
  inBrowser,
  NativeMutationObserver,
  scanDOMTree,
} from '../base/index.js'

export type DomTreeOptions = {
  /**
   * 监视的根元素，可以是一个CSS选择器字符串、一个DOM元素或者null。
   *
   * - 如果是一个CSS选择器字符串，MLO将使用`document.querySelector`来查找对应的元素。
   * - 如果是一个DOM元素，MLO将直接监视该元素。
   * - 如果是null或未提供，MLO将不监视任何元素。
   */
  root?: string | Element | null

  /**
   * 是否在初始扫描阶段监视DOM树。
   *
   * 注意：启用此功能将导致CPU使用量显著增加。
   */
  scan?: boolean

  /**
   * 是否监视DOM树的变动。
   *
   * 注意：启用此功能将导致CPU使用量显著增加。
   */
  monitor: boolean
}

export function domTree(options?: DomTreeOptions): MloPluginObject {
  return {
    name: 'domTree',
    setup({ subscriptions }: MloSetupContext) {
      if (!inBrowser) {
        console.debug(
          '[mlo] domTree plugin is designed to work in browser environment, skipping setup.'
        )
        return
      }

      const target = querySelector(options?.root || 'body')
      if (!target) {
        console.warn(
          '[mlo] domTree plugin: target element not found, skipping DOM tree monitoring.'
        )
        return
      }

      if (options?.scan) {
        subscriptions.push(ScanDOMTree(target))
      }

      if (options?.monitor) {
        subscriptions.push(MonitorDOMTree(target))
      }
    },
  }
}

function ScanDOMTree(element: Element) {
  let scanRAFId: number | undefined

  scanRAFId = requestAnimationFrame(() => scanDOMTree(element))

  return () => {
    if (scanRAFId) {
      cancelAnimationFrame(scanRAFId)
      scanRAFId = undefined
    }
  }
}

function MonitorDOMTree(element: Element) {
  let obRAFId: number | undefined

  let observer = new NativeMutationObserver((records) => {
    if (obRAFId) cancelAnimationFrame(obRAFId)

    obRAFId = requestAnimationFrame(() => {
      for (const { addedNodes, removedNodes } of records) {
        for (let index = 0; index < addedNodes.length; index++) {
          const node = addedNodes[index]

          emit('element:added', { detail: node })
        }

        for (let index = 0; index < removedNodes.length; index++) {
          const node = removedNodes[index]
          emit('element:removed', { detail: node })
        }
      }
    })
  })

  observer.observe(element, { subtree: true, childList: true })

  return () => {
    if (obRAFId) {
      cancelAnimationFrame(obRAFId)
      obRAFId = undefined
    }

    if (observer) {
      observer.disconnect()
      observer.takeRecords()
      ;(observer as unknown) = undefined
    }
  }
}
