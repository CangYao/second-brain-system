# Incremental synthesis

## Provenance and source-near synthesis

对承重判断保留任务内最小记录：命题、归属/source key、原始/转述谱系、版本/locator、实际访问/coverage、可见支持、解释与AI连接理由、条件/缺口。不是永久数据库或新 Properties；多于两源逐源记，不压成A/B。

内部区分 SOURCE_A_CLAIM、SOURCE_B_CLAIM、SHARED_EVIDENCE、DISAGREEMENT、AI_SYNTHESIS、UNCERTAIN：
- 两方共享同一原始证据与两项独立研究趋同不同；转载、书评和引用同一研究不能重复计权。独立性未知就说明，不凭来源数量断言互证。
- 二手笔记提供其实际记录的理解，不把 notes→notes 循环当原始依据，不把未取得引文当已核验。
- 外部 evidence 继承 research 的实际访问、质量/方法评价、谱系和未决；摘要不能支持超出摘要的科学细节。
- 共同点与差异先以必要事实/短引文/准确转述呈现，再说明可比维度、推理与AI综合；locator不代替正文证据。AI重建不冒充来源结论。
- 综合继承来源覆盖与缺口，不将两份局部阅读相加成整书FULL。不能核验承重引文或归属时先回查/撤回，不靠一句总免责声明保留确定性断言。

## Incremental impact by proposition

必须有明确 old claim 与原支持范围，才能判断 new claim/evidence 改变哪一条。先查谱系与可比性，再区分内容变化和证据增量；没有旧判断时可作综合，不伪称“修订”。

| Impact | 判断条件 | 建议边界 |
| --- | --- | --- |
| SUPPORTS | 同命题/条件有实际新增支持，含义/范围不变；说明独立性 | 同源转述不算独立支持；更多同条件例子不自动扩范围 |
| EXTENDS | 原核心成立，增加有据且兼容的新维度/结构/范围，不显著缩小旧范围 | 说明新增哪一项；并非所有“新内容”都扩展 |
| QUALIFIES | 核心保留，但需要条件/例外/范围限定 | 指明收窄处；不把核心机制改变称仅限定 |
| REVISES | 足够依据使实质含义、主机制或中心解释需要改变，有可说明的新判断 | 说明改哪项、为何依据足够；不默认新方获胜 |
| CONTRADICTS | 可比条件下出现不相容命题/证据，裁决未完成或须保留冲突 | 冲突成立不自动证明任一方真实，不自动覆盖旧判断 |
| NO_MATERIAL_CHANGE | 同源重复、无相关增量，或证据尚不足改变旧判断 | 分开“已无增量”与“未能判定”；缺证据不意味着旧判断被验证 |

EXTENDS增加兼容内容；QUALIFIES收窄适用；REVISES改变核心；CONTRADICTS记录不相容但未必已有裁决。若有充分裁决，可先保留冲突的 provenance，再建议REVISES。不同命题可有不同影响，不给整本书一个笼统影响。

Relation 描述来源间特定关系；impact 描述新材料相对于旧命题的增量；promotion 判断是否值得独立对象。三者分别有依据，不能由一个枚举自动推出另外两个。

## Promotion disposition

遵守 CORE 已有晋升门槛，不另建评分/最低来源数。只有任务确需判断时才给：
- PROMOTE_CANDIDATE：清晰独立问题、可复用解释和充分依据，实际超出单源语境或满足 CORE 独立价值；仅建议。若已有对象由Workflow确认，优先建议增量而非新建。
- LINK_ONLY：对象不同且真实关联有复用价值，无需合成独立共同对象；只建议链接用途和依据。
- KEEP_SEPARATE：融合会抹去定义、角色或条件差异，或只共享大主题；可有局部关系，但不合并。
- INSUFFICIENT_EVIDENCE：理解、身份、coverage或证据不足以判断，说明具体缺口。

两个来源不自动达到晋升门槛。历史理论＋现代研究不自动产生新的机制节点。最终匹配、目标、创建/更新和实际验证由 Workflow 决定，Skill不创建文件、修改typed relations或删除旧依据。

## Minimal delivery and final checks

自然正文回答共同问题，保留各源立场、比较允许范围、证据差别、重要分歧、综合及未决。按需附紧凑的 relation（对象/方向/维度/evidence/rationale）、impact（old/new/类别/理由/建议/未决）、promotion（候选对象/主disposition/依据）；不是强制三张表或完整英文标签文章。

交付前检查：证据归属与locator能回查；综合没有加大范围/因果/确定性；关键条件、分歧和谱系仍在；没有无依据关系/晋升；只交候选，无正式写入。问题已充分回答且新材料不改善判断时停止。

## Failure and handoff

| 情况 | 动作与可继续边界 |
| --- | --- |
| source understanding insufficient / source coverage insufficient | HANDOFF_DEEP_READING，提供一个来源的具体定义/语境/论证缺口；可靠局部可继续 |
| sources not comparable / concept definition mismatch | KEEP_SEPARATE / NO_RELATION，解释不能融合；明确局部映射时才类比 |
| provenance missing / quotation cannot be verified | MARK_UNCERTAIN，回查或撤回对应承重项；阻断所依赖结论 |
| evidence type incompatible | 只比较可确认的理论/现象层，不声称验证；必要时HANDOFF_RESEARCH |
| unresolved contradiction / external verification required | 保留双方与未决；HANDOFF_RESEARCH限定问题，不自行寻找第三源 |
| relation confidence insufficient / promotion evidence insufficient | MARK_UNCERTAIN / NO_RELATION / INSUFFICIENT_EVIDENCE，不生成保险链接/节点 |
| request needs merging/creation or exceeds support | STOP_AND_REPORT依赖缺口，交Workflow；独立已确认判断仍可交付 |

未实现或不可用的方法不假称调用，也不自动安装；缺口由宿主在当前授权内编排，不为完成综合扩大基础设施。
