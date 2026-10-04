import { createCrew, createPerson } from '../../domain/index.js';
export const people = [
  createPerson({ id: 'manager', name: 'Farm Manager', role: 'farm_manager', permissions: ['decide','schedule'], decisionScope: ['farm'], traits: { sourceWeights: { sensor:1, worker:1, lab:2 } } }),
  createPerson({ id: 'agronomist', name: 'Agronomist', role: 'agronomist', reportsTo: 'manager', experience: 8,
    skills: { blueberry:0.9 }, traits: { sourceWeights: { sensor:0.5, worker:2, lab:3 } } }),
  createPerson({ id: 'irrigation-manager', name: 'Irrigation Manager', role: 'irrigation_manager', reportsTo: 'manager' }),
  createPerson({ id: 'supervisor', name: 'Field Supervisor', role: 'field_supervisor', reportsTo: 'manager' }),
  createPerson({ id: 'maintenance', name: 'Maintenance Lead', role: 'maintenance_lead', reportsTo: 'manager' }),
  createPerson({ id: 'sentinel', name: 'Sentinel Agent slot', role: 'sentinel_agent', reportsTo: 'manager',
    traits: { sourceWeights: { sensor:2, worker:0.5, lab:3 }, riskBias:0.05 } }),
];
export const crews = [createCrew({id:'crew-team-a',name:'Crew A',supervisorId:'supervisor',memberIds:[],resourceId:'crew-a'})];
