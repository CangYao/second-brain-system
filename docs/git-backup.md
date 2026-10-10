# 可选 Git 与远端备份

CORE 知识文件不依赖 GitHub，setup 不创建 Git 历史、identity、remote 或账户。Git 尚未配置时，不阻断内容任务；报告 NOT_CONFIGURED。希望本地自动收尾时，由用户在**自己的新 Vault**初始化仓库并设置仓库级身份，核验首次提交范围；规则明确授权验证后的任务范围提交，不混既有改动。

Git Backup 另需用户明确授权的私有远端与认证；-GitBackup 只记录选择，READY 需检测 Git、本地仓库及 remote。这不证明 remote PRIVATE、账户授权或推送成功；第一次真实配置前核对远端可见性和内容、凭据方式，禁止猜测。不要把 provider Token 或 Cookie 写入 Markdown、registry或包。

本地 commit 是任务收尾，remote push 需用户明确授权；可在自己的 Vault 记录长期同步的目标、范围及分仓约定，范围一致时无需重复授权。公开框架安装不授予向作者仓库上传任何数据的权限。系统升级若发现 dirty Git 状态会停止；不自动stage、reset、clean或修改身份。用户的仓库独立于框架公开仓库，私有历史不进入框架。
