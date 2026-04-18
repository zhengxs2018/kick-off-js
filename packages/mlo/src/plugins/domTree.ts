import type { MloPluginObject, MloSetupContext } from '../types/index.js'
import {
  emit,
  querySelector,
  inBrowser,
  NativeMutationObserver,
  scanDOMTree,
} from '../base/index.js'
import {
  MLO_ELEMENT_ADDED_EVENT,
  MLO_ELEMENT_REMOVED_EVENT,
} from '../base/plugin-api/consts.js'
import type { Matcher, Rule } from '../types/matcher.js'
import { createMatcher } from '../base/plugin-api/matcher.js'

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
  monitor?: boolean

  /**
   * 监视规则配置项，允许用户自定义监视的行为和范围。
   */
  rules?: Rule[]
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

      const matcher = createMatcher<HTMLElement>(
        options?.rules || [],
        (node, check) => {
          if (check(node.id) || check(node.tagName.toLowerCase())) return true

          const classList = node.classList

          for (let i = 0, len = classList.length; i < len; i++) {
            if (check(classList[i])) return true
          }

          return false
        }
      )

      subscriptions.push(matcher)

      if (options?.scan) {
        subscriptions.push(ScanDOMTree(target, matcher))
      }

      if (options?.monitor) {
        subscriptions.push(MonitorDOMTree(target, matcher))
      }
    },
  }
}

function ScanDOMTree(element: Element, matcher: Matcher<Element>) {
  let scanRAFId: number | undefined

  scanRAFId = requestAnimationFrame(() => scanDOMTree(element, matcher))

  return () => {
    if (scanRAFId) {
      cancelAnimationFrame(scanRAFId)
      scanRAFId = undefined
    }
  }
}

function MonitorDOMTree(element: Element, matcher: Matcher<HTMLElement>) {
  let obRAFId: number | undefined
  let isProcessing = false

  let observer: MutationObserver | undefined = new NativeMutationObserver(
    (records) => {
      if (isProcessing) return

      isProcessing = true

      obRAFId = requestAnimationFrame(() => {
        processRecords(records)
        isProcessing = false
        obRAFId = undefined
      })
    }
  )

  observer.observe(element, { subtree: true, childList: true })

  return () => {
    if (obRAFId) {
      cancelAnimationFrame(obRAFId)
      obRAFId = undefined
    }

    if (observer) {
      observer.disconnect()
      observer.takeRecords()
      observer = undefined
    }
  }

  function processRecords(records: MutationRecord[]) {
    let idx: number
    let len: number
    let node: Node

    for (const { addedNodes, removedNodes } of records) {
      for (idx = 0, len = addedNodes.length; idx < len; idx++) {
        node = addedNodes[idx]

        if (
          node.nodeType === Node.ELEMENT_NODE &&
          matcher.match(node as HTMLElement).ok
        ) {
          emit(MLO_ELEMENT_ADDED_EVENT, { detail: node })
        }
      }

      for (idx = 0, len = removedNodes.length; idx < len; idx++) {
        node = removedNodes[idx]

        if (
          node.nodeType === Node.ELEMENT_NODE &&
          matcher.match(node as HTMLElement).ok
        ) {
          emit(MLO_ELEMENT_REMOVED_EVENT, { detail: node })
        }
      }
    }
  }
}
