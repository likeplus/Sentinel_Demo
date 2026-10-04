# Phase 0 baseline

Inspected feature/farm-sim-mvp at `44bcb3cea0296bc7ffa5568213061866e58d67ff` on 2026-10-04. No applicable AGENTS.md found. Read the Phase 0/1 specification, package scripts, routing/Layout, existing engines, crop/constraint/threshold and mock data, and the six specified pages before domain implementation.

Node 24.19.0, npm 11.9.0, system Chromium; dependencies already installed using npm ci during onboarding. Production build passed (741 modules); existing 1,076.25 kB JS chunk triggers Vite's size warning. Lint exited 1: **22 errors / 8 warnings**. The exact per-file diagnostics are retained in `phase01-lint-baseline.json`; existing source is outside this task's cleanup scope.

Existing lint issues include duplicate pipelineStage, unused variables, hook ordering/effect updates, impure render calculations and unnecessary escapes. No lint rules will be disabled to conceal these failures.

Route smoke checks use real Chromium and verify HTTP status, rendered page heading and uncaught JavaScript errors for `/`, `/sensors`, `/risk`, `/prescription`, `/execution`, `/audit`, `/history`, `/scenarios`, `/admin`. Final results are recorded in phase01-results.md.
