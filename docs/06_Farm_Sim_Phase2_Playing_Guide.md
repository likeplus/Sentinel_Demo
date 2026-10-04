# Phase 2 — Farm Manager 网页试玩与架构

本阶段新增 `/game`，保留九条原 Demo 路由。默认是云南蓝莓 28 天管理训练：一个农场、三个分区、十二个 Production Unit、三个蓝莓品种。数量、日期、资源及品种来自配置。

## Windows 如何打开新版本

1. 获取 `feature/farm-sim-phase2` 分支。此前下载的 `feature/farm-sim-mvp` ZIP 不会自动更新。
2. 解压新 ZIP，在新文件夹的资源管理器地址栏输入 `cmd`，打开终端。
3. 执行 `npm ci`，完成后执行 `npm run dev`。Node 建议使用 24 LTS。
4. 浏览器打开新终端打印的 Local 地址，并在后面加 `/game`，通常为 `http://localhost:5173/game`。
5. 保持开发服务器终端运行。其他命令需要另开终端。如果旧服务器占用 5173，使用新终端实际打印的端口。

若安装只因 Puppeteer 浏览器下载失败，可在 CMD 中先执行 `set PUPPETEER_SKIP_DOWNLOAD=true`，再执行 `npm ci`。网页试玩和 Vitest 不依赖这个下载；自动浏览器验收另需已安装的 Chrome/Chromium。

## 建议的第一轮试玩

- 在地图上选择 PU-03；再比较 PU-05 的过期水分信息与 PU-09 的未知信息。阶段报告与水分报告的新鲜度独立计算。
- 安排一次现场检查。确认后产生计划，推进一天执行，再推进一天等待报告送达，不能立即看到结果。
- 查看今日工作与决策中心。PU-03 的传感器和现场人员可能意见不一致，实验室报告晚于采样日期送达。
- 选择农艺师作为汇报对象并记录理由。次日收到基于证据的建议后，批准或拒绝；未经批准不会自动创建执行作业。
- 安排多个作业，观察班组或设备超容量时的提示。被拒绝的操作不扣 Attention、不留预约；可更换日期重试。
- 设备异常时比较维修与人工补水；在 Operations 中核对计划与实际、延迟、费用和移动开销。
- 在经营管理中查看现金、预计收入、成本与流水。应急补水需要显式确认，确认面板展示单价、总价和数量限制；不会自动透支购买。
- 完成 28 次每日推进，在经营管理查看五个维度和决策审计。证据、人员观点及理由按行动当时保存，后来报告不会改写当时记录。

默认开始状态索引为 0，日期 2026-03-01；一次点击只推进一个日历日。28 次推进后索引 28，日期 2026-03-29，按钮停止。终点为配置日期，不是实时系统日期。

开场观测冲突保留 Phase 1 的配置日期引导；设备异常、劳动力变化、缺水与采收前事件采用窗口/条件/概率。默认验收 seed 会出现三个完整决策节点，其他 seed 不保证同一天发生同一事件。

## 六个视图

| 视图 | 用途 |
| --- | --- |
| Map | 基于 geometry 绘制 PU；分区/品种筛选，水分、作业、信息新鲜度图层；缩放与分区聚合 |
| Today | 待处理问题、今天送达的报告与已知作业安排 |
| Operations | 按 PU 筛选作业、计划与实际对照、资源冲突和手动改期 |
| Units | 按单元查看品种、已知阶段、风险、报告和关联决策 |
| Decisions | 问题、证据、人员观点、行动方案、机会成本、理由与审批 |
| Management | 团队、库存、经营账目、应急补水、存档/重开与结束复盘 |

底部时间线只列出未来两周已经知道的作业、复查/汇报日期、决策期限及配置的预期采收窗口，不展示未来事件或未送达报告。

## 存档、重开与复现

在此浏览器内自动保存；刷新恢复游戏进度、视图与选中 PU。重开对话框明确提示将替换本轮存档，可选择相同 seed、指定新 seed 和时长。相同 seed 的复现要求内容版本及有序玩家输入相同。

引擎 checkpoint 是内部恢复数据，包含隐藏状态。`GameController` 私有持有引擎，React 只订阅 `getPlayerView()` 与安全投影视图。存档将历史视图中的重复观测去重编码，恢复时展开，保留历史知识边界。

保存使用 `sentinel:farm-game:save:v1`；界面偏好另存 `sentinel:farm-game:ui:v1`。不兼容/损坏存档保留原值，玩家勾选确认并开始新的一轮后才覆盖。存储配额不足时继续允许试玩，明确提示刷新可能丢失进度。

## 数据和组件接口

| 模块 | 职责 |
| --- | --- |
| `src/game/GameController.js` | 引擎私有会话、动作接口、订阅快照、恢复和自动保存 |
| `src/game/selectors.js` | 从公开证据/Belief 形成每个 PU 的阶段、水分、新鲜度、风险与五维复盘 |
| `src/game/persistence.js` | 存档版本检查及历史观测去重/展开 |
| `src/game/FarmMap.jsx` / `mapGeometry.js` | 动态 SVG 几何、选择、筛选与聚合；不读取 checkpoint |
| `src/game/GameApp.jsx` | 六个视图、操作表单、日推进、确认与错误反馈 |
| `src/simulation/SimulationEngine.js` | Attention、审批式委派、原子排程/改期/采购、执行、报告和审计 |
| `src/scenarios/yunnan-blueberry-28d/` | 可配置预算、成本、汇报时延、采购和三个决策节点 |

Attention 默认每天 4 点；接受调查、即时决策、委派、批准等配置行动后扣除，推进一天恢复。配置可调整。末日无法完成汇报或审批的行动提前拒绝；延期复查与错过期限保留记录，不生成唯一“正确答案”。

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

已验证 Linux Chromium 的网页行为；本阶段 Windows 新 UI 的人工试玩仍需在用户机器执行。长时段会扩大历史存档，配额不足提示不等于状态丢失已被解决。详见 `docs/validation/phase2-results.md`。
