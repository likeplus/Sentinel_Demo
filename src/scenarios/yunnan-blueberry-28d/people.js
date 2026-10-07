import { createCrew, createPerson } from '../../domain/index.js';
export const people = [
  createPerson({ id: 'manager', name: '农场经理（你）', role: 'farm_manager', permissions: ['decide','schedule'], decisionScope: ['farm'], traits: { sourceWeights: { sensor:1, worker:1, lab:2 } } }),
  createPerson({ id: 'agronomist', name: '农艺师', role: 'agronomist', reportsTo: 'manager', experience: 8,
    skills: { blueberry:0.9 }, traits: { sourceWeights: { sensor:0.5, worker:2, lab:3 } } }),
  createPerson({ id: 'irrigation-manager', name: '灌溉主管', role: 'irrigation_manager', reportsTo: 'manager' }),
  createPerson({ id: 'supervisor', name: '现场主管', role: 'field_supervisor', reportsTo: 'manager' }),
  createPerson({ id: 'maintenance', name: '维修负责人', role: 'maintenance_lead', reportsTo: 'manager' }),
  createPerson({ id: 'sentinel', name: 'Sentinel 规则建议助手', role: 'sentinel_agent', reportsTo: 'manager',
    traits: { sourceWeights: { sensor:2, worker:0.5, lab:3 }, riskBias:0.05 } }),
];
export const crews = [createCrew({id:'crew-team-a',name:'现场班组 A',supervisorId:'supervisor',memberIds:[],resourceId:'crew-a'})];
