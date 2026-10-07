export const operations = {
  irrigation: { id: 'irrigation', outputUnit: 'm3', description: 'Local irrigation training operation' },
  manual_watering: { id: 'manual_watering', outputUnit: 'm3', description: 'Labor-intensive emergency watering independent of irrigation infrastructure' },
  spraying: { id: 'spraying', outputUnit: 'treated_units', description: 'Illustrative crop protection operation' },
  inspection: { id: 'inspection', outputUnit: 'samples', description: 'Gather additional field evidence' },
  maintenance: { id: 'maintenance', outputUnit: 'repairs', description: 'Inspect valve/sensor infrastructure' },
  harvest: { id: 'harvest', outputUnit: 'kg', description: 'Reserved for later gameplay integration' },
};
export function applyOperation(crop, operation) {
  if (operation.type === 'spraying') return { ...crop, trueState: { ...crop.trueState,
    diseasePressure: Math.max(0, crop.trueState.diseasePressure - 0.18) },
    managementHistory: [...crop.managementHistory, { operationId: operation.id, date: operation.actualStart, type: operation.type }] };
  if (!['irrigation', 'manual_watering'].includes(operation.type)) return crop;
  const units = Math.max(1, operation.productionUnitIds.length);
  const water = operation.actualOutput.water ?? 0;
  return { ...crop, trueState: { ...crop.trueState,
    waterStress: Math.max(0, crop.trueState.waterStress - water / units * 0.015) },
  managementHistory: [...crop.managementHistory, { operationId: operation.id, date: operation.actualStart, type: operation.type }] };
}
