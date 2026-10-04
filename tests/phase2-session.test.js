import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../src/simulation/SimulationEngine.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';
import { createGameController } from '../src/game/GameController.js';
import { buildGameModel } from '../src/game/selectors.js';
import { SAVE_KEY, encodeSave, decodeSave } from '../src/game/persistence.js';

const packs = { blueberry: blueberryPack };
function memoryStorage() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
}
const advance = (game, count) => { for (let i = 0; i < count; i++) expect(game.advance().accepted).toBe(true); };

describe('Phase 2 safe map projection', () => {
  it('keeps water freshness independent of stage, retains unknown and uses only delivered evidence', () => {
    const game = createGameController({ storage: null });
    const initial = game.getSnapshot();
    const stale = initial.model.units.find(unit => unit.id === 'PU-05');
    expect(stale.stage.status).toBe('current');
    expect(stale.water.status).toBe('stale');
    expect(initial.model.units.find(unit => unit.id === 'PU-09').water).toMatchObject({ value: null, status: 'unknown' });
    advance(game, 3);
    const pending = game.getSnapshot();
    expect(pending.view.observations.some(observation => observation.id === 'pu03-lab-day4')).toBe(false);
    expect(pending.model.units.find(unit => unit.id === 'PU-03').water.evidenceIds).not.toContain('pu03-lab-day4');
    expect(JSON.stringify(pending)).not.toMatch(/trueState|yieldPotential|qualityPotential|worldState|checkpoint|observationPool/);
    advance(game, 2);
    expect(game.getSnapshot().model.units.find(unit => unit.id === 'PU-03').water.evidenceIds).toContain('pu03-lab-day4');
  });

  it('does not change an earlier map when hidden truth or a pending report changes', () => {
    const original = createYunnanBlueberryFixture();
    const changed = structuredClone(original);
    changed.cropInstances[2].trueState.waterStress = 0.99;
    changed.cropInstances[2].stage = 'harvest';
    changed.observations.find(observation => observation.id === 'pu03-lab-day4').value = 0.01;
    const before = new SimulationEngine(original, packs).getPlayerView();
    const after = new SimulationEngine(changed, packs).getPlayerView();
    expect(buildGameModel(before, { scenario: original.scenario })).toEqual(buildGameModel(after, { scenario: original.scenario }));
  });

  it('retains the viewpoints actually available when a choice was made, after later reports arrive', () => {
    const game = createGameController({ storage: null }); advance(game, 3);
    const original = game.getSnapshot().view.decisionCases.find(decision => decision.id === 'water-stress-pu03').viewpoints;
    expect(game.decide('water-stress-pu03', { type: 'decide_now', optionId: 'irrigate-pu03', reasonText: '根据今天的证据补水' }).accepted).toBe(true);
    advance(game, 3);
    const decision = game.getSnapshot().view.decisionCases.find(item => item.id === 'water-stress-pu03');
    expect(decision.actionHistory[0].viewpoints).toEqual(original);
    expect(decision.actionHistory[0].evidenceIds).not.toContain('pu03-lab-day4');
    expect(decision.actionHistory[0].viewpoints.every(point => !point.basedOnObservationIds.includes('pu03-lab-day4'))).toBe(true);
    expect(decision.viewpoints.some(point => point.basedOnObservationIds.includes('pu03-lab-day4'))).toBe(true);
  });

  it('renders a smaller fixture without relying on twelve units or three clusters', () => {
    const fixture = createYunnanBlueberryFixture();
    fixture.productionUnits = fixture.productionUnits.slice(0, 3);
    fixture.cropInstances = fixture.cropInstances.slice(0, 3);
    fixture.farm.productionUnitIds = fixture.productionUnits.map(unit => unit.id);
    fixture.farm.clusterIds = ['CL-1'];
    fixture.observations = fixture.observations.filter(observation => fixture.farm.productionUnitIds.includes(observation.productionUnitId));
    const game = createGameController({ storage: null, fixture });
    expect(game.getSnapshot().model.units).toHaveLength(3);
    expect(game.getSnapshot().model.clusters).toHaveLength(1);
    expect(game.getSnapshot().model.varieties).toHaveLength(3);
  });
});

