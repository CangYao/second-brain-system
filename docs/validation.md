# Release-candidate validation

## v0.1.3 Workflow and quality update

Package integrity checks and a fresh Windows PowerShell 5.1 installation passed with CORE_READY=true. Shared analysis rules, Video routing/template, coverage/failure handling and explicit remote authorization were reviewed as scoped text changes. No acquisition/runtime logic or dependency changed. GUI and new-platform video behavior were not retested; optional features remain disabled until configured.

## v0.1.2 Starter configuration follow-up

v0.1.1 did not ship any QuickAdd choices; business/API-double tests directly invoked exports and missed missing initialization. v0.1.2 ships the official six-choice package, checks fresh-setup deployment, command flags, members/paths and an installation/import discovery model. The model is not QuickAdd's full importer or Electron GUI: AUTOMATED_RUNTIME_TEST PARTIAL; REAL_GUI_QUICKADD_STATUS PENDING_USER_RETEST. Plugin binaries are not bundled, and data.json is only written by QuickAdd after reviewed GUI import.


## v0.1.1 QuickAdd hotfix scope

Real Obsidian 1.14.4 evidence showed v0.1.0 QuickAdd failed before invocation at `require('obsidian')`. The earlier API double made that module resolve and missed the failure; its historic PASS did not establish GUI compatibility. The script now uses official `params.obsidian` injection, with loader tests denying all module resolution plus six-entry creation/duplicate/timezone regression. Fresh setup, Core, privacy and updater conflict checks are repeated for the patch.

AUTOMATED_RUNTIME_TEST: PARTIAL (loader/invocation contract checks pass; actual Electron GUI not automated).
REAL_GUI_QUICKADD_STATUS: PENDING_USER_RETEST.

## Historical v0.1.0 packaging tests

Windows PowerShell 5.1 and current PowerShell 7; Node 24 for optional video/API-double tests. Isolated clean destinations including Unicode/spaces; no software/plugin installation, no real network/media/ASR repetition.

| Test | Result | Evidence / scope |
|---|---|---|
| T01 | PASS | HYBRID structure + single runtime |
| T02 | PASS | No private path/audit/history/program/state in RC |
| T03 | PASS | High-signal credential scan clean; placeholders/rejection fixtures reviewed |
| T04 | PASS | Own MIT + unchanged three upstream MITs |
| T05 | PASS | Validated |
| T06 | PASS | All starter files hashed; no plugin runtime/private content |
| T07 | PASS | Validated |
| T08 | PASS | Explicit external roots, no fixed zone, Unicode/space destinations below |
| T09 | PASS | Generated config/registry, no examples imported |
| T10 | PASS | Windows PowerShell dry-run writes zero |
| T11 | PASS | Windows PS5.1 clean init; non-empty target rejected |
| T12 | PASS | CORE independent of Node/Git/CLI/plugins |
| T13 | PASS | A CORE only, B available canonical resources, C missing all optional video: CORE PASS |
| T14 | PASS | Seven task routes + canonical files; API smoke below; Inbox/Knowledge/Book/Thought/Daily/Video creation + duplicate reuse + timezone; Personal route bounded write; Obsidian API double, not GUI |
| T15 | WARN | Five valid project Skill frontmatters and packaged references; fresh Codex workspace discovery not exercised in this chat |
| T16 | PASS | 10 tests + branch-specific readiness without Whisper for captions |
| T17 | PASS | No translation plugin/CSS required for CORE logic |
| T18 | PASS | No repository/identity/remote created; no GitHub requirement |
| T19 | PASS | System update, user/config byte preservation, custom conflict zero-write, traversal rejection, fresh reinit + own SAMPLE recovery |
| T20 | PASS | 134 source file hashes + HEAD/tag/origin/status unchanged; protected untracked preserved |

Obsidian helper smoke uses an API double and a limited known-fixture YAML parser; it does not validate real UI, arbitrary YAML, LLM output quality or live provider availability. Five Skill metadata/static references pass, but new-host discovery remains WARN until opened as a real workspace. Optional missing applications/features warn without failing installed CORE contracts.

Upgrade passed untouched user-data/config checks, user-modified conflict zero-write, traversal rejection and reinitialization/SAMPLE-only restore. Hash inventories provide integrity checks, not cryptographic authenticity. No private source paths, audit inventories or runtime state accompany this public evidence.
