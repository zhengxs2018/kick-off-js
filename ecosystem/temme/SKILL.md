---
name: temme
description: 'Extract structured data from HTML using the temme DSL: declarative selectors with $name captures, |filter/||filter transforms, type annotations (:number), array captures, and custom filters/modifiers/procedures. Covers the full pipeline: parse a string rule into AST, compile it to a POJO execution plan, serialize/deserialize it for storage or transport, and drive it over HTML via the linkedom/domParser adapters (or a custom HtmlParser). Use this skill when the user needs to scrape, parse, or extract fields from HTML pages for web crawling, data cleaning, research, or ETL pipelines, including when they mention temme, extract from HTML, selector rule, capture, execution plan, parse, adapter, or ask to write, debug, or extend a temme rule. Do not use for general-purpose CSS selector queries or DOM manipulation that do not produce captured output.'
---

# Temme — HTML 结构化抽取 DSL

## Overview

`@zhengxs/temme` 是一个把 **HTML → 结构化 JSON** 的声明式抽取 DSL。名称来自 **emmet 的逆向**——temme 是一个类 jQuery 的选择器，用于简洁优雅地从 HTML 文档中提取所需的 JSON 数据。它 fork 自开源项目 `feichao93/temme` 并深度优化。

你写一段"选择器规则"（字符串规则经 `parse` 解析为 AST，或直接手写 AST），它编译为纯 POJO 执行计划，运行时用 `linkedom` 默认解析器（或自定义 `HtmlParser`）驱动，一次遍历把页面里需要的数据捕获成对象。所有失败默认 **fail-safe**（静默降级、不抛错）。

典型能力：把 `$name`、`$href` 这类捕获从任意 HTML 里提出来，套用类型注解、过滤器、修饰符，产出可直接入库/分析的结构化数据。

## When to Use

当出现以下任一时触发本技能：

- 从 HTML 里**抽取字段/结构化数据**（爬虫、数据清洗、ETL、研究数据收集）。
- 用户提到 `temme`、`$capture`、`选择器规则`、`执行计划`、`adapter`、`从 HTML 提取`、`抓取字段` 等词。
- 需要**编写 / 调试 / 扩展**一段 temme 规则，或把抽取链路接入已有工程。
- 需要编译规则、序列化执行计划、或对远程规则做边界校验。

以下情况**不**触发：仅做通用 CSS 查询 / DOM 操作、不需要产出捕获结果、或使用其他抽取库。

## Workflow Decision Tree

按意图选择入口：

```
用户意图？
├─ 直接从 HTML 抽一次（字符串规则） → temme(html, parse(rule))（parse + 编译 + 运行）
├─ 直接从 HTML 抽一次（手写 AST）   → temme(html, selectors)（编译 + 运行）
├─ 同模板反复抽多页   → compile(selectors) 一次 → temme(html, plan) 复用
├─ 想存库/传输规则     → compile → serialize()；加载侧 deserialize() + schema 校验
├─ 缺内置变换/取值能力 → 在 Env 注册 filters / modifiers / procedures
├─ 换 DOM 后端         → linkedom() / domParser()，或实现自定义 HtmlParser
└─ 写/改一段 DSL 规则  → 参照 references/dsl-reference.md，再按 references/agent-assist.md 验证
```

## Core Capabilities

### 1. 一次性抽取

**三种规则形态**（`selectorsOrPlan` 输入类型不同，管线深度不同）：

| 形态               | 写法                       | 管线                                                          |
| ------------------ | -------------------------- | ------------------------------------------------------------- |
| 字符串规则（推荐） | `temme(html, parse(rule))` | parse → compile → link → drive（最简洁）                      |
| 手写 AST           | `temme(html, selectors)`   | compile → link → drive（跳过 parse，适合程序化生成/远程还原） |
| 执行计划           | `temme(html, plan)`        | link → drive（跳过 parse + compile，适合同模板多页复用）      |

```ts
import { parse, temme } from '@zhengxs/temme';

const html = '<div class="item"><a class="name" href="/p/1">麻黄</a></div>';
const rule = 'a.name $name'; // 选择 .name 的 a，把 textContent 捕获到 name 键

const result = temme(html, parse(rule));
// result.name === '麻黄'
```

