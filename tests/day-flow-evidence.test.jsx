import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createGameController } from "../src/game/GameController.js";
import { SimulationEngine } from "../src/simulation/SimulationEngine.js";
import { withPlaytestFeedback } from "../src/game/feedbackFixture.js";
import { createYunnanBlueberryFixture } from "../src/scenarios/yunnan-blueberry-28d/index.js";
import { blueberryPack } from "../src/crop-packs/blueberry/index.js";
import { pendingDecisionItems } from "../src/domain/decisionReadiness.js";
import {
  latestWaterEvidence,
  waterEvidenceSeries,
  reportAttribution,
} from "../src/domain/managementEvidence.js";
import WaterEvidenceTrend from "../src/game/WaterEvidenceTrend.jsx";
import { GameLocaleContext } from "../src/game/GameLocaleContext.js";
import {
  GAMEPLAY_GUIDE_MODULES,
  DAILY_BRIEFING,
} from "../src/game/content/gameplayGuide.js";
const create = () => createGameController({ feedback: true, storage: null });
const view = (c) => c.getSnapshot().view;
function advanceTo(c, date) {
  while (view(c).currentDate < date) {
    for (const d of view(c).management.pendingDecisions) {
      const r =
        d.kind === "case"
          ? c.decide(d.id, { type: "no_action" })
          : c.resolveDecision(d.id, false);
      expect(r.accepted).toBe(true);
    }
    expect(c.executeDay().accepted).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
  }
}
const sample = (overrides) => ({
  id: "water",
  productionUnitId: "A",
  variable: "waterStress",
  value: 0.2,
  reliability: 0.8,
  uncertainty: 0.05,
  observedAt: "2026-03-01",
  availableAt: "2026-03-01",
  sourceType: "worker",
  freshness: 3,
  status: "current",
  ...overrides,
});

describe("Explicit daily dispositions", () => {
  it("blocks execution without spending, new results or changing phase, including direct engine entry", () => {
    const c = create();
    advanceTo(c, "2026-03-04");
    const before = structuredClone(view(c));
    expect(c.executeDay()).toMatchObject({
      accepted: false,
      code: "decision_required",
      decisionIds: ["water-stress-pu03"],
    });
    expect(view(c)).toEqual(before);
    expect(c.advance().accepted).toBe(false);
    expect(c.enterDecisionCase("water-stress-pu03").accepted).toBe(true);
    expect(c.executeDay().accepted).toBe(false); // entering review is not a committed decision
    expect(c.decide("water-stress-pu03", { type: "no_action" }).accepted).toBe(
      true,
    );
    expect(c.executeDay().accepted).toBe(true);
    expect(view(c).management.phase).toBe("end_of_day");
  });
  it("allows explicit future review, then blocks again when it becomes due", () => {
    const c = create();
    advanceTo(c, "2026-03-04");
    expect(
      c.decide("water-stress-pu03", {
        type: "delay",
        nextReviewAt: "2026-03-06",
      }).accepted,
    ).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    expect(view(c).management.pendingDecisions).toEqual([]);
    expect(c.executeDay().accepted).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    expect(c.executeDay()).toMatchObject({
      accepted: false,
      code: "decision_required",
    });
  });
  it("lets a delegated report arrive, requires a response to it, and permits zero-attention delegation", () => {
    const c = create();
    advanceTo(c, "2026-03-04");
    expect(
      c.decide("water-stress-pu03", {
        type: "delegate",
        delegatedTo: "sentinel",
      }).accepted,
    ).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    expect(view(c).decisionCases[0].status).toBe("awaiting_approval");
    expect(c.executeDay().accepted).toBe(false);
    expect(c.approve("water-stress-pu03").accepted).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    const z = create();
    for (const id of ["PU-04", "PU-06", "PU-08"]) {
      const d = z.openDecision(id, "Manager").decision;
      expect(z.resolveDecision(d.id, false).accepted).toBe(true);
    }
    expect(view(z).attention.remaining).toBe(0);
    const ai = z.openDecision("PU-09", "AI Assistant").decision;
    expect(z.executeDay().accepted).toBe(false);
    expect(z.resolveDecision(ai.id, true).accepted).toBe(true);
    expect(z.executeDay().accepted).toBe(true);
  });
  it("does not confuse scheduled work, investigations or waiting with unanswered events", () => {
    const states = [
      "scheduled",
      "investigating",
      "delegated",
      "resolved",
      "delayed",
    ];
    expect(
      pendingDecisionItems(
        states.map((status) => ({
          id: status,
          status,
          nextReviewAt: "2026-03-08",
        })),
        [],
        "2026-03-04",
      ),
    ).toEqual([]);
    const c = create();
    advanceTo(c, "2026-03-04");
    expect(
      c.decide("water-stress-pu03", {
        type: "gather_information",
        optionId: "inspect-pu03",
      }).accepted,
    ).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    expect(view(c).decisionCases[0].status).toBe("open");
    expect(c.executeDay().accepted).toBe(false);
  });
});

