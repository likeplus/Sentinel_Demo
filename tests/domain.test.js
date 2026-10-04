import { describe, expect, it } from 'vitest';
import { createScenario, scenarioDuration, createProductionUnit, createObservation, createPerson,
  createBelief, createDecisionCase, DECISION_ACTIONS, createOperation, createResource,
  detectResourceConflicts, createFinance, recordExpense } from '../src/domain/index.js';
import { addDays } from '../src/domain/validation.js';
const scenario = days => createScenario({id:'duration',name:'Duration',farmConfigId:'farm',startDate:'2026-03-01',endDate:addDays('2026-03-01',days)});
const crew = createResource({id:'crew-a',name:'Crew A',type:'crew',capacityPerDay:1});
const op = (id, duration, date='2026-03-04', extra={}) => createOperation({id,type:'irrigation',plannedStart:date,plannedDurationDays:duration,assignedResourceIds:['crew-a'],...extra});

describe('serializable domain foundation', () => {
  it.each([28,120])('calculates %i days from dates', days => expect(scenarioDuration(scenario(days))).toBe(days));
  it('uses UTC across leap days, validates calendar dates and stepDays', () => {
    expect(addDays('2024-02-28',2)).toBe('2024-03-01');
    expect(()=>scenario(0)).toThrow();
    expect(()=>createScenario({...scenario(28),startDate:'2026-02-30'})).toThrow();
    expect(()=>createScenario({...scenario(28),stepDays:0.5})).toThrow();
  });
  it.each(['polygon','quadrilateral','hexagon'])('accepts simplified %s geometry', type => {
    const count={polygon:5,quadrilateral:4,hexagon:6}[type];
    const unit=createProductionUnit({id:'PU-03',farmId:'farm',name:'Block 3',geometry:{type,coordinates:Array.from({length:count},(_,i)=>[i,i%2])}});
    expect(JSON.parse(JSON.stringify(unit))).toEqual(unit);
    expect(unit).not.toHaveProperty('fieldId');
  });
  it('rejects lossy data and invalid observation time/status', () => {
    expect(()=>createPerson({id:'a',name:'A',role:'manager',traits:{fn:()=>1}})).toThrow();
    const sample={id:'sample',productionUnitId:'PU-03',variable:'waterStress',value:0.7,observedAt:'2026-03-04',availableAt:'2026-03-06'};
    expect(createObservation(sample).freshness).toBe(2);
    expect(()=>createObservation({...sample,availableAt:'2026-03-03'})).toThrow();
    expect(()=>createObservation({...sample,status:'made-up'})).toThrow();
  });
  it('represents differing beliefs and all six decision choices', () => {
    const first=createBelief({id:'b1',actorId:'agronomist',productionUnitId:'PU-03',subject:'waterStress',estimate:0.3,updatedAt:'2026-03-04'});
    const second=createBelief({...first,id:'b2',actorId:'sentinel',estimate:0.8});
    expect(first.estimate).not.toBe(second.estimate);
    expect(createDecisionCase({id:'case',title:'Water stress',openedAt:'2026-03-04'}).actionOptions.map(o=>o.type)).toEqual(DECISION_ACTIONS);
  });
});
describe('operation reservations and finance', () => {
  it('detects 1.25 day over-allocation without conflating different dates', () => {
    expect(detectResourceConflicts([op('a',0.75),op('b',0.5)],[crew])).toMatchObject([{type:'capacity',requested:1.25,available:1}]);
    expect(detectResourceConflicts([op('a',0.75),op('b',0.5,'2026-03-05')],[crew])).toEqual([]);
  });
  it('counts travel, attendance, missing resources and compatibility', () => {
    expect(detectResourceConflicts([op('a',1,'2026-03-04',{travelOverhead:0.25})],[crew])[0].requested).toBe(1.25);
    expect(detectResourceConflicts([op('a',0.75)],[{...crew,availability:{'2026-03-04':0.5}}])[0].available).toBe(0.5);
    expect(detectResourceConflicts([op('a',0.25)],[])[0].type).toBe('missing_resource');
    expect(detectResourceConflicts([op('a',0.25)],[{...crew,compatibleOperations:['harvest']}])[0].type).toBe('incompatible_operation');
  });
  it('reserves inventory across dates and rejects invalid allocations', () => {
    const water=createResource({id:'water',name:'Water',type:'water',quantity:100,unit:'m3'});
    const irrigation=(id,date)=>op(id,0.25,date,{assignedResourceIds:['water'],resourceQuantities:{water:60}});
    expect(detectResourceConflicts([irrigation('a','2026-03-04'),irrigation('b','2026-03-05')],[water])).toMatchObject([{type:'inventory',requested:120,available:100}]);
    expect(()=>op('a',1.25)).toThrow();
    expect(()=>op('a',0.5,'2026-03-04',{plannedOutput:{water:-1}})).toThrow();
  });
  it('updates cash/expenses once per transaction and records emergency purchases', () => {
    const expense={id:'expense',date:'2026-03-04',amount:50,sourceId:'op',emergency:true};
    const initial=createFinance({cash:100});const next=recordExpense(initial,expense);
    expect(next.cash).toBe(50);expect(next.operatingCostToDate).toBe(50);
    expect(next.emergencyPurchases).toHaveLength(1);expect(initial.cash).toBe(100);
    expect(recordExpense(next,expense)).toEqual(next);
  });
});
