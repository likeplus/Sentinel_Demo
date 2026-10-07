# Phase 2 — Farm Manager 网页试玩与架构

本阶段新增 `/game`，保留九条原 Demo 路由。默认是云南蓝莓 28 天管理训练：一个农场、三个分区、十二个 Production Unit、三个蓝莓品种。数量、日期、资源及品种来自配置。

## Windows 如何打开新版本

1. 获取整合分支 `feature/phase2-feedback`（基于已完成的 `feature/farm-sim-phase2`）。此前下载的 `feature/farm-sim-mvp` ZIP 不会自动更新。
2. 解压新 ZIP，在新文件夹的资源管理器地址栏输入 `cmd`，打开终端。
3. 执行 `npm ci`，完成后执行 `npm run dev`。Node 建议使用 24 LTS。
4. 浏览器打开新终端打印的 Local 地址，并在后面加 `/game`，通常为 `http://localhost:5173/game`。
5. 保持开发服务器终端运行。其他命令需要另开终端。如果旧服务器占用 5173，使用新终端实际打印的端口。

若安装只因 Puppeteer 浏览器下载失败，可在 CMD 中先执行 `set PUPPETEER_SKIP_DOWNLOAD=true`，再执行 `npm ci`。网页试玩和 Vitest 不依赖这个下载；自动浏览器验收另需已安装的 Chrome/Chromium。

## 建议的第一轮试玩（反馈整合版）

- 新游戏阅读简短引导。默认 Table View 分开显示水分、作物、可信度、新鲜度、设备、传感器和最新观测；点击单元查看详情与阶段指南。
- 切到 Spatial View 体验原 Phase 2 地图、筛选、缩放、分区聚合及键盘选择。Water / Crop / Freshness / Equipment 可同时显示，不合成总分。
- 在 Operations 选择 Today，安排 Field Inspection，可附加 Manual Watering、Spraying、Repair、Sensor Relocation。表单实时显示总 Labor、Attention、库存和选定日期容量；未来任务也使用相同资源检查。
- 同单元、同日期、同 Action 不可重复（经理/班组巡查属于同一种 Inspection）。重复提示提供 View / Reschedule / Cancel。未执行任务取消后释放预约，不产生观测。
- 点击“开始 Execution”执行今天任务，日期保持不变。查看 Today 的作物与设备巡查、作业结果和补水预计影响；新问题留到第二天早会处理。
- 点击“进入 End of Day”复盘，再点击“Next Morning”，日期前进一天，天气、ET、生长阶段和设备影响进入正式更新。传感器更新水分 Freshness，不能代替作物巡查。
- 早会固定消耗 1 Attention；普通安排不额外扣除。复杂经理判断进入时消耗 1，经理亲自巡查预留 2、Labor 0、巡查置信度 100%；额外现场工作正常消耗 Labor。
- Attention 用完仍可安排普通任务，复杂问题可 Delegate to Team / AI Assistant。AI 仅 Accept / Reject，接受不扣 Attention；建议和记录含当时可见信息、自动 rationale、confidence、关联作业和最终结果。
- 原 Phase 2 的问题、人员观点、延迟实验室报告与下属审批流程继续保留。默认开场数据保留 unknown / stale；没有证据不会读取隐藏作物状态。
- 经营管理继续提供现金、预计收入、成本、资金流水、显式确认的应急采购、seed/时长重开和五维季末复盘。

默认索引 0、2026-03-01 开始；每个游戏日有三个阶段按钮，不再一次点击跨过一整天。28 个循环后在 2026-03-29 结束，最后可安排任务日期是 2026-03-28。

资源示例：巡查 Labor 1，人工补水 Labor 2，因此组合为 Labor 3；喷施、维修、迁移各 Labor 1。班组完整日容量换算为 8 Labor；原场景方案的半天作业仍占 4 Labor。数值是可调整的 Demo 参数。

## 六个视图

| 视图 | 用途 |
| --- | --- |
| Farm Overview | 默认状态表；Spatial View 保留动态 geometry、筛选、缩放、分区聚合，新增多状态图层 |
| Today | 阶段、昨日/今日反馈、预计水分影响、待处理问题、送达报告与水分趋势 |
| Operations | 组合任务、未来容量、传感器分布、观察日历/作业排程、取消与改期、计划/实际/费用 |
| Units | 按单元查看品种、已知阶段、风险、报告和关联决策 |
| Decisions | 问题、证据、人员观点、行动方案、机会成本、理由与审批 |
| Management | 团队、库存、经营账目、应急补水、存档/重开与结束复盘 |

底部时间线只列出未来两周已经知道的作业、复查/汇报日期、决策期限及配置的预期采收窗口，不展示未来事件或未送达报告。

## 存档、重开与复现

在此浏览器内自动保存；刷新恢复游戏进度、视图与选中 PU。重开对话框明确提示将替换本轮存档，可选择相同 seed、指定新 seed 和时长。相同 seed 的复现要求内容版本及有序玩家输入相同。

