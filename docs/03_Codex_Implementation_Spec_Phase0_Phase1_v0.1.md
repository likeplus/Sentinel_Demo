\# Sentinel Farm Simulation — Codex Implementation Specification

Version: 0.1    
Repository: \`BigBigBigLeo/Sentinel\_Demo\`    
Default branch: \`main\`    
Target working branch: \`feature/farm-sim-mvp\`    
Current stack: React 19, Vite 7, React Router 7, Zustand 5, Recharts 3

\#\# Mission

Evolve the existing Sentinel Decision OS demo into the foundation of an interactive farm decision simulation/training application without breaking the current demo.

Product direction:

\`Game → Simulation/Training Platform → Agent Sandbox/Benchmark → Digital Twin-ready\`

The first playable content pack is a configurable 28-day Yunnan blueberry management scenario, but the engine must not be limited to 28 days, blueberry, one farm, or one player role.

Do not rewrite the repository from scratch. Preserve working UI and existing engines while introducing a clean domain/simulation foundation.

\#\# Read-first instructions

Before modifying code:  
1\. Read \`package.json\`.  
2\. Read \`src/App.jsx\` and \`src/components/Layout.jsx\`.  
3\. Read all files under \`src/engine/\`, especially store, simulation, scenario, decision, execution, audit and thinking engines.  
4\. Read \`src/data/crops.js\`, \`constraints.js\`, \`thresholds.js\`, and relevant \`mockData.js\`.  
5\. Read current pages Dashboard, Prescription, Execution, AuditReport, History, ScenarioControl.  
6\. Run the existing build before making changes.  
7\. Do not remove or rename existing routes in Phase 0/1.  
8\. Prefer additive modules/adapters; avoid a big-bang rewrite of \`store.js\`.

\#\# Baseline findings  
Useful existing foundations:  
\- React/Vite SPA and routing  
\- Zustand global state  
\- simulation engine  
\- scripted demo scenarios  
\- decision/risk logic  
\- multi-actor execution  
\- prescription-vs-actual deviation/fingerprint logic  
\- audit records  
\- AI agent roster and autonomous workflow  
\- crop definitions

Current limitations:  
\- 60-day lifecycle hard-coded in simulation logic  
\- fixed day-keyed weather/pest events  
\- extensive direct \`Math.random()\`  
\- UI mentions 120 days while core sim/crop lifecycle is 60 days  
\- spatial model is \`FIELDS\`, not generic ProductionUnit  
\- crop stages tied to demo day ranges  
\- scenarios are scripted demonstrations rather than reusable configs

\# PHASE 0 — Baseline & Safety Net

\#\# P0-01 Verify current application baseline  
Tasks:  
\- run \`npm ci\` or \`npm install\` if required  
\- run \`npm run build\`  
\- run \`npm run lint\` and separate pre-existing failures  
\- verify routes: /, /sensors, /risk, /prescription, /execution, /audit, /history, /scenarios, /admin

Acceptance:  
\- baseline recorded  
\- no Phase 1 change introduces new build failures  
\- existing routes remain available

\#\# P0-02 Add minimal test harness  
Prefer Vitest unless repo already has another convention.

Initial tests:  
\- RandomEngine reproducibility placeholder  
\- scenario-duration test  
\- domain fixture validation

Acceptance:  
\- test command runs locally  
\- pure domain/simulation modules import without React mounting

\# PHASE 1 — Domain Foundation \+ Deterministic Simulation Skeleton

Create:  
\`\`\`text  
src/domain/  
  scenario.js  
  world.js  
  farm.js  
  productionUnit.js  
  cropInstance.js  
  people.js  
  resources.js  
  observation.js  
  belief.js  
  decision.js  
  operation.js  
  finance.js  
  index.js  
\`\`\`

Use plain serializable objects \+ JSDoc. Do not migrate whole repo to TypeScript in this phase.

\#\# P1-01 Scenario model  
Minimum shape:  
\`\`\`js  
{  
  id, name, startDate, endDate, stepDays, seed,  
  playerRole, farmConfigId, cropPackIds,  
  startingCash, criticalResourceIds,  
  eventRules, difficulty, observationMode,  
  endConditions, evaluationDimensions  
}  
\`\`\`

Rules:  
\- duration calculated from dates  
\- stepDays defaults to 1  
\- critical resource is configuration  
\- JSON serializable

Acceptance:  
\- same engine interface runs 28-day and 120-day scenarios  
\- no engine source edit required to change duration

\#\# P1-02 Farm and ProductionUnit  
\`\`\`js  
{  
  id, farmId, name, type, clusterId,  
  geometry, centroid, area,  
  naturalProperties, infrastructure,  
  environmentControlLevel,  
  cropInstanceIds,  
  lastObservedAt, observationStatus  
}  
\`\`\`

Geometry supports simplified polygons, quadrilaterals and hexagons.  
Do not add Mapbox/Leaflet in Phase 1\.

Example types:  
open\_field, substrate\_zone, greenhouse\_compartment, orchard\_block, nursery\_zone, plant\_factory\_zone.

Acceptance:  
\- new domain code does not depend on Field  
\- fixture supports 12 PUs in 3 clusters  
\- compatibility mapper can later adapt old FIELDS

\#\# P1-03 CropInstance and Crop Pack interface  
CropInstance:  
\`\`\`js  
{  
  id, productionUnitId, cropPackId, varietyId,  
  plantingDate, expectedHarvestWindow, stage,  
  trueState, managementHistory  
}  
\`\`\`

Suggested trueState:  
biomass, canopy, waterStress, nutrientStatus, diseasePressure, qualityPotential, yieldPotential.

Create:  
\`\`\`text  
src/crop-packs/blueberry/  
  index.js  
  crop.js  
  varieties.js  
  stages.js  
  operations.js  
  risks.js  
  economics.js  
\`\`\`

Blueberry v0.1: 3 varieties differing in maturity timing, water sensitivity, yield potential, quality potential, market value.

Acceptance:  
\- new engine imports crop logic by cropPackId  
\- adding another crop pack does not require core engine redesign

\#\# P1-04 Person, Crew and Resource model  
Person:  
\`\`\`js  
{  
  id, name, avatar, role, reportsTo,  
  skills, experience, traits, riskPreference,  
  permissions, decisionScope, workload,  
  beliefStateIds  
}  
\`\`\`

Resource supports capacity resources (person/crew/machine/robot) and inventory resources (water/fertilizer/chemical/fuel).

Suggested fields:  
\`\`\`js  
{  
  id, type, name,  
  capacityPerDay, quantity, unit,  
  availability, skills, compatibleOperations,  
  currentLocation, reliability, operatingCost, status  
}  
\`\`\`

Initial organization:  
Farm Manager player; Agronomist; Irrigation Manager; Field Supervisor; Maintenance Lead; crews; Sentinel Agent slot.  
Do not delete legacy AUTO\_AGENT\_ROSTER.

\#\# P1-05 Observation / Belief separation  
Observation:  
\`\`\`js  
{  
  id, productionUnitId,  
  sourceType, sourceId,  
  variable, value, unit,  
  uncertainty, coverage,  
  observedAt, availableAt,  
  freshness, reliability, status  
}  
\`\`\`

BeliefState:  
\`\`\`js  
{  
  id, actorId, productionUnitId,  
  subject, estimate, probability, confidence,  
  basedOnObservationIds, updatedAt  
}  
\`\`\`

Critical rules:  
\- trueState separate from observations  
\- observedAt \!= availableAt  
\- replay cannot expose data before availableAt  
\- status includes current/stale/invalid

Tests:  
1\. Day-4 sample with Day-6 availability is hidden on Day 5\.  
2\. Observation can go stale without trueState being changed by that action.  
3\. Two actors can hold different beliefs from the same evidence.

\#\# P1-06 DecisionCase  
\`\`\`js  
{  
  id, title, category, openedAt, deadline,  
  productionUnitIds, impactAreas,  
  availableObservationIds, participantIds,  
  viewpoints, consensusLevel, disagreementTopics,  
  investigationOptions, actionOptions,  
  selectedAction, playerReasonTags, playerReasonText,  
  delegatedTo, managerAttentionCost, opportunityCosts,  
  status, resultingOperationIds, outcomeIds,  
  retrospectiveAttribution  
}  
\`\`\`

Must represent:  
decide now; gather more information; delegate; delay; take no action; custom decision.

Fixture:  
PU-03 water-stress case with sensor/worker disagreement, Agronomist vs Sentinel belief difference, investigation option, and final operation generation.

\#\# P1-07 Operation — Plan vs Actual  
\`\`\`js  
{  
  id, type, sourceType, sourceId,  
  productionUnitIds,  
  plannedStart, plannedDurationDays,  
  assignedResourceIds, plannedOutput, priority,  
  actualStart, actualDurationDays,  
  actualResourceIds, actualOutput,  
  travelOverhead, executionStatus, deviations, cost  
}  
\`\`\`

Scheduling simplification: 0.25 / 0.5 / 0.75 / 1.0 day capacity.

Acceptance:  
\- detect over-allocation such as Crew A \= 1.25 day  
\- represent attendance/productivity deviation  
\- preserve path for mapping legacy executions

\#\# P1-08 FinanceState  
\`\`\`js  
{  
  cash,  
  forecastRevenue,  
  operatingCostToDate,  
  emergencyPurchases,  
  transactions  
}  
\`\`\`  
Do not implement full accounting yet.

\#\# P1-09 Seeded RandomEngine  
Create \`src/simulation/RandomEngine.js\`.

Requirements:  
\- deterministic sequence for same seed  
\- helpers next(), between(), chance(), optional gaussian()  
\- no external dependency unless strongly justified  
\- restorable state if practical

Migration rule:  
use RandomEngine for all NEW simulation modules; do not replace every old Math.random() call in one risky edit.

Tests:  
same seed → same sequence  
different seed → different sequence  
scenario fixture reproducible

\#\# P1-10 SimulationEngine vNext skeleton  
Create:  
\`\`\`text  
src/simulation/SimulationEngine.js  
src/simulation/EventEngine.js  
src/simulation/WorldEngine.js  
src/simulation/ObservationEngine.js  
\`\`\`

SimulationState:  
\`\`\`js  
{  
  scenarioId,  
  currentDate,  
  currentDayIndex,  
  speed,  
  paused,  
  randomSeed,  
  worldState,  
  farmState,  
  pendingEvents,  
  openDecisionCases,  
  scheduledOperations  
}  
\`\`\`

advanceOneDay order:  
1 world  
2 production/crops  
3 resources  
4 event rules  
5 observations  
6 beliefs  
7 tasks/decisions  
8 operations  
9 outcomes  
10 finance  
11 audit/history

Acceptance:  
\- correct date/index advancement  
\- end based on scenario dates, not hard-coded day number  
\- 28-day and 120-day tests pass without engine changes  
\- same seed gives same event-roll sequence

\#\# P1-11 Yunnan Blueberry 28-day fixture  
Create:  
\`\`\`text  
src/scenarios/yunnan-blueberry-28d/  
  scenario.js  
  farm.js  
  productionUnits.js  
  people.js  
  resources.js  
  eventRules.js  
  index.js  
\`\`\`

Config:  
\- 1 farm  
\- 3 clusters  
\- 12 ProductionUnits  
\- 3 blueberry varieties  
\- Farm Manager player  
\- Water as critical resource  
\- simple finance state  
\- key staff  
\- at least one crew and irrigation-related resource  
\- 28 days through dates, never engine constants

Event themes use windows/conditions/probabilities:  
\- observation conflict / small irrigation issue  
\- sensor/valve anomaly  
\- labor disruption  
\- escalating water pressure  
\- pre-harvest trade-off

Suggested event rule:  
\`\`\`js  
{  
  id,  
  eligibleWindow,  
  conditions,  
  baseProbability,  
  modifiers,  
  maxOccurrences,  
  effects  
}  
\`\`\`

Not every event should become a player DecisionCase.

\#\# Compatibility layer  
Prefer additive adapters where needed:  
\`\`\`text  
src/adapters/  
  legacyFieldAdapter.js  
  legacyScenarioAdapter.js  
  legacyExecutionAdapter.js  
\`\`\`

Keep legacy FIELDS, SCENARIOS, generate60DayData, prescriptions, executions and audits working during Phase 1\.

\#\# Do NOT do in Phase 0/1  
\- do not remove existing pages  
\- do not replace whole Zustand store in one commit  
\- do not build final Farm Map UI  
\- do not add minute-level workforce scheduling  
\- do not add a backend/database unless tooling truly requires it  
\- do not add Mapbox/Leaflet  
\- do not implement real GIS ingestion  
\- do not implement full accounting  
\- do not claim scientific calibration of crop parameters  
\- do not expose true state directly  
\- do not create one combined player score

\#\# Suggested commit sequence  
1\. chore: baseline tests and simulation test harness  
2\. feat(domain): add scenario farm production unit and crop models  
3\. feat(domain): add people resource observation and belief models  
4\. feat(domain): add decision case operation and finance models  
5\. feat(sim): add seeded random engine  
6\. feat(sim): add configurable simulation engine skeleton  
7\. feat(content): add yunnan blueberry 28-day scenario fixture  
8\. test: cover duration reproducibility observation availability and capacity conflicts

\#\# Phase 1 Definition of Done  
\- \[ \] Existing Sentinel app still builds  
\- \[ \] Existing routes still load  
\- \[ \] Domain models are serializable/testable  
\- \[ \] Scenario duration configurable by dates  
\- \[ \] 28-day and 120-day scenarios use same engine interface  
\- \[ \] 12 ProductionUnits / 3 clusters / 3 varieties fixture exists  
\- \[ \] ProductionUnit is new generic spatial domain model  
\- \[ \] RandomEngine provides reproducibility  
\- \[ \] Observation/Belief separate from trueState  
\- \[ \] availability prevents future-information leakage  
\- \[ \] DecisionCase links evidence → viewpoints → action → Operation  
\- \[ \] Operation supports Planned vs Actual and capacity conflicts  
\- \[ \] FinanceState is live state, not only display KPI  
\- \[ \] new code has unit tests  
\- \[ \] no new lint/build errors

\#\# Forward compatibility — do not implement yet  
\- Map / Today / Operations / Units / Decisions / Management navigation  
\- SVG schematic GIS Farm Map  
\- stale/unknown fog-of-war  
\- playable careers and role permissions  
\- NPC portrait system  
\- bounded NPC/Agent debate  
\- Manager Attention  
\- delegation levels  
\- Shadow/Advisor/Delegate/Autonomous Agent modes  
\- multi-dimensional Management Review  
\- opt-in Decision Trace datasets  
\- scenario authoring  
\- crop model adapters  
\- Twin Mode  
\- persistence/backend when needed

\#\# Completion report format  
At the end of the Codex task, report:  
1\. files added  
2\. files modified  
3\. architectural decisions  
4\. tests/results  
5\. build/lint results  
6\. baseline problems  
7\. intentional deviations and why  
8\. recommended next ticket; do not implement Phase 2 without approval  
