# Third-party notices

自有系统与包装：MIT，Copyright (c) 2026 CangYao。以下是实际重新分发的独立组件；其原始许可文本不变。

## ai-reading

- Repository: https://github.com/yanz86808-beep/ai-reading-skill
- Source commit: b936e92eef3cfd65bfea98b403a8ef31f8e59216
- License: MIT; [fixed source](https://github.com/yanz86808-beep/ai-reading-skill/blob/b936e92eef3cfd65bfea98b403a8ef31f8e59216/LICENSE)
- Runtime files: starter-vault/.agents/skills/ai-reading/SKILL.md and references/, agents/openai.yaml
- Notice: starter-vault/.agents/skills/ai-reading/LICENSE
- Modifications: SOURCE.md 重新生成，去除安装位置；SKILL.md 的教学型触发边界为本地适配。

## codex-research

- Repository: https://github.com/LIU-31415/codex-research
- Source commit: c74599903053f7ea2c0b1f9ae6749944bcd608bf
- License: MIT; [fixed source](https://github.com/LIU-31415/codex-research/blob/c74599903053f7ea2c0b1f9ae6749944bcd608bf/LICENSE)
- Runtime files: starter-vault/.agents/skills/codex-research/SKILL.md and references/, VERSION
- Notice: starter-vault/.agents/skills/codex-research/LICENSE
- Modifications: SOURCE.md 重新生成，去除安装位置；其余 runtime 与此固定 upstream blob 一致。

## obsidian-markdown

- Repository: https://github.com/kepano/obsidian-skills
- Source commit: 3ccff5338ea700537839b21900aa5358a0402c98
- License: MIT; [fixed source](https://github.com/kepano/obsidian-skills/blob/3ccff5338ea700537839b21900aa5358a0402c98/LICENSE)
- Runtime files: starter-vault/.agents/skills/obsidian-markdown/SKILL.md and references/
- Notice: starter-vault/.agents/skills/obsidian-markdown/LICENSE
- Modifications: SOURCE.md 重新生成，去除安装位置；其余 runtime 与此固定 upstream blob 一致。

## Reference-only

deep-reading、knowledge-synthesis 为独立表述实现，其 SOURCE.md 列出概念启发来源。没有分发这些来源的程序或 Skill 文件；引用不构成运行依赖。

## Not bundled

除下方明确列出的可选 Baixiao 适配附件外，其他社区插件、Node、FFmpeg、yt-dlp、whisper.cpp、模型、Obsidian 与 Codex 均由用户另行获取。已安装插件目录、个人配置、设备状态和历史数据不在本发行包中。项目代码许可不替代它们各自许可，模型许可/来源也不从推理程序许可推断。

## Baixiao Reading Cockpit · optional Second Brain adaptation

- Source: https://github.com/csuyincs-creator/Baixiao-Reading-Cockpit
- Source version: 1.0.3; fixed commit: `99c34d0a15398636fdbf4e497e76347cdd91fcf4`.
- Upstream author: YCS; license: MIT. The complete upstream notice is retained at `starter-vault/09_System/Templates/Dashboard/Baixiao-Reading-Cockpit/LICENSE`.
- Distribution: optional source, built runtime, build helper and tests under `starter-vault/09_System/Templates/Dashboard/Baixiao-Reading-Cockpit`; not automatically installed or enabled. No personal `data.json`, books or projects are included.
- Local changes: Second Brain data/status adapter, existing QuickAdd Daily integration, navigation and display adjustments. See that directory's `UPSTREAM.md` for provenance and rebuild instructions. This adaptation does not imply upstream endorsement.

## json-canvas

- Repository: https://github.com/kepano/obsidian-skills
- Source commit: 3ccff5338ea700537839b21900aa5358a0402c98
- License: MIT; fixed notice preserved at starter-vault/.agents/skills/json-canvas/LICENSE.
- Runtime: unchanged SKILL.md and references/ from the audited component; SOURCE.md added for provenance. No Obsidian program/plugin is bundled.

## obsidian-bases

- Repository: https://github.com/kepano/obsidian-skills
- Source commit: 3ccff5338ea700537839b21900aa5358a0402c98
- License: MIT; fixed notice preserved at starter-vault/.agents/skills/obsidian-bases/LICENSE.
- Runtime: unchanged SKILL.md and references/ from the audited component; SOURCE.md added for provenance. No Obsidian program/plugin is bundled.

## x2md

- Repository: https://github.com/yshmarov/x2md
- Fixed source commit: 6fd2ed7d0e61af72cfd677ed67bfe23e6c58fe91; upstream 0.1.0.
- License: MIT, unchanged notice at starter-vault/09_System/Scripts/X-Archive/vendor/LICENSE.
- vendor/x2md.py unchanged; the separate local archive.py adapter adds bounded Vault output, source handling and safe image capture. No actual captured article or author notes included.
