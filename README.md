# Sentinel | The Agentic Decision OS 🛰️

![Version](https://img.shields.io/badge/Version-V4.1-blue.svg)
![Status](https://img.shields.io/badge/Status-Prototyping-orange.svg)
![Aesthetics](https://img.shields.io/badge/Aesthetics-Premium-blueviolet.svg)

**Sentinel** is an advanced agricultural decision operating system designed to manage risk and unlock structural revenue (SRL) in high-value crop production (Blueberries, Flowers).

## 🚀 The Transition to Agentic OS (V5.0)

We are currently transitioning from a linear Decision Loop to an **Agentic Swarm Architecture**.

- **V1.3.1**: The Strategic White Paper (Linear Logic).
- **V4.1 (Current)**: Iterative Reasoning UI & Multi-Agent Collaboration.
- **V5.0 (Vision)**: Fully Autonomous Agentic OS with Input Efficiency Bypass.

---

## 📂 Documentation by Version

| Version | Documentation | Roadmap |
| :--- | :--- | :--- |
| **V1.3.1** | [White Paper V1.3.1](./docs/v1.3.1/README.md) | Legacy Foundation |
| **V4.1** | [Current Feature Set](./docs/v4.1/README.md) | **Active Development** |
| **V5.0** | [Agentic Vision](./docs/v5.0/README.md) | Strategic Roadmap |

---

## 🛠️ Tech Stack

- **Frontend**: React + Vite (Vanilla CSS for Premium UI)
- **Engine**: Rule-Based Decision Logic + Multi-Agent Reasoning Logs
- **Analytics**: Structural Revenue Leakage (SRL) Quant Model

## 📖 Quick Start

```bash
# Clone the repository
git clone https://github.com/BigBigBigLeo/Sentinel_Demo.git

# Install dependencies
npm install

# Run the dev server
npm run dev
```

## 🧠 Internal Wiki
For deeper technical details on agent protocols and data schemas, see the [Internal Wiki](./docs/wiki/README.md).

---

© 2026 Sentinel AgriAI. All Rights Reserved. Confidential | Internal Use Only.

## Farm simulation foundation (Phase 0/1)

The existing demo remains available. A separate deterministic simulation foundation and configurable Yunnan blueberry fixture can be exercised without mounting React:

```bash
npm test
npm run sim -- --irrigate
npm run sim -- --days 120 --seed my-seed
```

See [architecture and run instructions](./docs/04_Farm_Sim_Phase01_Architecture.md), [Phase 0 baseline](./docs/validation/phase01-baseline.md), and [validation results](./docs/validation/phase01-results.md). Phase 2 subsequently adds a playable Farm Map and management UI at `/game`; the Phase 0/1 report remains the foundation record.

## Farm Manager playable game — Phase 2

The new `/game` route is a Chinese-first playable Yunnan blueberry management scenario with a dynamic SVG farm map, Production Unit details, delayed reports, approval-based delegation, Manager Attention, resource-aware scheduling, emergency water purchases, and a multi-dimensional end review. The original Demo routes remain available.

On Windows, use the latest `main` checkout, open a terminal in that new checkout, then run:

```bat
npm ci
npm run dev
```

Open the **Local** address printed by Vite and append `/game` (normally `http://localhost:5173/game`). Keep this terminal running. An older running Demo server may occupy port 5173; use the address printed by the new terminal.

Progress is automatically saved in this browser. The default overview is **Table View**; use **Spatial View** for the original dynamic map with multiple status layers. Schedule **Today** or future tasks during **Morning Meeting**, then click **开始执行 →（自动停在日终结果）→ 次日早会**. The meeting costs 1 Attention; ordinary scheduling is free. Inspections may include watering, spraying, repair or a sensor move. Complex decisions may be delegated to Team / AI even with zero Attention; proposals need Accept / Reject. The normal scenario ends after 28 daily cycles. **经营管理** contains finance, water purchase, restart settings and the final review.

```sh
npm test
npm run build
npm run lint:baseline
# With the dev/preview server running and system Chromium available:
npm run test:game
npm run test:routes
```

The browser scripts accept `SMOKE_BASE_URL` and `PUPPETEER_EXECUTABLE_PATH`; on Windows point the latter to an installed Chrome/Chromium executable. Parameters remain illustrative training values. Same seed reproducibility requires the same content version and ordered player inputs.

See [Phase 2 implementation scope](docs/05_Farm_Sim_Phase2_Spec.md), [game architecture and playing guide](docs/06_Farm_Sim_Phase2_Playing_Guide.md), and [original Phase 2 verification](docs/validation/phase2-results.md) and [integrated feedback acceptance](docs/validation/phase2-feedback-results.md). The original project designs are preserved under `docs/design/` as Word documents and readable Markdown.

## Phase 2 feedback release design

团队后续设计基线：[Phase 2 试玩反馈版产品与交互设计方案](docs/07_Phase2_Feedback_Design.md)。包含玩法闭环、信息与资源规则、决策与历史、八个界面、双语、可扩展知识卡片、实现入口、验收及 PC 试玩步骤。

最新已发布代码在 `main`；本轮流程优化通过 PR 审查后合并。PC 获取 main：

```sh
git clone --branch main https://github.com/likeplus/Sentinel_Demo.git
cd Sentinel_Demo
npm ci
npm run dev
```

打开终端 Local 地址加 `/game`。也可在 GitHub 切到该分支，通过 Code → Download ZIP 获取源码（不是截图压缩包）。

## 在线试玩：GitHub Pages

配置 Pages 自动发布后，无需下载源码，可直接进入[农场游戏](https://likeplus.github.io/Sentinel_Demo/#/game)。main 更新后自动测试、构建和发布；PR 只验证构建。

首次启用需要仓库管理员在 Settings → Pages 将 Source 设为 GitHub Actions，再确认 [发布工作流](https://github.com/likeplus/Sentinel_Demo/actions/workflows/pages.yml) 成功。完整配置、验证与排障见 [在线试玩方案](docs/08_Online_Play_GitHub_Pages.md)。

团队本轮流程设计：[Phase 2 农场经理试玩流程优化](docs/09_Phase2_Manager_Flow_Design.md)，含多选批量规则、每日两步操作、资源报价、存档兼容及实现入口；[验收记录](docs/validation/manager-flow-results.md)。
