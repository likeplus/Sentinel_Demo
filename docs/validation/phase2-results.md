# Phase 2 实施与验收记录

日期：2026-10-04（Europe/Amsterdam）。工作分支：`feature/farm-sim-phase2`；基于 PR #1 已合并的 main 提交 `35ba47f5cefbe21e7dfac730aa326e67e17e3c56`。范围是用户确认的 [网页试玩实施规格](../05_Farm_Sim_Phase2_Spec.md)，采用审批式委派和本地自动存档。

## 交付行为

新增 `/game`：玩家以农场地图为入口，选择 Production Unit、安排检查、等待报告、处理决策、委派并批准方案、处理资源冲突和改期、确认应急补水，逐日完成云南蓝莓场景。默认有 12 个 PU、3 个分区、3 个品种；地图和 HUD 从配置生成。重开可选择 seed 和时长。

六个视图覆盖地图、今日工作、作业、单元、决策、经营管理。第 28 次推进在 2026-03-29 停止，展示财务、证据支持的作物预期、水资源、运营可靠性、决策审计五个维度，不合成总分。界面标明实际成本与预计收入，审计保存行动当时的证据、人员观点及理由。

## 改动位置

| 文件 | 内容 |
| --- | --- |
| `src/domain/{decision,observation,operation,scenario}.js` | 分类阶段报告、行动审计、延期/建议、维修效果、Attention/采购配置 |
| `src/simulation/{ObservationEngine,SimulationEngine}.js` | 审批式委派、Attention、延期、现场检查、原子改期/采购、执行期资源变化和存档恢复 |
| `src/scenarios/yunnan-blueberry-28d/` | 中文内容、独立报告新鲜度、观测冲突/设备异常/采收前权衡三个节点、可执行选项及内容参数 |
| `src/game/` | 私有引擎会话、安全数据投影、动态 SVG 地图、六个视图、自动保存/恢复和复盘 |
| `src/App.jsx` / `src/components/Layout.jsx` | 新增懒加载 `/game` 路由与导航入口 |
| `tests/{map-geometry,phase2-content,phase2-engine,phase2-session}.test.js` | 37 项新增验收；原 48 项保留 |
| `scripts/smoke-game.cjs` / `package.json` | 可重复执行的真实浏览器验收及 `test:game` 命令，无新增依赖 |
| `README.md` / `docs/` | Windows 试玩指南、批准的实施范围、设计文档原件及验证记录 |

原 store、旧页面、旧引擎及六个 Demo 场景没有源代码改动。唯一旧界面接线变更是导航和新增路由；`package-lock.json` 无改动。

## 自动化与生产构建验收

使用 Node 24.19.0、npm 11.9.0 和 Linux 系统 Chromium。浏览器检查针对 `npm run build` 生成的生产版本，由 `npm run preview -- --host 0.0.0.0 --port 4173` 提供服务。

| 检查 | 结果及证据 |
| --- | --- |
| `npm test` | **85 项通过，9 个文件**；包含原有 28/120 天时长、seed、延迟观测及容量测试 |
| `npm run build` | 通过，783 个模块；Game JS 懒加载包 127.10 kB（gzip 39.10 kB） |
| `npm run lint:baseline` | 通过，逐项诊断与原基线一致；新增代码零诊断 |
| `git diff --check` | 通过 |
| 地图与不同规模 fixture | 12 PU 完整绘制；分区/品种筛选、图层、键盘选择、缩放聚合通过；3 PU/1 分区 fixture 和负坐标几何通过 |
| 知识边界 | unknown/stale/current 区分；阶段和水分新鲜度独立；改变隐藏真值或未送达报告不改变先前地图投影；页面快照不含 checkpoint/真值 |
| 延迟报告与审批 | 报告送达前不进入 DOM；提出委派不会创建作业；次日建议送达后才能批准并排程；行动记录保留当时观点和证据 |
| Attention 与容量 | 超预算/超容量拒绝无部分扣费或预约；必要库存/设备不能通过改班组绕过；执行期缺勤和故障重新检查；错误显示资源、日期及需求/容量 |
| 改期与财务 | 改期冲突保留原预约，成功改期释放旧预约；确认前无扣款；采购实际双击只有一笔流水，数量和配置单价核对；资金不足拒绝 |
| 自动存档 | 刷新后状态、视图及选中 PU 恢复；恢复后未来结果一致；损坏/不兼容存档不静默覆盖；配额/读取失败提示并允许内存试玩 |
| 存档体积 | 28 天历史观测去重编码与完整 checkpoint 往返一致，测试按 UTF-16 大小小于常见 5 MiB 配额；历史回放仍不提前看报告 |
| 完整浏览器试玩 | 两轮各 28 次推进，默认 seed 的三个决策节点均处理完成；验收玩法产生 7 个作业，最终日期 2026-03-29，终点按钮停止 |
| 浏览器 seed 复现 | 两轮相同 seed 和相同有序操作得到完全相同的最终引擎状态及 PRNG 游标；新 seed 初始化不同随机流；新 14 天时长停止在配置边界 |
| UI 和运行错误 | 390 px 手机布局无页面横向溢出；刷新、重开、错误反馈及完整试玩无未捕获 JavaScript 异常 |
| 原路由与 Demo | `/`、`/sensors`、`/risk`、`/prescription`、`/execution`、`/audit`、`/history`、`/scenarios`、`/admin` 均 HTTP 200 并渲染；地块切换、中文持久化、六个旧场景加载/推进通过 |

