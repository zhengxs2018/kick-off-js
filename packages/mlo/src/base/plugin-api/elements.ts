import { emit } from './event.js'

/**
 * 递归扫描DOM树并触发元素添加事件
 *
 * @internal
 * @deprecated 插件 API，请勿在外部使用
 * @param element - 要扫描的根元素
 */
export function scanDOMTree(element: Element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT)

  while (walker.nextNode()) {
    const node = walker.currentNode
    emit('element:added', { detail: node })
  }
}
