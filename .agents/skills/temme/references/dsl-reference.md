# Temme DSL 语法参考

本文件从**使用者视角**描述 temme 规则语言。规则文本经 `parse(rules: string)` 解析为 `TemmeSelector[]` AST，再由 `compile` 编译为执行计划。DSL 语法元素与 AST 类型一一对应。

> 两种写规则的入口：
>
> - **方式A（推荐，简单）**：直接写字符串规则，用 `parse` 解析——`temme(html, parse('div .name $name'))`。
> - **方式B（AST）**：手写 `TemmeSelector[]` 对象，适合程序化生成 / 从远程规则还原。
>
> 两种方式产出同样的 AST，`compile` 消费方式一致。下面先给字符串规则语法，再给对应的 AST 形状，便于你理解 AST 或从代码生成规则。

---

## 0. 字符串规则（parse 语法）

`parse(rules: string)` 接受类 jQuery 的规则文本，语法元素包括：

| 语法                                | 含义                                  | 示例                            |
| ----------------------------------- | ------------------------------------- | ------------------------------- | --------------- |
| `tag` / `.class` / `#id` / `[attr]` | CSS 选择器片段                        | `div .item`、`a[href]`          |
| `$name`                             | 捕获：把选中元素取值写入结果键 `name` | `div .name $name`               |
| `$`（裸）                           | 默认键捕获，`toResult` 整体提升       | `span.title $`                  |
| `:number` / `:int` / `:bool`        | 类型注解                              | `div .price $price:number`      |
| `                                   | name(args)`                           | 对整个值过滤                    | `$text \| trim` |
| `\|\|name(args)`                    | 对数组每个元素分别过滤                | `$items \|\| trim`              |
| `@modifier`                         | 状态修饰符链                          | `$v @appendSuffix('.')`         |
| `{ ... }` 子选择器 / `&` 父引用     | 作用域与父子取值                      | `li.item { a $href }`、`& .sub` |
| `= value` 赋值 / `@snippet`         | 字面量绑定 / 片段定义与展开           | `$x = 42`、`@define`            |

> 红线：`filter` / `modifier` / `procedure` 的 `define` 声明（含 `code`）是**纯文本且永不执行**——temme 禁止 `eval`/`new Function`，能力一律来自编译期固定的函数引用。编译期直接**静默丢弃**这类声明。扩展能力请走 `createEnv` 注入（见 `extension-guide.md`），不要依赖 define 声明。

下面把文本语法映射到 AST 形状，便于手写 AST（方式B）。

---

## 1. 选择器（Selector）

选择器描述"去哪取数据"。核心形态是 `NormalSelector`：一串 CSS 片段（`sections`）+ 可选取值过程（`procedure`）+ 可选数组捕获（`arrayCapture`）+ 子选择器（`children`）。

### 1.1 片段（Section）

每个片段由 `combinator`（组合符）+ `element`（标签）+ `qualifiers`（限定符）组成：

```ts
interface Section {
  combinator: Combinator; // ' ' | '>' | '+' | '~'
  element: string; // 标签名或 '*'
  qualifiers: Qualifier[]; // id/class/属性/伪类
}
```

多个片段拼接成 CSS 路径：`ul > li.item` 对应两个 Section。

### 1.2 限定符（Qualifier）

四种限定符，对应 CSS 修饰：

| 类型 | AST 形态                                                     | 示例                            |
| ---- | ------------------------------------------------------------ | ------------------------------- |
| ID   | `{ type:'id-qualifier', id }`                                | `#main`                         |
| 类   | `{ type:'class-qualifier', className }`                      | `.item`                         |
| 属性 | `{ type:'attribute-qualifier', attribute, operator, value }` | `[href]`、`[type="a"]`          |
| 伪类 | `{ type:'pseudo-qualifier', name, content }`                 | `:first-child`、`:nth-child(2)` |

属性限定符的 `operator` 支持 `=` `~=` `|=` `*=` `^=` `$=`；`operator` 与 `value` 为 `null` 时表示仅存在性判断（`[attr]`）。`value` 可为**嵌套捕获**（`$name`），用于按属性值捕获——见 §2.4。

### 1.3 组合符（Combinator）

- `' '` 后代
- `'>'` 子代
- `'+'` 相邻兄弟
- `'~'` 通用兄弟

---

## 2. 捕获（Capture）

捕获是从选中元素取值并写入结果的关键。捕获定义：

```ts
interface Capture {
  name: string; // 结果键名；裸 `$` 归为一键（见 §2.3）
  typeAnnotation: string[] | null; // ':number' 等，见 §5
  filterList: Filter[] | null; // '|filter' / '||filter' / 修饰符链，见 §3
  modifier: Modifier; // 状态修饰符名列表，见 §3.3
}
```

### 2.1 文本 / 过程取值

普通选择器的 `procedure` 指定**取值过程**。未显式指定时默认 `text`（取 `textContent`）。

```ts
interface Procedure {
  name: string; // 过程名
  args: (Literal | Capture)[]; // 参数（字面量或嵌套捕获）
}
```

内置过程（由适配器硬编码，不查注册表）：

