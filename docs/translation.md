# 可选阅读翻译

Mini Translator 是 selection translation 工具，不是 Bilingual Knowledge Governance。没有它，CORE 仍有中文 canonical naming、aliases、Concept Alignment、原文/译文/解释区分。

从 Obsidian 官方社区目录安装 Mini Translator，审阅权限与 provider 设置，把目标设为简体中文，关闭自动全文翻译，选中英文后手动触发。插件不由 setup 下载、启用或写入配置。-Translation 只记录用户选择，TRANSLATION_READY 还需实际 plugin main.js + enabled list；这仍不等于真实翻译请求已成功。

按既有参考实现，主动选中的文本发送在线 provider（腾讯句子／有道词语等，取决于版本与设置），不是完全本地。当前版本应在插件设置/源码核对 provider；不保证所有免费端点长期稳定。可存本地历史，data.json/history ignore 不等于阻止其他同步。不要输入凭据或未经允许的私人材料，安装后用非私人词/句验证中文显示与原 Markdown 未变。无 API Key 的模式也不免除隐私审查。
