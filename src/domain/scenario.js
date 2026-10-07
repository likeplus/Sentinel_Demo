import { model, dateMs, daysBetween, nonnegative } from './validation.js';

/**
 * @typedef {Object} Scenario
 * @property {string} id
 * @property {string} name
 * @property {string} startDate Inclusive UTC date.
 * @property {string} endDate Exclusive UTC date (28 daily transitions for a 28-day scenario).
 * @property {number} stepDays Positive integral number of days per advanceStep().
 * @property {string|number} seed
 * @property {string} playerRole
 * @property {string} farmConfigId
 * @property {string[]} cropPackIds
 * @property {number} startingCash
 * @property {string[]} criticalResourceIds
 * @property {Object[]} eventRules JSON-only window/condition/probability rules.
 * @property {string} difficulty
 * @property {string} observationMode
 * @property {Object[]} endConditions
 * @property {string[]} evaluationDimensions No combined player score.
 */
export function createScenario(input) {
  const scenario = model({ stepDays: 1, seed: 1, playerRole: 'farm_manager', cropPackIds: [],
    startingCash: 0, criticalResourceIds: [], eventRules: [], difficulty: 'normal',
    observationMode: 'delayed', endConditions: [], evaluationDimensions: [], managerAttention: null,
    emergencySupplies: [], inspectionPlan: null }, input, ['id', 'name', 'farmConfigId']);
  if (dateMs(scenario.endDate) <= dateMs(scenario.startDate)) throw new RangeError('endDate must follow startDate');
  if (!Number.isInteger(scenario.stepDays) || scenario.stepDays < 1) throw new RangeError('stepDays must be a positive integer');
  if (!['string', 'number'].includes(typeof scenario.seed)) throw new TypeError('seed must be a string or number');
  nonnegative(scenario.startingCash, 'startingCash');
  if (scenario.managerAttention) {
    nonnegative(scenario.managerAttention.dailyBudget, 'attention dailyBudget');
    for (const cost of Object.values(scenario.managerAttention.costs || {})) nonnegative(cost, 'attention cost');
  }
  for (const supply of scenario.emergencySupplies) {
    if (typeof supply.resourceId !== 'string') throw new TypeError('Emergency supply needs resourceId');
    nonnegative(supply.unitPrice, 'supply unitPrice');
    nonnegative(supply.maxQuantity, 'supply maxQuantity');
  }
  for (const condition of scenario.endConditions) {
    if (condition.type !== 'date') throw new TypeError('Phase 1 supports only date end conditions');
    if (condition.date !== scenario.endDate) throw new RangeError('Date end condition must match endDate');
  }
  return scenario;
}
export const scenarioDuration = scenario => daysBetween(scenario.startDate, scenario.endDate);
