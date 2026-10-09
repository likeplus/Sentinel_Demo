import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GROWTH_STAGES } from '../src/domain/growthStages.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';
import { STAGE_GUIDE } from '../src/simulation/FarmManagement.js';
import { CROP_KNOWLEDGE } from '../src/game/content/cropKnowledge.js';
import { CropEncyclopedia } from '../src/game/GuideViews.jsx';
import { GameLocaleContext } from '../src/game/GameLocaleContext.js';
import { localizeGameText as t } from '../src/game/localization.js';
import { temperatureText } from '../src/game/displayFormat.js';
import { dailyReviewRows } from '../src/game/dailyReview.js';
import { createGameController } from '../src/game/GameController.js';
import { withPlaytestFeedback } from '../src/game/feedbackFixture.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';

const cycle = CROP_KNOWLEDGE.blueberry.sections.find(section => section.id === 'cycle');
const renderKnowledge = (unit, locale = 'zh') => renderToStaticMarkup(createElement(GameLocaleContext.Provider,
  { value: { locale } }, createElement(CropEncyclopedia, { unit, navigate: () => {} })));

describe('Phase 2 review clarity', () => {
  it('matches all five playable stages across PU labels, inspection guides and bilingual encyclopedia cards', () => {
    for (const id of blueberryPack.stages) {
      const card = cycle.stages.find(card => card.id === id);
      expect(card.title).toEqual(GROWTH_STAGES[id]);
      expect(card.facts.map(fact => fact.key)).toEqual(['happening', 'water', 'pest', 'observe', 'priority', 'mistake', 'business']);
      expect(STAGE_GUIDE[id]).toMatchObject({ label: card.title.en, zh: card.title.zh });
      for (const locale of ['en', 'zh']) {
        expect(t(locale, id)).toBe(card.title[locale]);
        expect(t(locale, card.title.zh)).toBe(card.title[locale]);
        const unit = { id: 'PU-01', cropPackId: 'blueberry', stage: { value: id, label: card.title.zh, observedAt: '2026-02-25' } };
        const html = renderKnowledge(unit, locale);
        expect(html.match(/data-current-stage="true"/g)).toHaveLength(1);
        expect(html).toContain(`data-guide-card="${id}" data-current-stage="true"`);
        expect(html).toContain('2026-02-25');
      }
    }
    expect(cycle.stages.find(card => card.id === 'harvest').title.zh).toBe('采收期');
    expect(cycle.stages.some(card => card.id === 'postharvest')).toBe(false);
    expect(CROP_KNOWLEDGE.blueberry.sections.flatMap(section => section.cards || []).some(card => card.id === 'postharvest')).toBe(true);
  });

  it('does not invent a current stage for an unknown unit, or change state while reading', () => {
    const c = createGameController({ feedback: true, storage: null });
    const before = structuredClone(c.getSnapshot());
    const unit = before.model.units.find(unit => unit.stage.value === null);
    expect(unit.cropPackId).toBe('blueberry');
    const html = renderKnowledge(unit);
    expect(html).toContain('阶段未知：请安排巡查');
    expect(html).not.toContain('data-current-stage="true"');
    expect(renderKnowledge(undefined)).not.toContain('data-current-stage="true"');
    expect(c.getSnapshot()).toEqual(before);
  });

  it('formats temperatures without rounding the underlying value and localizes complete condition labels', () => {
    const weather = { temperature: 19.783946068026125 };
    expect(temperatureText(weather.temperature)).toBe('19.8°C');
    expect(weather.temperature).toBe(19.783946068026125);
    expect(temperatureText(0)).toBe('0.0°C');
    expect(temperatureText(-1.26)).toBe('-1.3°C');
    expect(temperatureText(null)).toBe('—');
    for (const label of ['Crop Condition', 'Equipment Condition']) {
      expect(t('zh', label)).not.toMatch(/[a-z]/i);
      expect(t('en', t('zh', label))).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('reviews consumed water rather than planned or effective water and keeps the work date the next morning', () => {
    const c = createGameController({ feedback: true, storage: null });
    const date = c.getSnapshot().view.currentDate;
    expect(c.scheduleTask({ unitId: 'PU-01', date, actions: ['inspection', 'manual_watering'] }).accepted).toBe(true);
    c.executeDay();
    const m = c.getSnapshot().view.management;
    const rows = dailyReviewRows(m);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date, status: 'completed', labor: 3, water: 15 });
    expect(m.tasks[0].actualOutput.water).toBe(11.25);
    expect(rows[0].observations).toHaveLength(1);
    expect(rows[0].cost).toBeGreaterThan(0);
    c.executeDay();
    expect(dailyReviewRows(c.getSnapshot().view.management)[0]).toMatchObject({ date, water: 15 });
  });

  it('counts a shared task once and shows zero consumption for a blocked task despite its planned quote', () => {
    const shared = { id: 'shared', productionUnitIds: ['PU-01', 'PU-02'], actions: ['irrigation'], water: 40,
      actualOutput: { waterConsumed: 30 }, cost: 100, actualStart: '2026-03-01' };
    const blocked = { id: 'blocked', actions: ['irrigation'], water: 20, expectedCost: 50,
      deviations: [{ type: 'resource_unavailable', date: '2026-03-01' }] };
    const rows = dailyReviewRows({ tasks: [shared, blocked], observations: [], expectedImpacts: [], lastResults: [
      { taskId: 'shared', unitId: 'PU-01', status: 'completed', labor: 2, results: [] },
      { taskId: 'blocked', unitId: 'PU-03', status: 'blocked', labor: 0, results: [] },
    ] });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ unitIds: ['PU-01', 'PU-02'], water: 30, cost: 100 });
    expect(rows[1]).toMatchObject({ unitIds: ['PU-03'], water: 0, cost: 0, labor: 0 });
    expect(rows.reduce((sum, row) => sum + row.water, 0)).toBe(30);
  });

  it('keeps actual labor and cost for a failed irrigation while reporting zero water use', () => {
    const fixture = withPlaytestFeedback(createYunnanBlueberryFixture());
    fixture.management.equipment['PU-01'].status = 'Fault';
    const c = createGameController({ fixture, storage: null });
    const date = c.getSnapshot().view.currentDate;
    expect(c.scheduleTask({ unitId: 'PU-01', date, actions: ['inspection', 'irrigation'] }).accepted).toBe(true);
    const before = c.getSnapshot().view.resources.find(resource => resource.id === 'water').quantity;
    c.executeDay();
    const m = c.getSnapshot().view.management;
    const row = dailyReviewRows(m)[0];
    expect(row).toMatchObject({ status: 'failed', labor: 2, water: 0 });
    expect(row.cost).toBeGreaterThan(0);
    expect(row.observations).toHaveLength(1);
    expect(row.results.some(result => result.action === 'irrigation' && result.status === 'failed')).toBe(true);
    expect(c.getSnapshot().view.resources.find(resource => resource.id === 'water').quantity).toBe(before);
  });
});
