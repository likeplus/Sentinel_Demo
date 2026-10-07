import { clone } from '../domain/validation.js';

/** Extend the Phase 2 content; retain its dates, events, cases, economy and geometry. */
export function withPlaytestFeedback(fixture) {
  const result = clone(fixture);
  const rig = result.resources.find(r => r.id === 'irrigation-rig');
  const ids = result.productionUnits.map(u => u.id);
  result.management = {
    dailyLabor: 8, dailyAttention: result.scenario.managerAttention?.dailyBudget || 4,
    equipment: Object.fromEntries(ids.map(id => [id, { status: 'Normal', reliability: Math.round((rig?.reliability || 0.9) * 100), issuePart: null }])),
    sensors: ids.slice(0, 3).map((id, i) => ({ id: `soil-${id}`, type: 'Soil Moisture', location: id,
      status: 'Normal', fixed: i < 2, reliability: 0.88 + i * 0.02, lastUpdate: null })),
    demoCapabilities: ['manager_inspection'], sampleAtStart: false,
  };
  for (const resource of result.resources) if (resource.compatibleOperations.length) resource.compatibleOperations = [...new Set([...resource.compatibleOperations, ...(['crew', 'person'].includes(resource.type) ? ['manager_inspection', 'manual_watering', 'spraying', 'repair', 'sensor_relocation'] : resource.id === 'water' ? ['manual_watering'] : [])])];
  // Sensor updates now belong to actual deployed devices, not an implicit per-unit feed.
  result.observationProfiles = result.observationProfiles.filter(p => p.sourceType !== 'sensor');
  result.observations = result.observations.map(o => o.sourceType === 'worker' && o.variable === 'waterStress'
    ? { ...o, domain: 'crop_equipment', cropCondition: 'Normal', equipmentCondition: 'Normal', findings: ['原 Phase 2 开场现场报告'], taskId: null } : o);
  return result;
}
