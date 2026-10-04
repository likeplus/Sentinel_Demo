import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../src/simulation/SimulationEngine.js';
import { blueberryPack } from '../src/crop-packs/blueberry/index.js';
import { createYunnanBlueberryFixture } from '../src/scenarios/yunnan-blueberry-28d/index.js';

const packs = {blueberry:blueberryPack};
const attention = {dailyBudget:2,costs:{decide_now:1,gather_information:1,delegate:1,approve:1,delay:0,no_action:0,custom:1}};
const fixture = (overrides={}) => createYunnanBlueberryFixture({eventRules:[],managerAttention:attention,
  emergencySupplies:[{resourceId:'water',unitPrice:2,maxQuantity:1000}],
  inspectionPlan:{type:'inspection',plannedDurationDays:0.25,assignedResourceIds:['crew-a'],plannedOutput:{samples:1}},...overrides});
const engine = overrides => new SimulationEngine(fixture(overrides),packs);
const advanceTo = (sim,date) => {while(sim.currentDate<date && !sim.ended)sim.advanceOneDay();return sim.getPlayerView();};
const irrigate = (requestId='irrigate') => ({type:'decide_now',optionId:'irrigate-pu03',requestId,reasonText:'Use available evidence'});
const external = (id,plannedStart,duration=0.75) => ({id,type:'inspection',productionUnitIds:['PU-01'],plannedStart,
  plannedDurationDays:duration,assignedResourceIds:['crew-a'],plannedOutput:{samples:1}});

describe('Phase 2 accepted actions are atomic and idempotent',()=>{
  it('spends daily attention on accepted inspections only, prevents duplicate charges, and resets next day',()=>{
    const sim=engine();
    const result=sim.inspectUnit('PU-01',{requestId:'check-1'});
    expect(sim.inspectUnit('PU-01',{requestId:'check-1'})).toEqual(result);
    expect(sim.getPlayerView().attention).toMatchObject({remaining:1,spent:1});
    sim.inspectUnit('PU-02',{requestId:'check-2'});
    const before=sim.exportCheckpoint();
    expect(sim.inspectUnit('PU-03',{requestId:'check-3'})).toMatchObject({accepted:false,conflicts:[{type:'manager_attention'}]});
    expect(sim.exportCheckpoint()).toEqual(before);
    expect(()=>sim.inspectUnit('PU-04',{requestId:'check-1'})).toThrow('another action');
    const tomorrow=sim.advanceOneDay();
    expect(tomorrow.attention).toMatchObject({remaining:2,spent:0,date:'2026-03-02'});
    expect(tomorrow.observations.some(o=>o.sourceId===`inspection:${result.operation.id}`)).toBe(false);
    const delivered=sim.advanceOneDay();
    expect(delivered.observations.some(o=>o.sourceId===`inspection:${result.operation.id}`)).toBe(true);
    expect(delivered.observations.find(o=>o.sourceId===`inspection-stage:${result.operation.id}`)).toMatchObject({variable:'stage',valueType:'category',observedAt:'2026-03-02',availableAt:'2026-03-03'});
  });

  it('capacity rejection, invalid selection, and repeated scheduled decisions do not mutate attention or traces',()=>{
    const sim=engine();advanceTo(sim,'2026-03-04');
    sim.scheduleOperation(external('occupied','2026-03-05'));
    const before=sim.exportCheckpoint();
    expect(sim.decide('water-stress-pu03',irrigate())).toMatchObject({accepted:false});
    expect(sim.exportCheckpoint()).toEqual(before);
    expect(()=>sim.decide('water-stress-pu03',{...irrigate(),optionId:'missing'})).toThrow();
    expect(sim.exportCheckpoint()).toEqual(before);
    const result=sim.decide('water-stress-pu03',{...irrigate('later'),plannedStart:'2026-03-06'});
    expect(sim.decide('water-stress-pu03',{...irrigate('later'),plannedStart:'2026-03-06'})).toEqual(result);
    expect(()=>sim.decide('water-stress-pu03',irrigate('other'))).toThrow('unavailable');
    expect(sim.getPlayerView().attention.remaining).toBe(1);
    const history=sim.getPlayerView().decisionCases.find(c=>c.id==='water-stress-pu03').actionHistory;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({date:'2026-03-04',reasonText:'Use available evidence',attentionCost:1,operationId:result.operation.id});
    expect(history[0].evidenceIds).not.toContain('pu03-lab-day4');
  });

  it('allows only compatible crew substitutions and cannot drop required inventory or equipment',()=>{
    const f=fixture();
    f.resources.push({...f.resources.find(r=>r.id==='crew-a'),id:'crew-b',name:'Backup crew'});
    f.farm.resourceIds.push('crew-b');
    const sim=new SimulationEngine(f,packs);advanceTo(sim,'2026-03-04');
    const before=sim.exportCheckpoint();
    expect(()=>sim.decide('water-stress-pu03',{...irrigate(),assignedResourceIds:['crew-b','water']})).toThrow('preserve');
    expect(sim.exportCheckpoint()).toEqual(before);
    const result=sim.decide('water-stress-pu03',{...irrigate(),assignedResourceIds:['crew-b','irrigation-rig','water']});
    expect(result.operation.assignedResourceIds).toEqual(['crew-b','irrigation-rig','water']);
  });

  it('atomically purchases configured stock with cash, one receipt and no duplicate ledger entry',()=>{
    const sim=engine({startingCash:10});
    const before=sim.exportCheckpoint();
    expect(sim.purchaseResource('water',6,{requestId:'unaffordable'})).toMatchObject({accepted:false,conflicts:[{type:'cash'}]});
    expect(sim.exportCheckpoint()).toEqual(before);
    const result=sim.purchaseResource('water',4,{requestId:'water-delivery'});
    expect(sim.purchaseResource('water',4,{requestId:'water-delivery'})).toEqual(result);
    const view=sim.getPlayerView();
    expect(view.finance.cash).toBe(2);
    expect(view.resources.find(r=>r.id==='water').quantity).toBe(3604);
    expect(view.finance.transactions).toHaveLength(1);
    expect(view.finance.emergencyPurchases).toHaveLength(1);
    expect(view.finance.emergencyPurchases[0]).toMatchObject({quantity:4,unitPrice:2,amount:-8});
    expect(()=>sim.purchaseResource('crew-a',1)).toThrow();
  });
});

