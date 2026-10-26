import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createGameController } from "../src/game/GameController.js";
import { GameLocaleContext } from "../src/game/GameLocaleContext.js";
import { FarmStatusTable } from "../src/game/FeedbackViews.jsx";
import {
  calendarCell,
  calendarDates,
  inspectionEvidence,
  reservationRows,
  workspaceTab,
} from "../src/game/workspaceModel.js";
import { withPlaytestFeedback } from "../src/game/feedbackFixture.js";
import { createYunnanBlueberryFixture } from "../src/scenarios/yunnan-blueberry-28d/index.js";
import { blueberryPack } from "../src/crop-packs/blueberry/index.js";
import { SimulationEngine } from "../src/simulation/SimulationEngine.js";
import { encodeSave, decodeSave } from "../src/game/persistence.js";
const create = (options) =>
  createGameController({ storage: null, feedback: true, ...options });
const view = (c) => c.getSnapshot().view;
const plan = (c, actions, extra = {}) => ({
  unitIds: ["PU-01"],
  date: view(c).currentDate,
  actions,
  ...extra,
});
const renderTable = (c, locale = "zh") =>
  renderToStaticMarkup(
    createElement(
      GameLocaleContext.Provider,
      { value: { locale } },
      createElement(FarmStatusTable, {
        units: c.getSnapshot().model.units,
        management: view(c).management,
        onSelect() {},
        onToggle() {},
      }),
    ),
  );

