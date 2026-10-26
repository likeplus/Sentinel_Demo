import { isCapacityResource } from "./resources.js";

// Derive usage from assigned resources, including legacy tasks whose scalar
// labor field counted independent technicians as crew labor.
export function operationUsage(operation, resources, dailyLabor) {
  const assigned = resources.filter(
    (r) =>
      operation.assignedResourceIds.includes(r.id) && isCapacityResource(r),
  );
  const days =
    (operation.plannedDurationDays || 0) + (operation.travelOverhead || 0);
  return {
    labor: assigned.filter((r) => r.type === "crew").length * days * dailyLabor,
    personnel: assigned
      .filter((r) => r.type === "person")
      .map((r) => ({ resourceId: r.id, name: r.name, days })),
    assignments: assigned.map((r) => ({
      resourceId: r.id,
      name: r.name,
      type: r.type,
      days,
    })),
  };
}
