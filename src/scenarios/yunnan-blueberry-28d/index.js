import { createDecisionCase, createFinance, createObservation, createWorld } from '../../domain/index.js';
import { clone } from '../../domain/validation.js';
import { farm } from './farm.js';
import { productionUnits, cropInstances } from './productionUnits.js';
import { people, crews } from './people.js';
import { resources } from './resources.js';
import { scenario } from './scenario.js';
export { farm, productionUnits, cropInstances, people, crews, resources, scenario };

// Authored, previously delivered knowledge. No player-facing selector reads crop truth.
const openingStages = productionUnits.slice(0, 8).map(unit => createObservation({
  id:`opening-stage:${unit.id}`, productionUnitId:unit.id, sourceType:'worker', sourceId:'opening-scout',
  variable:'stage', valueType:'category', value:'ripening', reliability:0.85, uncertainty:0,
  observedAt:'2026-03-01', availableAt:'2026-03-01', freshness:4,
}));
const observations = [
  ...openingStages,
  createObservation({id:'opening-water:PU-01',productionUnitId:'PU-01',sourceType:'worker',sourceId:'opening-water-check',variable:'waterStress',value:0.2,unit:'ratio',uncertainty:0.15,reliability:0.7,observedAt:'2026-03-01',availableAt:'2026-03-01',freshness:2}),
  createObservation({id:'opening-water:PU-02',productionUnitId:'PU-02',sourceType:'worker',sourceId:'opening-water-check',variable:'waterStress',value:0.25,unit:'ratio',uncertainty:0.15,reliability:0.7,observedAt:'2026-03-01',availableAt:'2026-03-01',freshness:2}),
  createObservation({id:'old-water:PU-05',productionUnitId:'PU-05',sourceType:'worker',sourceId:'prior-week-check',variable:'waterStress',value:0.2,unit:'ratio',uncertainty:0.2,reliability:0.65,observedAt:'2026-02-24',availableAt:'2026-03-01',freshness:3}),
  createObservation({id:'pu03-sensor-day4',productionUnitId:'PU-03',sourceType:'sensor',sourceId:'sensor-pu03',variable:'waterStress',value:0.85,unit:'ratio',uncertainty:0.1,reliability:0.8,observedAt:'2026-03-04',availableAt:'2026-03-04',freshness:3}),
  createObservation({id:'pu03-worker-day4',productionUnitId:'PU-03',sourceType:'worker',sourceId:'worker-pu03',variable:'waterStress',value:0.2,unit:'ratio',uncertainty:0.2,reliability:0.7,observedAt:'2026-03-04',availableAt:'2026-03-04',freshness:3}),
  createObservation({id:'pu03-lab-day4',productionUnitId:'PU-03',sourceType:'lab',sourceId:'lab-pu03',variable:'waterStress',value:0.7,unit:'ratio',uncertainty:0.03,reliability:0.95,observedAt:'2026-03-04',availableAt:'2026-03-06',freshness:5}),
];
const investigation = (id, productionUnitIds) => ({
  id, type:'gather_information', label:'安排现场检查', description:'占用班组四分之一天；执行后次日送达报告，当前不能看到结果。',
  estimatedCost:100, attentionCost:1, operation:{type:'inspection',productionUnitIds,plannedDurationDays:0.25,assignedResourceIds:['crew-a'],plannedOutput:{samples:1}},
});
const managementChoices = [
  {id:'delegate',type:'delegate',label:'请下属提出方案',description:'下属依据已送达证据提出建议；汇报次日到达，由你批准后执行。',attentionCost:1},
  {id:'delay',type:'delay',label:'延后复查',description:'保留问题，按你选择的复查日期提醒；错过期限记录在复盘中。',attentionCost:0},
  {id:'none',type:'no_action',label:'记录理由，不采取行动',description:'关闭当前决策并保留理由；后续证据与结果可供复盘，不自动评判对错。',attentionCost:0},
];
const irrigation = (id, label, productionUnitIds, water, days) => ({
  id, type:'decide_now', label, description:`使用 ${water} m³ 水和 ${days} 天班组/设备容量；实际送水量受作业效率影响。`,
  estimatedCost:520*days, attentionCost:1,
  operation:{type:'irrigation',productionUnitIds,plannedDurationDays:days,
    assignedResourceIds:['crew-a','irrigation-rig','water'],plannedOutput:{water},resourceQuantities:{water}},
});
const decisionTemplates = [
  createDecisionCase({
    id:'water-stress-pu03',trigger:'date',title:'PU-03：传感器与现场报告不一致',category:'water',openedAt:'2026-03-04',deadline:'2026-03-07',
    description:'传感器报告明显水分胁迫，现场人员认为情况较轻。你可以先调查，也可以基于现有证据安排灌溉。',
    productionUnitIds:['PU-03'],impactAreas:['water','quality'],participantIds:['manager','agronomist','sentinel'],
    disagreementTopics:['传感器报告严重胁迫；工人报告轻度胁迫。'],
    participantGuidance:[{actorId:'agronomist',text:'综合现场观察与实验室报告，再判断是否需要补水。'},{actorId:'sentinel',text:'传感器有异常信号，建议关注，但信号不是隐藏真值。'}],
    investigationOptions:[investigation('inspect-pu03',['PU-03'])],
    actionOptions:[irrigation('irrigate-pu03','给 PU-03 补水',['PU-03'],20,0.5),
      {id:'gather',type:'gather_information',label:'调查后再决定'},...managementChoices,{id:'custom',type:'custom',label:'自定义方案'}],
    delegateDelayDays:1,delegationThreshold:0.35,managerAttentionCost:1,
    opportunityCosts:[{resourceId:'crew-a',reservedDays:0.5,label:'灌溉占用半天班组，可能挤占当天检查。'}],
  }),
  createDecisionCase({
    id:'valve-disruption',title:'PU-03：滴灌设备减速，先修还是绕开？',category:'operations',openedAt:'2026-03-07',deadline:'2026-03-17',
    description:'设备调度记录显示连续三天只有一半可用容量。维修可以恢复容量；人工补水绕过设备，但需要更多班组时间。',
    productionUnitIds:['PU-03'],impactAreas:['water','labor','reliability'],participantIds:['manager','maintenance','agronomist','sentinel'],
    disagreementTopics:['修复设备降低后续排程压力；人工补水可直接缓解当前已知水分风险。'],
    participantGuidance:[{actorId:'maintenance',text:'维修使用独立维修人员；完成后恢复未来三天滴灌设备容量。'},{actorId:'agronomist',text:'若已送达观测仍提示胁迫，人工补水可绕开设备，但会占用更多班组。'}],
    investigationOptions:[investigation('inspect-valve-pu03',['PU-03'])],
    actionOptions:[
      {id:'repair-valve',type:'decide_now',label:'安排阀门维修',description:'维修人员半天，预计 ¥150；完成后恢复未来三天滴灌设备容量。',estimatedCost:150,attentionCost:1,
        operation:{type:'maintenance',productionUnitIds:['PU-03'],plannedDurationDays:0.5,assignedResourceIds:['maintenance-person'],plannedOutput:{repairs:1},
          maintenanceEffects:[{resourceId:'irrigation-rig',factor:1,durationDays:3}]}},
      {id:'manual-irrigation-pu03',type:'decide_now',label:'绕过设备，人工补水',description:'不使用滴灌设备；消耗 25 m³ 水和班组四分之三天，预计 ¥300。',estimatedCost:300,attentionCost:1,
        operation:{type:'irrigation',productionUnitIds:['PU-03'],plannedDurationDays:0.75,assignedResourceIds:['crew-a','water'],plannedOutput:{water:25},resourceQuantities:{water:25}}},
      ...managementChoices,
    ],delegateDelayDays:1,delegationThreshold:0.6,managerAttentionCost:1,
    opportunityCosts:[{resourceId:'crew-a',reservedDays:0.75,label:'人工补水会挤占当天其他检查与灌溉。'},{resourceId:'maintenance-person',reservedDays:0.5,label:'维修占用半天独立维修人员。'}],
  }),
  createDecisionCase({
    id:'pre-harvest',title:'采收前：PU-01 与 PU-03 如何分配水和班组？',category:'water',openedAt:'2026-03-21',deadline:'2026-03-27',
    description:'水库调拨扣减本地 3000 m³ 配额后，两块地争用同一天的班组与设备。检查各自已知水分信息，决定集中补水或分配给两块地。',
    productionUnitIds:['PU-01','PU-03'],impactAreas:['quality','water','labor'],participantIds:['manager','agronomist','sentinel'],
    disagreementTopics:['优先早熟地块，还是优先已知风险较高的地块？同时安排两个四分之三天方案会超出一天容量。'],
    participantGuidance:[{actorId:'agronomist',text:'阶段报告与水分报告各有采样和送达时间；过期报告不能当作当前状态。'},{actorId:'sentinel',text:'建议根据已送达证据分配资源；预计收入只用于比较，不是已经获得的利润。'}],
    investigationOptions:[investigation('inspect-pre-harvest',['PU-01','PU-03'])],
    actionOptions:[
      irrigation('prioritize-pu01','优先给 PU-01 补水',['PU-01'],60,0.75),
      irrigation('prioritize-pu03','优先给 PU-03 补水',['PU-03'],60,0.75),
      irrigation('split-pre-harvest','给两块地分配补水',['PU-01','PU-03'],80,1),
      ...managementChoices,
    ],delegateDelayDays:1,delegationThreshold:0.35,managerAttentionCost:1,
    opportunityCosts:[{resourceId:'water',quantity:80,label:'两地方案共用 80 m³ 水，每块地得到约一半实际产出。'},
      {resourceId:'crew-a',reservedDays:1,label:'两地方案占满一天班组；当天无法再安排检查。'},
      {resourceId:'irrigation-rig',reservedDays:1,label:'两个独立优先方案合计 1.5 天，会产生容量冲突。'}],
  }),
];

