import { describe, it, expect } from 'vitest';
import { localizeGameText as t } from '../src/game/localization.js';
import { GAME_TEXT, GAME_LABELS, GAME_MESSAGES, GAME_MIXED } from '../src/game/gameText.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';
import { createGameController } from '../src/game/GameController.js';

describe('Phase 2 interface localization', () => {
  it('renders the requested gameplay terms in one language', () => {
    const pairs = [['Water Stress', '水分胁迫'], ['Execution', '执行'], ['morning', '早会'], ['Normal', '正常'], ['Manager Attention', '经理注意力']];
    for (const [en, zh] of pairs) { expect(t('zh', en)).toBe(zh); expect(t('en', zh)).not.toMatch(/[\u4e00-\u9fff]/); }
    expect(t('zh', '开始 Execution')).toBe('开始执行');
    expect(t('en', '开始 Execution')).toBe('Start execution');
    expect(t('zh', '5d+')).toBe('5天+');
    expect(t('zh', '72 / 100')).toBe('72 / 100');
  });
  it('covers all authored UI and system messages in English', () => {
    for (const [source] of [...GAME_TEXT, ...GAME_LABELS, ...GAME_MESSAGES, ...GAME_MIXED]) {
      expect(t('en', source), source).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
  it('covers authored case descriptions, option hints and team guidance', () => {
    const fixture = createYunnanBlueberryFixture();
    for (const c of fixture.decisionTemplates) {
      const texts = [c.title, c.description, ...c.disagreementTopics, ...c.participantGuidance.map(g => g.text), ...c.opportunityCosts.map(o => o.label), ...[...c.actionOptions, ...c.investigationOptions].flatMap(o => [o.label, o.description])].filter(Boolean);
      for (const text of texts) expect(t('en', text), text).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
  it('selects one language from crop guides without losing the finding value', () => {
    expect(t('zh', 'Pollination and fruit set / 授粉与坐果')).toBe('授粉与坐果');
    expect(t('en', 'Pollination and fruit set / 授粉与坐果')).toBe('Pollination and fruit set');
    expect(t('en', 'Stage / 阶段: fruit_set')).toBe('Growth stage: Fruit development');
    expect(t('zh', 'Growth / 长势: vigorous / 良好')).toBe('长势: 良好');
  });
  it('localizes dynamic execution results and AI rationale without mutating engine data', () => {
    const c = createGameController({ feedback: true, storage: null });
    const d = c.openDecision('PU-04', 'AI Assistant').decision;
    expect(t('zh', d.rationale)).not.toMatch(/Water stress|confidence|freshness|equipment|scheduled actions/);
    const cp = structuredClone(c.getSnapshot());
    const date = cp.view.currentDate;
    c.scheduleTask({ unitId: 'PU-01', date, actions: ['inspection', 'manual_watering'] }); c.advance();
    const after = c.getSnapshot();
    const before = structuredClone(after);
    for (const result of after.view.management.lastResults[0].results) {
      expect(t('zh', result.message)).not.toMatch(/inspected|confidence|Water Stress|Formal update|Findings/);
      expect(t('en', result.message)).not.toMatch(/[\u4e00-\u9fff]/);
    }
    expect(after).toEqual(before);
    expect(t('en', 'PU-01')).toBe('PU-01'); expect(t('zh', '2026-03-01')).toBe('2026-03-01');
    expect(t('zh', 100)).toBe(100); expect(t('zh', false)).toBe(false);
  });
});
