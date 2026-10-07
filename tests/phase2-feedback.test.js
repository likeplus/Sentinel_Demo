import { describe, it, expect } from 'vitest';
import { createGameController } from '../src/game/GameController.js';
import { SimulationEngine } from '../src/simulation/SimulationEngine.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';
import { withPlaytestFeedback } from '../src/game/feedbackFixture.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';
import { addDays } from '../src/domain/validation.js';
import { SAVE_KEY, CONTENT_VERSION } from '../src/game/persistence.js';
const controller = (options = {}) => createGameController({ feedback: true, storage: null, ...options });
const view = c => c.getSnapshot().view;
const day = c => { expect(c.advance().accepted).toBe(true); expect(c.advance().accepted).toBe(true); expect(c.advance().accepted).toBe(true); };
const task = (c, actions, unitId = 'PU-01', date = view(c).currentDate) => c.scheduleTask({ actions, unitId, date });
const engine = fixture => new SimulationEngine(withPlaytestFeedback(fixture || createYunnanBlueberryFixture()), { blueberry: blueberryPack });
function storage() { const data = new Map(); return { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v) }; }

describe('Phase 2 playtest feedback, integrated controller', () => {
  it('preserves all Phase 2 content and dynamic geometry; keeps unknown information unknown', () => {
    const c = controller(), v = view(c), original = createYunnanBlueberryFixture();
    expect(v.productionUnits.map(u => u.geometry)).toEqual(original.productionUnits.map(u => u.geometry));
    expect(v.management.units).toHaveLength(12);
    expect(v.finance.cash).toBe(original.finance.cash);
    expect(v.management.units.find(u => u.id === 'PU-04').water.value).toBeNull();
    expect(v.management.units.find(u => u.id === 'PU-09').growthStage).toBeNull();
    expect(JSON.stringify(c.getSnapshot())).not.toMatch(/trueState|diseasePressure"\s*:/);
  });
  it('uses three locked daily phases and charges only the meeting', () => {
    const c = controller(), date = view(c).currentDate;
    expect(view(c).attention.remaining).toBe(3);
    expect(task(c, ['inspection']).accepted).toBe(true);
    expect(task(c, ['spraying'], 'PU-02').accepted).toBe(true);
    expect(view(c).attention.remaining).toBe(3);
    expect(c.advance().accepted).toBe(true);
    expect(view(c).currentDate).toBe(date);
    expect(view(c).management.phase).toBe('execution');
    expect(task(c, ['repair']).accepted).toBe(false);
    expect(c.cancelTask(view(c).operations[0].id).accepted).toBe(false);
    expect(c.purchase('water', 5).accepted).toBe(false);
    c.advance(); expect(view(c).management.phase).toBe('end_of_day');
    c.advance(); expect(view(c).currentDate).toBe(addDays(date, 1));
    expect(view(c).attention.remaining).toBe(3);
  });
  it('allows Today and future dates and reports future resource conflict', () => {
    const c = controller(), date = addDays(view(c).currentDate, 2);
    expect(task(c, ['inspection', 'manual_watering', 'spraying', 'repair'], 'PU-04', date).accepted).toBe(true);
    expect(c.capacity(date).reserved).toBe(5);
    expect(task(c, ['inspection', 'manual_watering', 'spraying'], 'PU-05', date).accepted).toBe(false);
    expect(c.capacity(date).reserved).toBe(5);
    expect(task(c, ['spraying'], 'PU-06').accepted).toBe(true);
  });
  it('checks bundled action uniqueness and manager/worker inspection aliases', () => {
    const c = controller();
    const first = task(c, ['inspection', 'spraying']);
    for (const actions of [['inspection'], ['manager_inspection'], ['spraying']]) {
      const r = task(c, actions); expect(r.accepted).toBe(false); expect(r.taskIds).toEqual([first.task.id]);
    }
    expect(task(c, ['repair']).accepted).toBe(true);
    expect(task(c, ['inspection'], 'PU-02').accepted).toBe(true);
  });
  it('cancel and atomic reschedule release Labor, Attention, water and create no observation', () => {
    const c = controller(), date = view(c).currentDate;
    const r = task(c, ['manager_inspection', 'manual_watering']);
    const obs = view(c).observations.length;
    expect(c.capacity(date).attentionReserved).toBe(2);
    expect(c.reschedule(r.task.id, addDays(date, 1)).accepted).toBe(true);
    expect(c.capacity(date).reserved).toBe(0);
    expect(c.reschedule(r.task.id, addDays(date, -1)).accepted).toBe(false);
    expect(view(c).operations[0].plannedStart).toBe(addDays(date, 1));
    expect(c.cancelTask(r.task.id).accepted).toBe(true);
    expect(c.capacity(addDays(date, 1)).reserved).toBe(0);
    expect(c.capacity(addDays(date, 1)).waterRemaining).toBe(view(c).resources.find(r => r.id === 'water').quantity);
    day(c); expect(view(c).observations.filter(o => o.taskId === r.task.id)).toHaveLength(0);
    expect(obs).toBeGreaterThan(0);
    expect(view(c).management.decisions[0].status).toBe('cancelled');
  });
  it('inspection records crop and every equipment component and separates actions/results', () => {
    const c = controller(), r = task(c, ['inspection', 'spraying']); c.advance();
    const report = view(c).observations.find(o => o.taskId === r.task.id);
    expect(report.cropObservation).toHaveProperty('leafCondition');
    expect(report.cropObservation).toHaveProperty('fruitCondition');
    expect(report.equipmentFindings.map(f => f.part)).toEqual(['Irrigation', 'Valves', 'Pipes', 'Drippers', 'Sensors']);
    expect(report.observedAt).toContain(view(c).currentDate);
    expect(report.reliability).toBe(.9);
    expect(view(c).operations[0].results).toHaveLength(2);
    expect(view(c).management.decisions[0].result).toHaveLength(2);
    expect(view(c).outcomes).toHaveLength(2);
  });
  it('personal inspection reserves Attention 2 Labor 0; attached work consumes Labor', () => {
    const c = controller(), r = task(c, ['manager_inspection', 'manual_watering']);
    expect(r.task.labor).toBe(2); expect(r.task.attention).toBe(2);
    c.advance(); expect(view(c).attention.remaining).toBe(1);
    expect(view(c).observations.find(o => o.taskId === r.task.id).reliability).toBe(1);
  });
  it('irrigation decreases estimated stress provisionally then formally without double billing', () => {
    const c = controller(), initial = view(c).management.units[0].water.value;
    const r = task(c, ['irrigation']); c.advance();
    const after = view(c), impact = after.management.expectedImpacts[0];
    expect(impact.from).toBe(initial); expect(impact.to).toBeLessThan(initial);
    expect(after.management.units[0].water.provisional).toBe(true);
    expect(after.finance.transactions.filter(t => t.sourceId === r.task.id)).toHaveLength(1);
    c.advance(); c.advance();
    expect(view(c).management.units[0].water.provisional).toBe(false);
    expect(view(c).finance.transactions.filter(t => t.sourceId === r.task.id)).toHaveLength(1);
    expect(view(c).management.trend).toHaveLength(2);
  });
  it('sensor updates renew water freshness without renewing crop freshness', () => {
    const c = controller(); for (let i = 0; i < 5; i++) day(c);
    const u = view(c).management.units[0];
    expect(u.water.freshness).toBe(0); expect(u.cropFreshness).toBe(5);
    expect(u.water.confidence).toBe(88);
  });
  it('relocation is an executed operation and keeps its sensor reservation after rescheduling', () => {
    const c = controller(), sensor = view(c).management.sensors.find(s => !s.fixed), date = view(c).currentDate;
    const r = c.scheduleTask({ unitId: 'PU-04', date, actions: ['sensor_relocation'], sensorId: sensor.id });
    expect(r.accepted).toBe(true);
    expect(c.reschedule(r.task.id, addDays(date, 1)).accepted).toBe(true);
    expect(view(c).management.sensors.find(s => s.id === sensor.id).location).toBe('PU-03');
    day(c); day(c);
    expect(view(c).management.sensors.find(s => s.id === sensor.id).location).toBe('PU-04');
    expect(view(c).management.units.find(u => u.id === 'PU-04').water.freshness).toBe(0);
    expect(view(c).operations[0].results[0].from).toBe('PU-03');
  });
  it('fixed sensors cannot move and mobile sensor cannot be booked twice', () => {
    const c = controller(), sensors = view(c).management.sensors, date = view(c).currentDate;
    expect(c.scheduleTask({ unitId: 'PU-04', date, actions: ['sensor_relocation'], sensorId: sensors[0].id }).accepted).toBe(false);
    expect(c.scheduleTask({ unitId: 'PU-04', date, actions: ['sensor_relocation'], sensorId: sensors[2].id }).accepted).toBe(true);
    expect(c.scheduleTask({ unitId: 'PU-05', date, actions: ['sensor_relocation'], sensorId: sensors[2].id }).accepted).toBe(false);
  });
  it('complex Manager judgment charges once, routine cases need no charge, zero Attention permits delegation', () => {
    const c = controller();
    expect(c.openDecision('PU-01', 'Manager').accepted).toBe(false);
    for (const id of ['PU-04', 'PU-06', 'PU-08']) expect(c.openDecision(id, 'Manager').accepted).toBe(true);
    expect(view(c).attention.remaining).toBe(0);
    expect(c.openDecision('PU-09', 'Manager').accepted).toBe(false);
    for (const maker of ['Team', 'AI Assistant']) {
      const d = c.openDecision('PU-09', maker); expect(d.accepted).toBe(true);
      expect(d.decision.rationale).toContain('weather');
      expect(d.decision.input.existingSchedule).toBeInstanceOf(Array);
      expect(d.decision.attentionCost).toBe(0);
    }
    expect(task(c, ['spraying'], 'PU-02').accepted).toBe(true);
  });
  it('AI only Accept/Reject, ignores attempted modification, does not consume Attention', () => {
    const c = controller(), r = c.openDecision('PU-04', 'AI Assistant');
    const remaining = view(c).attention.remaining;
    expect(c.resolveDecision(r.decision.id, true, '', ['spraying']).accepted).toBe(true);
    expect(view(c).operations[0].actions).toEqual(r.decision.recommendedActions);
    expect(view(c).attention.remaining).toBe(remaining);
    day(c); expect(view(c).management.decisions[0].result).not.toBeNull();
    const reject = c.openDecision('PU-06', 'Team');
    expect(c.resolveDecision(reject.decision.id, false).accepted).toBe(true);
    expect(view(c).management.decisions.at(-1).status).toBe('rejected');
  });
  it('preserves original authored cases, delegation/approval and same-day scheduling', () => {
    const c = controller(); day(c); day(c); day(c); const decision = view(c).decisionCases[0];
    expect(decision).toBeTruthy();
    expect(c.decide(decision.id, { type: 'delegate', delegatedTo: 'sentinel' }).accepted).toBe(true);
    const attention = view(c).attention.remaining;
    expect(attention).toBe(3);
    day(c); expect(view(c).decisionCases[0].status).toBe('awaiting_approval');
    expect(view(c).decisionCases[0].delegationProposal.input).toHaveProperty('weather');
    expect(c.approve(decision.id).accepted).toBe(true);
    expect(view(c).operations[0].plannedStart).toBe(view(c).currentDate);
    expect(view(c).attention.remaining).toBe(3);
    day(c); expect(view(c).operations[0].executionStatus).toBe('completed');
    expect(view(c).decisionCases[0].actionHistory.find(a => a.type === 'approve').decisionMaker).toBe('AI Assistant');
  });
  it('preserves emergency purchase idempotence and complete five-dimension review', () => {
    const c = controller(); const cash = view(c).finance.cash;
    expect(c.purchase('water', 10, 'buy-test').accepted).toBe(true);
    expect(c.purchase('water', 10, 'buy-test').accepted).toBe(true);
    expect(view(c).finance.emergencyPurchases).toHaveLength(1);
    expect(view(c).finance.cash).toBeLessThan(cash);
    while (!view(c).ended) day(c);
    expect(c.getSnapshot().model.review.dimensions.map(d => d.id)).toEqual(['finance', 'crop', 'water', 'operations', 'decisions']);
  });
  it('restores the exact daily phase, tasks, sensor location, history and seed', () => {
    const disk = storage(), c = controller({ storage: disk });
    task(c, ['inspection', 'spraying']); c.dismissOnboarding(); c.advance();
    const restored = controller({ storage: disk });
    expect(view(restored)).toEqual(view(c));
    expect(view(restored).management.phase).toBe('execution');
    c.advance(); restored.advance(); c.advance(); restored.advance();
    expect(view(restored)).toEqual(view(c));
    expect(JSON.parse(disk.getItem(SAVE_KEY)).contentVersion).toBe(CONTENT_VERSION);
  });
  it('keeps incompatible Phase 2 saves intact until explicit restart', () => {
    const disk = storage(); controller({ storage: disk });
    const save = JSON.parse(disk.getItem(SAVE_KEY)); save.contentVersion = 'farm-sim-phase2-v1'; const original = JSON.stringify(save); disk.setItem(SAVE_KEY, original);
    const c = controller({ storage: disk }); expect(c.getSnapshot().storageStatus.state).toBe('blocked'); expect(disk.getItem(SAVE_KEY)).toBe(original);
    expect(c.resumeFresh().accepted).toBe(true); expect(view(c).management.phase).toBe('morning');
  });
});

describe('feedback world / equipment effects use existing Phase 2 engine', () => {
  it('manual watering works during rig fault and repair + irrigation restores service', () => {
    const fixture = createYunnanBlueberryFixture();
    const e = engine(fixture), state = e.exportCheckpoint();
    state.state.management.equipment['PU-01'].status = 'Fault';
    state.state.farmState.resources.find(r => r.id === 'irrigation-rig').availability[state.state.currentDate] = 0;
    const restored = SimulationEngine.restore(state, { blueberry: blueberryPack }), date = restored.currentDate;
    expect(restored.scheduleTask({ unitId: 'PU-01', date, actions: ['manual_watering'] }).accepted).toBe(true);
    expect(restored.scheduleTask({ unitId: 'PU-01', date, actions: ['repair', 'irrigation'] }).accepted).toBe(true);
    expect(restored.startExecution().accepted).toBe(true);
    expect(restored.getPlayerView().operations.every(t => t.executionStatus === 'completed')).toBe(true);
    expect(restored.getPlayerView().management.units[0].equipment.status).toBe('Normal');
    expect(restored.getPlayerView().management.units[0].equipment.reliability).toBe(90);
  });
  it('unknown hidden health cannot alter AI recommendations before observation', () => {
    const e = engine(), cp = e.exportCheckpoint();
    const alternate = structuredClone(cp); alternate.state.farmState.cropInstances.find(c => c.productionUnitId === 'PU-04').trueState.waterStress = .99;
    const a = SimulationEngine.restore(cp, { blueberry: blueberryPack }), b = SimulationEngine.restore(alternate, { blueberry: blueberryPack });
    expect(a.openDecision('PU-04', 'AI Assistant')).toEqual(b.openDecision('PU-04', 'AI Assistant'));
  });
});
