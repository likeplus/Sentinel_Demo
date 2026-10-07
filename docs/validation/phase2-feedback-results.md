# Phase 2 试玩反馈整合验收

## 基础与保留范围

本次直接基于 `feature/farm-sim-phase2` 的 `367138d6f2aa30ff5314e7ba66136a1c9288c648`，工作分支为 `feature/phase2-feedback`。未将 Phase 0/1 的独立补丁作为基础覆盖 Phase 2。原独立实现已备份到 `/workspace/scratch/farm-feedback-before-phase2.zip` 与 git stash。

保留 `/game` 原六个经营视图、12 单元/3 分区/3 品种的动态几何、筛选/缩放/分区聚合/键盘选择、原问题与人员观点、延迟报告、委派后审批、费用/流水/现金/预计收入、显式采购、seed/时长重开、版本化存档和五维季末复盘。原九条 Demo 路由继续可用。

所有反馈规则接入同一个 SimulationEngine、operations、outcomes、财务与存档。React 仅接收公开 player view；未知阶段/水分不从隐藏作物状态填充。未启用 feedback 配置的旧引擎调用保持兼容；实际 `/game` 明确启用反馈配置。

## 已整合规则

| 规则 | 实现与验收 |
| --- | --- |
| 引导 / 日循环 | 新游戏简短引导；Morning Meeting → Execution → End of Day → Next Morning；执行后锁定排程 |
| Attention | 早会 −1，普通排程 0，复杂经理判断 −1，经理巡查 −2 / Labor 0 / 巡查 confidence 100%；零 Attention 可继续安排与委派 |
| Today / Future | 当天与未来排程；每个选定日期显示 Labor、已占用、剩余、Attention、水库存与冲突 |
| 巡查与动作 | Crop + Equipment 共同报告；巡查可组合人工补水、喷施、维修与迁移；单独系统灌溉与人工补水 |
| 唯一性 / 取消 | Unit + Date + Action（含组合、经理/班组巡查别名）去重；View / Reschedule / Cancel；原子改期；取消释放预约且不产生观测 |
| Water Stress | 四级颜色、估计、source、confidence、freshness、uncertainty range、关联作业；当天预计影响，次日结合世界/设备/观测正式更新；趋势支持所有/单个单元 |
| 信息层 | Risk / Confidence / Freshness 分离；部署传感器更新水分新鲜度，作物信息保留独立年龄；未知不绘制为安全值 |
| 设备 / 传感器 | Reliability 与 Current Status 分开；固定/移动类型、位置、状态、更新时间；迁移是耗 Labor 的正式作业 |
| Overview / 日历 | 默认状态表；原空间地图多状态图层；Observation Calendar / Operations Schedule 独立模式及可点击单元格 |
| Crop Guide | 已知阶段、阶段活动、水分/病害敏感度、观察重点与典型优先级 |
| 决策链 | Manager / Team / AI；当时输入、依据、推荐/决定、confidence、关联 Action 和 Result；AI 仅 Accept / Reject；接受免费；经理理由可选 |
| 历史与复盘 | 原审计保留；新增普通任务/复杂判断历史；季末五维复盘计入组合动作、人工用水和 Team/AI 决策 |

## 验证

- `npm test`：109 / 109 通过（原 85 项 + 19 项整合测试 + 5 项语言测试）。
- `npm run build`：通过。原首页大 bundle 警告仍存在。
- `npm run lint:baseline`：通过，无新增诊断；标准 lint 仍有历史 22 errors / 8 warnings。
- `git diff --check`：通过。
- Chromium 实际 `/game`：状态表、原地图几何/筛选/缩放/键盘、多图层、组合任务、重复拦截、取消、传感器迁移、刷新精确恢复、阶段锁定、补水因果反馈、原委派/延迟提案/AI 接受、采购/流水、完整 28 天与五维复盘、移动端和重开均通过；无未捕获浏览器异常。见 [浏览器结果](phase2-feedback-browser.json)。
- 原九路由、语言/地块切换持久化、六个旧场景：通过浏览器回归。

浏览器截图保存在 `docs/validation/screenshots/`。一键复验：`npm run test:acceptance`，需要系统 Chromium（可设置 `PUPPETEER_EXECUTABLE_PATH`），脚本自行启动本地 5190 服务；也可启动 Vite 后运行 `npm run test:game` 与 `npm run test:routes`。

## 参数与边界

普通班组日容量换算为 8 Labor；巡查 1、人工补水 2、灌溉/喷施/维修/迁移各 1。组合巡查加人工补水为 3，可后续平衡。旧场景方案保留其原人员日、资源和费用，并换算成 Labor。

Team/AI 使用本地可复现启发式规则，不是外部 AI 服务；完整职业 progression、统计学习、科学概率模型、更多作物/现场动作仍属 P2。Role → Capabilities 已预留，Manager Inspection 是显式 Demo capability。

反馈内容版本为 `farm-sim-phase2-feedback-v2`。旧/损坏存档保留原字节并显示兼容提示，需要玩家确认重新开始后才覆盖。Windows 本机人工试玩未执行；自动验收环境为 Linux Chromium。


## 界面整理、双语与模块化入门内容

- 顶栏提供 EN / 中文切换，与原 Demo 共用 `sentinel_locale_v1`。只改变展示语言，不改动存档里的观测、任务、理由、资源与时间；玩家自行输入的理由保留原文。
- 单元面板分为状态摘要、信息依据与观测、待执行任务、安排与操作。水分数值与范围、作物状态、设备状态、长期可靠性、可信度与两类新鲜度分别呈现。观测细节和复杂判断默认折叠；任务主按钮和快速巡查对齐，委派成功后进入决策中心。
- 左侧增加玩法简介与作物知识。玩法分每日经营、证据与行动、经营情境；蓝莓百科分特性、生长周期、经营市场、当前试玩应用。
- `src/game/content/gameplayGuide.js` 按模块/卡片扩展玩法；`src/game/content/cropKnowledge.js` 按 CropPack ID 注册作物，每个作物提供独立章节、阶段与卡片。渲染器 `GuideViews.jsx` 自动展示注册内容，无需为新卡片复制页面。
- `npm run test:game:locale` 验证全部八个视图的双语文本，展开观测/历史后的英文输出、实际执行结果与 AI 建议，语言刷新持久化与原 Demo 共享，阅读简介不改变存档，以及手机下总览/两类简介无横向溢出。
- 最新六张截图在 `screenshots/latest/`，来自实际 Chromium 的中文页面；将视口高度扩展到当前页面完整内容，保留导航、顶栏、资源和全部正文，避免只截内部滚动容器的一部分。对应总览、今日、决策、排程、玩法简介、作物知识。
