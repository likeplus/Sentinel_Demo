import { operationUsage } from '../domain/operationUsage.js';
/** Project recorded execution, never planned quantities, into one row per task. */
export function dailyReviewRows(management) {
  return management.lastResults.map(result => {
    const task = management.tasks.find(task => task.id === result.taskId);
    const usage = task && management.resourceDefinitions ? operationUsage({...task, plannedDurationDays: task.actualDurationDays ?? task.plannedDurationDays, assignedResourceIds: task.actualResourceIds?.length ? task.actualResourceIds : task.assignedResourceIds}, management.resourceDefinitions, management.dailyLabor) : null;
    return {
      ...result,
      labor: result.status === 'blocked' ? 0 : usage?.labor ?? result.labor,
      personnel: result.status === 'blocked' ? [] : usage?.personnel ?? result.personnel ?? [],
      unitIds: task?.productionUnitIds || [result.unitId],
      actions: task?.actions || [],
      date: task?.actualStart || result.results?.findLast(action => action.executedAt)?.executedAt.slice(0, 10) || task?.deviations?.findLast(deviation => deviation.type === 'resource_unavailable')?.date,
      water: result.status === 'blocked' ? 0 : task?.actualOutput?.waterConsumed ?? 0,
      cost: result.status === 'blocked' ? 0 : task?.cost ?? 0,
      observations: management.observations.filter(observation => observation.taskId === result.taskId && observation.domain === 'crop_equipment'),
      impacts: management.expectedImpacts.filter(impact => impact.taskId === result.taskId),
    };
  });
}