引擎 checkpoint 是内部恢复数据，包含隐藏状态。`GameController` 私有持有引擎，React 只订阅 `getPlayerView()` 与安全投影视图。存档将历史视图中的重复观测去重编码，恢复时展开，保留历史知识边界。

内容版本更新为 `farm-sim-phase2-feedback-v2`；旧内容存档不会被静默套用新规则，明确提示并保留原值。保存仍使用 `sentinel:farm-game:save:v1`；界面偏好另存 `sentinel:farm-game:ui:v1`。不兼容/损坏存档保留原值，玩家勾选确认并开始新的一轮后才覆盖。存储配额不足时继续允许试玩，明确提示刷新可能丢失进度。

## 数据和组件接口

| 模块 | 职责 |
| --- | --- |
| `src/game/GameController.js` | 引擎私有会话、动作接口、订阅快照、恢复和自动保存 |
| `src/game/selectors.js` | 从公开证据/Belief 形成每个 PU 的阶段、水分、新鲜度、风险与五维复盘 |
| `src/game/persistence.js` | 存档版本检查及历史观测去重/展开 |
| `src/game/FarmMap.jsx` / `mapGeometry.js` | 动态 SVG 几何、选择、筛选与聚合；不读取 checkpoint |
| `src/game/GameApp.jsx` | 六个视图、操作表单、日推进、确认与错误反馈 |
| `src/simulation/FarmManagement.js` | Phase 2 统一状态中的阶段、组合任务、信息/资源、传感器与反馈规则 |
| `src/game/FeedbackViews.jsx` | 新状态表、任务表单、日历、趋势、指南和决策历史 |
| `src/simulation/SimulationEngine.js` | Attention、审批式委派、原子排程/改期/采购、执行、报告和审计 |
| `src/scenarios/yunnan-blueberry-28d/` | 可配置预算、成本、汇报时延、采购和三个决策节点 |

反馈版 Attention 默认每天 4 点，早会固定扣 1；复杂经理判断扣 1、经理巡查扣 2，普通排程、委派和接受建议不另扣。旧引擎接口在未启用 feedback 配置时保留原行为，以便 Phase 0/1/2 回归与工具兼容；实际 `/game` 明确启用反馈版。末日无法完成汇报或审批的行动提前拒绝；延期复查与错过期限保留记录，不生成唯一“正确答案”。

分类阶段报告仅允许指定阶段值，不进入数值 Belief。水分风险来自玩家可用证据的估计，没有证据保持 unknown，过期证据保留最后已知值及 stale。

## 验证与当前边界

```sh
npm test
npm run build
npm run lint:baseline
# 先启动 dev 或 preview 服务
npm run test:game
npm run test:routes
```

自动浏览器脚本默认使用 `/usr/bin/chromium`，可由 `PUPPETEER_EXECUTABLE_PATH` 指定；`SMOKE_BASE_URL` 指定已有服务地址。Windows 示例：

```bat
set PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
set SMOKE_OUTPUT_DIR=E:\Sentinel-Game-QA
npm run test:game
```

参数和阈值为训练示例；预计收入未实现，成本含作业与应急采购，不是完整会计。NPC/Sentinel 建议由本地确定性规则生成。完整职业、Agent 模式、GIS、市场合同、后台和科学校准仍在后续范围。

已验证 Linux Chromium 的网页行为；本阶段 Windows 新 UI 的人工试玩仍需在用户机器执行。长时段会扩大历史存档，配额不足提示不等于状态丢失已被解决。原验收见 `docs/validation/phase2-results.md`，反馈整合验收见 `docs/validation/phase2-feedback-results.md`。


## 界面语言与新手资料

顶栏 EN / 中文随时切换，刷新后保留，与原演示应用共用语言选择。切换或阅读资料不消耗资源、不推进日期。

左侧“玩法简介”按卡片说明每天六步操作、早会窗口、劳动力与经理注意力、观测可信度与新鲜度、组合任务、委派以及故障/陈旧信息/容量冲突等常见情境。“作物知识”是作物百科；当前包含蓝莓特性、六个生长周期阶段、成本与季节供给、品质渠道、鲜果物流和知识在当前试玩中的应用。

右侧单元面板优先显示当前状态与信息质量；展开“信息依据与观测”查看来源和巡查详情，查看待执行任务，再用“安排任务”进入完整排程。“复杂判断与委派”按需展开，成功生成建议后进入决策中心审批。

新增玩法模块请扩展 `src/game/content/gameplayGuide.js`；新作物请在 `src/game/content/cropKnowledge.js` 用作物包 ID 注册双语章节/阶段/卡片。页面共用 `GuideViews.jsx` 渲染。百科中的市场与多年生知识不自动开启价格、物流或多年树龄模拟。

双语与新入口自动验收：`npm run test:game:locale`。六个关键视图的完整中文截图见 `docs/validation/screenshots/latest/`。
