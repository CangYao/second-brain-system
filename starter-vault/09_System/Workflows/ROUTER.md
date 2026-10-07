# 自然语言任务路由

## 入口与适用范围

本文件是“第二大脑”的自然语言任务入口。使用本路由时先遵守 [[AGENTS]]，再按下表只读取选中的 Workflow 与必要 Template。本文件是执行约定，不是自动注册程序；新会话需要由用户或启动配置引用本路由，单独创建文件不会使 Codex 自动发现它。共享执行契约、读取层级、匹配及完成判定见 [[09_System/Workflows/CORE-CONTRACT]]；本文件只负责路由。当前任务对读取、写入范围的明确限制优先。

## 任务分类

| 任务类型 | 典型表达 | Workflow |
| --- | --- | --- |
| personal_model_update | 更新个人模型；从这些聊天更新个人模型；从这段历史对话提炼长期信息；根据这些资料补充对我的了解；根据这些长期信息更新对我的了解；整理 ChatGPT 历史对话（仅提炼个人模型） | [[09_System/Workflows/Personal-Model]] |
| inbox_process | 整理 Inbox；整理刚放进去的东西；处理今天的新资料；把这些资料归档 | [[09_System/Workflows/Inbox]] |
| book_update | 更新《某本书》；我又补了一些这本书的想法；整理这本书；把这些内容加入某本书；把这本书加入书库 | [[09_System/Workflows/Book]] |
| video_import | 整理这个视频；把这个视频整理一下；把这个视频加入知识库；总结这个视频；保存这个B站或YouTube视频 | [[09_System/Workflows/Video]] |
| daily_record | 记录一下今天；记录一下我今天……；总结今天；写今天的Daily；今天发生了这些事情 | [[09_System/Workflows/Daily]] |
| thought_record | 把这个观点记下来；我突然想到……；我有一个想法；保存这个思考；记录我的看法 | [[09_System/Workflows/Thought]] |
| knowledge_record | 把这个知识点整理进知识库；记录这个概念 | [[09_System/Workflows/Inbox]]（复用既有概念分支，不另建 Workflow） |

## Research intent（项目级 Skill）

文献研究、深度研究，以及 research / deep research / literature research / evidence-based research，在符合 Skill 的文献研究适用范围时使用 `.agents/skills/codex-research/SKILL.md`；依靠项目 Skill discovery，不增加 task_type 或 Research Workflow。一般事实查询、翻译、润色和普通知识摄入仍走原有入口。

研究默认在对话中交付。只有用户明确要求保存时，才选择既有 Workflow／Template 并按 CORE-CONTRACT 匹配、增量写回与验证；Skill 不替代 Vault schema，也不自动更新 Personal Model。

## 路由原则

- 明确要求更新个人模型或从资料提炼长期个人信息时，优先进入 personal_model_update，不进入普通 inbox_process。“整理 ChatGPT 历史对话”仅提炼 Personal Model，不完整归档聊天；其他 Book、Video、Daily、Thought 路由保持原有语义。推荐、比较、规划等任务可按 AGENTS 读取个人模型，但不因此触发模型写入。
- 优先按明确对象和目标判断，而不是只匹配“整理”“记录”等动词。书籍中的新增想法归 book_update；明确要求写当天记录归 daily_record；多种资料的统一整理归 inbox_process。
- 使用当前消息和会话中已明确的对象。目标可唯一确定时直接执行；多个可能目标时只问一个必要的澄清问题，不猜测目标。
- 缺少必需输入时问一个简短问题；缺少可选字段时省略，不为了补齐字段扩大读取范围。
- 不明确的任务不强行归类，也不自动扫描全库。混合任务按用户目标拆成必要子任务，共享已读取的规则和文件，避免重复读取。

## 路由后的执行

先选择既有任务入口及对应 Workflow，再按 [[09_System/Workflows/CORE-CONTRACT#按需认知能力与组合]] 为当前工作单元选择必要能力；Cognitive Skills 不是新的顶层 task_type，本路由不另维护 Skill 选择表或执行细节。教学／研究可只在对话交付，正式保存仍须既有授权和 Workflow；简单记录无需完整认知链。

选定 task_type 后按 [[09_System/Workflows/CORE-CONTRACT]] 和对应 Workflow 执行。knowledge_record 使用 Inbox 的概念分支，输入可以直接来自当前用户，不要求先建立 Inbox 副本。观点附属于某本书时仍优先 book_update；明确长期模型更新优先 personal_model_update；无法确认对象或多重身份冲突时报告候选，不靠新建副本回避歧义。

行为、授权、Properties 与 Git 安全规则引用 [[AGENTS]]；不在 ROUTER 复制业务步骤或读取层级。
