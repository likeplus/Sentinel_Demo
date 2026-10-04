import { dateMs, model, fraction, nonnegative } from './validation.js';
/** @typedef {{id:string, productionUnitId:string, cropPackId:string, varietyId:string, plantingDate:string, expectedHarvestWindow:Object|null, stage:string, trueState:Object, managementHistory:Object[]}} CropInstance */
export function createCropInstance(input) {
  const crop = model({ expectedHarvestWindow: null, stage: 'vegetative', managementHistory: [],
    trueState: { biomass: 1, canopy: 0.5, waterStress: 0.2, nutrientStatus: 0.8,
      diseasePressure: 0.1, qualityPotential: 0.9, yieldPotential: 500 } }, input,
  ['id', 'productionUnitId', 'cropPackId', 'varietyId', 'plantingDate']);
  dateMs(crop.plantingDate);
  for (const key of ['canopy', 'waterStress', 'nutrientStatus', 'diseasePressure', 'qualityPotential']) fraction(crop.trueState[key], key);
  for (const key of ['biomass', 'yieldPotential']) nonnegative(crop.trueState[key], key);
  return crop;
}
