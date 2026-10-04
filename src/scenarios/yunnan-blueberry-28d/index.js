import { createDecisionCase, createFinance, createObservation, createWorld } from '../../domain/index.js';
import { clone } from '../../domain/validation.js';
import { farm } from './farm.js';
import { productionUnits, cropInstances } from './productionUnits.js';
import { people, crews } from './people.js';
import { resources } from './resources.js';
import { scenario } from './scenario.js';
export { farm, productionUnits, cropInstances, people, crews, resources, scenario };

const observations = [
  createObservation({id:'pu03-sensor-day4',productionUnitId:'PU-03',sourceType:'sensor',sourceId:'sensor-pu03',variable:'waterStress',value:0.85,unit:'ratio',uncertainty:0.1,reliability:0.8,observedAt:'2026-03-04',availableAt:'2026-03-04',freshness:3}),
  createObservation({id:'pu03-worker-day4',productionUnitId:'PU-03',sourceType:'worker',sourceId:'worker-pu03',variable:'waterStress',value:0.2,unit:'ratio',uncertainty:0.2,reliability:0.7,observedAt:'2026-03-04',availableAt:'2026-03-04',freshness:3}),
  createObservation({id:'pu03-lab-day4',productionUnitId:'PU-03',sourceType:'lab',sourceId:'lab-pu03',variable:'waterStress',value:0.7,unit:'ratio',uncertainty:0.03,reliability:0.95,observedAt:'2026-03-04',availableAt:'2026-03-06',freshness:5}),
];
const irrigationOption = { id:'irrigate-pu03',type:'decide_now',operation:{type:'irrigation',productionUnitIds:['PU-03'],plannedDurationDays:0.5,
  assignedResourceIds:['crew-a','irrigation-rig','water'],plannedOutput:{water:20},resourceQuantities:{water:20}} };
const decisionTemplates = [
  createDecisionCase({id:'water-stress-pu03',trigger:'date',title:'PU-03 water stress: sensor/worker disagreement',category:'water',openedAt:'2026-03-04',deadline:'2026-03-07',
    productionUnitIds:['PU-03'],impactAreas:['water','quality'],participantIds:['manager','agronomist','sentinel'],disagreementTopics:['Sensor reports severe stress; worker reports mild stress'],
    investigationOptions:[{id:'inspect-pu03',type:'gather_information',operation:{type:'inspection',productionUnitIds:['PU-03'],plannedDurationDays:0.25,assignedResourceIds:['crew-a'],plannedOutput:{samples:1}}}],
    actionOptions:[irrigationOption,{id:'gather',type:'gather_information'},{id:'delegate',type:'delegate'},{id:'delay',type:'delay'},{id:'none',type:'no_action'},{id:'custom',type:'custom'}],managerAttentionCost:0.25,
    opportunityCosts:[{resourceId:'crew-a',reservedDays:0.5}] }),
  createDecisionCase({id:'pre-harvest',title:'Pre-harvest water allocation trade-off',openedAt:'2026-03-21',productionUnitIds:['PU-01','PU-03'],participantIds:['manager','agronomist','sentinel'],impactAreas:['quality','water']}),
];
/** Fresh JSON data on every call. Delayed samples and crop truth are engine inputs, never player props. */
export function createYunnanBlueberryFixture(overrides = {}) {
  return clone({ scenario:{...scenario,...overrides,endConditions:overrides.endConditions || [{type:'date',date:overrides.endDate || scenario.endDate}]}, world:createWorld({id:'yunnan-world',date:scenario.startDate}),farm,productionUnits,cropInstances,people,crews,resources,
    finance:createFinance({cash:overrides.startingCash ?? scenario.startingCash}),observations,decisionTemplates,
    observationProfiles:[{id:'field-sensor',sourceType:'sensor',variable:'waterStress',everyDays:1,delayDays:1,uncertainty:0.08,reliability:0.85,freshness:2},
      {id:'field-worker',sourceType:'worker',variable:'waterStress',everyDays:3,delayDays:0,uncertainty:0.15,reliability:0.7,freshness:3,bias:-0.08}] });
}
export default createYunnanBlueberryFixture;
