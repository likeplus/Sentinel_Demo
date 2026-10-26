import { DAILY_BRIEFING } from './content/gameplayGuide.js';
import WaterEvidenceTrend from './WaterEvidenceTrend.jsx';
import ReportIdentity from './ReportIdentity.jsx';
import { useGameLocale } from "./GameLocaleContext.js";import { useMemo, useState } from 'react';
import { FARM_ACTIONS } from '../simulation/FarmManagement.js';
import './feedback.css';
import { temperatureText } from './displayFormat.js';
import { dailyReviewRows } from './dailyReview.js';

const actionNames = (actions) => actions.map((a) => FARM_ACTIONS[a]?.zh || a).join(' + ');
import { inspectionEvidence, calendarDates, calendarCell, reservationRows } from './workspaceModel.js';
import { informationAge as freshness } from './informationAge.js';
import { waterLevel, statusColor } from './feedbackStatus.js';
function Dot({ level, children }) {const { t } = useGameLocale();return <span className={`fb-status fb-${level}`}><i />{t(children)}</span>;}

export function Onboarding({ onboarded, onDismiss }) {
  const { t, locale } = useGameLocale();
  const text = value => value[locale];
  const [expanded, setExpanded] = useState(!onboarded);
  const toggle = event => {
    const open = event.currentTarget.open;
    setExpanded(open);
    if (!open && !onboarded) onDismiss();
  };
  return <details className="fg-panel fb-onboarding" data-testid="onboarding" open={expanded} onToggle={toggle}><summary data-testid="onboarding-toggle">{t("每日玩法说明")}</summary><div data-testid="onboarding-content"><h2>{text(DAILY_BRIEFING.title)}</h2><p>{text(DAILY_BRIEFING.body)}</p><p><b>{text(DAILY_BRIEFING.reminder)}</b></p><p className="fb-loop">{text(DAILY_BRIEFING.loop)}</p><button className="fg-button fg-button--primary" data-testid="onboarding-dismiss" onClick={() => setExpanded(false)}>{t("收起说明")}</button></div></details>;
}

function CalendarDetail({ cell, onViewTask, onClose }) {
  const { t } = useGameLocale();
  return <div className="fb-cell" role="region" aria-label={t('Calendar detail')} data-testid="calendar-detail"><div className="fb-actions"><h3>{cell.unitId} · {cell.date}</h3><button className="fg-text-button" onClick={onClose}>{t('关闭详情')}</button></div>
    {cell.observations.length ? cell.observations.map(o => <div key={o.id}><p>{t('Observation source')}: <ReportIdentity report={o} details /> · {t('Observation Time')}: {o.observedAt} · {t('Observation Confidence')}: {Number.isFinite(o.reliability) ? `${Math.round(o.reliability * 100)}%` : '—'}</p><p>{t(o.variable === 'waterStress' ? 'Water Stress' : o.variable || '作物与设备巡查')}: {t(o.variable === 'waterStress' && Number.isFinite(o.value) ? `${Math.round(o.value * 100)} / 100` : typeof o.value === 'object' ? '—' : o.value ?? '—')} {o.cropCondition && `${t('病虫害迹象')}: ${t(inspectionEvidence({ latestInspection: o }).signs)}`} {o.equipmentCondition && `${t('Equipment Condition')}: ${t(o.equipmentCondition)}`}</p><p>{o.findings?.map(f => t(f)).join('; ')}</p>{o.taskId && <button className="fg-text-button" onClick={() => onViewTask?.(o.taskId)}>{t('Related Action')} {o.taskId}</button>}</div>) : <p>{t('No Observation')}</p>}
    {cell.tasks.map(task => <p key={task.id}><button className="fg-text-button" onClick={() => onViewTask?.(task.id)}>{task.id} · {t(actionNames(task.actions))}</button> · {t('Labor')} {task.labor} · {t(task.executionStatus)}<br />{task.results.map(r => t(r.message)).join('; ')}</p>)}
  </div>;
}