describe('Phase 2 approval, review dates and information boundaries',()=>{
  it('delivers an evidence-based proposal next day and runs nothing until approved',()=>{
    const sim=engine();advanceTo(sim,'2026-03-04');
    sim.decide('water-stress-pu03',{type:'delegate',delegatedTo:'agronomist',requestId:'delegate'});
    expect(sim.getPlayerView().operations).toHaveLength(0);
    expect(sim.getPlayerView().decisionCases[0].status).toBe('delegated');
    const view=sim.advanceOneDay();
    const decision=view.decisionCases.find(c=>c.id==='water-stress-pu03');
    expect(decision.status).toBe('awaiting_approval');
    expect(view.operations).toHaveLength(0);
    expect(decision.delegationProposal.createdAt).toBe('2026-03-05');
    const visible=new Set(view.observations.map(o=>o.id));
    expect(decision.delegationProposal.evidenceIds.every(id=>visible.has(id))).toBe(true);
    expect(decision.delegationProposal.evidenceIds).not.toContain('pu03-lab-day4');
    const result=sim.approveDelegation(decision.id,{requestId:'approve',reasonText:'Approve the subordinate proposal'});
    expect(result.accepted).toBe(true);
    expect(sim.approveDelegation(decision.id,{requestId:'approve',reasonText:'Approve the subordinate proposal'})).toEqual(result);
    expect(sim.getPlayerView().operations).toHaveLength(1);
    expect(sim.getPlayerView().attention.remaining).toBe(1);
    expect(sim.advanceOneDay().operations[0].executionStatus).toBe('completed');
  });

  it('hidden crop truth and unavailable lab results cannot affect the subordinate proposal',()=>{
    const first=fixture(),changed=fixture();
    first.observationProfiles=[];changed.observationProfiles=[];
    changed.cropInstances.forEach(c=>{c.trueState.waterStress=1;c.trueState.qualityPotential=0;});
    changed.observations.find(o=>o.id==='pu03-lab-day4').value=0;
    const a=new SimulationEngine(first,packs),b=new SimulationEngine(changed,packs);
    for(const sim of [a,b]) {
      advanceTo(sim,'2026-03-04');
      sim.decide('water-stress-pu03',{type:'delegate',delegatedTo:'agronomist'});
      sim.advanceOneDay();
    }
    expect(a.getPlayerView().decisionCases[0].delegationProposal).toEqual(b.getPlayerView().decisionCases[0].delegationProposal);
    expect(a.getPlayerView().people.some(p=>Object.hasOwn(p,'traits'))).toBe(false);
  });

  it('subordinates outside the original discussion still use their own available beliefs',()=>{
    const sim=engine();advanceTo(sim,'2026-03-04');
    expect(sim.getPlayerView().decisionCases[0].participantIds).not.toContain('maintenance');
    sim.decide('water-stress-pu03',{type:'delegate',delegatedTo:'maintenance'});
    const proposal=sim.advanceOneDay().decisionCases[0].delegationProposal;
    expect(proposal.actorId).toBe('maintenance');
    expect(proposal.evidenceIds.length).toBeGreaterThan(0);
    expect(proposal.reasonText).toContain('已送达证据');
  });

  it('rejecting a proposal reopens the case with a trace and no automatic execution',()=>{
    const sim=engine();advanceTo(sim,'2026-03-04');
    sim.decide('water-stress-pu03',{type:'delegate',delegatedTo:'agronomist'});sim.advanceOneDay();
    sim.rejectDelegation('water-stress-pu03',{reasonText:'Inspect first',requestId:'reject'});
    sim.rejectDelegation('water-stress-pu03',{reasonText:'Inspect first',requestId:'reject'});
    const view=sim.getPlayerView(),decision=view.decisionCases[0];
    expect(decision.status).toBe('open');
    expect(decision.delegationProposal.status).toBe('rejected');
    expect(decision.actionHistory.at(-1)).toMatchObject({type:'reject',reasonText:'Inspect first'});
    expect(view.operations).toHaveLength(0);
  });

  it('reopens delayed cases at the review date and marks missed deadlines only once',()=>{
    const sim=engine();advanceTo(sim,'2026-03-04');
    const before=sim.exportCheckpoint();
    expect(()=>sim.decide('water-stress-pu03',{type:'delay',nextReviewAt:'2026-03-03'})).toThrow();
    expect(sim.exportCheckpoint()).toEqual(before);
    sim.decide('water-stress-pu03',{type:'delay',nextReviewAt:'2026-03-06',reasonText:'Wait for the lab report'});
    expect(sim.advanceOneDay().decisionCases[0].status).toBe('delayed');
    expect(sim.advanceOneDay().decisionCases[0].status).toBe('open');
    const late=advanceTo(sim,'2026-03-09').decisionCases[0];
    expect(late.overdue).toBe(true);
    expect(late.overdueAt).toBe('2026-03-08');
    expect(late.actionHistory.filter(h=>h.type==='deadline_missed')).toHaveLength(1);
  });

  it('rejects last-day delegation and inspections that cannot deliver a usable report before closing',()=>{
    const sim=engine();advanceTo(sim,'2026-03-28');
    const before=sim.exportCheckpoint();
    expect(()=>sim.decide('water-stress-pu03',{type:'delegate',delegatedTo:'agronomist'})).toThrow('approval');
    expect(()=>sim.inspectUnit('PU-01')).toThrow('report');
    expect(sim.exportCheckpoint()).toEqual(before);
  });

  it('cannot schedule another action while inspection results remain unavailable',()=>{
    const sim=engine();advanceTo(sim,'2026-03-04');
    sim.decide('water-stress-pu03',{type:'gather_information',optionId:'inspect-pu03'});
    const before=sim.exportCheckpoint();
    expect(()=>sim.decide('water-stress-pu03',irrigate())).toThrow('unavailable');
    expect(sim.exportCheckpoint()).toEqual(before);
    sim.advanceOneDay();sim.advanceOneDay();
    expect(sim.decide('water-stress-pu03',irrigate()).accepted).toBe(true);
  });
});

