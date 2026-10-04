# Sentinel Farm Simulation

> 转录自用户提供的同名 Word 文档；保留原始设计内容。Phase 2 范围以已确认的实施规格为准。

Product Architecture & Detailed Design Specification v0.1
2026-10-03


## 0. 文档目的

本文档冻结当前产品架构与交互设计，用于团队讨论、后续 UI 设计和工程实现。未明确冻结的数值均应作为 Scenario/Crop Pack 配置，而不是平台硬编码规则。


## 1. 产品定位与原则

- 第一身份：披着游戏外衣的农业模拟与培训平台。
- 长期路径：Game → Simulation/Training → Agent Sandbox/Benchmark → Twin-ready。
- 核心体验参考 Football Manager，而不是 Farming Simulator：管理信息、人员、资源、决策与时间。
- 没有单一总分；反馈以多维结果和世界后果体现。
- 同一底层模块服务不同职业角色，权限、信息颗粒度和责任范围随角色变化。
- Simulation-first, Twin-ready。


## 2. Core Gameplay Loop

Observe → Interpret → Decide / Investigate / Delegate → Execute → Outcome → Review → Learn

每天更新世界和农场状态，生成新的观察、任务和需要处理的决策。玩家可推进时间；达到中断阈值时暂停。Decision 与 Execution 分开：玩家下令不等于任务一定正确执行。


## 3. Career 与组织模型

第一版固定 Farm Manager，但数据模型支持未来 Worker / Specialist / Agronomist / Supervisor / Farm Manager / Owner / Multi-farm Operator。
角色由 Role + Permissions + DecisionScope + InformationAccess + ReportingLine + DefaultView 定义。

关键人员：姓名、头像、技能、经验、性格、风险偏好、置信度校准、汇报关系、Belief State。
普通劳动力：按 Crew 管理，记录人数、熟练度、出勤率、生产率和缺勤风险。
机器、机器人、人力统一进入可排程 Resource；库存型资源与 capacity resource 在 schema 区分。


## 4. Farm / Production Architecture

World → Farm → ProductionUnit → CropInstance → Operations / Resources → Outcomes

基础空间对象必须是 ProductionUnit，而不是 Field。支持 open field、substrate zone、greenhouse compartment、orchard block、nursery zone、plant factory zone。

Production Unit：
- geometry、centroid、cluster、面积、自然属性、基础设施、环境控制水平。
- 空间关系影响 travel overhead、设备调度和 Manager Attention。
- 信息状态独立于真实状态：地图只显示玩家当前知道的内容。


## 5. Crop Pack

Crop 是插件/配置，不是源代码 feature。
Blueberry Crop Pack v0.1 含 3 个 variety。
配置包括 identity、stages、state variables、operations、risks、economics、varieties。
Variety 至少影响 maturity timing、water sensitivity、yield potential、quality potential、market value。
后续可增加 crop model adapter（WOFOST/LINTUL/DSSAT/PCSE）。


## 6. Simulation Architecture

- 最小 step = 1 day。
- Scenario 定义 startDate/endDate；28 天只是首个内容包。
- 所有随机性必须经过 RandomEngine(seed)。
- 事件采用 eligible window + conditions + probability + modifiers。
- Research/benchmark 可固定 seed，Sandbox 可换 seed。

Daily tick：
1 Update World
2 Update Production Units / Crops
3 Update Resources
4 Evaluate Event Rules
5 Generate Observations
6 Update Beliefs
7 Generate Tasks / DecisionCases
8 Execute Operations
9 Resolve Outcomes
10 Update Finance
11 Write Audit / History


## 7. True / Observed / Belief

True State：simulation 内部真实状态，不直接展示。
Observation：来源在某时刻可获得的信息，包含 uncertainty、coverage、observedAt、availableAt、freshness、reliability。
Belief State：某个 NPC/Agent 基于 Observations 对隐藏状态的主观估计。

关键规则：
- observedAt 和 availableAt 必须分开。
- replay 不得泄漏未来信息。
- Observation 可 stale，而 True State 可以继续变化。
- 多个角色可以根据同一证据形成不同 belief。


## 8. Active Investigation / Manager Attention

Visit/Inspect、复测、问工人、无人机、实验室、第二意见都是信息获取动作。
调查消耗 Attention、时间、人力、资金或 lead time。
Manager Attention 是正式资源。


## 9. Decision Architecture

Event → Observation(s) → Belief updates → DecisionCase? → Action → Operation(s) → Outcome(s)

Decision Workspace：
1 Question / impact / deadline
2 Current Situation
3 Views & Debate
4 Action Options + Custom Decision
5 Gather information / Delegate / Delay / Take no action
6 Opportunity Cost
7 Reason tags / research-mode free text
8 Decision Log / later outcome / retrospective attribution

Delegation：
Routine / Supervised / Approval / Executive

Agent modes：
Shadow / Advisor / Delegate / Autonomous Manager


## 10. Operations / Workforce

