/** 空节点集合：适配器不支持某快路径时的 fail-safe 返回值 */
export const EMPTY_NODE_COLLECTION: NodeCollection<never> = {
  length: 0,
  item() {
    return null;
  },
  [Symbol.iterator](): Iterator<never> {
    return [][Symbol.iterator]();
  },
};

/** 宿主元素：适配器原生节点的统一占位，具体类型由适配器实现决定 */
export type HostElement = unknown;

/**
 * 适配器节点：对宿主 DOM 节点的最小包装
 *
 * - `extract` 未识别过程名时返回 `undefined`（fail-safe no-op），不抛错
 */
export interface TemmeNode<Element extends HostElement = unknown> {
  /**
   * 按过程名从当前节点取值
   *
   * @param procedureName - 过程名（text / html / node / attr 等）
   * @param args - 过程参数，attr 过程取 `args[0]` 作属性名
   * @returns 取到的值；过程名不被支持时返回 undefined
   */
  extract(procedureName: string, args: string[]): unknown;
  /**
   * 取父节点
   *
   * @returns 父节点包装；已是根则返回 null
   */
  parent(): TemmeNode<Element> | null;
  /** 宿主原生节点，供修饰符 / 自定义过程按需下探 */
  readonly native: Element;
}

/** 贴近 Web 标准的节点集合：支持 `.item()` 索引与 for-of 迭代，允许原生 HTMLCollection 直接透传 */
export interface NodeCollection<T> {
  readonly length: number;
  item(index: number): T | null;
  [Symbol.iterator](): Iterator<T>;
}

/**
 * DOM 适配器：把宿主 DOM 能力收敛为运行时唯一依赖面
 *
 * - 除 `parseDocument` / `match` 外的方法对应 `FieldLookup` 的原生直取快路径；
 *   适配器可不支持某快路径（返回空集合 / null），运行时会退回 `match`
 */
export interface HtmlParser<Element extends HostElement = unknown> {
  /**
   * 解析文档
   *
   * @remarks 解析类型由解析器实现
   * @param html - HTML 文本，或已由宿主解析好的原生节点
   * @param type - 解析类型，`text/html` / `text/xml` / `application/xml` / `image/svg+xml` 等
   * @returns 文档根节点包装
   */
  parseFromString(html: string, type: DOMParserSupportedType): TemmeNode<Element>;

  /**
   * 创建包装节点
   *
   * @param element - 宿主原生节点
   */
  createNode(element: Element): TemmeNode<Element>;

  /**
   * 在给定作用域内按 CSS 选择器匹配
   *
   * @param css - CSS 选择器
   * @param parent - 作用域节点
   * @returns 匹配到的节点序列，无匹配时为空序列
   */
  match(css: string, parent: TemmeNode<Element>): Iterable<TemmeNode<Element>>;

  /**
   * 按 class 名直取（`NativeLookup` 的 class 快路径）
   *
   * @param className - class 名
   * @param parent - 作用域节点
   * @returns 命中节点集合，不支持时为空集合
   */
  getElementsByClassName(
    className: string,
    parent: TemmeNode<Element>,
  ): NodeCollection<TemmeNode<Element>>;

  /**
   * 按 id 直取（`NativeLookup` 的 id 快路径）
   *
   * @param id - 元素 id
   * @param parent - 作用域节点
   * @returns 命中节点，未命中或不支持时为 null
   */
  getElementById(id: string, parent: TemmeNode<Element>): TemmeNode<Element> | null;

  /**
   * 按标签名直取（`NativeLookup` 的 tag 快路径）
   *
   * @param tagName - 标签名
   * @param parent - 作用域节点
   * @returns 命中节点集合，不支持时为空集合
   */
  getElementsByTagName(
    tagName: string,
    parent: TemmeNode<Element>,
  ): NodeCollection<TemmeNode<Element>>;
}
