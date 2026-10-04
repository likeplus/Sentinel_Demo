import { createFarm, createWorld, createCrew, createFinance, createScenario, createProductionUnit, createCropInstance, createPerson, createResource,
  createObservation, createDecisionCase, createOperation, detectResourceConflicts, isCapacityResource,
  availableCapacity, recordExpense, DECISION_ACTIONS } from '../domain/index.js';
import { addDays, clone, dateMs, daysBetween, nonnegative } from '../domain/validation.js';
import { RandomEngine } from './RandomEngine.js';
import { advanceWorld } from './WorldEngine.js';
import { availableObservations, sampleObservations, updateBeliefs } from './ObservationEngine.js';
import { rollEvents, validateEventRules } from './EventEngine.js';

export const DAILY_PHASES = ['world', 'production', 'resources', 'events', 'observations', 'beliefs',
  'decisions', 'operations', 'outcomes', 'finance', 'audit'];

/**
 * @typedef {Object} SimulationState Engine-owned, never passed to React or agents.
 * @property {string} scenarioId
 * @property {string} currentDate
 * @property {number} currentDayIndex Elapsed calendar days (zero at start).
 * @property {number} speed
 * @property {boolean} paused Metadata for a future runner; manual advance is always explicit.
 * @property {string|number} randomSeed
 * @property {Object} worldState
 * @property {Object} farmState
 * @property {Object[]} pendingEvents
 * @property {Object[]} openDecisionCases
 * @property {Object[]} scheduledOperations
 */
export class SimulationEngine {
  #fixture;
  #packs;
  #playerActorId;
  #state;
  #random;
  #views = new Map();

