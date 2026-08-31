# Temme API 参考

基于 `@zhengxs/temme` 的顶层导出、子路径导出与核心类型。使用者视角：你知道每个 API 做什么、签名如何、何时用。

## 导出地图

### 顶层入口（`temme` → `src/index.ts`）

- 函数：`temme`、`parse`、`compile`、`serialize`、`deserialize`、`createEnv`、`link`、`drive`、`createEngine`、`createExtractor`、`listColumn`，以及解析器 `linkedom` / `domParser`，state 工具 `accumulate` / `applyLinkedCapture` / `condenseWhitespace` / `createCaptureState` / `toResult`。
- 常量：`EMPTY_NODE_COLLECTION`。
- 类型：见 §3。

### 子路径

| 子路径                    | 内容                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@zhengxs/temme/compiler` | `parse`、`compile`、`serialize`、`deserialize` 及 `ExecutionPlan`/`PlanCapture`/`PlanFilter`/`PlanModifier`/`PlanNode`/`Manifest` 类型，AST 类型全集 |
| `@zhengxs/temme/runtime`  | `createEngine`/`link`/`drive`/`createEnv`/`accumulate`/`applyLinkedCapture`/`condenseWhitespace`/`createCaptureState`/`toResult` 及运行时类型        |
| `@zhengxs/temme/schema`   | `parseExecutionPlan` 及 zod Schema 常量（边界校验）                                                                                                  |

> `EMPTY_NODE_COLLECTION` 与 `linkedom`/`domParser`/`HtmlParser`/`TemmeNode` 均经顶层 `index` 从 `parsers` re-export，无独立子路径。
>
> `parse` 位于 `compiler` 子路径，并随 `index.ts` 的 `export *` 一并 re-export 到顶层。

---

## 1. 链路（parse → compile → link → drive）

temme 把"规则 → 结果"拆为四段，便于复用与替换后端：

```text
parse(rules)          → TemmeSelector[]（规则文本 → AST，可选前置）
   ↓ compile(selectors) → 纯 POJO 执行计划（可序列化、可缓存）
   ↓ link(plan, env)    → 绑定扩展点闭包为 LinkedPlan（运行期零查表）
   ↓ drive(plan, engine, doc) → 驱动 DOM 抽取，产出结果对象
