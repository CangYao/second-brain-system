# 安装

Windows 首版已验证 PowerShell 5.1/7 的初始化和自检。Obsidian 与 Codex（或支持项目级 Skill 的宿主）由用户自行安装。Git 建议安装，Node **不是 CORE 的依赖**；视频功能要求 Node 24 或更新版本。没有视频工具、翻译插件或 GitHub 账户不会阻止初始化。

## 从 ZIP 或 clone 开始

下载并审查来源后解压到系统包目录；不要把整个系统包直接当作个人 Vault。运行：

```powershell
Set-Location "<EXTRACTED_OR_CLONED_PACKAGE_ROOT>"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./setup/setup.ps1 -Destination "<NEW_VAULT_ROOT>" -NonInteractive -DryRun
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./setup/setup.ps1 -Destination "<NEW_VAULT_ROOT>" -NonInteractive
```

替换尖括号参数为自己选择的**全新或空目录**。Bypass 仅针对此进程，不修改系统策略；可在允许脚本的 PowerShell 中直接调用。setup 不提供静默覆盖模式，也不安装应用、修改 PATH、注册 CLI、初始化 Git 或配置远端。

第一行应指向包含 `README.md`、`setup/`、`starter-vault/` 的解压/clone 根目录；后续 `./setup/...` 都从该目录运行，不是在目标 Vault 中运行。不是把尖括号文字原样输入。

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

## 首次打开与 GUI 验证

1. 打开 Obsidian，在仓库管理（Manage vaults）中选择“打开文件夹作为仓库”（Open folder as vault），选择 setup 的 `-Destination`，不是 clone/ZIP 根目录或 `starter-vault`。
2. Core 没有必需社区插件。需要 QuickAdd 时，先核对其来源，再到 Settings → Community plugins（设置 → 第三方插件）关闭 Restricted mode / Safe mode，确认允许社区插件。限制模式下即使插件文件存在，也可能显示 **0 个已加载插件**；这不代表 setup 删除了插件。
3. 在 Community plugins → Browse 中搜索 **QuickAdd**（作者 Christian Houmann），核对来源，Install 后点 Enable；返回已安装插件列表确认 QuickAdd 开关启用。其他推荐/可选插件按需求安装，不必全部安装。
4. Settings → Appearance（外观）→ CSS snippets（CSS 代码片段），确认 `bilingual-display` 开关启用。若列表未显示，点刷新；文件应在本 Vault 的 `.obsidian/snippets/bilingual-display.css`。中文名称只是显示，真实文件名/路径不变。
5. Settings → QuickAdd，输入 `新增 Inbox`，类型选 **Macro**，Add。打开这个 choice 的 Configure，添加 **User Script** 步骤，选择/输入 `09_System/Scripts/QuickAdd-Create::inbox`（脚本成员表达式；文件本身是 `.js`）。不同版本 picker 可先选 `QuickAdd-Create` 再选择成员 `inbox`。不要只选整个导出对象，也不要复制脚本；若 UI 无法选择成员，按[官方 User Scripts](https://quickadd.obsidian.guide/docs/UserScripts/)确认本版本方式。
6. 可用同样方式配置现有六入口：`新增 Inbox → inbox`、`新增书籍 → book`、`新增视频 → video`、`新增知识 → knowledge`、`新增想法 → thought`、`新增每日记录 → daily`，每个 Macro 指向同一脚本的对应成员。choice 的闪电图标可将其直接暴露为命令。
7. `Ctrl+P`，执行 **QuickAdd: Run QuickAdd**（也可能显示 QuickAdd），选择 `新增 Inbox`；如果已启用闪电图标，也可直接搜索该 choice。选择“知识”，标题填 `SAMPLE QuickAdd v0.1.1`，来源留空并确认。应打开 `00_Inbox/SAMPLE QuickAdd v0.1.1.md`，无模块加载错误；再次使用同一标题应打开已有文件而非覆盖。取消输入不应创建文件。
8. Native Templates 在 Settings → Core plugins 中确认启用，Templates 设置的目录应为 `09_System/Templates`。Native Daily Notes 的目录为 `06_Daily`，模板为 `09_System/Templates/Daily.md`；命令面板打开当天日记后检查实际日期及目录。不要把插件启用当作这些行为已经验证。

setup 不安装 QuickAdd，也不生成当前用户的 Macro 配置。脚本使用官方调用参数 `params.obsidian`；不需要 npm 的 `obsidian` 包或 `node_modules`。v0.1.1 自动测试检查 loader/invocation 契约和 API double；真实 Obsidian 1.14.4 GUI 复验仍为 **PENDING_USER_RETEST**，请保留成功截图或准确错误信息。
