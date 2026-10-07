# 排障

| 情况 | 下一步 |
|---|---|
| NON_EMPTY_DESTINATION | 选择新的空目录；没有强制覆盖选项 |
| 外部 roots 与 Vault 重叠／reparse | 改用真实本地同级目录，拒绝 junction/symlink，不改系统权限 |
| PowerShell 禁止执行 | 审核源码后用文档中的进程级 ExecutionPolicy；不改全局策略 |
| 自检 CORE FAIL | 修复具体缺文件、路由引用或配置schema，再重跑 |
| VIDEO WARN | 依字幕/ASR分支补齐，普通文字任务照常 |
| 无 Obsidian command | 不修改 PATH；GUI 直接打开 Vault，CLI非CORE必要 |
| Skill 未加载 | 确认 Codex workspace 是生成Vault、.agents/skills存在；新宿主会话核对发现列表，不复制到managed目录 |
| Native/QuickAdd差异 | 共用模板/目录；逐项验证UI，不通过重写规则制造成功 |
| Git NOT_CONFIGURED | 用户自行决定初始化/身份；内容已验证则保留，不自动配置remote |
| Upgrade CONFLICT | 零写入；比较前版本、用户版本、新系统版本，保留自己的工作 |
| 平台403/412或字幕缺失 | 报告具体层级；使用合法本地媒体，不改代理、Cookie或无限重试 |

自检 PASS 是安装/结构级证据，不是任何知识输出正确或所有外部服务可用的证明。
