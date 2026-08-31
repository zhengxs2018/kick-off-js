# Temme 最佳实践与验证案例

本文件收集**经过实际运行验证**的推荐写法与踩坑教训。每个案例都标注了真实行为与适用场景。案例基于 `@zhengxs/temme` 0.1.0，可用 `bun test` / `node --experimental-strip-types` 复现。

> 验证方式：以下案例均通过真实 HTML 输入 + `temme()` 运行确认输出，非纸面推导。

---

## 0. 首选字符串规则（parse）

能用字符串规则表达的，优先用 `parse` 而非常手写 AST——更简洁、可读、易改。

```ts
import { parse, temme } from '@zhengxs/temme';

const rule = `
  td.id   $id:int
  td.name $name
  td.price $price:number
`;
const result = temme(html, parse(rule));
// { id: 1, name: '麻黄', price: 12.5 }
// 标量捕获 First-Wins：命中多项时保留文档第一个匹配
```

> `$name` 默认取 `text`（标量捕获，First-Wins，命中多项时保留第一个匹配）；`$id:int` 是类型注解；`td.id` 选择 `class="id"` 的 `td`。**`$name` 是标量捕获，不是数组捕获**——字符串里 `selector $name` 默认不累积数组。

**字符串规则的数组捕获**：需用 `arrayCapture` 形态（把一组同类项累积为数组）。字符串规则写法为「数组捕获键 + 子选择器」：

```ts
const arrayRule = 'tr $row { td.id $id; td.name $name }';
const result = temme(html, parse(arrayRule));
// { row: ['1麻黄12.5', '2桂枝8', '3黄连9.8'], id: '1', name: '麻黄' }
// row 为数组（每行 text 按文档正序累积），id/name 为行内子选择器的标量捕获（First-Wins 取首）
```

需要「每列独立数组」（`id:[...], name:[...]`）时，用手写 AST 的 `arrayCapture` 逐列声明（见 §1），字符串规则无法直接表达。

## 1. 列表抽取：数组捕获（arrayCapture）

从重复结构（表格行、列表项、卡片）抽取一组记录时，用 `arrayCapture`（编译后 `append=true`，真累积）。

```ts
import { temme } from '@zhengxs/temme';
import type { TemmeSelector, Capture, Section } from '@zhengxs/temme';

function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return { name, typeAnnotation: null, filterList: null, modifier: null, ...extra };
}

function arrayCaptureSelector(element: string, className: string, cap: Capture): TemmeSelector {
  return {
    type: 'normal-selector',
    sections: [{ combinator: ' ', element, qualifiers: [{ type: 'class-qualifier', className }] }],
    procedure: null, // 未指定过程默认 text
    arrayCapture: cap,
    children: [],
  };
}

const html = `<table><tr><td class="id">1</td><td class="name">麻黄</td></tr>
              <tr><td class="id">2</td><td class="name">桂枝</td></tr></table>`;

const result = temme(html, [
  arrayCaptureSelector('td', 'id', capture('id', { typeAnnotation: ['int'] })),
  arrayCaptureSelector('td', 'name', capture('name')),
]);
// { id: [1, 2], name: ['麻黄', '桂枝'] }
```

> **数组捕获按文档正序累积**：`drive` 按文档序正序遍历匹配节点并 append（见 `drive.ts`），数组累积即为文档顺序。

---

## 2. 复用编译计划（多页/多文档）

同一模板抽多页时，**只编译一次**，反复 `temme(html, plan)`。验证：对同一 HTML 两次抽取输出一致。

```ts
import { compile, temme } from '@zhengxs/temme';

const plan = compile(selectors); // 一次
for (const html of pages) {
  const data = temme(html, plan); // 复用，跳过 compile
  // ...
}
```

`temme(html, plan)` 收到 `ExecutionPlan` 时跳过 `compile`，只走 link + drive。**大规则/多页场景收益明显**。

---

## 3. 规则入库：serialize / deserialize / schema

规则要存库或传输时，编译为可序列化计划，加载侧校验 + 核对 manifest。

```ts
import { compile, serialize, deserialize } from '@zhengxs/temme';
import { parseExecutionPlan } from '@zhengxs/temme/schema';

const json = serialize(compile(selectors)); // 入库/传输

// 加载侧
const plan = parseExecutionPlan(deserialize(json)); // zod 边界校验
```