  /** @param {Object} fixture JSON-only scenario/world/farm/entity configuration.
   * @param {Object<string,Object>} cropPacks Explicit plugin registry keyed by cropPackId.
   */
  constructor(fixture, cropPacks) {
    this.#fixture = clone(fixture);
    this.#packs = cropPacks;
    const config = this.#fixture;
    config.scenario = createScenario(config.scenario);
    validateEventRules(config.scenario.eventRules);
    config.farm = createFarm(config.farm);
    config.world = createWorld(config.world);
    config.finance = createFinance(config.finance);
    config.crews = (config.crews || []).map(createCrew);
    config.productionUnits = config.productionUnits.map(createProductionUnit);
    config.cropInstances = config.cropInstances.map(createCropInstance);
    config.people = config.people.map(createPerson);
    config.resources = config.resources.map(createResource);
    config.observations = (config.observations || []).map(createObservation);
    config.decisionTemplates = (config.decisionTemplates || []).map(createDecisionCase);
    this.#validateReferences();
    this.#playerActorId = config.playerActorId || config.people.find(p => p.role === config.scenario.playerRole)?.id;
    if (!this.#playerActorId || !config.people.some(p => p.id === this.#playerActorId)) throw new TypeError('Missing player actor for playerRole');
    this.#random = new RandomEngine(config.scenario.seed);
    config.world.date = config.scenario.startDate;
    this.#state = { scenarioId: config.scenario.id, currentDate: config.scenario.startDate, currentDayIndex: 0,
      speed: 1, paused: true, randomSeed: config.scenario.seed, ended: false, worldState: clone(config.world),
      farmState: { farm: clone(config.farm), productionUnits: clone(config.productionUnits),
        cropInstances: clone(config.cropInstances), people: clone(config.people), crews: clone(config.crews || []),
        resources: clone(config.resources), finance: clone(config.finance) },
      observations: clone(config.observations), beliefs: [], pendingEvents: [], openDecisionCases: [], scheduledOperations: [],
      eventCounts: {}, eventRolls: [], eventHistory: [], outcomes: [], history: [], operationSequence: 0,
      attention: this.#newAttention(config.scenario.startDate), acceptedRequests: {}, purchaseSequence: 0 };
    this.#state.beliefs = updateBeliefs(config.people, config.observations, config.scenario.startDate);
    this.#updateFinance([]);
    this.#saveView();
  }

  #validateReferences() {
    const f = this.#fixture;
    const assert = (valid, message) => { if (!valid) throw new TypeError(message); };
    const ids = collection => new Set(collection.map(item => item.id));
    for (const collection of [f.productionUnits, f.cropInstances, f.people, f.resources, f.decisionTemplates, f.observations]) {
      if (ids(collection).size !== collection.length) throw new TypeError('Duplicate entity id');
    }
    for (const crew of f.crews) {
      assert(f.resources.some(r=>r.id===crew.resourceId && r.type==='crew'), 'Unknown crew resource');
      assert(crew.memberIds.every(id=>f.people.some(p=>p.id===id)), 'Unknown crew person');
    }
    const unitIds = ids(f.productionUnits), cropIds = ids(f.cropInstances), resourceIds = ids(f.resources), personIds = ids(f.people);
    assert(f.farm.id === f.scenario.farmConfigId, 'Unknown farmConfigId');
    assert(f.farm.productionUnitIds.length === unitIds.size && f.farm.productionUnitIds.every(id => unitIds.has(id)), 'Unknown farm ProductionUnit');
    assert(f.farm.personIds.every(id => personIds.has(id)) && f.farm.resourceIds.every(id => resourceIds.has(id)), 'Invalid farm people/resources');
    assert(f.scenario.criticalResourceIds.every(id => resourceIds.has(id)), 'Unknown critical resource');
    assert(f.scenario.emergencySupplies.every(supply => resourceIds.has(supply.resourceId) && !isCapacityResource(f.resources.find(r=>r.id===supply.resourceId))), 'Emergency purchase requires inventory resource');
    for (const unit of f.productionUnits) {
      assert(unit.farmId === f.farm.id && f.farm.clusterIds.includes(unit.clusterId), 'Unknown farm/cluster');
      assert(unit.cropInstanceIds.every(id => cropIds.has(id) && f.cropInstances.find(c=>c.id===id).productionUnitId===unit.id), 'Invalid unit crop reference');
    }
    for (const crop of f.cropInstances) {
      const pack = this.#packs[crop.cropPackId];
      assert(unitIds.has(crop.productionUnitId) && f.productionUnits.find(u=>u.id===crop.productionUnitId).cropInstanceIds.includes(crop.id), 'Unknown crop ProductionUnit');
      assert(f.scenario.cropPackIds.includes(crop.cropPackId) && pack?.varieties[crop.varietyId], 'Unknown crop pack/variety');
      assert(['advanceCrop','applyOperation','forecastRevenue'].every(key => typeof pack[key] === 'function'), 'Invalid CropPack interface');
    }
    assert(f.observations.every(o => unitIds.has(o.productionUnitId)), 'Unknown observed ProductionUnit');
    for (const template of f.decisionTemplates) {
      assert(template.productionUnitIds.every(id => unitIds.has(id)) && template.participantIds.every(id => personIds.has(id)), 'Invalid decision references');
    }
    for (const profile of f.observationProfiles || []) {
      assert(Number.isInteger(profile.everyDays) && profile.everyDays > 0 && Number.isInteger(profile.delayDays) && profile.delayDays >= 0, 'Invalid sampling cadence/delay');
      assert(Number.isFinite(profile.reliability) && profile.reliability >= 0 && profile.reliability <= 1, 'Invalid sampling reliability');
      assert(Number.isFinite(profile.uncertainty) && profile.uncertainty >= 0 && Number.isFinite(profile.freshness) && profile.freshness >= 0, 'Invalid sampling uncertainty/freshness');
    }
    for (const rule of f.scenario.eventRules) for (const effect of rule.effects) {
      assert(['decision','resource_delta','resource_availability'].includes(effect.type), 'Unknown event effect');
      if (effect.type === 'decision') assert(f.decisionTemplates.some(t=>t.id===effect.templateId), 'Unknown decision template');
      else {
        assert(resourceIds.has(effect.resourceId), 'Unknown event resource');
        assert(effect.type === 'resource_delta' ? Number.isFinite(effect.amount) : Number.isFinite(effect.factor) && effect.factor >= 0 && effect.factor <= 1, 'Invalid event resource change');
        if (effect.durationDays !== undefined) assert(Number.isInteger(effect.durationDays) && effect.durationDays >= 1, 'Invalid resource effect duration');
      }
    }
  }

