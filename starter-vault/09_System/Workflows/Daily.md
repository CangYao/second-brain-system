# 每日记录工作流

任务类型：daily_record。入口：[[09_System/Workflows/ROUTER]]。

## 契约补充与三入口职责

共享契约：[[09_System/Workflows/CORE-CONTRACT]]。输入为用户指定日期／当前日期及真实当天材料；Canonical dependency 为 [[09_System/Templates/Daily]]。写入仅为 06_Daily/YYYY-MM-DD.md，按日期／daily ID 先匹配再增量更新。

- Periodic Notes／Core Daily Notes：用户在 Obsidian UI 打开当天 Daily；当前都配置同一日期格式、目录、模板。建议日常选 Periodic Notes 为主要打开入口，Core 保留兼容入口；本阶段不关闭插件、不改配置。
- QuickAdd daily：显式人工创建或打开模板笔记；文件存在时只打开，不追加内容，不替用户总结。人工捕获其他材料使用已有 Inbox 快捷入口。
- Codex daily_record：自然语言整理和追加内容，使用同一 Daily 路径／结构；不执行 Obsidian GUI 自动操作。

Templater 不负责自动补齐，当前自动触发关闭；原生 Daily／Periodic 入口可能创建模板笔记，需验证占位符和 daily ID。QuickAdd 自己替换并生成 ID，不复制一套业务整理逻辑。日期歧义先澄清；当天材料不足时只写实际提供内容。完成按共享判定及下文专项检查。是否将来禁用完全重复的 Core UI 命令留待用户决定，当前保持双入口。

## 最小读取范围

读取 AGENTS.md、ROUTER.md、本工作流、[[09_System/Templates/Daily]]、当天目标 Daily，以及用户明确提供或指定的当天材料。关联笔记仅在必要时读取，不自动搜集全库当日变动或全部历史 Daily。

## 执行流程

1. 从当前环境日期及时区确定“今天”；本知识库通常使用 Asia/Shanghai。用户指定日期时以其为准，跨日内容记录实际发生日期。
2. 优先定位已有当天 Daily；没有明确命名约定时使用 06_Daily/YYYY-MM-DD.md。新建 id 为 daily_YYYYMMDD，date 为对应日期。
3. 按模板整理当天事件、接触内容、想法、决定和观点，仅记录有依据的内容，不虚构活动或决定。
4. 已有当天记录则按相关章节追加或合并，避免重复；保留已有观点，变化时按时间追加。
5. 可以关联已知知识、书籍、视频、项目和经历，使用 [[Wikilink]]；不为了关联遍历知识库或创建新节点。
6. AI 观察放在“AI观察”中；涉及个人推测时逐条标注 inference、confidence、evidence、updated，不冒充用户看法。
7. 有实际价值时提出 1–3 个问题；没有有价值的问题时提出 0 个。优先澄清真实矛盾、重要决定或值得反思的经历，不为了提问而提问。
8. 来源使用 sources 列表，关联使用 relations 列表。创建日期与记录日期分开，保留既有 id 和 created，更新 updated。

## 完成检查

核对 date、id、日期含义、用户表达与 AI 观察的区分，以及问题数量。按 ROUTER 的统一格式报告。
