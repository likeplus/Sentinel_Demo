import { useGameLocale } from "./GameLocaleContext.js";
export default function ResourceOverview({ view, model }) {
  const { t } = useGameLocale();
  const r = view.management.resources,
    water = model.criticalResources[0];
  const number = (v) =>
    Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <section
      className="fg-panel fg-resource-overview"
      data-testid="resource-overview"
    >
      <h2>{t("资源与安排")}</h2>
      <div className="fg-resource-cards">
        <article>
          <span>{t("可用现金")}</span>
          <strong data-testid="cash" data-value={view.finance.cash}>
            ¥{number(view.finance.cash)}
          </strong>
          <small>{t("费用按实际执行记账")}</small>
        </article>
        <article>
          <span>{t("田间班组剩余")}</span>
          <strong data-testid="crew-remaining">
            {number(r.labor.remaining)} {t("点劳动力")}
          </strong>
          {r.labor.personnel.map((p) => (
            <small key={p.resourceId} data-testid={`capacity-${p.resourceId}`}>
              {t("独立维修人员")}: {number(p.remaining)} {t("人员日")}
            </small>
          ))}
        </article>
        <article>
          <span>
            {t(
              water?.type === "water"
                ? "水资源库存"
                : water?.name || "关键资源",
            )}
          </span>
          <strong data-testid="water-inventory" data-value={water?.quantity}>
            {number(water?.quantity)}{" "}
            {t(water?.unit === "m3" ? "m³" : water?.unit)}
          </strong>
          <small>{t("预约量在排程报价中核对")}</small>
        </article>
        <article>
          <span>{t("经理注意力")}</span>
          <strong data-testid="attention-remaining" data-value={r.attention}>
            {number(r.attention)} / {number(r.dailyAttention)}
          </strong>
          <small>{t("早会固定 −1 · 普通排程免费")}</small>
        </article>
      </div>
    </section>
  );
}
