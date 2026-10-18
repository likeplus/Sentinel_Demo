import { useState } from "react";
import { useGameLocale } from "./GameLocaleContext.js";
import {
  FarmStatusTable,
  UnitSelection,
  TaskPlanner,
  WaterTrend,
  DailyFeedback,
} from "./FeedbackViews.jsx";
import FarmMap from "./FarmMap.jsx";
import { calendarDates } from "./workspaceModel.js";
import { temperatureText } from "./displayFormat.js";
import "./workspace.css";

export default function FarmWorkspace({
  view,
  model,
  controller,
  run,
  navigate,
  selectedUnit,
  selectedIds,
  onSelect,
  onToggle,
  onClear,
  filteredUnits,
  clusterFilter,
  setClusterFilter,
  varietyFilter,
  setVarietyFilter,
  spatial,
  setSpatial,
  layers,
  setLayers,
  overlay,
  setOverlay,
  draft,
  setDraft,
  showCalendar,
  setShowCalendar,
  renderOperation,
  unitDetails,
  openPurchase,
  focusedOperationId,
}) {
  const { t } = useGameLocale();
  const [calendarMode, setCalendarMode] = useState("operations");
  const [offset, setOffset] = useState(0);
  const [unitOpen, setUnitOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const m = view.management;
  const reportsToday = view.observations.filter(
    (o) => o.availableAt.slice(0, 10) === view.currentDate,
  );
  const select = (id) => {
    onSelect(id);
    setUnitOpen(true);
  };
  const focusPlanner = () => {
    document
      .getElementById("inline-task-planner")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
    document
      .querySelector('[data-testid="task-date"]')
      ?.focus({ preventScroll: true });
  };
  const units = m.units.filter(
    (u) =>
      u.water.value === null ||
      u.water.value >= 50 ||
      u.water.freshness >= 3 ||
      u.water.confidence < 60 ||
      u.equipment.status !== "Normal" ||
      u.cropStatus === "Warning",
  );
  const pending = view.operations.filter((op) =>
    ["scheduled", "blocked"].includes(op.executionStatus),
  );
  const displayed = pending
    .filter(
      (op) => taskFilter === "all" || op.productionUnitIds.includes(taskFilter) || op.id === focusedOperationId,
    )
    .toSorted((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  const clusters = [...new Set(model.units.map((u) => u.clusterId))];
  const varieties = [
    ...new Map(model.units.map((u) => [u.varietyKey, u.varietyName])).entries(),
  ];
  const dates = calendarDates(m, offset);
  const archivedFocused = view.operations.some(
    (op) =>
      op.id === focusedOperationId &&
      !["scheduled", "blocked"].includes(op.executionStatus),
  );
  return (
    <div className="fg-manager-workspace" data-testid="manager-workspace">
      <div className="fg-observe-column" data-testid="farm-observation-column">
        <section className="fg-panel fg-workspace-weather">
          <h2>{t("农场动态")}</h2>
          <div className="fg-weather-line">
            <b>
              {t("天气")} {temperatureText(m.weather.temperature)}
            </b>
            <span>
              {t("降雨")} {Number(m.weather.rainfall.toFixed(1))} {t("mm")}
            </span>
            <span>
              {t("ET")} {Number(m.weather.et.toFixed(1))} {t("mm")}
            </span>
            <span>
              {t("需关注单元")}{" "}
              <b>
                {units.length} / {m.units.length}
              </b>
            </span>
          </div>
          <p className="fg-muted">
            {t(
              "左侧查看已知状态与证据，右侧安排工作；执行后查看结果，再进入次日早会。",
            )}
          </p>
          <details className="fg-workspace-priorities">
            <summary>
              {t("风险与信息缺口")} · {units.length}
            </summary>
            <div className="fb-actions">
              {units.map((u) => (
                <button
                  key={u.id}
                  className="fg-button fg-button--secondary"
                  data-testid={`priority-plan-${u.id}`}
                  onClick={() => select(u.id)}
                >
                  {u.id} · {t("Water Stress")} {u.water.value ?? "—"}
                </button>
              ))}
            </div>
          </details>
          <details className="fg-workspace-priorities">
            <summary>
              {t("今天送达的报告")} · {reportsToday.length}
            </summary>
            <div className="fb-scroll">
              <table className="fb-table">
                <thead>
                  <tr>
                    {[
                      "Production Unit",
                      "Observation source",
                      "观测日期",
                      "送达日期",
                      "报告可靠度",
                    ].map((h) => (
                      <th key={h}>{t(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportsToday.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <button
                          className="fg-text-button"
                          onClick={() => select(o.productionUnitId)}
                        >
                          {o.productionUnitId}
                        </button>
                      </td>
                      <td>
                        {t(o.sourceType)} · {t(o.variable || "作物与设备巡查")}
                      </td>
                      <td>{o.observedAt.slice(0, 10)}</td>
                      <td>{o.availableAt.slice(0, 10)}</td>
                      <td>
                        {Number.isFinite(o.reliability)
                          ? `${Math.round(o.reliability * 100)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="fg-panel fg-map-panel">
          <div className="fg-panel-heading">
            <h2>
              {t("农场状态")}{" "}
              <span className="fg-count">
                {filteredUnits.length} {t("个单元")}
              </span>
            </h2>
            <small>{t("玩家已知信息")}</small>
          </div>
          <div className="fb-actions">
            <button
              className="fg-button fg-button--secondary"
              data-testid="view-table"
              aria-pressed={!spatial}
              onClick={() => setSpatial(false)}
            >
              {t("Table View")}
            </button>
            <button
              className="fg-button fg-button--secondary"
              data-testid="view-spatial"
              aria-pressed={spatial}
              onClick={() => setSpatial(true)}
            >
              {t("Spatial View")}
            </button>
            <label>
              <input
                type="checkbox"
                data-testid="toggle-calendar"
                checked={showCalendar}
                onChange={(e) => setShowCalendar(e.target.checked)}
              />
              {t("显示日历")}
            </label>
          </div>
          <div className="fg-map-toolbar">
            <div className="fg-map-filters">
              <label>
                <span className="fg-sr-only">{t("分区筛选")}</span>
                <select
                  data-testid="cluster-filter"
                  value={clusterFilter}
                  onChange={(e) => setClusterFilter(e.target.value)}
                >
                  <option value="all">{t("全部分区")}</option>
                  {clusters.map((id) => (
                    <option key={id}>{id}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="fg-sr-only">{t("品种筛选")}</span>
                <select
                  data-testid="variety-filter"
                  value={varietyFilter}
                  onChange={(e) => setVarietyFilter(e.target.value)}
                >
                  <option value="all">{t("全部品种")}</option>
                  {varieties.map(([id, name]) => (
                    <option key={id} value={id}>
                      {t(name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {spatial && (
            <>
              <div className="fb-actions">
                {["water", "crop", "freshness", "equipment"].map((layer) => (
                  <label key={layer}>
                    <input
                      type="checkbox"
                      checked={layers.includes(layer)}
                      onChange={(e) =>
                        setLayers(
                          e.target.checked
                            ? [...layers, layer]
                            : layers.filter((l) => l !== layer),
                        )
                      }
                    />
                    {t(
                      {
                        water: "Water Risk",
                        crop: "病虫害迹象",
                        freshness: "Information Freshness",
                        equipment: "Irrigation Equipment",
                      }[layer],
                    )}
                  </label>
                ))}
              </div>
              <div className="fg-layer-toggle">
                {[
                  { id: "water", label: "水分与风险" },
                  { id: "tasks", label: "作业与决策" },
                  { id: "freshness", label: "信息新鲜度" },
                ].map((layer) => (
                  <button
                    key={layer.id}
                    className={overlay === layer.id ? "is-active" : ""}
                    onClick={() => setOverlay(layer.id)}
                  >
                    {t(layer.label)}
                  </button>
                ))}
              </div>
              <FarmMap
                units={model.units}
                selectedUnitId={selectedUnit?.id}
                onSelect={select}
                selectedIds={selectedIds}
                onToggle={onToggle}
                layers={layers}
                overlay={overlay}
                clusterFilter={clusterFilter}
                varietyFilter={varietyFilter}
              />
            </>
          )}
          {showCalendar && (
            <div className="fb-actions" data-testid="schedule-calendars">
              <label>
                {t("日历内容")}
                <select
                  data-testid="calendar-mode"
                  value={calendarMode}
                  onChange={(e) => setCalendarMode(e.target.value)}
                >
                  <option value="operations">{t("作业排程")}</option>
                  <option value="observation">{t("观察记录")}</option>
                </select>
              </label>
              <button
                className="fg-text-button"
                data-testid="calendar-previous"
                onClick={() => setOffset(offset - 7)}
              >
                {t("← 7d")}
              </button>
              <button className="fg-text-button" onClick={() => setOffset(0)}>
                {t("Today")}
              </button>
              <button
                className="fg-text-button"
                data-testid="calendar-next"
                disabled={!dates.length || dates.at(-1) >= m.endDate}
                onClick={() => setOffset(offset + 7)}
              >
                {t("7d →")}
              </button>
            </div>
          )}
          {(!spatial || showCalendar) && (
            <FarmStatusTable
              units={filteredUnits}
              selectedId={selectedUnit?.id}
              onSelect={select}
              selectedIds={selectedIds}
              onToggle={onToggle}
              management={m}
              showCalendar={showCalendar}
              calendarMode={calendarMode}
              calendarOffset={offset}
              onViewTask={(id) => navigate("operations", id)}
            />
          )}
          <UnitSelection
            units={filteredUnits}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onClear={onClear}
            onPlan={focusPlanner}
            enabled={m.phase === "morning" && !view.ended}
          />
        </section>
        <details
          className="fg-workspace-unit"
          open={unitOpen}
          onToggle={(e) => setUnitOpen(e.currentTarget.open)}
        >
          <summary>
            {t("单元详情与证据")} · {selectedUnit?.id}
          </summary>
          {unitDetails}
        </details>
        <WaterTrend
          management={m}
          selectedIds={selectedIds}
          focusedId={selectedUnit?.id}
        />
      </div>
      <div
        className="fg-arrange-column"
        data-phase={m.phase}
        data-testid="farm-planning-column"
      >
        <section className="fg-panel" data-testid="pending-decisions">
          <h2>
            {t("待处理决策")} ·{" "}
            {model.openCaseCount +
              m.decisions.filter((d) => d.status === "proposed").length}
          </h2>
          {model.activeCases.map((d) => (
            <button
              className="fg-list-button fg-full"
              key={d.id}
              onClick={() => navigate("decisions", d.id)}
            >
              {t(d.titleZh || d.title)} →
            </button>
          ))}
          {m.decisions
            .filter((d) => d.status === "proposed")
            .map((d) => (
              <button
                className="fg-list-button fg-full"
                key={d.id}
                onClick={() => navigate("decisions", d.id)}
              >
                {d.unitId} · {t(d.maker)} →
              </button>
            ))}
          {!model.activeCases.length &&
            !m.decisions.some((d) => d.status === "proposed") && (
              <p>{t("当前没有待处理决策")}</p>
            )}
        </section>
        {!view.ended && (
          <div hidden={m.phase !== "morning"}>
            <TaskPlanner
              management={m}
              controller={controller}
              run={run}
              initialUnitId={selectedUnit?.id}
              unitIds={selectedIds}
              onSelectUnit={onSelect}
              availableUnits={filteredUnits}
              draft={draft}
              setDraft={setDraft}
              onViewTask={(id) => navigate("operations", id)}
              openPurchase={openPurchase}
            />
          </div>
        )}
        <section className="fg-panel fg-workspace-tasks">
          <div className="fg-panel-heading">
            <h2>
              {t(m.phase === "morning" ? "当前与未来任务" : "执行后的任务状态")}
            </h2>
            <span>{pending.length}</span>
          </div>
          <label>
            {t("按生产单元筛选")}
            <select
              data-testid="operation-unit-filter"
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
            >
              <option value="all">{t("全部生产单元")}</option>
              {model.units.map((u) => (
                <option key={u.id}>{u.id}</option>
              ))}
            </select>
          </label>
          <div className="fb-scroll">
            <table
              className="fb-table fg-task-summary"
              data-testid="task-summary-table"
            >
              <thead>
                <tr>
                  {["Production Unit", "日期", "Action", "Labor", "Status"].map(
                    (h) => (
                      <th key={h}>{t(h)}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {displayed.map((op) => (
                  <tr key={op.id}>
                    <td>{op.productionUnitIds.join(" · ")}</td>
                    <td>{op.plannedStart.slice(5)}</td>
                    <td>
                      <button
                        className="fg-text-button"
                        onClick={() => navigate("operations", op.id)}
                      >
                        {op.actions.map((a) => t(a)).join(" + ")}
                      </button>
                    </td>
                    <td>{op.labor}</td>
                    <td>{t(op.executionStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!displayed.length && <p>{t("暂无待执行任务")}</p>}
          {displayed.map((op) => (
            <details
              key={op.id}
              open={focusedOperationId === op.id ? true : undefined}
            >
              <summary>
                {op.productionUnitIds.join(" · ")} · {op.plannedStart} ·{" "}
                {t("查看或调整")}
              </summary>
              {renderOperation(op)}
            </details>
          ))}
          <details
            open={historyOpen || archivedFocused}
            onToggle={(e) => setHistoryOpen(e.currentTarget.open)}
          >
            <summary>
              {t("已完成与取消的任务")} ·{" "}
              {
                view.operations.filter(
                  (op) =>
                    !["scheduled", "blocked"].includes(op.executionStatus),
                ).length
              }
            </summary>
            {(historyOpen || archivedFocused) &&
              view.operations
                .filter(
                  (op) =>
                    !["scheduled", "blocked"].includes(op.executionStatus) &&
                    (taskFilter === "all" ||
                      op.productionUnitIds.includes(taskFilter) || op.id === focusedOperationId),
                )
                .toReversed()
                .map(renderOperation)}
          </details>
        </section>
        <DailyFeedback
          management={m}
          onSelectUnit={select}
          onViewTask={(id) => navigate("operations", id)}
        />
      </div>
    </div>
  );
}
