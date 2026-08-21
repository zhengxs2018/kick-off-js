/**
 * 规则 AST 类型：描述选择器树的结构，手写维护
 *
 * - 类型必须与解析器构造器实际形状一致，不得凭空补字段
 */

/** 原始字面量：规则文本中可出现的常量值，含 RegExp 实例 */
export type Literal = string | number | boolean | null | RegExp;

/** 组合符：片段之间的 CSS 关系 */
export type Combinator = ' ' | '>' | '+' | '~';

/** 属性比较运算符 */
export type AttributeOperator = '=' | '~=' | '|=' | '*=' | '^=' | '$=';

/**
 * 函数过滤器：语法层 `|name(args)` / `||name(args)` 与修饰符链两种形态的联合
 *
 * - 两个成员互斥且**无共享可选字段**：普通过滤器分支不含 `isModifier`，修饰符链分支不含 `name` / `args`，
 *   与构造器返回的两种对象一致；写成单 interface + 可选字段会让消费方读到不存在的字段
 */
export type Filter =
  | {
      /** true 表示 `||`（对数组每个元素分别过滤），false 表示 `|`（对整个值过滤） */
      isArrayFilter: boolean;
      /** 过滤器注册名 */
      name: string;
      /** 过滤器参数（原始字面量） */
      args: Literal[];
    }
  | {
      /** 标记该成员为修饰符链分支 */
      isModifier: true;
      /** 修饰符名列表，按序应用 */
      modifiers: string[];
    };

/** 修饰符：文法归约为修饰符名数组，写入状态时按序应用；null 表示无 */
export type Modifier = string[] | null;

/** 捕获定义：CSS 选择器后 `$name` 式的取值声明，含可选类型注解与状态修饰符 */
export interface Capture {
  /** 捕获键名：裸 `$` 在归一阶段转为内置默认键 */
  name: string;
  /** 类型注解（`:number` 等）归约后的类型标识列表，null 表示无 */
  typeAnnotation: string[] | null;
  /** 函数过滤器列表，null 表示无 */
  filterList: Filter[] | null;
  /** 状态修饰符名列表，null 表示无 */
  modifier: Modifier;
}

/** ID 限定符：`#id` */
export interface IdQualifier {
  type: 'id-qualifier';
  /** 目标 id 值 */
  id: string;
}

/** 类限定符：`.className` */
export interface ClassQualifier {
  type: 'class-qualifier';
  /** 目标类名 */
  className: string;
}

/** 属性限定符：`[attr op value]`，value 可为字面量或嵌套捕获 */
export interface AttributeQualifier {
  type: 'attribute-qualifier';
  /** 属性名 */
  attribute: string;
  /** 比较运算符，null 表示仅存在性判断（`[attr]`） */
  operator: AttributeOperator | null;
  /** 比较值：字面量或嵌套捕获，null 表示无值 */
  value: string | Capture | null;
}

/** 伪类限定符：`:name(content?)` */
export interface PseudoQualifier {
  type: 'pseudo-qualifier';
  /** 伪类名称 */
  name: string;
  /** 伪类内容，null 表示无 */
  content: string | null;
}

/** 限定符联合：区分 id / class / 属性 / 伪类四种选择器修饰 */
export type Qualifier = IdQualifier | ClassQualifier | AttributeQualifier | PseudoQualifier;

/** 选择器片段：组合符 + 元素 + 限定符集合 */
export interface Section {
  /** 与上一片段的组合方式 */
  combinator: Combinator;
  /** 元素标签名或通配 `*` */
  element: string;
  /** 限定符列表 */
  qualifiers: Qualifier[];
}

/** 取值过程声明：过程名 + 参数（字面量或嵌套捕获） */
export interface Procedure {
  /** 过程名 */
  name: string;
  /** 过程参数 */
  args: (Literal | Capture)[];
}

/** 普通选择器：含片段序列、可选过程、可选数组捕获与子选择器 */
export interface NormalSelector {
  type: 'normal-selector';
  /** 片段序列，自左向右构成 CSS 路径 */
  sections: Section[];
  /** 取值过程声明，null 表示默认 text 过程 */
  procedure: Procedure | null;
  /** 数组捕获声明，null 表示标量捕获 */
  arrayCapture: Capture | null;
  /** 子选择器集合 */
  children: TemmeSelector[];
}

/** 父引用选择器：`&` 引用父节点作为取值来源 */
export interface ParentRefSelector {
  type: 'parent-ref-selector';
  /** 父节点作用域内的片段 */
  section: Section;
  /** 取值过程声明，null 表示默认 text 过程 */
  procedure: Procedure | null;
}

/** 赋值语句：将字面量直接绑定到捕获键，跳过 DOM 抽取 */
export interface Assignment {
  type: 'assignment';
  /** 目标捕获 */
  capture: Capture;
  /** 字面量值 */
  value: Literal;
}

/** 片段定义：命名可复用选择器片段集合 */
export interface SnippetDefine {
  type: 'snippet-define';
  /** 片段名 */
  name: string;
  /** 片段内的选择器集合 */
  selectors: TemmeSelector[];
}

/** 片段展开：引用已定义的片段 */
export interface SnippetExpand {
  type: 'snippet-expand';
  /** 片段名 */
  name: string;
}

/**
 * 语法层定义声明：`filter` / `modifier` / `procedure` 三种同形
 *
 * - `code` / `argsPart` 是**纯文本**且永不被执行：本仓库红线禁止 eval / new Function，
 *   能力一律来自编译期固定的函数引用；编译期直接静默丢弃这类声明
 */
export interface DefineSelector {
  type: 'filter-define' | 'modifier-define' | 'procedure-define';
  /** 定义名 */
  name: string;
  /** 参数签名文本 */
  argsPart: string;
  /** 过程体文本 */
  code: string;
}

/** 选择器联合：规则 AST 的全部节点形态 */
export type TemmeSelector =
  | ParentRefSelector
  | NormalSelector
  | Assignment
  | SnippetDefine
  | SnippetExpand
  | DefineSelector;
