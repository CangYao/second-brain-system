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

QuickAdd 2.31.0 使用本包提供的官方配置包一次导入六入口，见下方步骤。无需手工创建 Macro；配置包只引用已安装的创建脚本，不复制脚本或包含插件程序。

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
5. 在本 Vault 的 `09_System/Config/QuickAdd-Starter.quickadd.json` 用文本编辑器打开文件（可从 Obsidian 文件列表的显示于系统资源管理器定位），复制完整 JSON。进入 Settings → QuickAdd → Choices & packages / Packages → **Import package…**，粘贴。审查六个中文 Choice；首次导入选 Import，不应有文件覆盖（assets 为空）。如要求代码执行确认，审查所引用的 `09_System/Scripts/QuickAdd-Create.js` 后勾选确认，再点 Import package。不要手工创建六个 Macro。
6. 应看到“新增 Inbox / 新增书籍 / 新增视频 / 新增知识 / 新增想法 / 新增每日记录”，六项 command=true，导入后应立即注册命令。Ctrl+P 搜索各名称或 QuickAdd；也可 QuickAdd: Run 打开选择列表。若只有通用命令，请先检查是否完成配置包导入，不要把插件安装成功当作六入口已初始化。再次导入若出现已有 ID，选择 Skip 保留自己的设置；不要选择 Duplicate 产生六份副本，不要未经审查 Overwrite。
7. 执行“新增 Inbox”，选择“知识”，标题填 `SAMPLE QuickAdd v0.1.2`，来源留空确认；应打开 `00_Inbox/SAMPLE QuickAdd v0.1.2.md`。再次同标题应打开原文件而非覆盖，取消输入不应写入。最终 GUI 是否成功必须由用户检查。
8. Native Templates 在 Settings → Core plugins 中确认启用，Templates 设置的目录应为 `09_System/Templates`。Native Daily Notes 的目录为 `06_Daily`，模板为 `09_System/Templates/Daily.md`；命令面板打开当天日记后检查实际日期及目录。不要把插件启用当作这些行为已经验证。

setup 不安装 QuickAdd；它部署官方可导入 Starter 配置包，不直接写入或覆盖 `.obsidian/plugins/quickadd/data.json`。安装并启用插件后一次导入才会将六入口保存到插件配置。脚本使用官方调用参数 `params.obsidian`；不需要 npm 的 `obsidian` 包或 `node_modules`。v0.1.2 自动测试检查 loader/invocation 契约和 API double；真实 Obsidian 1.14.4 GUI 复验仍为 **PENDING_USER_RETEST**，请保留成功截图或准确错误信息。

中文界面若按钮写着“开启安全/受限模式”，点击“开启”会**进入受限模式并禁用社区插件**，不是开启社区插件。使用 QuickAdd 时应处于受限模式关闭状态，并确认插件已 Enable。插件程序不随包捆绑；QuickAdd 是本六入口的必要插件，其他推荐/可选插件无需为了此测试全部安装。

配置包采用 [QuickAdd 官方 Packages](https://quickadd.obsidian.guide/docs/Choices/Packages/) schemaVersion 1，按 QuickAdd 2.31.0 固定源码核验（4a2679afd5b781f5f6968ce5478c921a7950108e）。插件使用 Obsidian loadData/saveData 管理自己的 data.json；公开系统不抢占其状态或假定插件安装前预置文件一定保留。
