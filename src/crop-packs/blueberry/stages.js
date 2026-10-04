import { daysBetween } from '../../domain/validation.js';
export const stages = ['vegetative', 'flowering', 'fruit_set', 'ripening', 'harvest'];
export function stageAt(crop, variety, date) {
  const progress = Math.max(0, daysBetween(crop.plantingDate, date)) / variety.maturityDays;
  return progress >= 1 ? 'harvest' : progress >= 0.85 ? 'ripening' : progress >= 0.65 ? 'fruit_set'
    : progress >= 0.45 ? 'flowering' : 'vegetative';
}
