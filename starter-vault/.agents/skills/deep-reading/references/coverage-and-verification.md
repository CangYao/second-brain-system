# Coverage and verification

## Actual coverage

覆盖针对明确来源身份、版本与范围，描述实际读取，而非文件拥有量、理解正确性或证据质量。按需记录：source/version；coverage basis（整书、全文、章节或明确节选）；read units + locator；未读/不可读/质量缺口；对当前问题的影响。不创建永久 ledger。

| 等级 | 最小条件 | 报告边界 |
| --- | --- | --- |
| FULL | 指定范围内全部实质内容实际读过；影响理解的图表/附录没有未说明缺口 | 明说“该节选/该章/该版本正文”；不能从节选升级整书 |
| SUBSTANTIAL | 读过主要部分与承重单元，但仍有明确未读或质量缺口；有实际范围依据 | “主要相关部分”，不暗示完整阅读全文 |
| PARTIAL | 一组有上下文的局部单元，不能支持来源整体解释 | 限定到所读部分，不总结未读章 |
| FRAGMENT | 零散句子、截图片段、摘要或缺少上下文的片段 | 局部释义/待核验线索，不恢复完整论证 |

未知总量不计算百分比；无法读取任何正文时记录不可读，不伪标 FRAGMENT。逐单元可用 READ / PARTIAL / UNREAD / UNAVAILABLE；它们不取代来源总体等级。目录用于导航，摘要/二手转述描述的是该摘要/转述的覆盖，不算原书正文已读。

全文存在仍可能只读 PARTIAL。读完所提供节选时分别说明“节选 FULL；整书 PARTIAL/FRAGMENT”。缺口不必全部抄进正文，但会影响核心判断的必须显式说明。扩大阅读只为解决当前问题，不能为了得到 FULL 读取无关部分。

## Verification loop

在来源可用时回到原段并检查上下文，不用先前笔记或模型记忆代替：

- 所有直接引语逐字回查；省略、繁简转写与自译清楚说明。原文句子与解释不得拼成一个引语。
- 所有承重转述核对对象、条件、否定、量词、因果、时间及主张强度。变更这些要素会改变解释时补读相邻单元。
- 核对多义词、反讽/叙事说话者、版本/译词、数字与关键图表。两个版本不能静默拼接成同一原文。
- Locator 优先实际章/讲/页/段/行或原文锚点；PDF文件页和印刷页分开。页码未知不编造，以实际段落/章和检索短句定位。
- 中文/繁简/短引文不能依赖仅保留英文字符、限定空白分词数的机械规则。脚本退出0、checked=0或文件存在都不证明核验完成。

支持状态只对具体陈述/核验维度适用：VERIFIED＝指定原句/转述/来源报告核验通过；PARTIAL＝部分依据或关键条件未明；UNVERIFIED＝未能核验。VERIFIED 引文不意味着理论已证实、事实已独立复现或解释唯一。

输出前再次核对承重结论及压缩影响。核验失败先修订/收窄或撤回相应句子，再交付；不能只在文末加一句材料有限而保留确定性断言。

## Failure decisions

| 情况 | 动作 | 停止点 |
| --- | --- | --- |
| material incomplete | MARK_GAP；在授权内必要时 CONTINUE_READING | 整体结论依赖未取得部分时 STOP_AND_REPORT 相应缺口 |
| extraction unreliable / OCR unreliable | RECHECK_SOURCE，可用原页/图像/可靠文本 | 关键否定、数值、术语不清时不推断；不安装依赖 |
| quote cannot be relocated | RECHECK_SOURCE；不能验证则不用确定引语 | 确认了语义才可转述，否则标未核验或撤回 |
| critical section unread | CONTINUE_READING，或 MARK_GAP | 不以目录补全正文，不宣称整体解释 |
| conflicting editions | 分别记录版本并 RECHECK_SOURCE | 差异影响结论且不能确认时停止唯一断言 |
| insufficient evidence | LOWER_CONFIDENCE，限定为作者主张/一种解释 | 无依据则撤回；不靠“可能”使猜测成为可用证据 |
| external verification required | HANDOFF_RESEARCH，经宿主交 codex-research | 不主动检索，不用记忆充当外部验证 |
| request exceeds source support | MARK_GAP / STOP_AND_REPORT | 可继续独立有据部分，不补造全文或共识 |

LOWER_CONFIDENCE 表示降低断言强度/确定性，不强制生成数值confidence或改Properties。只重试具体有意义的回查，不无限循环；任务失败与工具/访问故障分别报告。
