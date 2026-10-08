import { describe, it, expect } from 'vitest';
import { createGameController } from '../src/game/GameController.js';
import { SimulationEngine } from '../src/simulation/SimulationEngine.js';
import { withPlaytestFeedback } from '../src/game/feedbackFixture.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';
import { SAVE_KEY, SAVE_VERSION, CONTENT_VERSION, encodeSave, decodeSave } from '../src/game/persistence.js';
import { informationAge } from '../src/game/informationAge.js';
import { localizeGameText as t } from '../src/game/localization.js';
const controller = () => createGameController({ feedback: true, storage: null });
const view = c => c.getSnapshot().view;
const input = (c, unitIds, actions, extra = {}) => ({ unitIds, actions, date: view(c).currentDate, ...extra });

describe('Farm manager flow and atomic batch scheduling', () => {
  it('executes once, stops at results and preserves the explicit next-morning boundary', () => {
    const c = controller(), date = view(c).currentDate;
    c.scheduleBatch(input(c, ['PU-01', 'PU-02'], ['inspection', 'manual_watering']));
    expect(c.executeDay().accepted).toBe(true);
    expect(view(c).currentDate).toBe(date); expect(view(c).management.phase).toBe('end_of_day');
    expect(view(c).management.lastResults).toHaveLength(2);
    expect(c.scheduleBatch(input(c, ['PU-03'], ['repair'])).accepted).toBe(false);
    expect(c.executeDay().accepted).toBe(true); expect(view(c).management.phase).toBe('morning');
    expect(view(c).currentDate).not.toBe(date);
    expect(view(c).finance.transactions.filter(x => x.type === 'operating_cost')).toHaveLength(2);
  });
  it('quotes aggregate costs and creates independently traceable tasks with idempotent retries', () => {
    const c = controller(), plan = input(c, ['PU-01', 'PU-02', 'PU-03'], ['inspection', 'spraying'], { requestId: 'batch-once' });
    const before = structuredClone(view(c));
    const preview = c.previewTasks(plan);
    expect(preview.accepted).toBe(true); expect(preview.quote.labor).toBe(6); expect(preview.quote.attention).toBe(0);
    expect(preview.quote.cost).toBe(preview.tasks.reduce((sum, task) => sum + task.expectedCost, 0));
    expect(view(c)).toEqual(before);
    const result = c.scheduleBatch(plan); expect(result.tasks).toHaveLength(3);
    expect(c.scheduleBatch(plan)).toEqual(result);
    expect(view(c).operations).toHaveLength(3); expect(view(c).management.decisions).toHaveLength(3);
    expect(new Set(result.tasks.map(x => x.sourceId)).size).toBe(3);
    expect(view(c).attention.remaining).toBe(3);
  });
  it('quotes authored plans through their existing allocator without changing their duration or coverage', () => {
    const c = controller(); for (let i = 0; i < 3; i++) { c.executeDay(); c.executeDay(); }
    const decision = view(c).decisionCases[0], plan = decision.actionOptions.find(o => o.operation)?.operation;
    const before = structuredClone(view(c)), quote = c.previewOperation(plan, view(c).currentDate);
    expect(view(c)).toEqual(before); expect(quote.accepted).toBe(true);
    expect(quote.quote.labor).toBe(plan.plannedDurationDays * 8);
    expect(quote.quote.cost).toBe(quote.task.expectedCost);
    c.enterDecisionCase(decision.id);
    const option = decision.actionOptions.find(o => o.operation === plan);
    const result = c.decide(decision.id, { type: option.type, optionId: option.id, plannedStart: view(c).currentDate });
    expect(result.accepted).toBe(true); expect(result.operation.expectedCost).toBe(quote.quote.cost);
  });
  it('rolls back the entire batch on aggregate Labor or Attention conflicts', () => {
    const c = controller();
    for (const actions of [['inspection', 'manual_watering'], ['manager_inspection']]) {
      const before = structuredClone(view(c));
      const result = c.scheduleBatch(input(c, ['PU-01', 'PU-02', 'PU-03'], actions));
      expect(result.accepted).toBe(false); expect(result.errors.length).toBeGreaterThan(0);
      expect(view(c)).toEqual(before);
    }
  });
  it('checks all duplicate units and inspection aliases without leaving earlier successes behind', () => {
    const c = controller();
    c.scheduleTask({ unitId: 'PU-02', date: view(c).currentDate, actions: ['inspection', 'spraying'] });
    c.scheduleTask({ unitId: 'PU-03', date: view(c).currentDate, actions: ['spraying'] });
    const before = structuredClone(view(c));
    const result = c.scheduleBatch(input(c, ['PU-01', 'PU-02', 'PU-03'], ['spraying']));
    expect(result.errors.map(e => e.unitId)).toEqual(['PU-02', 'PU-03']);
    expect(result.taskIds).toHaveLength(2); expect(view(c)).toEqual(before);
    expect(c.scheduleBatch(input(c, ['PU-01', 'PU-02'], ['manager_inspection'])).accepted).toBe(false);
    expect(view(c)).toEqual(before);
  });
  it('does not clone mobile sensors, and validates reserved future water and cash atomically', () => {
    const c = controller(), before = structuredClone(view(c));
    expect(c.scheduleBatch(input(c, ['PU-04', 'PU-05'], ['sensor_relocation'], { sensorId: 'soil-PU-03' })).accepted).toBe(false);
    expect(view(c)).toEqual(before);
    for (const [resource, quantity] of [['water', 25], ['cash', 1]]) {
      const fixture = createYunnanBlueberryFixture();
      if (resource === 'water') fixture.resources.find(r => r.id === 'water').quantity = quantity;
      else fixture.finance.cash = quantity;
      const other = createGameController({ feedback: true, fixture, storage: null }), initial = structuredClone(view(other));
      expect(other.scheduleBatch(input(other, ['PU-01', 'PU-02'], ['irrigation'], { date: '2026-03-03' })).accepted).toBe(false);
      expect(view(other)).toEqual(initial);
    }
    expect(c.previewTasks(input(c, ['PU-01'], ['inspection'], {date: ''})).accepted).toBe(false);
  });
});

