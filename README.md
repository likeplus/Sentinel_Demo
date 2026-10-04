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

On Windows, download or check out `feature/farm-sim-phase2`, open a terminal in that new checkout, then run:

```bat
npm ci
npm run dev
```

Open the **Local** address printed by Vite and append `/game` (normally `http://localhost:5173/game`). Keep this terminal running. An older running Demo server may occupy port 5173; use the address printed by the new terminal.

Progress is automatically saved in this browser. Click **推进一天** to advance one day. Inspect a Production Unit, wait for the report to arrive, and use **决策中心** to choose an action or ask a subordinate for a proposal. Proposals require your approval. The normal scenario ends after 28 daily transitions. **经营管理** contains finance, water purchase, restart settings and the final review.

```sh
npm test
npm run build
npm run lint:baseline
# With the dev/preview server running and system Chromium available:
npm run test:game
npm run test:routes
```

The browser scripts accept `SMOKE_BASE_URL` and `PUPPETEER_EXECUTABLE_PATH`; on Windows point the latter to an installed Chrome/Chromium executable. Parameters remain illustrative training values. Same seed reproducibility requires the same content version and ordered player inputs.

See [Phase 2 implementation scope](docs/05_Farm_Sim_Phase2_Spec.md), [game architecture and playing guide](docs/06_Farm_Sim_Phase2_Playing_Guide.md), and [Phase 2 verification](docs/validation/phase2-results.md). The original project designs are preserved under `docs/design/` as Word documents and readable Markdown.
