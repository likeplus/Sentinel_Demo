import { fraction, model, nonnegative } from './validation.js';
export const PRODUCTION_UNIT_TYPES = ['open_field', 'substrate_zone', 'greenhouse_compartment', 'orchard_block', 'nursery_zone', 'plant_factory_zone'];
/**
 * @typedef {Object} ProductionUnit
 * @property {string} id
 * @property {string} farmId
 * @property {string} name
 * @property {string} type
 * @property {string|null} clusterId
 * @property {{type:string, coordinates:number[][]}|null} geometry Simplified local planar polygon, quadrilateral or hexagon.
 * @property {number[]|null} centroid
 * @property {{value:number, unit:string}} area
 * @property {Object} naturalProperties
 * @property {Object} infrastructure
 * @property {number} environmentControlLevel
 * @property {string[]} cropInstanceIds
 * @property {string|null} lastObservedAt
 * @property {string} observationStatus
 */
export function createProductionUnit(input) {
  const unit = model({ type: 'open_field', clusterId: null, geometry: null, centroid: null,
    area: { value: 0, unit: 'ha' }, naturalProperties: {}, infrastructure: {}, environmentControlLevel: 0,
    cropInstanceIds: [], lastObservedAt: null, observationStatus: 'unknown' }, input, ['id', 'farmId', 'name']);
  if (!PRODUCTION_UNIT_TYPES.includes(unit.type)) throw new RangeError('Unknown ProductionUnit type');
  nonnegative(unit.area.value, 'area');
  fraction(unit.environmentControlLevel, 'environmentControlLevel');
  if (unit.geometry) {
    const { type, coordinates } = unit.geometry;
    const expected = { polygon: 3, quadrilateral: 4, hexagon: 6 }[type];
    if (!expected || !Array.isArray(coordinates) || coordinates.length < expected
      || (type !== 'polygon' && coordinates.length !== expected)
      || coordinates.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n)))) {
      throw new TypeError('Invalid simplified geometry');
    }
  }
  return unit;
}
