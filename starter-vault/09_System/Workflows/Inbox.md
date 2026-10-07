# Inbox 整理工作流

任务类型：inbox_process。入口：[[09_System/Workflows/ROUTER]]。

## 契约补充

共享契约：[[09_System/Workflows/CORE-CONTRACT]]。输入为指定 Inbox 文件或当前用户提供的明确资料；knowledge_record 只复用既有概念分支，直接输入无需先复制进 Inbox。

Canonical dependencies：按现有分流引用 Book／Video／Daily／Thought Workflow；概念使用 [[09_System/Templates/Knowledge]]。无强制外部工具，不调用 QuickAdd 创建脚本代替内容整理。

写入与更新：先按共享 identity 策略匹配；概念目标为 01_Knowledge，其他类型按对应 Workflow。只写目标和必要既有索引，原资料默认不动。资料不足、目标歧义时报告候选／缺口；不创建空壳知识节点。完成按共享三项判定及本文件完成检查。

## 默认读取

- [[AGENTS]] 与 [[09_System/Workflows/ROUTER]]。
- 用户明确指定的 Inbox 文件，或能在当前上下文中确定的最近新增文件。
- 按类型选择的 Template，以及必要的目标正式笔记。
- 必要时读取一个相关已有索引，辅助定位重复笔记。

没有明确文件时，只列出 00_Inbox 当前层的文件名及必要的时间元数据，用于定位候选，不批量读取全文。文件修改时间不等同于新增时间；只有线索足以确定范围时才选择文件，多个可能范围时问一个问题。

## 流程

1. 判断资料类型，区分用户表达、来源内容和 AI 整理。
2. 提取有依据的核心信息，保留原始来源或 URL。
3. 用标题、来源 URL、已知 id 或当前链接定位已有目标；只在相关目标目录做限定查找，必要时读相关索引。
4. 优先增量更新已有笔记，避免重复导入相同段落和来源。
5. 必要时创建正式笔记：
   - 书籍：转 [[09_System/Workflows/Book]]，选择 Fiction 或 Nonfiction 模板。
   - 视频：转 [[09_System/Workflows/Video]]。
   - 每日记录：转 [[09_System/Workflows/Daily]]。
   - 观点：转 [[09_System/Workflows/Thought]]。
   - 有充分定义和复用价值的概念：使用 [[09_System/Templates/Knowledge]]，保存到 01_Knowledge。
   - 其他类型无对应模板时遵守 AGENTS.md；无法确定正式归属时保留在 Inbox，不强行改成 concept。
6. 建立必要的 [[Wikilink]]，优先关联已有笔记；不制造无依据的关系。
7. 将真实来源放入 sources 列表。原始 Inbox 笔记作为来源时链接到该实际文件。
8. 必要时增量更新相关已有索引；不默认移动、删除或清空 Inbox 原始资料。

## 边界与完成检查

禁止全库扫描、无依据补充事实、自动创建大量知识节点。材料不足时不创建概念节点；候选概念先提出少量真正有价值的项目，未获创建授权时不执行额外创建。已有当前任务授权时遵守指定数量。

检查正式笔记的 YAML、稳定 id、来源及与原始内容的一致性。按 ROUTER 的统一格式报告。
