import type {
  AttributeQualifier,
  ClassQualifier,
  Combinator,
  NormalSelector,
  Procedure,
  Qualifier,
  Section,
} from './compiler/ast.js';

/** 列表列声明：从 `tr[data-type]` 起，按单元格类定位，声明式抽一列 */
export interface ListColumnOptions {
  /** 单元格 class（不含前缀点），如 `rdexn-id`、`rdexn-name` */
  cellClass: string;
  /** 捕获键名 */
  capture: string;
  /**
   * 取值过程：缺省取 textContent。
   * 例：`{ name: 'attr', args: ['href'] }` 抽链接地址。
   */
  procedure?: { name: string; args: string[] };
  /**
   * 是否在单元格内下钻到锚点 `a` 再取值（列表名/链接常用）。
   * 缺省 false：直接对 `td.<cellClass>` 取值。
   */
  anchor?: boolean;
}

function attributeQualifier(attribute: string): AttributeQualifier {
  return { type: 'attribute-qualifier', attribute, operator: null, value: null };
}

function classQualifier(className: string): ClassQualifier {
  return { type: 'class-qualifier', className };
}

function section(combinator: Combinator, element: string, qualifiers: Qualifier[]): Section {
  return { combinator, element, qualifiers };
}

/**
 * 构造一个列表（数组捕获）列选择器。
 *
 * temme 列表模式要求各列作为独立顶层 selector，各自从 `tr[data-type]` 起点
 * 累加进同名列数组；本工厂封装这一重复结构，避免在业务侧裸拼 AST。
 *
 * @param options - 列声明
 * @returns 可直接并入 `TemmeSelector[]` 的 `NormalSelector`
 */
export function listColumn(options: ListColumnOptions): NormalSelector {
  const { cellClass, capture, procedure, anchor = false } = options;
  const procedureNode: Procedure | null =
    procedure === undefined ? null : { name: procedure.name, args: procedure.args };
  const cellSections: Section[] = [section(' ', 'td', [classQualifier(cellClass)])];
  if (anchor) {
    cellSections.push(section(' ', 'a', []));
  }
  return {
    type: 'normal-selector',
    sections: [section(' ', 'tr', [attributeQualifier('data-type')]), ...cellSections],
    procedure: procedureNode,
    arrayCapture: { name: capture, typeAnnotation: null, filterList: null, modifier: null },
    children: [],
  };
}