> 规则文本语法见 `references/dsl-reference.md`（捕获、属性捕获、类型注解、过滤器、修饰符等）。手写 AST（方式B）只在规则需程序化生成/来自远程还原时使用；要手写时，**优先**用一个辅助函数集合（见 `references/agent-assist.md` 的构造模式），而非逐个写裸对象。

**捕获语义提醒**：字符串里 `td.id $id` 的 `$id` 是**标量**捕获（默认 text 过程，命中多项时 First-Wins 保留第一个匹配），不是数组。需要数组累积时用 `arrayCapture`——字符串写 `tr $row { ... }` 或手写 AST 的 `arrayCapture`。详见 `references/best-practices.md` §0。

### 2. 编译 → 复用执行计划

`compile(selectors)` 把 AST 编译为纯 POJO `ExecutionPlan`（可 `JSON.stringify` / `structuredClone`）。同模板多次抽取时**只编译一次**，用 `temme(html, plan)` 复用，避免重复编译。

### 3. 序列化与远程规则

- `serialize(plan)` → JSON 字符串；正则字面量自动降维为 `{$regex}` 字典，不静默丢失。
- `deserialize(json)` → 还原执行计划，`{$regex}` 在解析流中原子还原为 `RegExp`。
- 加载**外部/远程** JSON 规则时，用 `@zhengxs/temme/schema` 的 `parseExecutionPlan` 做 zod 边界校验，再核对 `plan.manifest`（依赖名清单）是否齐全。详见 `references/extension-guide.md`。

### 4. 注册扩展能力

`createEnv({ filters, modifiers, procedures, whitespace })` 注入自定义变换。未注册的过滤器/修饰符/过程名在运行期**静默跳过**（fail-safe），不影响其它捕获。类型注解转换器（`:number` 等）由 `link` 阶段绑定。详见 `references/extension-guide.md`。

### 5. 换 DOM 后端 / 集成引擎

- 默认 `linkedom()` 基于 `linkedom` 库；浏览器环境可用 `domParser()`（原生 `DOMParser`）。
- 可在 `temme(html, plan, { parser })` 传自定义 `HtmlParser`，或 `createEngine(customParser)`，脱离 `linkedom` 依赖做测试/对接宿主 DOM。详见 `references/extension-guide.md`。
- 与爬虫引擎集成：引擎按页面驱动同一份编译计划，逐页复用。见 `references/agent-assist.md`。

### 6. 手动控制各阶段（createExtractor）

需要复用同一 `Env`/`parser`、或手动掌控 parse→link→drive 各阶段时，用 `createExtractor`（四阶段分层）：

```ts
const extractor = createExtractor({ env, parser });
const doc = extractor.load(html); // 解析文档（一次）
extractor.select(doc, selectors); // AST → compile → link → drive
extractor.extract(doc, plan); // ExecutionPlan → link → drive（跳过 compile）
extractor.execute(doc, linkedPlan); // LinkedPlan → drive（跳过 compile + link，最快）
```

同一页面模板多页抽取时，`extract`/`execute` 比反复 `temme(html, parse(rule))` 省去重复编译/链接。完整示例见 `assets/examples/05-three-forms.ts`。

## Reference Material

- `references/dsl-reference.md` — DSL 语法完整参考（选择器、捕获、过滤器、修饰符、过程、类型注解、snippet、父引用、赋值）。
- `references/api-reference.md` — 顶层 API 与类型签名、子路径导出、三阶段链路（compile→link→drive）。
- `references/best-practices.md` — 经过实际运行验证的推荐写法与踩坑教训（数组捕获、计划复用、序列化、类型清洗等）。
- `references/extension-guide.md` — 扩展点（Env 注册表）、自定义 Adapter/Engine、schema 边界校验。
- `references/agent-assist.md` — Agent 编写/调试/验证规则、fail-safe 语义、与爬虫/ETL 集成的辅助指南。

写或改一段规则时，先读 `dsl-reference.md`；要看已验证的推荐写法读 `best-practices.md`；涉及 API 签名读 `api-reference.md`；要扩展能力或校验远程规则读 `extension-guide.md`；要调试、验证或接入管线读 `agent-assist.md`。可直接运行的 TS 示例见 `assets/`。