export function FarmStatusTable({ units, selectedId, onSelect, selectedIds = [], onToggle, management, showCalendar = false, calendarMode = 'operations', calendarOffset = 0, onViewTask }) {
  const { t } = useGameLocale();
  const [selectedCell, setSelectedCell] = useState(null);
  const dates = showCalendar ? calendarDates(management, calendarOffset) : [];
  const cell = selectedCell && calendarCell(management, selectedCell.unitId, selectedCell.date, calendarMode);
  return <><div className="fb-scroll fb-status-scroll"><table className="fb-table fb-status-table" data-testid="farm-status-table"><thead><tr><th>{t('选择')}</th>{['Production Unit', 'Water Stress', '病虫害迹象', '巡查可信度', 'Equipment', 'Sensors'].map(h => <th key={h}>{t(h)}</th>)}{dates.map(date => <th key={date} className="fb-calendar-col">{date.slice(5)}<small>{t(calendarMode === 'operations' ? '作业排程' : '观察记录')}</small></th>)}</tr></thead>
    <tbody>{units.map(u => { const inspection = inspectionEvidence(u); return <tr key={u.id} className={u.id === selectedId ? 'is-selected' : ''}>
      <td><input type="checkbox" aria-label={`${t('选择')} ${u.id}`} data-testid={`select-${u.id}`} checked={selectedIds.includes(u.id)} onChange={() => onToggle(u.id)} /></td>
      <td><button className="fg-text-button" data-testid={`table-unit-${u.id}`} onClick={() => onSelect(u.id)}><b>{u.id}</b></button><small>{t(u.varietyName)}</small><small>{t(u.stage.label)}</small></td>
      <td data-testid={`freshness-${u.id}`}><button className="fg-text-button" onClick={() => onSelect(u.id)}><Dot level={waterLevel(u.water.value == null || u.water.stale ? null : u.water.value * 100)}>{u.water.value == null ? t('Unknown') : `${Math.round(u.water.value * 100)} / 100`}</Dot></button><small>{t('信息更新')}: {t(freshness(u.water.freshness, Boolean(u.water.observedAt)))}{u.water.stale && ` · ${t('当前状态未确认')}`}</small><small>{t(u.water.source)}{u.water.provisional && ` · ${t('预计影响')}`}</small></td>
      <td data-testid={`pest-signs-${u.id}`}><Dot level={inspection.level}>{t(inspection.signs)}</Dot><small>{t('信息更新')}: {t(freshness(u.cropFreshness, Boolean(inspection.report)))}</small></td>
      <td data-testid={`inspection-confidence-${u.id}`}><b>{inspection.confidence == null ? t('暂无巡查') : `${inspection.confidence}%`}</b><small>{inspection.report?.observedAt.slice(0, 10) || '—'}</small><small>{t(inspection.report?.sourceType || 'Unknown')}</small></td>
      <td><Dot level={statusColor(u.equipment.status)}>{t(u.equipment.status)}</Dot><small>{t('信息更新')}: {t(freshness(u.cropFreshness, Boolean(inspection.report)))}</small><small>{t('Reliability')} {u.equipment.reliability}%</small></td>
      <td>{u.sensors.length || '—'}<small>{t(u.sensors.some(s => s.status === 'Normal') ? '传感器覆盖' : '无有效覆盖')}</small></td>
      {dates.map(date => { const c = calendarCell(management, u.id, date, calendarMode); return <td key={date} className="fb-calendar-col"><button className="fg-text-button" data-testid={`calendar-${u.id}-${date}`} aria-label={`${u.id} ${date}`} onClick={() => setSelectedCell({ unitId: u.id, date })}>{calendarMode === 'observation' ? `${c.observations.length ? c.abnormal ? '⚠' : '✓' : '—'} ${c.tasks.some(task => task.executionStatus === 'scheduled') ? '○' : ''}${c.tasks.some(task => task.executionStatus === 'cancelled') ? '×' : ''}` : c.tasks.length ? c.tasks.map(task => <span className="fb-calendar-task" key={task.id}>{t(actionNames(task.actions))}<small>{t('Labor')} {task.labor} · {t(task.executionStatus)}</small></span>) : '—'}</button></td>; })}
    </tr>; })}</tbody></table></div>{showCalendar && cell && <CalendarDetail cell={cell} onViewTask={onViewTask} onClose={() => setSelectedCell(null)} />}</>;
}

