# Second Brain System

以 Markdown 为知识资产、Obsidian 为主要阅读编辑界面、Codex 为受控 AI 执行层的个人知识系统。适合希望通过自然语言整理知识、阅读、思想和每日记录，同时保留原始来源与可恢复历史的用户。

**Public v0.1.2** 包含 QuickAdd runtime 修复与官方六入口配置包；核心功能源自已经验证的 private-v1.2.0 基线。版本号不表示核心知识规则尚未建立，也不保证当前机器已完成所有 GUI/外部平台测试。v0.1.0 的真实 QuickAdd GUI 加载失败已修复模块依赖，自动回归通过；修复后的真实 GUI 仍待用户复验。

## 核心能力

- Inbox / Book / Knowledge / Thought / Daily / Personal Model 工作流；局部匹配、增量更新、避免重复。
- 教学阅读、单源深读、外部研究、多源综合、Obsidian Markdown 五个按需 Skill；DEEP ≠ BROAD，原文证据、解释和综合分开。
- 中文主表达、aliases与概念对齐；原文、译文、AI解释区分，不复制两套知识对象。
- YAML、来源、稳定ID与内部链接；验证后的 scoped local commit，有Git才提交，永不默认push。
- 空 Personal Model 渐进建立，explicit/inference/change/unknown；普通推荐不反向学习。

架构：User → AGENTS → ROUTER → Workflow → 必要 Skill/Tool → Vault → Verify → scoped local commit。完整运行代码只保留在 starter-vault 一份。

## 快速安装

Windows：Obsidian + Codex 宿主由用户安装；初始化脚本用 PowerShell 5.1+，无需 Node。先打开 PowerShell，切换到解压或 clone 后包含本 README 和 `setup` 文件夹的包根目录，再选空目录并 dry-run：

```powershell
Set-Location "<EXTRACTED_OR_CLONED_PACKAGE_ROOT>"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./setup/setup.ps1 -Destination "<NEW_VAULT_ROOT>" -NonInteractive -DryRun
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./setup/setup.ps1 -Destination "<NEW_VAULT_ROOT>" -NonInteractive
./setup/self-test.ps1 -Vault "<VAULT_ROOT>"
```

替换占位路径；只使用可信包并审核脚本。打开生成Vault作为Obsidian Vault和Codex工作区。非空目录停止，不静默覆盖。脚本不安装软件、不改PATH、不创建Git/remote。Bypass仅作用本进程。详见[安装](docs/installation.md)与[Quick Start](docs/quick-start.md)。

首次 GUI 接力：Obsidian → Manage vaults（管理仓库）→ Open folder as vault（打开文件夹作为仓库）→ 选择生成的 Vault，而非安装包目录。社区插件是可选的：先审查来源，再在 Settings → Community plugins 关闭 Restricted/Safe Mode；限制模式下可能显示 0 个已加载插件。CSS 在 Settings → Appearance → CSS snippets 中确认 `bilingual-display` 已启用。QuickAdd 安装后的一次配置包导入及 `Ctrl+P → QuickAdd → 新增 Inbox` 验证步骤见[安装文档](docs/installation.md#首次打开与-gui-验证)。

## 目录

```text
starter-vault/   # 单份系统入口与干净用户目录
  AGENTS.md / .agents/skills/ / .obsidian/
  00_Inbox … 08_Projects / 09_System
setup/          # 初始化、检测、自检、受限升级
config/         # 公共example、插件清单与依赖说明
examples/       # 新生成SAMPLE，不默认导入
docs/           # 使用、隐私、可选功能和升级
```

自然语言：“把这个知识点整理进知识库”“整理这本书”“记录一下今天”“我突然想到……”；Agent 按路由与已有模板处理，先匹配再写入，不强制全库扫描或全部Skill链。

## 可选功能

**Video Intelligence**：字幕优先，必要时音频/ASR；Node24+、自己的yt-dlp/FFmpeg/Whisper/模型按分支配置；不随包捆绑、不自动下载。公开平台限制可能要求本地素材，不保证任意视频。见[视频](docs/video-pipeline.md)。

**Translation**：Mini Translator 是阅读工具，手动安装；向在线服务发送选中的文本，可有本地历史。不安装不影响双语语义规则。见[翻译](docs/translation.md)。

**Git Backup**：Git本地版本管理可选；用户私有远端、认证与push须明确授权，安装公开框架不授权公开个人数据。见[Git](docs/git-backup.md)。社区插件均不打包，见[插件清单](config/plugin-manifest.json)。

## 隐私、升级与限制

没有原作者个人笔记、模型、设备路径、账号、Git历史或工具程序。四个 Personal 文件是空bootstrap。USER_DATA/SYSTEM_LAYER/LOCAL_CONFIG 分层；升级仅处理已拥有且未被用户改过的系统文件，冲突零写入，保留用户内容与配置。见[隐私](docs/privacy.md)、[架构](docs/architecture.md)、[升级](docs/upgrading.md)。

Windows-first 已做安装模拟与离线验证；没有宣称 macOS/Linux/mobile 或新宿主GUI已测试。AI结论仍需来源与范围核验，外部请求遵守服务条款。Git身份、社区插件UI、宿主Skill发现和真实视频首次测试由用户在其环境验证。见[排障](docs/troubleshooting.md)。

## License

自有代码 Copyright (c) 2026 CangYao，MIT，见[LICENSE](LICENSE)。第三方Skill保留自己的许可与固定来源，见[THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md)。不把整个系统误称为某第三方项目；未捆绑外部工具/模型/插件。

QuickAdd 插件程序不捆绑。安装并启用 QuickAdd 2.31.0 后，按安装文档导入生成 Vault 内的 `09_System/Config/QuickAdd-Starter.quickadd.json`，六入口一次出现，无需手工创建 Macro。“开启安全/受限模式”会禁用社区插件；使用插件时应关闭受限模式。
