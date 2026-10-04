import { describe, expect, it } from 'vitest';
import { SimulationEngine, DAILY_PHASES } from '../src/simulation/SimulationEngine.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';
import { addDays } from '../src/domain/validation.js';
const packs={blueberry:blueberryPack};
const engine=overrides=>new SimulationEngine(createYunnanBlueberryFixture(overrides),packs);
const advanceTo=(sim,date)=>{while(sim.currentDate<date && !sim.ended)sim.advanceOneDay();return sim.getPlayerView();};
const complete=sim=>{while(!sim.ended)sim.advanceStep();return sim.getPlayerView();};
const operation=(id,duration=0.5,date='2026-03-05')=>({id,type:'irrigation',plannedStart:date,productionUnitIds:['PU-03'],plannedDurationDays:duration,
  assignedResourceIds:['crew-a','irrigation-rig','water'],resourceQuantities:{water:20},plannedOutput:{water:20}});

describe('Yunnan fixture and configurable simulation', () => {
  it('contains 1 farm, 12 PUs, 3 clusters/varieties, key staff, crew, water and live finance', () => {
    const fixture=createYunnanBlueberryFixture();
    expect(fixture.productionUnits).toHaveLength(12);expect(fixture.farm.clusterIds).toHaveLength(3);
    expect(new Set(fixture.cropInstances.map(c=>c.varietyId)).size).toBe(3);
    expect(fixture.people.map(p=>p.role)).toEqual(expect.arrayContaining(['farm_manager','agronomist','irrigation_manager','field_supervisor','maintenance_lead','sentinel_agent']));
    expect(fixture.scenario.criticalResourceIds).toEqual(['water']);expect(fixture.crews).toHaveLength(1);
    expect(fixture.resources.find(r=>r.id==='irrigation-rig')).toBeDefined();
    expect(JSON.parse(JSON.stringify(fixture))).toEqual(fixture);
    fixture.resources[0].quantity=0;expect(createYunnanBlueberryFixture().resources[0].quantity).toBe(3600);
  });
  it.each([28,120])('runs %i days through the same interface and stops at configured date', days => {
    const sim=engine({endDate:addDays('2026-03-01',days)});const view=complete(sim);
    expect(view.currentDayIndex).toBe(days);expect(view.currentDate).toBe(addDays('2026-03-01',days));
    expect(view.history).toHaveLength(days);expect(view.history[0].phases).toEqual(DAILY_PHASES);
    expect(sim.advanceOneDay()).toEqual(view);
  });
  it('advances configured multi-day steps and clamps the final partial step', () => {
    const sim=engine({stepDays:5});sim.advanceStep();expect(sim.currentDayIndex).toBe(5);
    expect(complete(sim).currentDayIndex).toBe(28);
  });
  it('reproduces entire fixtures, event rolls and checkpoints; different seeds differ', () => {
    const a=engine({seed:'same'}),b=engine({seed:'same'}),c=engine({seed:'different'});
    complete(a);complete(b);complete(c);
    expect(a.exportCheckpoint()).toEqual(b.exportCheckpoint());
    expect(a.exportCheckpoint().state.eventRolls).not.toEqual(c.exportCheckpoint().state.eventRolls);
  });
  it('restores simulation state with identical future events/output', () => {
    const first=engine();advanceTo(first,'2026-03-12');
    const restored=SimulationEngine.restore(JSON.parse(JSON.stringify(first.exportCheckpoint())),packs);
    expect(complete(restored)).toEqual(complete(first));
    expect(restored.exportCheckpoint().random).toEqual(first.exportCheckpoint().random);
  });
  it('uses an injected alternate crop pack and player actor, with no core redesign', () => {
    const fixture=createYunnanBlueberryFixture({cropPackIds:['test-crop'],playerRole:'agronomist'});
    fixture.cropInstances=fixture.cropInstances.map(c=>({...c,cropPackId:'test-crop'}));
    const alternate={...blueberryPack,id:'test-crop',advanceCrop:(crop)=>({...crop,stage:'test-stage'})};
    const sim=new SimulationEngine(fixture,{'test-crop':alternate});sim.advanceOneDay();
    expect(sim.getPlayerView().actorId).toBe('agronomist');
    expect(sim.exportCheckpoint().state.farmState.cropInstances[0].stage).toBe('test-stage');
  });
  it('rejects unresolved fixture references', () => {
    const fixture=createYunnanBlueberryFixture();fixture.productionUnits[0].farmId='missing';
    expect(()=>new SimulationEngine(fixture,packs)).toThrow();
    expect(()=>new SimulationEngine(createYunnanBlueberryFixture(),{})).toThrow();
  });
});
describe('player view and replay cannot expose future evidence or hidden truth', () => {
  it('holds Day-4 lab data until Day 6 and keeps beliefs/decision evidence time-safe', () => {
    const sim=engine();const day5=advanceTo(sim,'2026-03-05');
    expect(day5.observations.some(o=>o.id==='pu03-lab-day4')).toBe(false);
    const ids=new Set(day5.observations.map(o=>o.id));
    for(const belief of day5.beliefs) expect(belief.basedOnObservationIds.every(id=>ids.has(id))).toBe(true);
    for(const decision of day5.decisionCases) {
      expect(decision.availableObservationIds.every(id=>ids.has(id))).toBe(true);
      expect(decision.viewpoints.every(b=>b.basedOnObservationIds.every(id=>ids.has(id)))).toBe(true);
    }
    const day6=sim.advanceOneDay();expect(day6.observations.some(o=>o.id==='pu03-lab-day4')).toBe(true);
    expect(sim.getPlayerView('manager','2026-03-05')).toEqual(day5);
    expect(()=>sim.getPlayerView('manager','2026-03-07')).toThrow();
    expect(JSON.stringify(day6)).not.toContain('trueState');expect(day6).not.toHaveProperty('worldState');
    const checkpoint=sim.exportCheckpoint();day6.resources[0].quantity=-1;
    expect(sim.exportCheckpoint()).toEqual(checkpoint);
  });
  it('changing hidden crop truth/future samples cannot change the current player view', () => {
    const first=createYunnanBlueberryFixture({eventRules:[]});
    const changed=createYunnanBlueberryFixture({eventRules:[]});
    first.observationProfiles=[];changed.observationProfiles=[];
    changed.cropInstances.forEach(c=>{c.trueState.waterStress=1;c.trueState.qualityPotential=0;});
    changed.observations.find(o=>o.id==='pu03-lab-day4').value=0;
    const a=new SimulationEngine(first,packs),b=new SimulationEngine(changed,packs);
    expect(a.getPlayerView()).toEqual(b.getPlayerView());
    expect(advanceTo(a,'2026-03-05')).toEqual(advanceTo(b,'2026-03-05'));
    expect(a.advanceOneDay().observations).not.toEqual(b.advanceOneDay().observations);
    expect(a.getPlayerView('manager','2026-03-05')).toEqual(b.getPlayerView('manager','2026-03-05'));
  });
  it('stales observations without modifying trueState', () => {
    const sim=engine();advanceTo(sim,'2026-03-10');
    const before=sim.exportCheckpoint().state.farmState.cropInstances;
    expect(sim.getPlayerView().observations.find(o=>o.id==='pu03-sensor-day4').status).toBe('stale');
    expect(sim.exportCheckpoint().state.farmState.cropInstances).toEqual(before);
  });
  it('separates actor beliefs from the same sensor/worker conflict', () => {
    const sim=engine();advanceTo(sim,'2026-03-04');
    const a=sim.getPlayerView('agronomist').beliefs.find(b=>b.productionUnitId==='PU-03');
    const b=sim.getPlayerView('sentinel').beliefs.find(b=>b.productionUnitId==='PU-03');
    expect(a.basedOnObservationIds).toEqual(b.basedOnObservationIds);expect(a.estimate).not.toBe(b.estimate);
    expect(sim.getPlayerView('agronomist').beliefs.every(b=>b.actorId==='agronomist')).toBe(true);
  });
});
describe('decision → operation → outcome/finance', () => {
  it('links disagreement evidence/viewpoints to selected irrigation, actual execution and ledger', () => {
    const sim=engine();const view=advanceTo(sim,'2026-03-04');
    const decision=view.decisionCases.find(c=>c.id==='water-stress-pu03');
    expect(decision.availableObservationIds).toContain('pu03-sensor-day4');expect(decision.disagreementTopics.length).toBeGreaterThan(0);
    expect(decision.viewpoints.some(b=>b.actorId==='sentinel')).toBe(true);
    const cash=view.finance.cash;
    const result=sim.decide(decision.id,{type:'decide_now',optionId:'irrigate-pu03',reasonTags:['worker-check'],reasonText:'Respond to uncertain stress'});
    expect(result.accepted).toBe(true);const next=sim.advanceOneDay();const op=next.operations[0];
    expect(op.executionStatus).toBe('completed');expect(op.actualOutput.water).toBeLessThan(op.plannedOutput.water);
    expect(op.actualStart).toBe('2026-03-05');expect(op.deviations.some(d=>d.type==='productivity')).toBe(true);
    expect(next.resources.find(r=>r.id==='water').quantity).toBe(view.resources.find(r=>r.id==='water').quantity-20);
    expect(next.finance.cash).toBe(cash-op.cost);expect(next.finance.transactions).toHaveLength(1);
    const resolved=next.decisionCases.find(c=>c.id===decision.id);
    expect(resolved.resultingOperationIds).toContain(op.id);expect(resolved.outcomeIds).toContain(`outcome:${op.id}`);
    sim.advanceOneDay();expect(sim.getPlayerView().finance.transactions).toHaveLength(1);
  });
  it('rejects nonserializable decisions before reserving resources', () => {
    const sim=engine();advanceTo(sim,'2026-03-04');
    const before=sim.getPlayerView();
    expect(()=>sim.decide('water-stress-pu03',{type:'decide_now',optionId:'irrigate-pu03',reasonTags:[()=>1]})).toThrow();
    expect(sim.getPlayerView()).toEqual(before);
  });
  it('generates delayed inspection evidence then allows another decision', () => {
    const sim=engine();advanceTo(sim,'2026-03-04');
    expect(sim.decide('water-stress-pu03',{type:'gather_information',optionId:'inspect-pu03'}).accepted).toBe(true);
    const day5=sim.advanceOneDay();expect(day5.observations.some(o=>o.sourceId==='inspection:OP-1')).toBe(false);
    expect(day5.decisionCases[0].status).toBe('investigating');
    const day6=sim.advanceOneDay();expect(day6.observations.some(o=>o.sourceId==='inspection:OP-1')).toBe(true);
    expect(day6.decisionCases[0].status).toBe('open');
    expect(sim.decide('water-stress-pu03',{type:'no_action',reasonText:'Inspection completed'}).accepted).toBe(true);
  });
  it.each(['delegate','delay','no_action','custom'])('represents %s choice', type => {
    const sim=engine();advanceTo(sim,'2026-03-04');
    sim.decide('water-stress-pu03',{type,...(type==='delegate'?{delegatedTo:'agronomist'}:{})});
    expect(sim.getPlayerView().decisionCases[0].selectedAction.type).toBe(type);
  });
  it('rejects 1.25-day reservations and insufficient water without mutating the accepted schedule', () => {
    const sim=engine();advanceTo(sim,'2026-03-04');
    expect(sim.scheduleOperation(operation('a',0.75)).accepted).toBe(true);
    const result=sim.scheduleOperation(operation('b',0.5));
    expect(result.accepted).toBe(false);expect(result.conflicts.some(c=>c.requested===1.25)).toBe(true);
    expect(sim.getPlayerView().operations).toHaveLength(1);
    expect(sim.scheduleOperation({...operation('c',0.25,'2026-03-06'),resourceQuantities:{water:4000}}).accepted).toBe(false);
  });
  it('rechecks attendance on execution, blocks over-capacity, and records delay', () => {
    const fixture=createYunnanBlueberryFixture({eventRules:[]});fixture.resources.find(r=>r.id==='crew-a').availability['2026-03-05']=0.5;
    const sim=new SimulationEngine(fixture,packs);advanceTo(sim,'2026-03-04');
    // Already reduced capacity is detected before scheduling.
    expect(sim.scheduleOperation(operation('rejected',0.75)).accepted).toBe(false);
    const another=createYunnanBlueberryFixture({eventRules:[{id:'absence',name:'Absence',eligibleWindow:{startDay:4,endDay:4},conditions:[],baseProbability:1,modifiers:[],maxOccurrences:1,effects:[{type:'resource_availability',resourceId:'crew-a',factor:0.5}]}]});
    const dynamic=new SimulationEngine(another,packs);advanceTo(dynamic,'2026-03-04');
    expect(dynamic.scheduleOperation(operation('delayed',0.75)).accepted).toBe(true);
    expect(dynamic.advanceOneDay().operations[0].executionStatus).toBe('blocked');
    const completed=dynamic.advanceOneDay().operations[0];expect(completed.executionStatus).toBe('completed');
    expect(completed.deviations.some(d=>d.type==='attendance_delay')).toBe(true);
  });
});