describe("Observed evidence stays separate from predictions and actions", () => {
  it("freezes old water values and sampling dates while the farm continues to change", () => {
    const c = create();
    const before = view(c).management.units[4].water;
    advanceTo(c, "2026-03-09");
    const after = view(c).management.units[4].water;
    expect(after.value).toBe(before.value);
    expect(after.observationId).toBe(before.observationId);
    expect(after.freshness).toBeGreaterThan(before.freshness);
    expect(after.stale).toBe(true);
    const points = waterEvidenceSeries(
      view(c).observations,
      "PU-05",
      view(c).currentDate,
    );
    expect(points.map((p) => p.date)).toEqual(["2026-02-24"]);
    const engine = new SimulationEngine(
      withPlaytestFeedback(createYunnanBlueberryFixture()),
      { blueberry: blueberryPack },
    );
    const state =
      engine.exportCheckpoint().state.farmState.cropInstances[4].trueState
        .waterStress;
    engine.startExecution();
    engine.endExecution();
    engine.advanceOneDay();
    expect(
      engine.exportCheckpoint().state.farmState.cropInstances[4].trueState
        .waterStress,
    ).not.toBe(state);
  });
  it("does not replace a newer observation with a more reliable, late old sample", () => {
    const newer = sample({
      id: "new",
      observedAt: "2026-03-05",
      availableAt: "2026-03-05",
      value: 0.3,
    });
    const lab = sample({
      id: "lab",
      sourceType: "lab",
      observedAt: "2026-03-04",
      availableAt: "2026-03-06",
      value: 0.7,
      reliability: 0.95,
    });
    expect(
      latestWaterEvidence([newer, lab], "A", "2026-03-05").observationId,
    ).toBe("new");
    expect(
      latestWaterEvidence([newer, lab], "A", "2026-03-06").observationId,
    ).toBe("new");
    expect(
      waterEvidenceSeries([newer, lab], "A", "2026-03-05").map(
        (p) => p.observation.id,
      ),
    ).toEqual(["new"]);
    expect(
      waterEvidenceSeries([newer, lab], "A", "2026-03-06").map((p) => p.date),
    ).toEqual(["2026-03-04", "2026-03-05"]);
    expect(
      latestWaterEvidence(
        [sample(), sample({ id: "reliable", value: 0.5, reliability: 0.95 })],
        "A",
        "2026-03-01",
      ).value,
    ).toBe(50);
    expect(latestWaterEvidence([], "A", "2026-03-06").value).toBeNull();
  });
  it("shows watering as an expected effect without re-dating or rewriting evidence", () => {
    const c = create(),
      before = structuredClone(view(c).management.units[4].water);
    c.scheduleTask({
      unitId: "PU-05",
      date: view(c).currentDate,
      actions: ["manual_watering"],
    });
    expect(c.executeDay().accepted).toBe(true);
    expect(view(c).management.units[4].water).toEqual(before);
    const impact = view(c).management.expectedImpacts[0];
    expect(impact.to).toBeLessThan(impact.from);
    expect(
      view(c).observations.some((o) => o.taskId === view(c).operations[0].id),
    ).toBe(false);
    c.executeDay();
    expect(view(c).management.units[4].water.value).toBe(before.value);
  });
  it("does not plot weather forecasts or invented daily points from old saves", () => {
    const c = create();
    advanceTo(c, "2026-03-06");
    const m = view(c).management;
    const html = renderToStaticMarkup(
      createElement(
        GameLocaleContext.Provider,
        { value: { locale: "en" } },
        createElement(WaterEvidenceTrend, {
          management: m,
          observations: view(c).observations,
          unitIds: ["PU-05"],
        }),
      ),
    );
    expect(html).toContain('data-observation-date="2026-02-24"');
    expect(html).not.toContain('data-observation-date="2026-03-06"');
    expect(html).not.toMatch(/[\u4e00-\u9fff]/);
  });
  it("assigns the scheduled laboratory report to the agronomist without creating a daily free job", () => {
    const c = create();
    advanceTo(c, "2026-03-04");
    expect(view(c).observations.some((o) => o.sourceType === "lab")).toBe(
      false,
    );
    advanceTo(c, "2026-03-06");
    const report = view(c).observations.find((o) => o.sourceType === "lab");
    expect(report).toMatchObject({
      responsiblePersonId: "agronomist",
      observedAt: "2026-03-04",
      availableAt: "2026-03-06",
    });
    expect(reportAttribution(report)).toMatchObject({
      responsible: "农艺师",
      laboratory: true,
      preset: true,
    });
    expect(view(c).operations).toEqual([]);
    expect(
      reportAttribution({
        ...report,
        responsibleRole: undefined,
        responsiblePersonId: undefined,
        scenarioReport: undefined,
      }).responsible,
    ).toBe("农艺师");
  });
});

