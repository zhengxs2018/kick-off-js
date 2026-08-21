import { parseHTML } from 'linkedom';
import type { HtmlParser, TemmeNode, NodeCollection } from './parser.js';

/**
 * 默认 DOM 解析器
 *
 * @returns 基于 linkedom 的适配器
 */
export function linkedom(): HtmlParser<unknown> {
  return {
    createNode,
    parseFromString(html) {
      return createNode(parseHTML(html).document as unknown as LinkedomNode);
    },
    match(css, parent) {
      return toCollection(asNative(parent).querySelectorAll(css));
    },
    getElementsByClassName(className, parent) {
      return toCollection(asNative(parent).getElementsByClassName(className));
    },
    getElementById(id, parent) {
      const element = asNative(parent).querySelector(idSelector(id));
      return element === null ? null : createNode(element);
    },
    getElementsByTagName(tagName, parent) {
      return toCollection(asNative(parent).getElementsByTagName(tagName));
    },
  };

  function createNode(element: LinkedomNode): TemmeNode<unknown> {
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

  function toCollection(nodes: LinkedomNode[]): NodeCollection<TemmeNode<unknown>> {
    return {
      length: nodes.length,
      item(index) {
        const node = nodes[index];
        return node === undefined ? null : createNode(node);
      },
      [Symbol.iterator](): Iterator<TemmeNode<unknown>> {
        return Iterator.from(nodes).map(createNode);
      },
    };
  }

  function asNative(node: TemmeNode<unknown>): LinkedomNode {
    return node.native as LinkedomNode;
  }

  function runExtract(procedureName: string, element: LinkedomNode, args: string[]): unknown {
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

  /**
   * CSS ID 转义：防止含 `.` `:` `[` 等元字符的 ID 触发 `querySelector` 语法错误
   *
   * - 浏览器环境（Chrome >= 109，全局 `CSS` 存在）走标准 `CSS.escape`；bun / node 无全局 `CSS`，回退本地转义
   */
  function idSelector(id: string): string {
    if (/^-?[a-zA-Z_]/.test(id)) {
      return `#${id.replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`)}`;
    }

    return `#\\${id.charAt(0)}${id.slice(1).replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`)}`;
  }
}

interface LinkedomNode {
  textContent: string | null;
  innerHTML: string;
  getAttribute(name: string): string | null;
  parentElement: LinkedomNode | null;
  querySelector(css: string): LinkedomNode | null;
  querySelectorAll(css: string): LinkedomNode[];
  getElementsByClassName(name: string): LinkedomNode[];
  getElementsByTagName(name: string): LinkedomNode[];
}
