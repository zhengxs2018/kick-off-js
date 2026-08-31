# Temme 可运行示例

可直接参考、复制的 TypeScript 示例脚本。均面向**已安装发布包**的消费者。

## 运行环境

- **Node.js 24+**（支持 `--experimental-strip-types` 直接运行 TS）。
- 先安装发布包：`npm i @zhengxs/temme`（示例 02 还需 `npm i zod`）。

## 运行命令

```bash
# Node 24+（类型擦除直接跑 TS）
node --experimental-strip-types ./01-quick-start.ts
```

> 说明：Node 的类型擦除模式仅做类型去除，`@zhengxs/temme` 发布产物 `dist/` 是编译后的 JS，可被正常解析。

## 示例清单

| 脚本                        | 主题          | 演示要点                                                                                               |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `01-quick-start.ts`         | 快速上手      | 字符串规则（`parse`）+ 手写 AST 两种入口、列表数组捕获（文档正序）、类型注解                           |
| `02-reuse-and-serialize.ts` | 复用 + 序列化 | `compile` + `temme(html, plan)` 复用、`serialize`/`deserialize`、`parseExecutionPlan` 校验、`manifest` |
| `03-extensions.ts`          | 扩展点        | `createEnv` 自定义 `procedure`/`filter`、类型注解、空白策略                                            |
| `04-crawl-pipeline.ts`      | 爬虫/ETL      | 按页驱动同一计划、产出记录数组、`toRecords` 对齐                                                       |
| `05-three-forms.ts`         | 三种形态+分层 | 字符串规则 / 手写 AST / 执行计划三种输入形态；`createExtractor` 的 load/select/extract/execute 四阶段  |

## 关键提醒

- **数组捕获按文档正序累积**：`drive` 按文档序正序遍历匹配节点并 append，数组捕获即为文档顺序。
- **一切失败 fail-safe**：未注册的 filter/modifier/procedure、非法 CSS、缺属性都不会抛错，表现为"结果少字段"。排查见 `references/agent-assist.md`。