```

- **parse**：把纯字符串规则文本解析为 `TemmeSelector[]` AST，是快速上手推荐入口。
- **compile**：无副作用、零校验、信任输入。产出 `ExecutionPlan`（`roots: number[]` + `nodes: PlanNode[]`，节点 id = 数组下标）。
- **link**：把 filter/modifier/procedure 从注册表解析为闭包；未注册者静默降级。绑定类型转换器。
- **drive**：显式栈 DFS 驱动 `engine.select` + `engine.resolve`，写状态，返回 `Record<string, unknown>`。

> `temme()` 把 parse→compile→link→drive 串成一步；传已编译 `ExecutionPlan` 时跳过 compile（适合已编译计划复用）。

---

## 2. 函数签名

### temme

```ts
function temme(
  html: string,
  selectorsOrPlan: string | TemmeSelector[] | ExecutionPlan,
  options?: TemmeOptions,
): Record<string, unknown>;
```

一次性抽取。内部完成 compile→link→drive。`options` 含 `parser`（自定义 DOM 解析器，默认 `linkedom`）、`EnvInit`（扩展点 + 空白策略）及 `env`（复用已建 `Env`）。三种输入形态：

- `string`：规则文本，内部先 `parse` 再走 `select`（字符串规则）。
- `TemmeSelector[]`：手写 AST，走 `select`（内部 compile）。
- `ExecutionPlan`：已编译计划，走 `extract`（跳过 compile）。

```ts
interface TemmeOptions extends EnvInit {
  env?: Env; // 复用已建环境（扩展点 + 空白策略）；缺省用 createEnv(init)
  parser?: HtmlParser<unknown>; // 默认 linkedom()
}
```

### parse

```ts
function parse(rules: string): TemmeSelector[];
```

把纯字符串规则文本解析为规则 AST。配合 `temme(html, parse(ruleString))` 或 `compile(parse(ruleString))` 使用。语法见 `references/dsl-reference.md`。

### compile

```ts
function compile(selectors: TemmeSelector[]): ExecutionPlan;
```

AST → 纯 POJO 执行计划。RegExp 字面量降维为 `{$regex,source,flags}`；固化结构化布尔特征；收集 `manifest`；`define`/`snippet` 声明不产生节点（静默丢弃）。

### serialize / deserialize

```ts
function serialize(plan: ExecutionPlan): string;
function deserialize(json: string): ExecutionPlan;
```

- `serialize`：`JSON.stringify`，RegExp 经 reviver 降维为 `{$regex}` 字典。
- `deserialize`：`JSON.parse` 经 reviver 把 `{$regex}` 原子还原为 `RegExp`。信任输入，不补默认值。

适合把规则**入库 / 网络传输**。远程载荷的合法性校验用 `@zhengxs/temme/schema`（见 `extension-guide.md`）。

### createEnv

```ts
function createEnv(init?: EnvInit): Env;
```

构建运行时环境。`EnvInit` 字段：

```ts
interface EnvInit {
  filters?: Record<string, FilterFunction>; // 未绑定参数的过滤器
  modifiers?: Record<string, ModifierHandler>; // 未绑定参数的修饰符
  procedures?: Record<string, ProcedureHandler>; // 未绑定参数的用户过程
  whitespace?: WhitespaceMode; // 'condense' | 'preserve'
}
```

`FilterFunction = (input, ...args) => unknown`；`ModifierHandler = (state, key, value, ...args) => void`；`ProcedureHandler = (input, ...args) => unknown`。缺省 `whitespace = 'condense'`。

### link

```ts
function link(plan: ExecutionPlan, env: Env): LinkedPlan;
```

编译期计划 → 运行期计划（闭包绑定）。`LinkedPlan` 含 `roots` / `nodes` / `whitespace`。

### drive

```ts
function drive<Element>(
  plan: LinkedPlan,
  engine: Engine<Element>,
  doc: TemmeNode<Element>,
): Record<string, unknown>;
```

驱动已链接计划。`engine.select` 负责节点选取，`engine.resolve` 负责字段直取重定位；写状态并返回结果。

### createEngine

```ts
function createEngine<Element>(parser?: HtmlParser<Element>): Engine<Element>;
```

基于 DOM 解析器创建引擎。缺省自动选择：有全局 `DOMParser` 用 `domParser()`，否则用 `linkedom()`。引擎只做"计划 → 节点序列"解析，不持有捕获状态。所有解析失败 fail-safe（返回空序列/原节点）。

### createExtractor

```ts
function createExtractor<Element>(options?: ExtractorOptions<Element>): Extractor<Element>;
```

创建可复用的提取器实例，暴露 `load(html)` / `select(doc, selectors)` / `extract(doc, plan)` / `execute(doc, linkedPlan)` 四个方法，用于需要手动控制 parse→link→drive 各阶段或复用同一 `Env`/`parser` 的场景。

```ts
interface ExtractorOptions<Element> {
  parser?: HtmlParser<Element>;
  env?: Env;
}
```

### linkedom / domParser

```ts
function linkedom(): HtmlParser<unknown>;
function domParser(): HtmlParser<Element>;
```

两个内置 DOM 解析器工厂。`linkedom` 为默认后端（零依赖，`linkedom` 库）；`domParser` 基于浏览器原生 `DOMParser`（Chrome ≥ 109）。两者都实现 `HtmlParser`：`parseFromString` 接受 HTML 字符串、`match` 用原生 `querySelectorAll` 按节点作用域求值、`getElementsByClassName/ById/TagName` 提供原生直取快路径。

### state 工具

- `accumulate(state, key, value, append)`：取或建写入；`append` 走数组累积、否则 First-Wins；`undefined`/`null` 跳过。
- `applyLinkedCapture(state, capture, rawValue, whitespace?)`：类型转换 → 过滤链 → 修饰符 → 写入。
- `condenseWhitespace(value)`：折叠连续空白为单空格并去首尾；非字符串原样返回。
- `createCaptureState()`：创建空捕获状态 `{ captures: Map }`。
- `toResult(state)`：投影内部状态为用户结果；存在默认键时整体提升；symbol 键不外泄。

---

## 3. 关键类型

### TemmeSelector / Capture / Section / Filter / Procedure

见 `references/dsl-reference.md`（语法层）。类型定义在 `compiler/ast.ts`。

### listColumn / ListColumnOptions（AST 构造辅助）

`listColumn(options: ListColumnOptions): NormalSelector` 封装"列表模式"下从 `tr[data-type]` 起点按单元格 class 定位、声明式抽一列的重复结构，避免在业务侧裸拼 `NormalSelector` AST。各列作为独立顶层 selector，各自从同一行起点累加进同名列数组。

```ts
interface ListColumnOptions {
  cellClass: string; // 单元格 class（不含前缀点），如 'rdexn-id'
  capture: string; // 捕获键名
  procedure?: { name: string; args: string[] }; // 取值过程，缺省 textContent
  anchor?: boolean; // 是否在单元格内下钻到锚点 a 再取值，缺省 false
}
```

类型定义在 `builder.ts`，随 `src/index.ts` 的 `export *` 暴露为顶层导出。

### ExecutionPlan / PlanNode / PlanCapture / PlanFilter / PlanModifier

```ts
interface ExecutionPlan {
  roots: number[]; // 根节点 id
  nodes: PlanNode[]; // 索引即节点 id
  manifest?: Manifest; // 实际引用的依赖名集合
}

