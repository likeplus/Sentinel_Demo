import { describe, expect, it } from 'vitest';
import { rollEvents, validateEventRules } from '../src/simulation/EventEngine.js';
import { RandomEngine } from '../src/simulation/RandomEngine.js';
import { legacyFieldToProductionUnit } from '../src/adapters/legacyFieldAdapter.js';
import { legacyScenarioToScenario } from '../src/adapters/legacyScenarioAdapter.js';
import { legacyExecutionToOperation } from '../src/adapters/legacyExecutionAdapter.js';
import { SCENARIOS } from '../src/engine/scenarioEngine.js';
const rule={id:'test',eligibleWindow:{startDay:3,endDay:5},conditions:[{path:'resources.water.quantity',operator:'lt',value:100}],
  baseProbability:0.5,modifiers:[{conditions:[{path:'world.temperature',operator:'gt',value:25}],multiplier:2}],maxOccurrences:1,effects:[]};
const context={resources:{water:{quantity:20}},world:{temperature:30}};
describe('event windows/conditions/modifiers/limits', () => {
  it('does not roll outside windows, unmet conditions or occurrence caps', () => {
    const random=new RandomEngine(1),before=random.exportState();
    expect(rollEvents([rule],context,2,random,{}).rolls).toEqual([]);
    expect(rollEvents([rule],{...context,resources:{water:{quantity:200}}},3,random,{}).rolls).toEqual([]);
    expect(rollEvents([rule],context,3,random,{test:1}).rolls).toEqual([]);
    expect(random.exportState()).toEqual(before);
  });
  it('uses modifiers and inclusive eligible boundaries, including a zero-probability rule', () => {
    const result=rollEvents([rule],context,5,new RandomEngine(1),{});
    expect(result.rolls[0].probability).toBe(1);expect(result.events).toHaveLength(1);
    expect(rollEvents([{...rule,baseProbability:0}],context,3,new RandomEngine(1),{}).events).toEqual([]);
  });
  it('rejects unknown operators and malformed windows', () => {
    expect(()=>validateEventRules([{...rule,conditions:[{path:'a',operator:'nope',value:1}]}])).toThrow();
    expect(()=>validateEventRules([{...rule,eligibleWindow:{startDay:3,endDay:2}}])).toThrow();
  });
});
describe('additive legacy adapters', () => {
  it('maps old fields to generic PUs without mutating them', () => {
    const field={id:'BS-B3',name:'B3',crop:'blueberry',area_mu:15};
    const unit=legacyFieldToProductionUnit(field,{farmId:'farm'});
    expect(unit.area).toEqual({value:1,unit:'ha'});expect(unit.type).toBe('orchard_block');expect(field).not.toHaveProperty('farmId');
  });
  it('retains scripted scenario semantics and uses explicit dates', () => {
    const mapped=legacyScenarioToScenario(SCENARIOS.A,{startDate:'2026-03-01',endDate:'2026-03-29',farmConfigId:'farm'});
    expect(mapped.legacyScriptedEvents).toEqual(SCENARIOS.A.events);expect(mapped.eventRules).toEqual([]);
  });
  it('retains actual duration, deviations and fingerprints in a legacy execution', () => {
    const fingerprint={prescribed:'x',actual:'y',match:false};
    const mapped=legacyExecutionToOperation({id:'EX',prescriptionId:'RX',startTime:'2026-03-04T00:00:00Z',endTime:'2026-03-04T12:00:00Z',
      actualDosageRatio:1,actualCoverage_pct:90,status:'completed',deviations:[{parameter:'dosageRatio'}],executionFingerprint:fingerprint,method:'drone'},
    {timestamp:'2026-03-04T00:00:00Z',action:'spot_spray',dosageRatio:0.7},{productionUnitIds:['PU-03']});
    expect(mapped.actualDurationDays).toBe(0.5);expect(mapped.plannedOutput.dosageRatio).toBe(0.7);
    expect(mapped.actualOutput.dosageRatio).toBe(1);expect(mapped.legacyFingerprint).toEqual(fingerprint);
  });
});
