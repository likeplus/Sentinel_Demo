import { addDays } from "../domain/validation.js";

// Presentation contracts consume delivered player evidence only. Missing evidence
// remains unknown, and a completed action is never substituted for an observation.
export const WORKSPACE_TABS = [
  "map",
  "decisions",
  "management",
  "guide",
  "knowledge",
];
export function workspaceTab(tab) {
  return WORKSPACE_TABS.includes(tab) ? tab : "map";
}

export function inspectionEvidence(unit) {
  const report = unit.latestInspection;
  const signs = report?.cropObservation?.pestDiseaseSigns;
  const hasSigns = typeof signs === "string" && signs.trim().length > 0;
  const none = hasSigns && /^(None|无)(\s*\/|$)/i.test(signs);
  return {
    report,
    confidence: Number.isFinite(report?.reliability)
      ? Math.round(report.reliability * 100)
      : null,
    signs: !report
      ? "暂无巡查"
      : !hasSigns
        ? "未单独记录"
        : none
          ? "未见病虫害迹象"
          : "发现病虫害迹象",
    level: !hasSigns ? "unknown" : none ? "normal" : "significant",
  };
}

export function calendarDates(management, offset = 0) {
  const start = management.ended
    ? addDays(management.endDate, -6)
    : management.currentDate;
  return Array.from({ length: 7 }, (_, i) => addDays(start, offset + i)).filter(
    (d) => d <= management.endDate,
  );
}

export function calendarCell(management, unitId, date, mode) {
  const observations = management.observations.filter(
    (o) => o.productionUnitId === unitId && o.observedAt.slice(0, 10) === date,
  );
  const tasks = management.tasks.filter(
    (task) =>
      task.productionUnitIds.includes(unitId) &&
      task.plannedStart === date &&
      (mode === "operations" ||
        task.actions.some((a) => a.endsWith("inspection"))),
  );
  // Numeric variables have different units. Only apply the water threshold to water.
  const abnormal = observations.some(
    (o) =>
      o.cropCondition === "Warning" ||
      (o.equipmentCondition &&
        o.equipmentCondition !== "Normal" &&
        o.equipmentCondition !== "Unknown") ||
      (o.variable === "waterStress" &&
        Number.isFinite(o.value) &&
        o.value >= 0.5),
  );
  return { unitId, date, observations, tasks, abnormal };
}

export function reservationRows(quote) {
  const c = quote.capacity;
  return [
    ...(c.personnel || []).map(p => ({ id: p.resourceId, label: "独立维修人员（人员日）", available: p.available, reserved: p.reserved, requested: quote.personnel?.find(item => item.resourceId === p.resourceId)?.days || 0, remaining: p.remaining - (quote.personnel?.find(item => item.resourceId === p.resourceId)?.days || 0) })),
    {
      id: "labor",
      label: "劳动力",
      available: c.labor,
      reserved: c.reserved,
      requested: quote.labor,
      remaining: c.remaining - quote.labor,
    },
    {
      id: "attention",
      label: "经理注意力",
      available: c.attentionAvailable,
      reserved: c.attentionReserved,
      requested: quote.attention,
      remaining: c.attentionAvailable - c.attentionReserved - quote.attention,
    },
    {
      id: "water",
      label: "可预约水量",
      available: c.waterRemaining,
      reserved: null,
      requested: quote.water,
      remaining: c.waterRemaining - quote.water,
    },
  ];
}
