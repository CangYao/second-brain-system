# Baixiao Reading Cockpit · Second Brain 适配版

上游：[csuyincs-creator/Baixiao-Reading-Cockpit](https://github.com/csuyincs-creator/Baixiao-Reading-Cockpit)

- 上游版本：1.0.3
- 固定提交：`99c34d0a15398636fdbf4e497e76347cdd91fcf4`
- 本地适配：2026-10-30，revision `second-brain-2`
- 上游作者：YCS；MIT 许可，完整声明保留于 `LICENSE`。

保留上游流体统计卡、3D 目录卡、设置面板及宽窄布局。`main.js` 中标记 `BEGIN SECOND BRAIN ADAPTERS` 之前为上游实现，之后是阅读与工作台四个本地适配模块的内联产物，不依赖相对 require 或额外 npm 包。

## 适配约定

- 只读取 `03_Books/Fiction` 和 `03_Books/Nonfiction` 下 `type: book` 的实际书籍；排除模板和验收样例。
- 原 `status` 映射为计划阅读、在读、暂停、已读；缺失状态显示未登记，不初始化或批量补填。
- 打开、扫描、刷新、新建事件不改写业务笔记。明确更改阅读状态时，仅更新当前书籍的 `status` 和 `updated`，重查路径、类型与稳定 ID。
- 没有对应长期契约的吸收状态不写入；建档热力读取真实 `created`，不从文件时间或状态推断阅读日期。
- 首页、项目总览、阅读驾驶舱和阅读书架在同一视图切换，保留统一侧栏和深色视觉。原 Markdown/Bases 页面继续可独立使用。
- 首页与项目页复用上游真实流体渲染器，使用彩色玻璃与空间轨道；个性化节点来自当前在读书籍和现有项目入口。文字保持正向可读，空数据不显示假节点，系统“减少动态效果”设置会关闭轨道与浮动动画。
- 项目清单直接解析 `08_Projects/项目总览.base` 的明确文件白名单；项目说明直接读取原 `项目总览.md` 的 `dashboard-panel`。不在代码中维护私人项目清单、目标、进度或状态。
- 首页列表沿用 `02_Topics/首页动态视图.base` 的范围、排序与上限；快捷入口和 Tasks 查询来自原首页 Markdown。未支持的筛选或缺失来源会显示错误，不扩为全目录扫描，不填入演示数据。
- Daily 调用已有 QuickAdd“新增每日记录”；首页快捷按钮调用原配置中的 QuickAdd、搜索或笔记入口，无独立创建逻辑。
- 元数据变化及两份 `.base` 的修改会刷新页面；切换与关闭释放 Markdown 组件及阅读动画资源，较旧异步读取不覆盖新页面。
- 命令面板提供“打开第二大脑首页”“打开项目总览”；协议 `obsidian://second-brain-cockpit?page=home` 或 `page=projects` 可直接定位内部页面。
- 外部链接仅来自原笔记；插件本身不新增远端服务或数据上传。

## 维护

编辑 `second-brain-data.js`、`second-brain-ui.js`、`second-brain-workspace-data.js`、`second-brain-workspace-ui.js` 或 `second-brain.css` 后，在本目录运行：

```sh
node build.cjs
node --check main.js
node tests/reading-dashboard-contract.test.js
node tests/second-brain-data.test.js
node --test tests/workspace-data.test.js tests/workspace-ui.test.js
```

关闭并重新启用插件以载入修改。`styles.css` 尾部含局部适配样式。

这是同 ID 的本地二改版本。直接使用社区市场更新会覆盖 `main.js` 和 `styles.css`；升级前应合并新的上游版本与适配模块，并重新验证无批量写入、字段及真实数据。上游原始写入行为保留在源码历史部分，但运行时已由最后安装的适配层替换。

禁用插件即可退出驾驶舱；不会删除已有书籍或辅助 Markdown/Bases 页面。现有设置、主题及其他插件不由此插件接管。
