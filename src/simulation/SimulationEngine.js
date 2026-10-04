import { createFarm, createWorld, createCrew, createFinance, createScenario, createProductionUnit, createCropInstance, createPerson, createResource,
  createObservation, createDecisionCase, createOperation, detectResourceConflicts, isCapacityResource,
  availableCapacity, recordExpense, DECISION_ACTIONS } from '../domain/index.js';
import { addDays, clone, dateMs } from '../domain/validation.js';
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
    if (!this.#playerActorId) throw new TypeError('Missing player actor for playerRole');
    this.#random = new RandomEngine(config.scenario.seed);
    config.world.date = config.scenario.startDate;
    this.#state = { scenarioId: config.scenario.id, currentDate: config.scenario.startDate, currentDayIndex: 0,
      speed: 1, paused: true, randomSeed: config.scenario.seed, ended: false, worldState: clone(config.world),
      farmState: { farm: clone(config.farm), productionUnits: clone(config.productionUnits),
        cropInstances: clone(config.cropInstances), people: clone(config.people), crews: clone(config.crews || []),
        resources: clone(config.resources), finance: clone(config.finance) },
      observations: clone(config.observations), beliefs: [], pendingEvents: [], openDecisionCases: [], scheduledOperations: [],
      eventCounts: {}, eventRolls: [], eventHistory: [], outcomes: [], history: [], operationSequence: 0 };
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
    // 3 resources: daily availability is dated; capacity is never carried over.
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
    if (effect.type === 'resource_availability') resource.availability[date] = effect.factor;
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
    }
  }

  scheduleOperation(input) {
    const operation = createOperation(input);
    const s = this.#state;
    if (this.ended || operation.plannedStart <= this.currentDate || operation.plannedStart > this.#fixture.scenario.endDate) throw new RangeError('Operation must be on a remaining simulation day');
    if (operation.executionStatus !== 'scheduled') throw new TypeError('New operation must be scheduled');
    if (s.scheduledOperations.some(o=>o.id===operation.id)) throw new TypeError('Duplicate operation id');
    if (!operation.productionUnitIds.length || operation.productionUnitIds.some(id=>!s.farmState.productionUnits.some(u=>u.id===id))) throw new TypeError('Unknown operation ProductionUnit');
    const crops = s.farmState.cropInstances.filter(c=>operation.productionUnitIds.includes(c.productionUnitId));
    if (crops.some(c=>!this.#packs[c.cropPackId].operations[operation.type])) throw new TypeError('CropPack does not support operation');
    const conflicts = detectResourceConflicts([...s.scheduledOperations, operation], s.farmState.resources);
    if (conflicts.length) return { accepted:false, conflicts };
    s.scheduledOperations.push(operation);
    this.#saveView();
    return { accepted:true, operation:clone(operation), conflicts:[] };
  }

  /** Explicit player decision, never an autonomous truth-aware action. */
  decide(caseId, selection) {
    const s = this.#state;
    const decision = s.openDecisionCases.find(c=>c.id===caseId);
    if (!decision || !['open','delayed','delegated','investigating'].includes(decision.status) || this.ended) throw new TypeError('Decision is unavailable');
    if (!DECISION_ACTIONS.includes(selection.type)) throw new TypeError('Unknown decision action');
    const choice = [...decision.actionOptions,...decision.investigationOptions].find(o=>o.id===selection.optionId && o.type===selection.type);
    let plan = choice?.operation;
    if (selection.type === 'custom') plan = selection.operation;
    if (selection.type === 'decide_now' && !plan) throw new TypeError('Choose an action with an operation');
    if (selection.type === 'delegate' && !s.farmState.people.some(p=>p.id===selection.delegatedTo)) throw new TypeError('Unknown delegate');
    let result = {accepted:true, conflicts:[]};
    if (plan) {
      let sequence = s.operationSequence + 1;
      while (s.scheduledOperations.some(o => o.id === `OP-${sequence}`)) sequence++;
      const id = `OP-${sequence}`;
      result = this.scheduleOperation({...plan,id,sourceId:caseId,sourceType:'decision',plannedStart:selection.plannedStart || addDays(this.currentDate,1)});
      if (!result.accepted) return result;
      s.operationSequence = sequence;
      decision.resultingOperationIds.push(id);
    }
    decision.selectedAction = clone(selection);
    decision.playerReasonTags = clone(selection.reasonTags || []);
    decision.playerReasonText = selection.reasonText || '';
    decision.delegatedTo = selection.delegatedTo || null;
    decision.status = plan ? (selection.type === 'gather_information' ? 'investigating' : 'scheduled')
      : ({delegate:'delegated',delay:'delayed',no_action:'resolved',gather_information:'investigating',custom:'resolved'})[selection.type];
    this.#saveView();
    return result;
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
      farm.cropInstances = farm.cropInstances.map(crop => operation.productionUnitIds.includes(crop.productionUnitId)
        ? this.#packs[crop.cropPackId].applyOperation(crop,operation) : crop);
      // Inspections deliver a report a day later, never immediate truth access.
      if (operation.type === 'inspection') {
        s.observations.push(...sampleObservations(farm.cropInstances,[{id:`inspection:${operation.id}`,sourceType:'worker',variable:'waterStress',
          productionUnitIds:operation.productionUnitIds,everyDays:1,delayDays:1,uncertainty:0.03,reliability:0.9,freshness:3}],date,1,this.#random));
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
    engine.#random = RandomEngine.restore(checkpoint.random);
    engine.#views = new Map(clone(checkpoint.views));
    return engine;
  }
}
export default SimulationEngine;