- `serialize` 把 RegExp 降维为 `{$regex}` 字典，不静默丢失。
- `deserialize` 用 reviver 原子还原 RegExp。
- `parseExecutionPlan` 校验结构，非法输入抛 `ZodError`。
- 之后**核对 `plan.manifest`**（filters/modifiers/procedures 依赖名）是否都在当前 `Env` 已注册——未注册的扩展点运行期静默跳过，会少字段。

---

## 4. 类型注解清洗

抽数字/布尔/整型字段时，用类型注解在 link 阶段就转换，省去下游 `Number()`/`Boolean()`。

```ts
capture('price', { typeAnnotation: ['number'] }); // → Number
capture('count', { typeAnnotation: ['int'] }); // → 取整
capture('enabled', { typeAnnotation: ['bool'] }); // → 布尔化
```

验证：`price` 注解后输出 `12.5`（number）而非 `"12.5"`。注解链先于过滤链执行。

---

## 5. 自定义过程（procedure）做领域解析

把"价格串→数字""日期串→ISO"等解析封装为 procedure 注册，规则保持声明式。非内置过程输入统一取 `text`。

```ts
import { createEnv, temme } from '@zhengxs/temme';

const env = createEnv({
  procedures: {
    toYuan(input: unknown) {
      const n = Number(String(input).replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : undefined;
    },
  },
});

const priceSel: TemmeSelector = {
  type: 'normal-selector',
  sections: [
    {
      combinator: ' ',
      element: 'td',
      qualifiers: [{ type: 'class-qualifier', className: 'price' }],
    },
  ],
  procedure: { name: 'toYuan', args: [capture('price', { typeAnnotation: ['number'] })] },
  arrayCapture: null,
  children: [],
};

temme('<td class="price">¥ 12.5</td>', [priceSel], { env });
// { price: 12.5 }
```

验证：`¥ 12.5` → `12.5`（number）。filter 返回 `undefined` 会跳过写入——**可用于"过滤脏数据"**（解析失败不落结果）。

---

## 6. 裸 `$` 默认键提升

只要**一个值**时，用默认捕获键 `@@default-capture@@`，`toResult` 会把该值整体提升为返回值（字符串/数字直接返回，非对象）。

```ts
temme('<title>首页</title>', [
  /* arrayCapture=null, procedure text 捕获默认键 */
]);
// 返回 "首页"（string），而非 { key: '首页' }
```

> ⚠️ 若规则里同时有默认键捕获和命名捕获，最终结果会被提升为默认键值，命名捕获丢失。**避免混用**。

---

## 7. 过滤器（filter）清洗

把"移除标签、trim、去重"等清洗逻辑放 filter。`|name` 对整个值、`||name` 对数组每项分别处理。

```ts
const env = createEnv({
  filters: {
    stripTags(v: unknown) {
      return String(v).replace(/<[^>]*>/g, '');
    },
  },
});
```

验证：`<div><b>a</b> &amp; <i>b</i></div>` 经 `html` 过程 + `stripTags` 得 `{ content: 'a &amp; b' }`（保留 HTML 实体）。filter 返回 `undefined` 时跳过该捕获写入。

---

## 8. 空白策略

数据清洗场景默认 `condense`（trim + 折叠连续空白）通常足够。需要精确文本（代码块、保留换行）时设 `preserve`。

```ts
import { createEnv } from '@zhengxs/temme';
createEnv({ whitespace: 'preserve' });
// 缺省 whitespace 即为 'condense'（默认折叠连续空白）
```

---

## 9. fail-safe 排查清单

一切失败静默降级。结果"少字段 ≠ 报错"。按序排查：

1. 选择器是否命中（用 `createEngine(parser).select` 独立测试命中数）。
2. 过程名是否注册（非内置需 `env.procedures`）。
3. filter/modifier 是否短路（返回 `undefined`）。
4. 属性缺失（`attr` 返回 `null`，写入跳过）。
5. 远程规则依赖未注册（核对 `plan.manifest`）。

---

## 验证这些案例

- 跑断言：`bun test`（temme 包测试脚本）。
- 或直接用 node 24 运行 TS 示例（见 `assets/` 下的脚本）：`node --experimental-strip-types ./example.ts`。