生产浏览器脚本合计 57 次每日点击（两轮 28 天及新 seed 的一次推进）。当前云端测得点击完成耗时中位数 **191 ms**、最大 **342 ms**，包含页面等待和自动保存；这不是 Windows 或其他设备的性能保证。摘要保存在 [phase2-browser-summary.json](phase2-browser-summary.json)。

复现命令（浏览器服务需另开终端保持运行）：

```sh
npm test
npm run build
npm run lint:baseline
npm run preview -- --host 0.0.0.0 --port 4173
# 另一终端；已安装 Chromium，也可设置 PUPPETEER_EXECUTABLE_PATH
SMOKE_BASE_URL=http://127.0.0.1:4173 npm run test:game
SMOKE_BASE_URL=http://127.0.0.1:4173 npm run test:routes
```

## 遗留问题与验证边界

- 标准 `npm run lint` 仍退出 1，保留原有 **22 错误 / 8 警告**；基线检查通过，不代表标准 lint 已清零。原主 JS 包仍超过 Vite 的 500 kB 警告阈值；本阶段 Game 包独立懒加载。
- 新 UI 已完成 Linux Chromium 验收；**Windows 新版本的人工试玩尚未执行**。用户之前确认的三个检查属于 Phase 0/1。请按 [试玩指南](../06_Farm_Sim_Phase2_Playing_Guide.md) 下载新分支，验证地图选择、延迟检查、委派审批、刷新继续和 28 天结束。
- 客户端自动保存受浏览器配额和可用性影响；默认 28 天存档通过体积检查，更长时长会扩大历史，配额不足时提示刷新可能丢失进度。Checkpoint 仅用于内部恢复，React 展示组件不接收隐藏状态。
- 参数、风险阈值和预计收入用于训练示例，尚无科学校准；财务包含现金、作业/采购成本和预测，没有完整市场、合同或会计体系。NPC/Sentinel 使用本地确定性规则。
- Seed 复现要求**内容版本和有序操作相同**。Phase 2 新增报告和事件会改变 PRNG 消耗，不能要求同 seed 与 Phase 1 输出逐字相同；存档含内容版本检查。
- 开场观测冲突保留配置日期引导；其他设备/劳动力/缺水/采收前事件按窗口、条件和概率触发。非默认 seed 不保证相同节点发生在相同日期。
- 完整职业、更多委派级别、外部 AI/GIS、后台账号及后续研究模式仍在后续范围。本 PR 只交付已批准的 Phase 2 网页试玩。

## PR 交付

已推送 `feature/farm-sim-phase2`，并创建 [PR #2](https://github.com/likeplus/Sentinel_Demo/pull/2)，base 为 `main`，状态为 OPEN。GitHub 返回 MERGEABLE / CLEAN，未配置报告到 PR 的状态检查；上表是实际本地及浏览器验收结果。

改动按模拟规则（`4a74485`）、网页与会话（`7538b89`）、浏览器验收与文档（`c646229`）分步提交。工作区干净，已核对本地和远端实现提交一致。本次交付不合并 PR #2。
