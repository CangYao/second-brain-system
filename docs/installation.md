# 安装

Windows 首版已验证 PowerShell 5.1/7 的初始化和自检。Obsidian 与 Codex（或支持项目级 Skill 的宿主）由用户自行安装。Git 建议安装，Node **不是 CORE 的依赖**；视频功能要求 Node 24 或更新版本。没有视频工具、翻译插件或 GitHub 账户不会阻止初始化。

## 从 ZIP 或 clone 开始

下载并审查来源后解压到系统包目录；不要把整个系统包直接当作个人 Vault。运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./setup/setup.ps1 -Destination "<NEW_VAULT_ROOT>" -NonInteractive -DryRun
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./setup/setup.ps1 -Destination "<NEW_VAULT_ROOT>" -NonInteractive
```

替换尖括号参数为自己选择的**全新或空目录**。Bypass 仅针对此进程，不修改系统策略；可在允许脚本的 PowerShell 中直接调用。setup 不提供静默覆盖模式，也不安装应用、修改 PATH、注册 CLI、初始化 Git 或配置远端。

默认外部 local root 是 Vault 的同级目录 `<Vault名称>-local`，可用 `-LocalRoot <EXTERNAL_ROOT>` 指定。Temp、Cache、升级前系统备份在该外部目录。Vault、local root 与安装包必须互不包含，拒绝 symlink/junction、UNC、盘符根目录和非空目标。

打开生成的 Vault 文件夹作为 Obsidian Vault 与 Codex 工作区。不要把 examples 自动导入；它们是演示，四个 Personal Model 初始为空。模板中的 slug/序号只有创建笔记时才解析；QuickAdd 脚本会解析，Codex 也须按 Workflow 生成稳定 ID，Native Daily 使用自己的日期占位符。

## 社区插件（手动、可选）

在 Obsidian 设置 → 第三方插件 → 浏览中核对 ID、作者和来源后安装。完整清单见 [plugin manifest](../config/plugin-manifest.json)。QuickAdd / Omnisearch 为 CORE_RECOMMENDED，Dataview / Templater / Tasks / Periodic Notes / Mini Translator 为 OPTIONAL；没有 CORE_REQUIRED 社区插件。不会附带插件 main.js、styles.css、data.json 或 workspace。

QuickAdd 新建 Macro 的 User Script 指向 `09_System/Scripts/QuickAdd-Create.js`，选择导出成员 inbox/book/video/knowledge/thought/daily（使用插件支持的 script::member 选择方式）；它只创建/打开模板，不代替内容整理。若该版本 UI 不支持成员选择，先核对官方说明，不复制另一套脚本。

Native Daily 已指向 06_Daily 和 Daily 模板；Periodic Notes 如安装，手动设成同一目录、日期格式与模板，只作打开当天 Daily 的 UI 入口。Templater 不必用于普通模板创建。先用虚构输入验证，不能把安装成功当作 GUI 行为成功。

视频/翻译/远端见各专题文档。自检：

```powershell
./setup/self-test.ps1 -Vault "<VAULT_ROOT>"
```

FAIL 阻止 CORE 判为就绪；WARN 表示可选功能或宿主探测未完成。包的完整性清单不能替代可信来源或签名验证。
