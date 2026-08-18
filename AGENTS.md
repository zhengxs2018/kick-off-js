# Agents Instructions

## 项目信息

- 运行时：ESM only，target es2025，node >= 24 / bun / chrome >= 150；TypeScript >= 7。
- 构建：bun workspace，各包独立编译。

## 代码技术规范（引用）

- @.agents/rules/code-guidelines/RULE.mdc
- @.agents/rules/file-analysis/RULE.mdc
- @.agents/rules/rule-anthoring/RULE.mdc
- @.agents/rules/standard-api-first/RULE.mdc
- @.agents/rules/tech-baseline/RULE.mdc

## AI 执行界限

- 默认保持最小修改，优先修根因，禁止做表层补丁式堆砌。
- 保持现有公开 API、目录边界与导入风格，除非任务明确要求调整，禁止擅自重构或迁移。
- 输出方案必须落在当前目录职责范围内，禁止跳过项目既有架构直接另起一套实现。
- 生成代码必须补齐边界状态与错误路径，禁止只覆盖主流程。
- 涉及 Runtime API（node、bun、chrome extension api 等）时，禁止臆造 API 方法名，必须联网查询官方文档确认。
- 当用户请求不够明确时，必须先确认改动范围（主应用 / 某个 Runtime 入口 / 某个具体功能函数），再动手。
- 实现与执行分离：AI 只负责编写/实现功能代码与脚本，禁止替用户执行测试或运行脚本验证；测试与运行由用户自行完成。需要真实执行验证时（如交互式 CLI 依赖 TTY），必须交由用户操作，禁止自行 pipe 模拟。

## 验证要求

- 修改文档或纯说明文件时，必须检查 diff 与文案准确性。
- 修改影响构建配置、入口初始化、路由、全局状态或跨模块共享能力时，必须至少执行一次 `bun run lint`。
- 修改涉及样式、主题、布局、Medi UI 组件交互时，必须至少执行一次 `bun run build` 并进行页面级人工验证。
- 执行 `bun run lint` 或 `bun run format` 时，禁止顺带改动与任务无关的大量文件。
- 局部业务逻辑改动，优先运行最小影响面的行为验证，禁止越过必要范围做全量构建。
