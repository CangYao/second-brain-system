# 架构与所有权

HYBRID：外层安装/文档 + 单份 starter-vault。不存在重复 system/ 实现。

User → AGENTS → ROUTER → Workflow → 必要 Skill/Tool → Markdown → Verify → scoped local commit。

Workflow 管业务编排、身份匹配和最终写入；Skill 管教学、深读、研究、综合或 Markdown 表达，不接管目录/schema/Git。Markdown 是知识资产；Obsidian 是阅读编辑界面；Codex 是执行层。研究连接器是可选增强，不由 setup 安装。

| 层 | 内容 | 升级行为 |
|---|---|---|
| USER_DATA | 00–08 目录的笔记、四个 Personal Model、用户其他内容 | 永不默认覆盖 |
| SYSTEM_LAYER | AGENTS、Skills、Workflows、Templates、Scripts、generic CSS、System Map | 清单、hash、冲突检查后更新 |
| LOCAL_CONFIG | 机器路径、工具 registry、features、timezone、Obsidian/plugin设置/UI状态 | 保留；schema不支持则停止 |

local.json 和 registry 放在 09_System/Config 下并被 ignore，不属于私人内容层；外部 Temp/Cache/工具根完全离开 Vault。system-state.json 是轻量系统所有权记录，无私人源历史；升级只更新此记录的版本/hash，不改用户 local.json。

Native/plugin 配置初次初始化而非系统自动覆盖。系统文件也可能被用户定制，hash 不等于前发行版即冲突，不能以“系统目录”为理由覆盖。Backup 只用于唯一状态或升级需要的系统旧文件；不存可再下载程序和 Cache。CODEx-managed runtime 不复制、不固定依赖其内部路径。
