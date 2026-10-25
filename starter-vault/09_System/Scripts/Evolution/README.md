# Optional Evolution runtime

需要已安装 PowerShell 7.5+ 和 Python 3.12+；只使用 Python 标准库。通过 setup 的 ToolPathsFile 指定 `python`，或审核后在本机 `09_System/Config/tool-registry.local.json` 登记唯一 `python` 路径。核心 Markdown 功能无需本可选依赖。路径来自本机 local.json/registry，不依赖原作者设备或外部 RAG 环境。

用户明确启用后，在自己的 Vault 根目录初始化一次：

```powershell
& './09_System/Scripts/Evolution/Invoke-Evolution.ps1' -Initialize
```

初始化仅创建空治理数据；已有账本拒绝覆盖。公开包不含原作者运行记录。只读状态查询：

```powershell
& './09_System/Scripts/Evolution/Invoke-Evolution.ps1' -RequestJson '{"api_version":1,"operation":"status","arguments":{}}'
```

API envelope 为 api_version=1、operation、arguments。可用操作：search/begin/finish、lesson/activate、review/resolve_review、propose/decide/verify_proposal、show/status。search 仅返回 active 经验；候选查看必须显式 include_candidates，不能当作生效规则。begin 要求 key/title/task_type/scope/sources；finish 要求 task_id/outcome/summary/artifacts/checks/distillation。

checks 每项包含 name、dimension、result、evidence；dimension 为 structure/evidence/outcome，result 为 passed/failed/blocked/not_run。completed 要求三类全通过及实际非空产物。程序验证状态/指纹，不证明语义质量或真人身份。启用候选与批准提案必须绑定当前指纹和真实明确授权，模拟测试审批不得进入正式账本。

读写请求经本 PowerShell 入口；不要直接读取隐藏运行账本代替经验访问。入口失败时停止依赖经验的操作、记录具体错误；不扫描账本、扩大目录范围、改 shell 权限或盲删锁。拒绝未知字段、越界/隐藏写入目标、符号链接、过期审批和历史覆盖。不存在自动安装、联网模型、执行提案或提交 Git。

运行账本位于用户 Vault 的 `09_System/Evolution/.records.json`；摘要位于 local.json 的 tools_root 下 Temp/SecondBrain/Evolution，须与 Vault 不相交。首次升级获得脚本不会自动初始化或迁移旧数据；已有用户配置和治理数据保留。日常规则见 [[09_System/Workflows/Evolution]]。