describe('Full-history save storage and localized units', () => {
  it('keeps 112 inspections and all snapshots inside a 5 MiB browser storage quota', () => {
    let raw;
    const storage = { getItem: () => raw || null, setItem: (_key, value) => {
      if (value.length * 2 > 5 * 1024 * 1024) throw new Error('QuotaExceededError'); raw = value;
    } };
    const c = createGameController({ feedback: true, storage });
    for (let day = 0; day < 28; day++) {
      expect(c.scheduleBatch(input(c, ['PU-01', 'PU-02', 'PU-03', 'PU-04'], ['inspection'])).accepted).toBe(true);
      c.executeDay(); c.executeDay(); expect(c.getSnapshot().storageStatus.state).toBe('saved');
    }
    expect(view(c).operations).toHaveLength(112);
    expect(raw.length * 2).toBeLessThan(5 * 1024 * 1024);
    const restored = createGameController({ feedback: true, storage });
    expect(restored.getSnapshot().view).toEqual(view(c));
    const decoded = decodeSave(raw);
    expect(decoded.checkpoint.views).toHaveLength(29);
    expect(encodeSave(decoded.checkpoint, decoded.requestSequence)).toBe(raw);
    expect(decoded.checkpoint.state.management.decisions).toHaveLength(112);
  }, 60000);
  it('loads legacy Phase 2 encoding without dropping any checkpoint fields', () => {
    const engine = new SimulationEngine(withPlaytestFeedback(createYunnanBlueberryFixture()), { blueberry: blueberryPack });
    const checkpoint = engine.exportCheckpoint(), observationPool = [];
    const views = checkpoint.views.map(([date, view]) => [date, { ...view, observations: view.observations.map(o => { observationPool.push(o); return observationPool.length - 1; }) }]);
    const legacy = JSON.stringify({ saveVersion: SAVE_VERSION, contentVersion: CONTENT_VERSION, encoding: 'observation-pool-v1', requestSequence: 7, observationPool, checkpoint: { ...checkpoint, views } });
    expect(decodeSave(legacy)).toEqual({ checkpoint, requestSequence: 7 });
    let raw = legacy;
    const c = createGameController({ feedback: true, storage: { getItem: key => key === SAVE_KEY ? raw : null, setItem: (_key, value) => { raw = value; } } });
    expect(c.getSnapshot().storageStatus.state).toBe('saved');
    c.dismissOnboarding(); expect(JSON.parse(raw).encoding).toBe('object-pool-v2');
    expect(() => decodeSave(JSON.stringify({ saveVersion: SAVE_VERSION, contentVersion: CONTENT_VERSION, encoding: 'object-pool-v2', requestSequence: 0, root: 0, pool: [['a', [0]]] }))).toThrow();
  });
  it('explains freshness as the age of information, without confusing it with crop age or confidence', () => {
    expect(t('zh', informationAge(0, true))).toBe('当天');
    expect(t('zh', informationAge(4, true))).toBe('4天前');
    expect(t('en', informationAge(1, true))).toBe('1 day ago');
    expect(t('en', informationAge(5, true))).toBe('5 days ago');
    expect(t('zh', informationAge(99, false))).toBe('暂无信息');
    expect(t('zh', informationAge(99, true))).toBe('99天前');
    expect(t('en', 'Information Freshness')).toBe('Information Freshness');
    expect(t('zh', 'Information Freshness')).toBe('信息新鲜度');
    const c = controller();
    c.scheduleTask({ unitId: 'PU-01', date: view(c).currentDate, actions: ['inspection'] });
    c.executeDay();
    let unit = view(c).management.units.find(u => u.id === 'PU-01');
    expect(unit.water.freshness).toBe(0); expect(unit.cropFreshness).toBe(0);
    expect(unit.water.observedAt).toBe(unit.latestInspection.observedAt);
    c.executeDay(); unit = view(c).management.units.find(u => u.id === 'PU-01');
    expect(unit.water.freshness).toBe(0); expect(unit.cropFreshness).toBe(1);
    expect(unit.water.source).toBe('sensor');
  });
  it('keeps volume, area, depth, IDs and punctuation separate from language labels', () => {
    for (const unit of ['m³', 'm3']) { expect(t('zh', `20 ${unit}`)).toBe('20 立方米'); expect(t('zh', unit)).toBe('立方米'); }
    expect(t('en', '20 立方米')).toBe('20 m³');
    expect(t('zh', '1.25 ha')).toBe('1.25 公顷'); expect(t('zh', '3.2 mm')).toBe('3.2 毫米');
    expect(t('zh', '/')).toBe('/'); expect(t('zh', ' / ')).toBe(' / ');
    expect(t('zh', 'PU-03')).toBe('PU-03'); expect(t('zh', '72 / 100')).toBe('72 / 100');
    expect(t('zh', '¥2 / m³')).not.toMatch(/农|月/);
  });
});
