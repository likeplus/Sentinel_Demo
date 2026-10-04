import { model, nonnegative } from './validation.js';
/** @typedef {{id:string, name:string, avatar:string|null, role:string, reportsTo:string|null, skills:Object, experience:number, traits:Object, riskPreference:string, permissions:string[], decisionScope:string[], workload:number, beliefStateIds:string[]}} Person */
export function createPerson(input) {
  const person = model({ avatar: null, reportsTo: null, skills: {}, experience: 0, traits: {},
    riskPreference: 'balanced', permissions: [], decisionScope: [], workload: 0, beliefStateIds: [] }, input, ['id', 'name', 'role']);
  nonnegative(person.workload, 'workload');
  nonnegative(person.experience, 'experience');
  for (const weight of Object.values(person.traits.sourceWeights || {})) nonnegative(weight, 'source weight');
  if (person.traits.riskBias !== undefined && !Number.isFinite(person.traits.riskBias)) throw new TypeError('riskBias must be finite');
  return person;
}
/** @typedef {{id:string, name:string, supervisorId:string|null, memberIds:string[], resourceId:string}} Crew */
export const createCrew = input => model({ supervisorId: null, memberIds: [] }, input, ['id', 'name', 'resourceId']);