| 过程名 | 返回值                     |
| ------ | -------------------------- |
| `text` | 元素 `textContent`         |
| `html` | 元素 `innerHTML`           |
| `node` | 元素本身（宿主原生节点）   |
| `attr` | 属性值，属性名取 `args[0]` |

`procedure.args` 里可嵌入**捕获**（`Capture`），表示把该过程针对其它捕获的产出写入结果。例如 `{ name:'text', args:[capture('title')] }` 表示把文本捕获到 `title` 键。过程参数若为字面量则参与过程调用；若为捕获则生成一个独立捕获。

### 2.2 数组捕获（arrayCapture）

当 `procedure` 声明在 `arrayCapture` 上时，捕获走**累积语义**：命中的每个元素都会把值 append 进一个数组（而非 First-Wins 覆盖）。用于"抽取一组同类项"。

### 2.3 裸 `$` 默认键

裸 `$`（无键名）归一为内置默认键时，`toResult` 会把该值**整体提升**为最终返回值（而非放进普通对象）。适合"只要一个值"的规则。注意：命名捕获与裸捕获并存时，若存在默认键，最终结果被提升为该默认值。

### 2.4 嵌套捕获

- **过程参数**中可嵌入 `Capture`（§2.1）。
- **属性限定符**的 `value` 可为 `Capture`：`[href=$url]` 在按属性匹配的同时，把该属性值捕获为 `url`。
- 编译期 `compileAttributeCaptures` / `compileProcedureCaptures` 会把这类嵌套捕获注册到节点的 `captures`。

---

## 3. 过滤器与修饰符

`Capture.filterList` 是过滤器链，语法层有三种形态（联合类型 `Filter`）：

### 3.1 标量过滤 `|name(args)`

对整个捕获值做一次过滤。AST：

```ts
{ isArrayFilter: false, name: string, args: Literal[] }
```

多个 `|` 按序构成链，前一个的输出作为后一个的输入。

### 3.2 数组过滤 `||name(args)`

对**数组每个元素**分别过滤（对 `arrayCapture` 的每个项应用）。AST：

```ts
{ isArrayFilter: true, name: string, args: Literal[] }
```

### 3.3 修饰符链

语法层把一段 `@modifier` 链（无 `name`/`args`）表示为独立的联合分支：

```ts
{ isModifier: true, modifiers: string[] }
```

修饰符**直接改写捕获状态**（`(state, key, value) => void`），而非返回新值——见 `references/extension-guide.md`。编译期 `splitFilters` 把该分支并入 `modifier` 列表。

### 3.4 fail-safe

未注册的过滤器名在 `link` 阶段被静默跳过（过滤链节点丢弃），不抛错。见 `references/agent-assist.md`。

---

## 4. 其它选择器形态

`TemmeSelector` 联合还包含：

### 4.1 父引用选择器（ParentRefSelector）

`{ type:'parent-ref-selector', section, procedure }`：以父节点作用域内的片段作为取值来源。编译期 `fieldLookup` 固定为 `{ relation:'self' }`。

### 4.2 赋值语句（Assignment）

`{ type:'assignment', capture, value }`：把**字面量**直接绑定到捕获键，跳过 DOM 抽取。编译期生成带 `assignValue` 的节点。

### 4.3 片段定义与展开（SnippetDefine / SnippetExpand）

- `{ type:'snippet-define', name, selectors }`：定义可复用的选择器集合。
- `{ type:'snippet-expand', name }`：引用已定义的片段。

### 4.4 定义声明（DefineSelector）

`{ type:'filter-define'|'modifier-define'|'procedure-define', name, argsPart, code }`：

> **重要红线**：`code`/`argsPart` 是**纯文本且永不执行**——temme 禁止 `eval`/`new Function`，能力一律来自编译期固定的函数引用。编译期直接**静默丢弃**这类声明，不产生节点。扩展能力请走 `createEnv` 注入（见 `extension-guide.md`），不要依赖 `filter`/`modifier`/`procedure` 定义声明。

---

## 5. 类型注解

`typeAnnotation` 为字符串数组，`link` 阶段绑定为**转换器链**（先于过滤链执行）。常用：

| 注解      | 转换器   | 行为      |
| --------- | -------- | --------- |
| `:number` | `num`    | 转 Number |
| `:int`    | `int`    | 取整      |
| `:bool`   | `bool`   | 布尔化    |
| `:text`   | `text`   | 转 String |
| `:bigint` | `bigint` | 转 BigInt |

`number` 别名映射到 `num`。多个注解按序串行转换（如 `:number` + `:int`）。未知注解名静默透传。

---

## 6. 语义要点

- **标量捕获**：First-Wins，首值保留，后续覆盖被忽略。
- **数组捕获**：真累积，命中项 append 进数组；已有标量会被转换为单元素数组再 append。
- **空白策略**：默认 `condense`（trim + 折叠连续空白）；可在 `createEnv` 设 `whitespace: 'preserve'` 保留原样。
- **遍历**：显式栈 DFS，避免深层 DOM 调用栈溢出。
- **fail-safe**：非法 CSS、未注册扩展点、取不到的节点一律静默降级，不抛错。
