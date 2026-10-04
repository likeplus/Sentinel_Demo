import { describe, expect, it } from 'vitest';
import { createObservation, createPerson, createOperation, detectResourceConflicts } from '../src/domain/index.js';
import { OBSERVATION_CATEGORIES } from '../src/domain/observation.js';
import { availableObservations, sampleObservations, updateBeliefs } from '../src/simulation/ObservationEngine.js';
import { RandomEngine } from '../src/simulation/RandomEngine.js';
import { SimulationEngine } from '../src/simulation/SimulationEngine.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';

const packs = {blueberry:blueberryPack};
const stageReport = overrides => createObservation({id:'stage-report',productionUnitId:'PU-01',sourceType:'worker',sourceId:'scout',
  variable:'stage',valueType:'category',value:'ripening',observedAt:'2026-03-04',availableAt:'2026-03-06',freshness:2,...overrides});
const advanceTo = (sim,date) => {while(sim.currentDate<date && !sim.ended)sim.advanceOneDay();return sim.getPlayerView();};

describe('categorical stage evidence uses the observation delivery boundary', () => {
  it('accepts only the explicit stage vocabulary and retains numeric validation', () => {
    for (const value of OBSERVATION_CATEGORIES.stage) expect(stageReport({value}).value).toBe(value);
    expect(createObservation({...stageReport(),valueType:'category'}).valueType).toBe('category');
    expect(()=>stageReport({value:'healthy'})).toThrow();
    expect(()=>stageReport({variable:'waterStress',value:'harvest'})).toThrow();
    expect(()=>stageReport({valueType:'number',value:0.5})).toThrow();
    expect(()=>createObservation({...stageReport(),variable:'waterStress',valueType:'number',value:'0.5'})).toThrow();
    expect(createObservation({...stageReport(),variable:'waterStress',valueType:'number',value:0.5}).value).toBe(0.5);
  });

  it('holds categorical samples until delivered and ages only their own freshness', () => {
    const report=stageReport();
    expect(availableObservations([report],'2026-03-05')).toEqual([]);
    expect(availableObservations([report],'2026-03-06')[0]).toMatchObject({value:'ripening',status:'current'});
    expect(availableObservations([report],'2026-03-07')[0].status).toBe('stale');
    expect(report.status).toBe('current');
  });

  it('samples stage privately into a delayed report without consuming numeric random draws', () => {
    const crop={id:'crop',productionUnitId:'PU-01',stage:'harvest',trueState:{waterStress:0.8}};
    const profile={id:'scout',sourceType:'worker',variable:'stage',everyDays:1,delayDays:2,uncertainty:0,reliability:0.9,freshness:3};
    const random=new RandomEngine('report-boundary'),before=random.exportState();
    const reports=sampleObservations([crop],[profile],'2026-03-04',3,random);
    expect(reports[0]).toMatchObject({variable:'stage',valueType:'category',value:'harvest',availableAt:'2026-03-06'});
    expect(availableObservations(reports,'2026-03-05')).toEqual([]);
    expect(random.exportState()).toEqual(before);
    expect(reports[0]).not.toHaveProperty('trueState');
    expect(sampleObservations([{...crop,stage:'custom-pack-stage'}],[profile],'2026-03-04',3,random)).toEqual([]);
  });

  it('excludes categorical reports from numeric beliefs while retaining numeric evidence', () => {
    const person=createPerson({id:'manager',name:'Manager',role:'farm_manager'});
    const numeric=createObservation({...stageReport(),id:'numeric',variable:'waterStress',valueType:'number',value:0.7});
    const beliefs=updateBeliefs([person],[stageReport(),numeric],'2026-03-06');
    expect(beliefs).toHaveLength(1);
    expect(beliefs[0]).toMatchObject({subject:'waterStress',estimate:0.7,basedOnObservationIds:['numeric']});
  });
});

