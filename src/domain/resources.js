import { fraction, model, nonnegative } from './validation.js';
export const CAPACITY_TYPES = ['person', 'crew', 'machine', 'robot'];
export const INVENTORY_TYPES = ['water', 'fertilizer', 'chemical', 'fuel'];
/** @typedef {{id:string, type:string, name:string, capacityPerDay:number, quantity:number, unit:string, availability:Object, skills:string[], compatibleOperations:string[], currentLocation:string|null, reliability:number, operatingCost:number, status:string}} Resource */
export function createResource(input) {
  const resource = model({ capacityPerDay: 0, quantity: 0, unit: 'day', availability: {}, skills: [],
    compatibleOperations: [], currentLocation: null, reliability: 1, operatingCost: 0, status: 'available' }, input, ['id', 'type', 'name']);
  if (![...CAPACITY_TYPES, ...INVENTORY_TYPES].includes(resource.type)) throw new RangeError('Unknown resource type');
  for (const key of ['capacityPerDay', 'quantity', 'operatingCost']) nonnegative(resource[key], key);
  fraction(resource.reliability, 'reliability');
  return resource;
}
export const isCapacityResource = resource => CAPACITY_TYPES.includes(resource.type);
export function availableCapacity(resource, date) {
  return resource.status === 'available' ? resource.capacityPerDay * (resource.availability[date] ?? 1) : 0;
}
