# Changelog

## 0.1.3

- Add single-video URL/BV intake defaults, scope exceptions, transcript failure handling, source-grounded analysis and coverage reporting.
- Improve the Video template and shared quality contract: concrete evidence/events, deeper explanation and grounded synthesis; verify prose rather than headings or length.
- Document explicit ongoing remote authorization and split content/system publishing; preserve portable configuration and exclude private data/history. No background sync or new dependencies.
- Validation covers package integrity and fresh installation checks; new-platform, GUI and per-video coverage remain task-specific.

## 0.1.2

- Fixed CONFIG_NOT_SHIPPED: ship and deploy a schemaVersion 1 QuickAdd Starter package with six command-enabled Macro entries referencing the existing script; use official one-time import after installing QuickAdd 2.31.0. No plugin binaries or data.json overwrite.
- Add fresh-setup/package/member-reference/import-model regression and Core package validation; retain v0.1.1 runtime fix.
- Replace manual six-Macro instructions with package import; clarify Chinese Restricted Mode button semantics. Actual Electron import and GUI actions remain PENDING_USER_RETEST.

## 0.1.1

- Fixed: QuickAdd user scripts failing in real Obsidian runtime because of incompatible module loading. Use the official injected `params.obsidian` API instead of `require('obsidian')`; retain all six creation entries, duplicate prevention and timezone logic.
- Added loader/invocation regression with an unresolvable `obsidian` module; API-double smoke now uses the real parameter boundary rather than making that require succeed.
- Improved first-run instructions: command working directory, opening the generated Vault, Restricted Mode/community plugins, CSS snippet and QuickAdd Macro/member setup.
- Real GUI re-validation is still pending until the user confirms the repaired QuickAdd action. Automated runtime checks are contract-level, not an Electron GUI simulation.

## 0.1.0

Based on functional baseline: Private Second Brain v1.2.0.

- Core：稳定目录、AGENTS/ROUTER/Workflows/Templates、Markdown治理和局部匹配。
- Cognitive Skills：教学、深读、研究、综合、Obsidian表达；保留第三方 notices。
- Bilingual Knowledge：中文主表达、aliases、概念对齐、原文与解释分离。
- Video Intelligence：保留字幕优先 acquisition，公开版显式config/roots与分支检测。
- Personal Model：四文件空bootstrap与证据准入。
- Setup / self-test / system-only upgrade：Windows PowerShell实现，拒绝覆盖/冲突，外部系统备份。
- Privacy：不含私人笔记/历史/路径/工具；生成独立SAMPLE，按功能可选依赖。

没有转移私人Git历史；没有程序/模型自动下载或远端初始化。GUI、各用户宿主与外部平台验证仍按环境完成。