it('restores legacy forecast views and technician labor without fabricating evidence, charging money or consuming randomness', () => {
  const engine = new SimulationEngine(withPlaytestFeedback(createYunnanBlueberryFixture()), {blueberry:blueberryPack});
  expect(engine.scheduleTask({unitId:'PU-01',date:engine.currentDate,actions:['repair'],plan:{type:'maintenance',assignedResourceIds:['maintenance-person'],plannedDurationDays:.5,plannedOutput:{repairs:1}}}).accepted).toBe(true);
  const checkpoint = engine.exportCheckpoint();
  checkpoint.state.scheduledOperations[0].labor = 4;
  checkpoint.state.management.estimates['PU-05'].value = 99;
  const cached = checkpoint.views[0][1].management;
  cached.units[4].water.value = 99; delete cached.units[4].water.evidenceVersion;
  delete cached.pendingDecisions; delete cached.resourceDefinitions; delete cached.resources.labor.personnel;
  cached.resources.labor.reserved = 4; cached.resources.labor.remaining = 4;
  const restored = SimulationEngine.restore(checkpoint, {blueberry:blueberryPack});
  const current = restored.getPlayerView();
  expect(current.management.units[4].water.value).toBe(20);
  expect(current.management.resources.labor).toMatchObject({remaining:8,personnel:[{reserved:.5,remaining:.5}]});
  expect(current.observations.map(o=>({id:o.id,value:o.value}))).toEqual(checkpoint.views[0][1].observations.map(o=>({id:o.id,value:o.value})));
  expect(current.finance.cash).toBe(checkpoint.state.farmState.finance.cash);
  expect(restored.exportCheckpoint().random).toEqual(checkpoint.random);
});

