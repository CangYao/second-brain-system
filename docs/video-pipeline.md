# 可选 Video Intelligence

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
