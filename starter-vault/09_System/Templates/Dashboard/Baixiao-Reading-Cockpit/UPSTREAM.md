# Baixiao Reading Cockpit · Second Brain 适配版

上游：[csuyincs-creator/Baixiao-Reading-Cockpit](https://github.com/csuyincs-creator/Baixiao-Reading-Cockpit)

- 上游版本：1.0.3
- 固定提交：`99c34d0a15398636fdbf4e497e76347cdd91fcf4`
- 本地适配：2026-10-30，revision `second-brain-1`
- 上游作者：YCS；MIT 许可，完整声明保留于 `LICENSE`。

保留上游流体统计卡、3D 目录卡、设置面板及宽窄布局。`main.js` 中标记 `BEGIN SECOND BRAIN ADAPTERS` 之前为上游实现，之后是两个本地适配模块的内联产物，不依赖相对 require 或额外 npm 包。

## 适配约定

- 只读取 `03_Books/Fiction` 和 `03_Books/Nonfiction` 下 `type: book` 的实际书籍；排除模板和验收样例。
- 原 `status` 映射为计划阅读、在读、暂停、已读；缺失状态显示未登记，不初始化或批量补填。
- 打开、扫描、刷新、新建事件不改写业务笔记。明确更改阅读状态时，仅更新当前书籍的 `status` 和 `updated`，重查路径、类型与稳定 ID。
- 没有对应长期契约的吸收状态不写入；建档热力读取真实 `created`，不从文件时间或状态推断阅读日期。
- Daily 调用已有 QuickAdd“新增每日记录”；第二大脑首页、项目总览、书籍笔记视图用现有 Markdown 入口。
- 外部链接仅来自原笔记；插件本身不新增远端服务或数据上传。

## 维护

编辑 `second-brain-data.js` / `second-brain-ui.js` 后，在本目录运行：

```sh
node build.cjs
node --check main.js
node tests/reading-dashboard-contract.test.js
node tests/second-brain-data.test.js
```

关闭并重新启用插件以载入修改。`styles.css` 尾部含局部适配样式。

这是同 ID 的本地二改版本。直接使用社区市场更新会覆盖 `main.js` 和 `styles.css`；升级前应合并新的上游版本与这两个适配模块，并重新验证无批量写入、字段及真实数据。上游原始写入行为保留在源码历史部分，但运行时已由最后安装的适配层替换。

禁用插件即可退出驾驶舱；不会删除已有书籍或辅助 Markdown/Bases 页面。现有设置、主题及其他插件不由此插件接管。