describe("Farm workspace evidence, compatibility and reservations", () => {
  it("migrates the three retired destinations and invalid preferences to the main workspace", () => {
    for (const tab of ["today", "units", "operations", undefined, "bad"])
      expect(workspaceTab(tab)).toBe("map");
    for (const tab of ["map", "decisions", "management", "guide", "knowledge"])
      expect(workspaceTab(tab)).toBe(tab);
  });
  it("does not turn historical crop-normal reports into pest findings or sensor confidence into inspection confidence", () => {
    const c = create(),
      unit = c.getSnapshot().model.units[0];
    expect(unit.water.confidence).toBe(0.7);
    expect(inspectionEvidence(unit)).toMatchObject({
      confidence: 70,
      signs: "未单独记录",
      level: "unknown",
    });
    const unknown = c.getSnapshot().model.units.find((u) => u.id === "PU-04");
    expect(inspectionEvidence(unknown)).toMatchObject({
      confidence: null,
      signs: "暂无巡查",
      level: "unknown",
    });
    const html = renderTable(c);
    expect(html).toContain("巡查可信度");
    expect(html).not.toContain("<th>信息新鲜度</th>");
    expect(html).toContain("70%");
    expect(html).not.toMatch(/<b>0%<\/b>/);
  });
  it("refreshes inspection evidence together, then lets sensors refresh water independently", () => {
    const c = create();
    expect(c.scheduleBatch(plan(c, ["manager_inspection"])).accepted).toBe(
      true,
    );
    c.executeDay();
    let unit = c.getSnapshot().model.units[0];
    expect(inspectionEvidence(unit)).toMatchObject({ confidence: 100 });
    expect(unit.cropFreshness).toBe(0);
    expect(unit.water.freshness).toBe(0);
    expect(["未见病虫害迹象", "发现病虫害迹象"]).toContain(
      inspectionEvidence(unit).signs,
    );
    c.executeDay();
    unit = c.getSnapshot().model.units[0];
    expect(unit.water.freshness).toBe(0);
    expect(unit.cropFreshness).toBe(1);
    expect(inspectionEvidence(unit).confidence).toBe(100);
    expect(unit.water.confidence).toBe(0.88);
  });
  it("does not redate evidence after watering or confuse expected effects with verified recovery", () => {
    const c = create(),
      initial = c.getSnapshot().model.units.find((u) => u.id === "PU-05");
    c.scheduleBatch(plan(c, ["manual_watering"], { unitIds: ["PU-05"] }));
    c.executeDay();
    const after = c.getSnapshot().model.units.find((u) => u.id === "PU-05");
    expect(after.latestInspection).toEqual(initial.latestInspection);
    expect(after.water.observedAt).toBe(initial.water.observedAt);
    expect(after.water.value).toBe(initial.water.value);
    const impact = view(c).management.expectedImpacts.find(i => i.unitId === "PU-05");
    expect(impact.to).toBeLessThan(impact.from);
    expect(
      view(c).management.units.find((u) => u.id === "PU-05").water.provisional,
    ).toBe(false);
  });
  it("keeps observations on observation date and actions on plan date, without interpreting temperature as water stress", () => {
    const management = {
      observations: [
        {
          id: "temp",
          productionUnitId: "X",
          variable: "temperature",
          value: 28,
          observedAt: "2026-03-01",
          availableAt: "2026-03-03",
        },
      ],
      tasks: [
        {
          productionUnitIds: ["X"],
          plannedStart: "2026-03-03",
          actions: ["inspection", "spraying"],
          executionStatus: "cancelled",
        },
      ],
    };
    expect(
      calendarCell(management, "X", "2026-03-01", "observation"),
    ).toMatchObject({ abnormal: false, tasks: [] });
    expect(
      calendarCell(management, "X", "2026-03-03", "observation").observations,
    ).toEqual([]);
    expect(
      calendarCell(management, "X", "2026-03-03", "observation").tasks,
    ).toHaveLength(1);
    management.observations.push({
      productionUnitId: "X",
      variable: "waterStress",
      value: 0.7,
      observedAt: "2026-03-01",
    });
    expect(
      calendarCell(management, "X", "2026-03-01", "observation").abnormal,
    ).toBe(true);
  });
  it("shows final seven review dates, no fictitious post-season workdays, and capacity after the whole batch", () => {
    const c = create(),
      quote = c.previewTasks(
        plan(c, ["inspection", "spraying"], { unitIds: ["PU-01", "PU-02"] }),
      ).quote;
    expect(reservationRows(quote).find((r) => r.id === "labor")).toMatchObject({
      available: 8,
      requested: 4,
      remaining: 4,
    });
    expect(
      calendarDates({
        currentDate: "2026-03-29",
        endDate: "2026-03-28",
        ended: true,
      }),
    ).toEqual([
      "2026-03-22",
      "2026-03-23",
      "2026-03-24",
      "2026-03-25",
      "2026-03-26",
      "2026-03-27",
      "2026-03-28",
    ]);
  });
  it("reserves, reschedules and cancels atomically, with identical preview and charged costs", () => {
    const c = create(),
      input = plan(c, ["inspection", "manual_watering"], {
        unitIds: ["PU-01", "PU-02"],
      });
    const quote = c.previewTasks(input);
    expect(quote.accepted).toBe(true);
    const tasks = c.scheduleBatch(input).tasks;
    expect(c.capacity(view(c).currentDate).reserved).toBe(quote.quote.labor);
    const before = structuredClone(view(c));
    expect(
      c.scheduleBatch(
        plan(c, ["inspection", "manual_watering"], {
          unitIds: ["PU-03", "PU-04"],
        }),
      ).accepted,
    ).toBe(false);
    expect(view(c)).toEqual(before);
    expect(c.cancelTask(tasks[0].id).accepted).toBe(true);
    expect(c.capacity(view(c).currentDate).reserved).toBe(3);
    expect(c.reschedule(tasks[1].id, "2026-03-02").accepted).toBe(true);
    expect(c.capacity(view(c).currentDate).reserved).toBe(0);
    c.executeDay();
    expect(view(c).finance.operatingCostToDate).toBe(0);
    c.executeDay();
    c.executeDay();
    expect(view(c).finance.operatingCostToDate).toBe(tasks[1].expectedCost);
    expect(view(c).operations[0].observationIds).toEqual([]);
  });
  it("rejects unsupported attached work instead of filtering away compatibility errors", () => {
    const fixture = withPlaytestFeedback(createYunnanBlueberryFixture());
    fixture.resources.find((r) => r.id === "crew-a").compatibleOperations = [
      "inspection",
      "manual_watering",
      "maintenance",
    ];
    const c = create({ fixture, feedback: false }),
      before = structuredClone(view(c));
    const unsupported = plan(c, ["inspection", "spraying"]);
    expect(c.previewTasks(unsupported).accepted).toBe(false);
    expect(c.scheduleBatch(unsupported).accepted).toBe(false);
    expect(view(c)).toEqual(before);
    expect(
      c.scheduleBatch(plan(c, ["inspection", "manual_watering", "repair"]))
        .accepted,
    ).toBe(true);
    c.executeDay();
    expect(view(c).operations[0].executionStatus).toBe("completed");
    expect(view(c).operations[0].actualOutput.waterConsumed).toBe(15);
  });
  it("supports personal inspection without a field crew and rejects a machine selected as crew", () => {
    const c = create();
    expect(
      c.scheduleBatch(plan(c, ["inspection"], { crewId: "irrigation-rig" }))
        .accepted,
    ).toBe(false);
    expect(
      c.scheduleBatch(
        plan(c, ["manager_inspection"], { crewId: "irrigation-rig" }),
      ).accepted,
    ).toBe(true);
    expect(view(c).operations[0].labor).toBe(0);
  });
  it("does not apply repairs, observations or charges when execution resources block a composite task", () => {
    const fixture = withPlaytestFeedback(createYunnanBlueberryFixture());
    const engine = new SimulationEngine(fixture, { blueberry: blueberryPack });
    const result = engine.scheduleBatch({ unitIds: ['PU-01'], date: engine.currentDate, actions: ['inspection', 'repair', 'irrigation'], requestId: 'blocked-repair' });
    expect(result.accepted).toBe(true);
    const checkpoint = engine.exportCheckpoint();
    const rig = checkpoint.state.farmState.resources.find(r => r.id === 'irrigation-rig');
    rig.status = 'unavailable'; rig.availability[engine.currentDate] = .5;
    const restored = SimulationEngine.restore(checkpoint, { blueberry: blueberryPack });
    const before = restored.getPlayerView();
    expect(restored.startExecution().accepted).toBe(true);
    const after = restored.getPlayerView();
    expect(after.operations[0].executionStatus).toBe('blocked');
    expect(after.resources.find(r => r.id === 'irrigation-rig').availability[engine.currentDate]).toBe(.5);
    expect(after.observations).toEqual(before.observations);
    expect(after.finance.cash).toBe(before.finance.cash);
    expect(after.resources.find(r => r.id === 'water').quantity).toBe(before.resources.find(r => r.id === 'water').quantity);
  });

  it("scopes identically named varieties to their crop pack and derives UI size from configuration", () => {
    const fixture = withPlaytestFeedback(createYunnanBlueberryFixture());
    fixture.cropInstances[1].cropPackId = "other";
    fixture.scenario.cropPackIds.push("other");
    const other = {
      ...blueberryPack,
      id: "other",
      varieties: Object.fromEntries(
        Object.entries(blueberryPack.varieties).map(([key, v]) => [
          key,
          { ...v, name: "Other variety" },
        ]),
      ),
    };
    const c = create({
      fixture,
      feedback: false,
      cropPacks: { blueberry: blueberryPack, other },
    });
    expect(c.getSnapshot().model.units[1].varietyName).toBe("Other variety");
    expect(c.getSnapshot().model.units[0].varietyName).not.toBe(
      "Other variety",
    );
    expect(c.getSnapshot().model.units[1].varietyKey).toMatch(/^other:/);
    fixture.productionUnits = fixture.productionUnits.slice(0, 5);
    fixture.cropInstances = fixture.cropInstances.slice(0, 5);
    const ids = new Set(fixture.productionUnits.map((u) => u.id));
    fixture.farm.productionUnitIds = [...ids];
    fixture.observations = fixture.observations.filter((o) =>
      ids.has(o.productionUnitId),
    );
    fixture.decisionTemplates = fixture.decisionTemplates.filter((d) =>
      d.productionUnitIds.every((id) => ids.has(id)),
    );
    fixture.scenario.eventRules = [];
    const small = create({
      fixture,
      feedback: false,
      cropPacks: { blueberry: blueberryPack, other },
    });
    expect(renderTable(small).match(/data-testid="table-unit-/g)).toHaveLength(
      5,
    );
  });
  it("keeps presentation read-only, old saves round-trippable and unknowns distinct in both languages", () => {
    const c = create(),
      before = structuredClone(c.getSnapshot());
    const html = renderTable(c, "en");
    expect(html).not.toMatch(/[\u4e00-\u9fff]/);
    expect(html).toContain("Not separately recorded");
    expect(html).toContain("No inspection yet");
    expect(c.getSnapshot()).toEqual(before);
    const fixture = withPlaytestFeedback(createYunnanBlueberryFixture());
    // Existing persisted observation/report schema is intentionally unchanged.
    expect(
      fixture.observations.find((o) => o.domain)?.cropObservation,
    ).toBeUndefined();
    const engine = new SimulationEngine(fixture, { blueberry: blueberryPack });
    const checkpoint = engine.exportCheckpoint();
    const restored = SimulationEngine.restore(
      decodeSave(encodeSave(checkpoint, 3)).checkpoint,
      { blueberry: blueberryPack },
    );
    expect(restored.getPlayerView()).toEqual(engine.getPlayerView());
  });
});
