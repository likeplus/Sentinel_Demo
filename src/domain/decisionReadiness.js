// A case can remain open for follow-up after a real disposition. Waiting for a
// future report must never prevent the next day from arriving.
export function pendingDecisionItems(cases, recommendations, currentDate) {
  return [
    ...cases
      .filter(
        (d) =>
          d.status === "open" ||
          d.status === "awaiting_approval" ||
          (d.status === "delayed" &&
            d.nextReviewAt &&
            d.nextReviewAt <= currentDate),
      )
      .map((d) => ({
        id: d.id,
        kind: "case",
        title: d.titleZh || d.title,
        unitIds: d.productionUnitIds,
      })),
    ...recommendations
      .filter((d) => d.status === "proposed")
      .map((d) => ({
        id: d.id,
        kind: "recommendation",
        title: d.unitId,
        unitIds: [d.unitId],
      })),
  ];
}