  get currentDate() { return this.#state.currentDate; }
  get currentDayIndex() { return this.#state.currentDayIndex; }
  get ended() { return this.#state.ended; }

  /** Returns only visible knowledge. Historical dates use immutable per-day views. */
  getPlayerView(actorId = this.#playerActorId, asOf = this.currentDate) {
    dateMs(asOf);
    if (!this.#fixture.people.some(p => p.id === actorId)) throw new TypeError('Unknown actor');
    if (asOf > this.currentDate) throw new RangeError('Future replay is unavailable');
    const view = this.#views.get(asOf);
    if (!view) throw new RangeError('Replay date has not been simulated');
    const result = clone(view);
    result.beliefs = result.beliefs.filter(b => b.actorId === actorId);
    result.actorId = actorId;
    return result;
  }

  #saveView() {
    const s = this.#state, farm = s.farmState;
    const observations = availableObservations(s.observations, s.currentDate);
    const units = farm.productionUnits.map(unit => {
      const samples = observations.filter(o => o.productionUnitId === unit.id);
      const last = samples.toSorted((a,b)=>b.observedAt.localeCompare(a.observedAt))[0];
      return { ...clone(unit), lastObservedAt: last?.observedAt ?? null, observationStatus: last?.status ?? 'unknown' };
    });
    this.#views.set(s.currentDate, clone({ scenarioId: s.scenarioId, currentDate: s.currentDate,
      currentDayIndex: s.currentDayIndex, ended: s.ended, randomSeed: s.randomSeed,
      farm: farm.farm, productionUnits: units,
      scenario: {id:this.#fixture.scenario.id,name:this.#fixture.scenario.name,startDate:this.#fixture.scenario.startDate,
        endDate:this.#fixture.scenario.endDate,durationDays:daysBetween(this.#fixture.scenario.startDate,this.#fixture.scenario.endDate),
        emergencySupplies:this.#fixture.scenario.emergencySupplies},
      attention:s.attention,
      people:farm.people.map(({id,name,role,skills,avatar,reportsTo})=>({id,name,role,skills,avatar,reportsTo})),
      crops: farm.cropInstances.map(crop => ({ id: crop.id, productionUnitId: crop.productionUnitId,
        cropPackId: crop.cropPackId, varietyId: crop.varietyId, plantingDate: crop.plantingDate,
        expectedHarvestWindow: crop.expectedHarvestWindow })),
      // Stage and potentials are hidden too; future UI must estimate them from evidence.
      observations, beliefs: s.beliefs, decisionCases: s.openDecisionCases,
      operations: s.scheduledOperations, resources: farm.resources, finance: farm.finance,
      outcomes: s.outcomes, history: s.history }));
  }

  /** One calendar day, in the documented 11-phase order. Manual ticks ignore runner pause metadata. */
  advanceOneDay() {
    if (this.ended) return this.getPlayerView();
    const s = this.#state;
    const date = addDays(s.currentDate, 1);
    const farm = s.farmState;
    // 1 world
    s.worldState = advanceWorld(s.worldState, date, this.#random);
    // 2 production/crops: plugins only, no crop-specific imports
    farm.cropInstances = farm.cropInstances.map(crop => {
      const pack = this.#packs[crop.cropPackId];
      return pack.advanceCrop(crop, pack.varieties[crop.varietyId], s.worldState, date, this.#random);
    });
    // 3 resources: daily availability and attention reset; capacity is never carried over.
    s.attention = this.#newAttention(date);
    const resourceState = Object.fromEntries(farm.resources.map(r=>[r.id,r]));
    // 4 event rules
    const context = { world: s.worldState, resources: resourceState, crops: Object.fromEntries(farm.cropInstances.map(c=>[c.id,c])) };
    const rolled = rollEvents(this.#fixture.scenario.eventRules, context, s.currentDayIndex + 1, this.#random, s.eventCounts);
    s.eventRolls.push(...rolled.rolls);
    s.pendingEvents = rolled.events.map(rule=>({ruleId:rule.id,date}));
    for (const rule of rolled.events) {
      s.eventCounts[rule.id] = (s.eventCounts[rule.id] ?? 0) + 1;
      s.eventHistory.push({ruleId:rule.id,date,name:rule.name || rule.id});
      for (const effect of rule.effects) this.#applyEvent(effect, date);
    }
    // 5 observations: current-day samples can still be unavailable for days.
    s.observations.push(...sampleObservations(farm.cropInstances, this.#fixture.observationProfiles || [], date, s.currentDayIndex + 1, this.#random));
    // 6 beliefs: ONLY available evidence, never context/world/crop truth
    s.beliefs = updateBeliefs(farm.people, s.observations, date);
    // 7 tasks/decisions: fixture example + event-created cases
    for (const template of this.#fixture.decisionTemplates) {
      if (template.openedAt <= date && template.trigger === 'date') this.#openCase(template, date);
    }
    this.#refreshCases(date);
    // 8 operations: execution rechecks changed capacity/inventory
    const completed = this.#executeOperations(date);
    // 9 outcomes: trace actual execution, not hidden crop state
    for (const operation of completed) {
      const outcome = {id:`outcome:${operation.id}`,operationId:operation.id,date,output:operation.actualOutput};
      s.outcomes.push(outcome);
      const decision = s.openDecisionCases.find(c=>c.id===operation.sourceId);
      if (decision) {
        decision.outcomeIds.push(outcome.id);
        if (decision.selectedAction?.type !== 'gather_information') decision.status = 'resolved';
      }
    }
    // 10 finance: cash/ledger live updates; forecasts depend on evidence.
    this.#updateFinance(completed);
    // 11 audit/history
    s.currentDate = date;
    s.currentDayIndex += 1;
    s.ended = date >= this.#fixture.scenario.endDate;
    s.history.push({date,dayIndex:s.currentDayIndex,phases:[...DAILY_PHASES],eventIds:rolled.events.map(r=>r.id),
      completedOperationIds:completed.map(o=>o.id),cash:farm.finance.cash});
    s.pendingEvents = [];
    this.#saveView();
    return this.getPlayerView();
  }

  /** Configurable whole-day step; final partial step is clamped to endDate. */
  advanceStep() {
    for (let index=0; index<this.#fixture.scenario.stepDays && !this.ended; index++) this.advanceOneDay();
    return this.getPlayerView();
  }

  #applyEvent(effect, date) {
    const farm = this.#state.farmState;
    if (effect.type === 'decision') {
      this.#openCase(this.#fixture.decisionTemplates.find(t=>t.id===effect.templateId), date);
      return;
    }
    const resource = farm.resources.find(r=>r.id===effect.resourceId);
    if (effect.type === 'resource_delta') resource.quantity = Math.max(0, resource.quantity + effect.amount);
    if (effect.type === 'resource_availability') {
      for (let day=0; day<(effect.durationDays ?? 1); day++) resource.availability[addDays(date,day)] = effect.factor;
    }
  }

  #openCase(template, date) {
    if (!template || template.openedAt > date || this.#state.openDecisionCases.some(c=>c.id===template.id)) return;
    this.#state.openDecisionCases.push(createDecisionCase({...template, openedAt:date}));
  }
  #refreshCases(date) {
    const s = this.#state;
    const evidence = availableObservations(s.observations, date).filter(o=>o.status!=='invalid');
    for (const decision of s.openDecisionCases) {
      if (decision.status === 'investigating' && decision.resultingOperationIds.some(id => evidence.some(o => o.sourceId === `inspection:${id}`))) decision.status = 'open';
      decision.availableObservationIds = evidence.filter(o=>decision.productionUnitIds.includes(o.productionUnitId)).map(o=>o.id);
      decision.viewpoints = s.beliefs.filter(b=>decision.productionUnitIds.includes(b.productionUnitId) && decision.participantIds.includes(b.actorId));
      const estimates = decision.viewpoints.map(b=>b.estimate);
      decision.consensusLevel = estimates.length ? 1 - (Math.max(...estimates) - Math.min(...estimates)) : 0;
      if (decision.status === 'delayed' && decision.nextReviewAt <= date) {
        decision.status = 'open';
        decision.actionHistory.push({type:'review_due',date,evidenceIds:clone(decision.availableObservationIds)});
        decision.nextReviewAt = null;
      }
      if (!decision.overdue && decision.deadline && decision.deadline < date && decision.status !== 'resolved') {
        decision.overdue = true;
        decision.overdueAt = date;
        decision.actionHistory.push({type:'deadline_missed',date,evidenceIds:clone(decision.availableObservationIds)});
      }
      if (decision.status === 'delegated' && decision.proposalDueAt <= date) {
        // The rule reads the subordinate's available beliefs and public options only.
        const beliefs = s.beliefs.filter(b=>b.actorId===decision.delegatedTo && decision.productionUnitIds.includes(b.productionUnitId) && b.subject==='waterStress');
        const stress = beliefs.length ? beliefs.reduce((sum,b)=>sum+b.estimate,0)/beliefs.length : null;
        const investigate = decision.investigationOptions.find(option=>option.operation);
        const act = decision.actionOptions.find(option=>option.type==='decide_now' && option.operation);
        const choice = (stress === null || stress < (decision.delegationThreshold ?? 0.35)) && investigate ? investigate : act || investigate;
        const evidenceIds = [...new Set(beliefs.flatMap(b=>b.basedOnObservationIds))];
        decision.delegationProposal = {id:`proposal:${decision.id}:${decision.actionHistory.length}`,actorId:decision.delegatedTo,
          createdAt:date,type:choice?.type || 'no_action',optionId:choice?.id || null,operation:choice?.operation || null,
          evidenceIds,reasonText:stress === null ? '没有当前水分估计，建议先检查以获得证据。'
            : `已送达证据估计水分胁迫为 ${stress.toFixed(2)}，建议${choice?.label || (choice?.type==='gather_information' ? '先进行现场检查' : '采用该行动方案')}。`,status:'pending'};
        decision.status = 'awaiting_approval';
        decision.actionHistory.push({type:'proposal_arrived',date,actorId:decision.delegatedTo,evidenceIds});
      }
    }
  }

  #newAttention(date) {
    const config = this.#fixture.scenario.managerAttention;
    const dailyBudget = config?.dailyBudget ?? 0;
    return {enabled:Boolean(config),date,dailyBudget,spent:0,remaining:dailyBudget,costs:clone(config?.costs || {})};
  }

  #attentionCheck(type) {
    const attention = this.#state.attention;
    const cost = attention.enabled ? (attention.costs[type] ?? 0) : 0;
    return {cost,conflicts:cost > attention.remaining + 1e-9
      ? [{type:'manager_attention',requested:cost,available:attention.remaining,date:this.currentDate}] : []};
  }

  #spendAttention(cost) {
    this.#state.attention.spent += cost;
    this.#state.attention.remaining = this.#state.attention.dailyBudget - this.#state.attention.spent;
  }

  #request(requestId, type, input) {
    if (requestId === undefined || requestId === null) return null;
    if (typeof requestId !== 'string' || !requestId.trim()) throw new TypeError('requestId must be a nonempty string');
    const value = clone(input);
    delete value.requestId;
    const signature = JSON.stringify({type,input:value});
    const existing = Object.hasOwn(this.#state.acceptedRequests,requestId) ? this.#state.acceptedRequests[requestId] : null;
    if (existing && existing.signature !== signature) throw new TypeError('requestId already belongs to another action');
    return {requestId,signature,result:existing ? clone(existing.result) : null};
  }

  #accepted(request, result) {
    if (request) Object.defineProperty(this.#state.acceptedRequests,request.requestId,
      {value:{signature:request.signature,result:clone(result)},enumerable:true,writable:true,configurable:true});
    this.#saveView();
    return result;
  }

  #resourcePlan(plan, selection) {
    if (!selection.assignedResourceIds && !selection.crewId) return plan;
    const resources = this.#state.farmState.resources;
    const isCrew = id => resources.find(resource=>resource.id===id)?.type==='crew';
    const original = plan.assignedResourceIds || [];
    const assignedResourceIds = selection.assignedResourceIds || original.map(id=>isCrew(id) ? selection.crewId : id);
    if (!Array.isArray(assignedResourceIds) || assignedResourceIds.some(id=>!resources.some(r=>r.id===id))
      || assignedResourceIds.filter(isCrew).length!==original.filter(isCrew).length
      || JSON.stringify(assignedResourceIds.filter(id=>!isCrew(id)).toSorted())!==JSON.stringify(original.filter(id=>!isCrew(id)).toSorted())) {
      throw new TypeError('Crew selection must preserve required equipment and inventory');
    }
    return {...plan,assignedResourceIds};
  }

