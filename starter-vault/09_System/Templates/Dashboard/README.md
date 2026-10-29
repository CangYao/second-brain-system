# Baixiao 阅读驾驶舱与辅助入口

本包提供 Baixiao Reading Cockpit 的 Second Brain 适配版，保留原项目的流体卡片、3D 目录卡和设置界面，接入已有书籍。首页、项目总览和阅读书架是配套的 Markdown/Bases 入口，也可独立使用。没有个人项目、书籍数据、私人网址或示例进度，不添加后台脚本或数据索引。

## 安装 Baixiao 适配版

插件附件在本目录的 `Baixiao-Reading-Cockpit` 子目录，来源、固定上游提交、二次修改与完整 MIT 许可分别见 `UPSTREAM.md` 和 `LICENSE`。这是同插件 ID 的本地适配版本，不代表上游作者认可本次修改。

1. 先按下方步骤复制六份辅助入口，或保留自己已有的同路径页面。
2. 审查附件后，将其显式文件复制到当前 Vault 的 `.obsidian/plugins/ycs-reading-dashboard/`，保留 `tests` 子目录：`main.js`、`styles.css`、`manifest.json`、`LICENSE`、`UPSTREAM.md`、`build.cjs`、`second-brain-data.js`、`second-brain-ui.js`、`second-brain.css` 及两份测试。目标已有同 ID 插件时先禁用，比较后只更新这些程序文件；保留自己的 `data.json`，不覆盖整个目录。
3. 在 Obsidian 的第三方插件设置中刷新并手动启用 Baixiao Reading Cockpit。安装器不会关闭受限模式、安装或启用插件，也不会修改 `community-plugins.json`。
4. 从命令面板选择“打开阅读吸收驾驶舱”，或点击首页的“阅读驾驶舱”。`obsidian://second-brain-cockpit` 使用当前 Vault，不绑定仓库名称；驾驶舱在中心标签页打开。
5. 新安装的显示身份为 Second Brain / 第二大脑。若该插件已有保存的身份设置，继续保留，可在界面中自行修改。Node 只用于可选的开发重建和测试，不是使用驾驶舱的依赖。

驾驶舱只读取两个既有书籍目录的 `type: book` 笔记。打开、刷新、扫描和新建事件都不会补写书籍属性；缺失阅读状态显示“未登记”。仅当用户在界面明确选择四种合法阅读状态时，才更新同一稳定 ID 书籍的 `status` 和 `updated`；不写入吸收状态或猜测完成日期。“新增日记”只调用已配置的 QuickAdd“新增每日记录”，失败时不创建替代目录或笔记。

系统升级只更新本目录中的分发附件，**不会自动覆盖已安装插件或个人配置**。需要更新适配版时，先阅读新的 `UPSTREAM.md`，禁用插件、比较并复制上述程序文件，再手动启用。直接使用社区市场更新同 ID 插件可能覆盖适配层；请合并上游变化后运行附件提供的构建与测试流程。禁用插件即可退出驾驶舱，书籍与辅助入口继续保留。

## 启用辅助 Markdown/Bases 入口

1. 在支持 Bases 的 Obsidian 中启用“设置 → 核心插件 → Bases”。界面中的名称可能显示为“数据库”。不需要 Dataview 或 JavaScript。
2. 在“设置 → 外观 → CSS 代码片段”刷新并启用 `second-brain-dashboard`；文件由系统包提供于 `.obsidian/snippets/second-brain-dashboard.css`。不更换现有主题或其他 snippets。
3. 从当前 `09_System/Templates/Dashboard` 目录复制下表六个文件到 Vault 中对应位置，保留文件名与相对路径。先确认目标不存在；如已存在页面，比较后手动合并，勿覆盖。
4. 三份 Markdown 的 `created`、`updated` 日期占位符需改为实际创建日期（`YYYY-MM-DD`）。每个 Vault 只保留一组入口页面；以后保留稳定 ID。
5. 打开 `02_Topics/第二大脑首页.md` 的阅读视图，可用 Obsidian 书签固定入口。安装器不修改启动页、工作区或书签设置。

