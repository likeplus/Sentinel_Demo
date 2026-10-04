import { createProductionUnit } from '../domain/productionUnit.js';
/** Explicit compatibility seam; old FIELDS remains untouched and owns the demo. */
export function legacyFieldToProductionUnit(field, { farmId, clusterId = null, cropInstanceIds = [] }) {
  return createProductionUnit({ id:field.id, farmId, name:field.name,
    type:field.crop==='flower' ? 'greenhouse_compartment' : 'orchard_block', clusterId,
    area:{value:(field.area_mu || 0)/15,unit:'ha'}, cropInstanceIds,
    environmentControlLevel:field.crop==='flower' ? 0.7 : 0.2 });
}