interface PlanNode {
  parentId: number | null;
  css: string;
  captures: PlanCapture[];
  children: number[]; // 子节点 id
  assignValue?: SerializableLiteral; // 赋值语句静态值
  fieldLookup?: FieldLookup; // 编译期字段直取指令
}

interface PlanCapture {
  name: string;
  typeAnnotation: string[] | null;
  filterList: PlanFilter[] | null;
  modifier: PlanModifier[] | null;
  procedureName: string;
  procedureArgs: string[];
  hasTypeModifier: boolean; // 结构化布尔，运行期只读
  hasFilter: boolean;
  hasModifier: boolean;
  hasNonBuiltinProcedure: boolean;
  append: boolean; // 数组捕获累积
}
```

### FieldLookup / NativeLookup / SerializableLiteral

```ts
type FieldLookup =
  | { relation: 'self' }
  | { relation: 'child'; strategy: NativeLookup; anchor?: NativeLookup }
  | { relation: 'parent'; strategy: NativeLookup; steps: number; anchor?: NativeLookup }
  | { relation: 'fallback'; css: string };

type NativeLookup =
  | { kind: 'class'; className: string }
  | { kind: 'id'; id: string }
  | { kind: 'tag'; tagName: string }
  | { kind: 'attr'; name: string; value: string | undefined };

type SerializableLiteral =
  | string
  | number
  | boolean
  | null
  | { $regex: true; source: string; flags: string };
```

`fieldLookup` 是**性能关键**：编译期把静态已知 CSS 降维为原生 DOM API 直取快路径（class/id/tag/attr）；无法降维（伪类、非等值属性）时退回 `fallback` 由 `querySelectorAll` 处理。单片段 `child`，多片段 `parent + steps` 上溯。

### HtmlParser / TemmeNode / Engine

见 `references/extension-guide.md`（自定义后端所需的最小接口）。

---

## 4. 选择入口速查

| 需求                 | 用什么                                                      |
| -------------------- | ----------------------------------------------------------- |
| 抽一次（字符串规则） | `temme(html, parse(rule))`                                  |
| 抽一次（手写 AST）   | `temme(html, selectors)`                                    |
| 同模板多页           | `compile` 一次 + `temme(html, plan)`                        |
| 存库/传输规则        | `compile` + `serialize`；加载侧 `deserialize` + schema 校验 |
| 加变换/取值          | `createEnv` 注册 filters/modifiers/procedures               |
| 换 DOM 后端          | `linkedom()`/`domParser()`，或 `createEngine(customParser)` |
| 手动控制各阶段       | `createExtractor` 的 load/select/extract/execute            |
| 只想查 DOM 不捕获    | 不适合 temme，用通用 CSS/DOM 库                             |