| 模板相对路径 | Vault 内复制目标 |
| --- | --- |
| `02_Topics/第二大脑首页.md` | `02_Topics/第二大脑首页.md` |
| `02_Topics/首页动态视图.base` | `02_Topics/首页动态视图.base` |
| `03_Books/阅读书架.md` | `03_Books/阅读书架.md` |
| `03_Books/阅读书架.base` | `03_Books/阅读书架.base` |
| `08_Projects/项目总览.md` | `08_Projects/项目总览.md` |
| `08_Projects/项目总览.base` | `08_Projects/项目总览.base` |

在源码树中，这组模板位于 `starter-vault/09_System/Templates/Dashboard`；运行 setup 或升级后，以上说明均以个人 Vault 根目录为基准。不要把 `starter-vault` 本身当作个人 Vault。

“记录今天”“捕获资料”“登记书籍”复用 QuickAdd Starter 中的三个现有 Choice，需先按安装文档安装 QuickAdd 并导入配置包。链接不带 `vault` 参数，使用当前 Vault；重命名 Choice 后需同步链接中的名称。不使用 QuickAdd 时，可删去快捷链接并继续通过原模板或命令面板记录。

待办栏是可选的 Tasks 查询。未安装该插件时可删除该栏；已有 Tasks 的过滤设置继续生效。其余三个页面只依赖核心 Bases。

## 登记实际项目

默认项目筛选包含 `false`，因此结果为空。编辑复制后的 `08_Projects/项目总览.base`，在 `or` 下增加实际项目主入口的完整 Vault 相对路径，包含 `.md` 扩展名：

```yaml
    - or:
        - 'false'
        # 将下一行路径替换为实际存在的项目主入口，再取消注释：
        # - 'file.path == "08_Projects/实际项目目录/项目入口.md"'
```

每个项目登记一个入口，不将周记、计划、阶段验收和复盘分别算成新项目。入口应位于 `08_Projects`；若现有项目使用其他目录，可按真实结构调整这一条范围过滤，不迁移源文件。项目页展示原有 `title`（缺失时用文件名）、`id`、`updated` 和 `tags`，不要求添加字段。

目标、最新确认进展、下一步和阻碍继续在项目原文维护。可在项目总览增加指向具体章节的 Wikilink；未知内容不推测，也不以文件更新时间推断完成情况。

## 数据口径

- 书架读取 `03_Books/Fiction` 和 `03_Books/Nonfiction` 中 `type: book` 的笔记。沿用 `status` 的 `planned / reading / paused / completed`；缺失时显示“未登记”，未知值原样显示。不自动修正源属性。
- 首页只查询 `00_Inbox`、`01_Knowledge`、`06_Daily`，排除 `00_Inbox/Personal Model`。书架与首页排除文件名含“模板”或已有 `validation_fixture: true` 的笔记；不会为过滤新增这个字段。
- `note.updated` 表示内容更新日期；`file.mtime` 只用于收件箱与每日记录排序，不代表阅读、项目推进或事件发生日期。
- 空视图是正常状态，不会填入演示数据。新书缺少阅读状态时出现在全部书籍和“状态未登记”视图；不会自动进入“正在阅读”。
- 本包限定原目录查询，不扫描外部材料包、系统模板或个人模型。用户另行调整范围时，需自行审查会展示的内容。

## 更新与验证

模板与 CSS 是系统包文件，可通过既有 manifest 校验和升级流程分发。复制到 `02_Topics`、`03_Books`、`08_Projects` 的页面属于用户文件，系统升级不会改写；需要新布局时，比较新版模板并手动合并。对系统目录内模板或 CSS 的本地修改仍受现有升级冲突检查保护。

打开三个入口，确认嵌入视图无语法错误、链接回到实际笔记、缺失状态仍为“未登记”，并检查自己常用窗口宽度下的显示。只有实际登记项目后才应出现项目卡片。setup/self-test 通过仅说明包结构与配置通过检查，不代表当前 Obsidian、主题或手机界面已经验收。