export function UnitSelection({ units, selectedIds, onToggle, onClear, onPlan, enabled, side = 'left' }) {
  const { t } = useGameLocale();
  return <section className="fb-selection" data-testid={side === 'left' ? 'unit-selection' : 'unit-selection-right'}><h3>{t("选择生产单元并安排同一任务")}</h3><div className="fb-actions">{units.map(u => <label key={u.id}><input type="checkbox" data-testid={`${side === 'left' ? 'selection' : 'right-selection'}-${u.id}`} checked={selectedIds.includes(u.id)} onChange={() => onToggle(u.id)} />{u.id}</label>)}</div><div className="fb-actions"><b data-testid={side === 'left' ? 'selection-count' : 'right-selection-count'}>{t("已选择")} {selectedIds.length}</b><span>{selectedIds.join(' · ')}</span><button className="fg-text-button" onClick={onClear}>{t("清空选择")}</button><button className="fg-button fg-button--primary" data-testid={side === 'left' ? 'batch-plan' : 'right-batch-plan'} disabled={!selectedIds.length || !enabled} onClick={onPlan}>{t("安排所选单元")}</button></div></section>;
}

export function TaskPlanner({ management: m, controller, run, initialUnitId, unitIds: batchIds, initialAction = 'inspection', onViewTask, openPurchase, draft, setDraft, onSelectUnit, availableUnits }) {
  const { t } = useGameLocale();
  const crews = controller.getSnapshot().view.resources.filter(r => r.type === 'crew');
  const [localDraft, setLocalDraft] = useState({ date: m.currentDate, base: initialAction, extras: [], sensorId: m.sensors.find(s => !s.fixed)?.id || '', crewId: crews[0]?.id || '', reason: '' });
  const values = draft || localDraft;
  const update = (key, value) => (setDraft || setLocalDraft)(previous => ({ ...(previous || localDraft), [key]: value }));
  const { date, base, extras, sensorId, crewId, reason } = values;
  const [localUnitId, setLocalUnitId] = useState(initialUnitId || m.units[0]?.id || '');
  const unitId = onSelectUnit ? initialUnitId : localUnitId;
  const setUnitId = id => onSelectUnit ? onSelectUnit(id) : setLocalUnitId(id);
  const setDate = value => update('date', value), setBase = value => update('base', value), setExtras = value => update('extras', value);
  const setSensorId = value => update('sensorId', value), setCrewId = value => update('crewId', value), setReason = value => update('reason', value);
  const [editDate, setEditDate] = useState(m.currentDate);
  const [error, setError] = useState(''), [created, setCreated] = useState([]), [submittedPlan, setSubmittedPlan] = useState('');
  const unitIds = useMemo(() => batchIds?.length ? batchIds : [unitId], [batchIds, unitId]);
  const actions = useMemo(() => [base, ...(base.endsWith('inspection') ? extras : [])], [base, extras]);
  const planKey = JSON.stringify({ unitIds, date, actions, sensorId, crewId, reason });
  const submitted = submittedPlan === planKey && created.some(task => m.tasks.some(current => current.id === task.id && current.executionStatus !== 'cancelled'));
  const preview = controller.previewTasks({ unitIds, date, actions, sensorId, crewId });
  const quote = preview.quote;
  const enabled = m.phase === 'morning' && !m.ended;
  const change = callback => { callback(); setSubmittedPlan(''); setCreated([]); setError(''); };
  const submit = event => {
    event.preventDefault(); if (submitted) return;
    const result = run('scheduleBatch', { unitIds, date, actions, sensorId, reason, crewId });
    setError(result.accepted ? '' : result.error || result.message);
    if (result.accepted) { setCreated(result.tasks); setSubmittedPlan(planKey); }
  };
  return <section className="fg-panel feedback-views" id="inline-task-planner" data-testid="task-planner"><h2>{t("安排任务 · Today / Future Date")}</h2><p>{t("普通排程不消耗注意力。每个所选单元各执行一次；批量任务全部通过资源检查后才会创建。")}</p><form onSubmit={submit}><fieldset disabled={!enabled}><div className="fb-form-grid fb-task-grid"><label>{t("Production Unit")}{batchIds?.length ? <b>{unitIds.join(' · ')}</b> : <select data-testid="task-unit" value={unitId} onChange={e => change(() => setUnitId(e.target.value))}>{(availableUnits || m.units).map(u => <option key={u.id}>{u.id}</option>)}</select>}</label><label>{t("日期")}<input data-testid="task-date" type="date" min={m.currentDate} max={m.endDate} value={date} onChange={e => change(() => setDate(e.target.value))} required /></label><label>{t("Action")}<select data-testid="task-action" value={base} onChange={e => change(() => {setBase(e.target.value);setExtras([]);})}>{Object.entries(FARM_ACTIONS).map(([a, spec]) => <option key={a} value={a}>{t(spec.label)}</option>)}</select></label><label>{t("Labor · 执行班组")}<select data-testid="task-crew" value={crewId} onChange={e => change(() => setCrewId(e.target.value))}>{crews.map(r => <option key={r.id} value={r.id}>{t(r.name)}</option>)}</select></label></div>{base.endsWith('inspection') && <div className="fb-actions fb-attachments">{['manual_watering', 'spraying', 'repair', 'sensor_relocation'].map(a => <label key={a}><input type="checkbox" data-testid={`attach-${a}`} checked={extras.includes(a)} onChange={e => change(() => setExtras(e.target.checked ? [...extras, a] : extras.filter(x => x !== a)))} />{t(FARM_ACTIONS[a].zh)}</label>)}</div>}{actions.includes('sensor_relocation') && <label>{t("Mobile Sensor · From → selected Unit")}<select data-testid="task-sensor" value={sensorId} onChange={e => change(() => setSensorId(e.target.value))}>{m.sensors.filter(s => !s.fixed).map(s => <option key={s.id} value={s.id}>{s.id} · {s.location} → {unitIds.join(' · ')}</option>)}</select></label>}{quote && !submitted && <div className="fb-capacity" data-testid="future-capacity"><b>{t(date === m.currentDate ? 'Today' : date)} · {t('Total Labor Required')} {quote.labor} · {t('Attention Required')} {quote.attention}</b><div className="fb-scroll"><table className="fb-table fb-capacity-table"><thead><tr>{['资源', '可用', '已排', '本次需求', '排程后剩余'].map(h => <th key={h}>{t(h)}</th>)}</tr></thead><tbody>{reservationRows(quote).map(row => <tr key={row.id}><th>{t(row.label)}{row.id === 'water' && ` (${t('m³')})`}</th><td>{row.available ?? '—'}</td><td>{row.reserved ?? '—'}</td><td>{row.requested}</td><td className={row.remaining < 0 ? 'fb-conflict' : ''} data-testid={`remaining-${row.id}`}><b>{Number(row.remaining.toFixed(2))}</b></td></tr>)}</tbody></table></div><small>{t('可预约水量已扣除所有未执行任务的预留。')}</small><span>{t('预计作业费用')} ¥{quote.cost.toFixed(2)} · {t('人员日')} {quote.staffDays.toFixed(2)}</span></div>}<label>{t("Decision Reason（Optional）")}<input data-testid="task-reason" value={reason} onChange={e => setReason(e.target.value)} /></label><button type="submit" className="fg-button fg-button--primary" data-testid="task-confirm" disabled={submitted || !preview.accepted}>{t(submitted ? '任务已创建' : '确认排程')}</button></fieldset></form>{!submitted && !preview.accepted && <div role="alert" className="fb-conflict"><p>{t(preview.message)}</p>{preview.errors?.flatMap(e => (e.conflicts || []).map((c, i) => <p key={`${e.unitId}:${i}`}>{e.unitId} · {t(c.resourceId)} · {c.date} · {t('需求')} {c.requested ?? '—'} · {t('可用')} {c.available ?? '—'}</p>))}<p>{t("没有创建任何任务。请调整整个计划后重试。")}</p>{openPurchase && enabled && <button className="fg-button fg-button--secondary" data-testid="planner-purchase" onClick={openPurchase}>{t("应急采购水资源")}</button>}</div>}{error && <p role="alert">{t(error)}</p>}{!submitted && (preview.taskIds || []).map(id => <div className="fb-duplicate" key={id}><button className="fg-text-button" data-testid={`duplicate-view-${id}`} onClick={() => onViewTask?.(id)}>{t("View")} {id}</button><input type="date" aria-label={t("重复任务改期日期")} min={m.currentDate} max={m.endDate} value={editDate} onChange={e => setEditDate(e.target.value)} /><button className="fg-button fg-button--secondary" onClick={() => run('reschedule', id, editDate)}>{t("Reschedule")}</button><button className="fg-button fg-button--secondary" onClick={() => run('cancelTask', id)}>{t("Cancel")}</button></div>)}{submitted && created.length > 0 && <div className="fb-created" role="status" data-testid="task-created"><b>{t("任务已创建")}</b>{created.map(task => <p key={task.id}><button className="fg-text-button" onClick={() => onViewTask?.(task.id)}>{task.unitId} · {task.plannedStart} · {t(actionNames(task.actions))} · {t('Labor')} {task.labor} · {t('Attention')} {task.attention}</button></p>)}</div>}{!enabled && <p>{t(m.ended ? '本轮已结束，排程仅供回顾。' : '排程窗口已关闭。Next Morning 再安排。')}</p>}</section>;
}

