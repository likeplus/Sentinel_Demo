import { fraction, model } from './validation.js';
/** @typedef {{id:string, actorId:string, productionUnitId:string, subject:string, estimate:number, probability:number, confidence:number, basedOnObservationIds:string[], updatedAt:string}} BeliefState */
export function createBelief(input) {
  const belief = model({ estimate: 0, probability: 0, confidence: 0, basedOnObservationIds: [] }, input,
    ['id', 'actorId', 'productionUnitId', 'subject', 'updatedAt']);
  fraction(belief.probability, 'probability');
  fraction(belief.confidence, 'confidence');
  return belief;
}
