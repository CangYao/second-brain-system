# Video Intake

Acquisition only，非LLM总结/笔记写入。Node24+；默认读取同Vault的09_System/Config/local.json，--config可覆盖，registry_file在config目录解析，--registry是可选override。tools/temp/cache根显式配置，必须Vault外；安装器只detect/configure，不下载。

`node Video-Intake.cjs --help`；`--check` 返回字幕/ASR分支PASS/WARN；缺可选依赖不导致CORE失败。运行功能需features.video=true。normalized segments/transcript/chunks保留来源与实际coverage；acquisition不等于读完。失败按API/字幕/media/ASR分层记录，日志脱敏。owned run清理不能删除原媒体或别的缓存。

详细使用和安装见发行包 docs/video-pipeline.md；运行完整性遵循 [[09_System/Workflows/Video]]。无固定机器路径、程序复制或浏览器认证读取。
