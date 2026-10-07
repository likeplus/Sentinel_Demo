import { stageAt } from './stages.js';
const clamp = value => Math.max(0, Math.min(1, value));
/** Pure illustrative daily transition; all uncertainty comes from the injected PRNG. */
export function advanceCrop(crop, variety, world, date, random) {
  const previous = crop.trueState;
  const stage = stageAt(crop, variety, date);
  const stageSensitivity = { vegetative: 0.9, flowering: 1.3, fruit_set: 1.5, ripening: 1.2, harvest: 1 }[stage];
  const et = 2 + (world.weather.temperature - 16) * 0.15;
  const waterStress = clamp(previous.waterStress + et * 0.008 * variety.waterSensitivity * stageSensitivity
    - world.weather.rainfall * 0.004 + random.between(-0.015, 0.015));
  const diseasePressure = clamp(previous.diseasePressure + (world.weather.humidity > 0.8 ? 0.02 : -0.005));
  return { ...crop, stage, trueState: { ...previous,
    waterStress, diseasePressure, biomass: previous.biomass + 0.02 * (1 - waterStress),
    canopy: clamp(previous.canopy + 0.005 * (1 - waterStress)),
    qualityPotential: clamp(previous.qualityPotential - Math.max(0, waterStress - 0.6) * 0.005),
    yieldPotential: previous.yieldPotential * (1 - Math.max(0, waterStress - 0.7) * 0.002) } };
}