describe('Phase 2 reservations, maintenance and checkpoint recovery',()=>{
  it('keeps old reservations when a move conflicts and releases them after a successful move',()=>{
    const sim=engine();advanceTo(sim,'2026-03-04');
    const result=sim.decide('water-stress-pu03',irrigate());
    sim.scheduleOperation(external('other','2026-03-06'));
    const before=sim.exportCheckpoint();
    expect(sim.rescheduleOperation(result.operation.id,'2026-03-06').accepted).toBe(false);
    expect(sim.exportCheckpoint()).toEqual(before);
    expect(sim.rescheduleOperation(result.operation.id,'2026-03-07').accepted).toBe(true);
    expect(sim.scheduleOperation(external('reuses-old-day','2026-03-05')).accepted).toBe(true);
    expect(sim.getPlayerView().decisionCases[0].resultingOperationIds).toEqual([result.operation.id]);
    expect(sim.getPlayerView().operations.filter(o=>o.id===result.operation.id)).toHaveLength(1);
  });

  it('restores attention, request deduplication and PRNG for identical future outcomes',()=>{
    const original=engine();advanceTo(original,'2026-03-04');
    const result=original.decide('water-stress-pu03',irrigate());
    original.purchaseResource('water',100,{requestId:'purchase'});
    const restored=SimulationEngine.restore(JSON.parse(JSON.stringify(original.exportCheckpoint())),packs);
    expect(restored.decide('water-stress-pu03',irrigate())).toEqual(result);
    expect(restored.getPlayerView()).toEqual(original.getPlayerView());
    advanceTo(original,'2026-03-10');advanceTo(restored,'2026-03-10');
    expect(restored.exportCheckpoint()).toEqual(original.exportCheckpoint());
  });

  it('loads older version-1 checkpoint metadata and rejects actions at the end date',()=>{
    const sim=engine({managerAttention:null});
    const checkpoint=sim.exportCheckpoint();
    delete checkpoint.state.attention;delete checkpoint.state.acceptedRequests;delete checkpoint.state.purchaseSequence;
    const restored=SimulationEngine.restore(checkpoint,packs);
    expect(restored.getPlayerView().attention.enabled).toBe(false);
    advanceTo(restored,'2026-03-29');
    expect(()=>restored.inspectUnit('PU-01')).toThrow('unavailable');
    expect(()=>restored.purchaseResource('water',100)).toThrow('unavailable');
    expect(restored.advanceOneDay().currentDayIndex).toBe(28);
  });

  it('persistent disruptions block tasks, and completed maintenance restores future equipment capacity',()=>{
    const f=fixture({eventRules:[{id:'valve',eligibleWindow:{startDay:4,endDay:4},conditions:[],baseProbability:1,modifiers:[],maxOccurrences:1,
      effects:[{type:'resource_availability',resourceId:'irrigation-rig',factor:0,durationDays:3}]}]});
    const sim=new SimulationEngine(f,packs);advanceTo(sim,'2026-03-04');
    sim.decide('water-stress-pu03',irrigate());
    const blocked=sim.advanceOneDay();expect(blocked.operations[0].executionStatus).toBe('blocked');
    sim.scheduleOperation({id:'repair',type:'maintenance',productionUnitIds:['PU-03'],plannedStart:'2026-03-06',plannedDurationDays:0.25,
      assignedResourceIds:['maintenance-person'],maintenanceEffects:[{resourceId:'irrigation-rig',factor:1,durationDays:3}],priority:10,plannedOutput:{repairs:1}});
    const repaired=sim.advanceOneDay();
    expect(repaired.operations.find(o=>o.id==='repair').executionStatus).toBe('completed');
    expect(repaired.operations.find(o=>o.id==='OP-1').executionStatus).toBe('completed');
    expect(repaired.resources.find(r=>r.id==='irrigation-rig').availability['2026-03-07']).toBe(1);
  });
});
