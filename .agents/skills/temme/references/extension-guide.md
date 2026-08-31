# Temme 扩展指南

当内置的 `text`/`html`/`node`/`attr` 过程和默认空白策略不够用时，通过 `Env` 注册表扩展；当 `linkedom` 不适用时，自定义 `Adapter`/`Engine`；当加载远程规则时，用 `@zhengxs/temme/schema` 做边界校验。

---

## 1. Env 扩展点（filters / modifiers / procedures）

扩展能力全部通过 `createEnv` 注入，绝不依赖 DSL 里的 `filter`/`modifier`/`procedure` 定义声明（那些是纯文本且永不执行）。`link` 阶段把注册名解析为闭包，**运行期零字典查询**。

### 1.1 过滤器（filters）

对捕获值做纯变换，返回新值。签名：`(input: unknown, ...args) => unknown`。

```ts
import { createEnv, temme } from '@zhengxs/temme';

const env = createEnv({
  filters: {
    trim(v: unknown) {
      return typeof v === 'string' ? v.trim() : v;
    },
    stripTags(v: unknown) {
      return String(v).replace(/<[^>]*>/g, '');
    },
  },
  // whitespace 缺省即 'condense'；需要保留原文时设 'preserve'
});

const result = temme(html, selectors, { env });
```

**过滤链语义**：多个过滤器按序串联；`filter` 返回 `undefined` 时该捕获**跳过写入**（`applyLinkedCapture` 短路）。

### 1.2 修饰符（modifiers）

**直接改写捕获状态**，而非返回值。签名：`(state, key, value, ...args) => void`。适合"把多个捕获聚合成一个结构"等状态级操作。

```ts
const env = createEnv({
  modifiers: {
    appendSuffix(state, key, value, suffix: unknown) {
      state.captures.set(key, `${String(value)}${String(suffix)}`);
    },
  },
});
```

修饰符链按序应用；每个修饰符都可读/写 `state.captures`。未注册的修饰符在 `link` 阶段被静默跳过。

### 1.3 过程（procedures）

用户自定义的取值过程。签名：`(input: unknown, ...args) => unknown`。**非内置过程**的输入统一取 `text` 再交给过程（见 `drive.extractCaptureValue`）。

```ts
const env = createEnv({
  procedures: {
    href(_input: unknown, attrName: string) {
      return `resolve-${attrName}`;
    },
  },
});
```

> 区分：内置过程 `text`/`html`/`node`/`attr` 由适配器 `extract` 硬编码派发，**不查** `procedures` 字典；只有 `hasNonBuiltinProcedure = true` 的捕获走 `boundProcedure`。

---

## 2. 空白策略

`whitespace` 二值：`'condense'`（默认，trim + 折叠连续空白）/ `'preserve'`（原样保留）。在 `createEnv` 设置，`link` 阶段固化到 `LinkedPlan`。**数据清洗场景建议**：默认 `condense` 已足够；需要精确文本（如代码块、保留换行）时设 `preserve`。

---

## 3. 自定义 DOM 后端（HtmlParser / Engine）

默认 `linkedom()` 基于 `linkedom` 库；浏览器环境可用 `domParser()`（原生 `DOMParser`）。换后端或脱离 DOM 依赖测试时：

- 实现 `HtmlParser<Element>`：`parseFromString`、`createNode`、`match`、`getElementsByClassName/ById/TagName`。后三个是**原生直取快路径**，可不支持（返回空集合/`null`），运行时自动回退 `match`。
- 用 `createEngine(parser)` 包一层，或在 `temme(html, plan, { parser })` 注入自定义解析器。
- 需要在解析器之上定制 select/resolve 行为时，自己实现一个满足 `Engine` 接口的对象，再配合 `createExtractor` 手动驱动（见 `api-reference.md`）。

```ts
import { createEngine, linkedom } from '@zhengxs/temme';
import type { Engine } from '@zhengxs/temme';

// 基于 linkedom 解析器创建引擎
const engine: Engine<unknown> = createEngine(linkedom());
// 传 plan 给 drive 自行驱动，或用 createExtractor 封装
```

### 最小接口（HtmlParser）

```ts
interface HtmlParser<Element> {
  parseFromString(html: string, type?: DOMParserSupportedType): TemmeNode<Element>;
  createNode(element: Element): TemmeNode<Element>;
  match(css: string, parent: TemmeNode<Element>): Iterable<TemmeNode<Element>>;
  getElementsByClassName(className, parent): NodeCollection<TemmeNode<Element>>;
  getElementById(id, parent): TemmeNode<Element> | null;
  getElementsByTagName(tagName, parent): NodeCollection<TemmeNode<Element>>;
}

interface TemmeNode<Element> {
  extract(procedureName: string, args: string[]): unknown;
  parent(): TemmeNode<Element> | null;
  readonly native: Element;
}
```

`TemmeNode.extract` 未识别过程名时返回 `undefined`（fail-safe）。`engine.resolve` 支持 `self`/`parent` 重定位；`TemmeNode.parent()` 用于上溯父链。

---

## 4. 远程规则边界校验（@zhengxs/temme/schema）

加载外部/远程 JSON 规则时，包内零校验，合法性由消费方在边界处理：

```ts
import { deserialize } from '@zhengxs/temme';
import { parseExecutionPlan } from '@zhengxs/temme/schema';

const remoteJson = await fetchRules();
const plan = parseExecutionPlan(deserialize(remoteJson));
```

- `parseExecutionPlan(plan: unknown)`：用 zod `ExecutionPlanSchema` 校验，非法输入抛 `ZodError`，由调用方决定呈现方式。
- 校验通过后，**核对 `plan.manifest`**（`filters`/`modifiers`/`procedures` 依赖名集合）是否都在当前 `Env` 已注册——未注册的扩展点在运行期被静默跳过，可能产出缺失字段。这是排查"远程规则少字段"的关键。

### schema 导出的 Schema 常量

`TypeAnnotationSchema`、`SerializableLiteralSchema`、`FieldLookupSchema`、`PlanFilterSchema`、`PlanModifierSchema`、`PlanCaptureSchema`、`PlanNodeSchema`、`ManifestSchema`、`ExecutionPlanSchema`、`parseExecutionPlan`。这些只用于**边界校验**，运行时链路不调用。

---

## 5. 性能提示

- **复用计划**：同模板多页用 `compile` 一次 + `extract`，别每页都 `temme`（避免重复编译）。
- **快路径**：尽量用单片段/简单选择器，编译期可降维为 `fieldLookup` 原生直取（class/id/tag/attr），避开 `querySelectorAll` 全量扫描。
- **`resolve` 上溯**：多片段用 `parent + steps` 上溯还原作用域，避免运行时重跑整条 CSS 路径。
- 运行时扩展点已绑定闭包，零字典查询——注册表查询只发生在 `link` 阶段。
