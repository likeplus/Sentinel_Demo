import { createCropInstance, createProductionUnit } from '../../domain/index.js';
import { varieties } from '../../crop-packs/blueberry/varieties.js';
export const productionUnits = Array.from({ length: 12 }, (_, index) => {
  const id = `PU-${String(index + 1).padStart(2, '0')}`;
  const x = (index % 4) * 100, y = Math.floor(index / 4) * 100;
  return createProductionUnit({ id, farmId: 'yunnan-farm', name: `Blueberry unit ${index + 1}`, type: 'substrate_zone',
    clusterId: `CL-${Math.floor(index / 4) + 1}`, geometry: { type: 'quadrilateral', coordinates: [[x,y],[x+80,y],[x+80,y+80],[x,y+80]] },
    centroid: [x+40,y+40], area: { value: 0.64, unit: 'ha' }, naturalProperties: { elevationM: 1800, soilPH: 4.8 },
    infrastructure: { dripIrrigation: true, sensorId: `sensor:${id}` }, environmentControlLevel: 0.4,
    cropInstanceIds: [`CROP-${String(index + 1).padStart(2, '0')}`] });
});
export const cropInstances = productionUnits.map((unit,index) => {
  const variety = Object.values(varieties)[index % 3];
  return createCropInstance({ id: unit.cropInstanceIds[0], productionUnitId: unit.id, cropPackId: 'blueberry', varietyId: variety.id,
    plantingDate: '2025-12-01', expectedHarvestWindow: { startDate: '2026-03-10', endDate: '2026-04-01' }, stage: 'ripening',
    trueState: { biomass: 1, canopy: 0.7, waterStress: unit.id === 'PU-03' ? 0.65 : 0.2,
      nutrientStatus: 0.8, diseasePressure: 0.1, qualityPotential: variety.qualityPotential, yieldPotential: variety.yieldPotential } });
});