export function SensorDistribution({ management: m, onRelocate }) {const { t } = useGameLocale();
  return <section className="fg-panel feedback-views" data-testid="sensor-assets"><h2>{t("Sensor Distribution")}</h2><div className="fb-scroll"><table className="fb-table"><thead><tr>{t(['Type / ID', 'Location', 'Status', 'Last update', 'Fixed / Mobile'].map((x) => <th key={x}>{t(x)}</th>))}</tr></thead><tbody>{t(m.sensors.map((s) => <tr key={s.id}><td>{t(s.type)}<small>{t(s.id)}</small></td><td>{t(s.location)}</td><td>{t(s.status)}</td><td>{t(s.lastUpdate?.replace('T', ' ').replace(':00Z', ' UTC') || 'Waiting for update')}</td><td>{t(s.fixed ? 'Fixed' : 'Mobile')}{!s.fixed && onRelocate && <button className="fg-text-button" data-testid={`relocate-${s.id}`} disabled={m.phase !== 'morning' || m.ended} onClick={() => onRelocate(s.id)}>{t('安排迁移')}</button>}</td></tr>))}</tbody></table></div><p>{t("Mobile Sensor 必须通过 Sensor Relocation 作业迁移（Labor 1）。水分传感器不能更新作物与设备信息。")}</p></section>;
}

