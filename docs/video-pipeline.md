# 可选 Video Intelligence

在加载本 Vault 规则的 Codex 项目聊天中，直接发送单条视频链接或 BV 号，默认分析并保存；可明确指定只讨论、仅收藏或片段范围。引用材料中的附带链接不自动触发。依赖未配置或未取得正文时说明缺口，不生成空分析；这不是后台监听。分析记录具体依据、推理与边界，并标明字幕／ASR及画面覆盖。

Node 最低 24，建议当前受支持的 24.x/更新版本；不捆绑 runtime。基本路径保持：URL/本地文件 → provider → 官方字幕优先 → 音频 → ffmpeg/ffprobe → whisper.cpp → normalized transcript → Workflow/deep-reading → 中文可追溯笔记。平台规则可能改变，不保证所有视频可取，不绕访问限制。

## 配置自己的工具

按官方来源自行安装 yt-dlp、ffmpeg/ffprobe、whisper.cpp 和需要的模型；没有自动下载 helper，避免默认大体积下载。安装前核对 source/version/size/license/checksum，尤其 FFmpeg 构建许可与权重许可应单独核对。创建机器私有 ToolPaths JSON，可含 node、yt-dlp、ffmpeg、ffprobe、whisper-cli、whisper-model-small 键和真实绝对路径；不要把此文件提交到框架。

新安装时：

```powershell
./setup/setup.ps1 -Destination "<NEW_VAULT_ROOT>" -LocalRoot "<EXTERNAL_ROOT>" -Video -ToolPathsFile "<PRIVATE_TOOL_PATHS_JSON>" -NonInteractive
```

既有安装无需重跑 setup：编辑已 ignore 的 local.json，video=true；在 tool-registry.local.json 登记自己的唯一工具路径。不改变 Vault 文件名或 canonical 入口；更新路径后先自检。public examples 不可直接当作运行配置。

```text
node <VAULT_ROOT>/09_System/Scripts/Video-Intake.cjs --check
node <VAULT_ROOT>/09_System/Scripts/Video-Intake.cjs --input <URL_OR_LOCAL_MEDIA> --no-asr
```

默认读取与脚本同 Vault 的 local.json；可显式 --config，更高优先级 --registry 仅覆盖 registry，Temp/Cache 仍由 config 定义。不推导作者工具布局。公开 Bilibili 字幕分支仅需 Node；YouTube 字幕需 node/yt-dlp，ffmpeg 可选；ASR 才需 ffmpeg/ffprobe/whisper/model。--check 缺依赖输出 WARN 与分支 missing 列表，CORE 不受影响。

Temp 与 Cache 必须和 Vault 互不包含，默认 <external>/Temp/VideoPipeline 与 <external>/Cache/VideoPipeline。生成 run 有 ownership marker；cleanup 只删除自己管理的确切 run，保留原媒体。手工提供认证材料不保存到正式笔记，任务临时认证副本无论成功/失败均清理。

本发行验证配置、依赖解析和离线回归；源功能基线经历真实平台验证，但本次没有再次网络下载/ASR。需要首次实际平台测试时，小范围授权并检验 transcript/coverage/笔记；工具存在不能证明内容成功。

## Optional anonymous Douyin provider (v0.2)

Video-Intake 1.1.0-public.1 接受抖音标准链接、短链或分享文案中的第一个抖音链接。由用户独立审查并在本机 registry 登记 douyin-python 与 douyin-provider；ToolPathsFile 可显式提供这两个已存在路径。Provider 不随包分发，不自动安装浏览器或读取用户浏览器配置。

调用协议：由登记的 Python 执行 Provider，参数 --input URL --max-seconds N；元信息模式加 --metadata-only，否则传 --output-dir <当前run/media>。成功返回 JSON，含 url/aweme_id/title/desc/author/published_date/duration_seconds/provider，以及下载时的 media_file。媒体必须位于本次 run/media 内，随后走已有 ASR 和时长核验。错误 JSON 的 code 传播为 DOUYIN_<CODE>，不得在登录、验证码或限流后绕过限制。调用端不传登录、Cookie 文件或浏览器配置，不回退到其他抓取器。

--no-asr 在该平台只取得 metadata，不能冒充字幕成功。公开版只验离线适配器契约；实际匿名获取及服务可用性需部署者按自己的 Provider 再验证。
