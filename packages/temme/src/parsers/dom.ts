import type { HtmlParser, TemmeNode, NodeCollection } from './parser.js';

/**
 * 原生 DOM 解析起
 *
 * @returns 基于原生 DOMParser 的适配器
 */
export function domParser(): HtmlParser<Element> {
  const parser = new DOMParser();

  return {
    createNode,
    parseFromString(html, type) {
      return createNode(parser.parseFromString(html, type).body);
    },
    match(css, parent) {
      return toCollection(asNative(parent).querySelectorAll(css));
    },
    getElementsByClassName(className, parent) {
      return toCollection(asNative(parent).getElementsByClassName(className));
    },
    getElementById(id, parent) {
      const element = asNative(parent).querySelector(`#${CSS.escape(id)}`);
      return element === null ? null : createNode(element);
    },
    getElementsByTagName(tagName, parent) {
      return toCollection(asNative(parent).getElementsByTagName(tagName));
    },
  };

  function createNode(element: Element): TemmeNode<Element> {
    return {
      extract(procedureName, args) {
        return runExtract(procedureName, element, args);
      },
      parent() {
        const { parentElement } = element;
        return parentElement === null ? null : createNode(parentElement);
      },
      native: element,
    };
  }

  function toCollection(
    nodes: HTMLCollectionOf<Element> | NodeListOf<Element>,
  ): NodeCollection<TemmeNode<Element>> {
    return {
      length: nodes.length,
      item(index) {
        const node = nodes[index];
        return node === undefined ? null : createNode(node);
      },
      [Symbol.iterator](): Iterator<TemmeNode<Element>> {
        return Iterator.from(nodes).map(createNode);
      },
    };
  }

  function asNative(node: TemmeNode<Element>): Element {
    return node.native as Element;
  }

  function runExtract(procedureName: string, element: Element, args: string[]): unknown {
    if (procedureName === 'text') {
      return element.textContent ?? '';
    }
    if (procedureName === 'html') {
      return element.innerHTML;
    }
    if (procedureName === 'node') {
      return element;
    }
    if (procedureName === 'attr') {
      const [attrName] = args;
      return element.getAttribute(attrName ?? '');
    }
    return undefined;
  }
}
