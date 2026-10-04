# Phase 0/1 implementation and validation report

Validated on 2026-10-04 in `/workspace/Sentinel_Demo`, working branch `feature/farm-sim-mvp`, starting commit `44bcb3cea0296bc7ffa5568213061866e58d67ff`. Scope is exclusively Phase 0/1 of the implementation specification. See [architecture/run instructions](../04_Farm_Sim_Phase01_Architecture.md).

## 1. Files added

- `src/domain/{scenario,world,farm,productionUnit,cropInstance,people,resources,observation,belief,decision,operation,finance,index,validation}.js`
- `src/crop-packs/blueberry/{index,crop,varieties,stages,operations,risks,economics}.js`
- `src/scenarios/yunnan-blueberry-28d/{scenario,farm,productionUnits,people,resources,eventRules,index}.js`
- `src/simulation/{RandomEngine,SimulationEngine,EventEngine,WorldEngine,ObservationEngine}.js`
- `src/adapters/{legacyFieldAdapter,legacyScenarioAdapter,legacyExecutionAdapter}.js`
- `tests/{legacy-baseline,domain,random-observation,events-adapters,simulation}.test.js`
- `scripts/smoke-routes.cjs`, `scripts/run-farm-sim.mjs`, `scripts/check-lint-baseline.cjs`
- Architecture document, this report, Phase 0 baseline document and exact lint diagnostic snapshot under `docs/validation/`.

The implementation specification was already present on the requested feature branch and is preserved.

## 2. Files modified

`package.json` adds pinned Vitest 3.2.4 and test/CLI/lint-baseline commands; `package-lock.json` records dependencies. `README.md` links the new foundation and run instructions. Existing App routes, Layout, store, engine/data modules, components and pages have **no source diff** against the starting branch.

## 3. Architectural decisions

Additive plain serializable models, a headless private simulation engine and injected crop pack registry; no React dependency in domain/simulation. UTC date-driven duration; seeded PRNG everywhere in new simulation code. Distinct truth, available observations and actor beliefs. The player/replay API projects safe snapshots, while explicit engine-only checkpoints support deterministic restore. Quarter-day daily capacity plus inventory reservation checks; plan/actual operation records and an idempotent finance ledger. Adapters preserve legacy metadata without rewiring the demo.

## 4. Tests and functional results

| Check | Result |
| --- | --- |
| Frozen `npm ci` with system Chromium | Passed; 297 locked packages installed |
| `npm test` | **48 passed, 5 test files, 0 failed/skipped** |
| Date-driven 28/120-day engine | Passed; both end at configured dates, no engine source edit |
| Configured `stepDays=5` and final partial step | Passed; no skipped daily phases |
| Seed sequence, complete fixture/event-roll equality and checkpoint continuation | Passed; distinct seeds produce distinct rolls |
| Day-4 sample, Day-6 availability | Hidden on Day 5; visible at/after availability, including timestamp boundary |
| Replay/hidden-state isolation | Earlier full player views remain identical after later reports; perturbing hidden crop truth/future reports cannot change earlier views |
| Stale/invalid observations and actor beliefs | Passed; staling does not mutate truth; two actors differ on the same evidence |
| Capacity/inventory conflict | Crew A 1.25-day booking rejected; separate dates, travel, attendance, compatibility, missing resource and water deficits covered |
| PU-03 decision/investigation trace | Evidence/viewpoints → selected action → plan/actual Operation → outcome/finance; inspection evidence is delayed and permits follow-up decisions |
| Alternate crop pack and player role | Passed via injected registry without engine redesign |
| Yunnan fixture | 1 farm, 12 PUs, 3 clusters, 3 varieties, key staff, crew, irrigation rig, water and live finance |
| `npm run test:routes` | All 9 routes: HTTP 200 + rendered heading + no uncaught JS errors |
| Browser interaction regression | Field switch, persisted Chinese locale, and all 6 legacy scenarios loading/advancing passed |
| Repeated 28-day CLI with irrigation | Byte-identical JSON output; ends 2026-03-29, 1 completed operation, operating cost 260, 5 events |
| 120-day CLI, seed `validation` | Ends 2026-06-29, 120 elapsed days, 12 PUs, 7 events |
| `git diff --check` | Passed |

Tests use pure-module imports; the smoke check runs real system Chromium. There is no zero-test or placeholder-only validation.

## 5. Build and lint

`npm run build` passed; existing Vite chunk-size warning remains. Since the original frontend is preserved, its generated CSS/JS hashes remain `index-B9Jblu8x.css` / `index-BvFX3gEU.js`.

`npm run lint` still exits **1**, with **22 existing errors / 8 warnings**. `npm run lint:baseline` passes by comparing every file/rule/severity/line/column/message to the recorded baseline. It does not change ESLint rules or disguise the standard lint failure. New domain, simulation, crop-pack, fixture, adapter and test code has zero new diagnostics.

## 6. Baseline problems and remaining limitations

Existing lint problems include duplicate store keys, unused variables, hook ordering/effect updates, impure render calculations and unnecessary escapes. Exact diagnostics are in [phase01-lint-baseline.json](./phase01-lint-baseline.json). Legacy package deprecation notices and the oversized frontend chunk also predate this change. These were recorded rather than mixed into the Phase 0/1 implementation.

New simulation limits: training parameters are illustrative; end conditions are date-only; daily scheduling has no workforce routing or permissions system; replay snapshots are in memory; no gameplay/map UI, real GIS, backend or full accounting. Engine checkpoint payloads contain truth and must never be handed to players/agents.

GitHub API access currently fails before authentication with proxy CONNECT **403 Forbidden** for `api.github.com`. Existing Git read access works. The required domain addition is saved in the environment configuration draft; saving a draft does not apply or publish it. PR creation remains dependent on that runtime network change; no PR URL is claimed here.

## 7. Intentional deviations

Phase 0 placeholders were replaced with actual executable regression and acceptance tests as Phase 1 landed. Six incremental implementation commits (baseline, domain, random/knowledge, crop content, engine/trace, validation/docs) group the suggested eight-ticket sequence without altering its scope. Dates use a documented exclusive end boundary. Fixed scenario-authored reports/cases serve as fixtures; probabilistic event windows and continuous samples remain separately configurable. Legacy adapters are available but intentionally not wired into old UI/store until an explicit later migration ticket.

## 8. Recommended next ticket

Define Phase 2 Today/Decisions UI requirements around `getPlayerView()` and explicit decision/scheduling APIs, including what information a player may see. Separately fix the baseline lint/hook issues. No Phase 2 work is included in this branch.
