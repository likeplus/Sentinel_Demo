# Farm simulation foundation — Phase 0/1

This implements `03_Codex_Implementation_Spec_Phase0_Phase1_v0.1.md`. It is a headless foundation for future simulation gameplay. All nine existing routes and the original Zustand store/60-day demo remain intact. Phase 2 UI, GIS, career modes, scientific calibration, a backend, and full accounting are intentionally outside this change.

## Run

Use the existing checkout (cloud tasks are already isolated; no worktree is necessary).

```sh
# In /workspace/Sentinel_Demo; Node >=22.12 recommended (Vite 7 requirement).
# In the cloud image, use system Chromium instead of Puppeteer's old bundled download.
PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm ci
npm test
npm run sim -- --irrigate
npm run sim -- --days 120 --seed my-seed --step-days 5
npm run build
npm run lint
npm run lint:baseline # reports only whether the exact existing diagnostics changed
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
# In another terminal; /usr/bin/chromium or PUPPETEER_EXECUTABLE_PATH is required.
npm run test:routes
```

The CLI prints only a player-safe result, including visible cases, plan/actual operations and live finance. `--irrigate` explicitly chooses the example water-stress action; the default run makes no player decisions. The standard lint command still exits 1 on the recorded baseline issues; new source/tests have zero diagnostics. Browser checks can target `npm run preview` with `SMOKE_BASE_URL=http://127.0.0.1:4173`.

## Layers and contracts

| Layer | Responsibility |
| --- | --- |
| `src/domain/` | JSON-only factories with JSDoc, validation, UTC dates, resource reservations and simple finance ledger |
| `src/crop-packs/blueberry/` | Three illustrative varieties, age-driven stages, crop transitions, operations, risk metadata, public forecasts |
| `src/simulation/` | Seeded PRNG, deterministic world/event/observation processing and private engine state |
| `src/scenarios/yunnan-blueberry-28d/` | Farm, 12 PUs/3 clusters, crop instances, staff/crew/resources, sampling profiles, decision templates and event windows |
| `src/adapters/` | Explicit legacy field/scenario/execution mapping, with no automatic migration or replacement |
| `tests/` | Vitest pure-module tests; no React mount needed |

The engine takes a fixture plus a registry keyed by `cropPackId`. It does not import blueberry, legacy `Field` or React. CropPack functions receive the engine PRNG; new simulation modules never use `Math.random`, UUID randomness, or the wall clock. Injecting another crop pack and selecting another player role are exercised in tests.

```js
import { SimulationEngine } from '../src/simulation/SimulationEngine.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';

const sim = new SimulationEngine(createYunnanBlueberryFixture(), { blueberry: blueberryPack });
while (!sim.ended) sim.advanceStep();
const player = sim.getPlayerView(); // Safe to pass to a future UI or agent.
```

## Time and reproducibility

Dates are strict UTC `YYYY-MM-DD`. `startDate` is inclusive and `endDate` is exclusive: March 1 → March 29 means 28 elapsed daily transitions; the terminal state is stamped March 29. Initialization has index 0; every `advanceOneDay()` advances one calendar day. `advanceStep()` uses positive integral `stepDays`, retaining every daily phase and clamping the final partial step. Event windows use one-based elapsed transition numbers. Manual advancement is explicit; speed/pause fields reserve a future runner contract and do not schedule wall-clock timers.

Each transition runs world → crops → resources → events → observations → beliefs → decisions → operations → outcomes → finance → audit. Availability is indexed by date, so daily capacity resets by selecting that date rather than accumulating unused capacity. Events roll only inside eligible windows, with matching JSON conditions and occurrence limits; modifiers multiply probabilities. Not every event opens a case. In Phase 1, termination supports scenario dates only; unsupported non-date end conditions fail explicitly. Dynamic victory/failure conditions belong to a later ticket.

`RandomEngine` exports/restores its exact state. `SimulationEngine.exportCheckpoint()` / `SimulationEngine.restore(checkpoint, cropPacks)` round-trip through JSON and reproduce subsequent event rolls and results. **Checkpoint payloads are engine-only and include hidden truth and pending observations. Never pass them to a UI, player or agent.** There is no backend or persistence service in this phase.

## Knowledge boundary

Crop `trueState`, world truth, future observation values, event rolls and crop stage/potential are absent from `getPlayerView()`. Public crop records contain identity/configuration only. Finance forecasts use the player's available evidence and configured variety potentials rather than hidden crop state. Observation selectors gate on both `observedAt` and `availableAt`; freshness determines current/stale, and invalid reports never feed beliefs.

Actors have separate source weights. The same PU-03 sensor/worker reports produce different Agronomist and Sentinel beliefs, with explicit evidence IDs. Historical player views retain the knowledge actually available on that simulated day. Future replay requests fail; later reports, outcomes, cash changes and cases cannot retroactively appear in earlier views. Tests perturb hidden truth and unavailable reports and assert the entire earlier player view remains unchanged.

## Decision and operation skeleton

The PU-03 water-stress fixture links conflicting evidence and participant viewpoints to investigation, immediate irrigation, delegation, delay, no action and a custom decision. Selecting an operation-bearing option schedules a plan; it does not auto-execute on truth-aware beliefs. Inspections consume crew capacity and create a report with one-day delivery delay, then reopen the case for another decision.

Reservations aggregate capacity on each planned date (0.25/0.5/0.75/1 day + travel) and inventory across all outstanding operations. Crew A at 1.25 days is rejected; missing/incompatible resources and inventory deficits are reported. Execution rechecks capacity/inventory after events. Attendance disruption blocks a task, retries it on later days, and records delay; seeded productivity affects actual output. Actual output, resources, cost and deviations stay separate from the plan. Successful irrigation changes private crop state, consumes inventory, generates an outcome and deducts operating cost once. Finance transactions use operation IDs for idempotency.

The original prescriptions, executions, fingerprints, audits, six scripted scenarios and AUTO_AGENT_ROSTER are unchanged. Legacy scenario adapters preserve scripted-event metadata instead of pretending scripted demonstrations are stochastic configs; legacy execution adapters retain fingerprint/deviation data and actual duration without inventing crew identifiers.

## Deliberate limits and next ticket

Parameters are training examples, not calibrated crop science. Events and operations are a daily skeleton, not minute-level routing, NPC debate, permission enforcement, a full agronomy simulator or accounting. Replay is held in memory; storing full daily public views favors auditability over long-horizon memory efficiency. The example fixed reports are scenario-authored engine inputs. Resource refills, non-date end conditions, additional crop variables/sensors and UI wiring require separate follow-up work.

Recommended next ticket: define the Phase 2 Today/Decisions experience using only `getPlayerView()` and `decide()`/`scheduleOperation()`, with explicit product acceptance criteria. Separately address the existing lint/hook problems. This change does not implement either ticket.
