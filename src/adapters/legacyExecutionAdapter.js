import { createOperation } from '../domain/operation.js';
/** Map legacy plan/actual records without manufacturing resource IDs or silently scheduling them. */
export function legacyExecutionToOperation(execution, prescription, { productionUnitIds, assignedResourceIds = [] }) {
  const day = execution.startTime.slice(0,10);
  const duration = execution.endTime ? Math.max(0,(Date.parse(execution.endTime)-Date.parse(execution.startTime))/86_400_000) : null;
  return createOperation({id:`legacy:${execution.id}`,type:prescription.action,sourceType:'legacy_execution',sourceId:execution.prescriptionId,
    productionUnitIds,plannedStart:prescription.timestamp.slice(0,10),plannedDurationDays:0.25,assignedResourceIds,
    plannedOutput:{dosageRatio:prescription.dosageRatio},actualStart:day,actualDurationDays:duration,
    actualResourceIds:assignedResourceIds,actualOutput:{dosageRatio:execution.actualDosageRatio,coverage:execution.actualCoverage_pct},
    executionStatus:execution.status,deviations:execution.deviations,cost:execution.dosageComparison?.costSentinel || 0,
    legacyFingerprint:execution.executionFingerprint,legacyMethod:execution.method});
}