export function WaterTrend(props) { return <WaterEvidenceTrend {...props} />; }

function ProposalQuote({ decision, management, controller, openPurchase }) {
  const { t } = useGameLocale();
  if (!decision.recommendedActions.length) return null;
  const preview = controller.previewTasks({ unitIds: [decision.unitId], date: management.currentDate, actions: decision.recommendedActions });
  return <div className="fb-capacity">{preview.quote && <b>{t('Labor')} {preview.quote.labor} · {t('水需求')} {preview.quote.water} {t('m³')} · {t('预计作业费用')} ¥{preview.quote.cost.toFixed(2)}</b>}{!preview.accepted && <p className="fb-conflict">{t(preview.message)}</p>}{!preview.accepted && openPurchase && <button className="fg-text-button" onClick={openPurchase}>{t('应急采购水资源')}</button>}</div>;
}
export function DecisionHistory({ management: m, run, controller, openPurchase }) {
  const { t } = useGameLocale();
  const [reasons, setReasons] = useState({});
  const renderDecision = d => <article className="fb-history" key={d.id} id={`decision-${d.id}`}><h3>{t(d.id)}{t(" · ")}{t(d.unitId)}{t(" · ")}{t(d.date)}</h3>{d.status === 'proposed' && <WaterEvidenceTrend management={m} unitIds={[d.unitId]} testId={`recommendation-trend-${d.id}`} />}<p>{t("Decision Maker: ")}<b>{t(d.maker)}</b>{t(" · Confidence ")}{t(Math.round(d.confidence))}{t("% · ")}{t(d.status)}</p><p>{t("推荐/决定：")}{t(actionNames(d.recommendedActions) || 'Defer')}{t(" · Rationale: ")}{d.maker === 'Manager' && d.rationale ? d.rationale : t(d.rationale || 'Optional — 未填写')}</p><details><summary>{t("输入信息与依据")}</summary><p>{t("Crop ")}{t(d.input.cropStatus)}{t(" · Water ")}{t(d.input.water.value ?? 'Unknown')} · {t('水分信息更新')}: {t(freshness(d.input.water.freshness, Boolean(d.input.water.observedAt)))}{t(" · Equipment ")}{t(d.input.equipment.status)}</p><p>{t("Growth Stage ")}{t(d.input.growthStage || 'Unknown')}{t(" · Labor ")}{t(d.input.labor.remaining)}{t(" · Sensors ")}{t(d.input.sensors.length)}{t(" · Weather ")}{temperatureText(d.input.weather.temperature)}{t(" / Rain ")}{t(d.input.weather.rainfall)}{t("mm")}</p><p>{t("Observation IDs: ")}{t(d.input.observationIds.join(', ') || 'None')}</p><p>{t("Existing Schedule: ")}{t(d.input.existingSchedule.map((t) => `${t.id} ${t.plannedStart}`).join(', ') || 'None')}</p></details>{t(d.status === 'proposed' && d.maker === 'Manager' && <label>{t("Decision Reason（Optional）")}<input aria-label={t(`Decision reason ${d.id}`)} value={reasons[d.id] || ''} onChange={(e) => setReasons({ ...reasons, [d.id]: e.target.value })} /></label>)}{d.status === 'proposed' && controller && <ProposalQuote decision={d} management={m} controller={controller} openPurchase={openPurchase} />}{t(d.status === 'proposed' && <div className="fb-actions"><button className="fg-button fg-button--primary" data-testid={`accept-${d.id}`} disabled={m.phase !== 'morning' || m.ended} onClick={() => run('resolveDecision', d.id, true, reasons[d.id] || '')}>{t("Accept")}</button><button className="fg-button fg-button--secondary" data-testid={`reject-${d.id}`} disabled={m.phase !== 'morning' || m.ended} onClick={() => run('resolveDecision', d.id, false)}>{t("Reject")}</button></div>)}<p>{t("Related Action: ")}{t(d.taskIds.join(', ') || '—')}</p>{t(d.result?.map((r, i) => <p key={i}>{t(r.action)}{t(": ")}{t(r.status)}{t(" · ")}{t(r.message)}</p>))}</article>;
  const pending = m.decisions.filter(d => d.status === 'proposed');
  const history = m.decisions.filter(d => d.status !== 'proposed').toReversed();
  return <section className="fg-panel feedback-views" data-testid="feedback-decision-history"><h2>{t('待确认建议')}</h2>{pending.map(renderDecision)}{!pending.length && <p>{t('当前没有待处理决策')}</p>}<details><summary>{t('Decision History · Observation → Decision → Action → Result')} · {history.length}</summary>{history.map(renderDecision)}</details></section>;
}

