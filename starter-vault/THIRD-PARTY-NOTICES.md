# Third-party notices

自有系统与包装：MIT，Copyright (c) 2026 CangYao。以下是实际重新分发的独立组件；其原始许可文本不变。

## ai-reading

- Repository: https://github.com/yanz86808-beep/ai-reading-skill
- Source commit: b936e92eef3cfd65bfea98b403a8ef31f8e59216
- License: MIT; [fixed source](https://github.com/yanz86808-beep/ai-reading-skill/blob/b936e92eef3cfd65bfea98b403a8ef31f8e59216/LICENSE)
- Runtime files: .agents/skills/ai-reading/SKILL.md and references/, agents/openai.yaml
- Notice: .agents/skills/ai-reading/LICENSE
- Modifications: SOURCE.md 重新生成，去除安装位置；SKILL.md 的教学型触发边界为本地适配。

## codex-research

- Repository: https://github.com/LIU-31415/codex-research
- Source commit: c74599903053f7ea2c0b1f9ae6749944bcd608bf
- License: MIT; [fixed source](https://github.com/LIU-31415/codex-research/blob/c74599903053f7ea2c0b1f9ae6749944bcd608bf/LICENSE)
- Runtime files: .agents/skills/codex-research/SKILL.md and references/, VERSION
- Notice: .agents/skills/codex-research/LICENSE
- Modifications: SOURCE.md 重新生成，去除安装位置；其余 runtime 与此固定 upstream blob 一致。

## obsidian-markdown

- Repository: https://github.com/kepano/obsidian-skills
- Source commit: 3ccff5338ea700537839b21900aa5358a0402c98
- License: MIT; [fixed source](https://github.com/kepano/obsidian-skills/blob/3ccff5338ea700537839b21900aa5358a0402c98/LICENSE)
- Runtime files: .agents/skills/obsidian-markdown/SKILL.md and references/
- Notice: .agents/skills/obsidian-markdown/LICENSE
- Modifications: SOURCE.md 重新生成，去除安装位置；其余 runtime 与此固定 upstream blob 一致。

## Reference-only

deep-reading、knowledge-synthesis 为独立表述实现，其 SOURCE.md 列出概念启发来源。没有分发这些来源的程序或 Skill 文件；引用不构成运行依赖。

## Not bundled

社区插件、Node、FFmpeg、yt-dlp、whisper.cpp、模型、Obsidian 与 Codex 均由用户另行获取。插件目录、安装包、设备状态和历史数据不在本发行包中。项目代码许可不替代它们各自许可，模型许可/来源也不从推理程序许可推断。
