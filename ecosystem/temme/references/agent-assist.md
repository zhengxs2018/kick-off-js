# Temme Agent 辅助指南

面向**编写、调试、验证 temme 规则**的 Agent（以及集成到爬虫/ETL 管线的人）。核心要点：用辅助函数构造 AST 而非手写、理解 fail-safe 语义避免"静默少字段"、用验证循环确保规则正确。

---

## 1. 用辅助函数构造 AST（不要手写裸对象）

`temme()` 接收结构化 AST（`TemmeSelector[]`）。能写字符串规则时**优先用 `parse`**（`temme(html, parse(rule))`）；只有规则需程序化生成/来自远程还原时才手写 AST。手写时**约定**：定义一组纯构造函数，复用它们拼规则（参考 `assets/examples/04-crawl-pipeline.ts` 的 `capture()` / `arrayTextSelector()` 模式）；批量拼列表列时优先用顶层导出的 `listColumn`（见 `api-reference.md` §顶层入口）。性能分层对比见仓库 `bench/extractor.bench.ts`（`bun run bench`）。

```ts
import type { TemmeSelector, Capture, Section } from '@zhengxs/temme';

function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return { name, typeAnnotation: null, filterList: null, modifier: null, ...extra };
}

function section(
  element: string,
  qualifiers: Section['qualifiers'] = [],
  combinator: Section['combinator'] = ' ',
): Section {
  return { combinator, element, qualifiers };
}

function textSelector(element: string, className: string, captureName: string): TemmeSelector {
  return {
    type: 'normal-selector',
    sections: [section(element, [{ type: 'class-qualifier', className }])],
    procedure: { name: 'text', args: [capture(captureName)] },
    arrayCapture: null,
    children: [],
  };
}

function attrSelector(
  element: string,
  className: string,
  captureName: string,
  attr: string,
): TemmeSelector {
  return {
    type: 'normal-selector',
    sections: [section(element, [{ type: 'class-qualifier', className }])],
    procedure: { name: 'attr', args: [capture(captureName), attr] },
    arrayCapture: null,
    children: [],
  };
}

const selectors: TemmeSelector[] = [
  textSelector('span', 'name', 'zh'),
  attrSelector('a', 'link', 'href', 'href'),
];
```

要点：

- `sections` 里 `combinator: ' '` 表示后代，必须显式写（不能省略）。
- `procedure.args` 里嵌入 `capture()`（捕获），字面量参数（如 `attr` 名）直接给字符串。
- 数组捕获：`arrayCapture: capture('items')`（此时 `append=true`）。

---

## 2. 复用编译计划（多页/多文档）

同一页面模板要抽多页时，**编译一次**，反复 `temme(html, plan)`：

```ts
import { compile, temme } from '@zhengxs/temme';

const plan = compile(selectors); // 一次
for (const html of pages) {
  const data = temme(html, plan); // 复用
  // ...
}
```

需要把规则发给其它进程/入库时：

```ts
import { compile, serialize, deserialize } from '@zhengxs/temme';
import { parseExecutionPlan } from '@zhengxs/temme/schema';

const json = serialize(compile(selectors)); // 存库/传输
const plan = parseExecutionPlan(deserialize(json)); // 加载侧校验
```

---

## 3. 验证循环（写规则后必做）

规则的正确性必须用真实 HTML 验证。推荐流程：

1. **用最小 HTML 片段**构造输入，跑 `temme()`。
2. 断言返回对象的关键键（字段存在、类型、数组长度）。
3. 覆盖边界：空元素、缺属性、含非法 CSS、嵌套作用域。

```ts
import { temme } from '@zhengxs/temme';

function extract(html: string, selectors: TemmeSelector[]) {
  return temme(html, selectors);
}

// 正向
expect(extract('<span class="name">麻黄</span>', selectors)).toEqual({ zh: '麻黄' });

// 边界：空文本 → textContent 为空串
expect(extract('<span class="name"></span>', selectors)).toEqual({ zh: '' });

// 边界：缺属性 → attr 返回 null，写入层跳过（undefined/null 不写）
const r = extract('<a class="link">x</a>', selectors);
expect('href' in r).toBe(false);
```

> 用 `bun test` 跑断言（temme 包测试脚本 `bun test`）。改规则后重跑，**做→验证→修复→重复**直到通过。

---

## 4. fail-safe 语义（最容易踩的坑）

temme 所有失败**静默降级、不抛错**。这带来便利，但也意味着"规则写错"表现为"结果缺字段"，而非报错。排查少字段时按此顺序检查：

| 现象           | 可能原因               | 处置                                                          |
| -------------- | ---------------------- | ------------------------------------------------------------- |
| 结果缺某键     | 选择器未命中节点       | 核对 CSS 路径与 HTML 结构（含嵌套作用域）                     |
| 结果缺某键     | 过程名未注册           | 非内置过程需在 `env.procedures` 注册；未注册则跳过            |
| 结果缺某键     | 过滤链返回 `undefined` | 检查 filter 是否短路了该值                                    |
| 属性值为 null  | `attr` 缺属性          | `undefined`/`null` 写入层跳过，键不出现                       |
| 值被折叠       | `condense` 空白        | 需精确文本时设 `whitespace: 'preserve'`                       |
| 标量只取首个   | First-Wins             | 想取全部用数组捕获（`arrayCapture`）                          |
| 远程规则少字段 | 依赖未注册             | 用 `plan.manifest` 核对依赖清单（见 `extension-guide.md` §4） |

**诊断技巧**：

- 先确认选择器能命中：用 `linkedom().match(css, doc)` 或 `createEngine(parser).select` 独立测试命中数。
- 用 `extract` 时若规则来自外部，先 `parseExecutionPlan` 校验 + 核对 manifest。

---

## 5. 与爬虫 / ETL 管线集成

- **按页驱动同一计划**：爬虫每拿到一页 HTML 就 `temme(html, plan)`，产出结构化记录，直接入列（如传给下游清洗/入库）。
- **数组捕获收集列表**：用 `arrayCapture` 抽取列表页的每一项，得到数组记录，适合批量入库。
- **类型注解清洗**：抽取数字/布尔字段用 `:number`/`:int`/`:bool` 注解，省去下游 `Number()`。
- **自定义过程做领域解析**：把"价格串→数字"、"日期串→ISO"等解析封装为 `procedure` 注册，规则保持声明式。
- **空白策略**：清洗场景默认 `condense`；保留原文用 `preserve`。

---

## 6. 快速备忘

- `temme(html, parse(rule))`：一次抽（字符串规则）。
- `temme(html, selectors)`：一次抽（手写 AST）。
- `compile` + `temme(html, plan)`：多页复用。
- `serialize`/`deserialize` + `@zhengxs/temme/schema`：远程规则。
- `createEnv({ filters, modifiers, procedures })`：扩展。
- `linkedom()` / `domParser()`：内置解析器；`createEngine(customParser)` 换后端。
- 一切失败 fail-safe：**结果缺字段 ≠ 报错**，按 §4 排查。