describe("Independent repair capacity", () => {
  it("books a specialist half-day without reducing eight crew points; quote, charge and cancel use the same pools", () => {
    const c = create();
    advanceTo(c, "2026-03-07");
    const d = view(c).decisionCases.find((d) => d.id === "valve-disruption"),
      option = d.actionOptions.find((o) => o.id === "repair-valve");
    const quote = c.previewOperation(option.operation, view(c).currentDate);
    expect(quote).toMatchObject({
      accepted: true,
      quote: {
        labor: 0,
        cost: 150,
        personnel: [{ resourceId: "maintenance-person", days: 0.5 }],
      },
    });
    c.enterDecisionCase(d.id);
    const result = c.decide(d.id, {
      type: "decide_now",
      optionId: option.id,
      plannedStart: view(c).currentDate,
    });
    expect(result.accepted).toBe(true);
    expect(c.capacity(view(c).currentDate)).toMatchObject({
      remaining: 8,
      personnel: [{ reserved: 0.5, remaining: 0.5 }],
    });
    const rejected = c.scheduleTask({
      unitId: "PU-02",
      date: view(c).currentDate,
      actions: ["repair"],
      plan: {
        type: "maintenance",
        assignedResourceIds: ["maintenance-person"],
        plannedDurationDays: 0.75,
        plannedOutput: { repairs: 1 },
      },
    });
    expect(rejected.accepted).toBe(false);
    expect(c.reschedule(result.operation.id, '2026-03-08').accepted).toBe(true);
    expect(c.capacity('2026-03-07')).toMatchObject({remaining:8,personnel:[{remaining:1}]});
    expect(c.capacity('2026-03-08')).toMatchObject({remaining:8,personnel:[{reserved:.5,remaining:.5}]});
    expect(c.cancelTask(result.operation.id).accepted).toBe(true);
    expect(c.capacity(view(c).currentDate)).toMatchObject({
      remaining: 8,
      personnel: [{ reserved: 0, remaining: 1 }],
    });
    expect(
      view(c).management.pendingDecisions.some(
        (d) => d.id === "valve-disruption",
      ),
    ).toBe(true);
  });
  it("executes a half-day professional repair alongside a full day of crew work and charges each once", () => {
    const c = create();
    advanceTo(c, "2026-03-07");
    c.enterDecisionCase("valve-disruption");
    expect(
      c.decide("valve-disruption", {
        type: "decide_now",
        optionId: "repair-valve",
        plannedStart: view(c).currentDate,
      }).accepted,
    ).toBe(true);
    expect(
      c.scheduleBatch({
        unitIds: view(c)
          .productionUnits.slice(0, 8)
          .map((u) => u.id),
        date: view(c).currentDate,
        actions: ["inspection"],
      }).accepted,
    ).toBe(true);
    expect(c.executeDay().accepted).toBe(true);
    expect(
      view(c).operations.every((o) => o.executionStatus === "completed"),
    ).toBe(true);
    expect(view(c).finance.operatingCostToDate).toBe(550);
    const specialist = view(c).management.lastResults.find(
      (r) => r.personnel?.length,
    );
    expect(specialist).toMatchObject({
      labor: 0,
      personnel: [{ resourceId: "maintenance-person", days: 0.5 }],
    });
  });
  it("keeps ordinary repair on the field crew, and preserves the shared labor boundary", () => {
    const c = create();
    const q = c.previewTasks({
      unitIds: ["PU-01"],
      date: view(c).currentDate,
      actions: ["repair"],
    });
    expect(q.quote).toMatchObject({ labor: 1, cost: 50 });
    expect(q.tasks[0].assignedResourceIds).toEqual(["crew-a"]);
    c.scheduleTask({
      unitId: "PU-01",
      date: view(c).currentDate,
      actions: ["repair"],
    });
    expect(c.capacity(view(c).currentDate)).toMatchObject({
      remaining: 7,
      personnel: [{ remaining: 1 }],
    });
  });
});

it("provides one coherent bilingual management guide with the daily briefing as a reusable introduction", () => {
  expect(GAMEPLAY_GUIDE_MODULES.map((m) => m.id)).toEqual([
    "manager",
    "daily-management",
    "evidence-actions",
    "people-resources",
    "planning",
    "decisions-reports",
    "review",
  ]);
  expect(
    new Set(GAMEPLAY_GUIDE_MODULES.flatMap((m) => m.cards.map((c) => c.id)))
      .size,
  ).toBe(GAMEPLAY_GUIDE_MODULES.flatMap((m) => m.cards).length);
  for (const m of GAMEPLAY_GUIDE_MODULES)
    for (const c of m.cards) {
      expect(c.title.zh).toBeTruthy();
      expect(c.title.en).toBeTruthy();
      expect(c.body.en).not.toMatch(/[\u4e00-\u9fff]/);
    }
  expect(DAILY_BRIEFING.body.zh).toContain("待表态");
  expect(DAILY_BRIEFING.reminder.en).toContain("Old information");
});
