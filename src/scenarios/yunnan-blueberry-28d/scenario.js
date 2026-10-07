import { createScenario } from '../../domain/scenario.js';
import { eventRules } from './eventRules.js';
export const scenario = createScenario({ id:'yunnan-blueberry-28d',name:'云南蓝莓 28 天管理训练',
  startDate:'2026-03-01',endDate:'2026-03-29',seed:'yunnan-blueberry-v0.1',playerRole:'farm_manager',
  farmConfigId:'yunnan-farm',cropPackIds:['blueberry'],startingCash:80000,criticalResourceIds:['water'],eventRules,
  managerAttention:{dailyBudget:4,costs:{decide_now:1,gather_information:1,delegate:1,delay:0,no_action:0,custom:1,approve:1}},
  emergencySupplies:[{resourceId:'water',unitPrice:2,maxQuantity:1000}],
  inspectionPlan:{type:'inspection',plannedDurationDays:0.25,assignedResourceIds:['crew-a'],plannedOutput:{samples:1}},
  endConditions:[{type:'date',date:'2026-03-29'}],evaluationDimensions:['cash','water','quality','decision_trace'] });