describe('Phase 2 Yunnan content has playable, evidence-based decisions', () => {
  it('starts with current, stale and unknown water evidence independently of stage coverage', () => {
    const view=new SimulationEngine(createYunnanBlueberryFixture(),packs).getPlayerView();
    const water=id=>view.observations.filter(o=>o.productionUnitId===id && o.variable==='waterStress');
    expect(water('PU-01')[0].status).toBe('current');
    expect(water('PU-05')[0].status).toBe('stale');
    expect(view.observations.find(o=>o.productionUnitId==='PU-05' && o.variable==='stage').status).toBe('current');
    expect(water('PU-09')).toEqual([]);
    expect(view.observations.filter(o=>o.productionUnitId==='PU-09' && o.variable==='stage')).toEqual([]);
  });

  it('keeps stage evidence unchanged when hidden crop stage or future scout samples change', () => {
    const first=createYunnanBlueberryFixture({eventRules:[]}),changed=createYunnanBlueberryFixture({eventRules:[]});
    changed.cropInstances.forEach(c=>{c.stage='harvest';c.trueState.waterStress=1;});
    expect(new SimulationEngine(first,packs).getPlayerView()).toEqual(new SimulationEngine(changed,packs).getPlayerView());
    const sim=new SimulationEngine(first,packs);
    const day11=advanceTo(sim,'2026-03-12');
    expect(day11.observations.filter(o=>o.productionUnitId==='PU-09' && o.variable==='stage')).toEqual([]);
    const day12=sim.advanceOneDay();
    expect(day12.observations.find(o=>o.productionUnitId==='PU-09' && o.variable==='stage')).toMatchObject({observedAt:'2026-03-11',availableAt:'2026-03-13'});
    expect(sim.getPlayerView('manager','2026-03-12')).toEqual(day11);
  });

  it('default seed triggers all three event themes within their eligibility windows', () => {
    const fixture=createYunnanBlueberryFixture();
    const sim=new SimulationEngine(fixture,packs);
    while(!sim.ended)sim.advanceOneDay();
    const state=sim.exportCheckpoint().state;
    expect(sim.getPlayerView().decisionCases.map(c=>c.id)).toEqual(expect.arrayContaining(['water-stress-pu03','valve-disruption','pre-harvest']));
    for (const id of ['observation-conflict','sensor-valve-anomaly','pre-harvest-tradeoff']) {
      const event=state.eventHistory.find(e=>e.ruleId===id),rule=fixture.scenario.eventRules.find(r=>r.id===id);
      const day=(Date.parse(event.date)-Date.parse(fixture.scenario.startDate))/86400000;
      expect(day).toBeGreaterThanOrEqual(rule.eligibleWindow.startDay);
      expect(day).toBeLessThanOrEqual(rule.eligibleWindow.endDay);
      expect(rule.baseProbability).toBeGreaterThan(0);expect(rule.baseProbability).toBeLessThan(1);
    }
    expect(state.eventHistory.find(e=>e.ruleId==='pre-harvest-tradeoff').date<'2026-03-26').toBe(true);
  });

  it('each decision supplies costed operations, investigation, perspectives and consequences', () => {
    const fixture=createYunnanBlueberryFixture();
    for (const decision of fixture.decisionTemplates) {
      const actions=decision.actionOptions.filter(o=>o.type==='decide_now');
      expect(actions.length).toBeGreaterThan(0);
      expect(decision.investigationOptions.length).toBeGreaterThan(0);
      expect(decision.participantGuidance.length).toBeGreaterThan(1);
      expect(decision.opportunityCosts.length).toBeGreaterThan(0);
      for (const action of actions) {
        expect(action.label.length).toBeGreaterThan(0);expect(action.description.length).toBeGreaterThan(0);
        expect(action.estimatedCost).toBeGreaterThan(0);expect(action.operation.productionUnitIds.length).toBeGreaterThan(0);
      }
    }
  });

  it('valve disruption reduces dated capacity and completed repair restores future capacity', () => {
    const sim=new SimulationEngine(createYunnanBlueberryFixture(),packs);
    while(!sim.getPlayerView().decisionCases.some(c=>c.id==='valve-disruption') && !sim.ended)sim.advanceOneDay();
    const view=sim.getPlayerView(),rig=view.resources.find(r=>r.id==='irrigation-rig');
    const tomorrow=new Date(Date.parse(view.currentDate)+86400000).toISOString().slice(0,10);
    expect(rig.availability[view.currentDate]).toBe(0.5);
    expect(rig.availability[tomorrow]).toBe(0.5);
    expect(sim.decide('valve-disruption',{type:'decide_now',optionId:'repair-valve'}).accepted).toBe(true);
    const repaired=sim.advanceOneDay();
    expect(repaired.resources.find(r=>r.id==='irrigation-rig').availability[tomorrow]).toBe(1);
    expect(repaired.operations[0]).toMatchObject({type:'maintenance',executionStatus:'completed',cost:150});
    expect(repaired.finance.transactions).toHaveLength(1);
  });

  it('default-seed decisions can create and complete real operations, with costs recorded', () => {
    const sim=new SimulationEngine(createYunnanBlueberryFixture(),packs),handled=new Set();
    while(!sim.ended) {
      for (const decision of sim.getPlayerView().decisionCases) {
        if (handled.has(decision.id) || decision.status!=='open') continue;
        const option=decision.actionOptions.find(o=>o.type==='decide_now');
        const result=sim.decide(decision.id,{type:'decide_now',optionId:option.id,reasonText:'内容包验收：采用首个可执行方案'});
        expect(result.accepted).toBe(true);handled.add(decision.id);
      }
      sim.advanceOneDay();
    }
    const view=sim.getPlayerView();
    expect([...handled]).toEqual(expect.arrayContaining(['water-stress-pu03','valve-disruption','pre-harvest']));
    expect(view.operations).toHaveLength(3);
    expect(view.operations.every(o=>o.executionStatus==='completed' && o.actualStart && o.cost>0)).toBe(true);
    expect(view.finance.transactions).toHaveLength(3);
    expect(view.decisionCases.every(c=>c.resultingOperationIds.length===1 && c.outcomeIds.length===1)).toBe(true);
  });

  it('pre-harvest alternatives compete for daily capacity and alter different crop outcomes', () => {
    const fixture=createYunnanBlueberryFixture();
    const decision=fixture.decisionTemplates.find(c=>c.id==='pre-harvest');
    const a=decision.actionOptions.find(o=>o.id==='prioritize-pu01'),b=decision.actionOptions.find(o=>o.id==='prioritize-pu03');
    const op=(choice,id)=>createOperation({...choice.operation,id,plannedStart:'2026-03-22'});
    expect(detectResourceConflicts([op(a,'a'),op(b,'b')],fixture.resources)).toEqual(expect.arrayContaining([
      expect.objectContaining({type:'capacity',resourceId:'crew-a',requested:1.5,available:1}),
      expect.objectContaining({type:'capacity',resourceId:'irrigation-rig',requested:1.5,available:1}),
    ]));
    const run=optionId=>{
      const rule=fixture.scenario.eventRules.find(r=>r.id==='pre-harvest-tradeoff');
      const sim=new SimulationEngine(createYunnanBlueberryFixture({eventRules:[{...rule,eligibleWindow:{startDay:20,endDay:20},baseProbability:1,conditions:[]}]}),packs);
      advanceTo(sim,'2026-03-21');
      expect(sim.decide('pre-harvest',{type:'decide_now',optionId}).accepted).toBe(true);
      sim.advanceOneDay();return sim.exportCheckpoint().state;
    };
    const prioritize01=run(a.id),prioritize03=run(b.id);
    expect(prioritize01.farmState.resources[0].quantity).toBe(prioritize03.farmState.resources[0].quantity);
    expect(prioritize01.farmState.cropInstances.find(c=>c.productionUnitId==='PU-01').trueState.waterStress)
      .toBeLessThan(prioritize03.farmState.cropInstances.find(c=>c.productionUnitId==='PU-01').trueState.waterStress);
    expect(prioritize03.farmState.cropInstances.find(c=>c.productionUnitId==='PU-03').trueState.waterStress)
      .toBeLessThan(prioritize01.farmState.cropInstances.find(c=>c.productionUnitId==='PU-03').trueState.waterStress);
  });
});
