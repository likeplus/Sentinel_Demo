# Sentinel 农场决策模拟平台

> 转录自用户提供的同名 Word 文档；保留原始设计内容。Phase 2 范围以已确认的实施规格为准。

Stakeholder Overview v0.1
2026-10-03


## 1. 一句话概述

我们计划把现有 Sentinel Decision OS Demo 扩展成一个“披着经营游戏外衣的农业决策模拟与培训平台”。玩家像 Football Manager 一样管理农场，不需要亲手完成所有农业操作，而是在信息不完整、资源有限、人员意见冲突和未来不确定的情况下做经营与农艺决策。

长期方向
Game → Simulation & Training Platform → Agent Sandbox / Benchmark → Digital Twin-ready。
第一阶段先做一个可玩的 28 天云南蓝莓管理场景，但底层从一开始就支持扩展到完整生产季、多作物、多农场和长期 Career。

同类产品与差异化
现有相近产品分属不同赛道：FarmGym（Inria）是面向强化学习研究的可配置农业环境，可模拟天气、土壤、作物及观察与干预，但不是面向人的经营游戏；Steam 上 Farm Manager World 等侧重农场经营、生产链和资源调度，Farming Simulator 侧重亲自操作农机完成生产；CropSmart、AGRIVI、AGRY、AgroMatrix 等 APP 主要服务现实农场管理，CropForge、Smart Droplets、AgriTwin 更接近模拟或数字孪生技术组件，SEGAE/QUEEN 偏教学科研。Sentinel Farm Simulation 借鉴经营游戏的时间推进和农场管理界面，核心是让玩家扮演 Farm Manager，在信息不完整或滞后、人员与 Agent 观点不一、时间和资源受限时，选择调查、行动、委派或等待，并追踪计划与实际执行的差异；系统通过作物、财务、资源、运营和决策审计等多维后果支持复盘。由此，Sentinel 定位为面向人的农业决策训练与可重复仿真平台，并支持人类/Agent 决策评测，为后续 Agent Sandbox/Benchmark 和数字孪生衔接预留基础。

## 2. 为什么要这样改

现有 Sentinel 已经展示了“感知—推理—处方—执行—审计”的闭环，但目前更接近技术能力展示。下一步需要把技术能力变成一个可以反复体验、比较决策、积累行为数据的交互系统。

核心目标：
- 把 AI 农艺师、传感器、人员、设备和执行链从“演示组件”变成真正相互影响的经营系统。
- 让使用者在安全环境中练习干旱、灌溉、病虫害、劳动力短缺、设备故障等高风险决策。
- 完整记录“当时看到了什么、谁持什么观点、为什么做这个决定、最后怎么执行、结果如何”。
- 为未来的人类 vs Agent 对照、Agent 训练/评估、Scenario research 和 Digital Twin 接入建立共同底座。


## 3. 用户会怎么玩

第一版玩家固定扮演 Farm Manager。农场由多个 Production Units 组成，每天推进时间、查看地图和状态、处理任务、分配人力/设备、听取农艺师和 Sentinel Agent 的意见，并决定是否行动、继续调查、委派或等待。

核心体验：
- 地图是主界面：看到作物、阶段、已知风险和信息新鲜度；过期信息通过灰雾和 stale 状态表达。
- 重要决策进入 Decision Workspace：先看到问题，再看证据、NPC/Agent 观点、可选行动与机会成本。
- Operations 页面展示 Planned vs Actual，统一管理 Crew、关键员工、机器和机器人。
- Manager Attention 有限，因此玩家不能亲自调查所有问题，必须学会建立可靠的信息与委派系统。
- 系统不提供唯一“正确答案”；结果通过财务、作物状态、资源效率、运营可靠性和决策审计等多个维度反馈。


## 4. 第一版 MVP

Scenario：Yunnan Blueberry – Dry Season Pressure
时长：28 个游戏日；引擎必须同时支持 14/28/90 天、完整生产季和长期 Career。
空间：1 个农场，3 个 cluster，12 个 Production Units。
作物：Blueberry Crop Pack v0.1，3 个 variety。
玩家：Farm Manager。
下属模块：Agronomist、Irrigation Manager、Field Supervisor、Maintenance Lead、Crews，并预留 Sentinel Agent。
关键资源：Water，但 Critical Resource 必须做成 Scenario 配置。
财务：Cash + forecast revenue + operating cost + emergency purchase。
核心事件：灌溉/观测冲突、传感器或阀门异常、劳动力缺口、缺水升级、采前资源权衡。


## 5. 能给项目带来什么

- 产品表达更清楚：从“AI + Robot 能做什么”转向“管理者如何用它做更好的决策”。
- 更适合客户、投资人、研究者和团队成员快速理解 Sentinel 的闭环价值。
- 可以作为培训和演示产品：同一个 Scenario 可反复运行，并比较不同人/Agent 的决策轨迹。
- 积累 Decision Trace：场景、证据、观点、理由、决策、执行、结果和事后归因。
- 为 Agent Sandbox 打基础：测试 Agent 何时应自动处理，何时应请求人类介入。
- 与现实 Sentinel 保持一致：Look → Think → Act → Prove，只是先在模拟世界中安全训练和验证。


## 6. 与现有代码的关系

不会另起炉灶。现有 GitHub repository 已经包含 React/Vite/Zustand、simulation、scenario、decision、execution、audit 和 agent workflow。新的工作重点是把“固定脚本 Demo”重构成“可配置、可复现、可扩展的模拟系统”。

保留：React/Vite/Router、Zustand、核心执行与审计思路。
重构：60 天硬编码 simulation、Field 模型、Crop 定义、Scenario 脚本。
新增：Production Unit、Resource、Observation / Belief、DecisionCase、Operations、seeded randomness、Farm Map。

Repository: https://github.com/BigBigBigLeo/Sentinel_Demo
Current demo: https://sentinel-one-omega.vercel.app


## 7. 第一阶段成功标准

1) 不破坏现有 Sentinel Demo 的 build 和基本页面。
2) 28 天蓝莓 Scenario 通过配置创建，而不是把 28 写死在引擎中。
3) 12 个 Production Units、3 个蓝莓品种、关键人员和资源进入统一 Simulation State。
4) 相同 seed 可复现相同天气、事件和随机结果。
5) 至少跑通一次 Observation → Decision → Operation → Outcome → Audit/Review。
6) 为 Farm Map、Operations、Decision Workspace 留下清晰组件和数据接口。


## 8. 目前不做什么

MVP 不追求完整 ERP、全套会计、精细分钟级排班、真实遥感/GIS、复杂 3D 农场或完整 Digital Twin。第一目标是验证“农业经营决策是否可以被做成有趣、可信、可扩展的交互循环”。
