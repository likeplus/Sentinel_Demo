import { describe, expect, it } from 'vitest';
import { generate60DayData, getSnapshot } from '../src/engine/simulationEngine.js';
import { SCENARIOS } from '../src/engine/scenarioEngine.js';
import { assessRisks } from '../src/engine/decisionEngine.js';
import { executePresciption } from '../src/engine/executionEngine.js';
import { generateAuditRecord } from '../src/engine/auditEngine.js';

describe('legacy demo safety net', () => {
  it('still produces the 60-day lifecycle and risk inputs without React', () => {
    const data = generate60DayData('BS-B3', 'blueberry');
    expect(data).toHaveLength(60);
    expect(data[0].hourly).toHaveLength(24);
    expect(assessRisks(getSnapshot(data[17], 10)).length).toBeGreaterThan(0);
  });
  it('preserves all six scripted scenarios', () => {
    expect(Object.keys(SCENARIOS)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    for (const scenario of Object.values(SCENARIOS)) expect(scenario.events.length).toBeGreaterThan(0);
  });
  it('keeps legacy execution fingerprints and audits operational', () => {
    const rx = { id:'RX-test', fieldId:'BS-B3', timestamp:'2026-03-01T00:00:00Z',
      action:'irrigation', dosageRatio:0.7, target:'BS-B3', constraints:{}, estimatedCost:100,
      constraintCheck:{violations:[]}, responsibilityBoundary:'system' };
    const execution=executePresciption(rx);
    expect(execution.executionFingerprint.match).toBe(true);
    expect(generateAuditRecord(rx,execution,80,30,{id:'BS-B3',crop:'blueberry',gradeClass:'A'}).fingerprintMatch).toBe(true);
  });
});