export function DailyFeedback({ management: m, onSelectUnit, onViewTask }) {
  const { t } = useGameLocale();
  const rows = dailyReviewRows(m);
  const resourceNumber = value => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const costs = value => `¥${Number(value || 0).toFixed(2)}`;
  const counts = status => rows.filter(row => row.status === status).length;
  const total = key => rows.reduce((sum, row) => sum + (row[key] || 0), 0);
  return <section className="fg-panel feedback-views" data-testid="daily-feedback">
    <h2>{t(m.phase === 'morning' ? 'Morning Meeting · 昨日反馈' : m.phase === 'execution' ? 'Execution · 今日反馈' : 'End of Day · 复盘')}</h2>
    <p>{t(m.ended ? '本轮已结束，以下为最后一个经营日的结果。剩余 ' : '早会 Attention −1 已扣除。剩余 ')}{m.resources.attention}{t('，已预留 ')}{m.resources.attentionReserved}{t('。当前 ')}{t(m.ended ? '本轮已结束，排程仅供回顾。' : m.phase === 'morning' ? '可排程 Today / Future Date' : '排程关闭，新问题留到 Next Morning')}。</p>
    {rows.length ? <>
      <div className="fb-review-summary" data-testid="review-summary"><b>{t('任务汇总')}</b><span>{t('完成')} {counts('completed')}</span><span>{t('受阻')} {counts('blocked')}</span><span>{t('失败或部分完成')} {counts('failed')}</span><span>{t('Labor')} {resourceNumber(total('labor'))}</span><span>{t('实际用水')} {resourceNumber(total('water'))} {t('m³')}</span><span>{t('已发生费用')} {costs(total('cost'))}</span></div>
      <div className="fb-scroll"><table className="fb-table fb-review-table" data-testid="daily-review-table"><caption>{t('作业日期')}: {[...new Set(rows.map(row => row.date).filter(Boolean))].join(' · ') || '—'}</caption><thead><tr>{['Production Unit', '作业', '执行状态', '资源消耗', '关键结果'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>
        {rows.map(row => <tr key={row.taskId} data-testid={`review-${row.taskId}`}>
          <td>{row.unitIds.map(id => <button key={id} className="fg-text-button" onClick={() => onSelectUnit?.(id)}>{id}</button>)}</td>
          <td><b>{t(actionNames(row.actions)) || '—'}</b><small><button className="fg-text-button" onClick={() => onViewTask?.(row.taskId)}>{row.taskId}</button></small></td>
          <td><Dot level={row.status === 'completed' ? 'normal' : row.status === 'blocked' ? 'significant' : 'severe'}>{t(row.status)}</Dot></td>
          <td className="fb-review-resources"><span>{t('Labor')} <b data-review-labor>{resourceNumber(row.labor)}</b></span>{row.personnel?.map(p => <span key={p.resourceId}>{t('独立维修人员')} <b>{resourceNumber(p.days)}</b> {t('人员日')}</span>)}<span>{t('实际用水')} <b data-review-water>{resourceNumber(row.water)}</b> {t('m³')}</span><span>{t('已发生费用')} <b data-review-cost>{costs(row.cost)}</b></span></td>
          <td>
            {row.observations.map(o => <p key={o.id} data-testid={`condition-${o.id}`}>{row.unitIds.length > 1 && <b>{o.productionUnitId} · </b>}<b>{t('病虫害迹象')}</b>: {t(inspectionEvidence({ latestInspection: o }).signs)} · <b>{t('Equipment Condition')}</b>: {t(o.equipmentCondition)}</p>)}
            {row.impacts.map((impact, i) => <p key={i} className="fb-review-impact"><b>{impact.unitId} · {t('预计水分胁迫')} {impact.from ?? t('Unknown')} → {impact.to ?? t('Unknown')}</b><small>{t('预计影响，等待后续有效观测验证；不代表已确认恢复。')}</small>{m.phase === 'morning' && <span>{t('最后观测值')} {m.units.find(unit => unit.id === impact.unitId)?.water.value ?? t('Unknown')} / 100</span>}</p>)}
            {!row.observations.length && !row.impacts.length && row.results.map((result, i) => <p key={i}>{row.unitIds.length > 1 && `${result.unitId} · `}{t(result.message)}</p>)}
            <details className="fb-review-details"><summary>{t('查看详细观测与执行记录')}</summary>
              {row.results.map((result, i) => <p key={i}><button className="fg-text-button" onClick={() => onSelectUnit?.(result.unitId)}>{result.unitId}</button> · {t(result.message)}</p>)}
              {row.observations.map(o => <div className="fb-cell" key={o.id}><b>{o.productionUnitId} · {t('作物与设备巡查')}</b><p>{t('Observation Time')}: {o.observedAt} · {t('Observation Confidence')}: {Math.round(o.reliability * 100)}%</p><p>{t('Observation source')}: <ReportIdentity report={o} details /></p><p>{t('发现')}: {o.findings?.map(finding => t(finding)).join('; ')}</p><p>{t('设备部件')}: {o.equipmentFindings?.map(finding => `${t(finding.part)}: ${t(finding.status)}`).join('; ')}</p></div>)}
              {row.impacts.map((impact, i) => <p key={i}>{impact.unitId} · {t('Water')} {resourceNumber(impact.water)} {t('m³')} · {t('Efficiency')} {Math.round(impact.efficiency * 100)}% · {t('预计效果仍需有效观测验证，未观测不代表已经恢复。')}{m.phase === 'morning' && <span> · {t('Latest Observation')} {m.units.find(unit => unit.id === impact.unitId)?.water.observedAt || '—'} · {t(m.units.find(unit => unit.id === impact.unitId)?.water.source)}</span>}</p>)}
            </details>
          </td>
        </tr>)}
      </tbody></table></div>
    </> : <p data-testid="review-empty">{t('尚无作业执行结果。')}</p>}
    <details><summary>{t('每日记录')}</summary>{m.history.toReversed().slice(0, 15).map((item, i) => <p key={i}>{item.date} · {t(item.type)} · {t(item.message)}</p>)}</details>
  </section>;
}
