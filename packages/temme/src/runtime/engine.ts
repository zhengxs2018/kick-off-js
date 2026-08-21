import type { FieldLookup, NativeLookup } from '../common/types.js';
import { domParser, linkedom } from '../parsers/index.js';
import type { HtmlParser, TemmeNode, HostElement } from '../parsers/parser.js';

const defaultParser: HtmlParser<unknown> =
  typeof DOMParser !== 'undefined' ? domParser() : linkedom();

/**
 * 基于适配器创建运行时引擎
 *
 * @param parser - DOM 适配器实现
 * @returns 引擎实例
 */
export function createEngine<Element extends HostElement = unknown>(
  parser = defaultParser as HtmlParser<Element>,
): Engine<Element> {
  return {
    parser,
    parse(html, type) {
      return typeof html === 'string' ? parser.parseFromString(html, type || 'text/html') : html;
    },
    select(plan, scope) {
      const fast = selectByLookup(parser, plan.fieldLookup, scope);
      if (fast !== null) {
        return fast;
      }

      try {
        return parser.match(plan.css, scope);
      } catch {
        // fail-safe：非法 CSS 选择器一律返回空序列，绝不抛错
        return [];
      }
    },
    resolve(node, lookup) {
      if (lookup === undefined || lookup.relation === 'self') {
        return node;
      }
      if (lookup.relation === 'parent') {
        return climb(node, lookup.steps);
      }
      return node;
    },
  };
}

/**
 * 选取目标的最小结构：引擎只读取 `css` 与 `fieldLookup`，
 * 与编译期 PlanNode / 运行期 LinkedNode 均解耦（两者皆满足此形状）
 */
export interface SelectTarget {
  readonly css: string;
  readonly fieldLookup?: FieldLookup;
}

/**
 * 运行时引擎：在 `Adapter` 之上提供计划节点级的选取能力
 *
 * - 引擎只做「计划 → 节点序列」的解析，不持有捕获状态（状态归 state/drive）
 * - 所有解析失败一律 fail-safe：返回空序列或原节点，绝不抛错
 */
export interface Engine<Element extends HostElement = unknown> {
  /** 底层适配器，供自定义过程 / 修饰符按需下探 */
  readonly parser: HtmlParser<Element>;

  /**
   * 解析文档
   *
   * @param html - HTML 文本 或文档根节点
   * @returns 文档根节点包装
   */
  parse(html: string | TemmeNode<Element>, type?: DOMParserSupportedType): TemmeNode<Element>;

  /**
   * 在作用域内选取计划节点匹配的元素，优先走编译期字段直取快路径
   *
   * @param plan - 计划节点，读取其 `css` 与 `fieldLookup`
   * @param scope - 作用域节点
   * @returns 匹配到的节点序列，无匹配时为空序列
   */
  select(plan: SelectTarget, scope: TemmeNode<Element>): Iterable<TemmeNode<Element>>;
  /**
   * 按字段直取指令把已匹配节点重定位到目标节点（自身 / 子 / 上溯父链）
   *
   * @param node - 已匹配的节点
   * @param lookup - 编译期字段直取指令，未定义视作 `self`
   * @returns 重定位后的节点；无法定位时为 null
   */
  resolve(node: TemmeNode<Element>, lookup: FieldLookup | undefined): TemmeNode<Element> | null;
}

/**
 * 按 class / id / tag 原生指令在作用域内直取节点
 *
 * @param parser - DOM 适配器实现
 * @param strategy - 原生查找指令
 * @param scope - 作用域节点
 * @returns 命中节点序列；attr 指令无原生入口时返回 null 表示交由 CSS 回退
 */
function selectByStrategy<Element extends HostElement>(
  parser: HtmlParser<Element>,
  strategy: NativeLookup,
  scope: TemmeNode<Element>,
): Iterable<TemmeNode<Element>> | null {
  if (strategy.kind === 'class') {
    return parser.getElementsByClassName(strategy.className, scope);
  }
  if (strategy.kind === 'tag') {
    return parser.getElementsByTagName(strategy.tagName, scope);
  }
  if (strategy.kind === 'id') {
    const found = parser.getElementById(strategy.id, scope);
    return found === null ? [] : [found];
  }
  return null;
}

/**
 * 解析字段直取快路径
 *
 * @param parser - DOM 适配器实现
 * @param lookup - 编译期字段直取指令
 * @param scope - 作用域节点
 * @returns 快路径节点序列；无快路径时为 null（调用方回退 CSS 匹配）
 */
function selectByLookup<Element extends HostElement>(
  parser: HtmlParser<Element>,
  lookup: FieldLookup | undefined,
  scope: TemmeNode<Element>,
): Iterable<TemmeNode<Element>> | null {
  if (lookup === undefined || lookup.relation === 'self') {
    return null;
  }
  if (lookup.relation === 'fallback') {
    return parser.match(lookup.css, scope);
  }
  return selectByStrategy(parser, lookup.strategy, scope);
}

/**
 * 沿父链上溯固定步数
 *
 * @param node - 起始节点
 * @param steps - 上溯步数，非正数视作原节点
 * @returns 上溯到的节点；中途触顶时为 null
 */
function climb<Element extends HostElement>(
  node: TemmeNode<Element>,
  steps: number,
): TemmeNode<Element> | null {
  let current: TemmeNode<Element> | null = node;
  for (let index = 0; index < steps; index += 1) {
    if (current === null) {
      return null;
    }
    current = current.parent();
  }
  return current;
}