  #operationId() {
    let sequence = this.#state.operationSequence + 1;
    while (this.#state.scheduledOperations.some(o=>o.id===`OP-${sequence}`)) sequence++;
    return {id:`OP-${sequence}`,sequence};
  }

  #prepareOperation(input, replacedId = null) {
    const operation = createOperation(input);
    const s = this.#state;
    if (this.ended || operation.plannedStart <= this.currentDate || operation.plannedStart > this.#fixture.scenario.endDate) throw new RangeError('Operation must be on a remaining simulation day');
    if (operation.executionStatus !== 'scheduled') throw new TypeError('New operation must be scheduled');
    if (operation.type==='inspection' && addDays(operation.plannedStart,1)>this.#fixture.scenario.endDate) throw new RangeError('Inspection report would arrive after the simulation ends');
    if (s.scheduledOperations.some(o=>o.id===operation.id && o.id!==replacedId)) throw new TypeError('Duplicate operation id');
    if (!operation.productionUnitIds.length || operation.productionUnitIds.some(id=>!s.farmState.productionUnits.some(u=>u.id===id))) throw new TypeError('Unknown operation ProductionUnit');
    const crops = s.farmState.cropInstances.filter(c=>operation.productionUnitIds.includes(c.productionUnitId));
    if (crops.some(c=>!this.#packs[c.cropPackId].operations[operation.type])) throw new TypeError('CropPack does not support operation');
    if (operation.maintenanceEffects.some(effect=>!s.farmState.resources.some(r=>r.id===effect.resourceId && isCapacityResource(r)))) throw new TypeError('Unknown maintenance capacity resource');
    // A previously blocked task must not prevent unrelated repairs on later days.
    // Inventory reservations still count together whenever the candidate uses that stock.
    const conflicts = detectResourceConflicts([...s.scheduledOperations.filter(o=>o.id!==replacedId), operation], s.farmState.resources)
      .filter(conflict=>conflict.operationIds.includes(operation.id));
    return {accepted:conflicts.length===0,operation,conflicts};
  }

  scheduleOperation(input) {
    const result = this.#prepareOperation(input);
    if (!result.accepted) return {accepted:false,conflicts:result.conflicts};
    this.#state.scheduledOperations.push(result.operation);
    this.#saveView();
    return {accepted:true,operation:clone(result.operation),conflicts:[]};
  }

  #trace(decision, type, selection, operationId = null, cost = 0) {
    const evidenceIds = availableObservations(this.#state.observations,this.currentDate)
      .filter(o=>o.status!=='invalid' && decision.productionUnitIds.includes(o.productionUnitId)).map(o=>o.id);
    decision.actionHistory.push({type,date:this.currentDate,actorId:this.#playerActorId,evidenceIds,
      question:decision.title, selectedOptionId:selection.optionId || decision.delegationProposal?.optionId || null,
      viewpoints:clone(decision.viewpoints),
      reasonTags:clone(selection.reasonTags || []),reasonText:selection.reasonText || '',operationId,attentionCost:cost});
  }

  /** Accepted actions commit reservations, attention and traces together. Rejected actions change nothing. */
  decide(caseId, selection) {
    selection = clone(selection);
    const request = this.#request(selection.requestId,'decide',{caseId,...selection});
    if (request?.result) return request.result;
    const s = this.#state;
    const decision = s.openDecisionCases.find(c=>c.id===caseId);
    if (!decision || !['open','delayed'].includes(decision.status) || this.ended) throw new TypeError('Decision is unavailable');
    if (!DECISION_ACTIONS.includes(selection.type)) throw new TypeError('Unknown decision action');
    const options = [...decision.actionOptions,...decision.investigationOptions];
    const choice = options.find(o=>(selection.optionId ? o.id===selection.optionId : true) && o.type===selection.type);
    if (selection.optionId && !choice) throw new TypeError('Unknown decision option');
    let plan = choice?.operation;
    if (selection.type === 'custom') plan = selection.operation;
    if (selection.type === 'gather_information' && !plan && this.#fixture.scenario.inspectionPlan) {
      plan = {...this.#fixture.scenario.inspectionPlan,productionUnitIds:decision.productionUnitIds};
    }
    if (selection.type === 'decide_now' && !plan) throw new TypeError('Choose an action with an operation');
    if (selection.type === 'delegate' && (!s.farmState.people.some(p=>p.id===selection.delegatedTo) || selection.delegatedTo===this.#playerActorId)) throw new TypeError('Unknown subordinate');
    let reviewAt = null;
    if (selection.type === 'delay') {
      reviewAt = selection.nextReviewAt || selection.reviewAt || addDays(this.currentDate,1);
      dateMs(reviewAt);
      if (reviewAt <= this.currentDate || reviewAt > this.#fixture.scenario.endDate) throw new RangeError('Review date must be a remaining simulation day');
    }
    if (selection.type==='delegate' && addDays(this.currentDate,decision.delegateDelayDays ?? 1)>=this.#fixture.scenario.endDate) throw new RangeError('Proposal must leave time for approval before the simulation ends');
    if (plan) plan = this.#resourcePlan(plan,selection);
    const attention = this.#attentionCheck(selection.type);
    if (attention.conflicts.length) return {accepted:false,conflicts:attention.conflicts};
    const next = this.#operationId();
    let result = {accepted:true,conflicts:[]};
    if (plan) {
      result = this.#prepareOperation({...plan,id:next.id,sourceId:caseId,sourceType:'decision',plannedStart:selection.plannedStart || addDays(this.currentDate,1)});
      if (!result.accepted) return {accepted:false,conflicts:result.conflicts};
      s.scheduledOperations.push(result.operation);
      s.operationSequence = next.sequence;
      decision.resultingOperationIds.push(next.id);
    }
    this.#spendAttention(attention.cost);
    decision.selectedAction = clone(selection);
    decision.playerReasonTags = clone(selection.reasonTags || []);
    decision.playerReasonText = selection.reasonText || '';
    decision.delegatedTo = selection.delegatedTo || null;
    decision.nextReviewAt = reviewAt;
    decision.proposalDueAt = selection.type==='delegate' ? addDays(this.currentDate,decision.delegateDelayDays ?? 1) : null;
    decision.delegationProposal = null;
    decision.status = plan ? (selection.type==='gather_information' ? 'investigating' : 'scheduled')
      : ({delegate:'delegated',delay:'delayed',no_action:'resolved',gather_information:'investigating',custom:'resolved'})[selection.type];
    this.#trace(decision,selection.type,selection,plan ? next.id : null,attention.cost);
    return this.#accepted(request,{...result,...(result.operation ? {operation:clone(result.operation)} : {})});
  }

  approveDelegation(caseId, selection = {}) {
    selection = clone(selection);
    const request = this.#request(selection.requestId,'approve',{caseId,...selection});
    if (request?.result) return request.result;
    const decision = this.#state.openDecisionCases.find(c=>c.id===caseId);
    if (this.ended || decision?.status!=='awaiting_approval') throw new TypeError('Proposal is unavailable');
    const attention = this.#attentionCheck('approve');
    if (attention.conflicts.length) return {accepted:false,conflicts:attention.conflicts};
    const proposal = decision.delegationProposal;
    const next = this.#operationId();
    let result = {accepted:true,conflicts:[]};
    if (proposal.operation) {
      result = this.#prepareOperation({...this.#resourcePlan(proposal.operation,selection),id:next.id,sourceId:caseId,sourceType:'decision',plannedStart:selection.plannedStart || addDays(this.currentDate,1)});
      if (!result.accepted) return {accepted:false,conflicts:result.conflicts};
      this.#state.scheduledOperations.push(result.operation);
      this.#state.operationSequence = next.sequence;
      decision.resultingOperationIds.push(next.id);
    }
    this.#spendAttention(attention.cost);
    proposal.status = 'approved';
    decision.selectedAction = {type:proposal.type,optionId:proposal.optionId,approvedProposalId:proposal.id};
    decision.playerReasonTags = clone(selection.reasonTags || []);
    decision.playerReasonText = selection.reasonText || '';
    decision.status = proposal.operation ? (proposal.type==='gather_information' ? 'investigating' : 'scheduled') : 'resolved';
    this.#trace(decision,'approve',selection,proposal.operation ? next.id : null,attention.cost);
    return this.#accepted(request,{...result,...(result.operation ? {operation:clone(result.operation)} : {})});
  }

  rejectDelegation(caseId, selection = {}) {
    selection = clone(selection);
    const request = this.#request(selection.requestId,'reject',{caseId,...selection});
    if (request?.result) return request.result;
    const decision = this.#state.openDecisionCases.find(c=>c.id===caseId);
    if (this.ended || decision?.status!=='awaiting_approval') throw new TypeError('Proposal is unavailable');
    decision.delegationProposal.status = 'rejected';
    decision.status = 'open';
    decision.delegatedTo = null;
    this.#trace(decision,'reject',selection);
    return this.#accepted(request,{accepted:true,conflicts:[]});
  }

  inspectUnit(unitId, selection = {}) {
    selection = clone(selection);
    const request = this.#request(selection.requestId,'inspect',{unitId,...selection});
    if (request?.result) return request.result;
    if (this.ended || !this.#state.farmState.productionUnits.some(u=>u.id===unitId)) throw new TypeError('Unit inspection is unavailable');
    if (!this.#fixture.scenario.inspectionPlan) throw new TypeError('Scenario has no inspection plan');
    const attention = this.#attentionCheck('gather_information');
    if (attention.conflicts.length) return {accepted:false,conflicts:attention.conflicts};
    const next = this.#operationId();
    const result = this.#prepareOperation({...this.#resourcePlan(this.#fixture.scenario.inspectionPlan,selection),id:next.id,type:'inspection',sourceType:'inspection',sourceId:unitId,
      productionUnitIds:[unitId],reasonText:selection.reasonText || '',
      evidenceIds:availableObservations(this.#state.observations,this.currentDate).filter(o=>o.status!=='invalid' && o.productionUnitId===unitId).map(o=>o.id),
      plannedStart:selection.plannedStart || addDays(this.currentDate,1)});
    if (!result.accepted) return {accepted:false,conflicts:result.conflicts};
    this.#state.scheduledOperations.push(result.operation);
    this.#state.operationSequence = next.sequence;
    this.#spendAttention(attention.cost);
    return this.#accepted(request,{accepted:true,operation:clone(result.operation),conflicts:[]});
  }

  rescheduleOperation(operationId, plannedStart, selection = {}) {
    selection = clone(selection);
    const request = this.#request(selection.requestId,'reschedule',{operationId,plannedStart,...selection});
    if (request?.result) return request.result;
    const old = this.#state.scheduledOperations.find(o=>o.id===operationId);
    if (!old || !['scheduled','blocked'].includes(old.executionStatus)) throw new TypeError('Operation cannot be rescheduled');
    const result = this.#prepareOperation({...old,plannedStart,executionStatus:'scheduled'},operationId);
    if (!result.accepted) return {accepted:false,conflicts:result.conflicts};
    result.operation.deviations.push({type:'manual_reschedule',date:this.currentDate,planned:old.plannedStart,actual:plannedStart});
    this.#state.scheduledOperations[this.#state.scheduledOperations.indexOf(old)] = result.operation;
    const decision = this.#state.openDecisionCases.find(c=>c.id===old.sourceId);
    if (decision) this.#trace(decision,'reschedule',selection,operationId);
    return this.#accepted(request,{accepted:true,operation:clone(result.operation),conflicts:[]});
  }

  purchaseResource(resourceId, quantity, selection = {}) {
    selection = clone(selection);
    const request = this.#request(selection.requestId,'purchase',{resourceId,quantity,...selection});
    if (request?.result) return request.result;
    nonnegative(quantity,'purchase quantity');
    const supply = this.#fixture.scenario.emergencySupplies.find(item=>item.resourceId===resourceId);
    if (this.ended || !supply || quantity<=0 || quantity> supply.maxQuantity) throw new TypeError('Purchase is unavailable or exceeds configured quantity');
    const farm = this.#state.farmState;
    const resource = farm.resources.find(r=>r.id===resourceId);
    const amount = nonnegative(quantity*supply.unitPrice,'purchase amount');
    if (farm.finance.cash < amount) return {accepted:false,conflicts:[{type:'cash',requested:amount,available:farm.finance.cash}]};
    const id = `purchase:${++this.#state.purchaseSequence}`;
    farm.finance = recordExpense(farm.finance,{id,date:this.currentDate,amount,sourceId:resourceId,emergency:true});
    resource.quantity += quantity;
    const purchase = farm.finance.emergencyPurchases.find(item=>item.id===id);
    purchase.resourceId = resourceId;
    purchase.quantity = quantity;
    purchase.unitPrice = supply.unitPrice;
    return this.#accepted(request,{accepted:true,purchase:clone(purchase),conflicts:[]});
  }

  #executeOperations(date) {
    const s = this.#state, farm = s.farmState;
    const due = s.scheduledOperations.filter(o=>['scheduled','blocked'].includes(o.executionStatus) && o.plannedStart <= date)
      .toSorted((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id));
    const usage = new Map();
    const completed = [];
    for (const operation of due) {
      const conflicts = operation.assignedResourceIds.filter(id=> {
        const resource = farm.resources.find(r=>r.id===id);
        return isCapacityResource(resource)
          ? (usage.get(id) || 0) + operation.plannedDurationDays + operation.travelOverhead > availableCapacity(resource,date) + 1e-9
          : resource.status !== 'available' || (operation.resourceQuantities[id] || 0) > resource.quantity;
      });
      if (conflicts.length) {
        operation.executionStatus = 'blocked';
        const deviation = {type:'resource_unavailable',date,resourceIds:conflicts};
        if (!operation.deviations.some(d=>d.type===deviation.type && d.date===date)) operation.deviations.push(deviation);
        continue;
      }
      operation.executionStatus = 'completed';
      operation.actualStart = date;
      operation.actualDurationDays = operation.plannedDurationDays;
      operation.actualResourceIds = [...operation.assignedResourceIds];
      const productivity = this.#random.between(0.85,1);
      operation.actualOutput = Object.fromEntries(Object.entries(operation.plannedOutput).map(([key,value])=>[key,typeof value==='number' ? value*productivity : value]));
      operation.deviations.push({type:'productivity',planned:1,actual:productivity});
      if (operation.plannedStart < date) operation.deviations.push({type:'attendance_delay',planned:operation.plannedStart,actual:date});
      operation.cost = 0;
      for (const id of operation.assignedResourceIds) {
        const resource = farm.resources.find(r=>r.id===id);
        if (isCapacityResource(resource)) {
          const allocation = operation.plannedDurationDays + operation.travelOverhead;
          usage.set(id,(usage.get(id) || 0)+allocation);
          operation.cost += resource.operatingCost * allocation;
        } else resource.quantity -= operation.resourceQuantities[id] || 0;
      }
      for (const effect of operation.maintenanceEffects) {
        const resource = farm.resources.find(r=>r.id===effect.resourceId);
        for (let day=0; day<effect.durationDays; day++) resource.availability[addDays(date,day)] = effect.factor;
      }
      farm.cropInstances = farm.cropInstances.map(crop => operation.productionUnitIds.includes(crop.productionUnitId)
        ? this.#packs[crop.cropPackId].applyOperation(crop,operation) : crop);
      // Inspections deliver a report a day later, never immediate truth access.
      if (operation.type === 'inspection') {
        s.observations.push(...sampleObservations(farm.cropInstances,[{id:`inspection:${operation.id}`,sourceType:'worker',variable:'waterStress',
          productionUnitIds:operation.productionUnitIds,everyDays:1,delayDays:1,uncertainty:0.03,reliability:0.9,freshness:3},
        {id:`inspection-stage:${operation.id}`,sourceType:'worker',variable:'stage',productionUnitIds:operation.productionUnitIds,
          everyDays:1,delayDays:1,uncertainty:0,reliability:0.9,freshness:7}],date,1,this.#random));
      }
      completed.push(operation);
    }
    return completed;
  }

  #updateFinance(completed) {
    const s = this.#state, farm = s.farmState;
    for (const operation of completed) farm.finance = recordExpense(farm.finance,{id:`expense:${operation.id}`,date:operation.actualStart,amount:operation.cost,sourceId:operation.id});
    farm.finance.forecastRevenue = farm.cropInstances.reduce((sum,crop)=> {
      const pack = this.#packs[crop.cropPackId];
      const belief = s.beliefs.find(b=>b.actorId===this.#playerActorId && b.productionUnitId===crop.productionUnitId && b.subject==='waterStress');
      return sum + pack.forecastRevenue(pack.varieties[crop.varietyId],belief?.estimate ?? 0.2);
    },0);
  }

  /** Engine-only persistence payload contains hidden state. NEVER expose this to players/agents. */
  exportCheckpoint() {
    return clone({ version:1, fixture:this.#fixture, state:this.#state, random:this.#random.exportState(), views:[...this.#views] });
  }
  static restore(checkpoint, cropPacks) {
    if (checkpoint.version !== 1) throw new TypeError('Unsupported checkpoint version');
    const engine = new SimulationEngine(checkpoint.fixture,cropPacks);
    engine.#state = clone(checkpoint.state);
    // Older Phase 1 version-1 checkpoints remain loadable; new metadata has safe defaults.
    engine.#state.attention ??= engine.#newAttention(engine.#state.currentDate);
    engine.#state.acceptedRequests ??= {};
    engine.#state.purchaseSequence ??= engine.#state.farmState.finance.emergencyPurchases.length;
    engine.#state.openDecisionCases = engine.#state.openDecisionCases.map(createDecisionCase);
    engine.#state.scheduledOperations = engine.#state.scheduledOperations.map(createOperation);
    engine.#random = RandomEngine.restore(checkpoint.random);
    engine.#views = new Map(clone(checkpoint.views));
    engine.#saveView();
    return engine;
  }
}
export default SimulationEngine;