describe('Phase 2 browser session persistence', () => {
  it('restores a running session and the same future after accepted actions', () => {
    const storage = memoryStorage();
    const running = createGameController({ storage });
    expect(running.inspect('PU-03', { reasonText: '现场确认', requestId: 'inspection' }).accepted).toBe(true);
    advance(running, 3);
    expect(running.decide('water-stress-pu03', { type: 'delegate', delegatedTo: 'agronomist', reasonText: '先听农艺师建议' }).accepted).toBe(true);
    const restored = createGameController({ storage });
    expect(restored.getSnapshot().view).toEqual(running.getSnapshot().view);
    advance(running, 1); advance(restored, 1);
    expect(restored.getSnapshot().view).toEqual(running.getSnapshot().view);
    expect(restored.approve('water-stress-pu03', { reasonText: '依据现有报告批准' }).accepted).toBe(true);
    expect(running.approve('water-stress-pu03', { reasonText: '依据现有报告批准' }).accepted).toBe(true);
    advance(running, 2); advance(restored, 2);
    expect(restored.getSnapshot().view).toEqual(running.getSnapshot().view);
    expect(restored.getSnapshot().storageStatus.state).toBe('saved');
  });

  it('preserves incompatible and malformed saves until an explicit fresh start', () => {
    for (const saved of [JSON.stringify({ saveVersion: 999 }), '{broken']) {
      const storage = memoryStorage(); storage.setItem(SAVE_KEY, saved);
      const game = createGameController({ storage });
      expect(game.getSnapshot()).toMatchObject({ view: null, model: null, storageStatus: { state: 'blocked' } });
      expect(game.advance().accepted).toBe(false);
      expect(storage.getItem(SAVE_KEY)).toBe(saved);
      expect(game.resumeFresh().accepted).toBe(true);
      expect(game.getSnapshot().view.currentDayIndex).toBe(0);
      expect(decodeSave(storage.getItem(SAVE_KEY)).checkpoint.state.currentDayIndex).toBe(0);
    }
  });

  it('keeps playing when storage quota is exhausted and does not replace unreadable storage', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); } };
    const game = createGameController({ storage });
    expect(game.getSnapshot().storageStatus.state).toBe('warning');
    expect(game.inspect('PU-01').accepted).toBe(true);
    advance(game, 1);
    expect(game.getSnapshot().view.currentDayIndex).toBe(1);
    let writes = 0;
    const blocked = createGameController({ storage: { getItem: () => { throw new Error('read blocked'); }, setItem: () => { writes++; } } });
    advance(blocked, 1);
    expect(writes).toBe(0);
    expect(blocked.getSnapshot().storageStatus.state).toBe('warning');
  });

  it('round-trips all historical knowledge and keeps 28-day storage below common browser quota', () => {
    const sim = new SimulationEngine(createYunnanBlueberryFixture(), packs);
    while (!sim.ended) sim.advanceOneDay();
    const checkpoint = sim.exportCheckpoint();
    const encoded = encodeSave(checkpoint, 5);
    const decoded = decodeSave(encoded);
    expect(decoded.checkpoint).toEqual(checkpoint);
    expect(encoded.length * 2).toBeLessThan(5 * 1024 * 1024);
    const restored = SimulationEngine.restore(decoded.checkpoint, packs);
    expect(restored.getPlayerView('manager', '2026-03-04')).toEqual(sim.getPlayerView('manager', '2026-03-04'));
    expect(restored.getPlayerView('manager', '2026-03-04').observations.some(observation => observation.id === 'pu03-lab-day4')).toBe(false);
  });

  it('same seed and ordered actions reproduce results after restart, and changed horizon clamps correctly', () => {
    const game = createGameController({ storage: null });
    const play = () => { game.inspect('PU-03'); advance(game, 3); game.decide('water-stress-pu03', { type: 'decide_now', optionId: 'irrigate-pu03' }); advance(game, 4); return game.getSnapshot().view; };
    const first = play();
    expect(game.restart().accepted).toBe(true);
    expect(play()).toEqual(first);
    expect(game.restart({ seed: 'different-seed', days: 14 }).accepted).toBe(true);
    advance(game, 16);
    expect(game.getSnapshot().view).toMatchObject({ currentDayIndex: 14, currentDate: '2026-03-15', ended: true });
    expect(game.getSnapshot().model.totalDays).toBe(14);
    expect(game.getSnapshot().model.review.dimensions).toHaveLength(5);
  });
});