/** Fresh JSON data on every call. Delayed samples and crop truth are engine inputs, never player props. */
export function createYunnanBlueberryFixture(overrides = {}) {
  return clone({
    scenario:{...scenario,...overrides,endConditions:overrides.endConditions || [{type:'date',date:overrides.endDate || scenario.endDate}]},
    world:createWorld({id:'yunnan-world',date:scenario.startDate}),farm,productionUnits,cropInstances,people,crews,resources,
    finance:createFinance({cash:overrides.startingCash ?? scenario.startingCash}),observations,decisionTemplates,
    observationProfiles:[
      {id:'field-sensor',sourceType:'sensor',variable:'waterStress',productionUnitIds:productionUnits.slice(0,8).map(unit=>unit.id),everyDays:2,delayDays:1,uncertainty:0.08,reliability:0.85,freshness:2},
      {id:'field-worker',sourceType:'worker',variable:'waterStress',productionUnitIds:productionUnits.slice(0,4).map(unit=>unit.id),everyDays:3,delayDays:0,uncertainty:0.15,reliability:0.7,freshness:3,bias:-0.08},
      {id:'stage-scout-near',sourceType:'worker',variable:'stage',valueType:'category',productionUnitIds:productionUnits.slice(0,8).map(unit=>unit.id),everyDays:7,delayDays:2,uncertainty:0,reliability:0.85,freshness:4},
      {id:'stage-scout-far',sourceType:'worker',variable:'stage',valueType:'category',productionUnitIds:productionUnits.slice(8).map(unit=>unit.id),everyDays:10,delayDays:2,uncertainty:0,reliability:0.8,freshness:4},
    ],
  });
}
export default createYunnanBlueberryFixture;
