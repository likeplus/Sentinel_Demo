import { SimulationEngine } from '../src/simulation/SimulationEngine.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';
import { addDays } from '../src/domain/validation.js';

const args = process.argv.slice(2);
const overrides = {};
let irrigate = false;
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === '--irrigate') { irrigate = true; continue; }
  if (!['--days', '--seed', '--step-days'].includes(argument) || args[index + 1] === undefined) throw new TypeError(`Unknown/missing argument: ${argument}`);
  const value = args[++index];
  if (argument === '--seed') overrides.seed = value;
  else if (argument === '--step-days') overrides.stepDays = Number(value);
  else {
    if (!Number.isInteger(Number(value)) || Number(value) < 1) throw new RangeError('--days must be a positive integer');
    overrides.endDate = addDays('2026-03-01', Number(value));
  }
}
const simulation = new SimulationEngine(createYunnanBlueberryFixture(overrides), { blueberry: blueberryPack });
let actionChosen = false;
while (!simulation.ended) {
  const view = simulation.getPlayerView();
  // Optional explicit fixture demonstration, using the same safe API intended for a future UI.
  if (irrigate && !actionChosen && view.decisionCases.some(c => c.id === 'water-stress-pu03' && c.status === 'open')) {
    const result = simulation.decide('water-stress-pu03', { type: 'decide_now', optionId: 'irrigate-pu03', reasonText: 'CLI fixture demonstration' });
    actionChosen = result.accepted;
  }
  simulation.advanceStep();
}
const view = simulation.getPlayerView();
console.log(JSON.stringify({ scenarioId: view.scenarioId, seed: view.randomSeed, date: view.currentDate,
  elapsedDays: view.currentDayIndex, units: view.productionUnits.length,
  visibleObservations: view.observations.length, decisionCases: view.decisionCases.map(c => ({id:c.id,status:c.status,operationIds:c.resultingOperationIds})),
  operations: view.operations, finance: view.finance,
  events: view.history.flatMap(h => h.eventIds.map(ruleId => ({date:h.date,ruleId}))) }, null, 2));
