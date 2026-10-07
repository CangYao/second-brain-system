# 思想与观点记录工作流

任务类型：thought_record。入口：[[09_System/Workflows/ROUTER]]。

## 契约补充

共享契约：[[09_System/Workflows/CORE-CONTRACT]]。输入为用户当前表达及可确认的日期／上下文；未知日期不影响记录，但必须注明未知。

Canonical dependencies：[[09_System/Templates/Thought]]；Codex 负责整理，无外部工具要求。按共享 identity 策略匹配 05_Personal 中对应观点，保留旧表达再增量更新，不自动更新 Personal Model。

歧义／冲突报告候选和缺口；推断无证据时不写成事实。完成须通过共享判定及本文件专项检查。

## 最小读取范围

读取 AGENTS.md、ROUTER.md、本工作流、[[09_System/Templates/Thought]]、用户的新表达，以及明确对应的已有观点笔记。必要时读取用户提及或笔记已链接的少量书籍、事件、知识或 Daily；不遍历个人历史。

## 执行流程

1. 使用 Thought 模板。优先更新同一观点的已有笔记；必要时按当前目录约定创建到 05_Personal/观点标题.md。
2. 根据内容逐条区分：
   - fact：有明确依据的事实。
   - preference：用户已经确认的偏好。
   - inference：AI 根据资料提出的推测。
3. 用户明确表达的观点记录为“用户观点”，保留其措辞与依据，不标记为 AI inference，也不把观点内容直接升级成客观事实。无法适用 fact 或 preference 时不强填 personal_status；在正文标明表达者和性质。
4. 只有全文性质一致时才填写全局 personal_status。混合内容逐条标注，避免全局字段把用户观点和 AI 推测混为一谈。
5. AI 推断必须有 personal_status: inference、confidence（0–1 数值）、evidence（依据列表及必要推理）和 updated（YYYY-MM-DD）。外部来源统一放入 sources 列表；推断与“我的推理”“当前观点”分开。
6. 记录实际观点形成日期；未知时明确标注，并区分整理日期。观点变化时按日期追加当时观点、后来的变化、变化原因和当前理解，保留旧表达。未知原因不补造。
7. 尽量连接明确相关的已有书籍、事件、知识和 Daily，使用 [[Wikilink]] 和 relations 列表，不为连接而搜索全库或自动创建节点。
8. 新建 id 使用 thought_YYYYMMDD_<序号>，序号在相关目录的同日对象范围内检查唯一性；没有形成日期时可用创建日期生成标识，但不能据此推定形成日期。保留既有 id、created，实质更新时更新 updated。

## 完成检查

核对用户表达是否被忠实保留、推测字段是否齐全、旧观点是否保留、日期与来源是否真实。按 ROUTER 的统一格式报告。
