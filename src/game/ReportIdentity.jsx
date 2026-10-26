import { useGameLocale } from "./GameLocaleContext.js";
import { reportAttribution } from "../domain/managementEvidence.js";
export default function ReportIdentity({ report, details = false }) {
  const { t } = useGameLocale();
  const info = reportAttribution(report);
  return (
    <span className="fg-report-identity">
      {t(info.method || report.sourceType)}
      {info.responsible && (
        <small>
          {t("责任人")}: {t(info.responsible)}
        </small>
      )}
      {info.laboratory && (
        <small>
          {t("检测来源")}: {t("实验室")}
        </small>
      )}
      {details && info.laboratory && (
        <small>
          {t(
            "农艺师负责采样、组织送检与解读，实验室负责检测。分值是水分胁迫评估，不是含水率或缺水概率。报告反映采样时的情况。",
          )}
        </small>
      )}
      {info.preset && <small>{t("场景中农艺师安排的一次送检")}</small>}
    </span>
  );
}
