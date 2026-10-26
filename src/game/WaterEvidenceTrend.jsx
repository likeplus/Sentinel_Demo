import { useState } from "react";
import { useGameLocale } from "./GameLocaleContext.js";
import { waterEvidenceSeries } from "../domain/managementEvidence.js";
import { daysBetween } from "../domain/validation.js";

export default function WaterEvidenceTrend({
  management: m,
  observations = m.observations,
  selectedIds = [],
  focusedId,
  unitIds,
  testId = "water-evidence-trend",
}) {
  const { t } = useGameLocale();
  const [selection, setSelection] = useState("selected");
  const available = unitIds
    ? m.units.filter((u) => unitIds.includes(u.id))
    : m.units;
  const selected = unitIds
    ? available
    : selection === "all"
      ? available
      : selection === "selected"
        ? available.filter((u) =>
            selectedIds.length
              ? selectedIds.includes(u.id)
              : u.id === focusedId,
          )
        : available.filter((u) => u.id === selection);
  const series = selected.map((u) => ({
    unit: u,
    points: waterEvidenceSeries(observations, u.id, m.currentDate),
  }));
  const dates = series.flatMap((s) => s.points.map((p) => p.date)).sort();
  const start = dates[0] || m.currentDate,
    end = m.currentDate;
  const span = Math.max(1, daysBetween(start, end));
  const x = (date) => 55 + (daysBetween(start, date) / span) * 670;
  const y = (v) => 250 - v * 2;
  const ticks = [
    ...new Set([0, Math.round(span / 3), Math.round((span * 2) / 3), span]),
  ];
  const dateAt = (offset) =>
    new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  return (
    <section className="fg-panel feedback-views" data-testid={testId}>
      <div className="fb-actions">
        <h2>{t("水分观测趋势")}</h2>
        {!unitIds && (
          <select
            aria-label={t("Water Stress trend mode")}
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <option value="selected">{t("跟随所选单元")}</option>
            <option value="all">{t("All Production Units")}</option>
            {available.map((u) => (
              <option key={u.id}>{u.id}</option>
            ))}
          </select>
        )}
      </div>
      <svg
        className="fb-trend"
        viewBox="0 0 780 300"
        role="img"
        aria-label={t("水分观测与观测范围")}
      >
        <text x="5" y="20">
          {t("Water Stress")}
        </text>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1="55" x2="725" y1={y(v)} y2={y(v)} stroke="#dbe4df" />
            <text x="18" y={y(v) + 4}>
              {v}
            </text>
          </g>
        ))}
        {series.map(({ unit, points }) => {
          const color = `hsl(${(m.units.findIndex((u) => u.id === unit.id) * 137.5 + 160) % 360} 48% 40%)`;
          return (
            <g key={unit.id} data-evidence-unit={unit.id}>
              {points.map((p, i) => {
                const previous = points[i - 1],
                  connected =
                    previous && daysBetween(previous.date, p.date) === 1;
                const lab = p.observation.sourceType === "lab";
                return (
                  <g
                    key={p.observation.id}
                    data-observation-date={p.date}
                    data-observation-id={p.observation.id}
                  >
                    <title>{`${unit.id} · ${t(p.observation.sourceType)} · ${t("观测日期")} ${p.date} · ${t("送达日期")} ${p.observation.availableAt.slice(0, 10)} · ${p.value}/100 · ${t("报告可靠度")} ${Math.round(p.observation.reliability * 100)}%`}</title>
                    {connected && (
                      <>
                        <polygon
                          points={`${x(previous.date)},${y(previous.range[0])} ${x(p.date)},${y(p.range[0])} ${x(p.date)},${y(p.range[1])} ${x(previous.date)},${y(previous.range[1])}`}
                          fill={color}
                          opacity=".10"
                        />
                        <line
                          x1={x(previous.date)}
                          y1={y(previous.value)}
                          x2={x(p.date)}
                          y2={y(p.value)}
                          stroke={color}
                          strokeWidth="2"
                        />
                      </>
                    )}
                    <line
                      x1={x(p.date)}
                      x2={x(p.date)}
                      y1={y(p.range[0])}
                      y2={y(p.range[1])}
                      stroke={color}
                      opacity=".5"
                    />
                    {lab ? (
                      <path
                        d={`M ${x(p.date)} ${y(p.value) - 5} l 5 9 h -10 z`}
                        fill={color}
                      />
                    ) : (
                      <circle
                        cx={x(p.date)}
                        cy={y(p.value)}
                        r="3.5"
                        stroke={color}
                        fill={
                          p.observation.sourceType === "sensor"
                            ? "white"
                            : color
                        }
                      />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {selected.flatMap((unit) =>
          observations
            .filter(
              (o) =>
                o.productionUnitId === unit.id &&
                o.variable === "waterStress" &&
                o.status !== "invalid" &&
                Number.isFinite(o.value) &&
                o.availableAt.slice(0, 10) <= m.currentDate &&
                o.observedAt.slice(0, 10) <= m.currentDate,
            )
            .filter(
              (o) =>
                !series
                  .find((s) => s.unit.id === unit.id)
                  .points.some((p) => p.observation.id === o.id),
            )
            .map((o) => {
              const date = o.observedAt.slice(0, 10),
                value = Math.round(o.value * 100),
                color = `hsl(${(m.units.findIndex((u) => u.id === unit.id) * 137.5 + 160) % 360} 48% 40%)`;
              return (
                <g
                  key={o.id}
                  data-observation-date={date}
                  data-observation-id={o.id}
                >
                  <title>{`${unit.id} · ${t(o.sourceType)} · ${t("观测日期")} ${date} · ${t("送达日期")} ${o.availableAt.slice(0, 10)} · ${value}/100`}</title>
                  {o.sourceType === "lab" ? (
                    <path
                      d={`M ${x(date)} ${y(value) - 5} l 5 9 h -10 z`}
                      fill={color}
                    />
                  ) : (
                    <circle
                      cx={x(date)}
                      cy={y(value)}
                      r="3"
                      stroke={color}
                      fill="white"
                    />
                  )}
                </g>
              );
            }),
        )}
        {ticks.map((offset) => (
          <text key={offset} x={x(dateAt(offset))} y="275" textAnchor="middle">
            {dateAt(offset).slice(5)}
          </text>
        ))}
        <text x="740" y="292">
          {t("Date")}
        </text>
      </svg>
      {!dates.length && (
        <p>{t("尚无有效水分观测，请安排巡查或等待有效报告。")}</p>
      )}
      <p>
        {t(
          "只绘制已送达观测，按采样日期归位；缺测日期不补点，曲线停在最后观测。阴影与竖线表示观测范围。",
        )}
      </p>
      <div className="fb-actions">
        {selected.map((u) => (
          <b key={u.id}>{u.id}</b>
        ))}
      </div>
      <small>
        {t(
          "实心点：现场观测；空心点：传感器；三角形：检测报告。补水预计影响在作业结果中查看。",
        )}
      </small>
    </section>
  );
}