- 可切 By Production Unit / Crew / Equipment / Task Type，默认 Production Unit。
- 默认 capacity = 0.25 / 0.5 / 0.75 / 1.0 day。
- Planned vs Actual 上下对照。
- 成本默认 Quick Panel，可由设置选择隐藏/汇总/详细。
- 冲突直接标记，可 Manual Resolve / Auto-reschedule / Hire temporary labor / Delay。
- travel overhead 默认折叠查看。


## 11. UI Architecture

视觉方向：John Deere Operations Center 风格的干净专业数据界面 + 游戏化地图状态、时间推进、事件和人物。

一级导航：
Map | Today | Operations | Units | Decisions | Management

Management：
People / Finance / Resources & Inventory / Machines & Automation / Market & Contracts / Agents / Research / Reports

Farm Map：
- schematic GIS；淡化底图，PU 视觉优先。
- polygon 支持真实简化、多边形、四边形或六边形。
- 默认显示 crop icon、stage icon、known risk。
- stale：最后已知状态 + 灰雾 + last observed。
- zoom-dependent clustering。
- overlays：Water / Disease / Yield / Labor / Profit / Tasks / Equipment。
- Click PU → Quick Panel：Crop/Stage → Today Status → Latest Observation → Top Risk → Today Operations → Visit/Inspect。

HUD：
Top：Cash | Labor Available | Critical Resource | Manager Attention
Right：Daily Status + Queue
Bottom：time controls + known 7–14 day timeline nodes
My Focus：系统推荐约 3 条，玩家可 pin/unpin。


## 12. MVP Scenario v0.1

Name: Yunnan Blueberry – Dry Season Pressure
Duration: 28 days, configurable
Farm: 1 farm / 3 clusters / 12 Production Units
Crop: Blueberry Crop Pack v0.1 / 3 varieties
Player: Farm Manager
Key staff: Agronomist, Irrigation Manager, Field Supervisor, Maintenance Lead + Sentinel Agent
Critical resource: Water
Finance: Cash + forecast revenue + operating cost + emergency purchase
Outcome dimensions: Financial position; Crop condition/expected production; Water efficiency; Operational reliability; Decision & audit quality

事件节奏：
Day 1–4 normal operations + small observation conflict
Day 5–9 sensor / irrigation anomaly
Day 10–14 labor / operations disruption
Day 15–21 water pressure escalates
Day 22–27 pre-harvest trade-off
Day 28 Management Review
注意：事件通过窗口/条件/概率触发，不是固定剧本。


## 13. Data Model v0.1

Scenario：start/end, step, seed, playerRole, farmConfig, cropPacks, criticalResources, eventRules, difficulty, endConditions, evaluationDimensions
WorldState：date, weather, market signals, policy/external conditions
Farm：finance, people, resources, Production Units, shared infrastructure
ProductionUnit：type, cluster, geometry, centroid, area, naturalProperties, infrastructure, controlLevel, cropInstances, observation status
CropInstance：cropPack, variety, stage, trueState, harvest window, management history
Person：role, reportsTo, skills, traits, riskPreference, permissions, workload, beliefs
Resource：type, capacity/quantity, availability, compatibility, location, reliability, cost, status
Observation：source, variable, value, uncertainty, coverage, observedAt, availableAt, freshness/reliability
BeliefState：actor, subject, estimate/probability, confidence, source observations
DecisionCase：question, deadline, evidence, viewpoints, disagreements, options, reason, delegation, opportunity cost, operations, outcomes, attribution
Operation：type, source, PU targets, planned/actual timing/resources/output, travel overhead, deviations, cost/status
FinanceState：cash, forecast revenue, operating cost, emergency purchases; full accounting later


## 14. Existing Repository Mapping

Repository: BigBigBigLeo/Sentinel_Demo
Stack: React 19 + Vite + React Router + Zustand + Recharts

REUSE: React/Vite/Router
REFACTOR: Zustand store into domain slices over time
REFACTOR: simulationEngine.js → configurable deterministic simulation
REFACTOR: scenarioEngine.js → Scenario Config + Event Rules
EXTEND: decisionEngine.js → DecisionCase / Belief
EXTEND: executionEngine.js → Operations engine
REUSE+EXTEND: auditEngine.js → Decision Trace / Review
EXTEND: thinkingEngine.js → NPC/Agent views & bounded debate
REFACTOR: crops.js → Crop Pack system
REFACTOR: Dashboard → Map/Today
REFACTOR: Prescription → Decision Workspace
EXTEND: Execution → Operations / Plan vs Actual
REUSE: Audit/History → Decision Log / Management Review
NEW: Farm Map
NEW: True/Observed/Belief
NEW: seeded randomness


## 15. Engineering Constraints

- Scenario 时长、Crop 数量、PU 数量、Critical Resource 不得硬编码。
- 新模拟代码禁止直接 Math.random()。
- replay 只能展示当时 available 的 Observation。
- True State 不直接暴露。
- 迁移期间保持现有 Demo 可 build。
- 第一版不引入不必要后端。
