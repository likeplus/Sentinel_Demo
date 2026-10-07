import { fraction, model, nonnegative } from './validation.js';
/** Categorical reports are explicit evidence; they are never a numeric belief or crop truth prop. */
export const OBSERVATION_CATEGORIES = { stage: ['vegetative', 'flowering', 'fruit_set', 'ripening', 'harvest'] };
/** @typedef {{id:string, productionUnitId:string, sourceType:string, sourceId:string, variable:string, value:number|string, valueType:string, unit:string, uncertainty:number, coverage:number, observedAt:string, availableAt:string, freshness:number, reliability:number, status:string}} Observation */
export function createObservation(input) {
  const observation = model({ sourceType: 'sensor', sourceId: 'unknown', valueType: input.variable === 'stage' ? 'category' : 'number', unit: '', uncertainty: 0,
    coverage: 1, freshness: 2, reliability: 1, status: 'current' }, input, ['id', 'productionUnitId', 'variable', 'observedAt', 'availableAt']);
  if (!Number.isFinite(Date.parse(observation.observedAt)) || !Number.isFinite(Date.parse(observation.availableAt))
    || Date.parse(observation.availableAt) < Date.parse(observation.observedAt)) throw new RangeError('Invalid observation timestamps');
  if (!['current', 'stale', 'invalid'].includes(observation.status)) throw new RangeError('Unknown observation status');
  nonnegative(observation.freshness, 'freshness (days)');
  nonnegative(observation.uncertainty, 'uncertainty');
  fraction(observation.reliability, 'reliability');
  fraction(observation.coverage, 'coverage');
  if (observation.valueType === 'category') {
    if (!OBSERVATION_CATEGORIES[observation.variable]?.includes(observation.value)) throw new TypeError('Unknown categorical observation value');
  } else if (observation.valueType !== 'number' || observation.variable === 'stage' || !Number.isFinite(observation.value)) {
    throw new TypeError('Observation value must be numeric or a supported categorical report');
  }
  return observation;
}
