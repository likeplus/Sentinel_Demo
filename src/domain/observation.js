import { fraction, model, nonnegative } from './validation.js';
/** @typedef {{id:string, productionUnitId:string, sourceType:string, sourceId:string, variable:string, value:number, unit:string, uncertainty:number, coverage:number, observedAt:string, availableAt:string, freshness:number, reliability:number, status:string}} Observation */
export function createObservation(input) {
  const observation = model({ sourceType: 'sensor', sourceId: 'unknown', unit: '', uncertainty: 0,
    coverage: 1, freshness: 2, reliability: 1, status: 'current' }, input, ['id', 'productionUnitId', 'variable', 'observedAt', 'availableAt']);
  if (!Number.isFinite(Date.parse(observation.observedAt)) || !Number.isFinite(Date.parse(observation.availableAt))
    || Date.parse(observation.availableAt) < Date.parse(observation.observedAt)) throw new RangeError('Invalid observation timestamps');
  if (!['current', 'stale', 'invalid'].includes(observation.status)) throw new RangeError('Unknown observation status');
  nonnegative(observation.freshness, 'freshness (days)');
  nonnegative(observation.uncertainty, 'uncertainty');
  fraction(observation.reliability, 'reliability');
  fraction(observation.coverage, 'coverage');
  if (!Number.isFinite(observation.value)) throw new TypeError('Observation value must be numeric in Phase 1');
  return observation;
}
