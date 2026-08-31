# @zhengxs/temme

> 简洁优雅地从 HTML 中提取 JSON 数据的类 jQuery 选择器 DSL。

`@zhengxs/temme` 是一个把 **HTML → 结构化 JSON** 的声明式抽取 DSL。名称来自 **Emmet 的逆向**——像 Emmet 简化 HTML 书写一样，temme 简化 HTML 数据的提取：写一段选择器规则，即可把页面里需要的数据捕获成可直接入库/分析的结构化对象。

本项目是开源项目 [`feichao93/temme`](https://github.com/feichao93/temme) 的 fork 并做了深度优化，将抽取链路重构为 **编译期纯 POJO 执行计划 + 运行时解析器驱动**，更利于复用、序列化与集成。

- **声明式**：用 `$name` 捕获、`|filter` / `||filter` 变换、`:number` 类型注解，描述"取什么"而非"怎么取"。
- **双入口**：可直接写**字符串规则**（`parse`），也可手写 **AST**（`TemmeSelector[]`），两者编译为同一执行计划。
- **可复用**：规则编译为纯 POJO 执行计划，可 `JSON.stringify` / 缓存 / 传输，多页反复抽取只编译一次。
- **可扩展**：通过 `Env` 注册自定义 `filter` / `modifier` / `procedure`；可自定义 DOM 解析器（`HtmlParser`），脱离 `linkedom`。
- **fail-safe**：一切失败静默降级、不抛错——写错规则表现为"结果缺字段"，而非崩溃。

## 特性

- 🧩 **POJO 执行计划**：编译期把规则降维为纯数据（RegExp 自动降维为 `{$regex}`），可直接序列化/传输。
- ⚡ **性能快路径**：静态已知 CSS 编译为原生 DOM 直取（class / id / tag / attr），避开全量 `querySelectorAll`。
- 🛠 **四段链路**：`parse` → `compile` → `link` → `drive`，每段可独立复用与替换。
- 🧰 **类型注解**：`:number` / `:int` / `:bool` / `:text` / `:bigint`，抽取即清洗。
- 🔌 **解析器抽象**：默认 `linkedom`，可用 `domParser` 或实现自定义 `HtmlParser` 对接宿主 DOM。
- 🛡 **边界校验**：`serialize` / `deserialize` 序列化执行计划；远程/外部规则可在加载侧用 zod 自行校验（包内零校验）。

## 安装

```bash
npm i @zhengxs/temme
```

- 包内不提供规则校验；如需对远程/外部 JSON 规则做边界校验，可自行安装 `zod`（可选）。

- 环境要求：Node.js ≥ 26.7.0（或 Bun ≥ 1.3.14，本仓库以 Bun 构建/运行）。

## 快速上手

### 方式 A：字符串规则（推荐，简单）

用 `parse` 把规则文本解析为 AST，再交给 `temme`：

```ts
import { parse, temme } from '@zhengxs/temme';

const html = `<table>
  <tr><td class="id">1</td><td class="name">麻黄</td><td class="price">12.5</td></tr>
  <tr><td class="id">2</td><td class="name">桂枝</td><td class="price">8</td></tr>
</table>`;

const rule = `
  td.id    $id:int
  td.name  $name
  td.price $price:number
`;

const result = temme(html, parse(rule));
// { id: 1, name: '麻黄', price: 12.5 }
console.log(result);
```

> ℹ️ 字符串规则里 `td.id $id:int` 这类**标量捕获**（无 `{ ... }` 子块）是 First-Wins：命中多项时只保留**第一个**匹配。需要把一组同类项累积为数组时，用**数组捕获**形态（见方式 B，或字符串规则 `tr $row { ... }`）。

### 方式 B：手写 AST

规则也可直接用 `TemmeSelector[]` 对象表达（程序化生成 / 来自远程还原）：

```ts
import { temme } from '@zhengxs/temme';
import type { Capture, TemmeSelector } from '@zhengxs/temme';

function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return { name, typeAnnotation: null, filterList: null, modifier: null, ...extra };
}

// 数组捕获：把每一行 <td class="className"> 的文本累积为数组
function select(element: string, className: string, cap: Capture): TemmeSelector {
  return {
    type: 'normal-selector',
    sections: [{ combinator: ' ', element, qualifiers: [{ type: 'class-qualifier', className }] }],
    procedure: null, // 未指定过程，默认取 text
    arrayCapture: cap,
    children: [],
  };
}

const html = `<table><tr><td class="id">1</td><td class="name">麻黄</td></tr>
              <tr><td class="id">2</td><td class="name">桂枝</td></tr></table>`;

const result = temme(html, [
  select('td', 'id', capture('id', { typeAnnotation: ['int'] })),
  select('td', 'name', capture('name')),
]);

// { id: [1, 2], name: ['麻黄', '桂枝'] }
console.log(result);
```

> 数组捕获（`arrayCapture`）按**文档正序**累积。

## 进阶用法

### 复用编译计划（多页抽取）

```ts
import { compile, temme } from '@zhengxs/temme';

const plan = compile(selectors); // 编译一次
// 或 const plan = compile(parse(rule));

const data1 = temme(html1, plan); // 复用，跳过 compile
const data2 = temme(html2, plan);
```

### 规则入库 / 传输

```ts
import { compile, serialize, deserialize } from '@zhengxs/temme';

const json = serialize(compile(selectors)); // 存库/传输
const plan = deserialize(json); // 加载侧还原为执行计划
```

### 扩展能力

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

temme('<div class="price">¥ 12.5</div>', parse('.price $price'), { env }); // { price: 12.5 }
```

## 文档

| 主题         | 说明                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| DSL 语法参考 | 字符串规则语法与 AST 形状、捕获、过滤器、修饰符、过程、类型注解、snippet、父引用、赋值 |
| API 参考     | 顶层 API 与类型签名、子路径导出、`parse → compile → link → drive` 链路                 |
| 最佳实践     | 经过实际运行验证的推荐写法与踩坑教训（数组捕获、计划复用、序列化等）                   |
| 扩展指南     | `Env` 注册表、自定义 `HtmlParser`、远程规则加载侧校验                                  |

> 完整文档（DSL 语法、API、最佳实践、扩展指南、Agent 辅助指南）同时封装为 CodeBuddy SKILL，位于仓库 `.agents/skills/temme/`。

## 架构

```txt
rule 字符串 ──► parse(rules) ──► TemmeSelector[]（规则 AST）
                                   │ compile(selectors)
                                   ▼
                            ExecutionPlan（纯 POJO）
                                   │ link(plan, env)
                                   ▼
                             LinkedPlan（闭包绑定）
                                   │ drive(plan, engine, doc)
                                   ▼
                         Record<string, unknown>
```

- `parse`：字符串规则 → AST（可选前置，快速上手推荐）。
- `compile`：AST → 纯 POJO 执行计划（RegExp 降维、结构化布尔特征、manifest 依赖清单）。
- `link`：把 filter / modifier / procedure 从 `Env` 注册表解析为闭包，绑定类型转换器。
- `drive`：显式栈 DFS 驱动 `engine.select` / `engine.resolve`，写状态，产出结果对象。

`temme(html, parse(rule))` 或 `temme(html, selectors)` 一步完成整条链路；传入已编译 `ExecutionPlan` 时跳过 `compile`。

## 致谢

- 灵感与初版设计来自 [**temme**](https://github.com/feichao93/temme)（`feichao93`）。
- 默认 DOM 后端基于 [**linkedom**](https://github.com/WebReflection/linkedom)。

## License

MIT

> 注意：本项目 fork 自 [`feichao93/temme`](https://github.com/feichao93/temme)，许可证遵循上游仓库约定；
> 请查看上游仓库的 LICENSE 与授权条款。
