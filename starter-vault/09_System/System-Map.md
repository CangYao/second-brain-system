# Second Brain System Map

Public distribution v0.1.4；核心规则来源功能基线 private-v1.2.0，无私人安装记录。

## Purpose and responsibilities

Obsidian：人工阅读/编辑；Codex：授权文件工作与认知；Git：用户本地历史（未初始化时 NOT_CONFIGURED）；Markdown：事实源。USER_DATA 为 00_Inbox、01_Knowledge、02_Topics、03_Books、04_Media、05_Personal、06_Daily、07_Timeline、08_Projects。09_System 与 .agents/skills 是单份 SYSTEM_LAYER；机器路径与插件状态属于 LOCAL_CONFIG。

## Canonical components

- [[AGENTS]] → [[09_System/Workflows/ROUTER]] → [[09_System/Workflows/CORE-CONTRACT]]。
- [[09_System/Workflows/Inbox]]、[[09_System/Workflows/Book]]、[[09_System/Workflows/Video]]、[[09_System/Workflows/Daily]]、[[09_System/Workflows/Thought]]、[[09_System/Workflows/Personal-Model]]。
- [[09_System/Templates/Knowledge]]、[[09_System/Templates/Book-Fiction]]、[[09_System/Templates/Book-Nonfiction]]、[[09_System/Templates/Video]]、[[09_System/Templates/Daily]]、[[09_System/Templates/Thought]]。
- .agents/skills/{ai-reading,deep-reading,codex-research,knowledge-synthesis,obsidian-markdown}/SKILL.md；由项目宿主发现，metadata存在不等于新宿主已经加载。
- QuickAdd-Create.js 可选人工入口，共用模板、系统时区，不另维护业务流程。
- Video-Intake.cjs 可选 acquisition；local.json/registry 为机器事实源，tools/temp/cache根在Vault外。字幕优先，不包含LLM/Git/正式笔记写入。
- bilingual-display.css 仅显示；禁用不改变路径、路由或语义。

## Lifecycle and truth

规则 AGENTS；路由 ROUTER；任务 Workflow；知识结构 Templates/CORE-CONTRACT；工具位置每用户registry；架构本Map。历史Backup与运行证据不当作当前事实。正式脚本不得调用历史快照。Temp=任务产物，Cache=可重建内容，工具/模型不复制到Vault。

## Capability boundary

CORE系统安装/自检与离线契约可验证；真实笔记质量仍按任务材料核验。Video/Translation/Git remote为OPTIONAL，缺少依赖不阻断CORE。Personal Foundation已具协议，内容初始为空；Skill/插件安装或路径存在不能提升为所有环境端到端ACTIVE。外部Obsidian/Codex与managed runtimes由其供应商管理。

## Changes and updates

DISCOVER → REUSE → bounded DESIGN → authorized CHECKPOINT → IMPLEMENT → VERIFY → CLEANUP → scoped local COMMIT。未初始化Git报告NOT_CONFIGURED，不为提交改业务内容；Remote push 需用户明确授权；长期授权的仓库与范围记录在用户自己的 Vault，按 CORE-CONTRACT 执行。系统升级预览/hash/冲突检查后，只更新未定制的系统文件，保留USER_DATA/LOCAL_CONFIG，不自动删除旧文件。

## Video entry and analysis quality update

单条视频链接／BV 号默认分析并保存，例外与对象边界维护在 ROUTER；正文获取、证据、时间定位、文字与画面覆盖及失败处理维护在 Video Workflow。字幕与 ASR 仍依赖用户配置，不承诺任意平台可用。

跨材料的正文质量要求统一维护在 [[09_System/Workflows/CORE-CONTRACT#内容厚度、深入分析与有依据的提炼]]：具体材料充分展开，解释为什么，再形成有依据且保留边界的深层理解；完成核验检查实际正文。各 Workflow 沿用共享契约，不新增 Skill、模板类型或字段，不批量改写旧笔记。

## Primary repository and reusable distribution

主仓库保存用户资料及每次系统迭代的完整已跟踪版本与历史，用于恢复和回退。发行仓库从主仓库提取基本框架与功能，排除个人资料、模型实际内容、机器私有配置、凭据及私有 Git 历史。系统更新先进入主仓库，再同步可分发部分到发行仓库；二者不是互斥的保存目标。授权和发布核验遵循 CORE-CONTRACT，不增加后台同步。
