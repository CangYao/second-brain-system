# 系统层升级与恢复

```powershell
./setup/upgrade.ps1 -Vault "<VAULT_ROOT>" -DryRun
./setup/upgrade.ps1 -Vault "<VAULT_ROOT>"
```

从可信新系统包运行；清单内源文件必须匹配 SHA256，路径必须属于代码白名单，不接受 traversal、user-data、local config 或 symlink。目标按上次安装 system-state 的 hash 比较：用户改过、删过或新路径已经存在则 CONFLICT、零写入。没有 override；先审查三方差异并独立保存自己的定制。

通过检查后，仅复制改变的系统文件，原文件和旧 state 放在外部 local root 的 UpgradeBackups/随机运行目录；不备份整个Vault。source removed 的系统文件保留为 legacy，不自动删除。local.json 与 registry 原样保留，只有系统ownership state 更新版本；配置schema不认识则停止。新包不自动安装插件或下载工具。

若已有 Git 仓库，dirty/异常状态阻止升级；没有 Git 仍可依赖逐文件备份。出现中途失败只尝试回滚本轮拥有的系统变化，并报告不能安全恢复的文件；不会reset/clean用户内容。恢复应按具体系统备份文件进行，不覆盖用户层。需同时保留用户自己的数据备份与 Git历史；重新安装系统不等于恢复个人笔记。

清单不是签名或认证机制，不能防御整个可信源被恶意替换；发布时还需审查实际来源。跨平台与更复杂schema迁移留待后续明确版本。
