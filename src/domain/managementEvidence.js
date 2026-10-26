import { daysBetween } from "./validation.js";

const clamp = (value) => Math.max(0, Math.min(100, value));
// Input must already be the delivered player evidence. Never read crop truth.
export function latestWaterEvidence(observations, unitId, currentDate) {
  const sample = observations
    .filter(
      (o) =>
        o.productionUnitId === unitId &&
        o.variable === "waterStress" &&
        o.status !== "invalid" &&
        Number.isFinite(o.value) &&
        o.observedAt.slice(0, 10) <= currentDate &&
        o.availableAt.slice(0, 10) <= currentDate,
    )
    .toSorted(
      (a, b) =>
        b.observedAt.localeCompare(a.observedAt) ||
        b.reliability - a.reliability ||
        a.id.localeCompare(b.id),
    )[0];
  if (!sample)
    return {
      evidenceVersion: 1,
      value: null,
      confidence: 0,
      reliability: null,
      freshness: 99,
      range: [0, 100],
      source: "Unknown",
      observationId: null,
      observedAt: null,
      availableAt: null,
      stale: true,
      provisional: false,
    };
  const age = daysBetween(sample.observedAt.slice(0, 10), currentDate);
  const value = Math.round(clamp(sample.value * 100));
  const width = (sample.uncertainty || 0) * 100;
  return {
    evidenceVersion: 1,
    value,
    confidence: Math.round(Math.max(20, sample.reliability * 100 - age * 4)),
    reliability: Math.round(sample.reliability * 100),
    freshness: age,
    range: [Math.round(clamp(value - width)), Math.round(clamp(value + width))],
    source: sample.sourceType,
    observationId: sample.id,
    observedAt: sample.observedAt,
    availableAt: sample.availableAt,
    stale: sample.status === "stale" || age > sample.freshness,
    provisional: false,
  };
}

export function waterEvidenceSeries(observations, unitId, currentDate) {
  const dates = [
    ...new Set(
      observations
        .filter(
          (o) =>
            o.productionUnitId === unitId &&
            o.variable === "waterStress" &&
            o.status !== "invalid" &&
            Number.isFinite(o.value) &&
            o.availableAt.slice(0, 10) <= currentDate &&
            o.observedAt.slice(0, 10) <= currentDate,
        )
        .map((o) => o.observedAt.slice(0, 10)),
    ),
  ].sort();
  return dates.map((date) => {
    const samples = observations.filter(
      (o) => o.observedAt.slice(0, 10) === date,
    );
    // Query the sampling date while retaining only evidence delivered by the current view.
    const sample = samples
      .filter(
        (o) =>
          o.productionUnitId === unitId &&
          o.variable === "waterStress" &&
          o.status !== "invalid" &&
          Number.isFinite(o.value),
      )
      .filter((o) => o.availableAt.slice(0, 10) <= currentDate)
      .toSorted(
        (a, b) =>
          b.observedAt.localeCompare(a.observedAt) ||
          b.reliability - a.reliability ||
          a.id.localeCompare(b.id),
      )[0];
    const value = Math.round(clamp(sample.value * 100)),
      width = (sample.uncertainty || 0) * 100;
    return {
      date,
      value,
      range: [clamp(value - width), clamp(value + width)],
      observation: sample,
    };
  });
}

export function reportAttribution(report) {
  const lab = report.sourceType === "lab";
  const agronomist =
    report.responsibleRole === "agronomist" ||
    (lab && report.sourceId === "lab-pu03");
  return {
    responsible: agronomist
      ? "农艺师"
      : report.sourceType === "manager"
        ? "农场经理"
        : report.sourceType === "worker"
          ? "现场人员"
          : null,
    method: lab
      ? "采样送检与评估"
      : report.sourceId === "field-worker"
        ? "例行水分抽测"
        : report.domain === "crop_equipment"
          ? "作物与设备巡查"
          : null,
    laboratory: lab,
    preset:
      report.scenarioReport === true || (lab && report.sourceId === "lab-pu03"),
  };
}
