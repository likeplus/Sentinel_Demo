import { dateMs, model, nonnegative } from './validation.js';
import { availableCapacity, isCapacityResource } from './resources.js';
export const DAY_ALLOCATIONS = [0.25, 0.5, 0.75, 1];
/**
 * @typedef {Object} Operation
 * @property {string} id
 * @property {string} type
 * @property {string} sourceType
 * @property {string|null} sourceId
 * @property {string[]} productionUnitIds
 * @property {string} plannedStart UTC date; Phase 1 reserves fractional capacity on this day.
 * @property {number} plannedDurationDays One of 0.25, 0.5, 0.75, 1.
 * @property {string[]} assignedResourceIds
 * @property {Object} plannedOutput
 * @property {number} priority
 * @property {string|null} actualStart
 * @property {number|null} actualDurationDays
 * @property {string[]} actualResourceIds
 * @property {Object|null} actualOutput
 * @property {number} travelOverhead Additional day capacity reserved for travel.
 * @property {string} executionStatus
 * @property {Object[]} deviations
 * @property {number} cost
 * @property {Object<string,number>} resourceQuantities Inventory units consumed upon execution.
 */
export function createOperation(input) {
  const operation = model({ sourceType: 'decision', sourceId: null, productionUnitIds: [], plannedDurationDays: 0.25,
    assignedResourceIds: [], plannedOutput: {}, priority: 0, actualStart: null, actualDurationDays: null,
    actualResourceIds: [], actualOutput: null, travelOverhead: 0, executionStatus: 'scheduled', deviations: [],
    cost: 0, resourceQuantities: {}, maintenanceEffects: [] }, input, ['id', 'type', 'plannedStart']);
  dateMs(operation.plannedStart);
  if (!DAY_ALLOCATIONS.includes(operation.plannedDurationDays)) throw new RangeError('Use quarter-day allocations');
  nonnegative(operation.travelOverhead, 'travelOverhead');
  nonnegative(operation.cost, 'cost');
  nonnegative(operation.priority, 'priority');
  for (const [name, value] of Object.entries(operation.plannedOutput)) {
    if (typeof value === 'number') nonnegative(value, `planned output ${name}`);
  }
  if (new Set(operation.assignedResourceIds).size !== operation.assignedResourceIds.length) throw new TypeError('Duplicate assigned resource');
  for (const [id, quantity] of Object.entries(operation.resourceQuantities)) {
    nonnegative(quantity, `resource ${id}`);
    if (!operation.assignedResourceIds.includes(id)) throw new TypeError('Inventory resource must be assigned');
  }
  for (const effect of operation.maintenanceEffects) {
    if (typeof effect.resourceId !== 'string' || !Number.isFinite(effect.factor) || effect.factor < 0 || effect.factor > 1
      || !Number.isInteger(effect.durationDays) || effect.durationDays < 1) throw new TypeError('Invalid maintenance effect');
  }
  return operation;
}

/** Report daily capacity and total inventory reservations. Never silently overbook. */
export function detectResourceConflicts(operations, resources) {
  const active = operations.filter(op => ['scheduled', 'blocked', 'in_progress'].includes(op.executionStatus));
  const conflicts = [];
  const usage = new Map();
  for (const operation of active) {
    for (const id of operation.assignedResourceIds) {
      const resource = resources.find(r => r.id === id);
      if (!resource) { conflicts.push({ type: 'missing_resource', resourceId: id, operationIds: [operation.id] }); continue; }
      if (resource.compatibleOperations.length && !resource.compatibleOperations.includes(operation.type)) {
        conflicts.push({ type: 'incompatible_operation', resourceId: id, operationIds: [operation.id] });
      }
      const capacity = isCapacityResource(resource);
      const key = `${id}:${capacity ? operation.plannedStart : 'inventory'}`;
      const entry = usage.get(key) || { resourceId: id, date: capacity ? operation.plannedStart : null,
        type: capacity ? 'capacity' : 'inventory', requested: 0, available: capacity
          ? availableCapacity(resource, operation.plannedStart) : (resource.status === 'available' ? resource.quantity : 0), operationIds: [] };
      entry.requested += capacity ? operation.plannedDurationDays + operation.travelOverhead : (operation.resourceQuantities[id] ?? 0);
      entry.operationIds.push(operation.id);
      usage.set(key, entry);
    }
  }
  for (const entry of usage.values()) if (entry.requested > entry.available + 1e-9) conflicts.push(entry);
  return conflicts;
}
