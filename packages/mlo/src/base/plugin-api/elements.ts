import type { Matcher } from '../../types/matcher.js'
import { MLO_ELEMENT_ADDED_EVENT } from './consts.js'
import { emit } from './event.js'

/**
 * 递归扫描DOM树并触发元素添加事件
 *
 * @internal
 * @deprecated 插件 API，请勿在外部使用
 * @param element - 要扫描的根元素
 */
export function scanDOMTree(element: Element, matcher: Matcher<HTMLElement>) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT)

  let node = walker.currentNode as HTMLElement

  if (document.body.contains(element) && matcher.match(node).ok) {
    emit(MLO_ELEMENT_ADDED_EVENT, node)
  }

  while (walker.nextNode()) {
    node = walker.currentNode as HTMLElement

    if (matcher.match(node).ok) {
      emit(MLO_ELEMENT_ADDED_EVENT, node)
    }
  }
}
