import GameLocaleProvider from './GameLocaleProvider.jsx';
import { useGameLocale } from "./GameLocaleContext.js";import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { createGameController } from './GameController.js';
import { Onboarding, UnitSelection, FarmStatusTable, TaskPlanner, SensorDistribution, Calendars, WaterTrend, CropGuide, DecisionHistory, DailyFeedback } from './FeedbackViews.jsx';
import { informationAge } from './informationAge.js';
import { needsComplexDecision } from '../simulation/FarmManagement.js';
import FarmMap from './FarmMap.jsx';
import { GameplayGuide, CropEncyclopedia } from './GuideViews.jsx';
import { waterLevel, statusColor } from './feedbackStatus.js';
import './unit-panel.css';
import './game.css';

const TABS = [
{ id: 'map', label: '农场总览', subtitle: 'MAP', icon: 'map' },
{ id: 'today', label: '今日工作', subtitle: 'TODAY', icon: 'sun' },
{ id: 'operations', label: '作业排程', subtitle: 'OPERATIONS', icon: 'calendar' },
{ id: 'units', label: '生产单元', subtitle: 'UNITS', icon: 'grid' },
{ id: 'decisions', label: '决策中心', subtitle: 'DECISIONS', icon: 'branch' },
{ id: 'management', label: '经营管理', subtitle: 'MANAGEMENT', icon: 'chart' },
{ id: 'guide', label: '玩法简介', subtitle: 'GUIDE', icon: 'book' },
{ id: 'knowledge', label: '作物知识', subtitle: 'KNOWLEDGE', icon: 'leaf' }];

const STATUS = { open: '待决策', delayed: '等待复查', delegated: '等待下属汇报', awaiting_approval: '待你批准',
  investigating: '调查中', scheduled: '已排程', completed: '已完成', resolved: '已处理', blocked: '执行受阻',
  cancelled: '已取消', expired: '已过期限', current: '当前有效', stale: '已过期', unknown: '尚无信息', invalid: '无效' };
const SOURCE = { sensor: '传感器', worker: '现场人员', lab: '实验室', inspection: '现场检查', report: '报告', estimate: '估计' };
const VARIABLE = { waterStress: '水分胁迫', growthStage: '生长阶段', stage: '生长阶段', diseasePressure: '病害压力', nutrientStatus: '营养状态' };
const OPERATION = { irrigation: '灌溉', inspection: '现场检查', maintenance: '设备维护', harvest: '采收', manager_inspection: '经理亲自巡查', manual_watering: '人工补水', spraying: '喷施', repair: '设备维修', sensor_relocation: '传感器迁移' };
const ROLE = { farm_manager: '农场经理', agronomist: '农艺师', irrigation_manager: '灌溉主管', field_supervisor: '田间主管',
  maintenance_lead: '维护负责人', sentinel_agent: 'Sentinel 分析助手' };
const REASONS = [{ id: 'evidence', label: '依据现有证据' }, { id: 'risk', label: '控制作物风险' },
{ id: 'resource', label: '考虑资源约束' }, { id: 'uncertainty', label: '仍有信息不确定性' }];
const number = (value, digits = 0) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
const money = (value) => `¥${number(value, 0)}`;
const nextDate = (date, days = 1) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const personLabel = (person) => person?.nameZh || ROLE[person?.role] || person?.name || person?.id || '下属';
const operationLabel = (operation) => operation?.actions ? operation.actions.map((a) => OPERATION[a] || a).join(' + ') : OPERATION[operation?.type] || operation?.type || '作业';
const resourceLabel = (resource) => ({ water: '蓄水池', 'crew-a': '田间班组 A', 'irrigation-rig': '滴灌设备', 'maintenance-person': '维护人员' })[resource?.id] || resource?.nameZh || resource?.name || resource?.id;
const STAGE_LABEL = { vegetative: '营养生长期', flowering: '开花期', fruit_set: '坐果期', ripening: '转熟期', harvest: '采收期' };
const UI_KEY = 'sentinel:farm-game:ui:v1';
function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    return { tab: TABS.some((item) => item.id === saved.tab) ? saved.tab : 'today',
      selectedUnitId: typeof saved.selectedUnitId === 'string' ? saved.selectedUnitId : '',
      overlay: ['water', 'tasks', 'freshness'].includes(saved.overlay) ? saved.overlay : 'water' };
  } catch {return { tab: 'today', selectedUnitId: '', overlay: 'water' };}
}

function Glyph({ name, size = 20, ...props }) {const { t } = useGameLocale();
  const paths = {
    book: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15m6-12v15" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18m-14 4h3m4 0h3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    branch: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="19" r="2" /><path d="M6 7v10M18 8v1a5 5 0 0 1-5 5H6" /></>,
    chart: <><path d="M4 3v18h17M8 17v-4m5 4V8m5 9V5" /></>,
    leaf: <><path d="M20 3C7 2 2 9 5 16s15 3 15-13Z" /><path d="M4 21 15 10" /></>,
    drop: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" />,
    people: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="m12 3 10 18H2Z" /><path d="M12 9v5m0 3v.1" /></>,
    reset: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 8h18m-6 5h6m-4 2v.1" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{t(paths[name] || paths.leaf)}</svg>;
}

function Badge({ status, children }) {const { t } = useGameLocale();
  return <span className={`fg-badge fg-badge--${status || 'neutral'}`}>{t(children || STATUS[status] || status)}</span>;
}

function Empty({ title, children, icon = 'leaf' }) {const { t } = useGameLocale();
  return <div className="fg-empty"><Glyph name={icon} size={30} /><strong>{t(title)}</strong><p>{t(children)}</p></div>;
}

function ObservationList({ observations = [], limit = 6 }) {const { t } = useGameLocale();
  const [expanded, setExpanded] = useState(false);
  const sorted = observations.toSorted((a, b) => b.availableAt.localeCompare(a.availableAt) || b.observedAt.localeCompare(a.observedAt));
  const shown = expanded ? sorted : sorted.slice(0, limit);
  if (!shown.length) return <p className="fg-muted fg-observation-empty">{t("还没有送达的观测。你可以安排现场检查。")}</p>;
  return <div className="fg-observations">{t(shown.map((observation) =>
    <div className="fg-observation" key={observation.id} data-testid={`observation-${observation.id}`}>
      <div><strong>{observation.productionUnitId} · {t(VARIABLE[observation.variable] || observation.variable)}</strong><Badge status={observation.status} /></div>
      <p><span>{t(SOURCE[observation.sourceType] || observation.sourceType)}</span><b>{t(observation.label || (typeof observation.value === 'number' ? (observation.variable === 'waterStress' ? `${Math.round(observation.value * 100)} / 100` : number(observation.value, 2)) : STAGE_LABEL[observation.value] || String(observation.value)))}{t(observation.unit && observation.unit !== 'ratio' ? ` ${observation.unit}` : '')}</b></p>
      <small>{t("观测 ")}{t(observation.observedAt)}{t(" · 送达 ")}{t(observation.availableAt)}{t(" · 可靠度 ")}{t(number(observation.reliability * 100))}{t("%")}</small>
    </div>
    ))}{t(sorted.length > limit && <button className="fg-text-button" onClick={() => setExpanded(!expanded)}>{t(expanded ? '收起历史观测' : `查看全部 ${sorted.length} 条观测`)}</button>)}</div>;
}

function UnitPanel({ unit, view, run, navigate, onPlan, selectedIds }) {
  const { t, locale } = useGameLocale();
  const label = (zh, en) => locale === 'zh' ? zh : en;
  if (!unit) return <section className="fg-panel fg-unit-panel"><Empty title={t('选择一个生产单元')}>{t('点击地图上的地块，查看你已经获得的信息。')}</Empty></section>;
  const u = view.management.units.find(item => item.id === unit.id);
  const enabled = view.management.phase === 'morning' && !view.ended;
  const age = (days, hasInformation) => t(informationAge(days, hasInformation));
  const level = waterLevel(u.water.value);
  const waterLabel = { normal: label('正常', 'Normal'), mild: label('轻度', 'Mild'), significant: label('显著', 'Significant'), severe: label('严重', 'Severe'), unknown: t('Unknown') }[level];
  const review = maker => { const result = run('openDecision', u.id, maker); if (result.accepted) navigate('decisions', result.decision.id); };
  return <aside className="fg-panel fg-unit-panel fg-unit-organized" data-testid="selected-unit" data-unit-id={unit.id}>
    {selectedIds.length > 1 && <section className="fg-unit-section"><h3>{t('已选择')} {selectedIds.length}</h3>{view.management.units.filter(item => selectedIds.includes(item.id)).map(item => <p key={item.id}><b>{item.id}</b> · {t('Water Stress')} {item.water.value ?? '—'} · {t('Confidence')} {item.water.confidence}% · {t('水分信息更新')}: {age(item.water.freshness, Boolean(item.water.observedAt))}</p>)}</section>}<header className="fg-unit-header"><span className="fg-eyebrow">{t('PRODUCTION UNIT')}</span><h2>{unit.id}</h2><p>{t(unit.varietyName)} · {unit.clusterId} · {number(unit.area?.value, 2)} {t(unit.area?.unit)}</p></header>
    <section className="fg-unit-section"><h3>{label('状态摘要', 'Status summary')}</h3>
      <div className={`fg-unit-water fb-${level}`}><div><span>{label('水分胁迫', 'Water stress')}</span><b><i />{waterLabel}</b></div><strong>{u.water.value ?? '—'}<small> / 100</small></strong><p>{label('估计范围', 'Estimated range')} {u.water.range.join('–')}{u.water.provisional && <em>{label('预计影响 · 次日确认', 'Expected impact · Confirm next morning')}</em>}</p></div>
      <div className="fg-unit-status-grid"><div><span>{label('作物状态', 'Crop status')}</span><b className={`fb-status fb-${statusColor(u.cropStatus)}`}><i />{t(u.cropStatus)}</b></div><div><span>{label('灌溉设备', 'Irrigation equipment')}</span><b className={`fb-status fb-${statusColor(u.equipment.status)}`}><i />{t(u.equipment.status)}</b><small>{label('长期可靠性', 'Reliability')} {u.equipment.reliability}%</small></div></div>
      <div className="fg-unit-stage"><span>{label('生长阶段', 'Growth stage')}</span><b>{t(unit.stage.label)}</b></div>
      <div className="fg-unit-evidence-grid"><div><span>{label('水分可信度', 'Water confidence')}</span><b>{u.water.confidence}%</b></div></div><div className="fg-information-age"><h4>{t('Information Freshness')}</h4><p>{t('水分信息更新')}: <b>{age(u.water.freshness, Boolean(u.water.observedAt))}</b></p><p>{t('作物与设备信息更新')}: <b>{age(u.cropFreshness, Boolean(u.latestInspection))}</b></p><small>{t('表示上次获得有效信息的时间，不是作物的生长天数。巡查同时更新两类信息；之后传感器可单独更新水分信息。')}</small></div>
    </section>
    <section className="fg-unit-section"><details data-testid="unit-evidence"><summary>{label('信息依据与观测', 'Evidence and observations')}<span>{unit.observations.length}</span></summary><dl><dt>{label('水分来源', 'Water source')}</dt><dd>{t(u.water.source)}</dd><dt>{label('最新观测', 'Latest observation')}</dt><dd>{u.water.observedAt || '—'}</dd><dt>{label('传感器覆盖', 'Sensor coverage')}</dt><dd>{u.sensors.length}{label(' 个', ' sensors')}</dd></dl>{u.sensors.map(sensor => <p key={sensor.id}>{t(sensor.type)} · {t(sensor.fixed ? 'Fixed' : 'Mobile')} · {t(sensor.status)}</p>)}
      {u.latestInspection && <div className="fg-unit-report"><h4>{label('最新作物与设备巡查', 'Latest crop and equipment inspection')}</h4><small>{u.latestInspection.observedAt} · {Math.round(u.latestInspection.reliability * 100)}%</small><p>{label('作物', 'Crop')}: {t(u.latestInspection.cropCondition)} · {label('设备', 'Equipment')}: {t(u.latestInspection.equipmentCondition)}</p><ul>{u.latestInspection.findings.map((finding, i) => <li key={i}>{t(finding)}</li>)}</ul>{u.latestInspection.equipmentFindings?.map(finding => <p key={finding.part}>{t(finding.part)}: {t(finding.status)}</p>)}</div>}
      <ObservationList key={unit.id} observations={unit.observations} limit={3} /></details></section>
    <section className="fg-unit-section"><h3>{label('待执行任务', 'Pending tasks')}<span>{u.scheduledTasks.length}</span></h3>{u.scheduledTasks.length ? <div className="fg-unit-tasks">{u.scheduledTasks.slice(0, 3).map(task => <button key={task.id} onClick={() => navigate('operations', task.id)}><small>{task.plannedStart} · {label('劳动力', 'Labor')} {task.labor}</small><strong>{t(operationLabel(task))}</strong><Badge status={task.executionStatus} /></button>)}</div> : <p className="fg-muted">{label('暂无待执行任务', 'No pending tasks')}</p>}{u.scheduledTasks.length > 3 && <button className="fg-text-button" onClick={() => navigate('operations')}>{label('查看全部任务', 'View all tasks')} →</button>}</section>
    <section className="fg-unit-section fg-unit-actions"><h3>{label('安排与操作', 'Planning and actions')}</h3><button className="fg-button fg-button--primary fg-full" data-testid="inspect-unit" disabled={!enabled} onClick={() => onPlan([unit.id], 'inspection')}>{label('安排任务 · 今天或未来', 'Plan tasks · Today or later')}<Glyph name="arrow" size={16} /></button><button className="fg-button fg-button--secondary fg-full" disabled={!enabled} onClick={() => onPlan([unit.id], 'irrigation')}>{t('系统灌溉')}</button>{!enabled && <p className="fg-muted">{label('排程已关闭，请在次日早会安排。', 'Scheduling is closed. Plan at the next morning meeting.')}</p>}
      {needsComplexDecision(u) && <details className="fg-unit-delegation"><summary>{label('复杂判断与委派', 'Complex review and delegation')}</summary><p>{label('普通排程不扣注意力；高风险或高不确定性时，可亲自判断或委派。', 'Routine scheduling uses no attention. Review or delegate when risk or uncertainty is high.')}</p><button className="fg-button fg-button--secondary" disabled={!enabled || view.management.resources.attention - view.management.resources.attentionReserved < 1} onClick={() => review('Manager')}>{label('经理判断 · 注意力 −1', 'Manager review · Attention −1')}</button><button className="fg-button fg-button--secondary" disabled={!enabled} onClick={() => review('Team')}>{label('交给团队 · 不消耗注意力', 'Delegate to team · No attention cost')}</button><button data-testid="unit-delegate-ai" className="fg-button fg-button--secondary" disabled={!enabled} onClick={() => review('AI Assistant')}>{label('交给智能助手 · 不消耗注意力', 'Delegate to AI · No attention cost')}</button></details>}
      <button className="fg-text-button fg-unit-knowledge" onClick={() => navigate('knowledge')}>{label('查看作物特性与阶段知识', 'Explore crop traits and growth stages')} →</button>
    </section>
    {!!unit.decisions.length && <section className="fg-unit-section"><details><summary>{label('关联决策', 'Related decisions')}<span>{unit.decisions.length}</span></summary>{unit.decisions.map(decision => <button key={decision.id} className="fg-list-button" onClick={() => navigate('decisions', decision.id)}><span>{t(decision.titleZh || decision.title)}</span><Glyph name="arrow" size={16} /></button>)}</details></section>}
  </aside>;
}

function ReasonFields({ caseId, reasonText, setReasonText, reasonTags, setReasonTags }) {const { t } = useGameLocale();
  return <div className="fg-reasons"><label>{t("决策理由（Optional）")}<textarea rows={2} data-testid={`reason-${caseId}`} placeholder={t("你依据哪些证据？希望控制什么风险？")} value={reasonText} onChange={(event) => setReasonText(event.target.value)} /></label>
    <div className="fg-reason-tags">{t(REASONS.map((reason) => <label key={reason.id}><input type="checkbox" checked={reasonTags.includes(reason.id)} onChange={(event) => setReasonTags(event.target.checked ? [...reasonTags, reason.id] : reasonTags.filter((id) => id !== reason.id))} />{t(reason.label)}</label>))}</div>
  </div>;
}

function DecisionCard({ decision, view, run, focused, openPurchase, controller }) {const { t } = useGameLocale();
  const [reasonText, setReasonText] = useState('');
  const [reasonTags, setReasonTags] = useState(['evidence']);
  const options = [...decision.actionOptions, ...decision.investigationOptions].filter((option, index, all) => option.id && option.type !== 'custom' && (option.operation || ['delay', 'no_action'].includes(option.type)) && all.findIndex((item) => item.id === option.id) === index);
  const [selectedOptionId, setSelectedOptionId] = useState(options[0]?.id || '');
  const [plannedStart, setPlannedStart] = useState(view.currentDate);
  const [crewId, setCrewId] = useState('');
  const [delegateId, setDelegateId] = useState(view.people?.find((person) => person.role === 'agronomist')?.id || 'agronomist');
  const [nextReviewAt, setNextReviewAt] = useState(nextDate(view.currentDate));
  const option = options.find((item) => item.id === selectedOptionId);
  const actionable = ['open', 'delayed'].includes(decision.status) && !view.ended && view.management.phase === 'morning';
  const managerEntered = view.management.caseSessions.includes(`${view.currentDate}:${decision.id}`);
  const aiProposal = decision.delegatedTo === view.people.find((p) => p.role === 'sentinel_agent')?.id;
  const proposal = decision.delegationProposal;
  const awaitingApproval = decision.status === 'awaiting_approval' && proposal && view.management.phase === 'morning';
  const evidence = view.observations.filter((observation) => decision.availableObservationIds.includes(observation.id));
  const endDate = view.management.endDate;
  const people = view.people || [];
  const crews = view.resources.filter((resource) => resource.type === 'crew' && (!option?.operation || resource.compatibleOperations?.includes(option.operation.type)));
  const optionPreview = option?.operation ? controller.previewOperation(option.operation, plannedStart, crewId) : null;
  const proposalPreview = proposal?.operation ? controller.previewOperation(proposal.operation, aiProposal ? view.currentDate : plannedStart, aiProposal ? '' : crewId) : null;
  const selection = { type: option?.type, optionId: option?.id, plannedStart, reasonText, reasonTags,
    ...(crewId ? { crewId } : {}), ...(option?.type === 'delegate' ? { delegatedTo: delegateId } : {}), ...(option?.type === 'delay' ? { nextReviewAt } : {}) };
  const optionLabel = (choice) => choice.labelZh || choice.label || { decide_now: `${operationLabel(choice.operation)} · ${number(choice.operation?.plannedDurationDays, 2)} 人员日`, gather_information: '先调查，再判断', delegate: '请下属提出方案', delay: '延后复查', no_action: '暂不采取行动' }[choice.type] || choice.id;
  return <article className={`fg-panel fg-decision ${focused ? 'fg-decision--focused' : ''}`} data-testid={`case-${decision.id}`} data-case-status={decision.status} id={`case-${decision.id}`}>
    <div className="fg-panel-heading"><div><span className="fg-eyebrow">{t(decision.productionUnitIds.join(' · '))}{t(" / ")}{t(decision.category)}</span><h2>{t(decision.titleZh || decision.title)}</h2></div><Badge status={decision.status} /></div>
    <div className="fg-case-meta"><span><Glyph name="calendar" size={14} />{t(decision.deadline ? `截止 ${decision.deadline}` : '无固定截止日期')}</span><span>{t("关注：")}{t(decision.impactAreas.map((area) => ({ water: '水资源', quality: '品质', labor: '人员', equipment: '设备', yield: '产量' })[area] || area).join('、') || '农场运营')}</span>{t(decision.overdue && <Badge status="blocked">{t("已过原定期限")}</Badge>)}</div>
    {t(decision.descriptionZh || decision.description ? <p className="fg-case-description">{t(decision.descriptionZh || decision.description)}</p> : null)}
    {t(!!decision.disagreementTopics.length && <div className="fg-notice"><Glyph name="branch" size={18} /><div><strong>{t("证据与观点存在差异")}</strong><p>{t(decision.disagreementTopicsZh?.join('；') || decision.disagreementTopics.join('；'))}</p></div></div>)}
    {t(!!decision.viewpoints.length && <div className="fg-viewpoints">{t(decision.viewpoints.slice(0, 4).map((point, index) => <div key={`${point.actorId}:${point.subject}:${index}`}><span>{t(personLabel(people.find((person) => person.id === point.actorId)))}</span><strong>{t(VARIABLE[point.subject] || point.subject)}{t(": ")}{t((point.subject === 'waterStress' ? `${Math.round(point.estimate * 100)} / 100` : number(point.estimate, 2)))}</strong><small>{t("基于已送达证据 · 置信度 ")}{t(number((point.confidence ?? 0) * 100))}{t("%")}</small><p>{t(decision.participantGuidance?.find((guide) => guide.actorId === point.actorId)?.text)}</p></div>))}</div>)}
    <details className="fg-evidence"><summary>{t("查看决策证据 ")}<span>{t(evidence.length)}{t(" 条已送达观测")}</span></summary><ObservationList observations={evidence} limit={8} /></details>
    {t(decision.status === 'delegated' && <div className="fg-notice" data-testid={`proposal-pending-${decision.id}`}><Glyph name="clock" size={18} /><div><strong>{t(personLabel(people.find((person) => person.id === decision.delegatedTo)))}{t("正在准备建议")}</strong><p>{t("预计汇报 ")}{t(decision.proposalDueAt || '待确认')}{t("。建议送达并获你批准后，才会安排执行。")}</p></div></div>)}
    {t(awaitingApproval && <form className="fg-proposal" data-testid={`proposal-${decision.id}`} onSubmit={(event) => {event.preventDefault();run('approve', decision.id, { ...(aiProposal ? {} : { plannedStart, reasonText, reasonTags, ...(crewId ? { crewId } : {}) }) });}}>
      <span className="fg-eyebrow">{t("下属建议 · 规则生成")}</span><h3>{t(personLabel(people.find((person) => person.id === proposal.actorId)))}{t("的建议已送达")}</h3><p>{t(proposal.reasonText)}</p>
      <div className="fg-proposal-plan"><strong>{t(proposal.operation ? operationLabel(proposal.operation) : '采取建议行动')}</strong><span>{t("引用 ")}{t(proposal.evidenceIds?.length || 0)}{t(" 条当时可用证据")}</span></div>
      {t(!aiProposal && <label>{t("批准后的计划日期")}<input type="date" data-testid={`plan-date-${decision.id}`} min={view.currentDate} max={endDate} value={plannedStart} onChange={(event) => setPlannedStart(event.target.value)} required /></label>)}
      {t(!aiProposal && <ReasonFields caseId={decision.id} reasonText={reasonText} setReasonText={setReasonText} reasonTags={reasonTags} setReasonTags={setReasonTags} />)}
      <AuthoredQuote preview={proposalPreview} view={view} openPurchase={openPurchase} /><p className="fg-muted">{t("Accept 不消耗 Manager Attention，资源容量仍需校验。")}</p><div className="fg-form-actions"><button className="fg-button fg-button--primary" type="submit" data-testid={`approve-${decision.id}`} disabled={view.ended || proposalPreview && !proposalPreview.accepted}>{t("Accept · 批准并排程")}</button><button className="fg-button fg-button--secondary" type="button" data-testid={`reject-${decision.id}`} disabled={view.ended} onClick={() => run('reject', decision.id, { reasonText, reasonTags })}>{t("Reject · 拒绝")}</button></div>
    </form>)}
    {t(actionable && <div className="fb-actions"><button className="fg-button fg-button--secondary" data-testid={`manager-enter-${decision.id}`} disabled={managerEntered || view.management.resources.attention - view.management.resources.attentionReserved < 1} onClick={() => run('enterDecisionCase', decision.id)}>{t(managerEntered ? '已进入经理判断' : '经理复杂判断 · Attention −1')}</button><button className="fg-button fg-button--secondary" data-testid={`team-delegate-${decision.id}`} onClick={() => run('decide', decision.id, { type: 'delegate', delegatedTo: people.find((p) => p.role === 'agronomist')?.id || people.find((p) => p.id !== view.actorId).id })}>{t("Delegate to Team · 免费")}</button><button className="fg-button fg-button--secondary" data-testid={`ai-delegate-${decision.id}`} onClick={() => run('decide', decision.id, { type: 'delegate', delegatedTo: people.find((p) => p.role === 'sentinel_agent')?.id })}>{t("Delegate to AI Assistant · 免费")}</button></div>)}
    {t(actionable && <form className="fg-decision-form" onSubmit={(event) => {event.preventDefault();run('decide', decision.id, selection);}}>
      <h3>{t("你的下一步")}</h3><div className="fg-action-options">{t(options.map((choice) => <button type="button" key={choice.id} data-testid={choice.type === 'delegate' ? `delegate-${decision.id}` : `action-${choice.id}`} className={`fg-action-choice ${choice.id === selectedOptionId ? 'is-selected' : ''}`} onClick={() => {setSelectedOptionId(choice.id);setCrewId('');}}><Glyph name={choice.type === 'delegate' ? 'people' : choice.type === 'delay' ? 'clock' : choice.type === 'no_action' ? 'check' : 'leaf'} size={17} />{t(optionLabel(choice))}</button>))}</div>
      {t(option?.operation && <div className="fg-plan-fields"><label>{t("计划日期")}<input type="date" data-testid={`plan-date-${decision.id}`} min={view.currentDate} max={endDate} value={plannedStart} onChange={(event) => setPlannedStart(event.target.value)} required /></label>{t(option.operation.assignedResourceIds.some((id) => view.resources.find((resource) => resource.id === id)?.type === 'crew') && <label>{t("执行班组")}<select data-testid={`crew-${decision.id}`} value={crewId} onChange={(event) => setCrewId(event.target.value)}><option value="">{t("使用方案默认人员")}</option>{t(crews.map((crew) => <option key={crew.id} value={crew.id}>{t(resourceLabel(crew))}</option>))}</select></label>)}</div>)}
      {option?.operation && <AuthoredQuote preview={optionPreview} view={view} openPurchase={openPurchase} />}{t(option?.operation && <p className="fg-muted">{t("计划占用 ")}{t(number(option.operation.plannedDurationDays, 2))}{t(" 人员日")}{t(option.operation.plannedOutput?.water ? ` · 水 ${number(option.operation.plannedOutput.water)} m³` : '')}{t("。资源容量与库存将在确认时校验。")}</p>)}
      {t(option && <p className="fg-muted">{t(option.description)}{t(option.estimatedCost != null ? ` 预计作业费用 ${money(option.estimatedCost)}。` : '')}{t("普通排程 Attention 0；复杂判断在进入时消耗 1。")}</p>)}
      {t(!!decision.opportunityCosts.length && <div className="fg-notice"><div><strong>{t("机会成本")}</strong>{t(decision.opportunityCosts.map((cost, index) => <p key={index}>{t(cost.label)}</p>))}</div></div>)}
      {t(option?.type === 'delegate' && <label>{t("汇报对象")}<select data-testid={`delegate-person-${decision.id}`} value={delegateId} onChange={(event) => setDelegateId(event.target.value)}>{t(people.filter((person) => person.id !== view.actorId).map((person) => <option key={person.id} value={person.id}>{t(personLabel(person))}</option>))}</select><small>{t("下属依据自己掌握的证据提出方案，未经你批准不会执行。")}</small></label>)}
      {t(option?.type === 'delay' && <label>{t("复查日期")}<input type="date" data-testid={`review-date-${decision.id}`} min={nextDate(view.currentDate)} max={endDate} value={nextReviewAt} onChange={(event) => setNextReviewAt(event.target.value)} required /></label>)}
      <ReasonFields caseId={decision.id} reasonText={reasonText} setReasonText={setReasonText} reasonTags={reasonTags} setReasonTags={setReasonTags} />
      <div className="fg-form-actions"><span className="fg-muted">{t("排程免费 · Manager Decision Reason Optional")}</span><button className="fg-button fg-button--primary" type="submit" data-testid={`submit-case-${decision.id}`} disabled={!option || option.type === 'decide_now' && !managerEntered || optionPreview && !optionPreview.accepted}>{t("确认")}{t(option?.type === 'delegate' ? '委派' : '选择')}</button></div>
    </form>)}
    {t(!actionable && !awaitingApproval && decision.selectedAction && <div className="fg-decision-record"><strong>{t("已记录的选择")}</strong><p>{decision.playerReasonText || t('未填写理由')}</p>{t(decision.nextReviewAt && <small>{t("复查日期：")}{t(decision.nextReviewAt)}</small>)}{t(!!decision.resultingOperationIds.length && <small>{t("关联作业：")}{t(decision.resultingOperationIds.join('、'))}</small>)}</div>)}
  </article>;
}

function OperationCard({ operation, view, run }) {const { t } = useGameLocale();
  const [plannedStart, setPlannedStart] = useState(operation.plannedStart > view.currentDate ? operation.plannedStart : view.currentDate);
  const [showForm, setShowForm] = useState(false);
  const canReschedule = ['scheduled', 'blocked'].includes(operation.executionStatus) && !view.ended && view.management.phase === 'morning';
  const endDate = view.management.endDate;
  return <article className="fg-panel fg-operation" id={`operation-${operation.id}`} data-testid={`operation-${operation.id}`} data-operation-id={operation.id} data-status={operation.executionStatus} data-planned-date={operation.plannedStart}>
    <div className="fg-panel-heading"><div><span className="fg-eyebrow">{t(operation.id)}{t(" · ")}{t(operation.productionUnitIds.join(' / '))}</span><h2>{t(operationLabel(operation))}</h2></div><Badge status={operation.executionStatus} /></div>
    <div className="fg-op-comparison"><div><span>{t("计划")}</span><strong>{t(operation.plannedStart)}</strong><p>{t(number(operation.plannedDurationDays, 2))}{t(" 日 · ")}{t(Object.entries(operation.plannedOutput).map(([key, value]) => `${key === 'water' ? '水' : key === 'samples' ? '样本' : key} ${number(value, 2)}`).join(' / ') || '—')}</p></div><Glyph name="arrow" /><div><span>{t("实际")}</span><strong>{t(operation.actualStart || '等待执行')}</strong><p>{t(operation.actualDurationDays != null ? `${number(operation.actualDurationDays, 2)} 日` : '—')}{t(" · ")}{t(Object.entries(operation.actualOutput || {}).map(([key, value]) => `${key === 'water' ? '水' : key === 'samples' ? '样本' : key} ${number(value, 2)}`).join(' / ') || '尚无产出')}</p></div></div>
    <div className="fb-actions"><b>{t('Labor')} {operation.labor} · {t('Attention')} {operation.attention} · {t('水需求')} {operation.water} {t('m³')} · {t('预计作业费用')} ¥{(operation.expectedCost || 0).toFixed(2)}</b></div><div className="fg-op-resources">{t(operation.assignedResourceIds.map((id) => <span key={id}>{t(resourceLabel(view.resources.find((resource) => resource.id === id) || { id }))}</span>))}<span>{t("已发生费用 ")}{t(money(operation.cost || 0))}</span></div>
    {t(!!operation.deviations.length && <div className="fg-op-deviations">{t(operation.deviations.map((deviation, index) => <p key={index}><Badge status={['delay', 'attendance_delay', 'resource_conflict', 'resource_unavailable'].includes(deviation.type) ? 'blocked' : 'neutral'}>{t({ productivity: '产能偏差', delay: '执行延迟', attendance_delay: '执行延迟', manual_reschedule: '手动改期', resource_unavailable: '资源不可用', resource_conflict: '资源冲突', availability: '可用性变化' }[deviation.type] || deviation.type)}</Badge><span>{t(deviation.message || deviation.reason || (deviation.resourceIds ? `${deviation.date} · ${deviation.resourceIds.map((id) => resourceLabel(view.resources.find((resource) => resource.id === id))).join('、')}` : deviation.planned != null ? `计划 ${typeof deviation.planned === 'number' ? number(deviation.planned, 2) : deviation.planned} → 实际 ${typeof deviation.actual === 'number' ? number(deviation.actual, 2) : deviation.actual}` : ''))}</span></p>))}</div>)}
    <details className="fg-evidence"><summary>{t("移动开销与资源用量")}</summary><p className="fg-muted">{t("额外移动开销 ")}{t(number(operation.travelOverhead, 2))}{t(" 人员日；已计入容量和费用。")}</p>{t(Object.entries(operation.resourceQuantities).map(([id, quantity]) => <p className="fg-muted" key={id}>{t(resourceLabel(view.resources.find((resource) => resource.id === id)))}{t("：")}{t(number(quantity, 2))}</p>))}</details>
    {t(operation.results?.map((r, i) => <p className="fg-muted" key={i}>{t(r.unitId)}{t(" · ")}{t(r.message)}</p>))}{t(canReschedule && <div className="fg-reschedule"><span>{t('当前计划已保留')} · </span><button className="fg-text-button" data-testid={`cancel-${operation.id}`} onClick={() => run('cancelTask', operation.id)}>{t("Cancel · 取消并释放资源")}</button><button className="fg-text-button" data-testid={`reschedule-open-${operation.id}`} onClick={() => setShowForm(!showForm)}><Glyph name="calendar" size={15} />{t("手动改期")}</button>{t(showForm && <form onSubmit={(event) => {event.preventDefault();const result = run('reschedule', operation.id, plannedStart);if (result.accepted) setShowForm(false);}}><label>{t("新计划日期")}<input type="date" data-testid={`reschedule-date-${operation.id}`} value={plannedStart} min={view.currentDate} max={endDate} onChange={(event) => setPlannedStart(event.target.value)} required /></label><button className="fg-button fg-button--secondary" data-testid={`reschedule-${operation.id}`} type="submit">{t("确认改期")}</button></form>)}</div>)}
  </article>;
}

function Today({ view, model, navigate, onPlan }) {
  const { t } = useGameLocale();
  const m = view.management;
  const units = m.units.filter(u => u.water.value === null || u.water.value >= 50 || u.water.freshness >= 3 || u.water.confidence < 60 || u.cropStatus === 'Warning' || u.equipment.status !== 'Normal');
  const pending = view.operations.filter(op => ['scheduled', 'blocked'].includes(op.executionStatus));
  const rows = operations => operations.map(op => <button className="fg-schedule-row fg-full fg-list-button" key={op.id} onClick={() => navigate('operations', op.id)}><span>{op.plannedStart}</span><strong>{t(operationLabel(op))}</strong><span>{op.productionUnitIds.join(' · ')} · {t('Labor')} {op.labor}</span><Badge status={op.executionStatus} /></button>);
  return <div className="fg-today-grid"><section className="fg-panel"><h2>{t('待处理决策')} · {model.openCaseCount}</h2>{model.activeCases.map(d => <button className="fg-priority" key={d.id} onClick={() => navigate('decisions', d.id)}><strong>{t(d.titleZh || d.title)}</strong><Badge status={d.status} /></button>)}{!model.activeCases.length && <p>{t('当前没有待处理决策')}</p>}<p>{t('天气')} {m.weather.temperature}°C · {t('降雨')} {m.weather.rainfall} {t('mm')} · {t('ET')} {m.weather.et} {t('mm')}</p><p>{t('资源与人员')} · {t('Labor')} {m.resources.labor.remaining} · {t('Attention')} {m.resources.attention - m.resources.attentionReserved}</p></section><section className="fg-panel"><h2>{t('风险与信息缺口')} · {units.length}</h2>{units.map(u => <div className="fb-priority-row" key={u.id}><button className="fg-text-button" onClick={() => navigate('map', u.id)}><b>{u.id}</b> · {t('Water Stress')} {u.water.value ?? t('Unknown')} · {t('Confidence')} {u.water.confidence}% · {t('水分信息更新')}: {t(informationAge(u.water.freshness, Boolean(u.water.observedAt)))}</button>{m.phase === 'morning' && !m.ended && <button className="fg-text-button" data-testid={`priority-plan-${u.id}`} onClick={() => onPlan(u.id, u.water.value === null || u.water.confidence < 60 ? 'inspection' : u.equipment.status === 'Fault' ? 'manual_watering' : 'irrigation')}>{t('安排任务')}</button>}</div>)}{!units.length && <p>{t('当前可见信息未显示明显风险，仍需注意信息新鲜度。')}</p>}</section><section className="fg-panel fg-today-schedule"><h2>{t('今天的任务')}</h2>{rows(pending.filter(op => op.plannedStart <= view.currentDate))}{!pending.some(op => op.plannedStart <= view.currentDate) && <p>{t('今天没有安排作业')}</p>}<details><summary>{t('未来任务')} · {pending.filter(op => op.plannedStart > view.currentDate).length}</summary>{rows(pending.filter(op => op.plannedStart > view.currentDate))}</details><details><summary>{t('今天送达的报告')}</summary><ObservationList observations={view.observations.filter(o => o.availableAt.slice(0, 10) === view.currentDate)} /></details></section></div>;
}

function AuthoredQuote({ preview, openPurchase }) {
  const { t } = useGameLocale(); if (!preview) return null;
  const quote = preview.quote, capacity = preview.capacity;
  return <div className="fb-capacity">{quote && <><b>{t('Labor')} {quote.labor} · {t('水需求')} {quote.water} {t('m³')} · {t('预计作业费用')} ¥{quote.cost.toFixed(2)}</b><span>{t('场景完整作业方案：按方案时长计费，与标准任务的作业时长可能不同。')} {quote.staffDays} {t('人员日')} · {quote.unitIds.join(' · ')}</span></>}{capacity && <span>{capacity.date} · {t('Available Labor')} {capacity.remaining} · {t('Water Available')} {capacity.waterRemaining} {t('m³')} · {t('Attention')} {capacity.attentionAvailable - capacity.attentionReserved}</span>}{!preview.accepted && <p className="fb-conflict">{t(preview.message)}</p>}{!preview.accepted && openPurchase && <button className="fg-text-button" onClick={openPurchase}>{t('应急采购水资源')}</button>}</div>;
}

function KnownTimeline({ model, navigate }) {const { t } = useGameLocale();
  return <section className="fg-panel fg-known-timeline" data-testid="known-timeline"><div className="fg-panel-heading"><div><span className="fg-eyebrow">{t("KNOWN PLANS / NEXT 14 DAYS")}</span><h2>{t("已知安排时间线")}</h2></div><small className="fg-muted">{t("只显示已知计划、期限与预期窗口")}</small></div>
    <div className="fg-timeline-nodes">{t(model.timeline.length ? model.timeline.map((node) => <button key={node.id} onClick={() => navigate(node.type === 'operation' ? 'operations' : node.type === 'decision' ? 'decisions' : 'map')}><small>{t(node.date)}</small><strong>{t(node.label)}</strong></button>) : <p className="fg-muted">{t("未来两周暂无已知安排。尚未发生的随机事件与未送达报告不会显示在这里。")}</p>)}</div>
  </section>;
}

function ActionAudit({ action, view }) {const { t } = useGameLocale();
  const evidence = view.observations.filter((observation) => action.evidenceIds?.includes(observation.id));
  const label = { decide_now: '决定行动', gather_information: '调查', delegate: '委派', approve: '批准方案', reject: '拒绝方案',
    delay: '延后复查', no_action: '不采取行动', reschedule: '作业改期', custom: '自定义方案' }[action.type] || action.type;
  return <div className="fg-review-case"><strong>{t(action.date)}{t(" · ")}{t(label)}</strong><p>{action.reasonText || t('未填写文字理由')}</p>
    <small>{t("当时引用 ")}{t(evidence.length)}{t(" 条证据 · 注意力 ")}{t(action.attentionCost)}{t(" · 关联作业 ")}{t(action.operationId || '无')}</small>
    {t(!!action.viewpoints?.length && <details><summary>{t("当时的人员观点")}</summary>{t(action.viewpoints.map((point) => <p key={point.id} className="fg-muted">
      {t(personLabel(view.people.find((person) => person.id === point.actorId)))}{t(" · ")}{t(VARIABLE[point.subject] || point.subject)} {t((point.subject === 'waterStress' ? `${Math.round(point.estimate * 100)} / 100` : number(point.estimate, 2)))}{t(" · 置信度 ")}{t(number(point.confidence * 100))}{t("% ")}
      </p>))}</details>)}
    {t(!!evidence.length && <details><summary>{t("当时已送达的证据")}</summary>{t(evidence.map((observation) => <p key={observation.id} className="fg-muted">
      {t(observation.productionUnitId)}{t(" · ")}{t(VARIABLE[observation.variable] || observation.variable)}{t(" · ")}{t(typeof observation.value === 'number' ? (observation.variable === 'waterStress' ? `${Math.round(observation.value * 100)} / 100` : number(observation.value, 2)) : STAGE_LABEL[observation.value] || observation.value)}
      {t(' ')}{t("· ")}{t(SOURCE[observation.sourceType] || observation.sourceType)}{t(" · 观测 ")}{t(observation.observedAt)}{t(" / 送达 ")}{t(observation.availableAt)}
    </p>))}</details>)}
  </div>;
}

function Review({ view, model }) {const { t } = useGameLocale();
  return <section className="fg-review" data-testid="review"><div className="fg-review-banner"><Glyph name="leaf" size={35} /><div><span className="fg-eyebrow">{t("SEASON REVIEW")}</span><h2>{t("这一轮经营已经结束")}</h2><p>{t(view.currentDate)}{t(" · ")}{t(model.elapsedDays)}{t(" 天 · Seed ")}{view.randomSeed}</p></div></div>
    <div className="fg-review-dimensions">{t(model.review.dimensions.map((dimension) => <article className="fg-panel" key={dimension.id} data-testid={`review-${dimension.id}`}>
      <h3>{t(dimension.label)}</h3><p>{t(dimension.summary)}</p><dl className="fg-finance">{t(dimension.metrics.map((metric) => <div key={metric.label}><dt>{t(metric.label)}</dt><dd>{t(metric.value)}</dd></div>))}</dl>
    </article>))}</div>
    <section className="fg-panel"><div className="fg-panel-heading"><h2>{t("决策与理由回顾")}</h2><span className="fg-muted">{t(view.decisionCases.length)}{t(" 个节点")}</span></div>{t(view.decisionCases.map((decision) => <article className="fg-review-case" key={decision.id}><div><strong>{t(decision.titleZh || decision.title)}</strong><Badge status={decision.status} /></div><p>{decision.playerReasonText || t('理由可选，未填写')}</p><small>{t("引用 ")}{t(decision.availableObservationIds.length)}{t(" 条可用证据 · 作业 ")}{t(decision.resultingOperationIds.join('、') || '无')}{t(" · 已记录后果 ")}{t(decision.outcomeIds.length)}{t(" 项")}</small>
      {t(!!decision.actionHistory?.length && <details><summary>{t("展开行动审计记录")}</summary>{t(decision.actionHistory.map((action, index) => <ActionAudit key={index} action={action} view={view} />))}</details>)}</article>))}
    <p className="fg-footnote">{t("本场景使用示例训练参数；复盘展示证据、选择和实际结果，不评定唯一“正确答案”。")}</p></section>
  </section>;
}

function Management({ view, model, run, storageStatus, openPurchase, openRestart }) {const { t } = useGameLocale();
  const resources = view.resources;
  return <div className="fg-management">{t(view.ended && <Review view={view} model={model} />)}
    <div className="fg-management-grid"><section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">{t("RESOURCES")}</span><h2>{t("资源与人员")}</h2></div></div><div className="fg-resource-list">{t(resources.map((resource) => <div className="fg-resource-row" key={resource.id}><Glyph name={resource.type === 'water' ? 'drop' : ['crew', 'person'].includes(resource.type) ? 'people' : 'calendar'} size={20} /><div><strong>{t(resourceLabel(resource))}</strong><small>{t(['crew', 'person', 'machine', 'robot'].includes(resource.type) ? `每日容量 ${number(resource.capacityPerDay, 2)} · 今日可用比例 ${number((resource.availability?.[view.currentDate] ?? 1) * 100)}%` : '库存资源')}</small></div><b>{t(['crew', 'person', 'machine', 'robot'].includes(resource.type) ? `${number(resource.capacityPerDay * (resource.availability?.[view.currentDate] ?? 1), 2)} 日` : `${number(resource.quantity, 1)} ${resource.unit === 'm3' ? 'm³' : resource.unit}`)}</b></div>))}</div><button className="fg-button fg-button--secondary" data-testid="purchase-water" disabled={view.ended || view.management.phase !== 'morning'} onClick={openPurchase}><Glyph name="drop" size={16} />{t("应急采购水资源")}</button></section>
      <section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">{t("FINANCIAL POSITION")}</span><h2>{t("经营账目")}</h2></div></div><dl className="fg-finance"><div><dt>{t("可用现金")}</dt><dd>{t(money(view.finance.cash))}</dd></div><div><dt>{t("已发生经营成本（含采购）")}</dt><dd>{t(money(view.finance.operatingCostToDate))}</dd></div><div><dt>{t("预计收入")}</dt><dd>{t(money(view.finance.forecastRevenue))}</dd></div></dl><p className="fg-muted">{t("预计收入是基于可用证据的估计，尚未形成销售到账，不等于实际利润。")}</p><details className="fg-evidence"><summary>{t("查看资金流水")}<span>{t(view.finance.transactions.length)}{t(" 笔")}</span></summary><div className="fg-ledger">{t(view.finance.transactions.map((transaction) => <div key={transaction.id}><span>{t(transaction.date)}</span><span>{t(transaction.type === 'operating_cost' ? '作业费用' : transaction.type === 'emergency_purchase' ? '应急采购' : transaction.type)}</span><strong>{t(money(transaction.amount))}</strong></div>))}</div></details></section>
      <section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">{t("TEAM")}</span><h2>{t("你的农场团队")}</h2></div></div>{t(view.people?.filter((person) => person.id !== view.actorId).map((person) => <div className="fg-team-member" key={person.id}><span className="fg-avatar">{t(personLabel(person)).slice(0, 1)}</span><div><strong>{t(personLabel(person))}</strong><small>{t(person.role === 'sentinel_agent' ? '本地规则分析 · 依据可用证据提出建议' : '可委派分析 · 方案需经理批准')}</small></div></div>))}</section>
      <section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">{t("THIS PLAYTHROUGH")}</span><h2>{t("本轮与存档")}</h2></div></div><dl className="fg-finance"><div><dt>{t("Seed")}</dt><dd className="fg-seed">{String(view.randomSeed)}</dd></div><div><dt>{t("模拟时长")}</dt><dd>{t(model.totalDays)}{t(" 天")}</dd></div><div><dt>{t("本地存档")}</dt><dd>{t(storageStatus.state === 'saved' ? '自动保存已开启' : storageStatus.message)}</dd></div></dl><p className="fg-muted">{t("刷新浏览器会继续本机进度。相同 seed 配合相同的有序选择，可重复同一轮结果。")}</p><button className="fg-button fg-button--secondary" onClick={openRestart}><Glyph name="reset" size={16} />{t("重新开始")}</button><p className="fg-footnote">{t("本阶段固定扮演农场经理。存档保存在此浏览器，清除网站数据会移除存档。")}</p></section></div>
    {t(!view.ended && <button className="fg-text-button fg-return-map" onClick={() => run('executeDay')}>{t("推进到下一阶段")}<Glyph name="arrow" size={16} /></button>)}
  </div>;
}

function PurchaseDialog({ view, model, run, close }) {const { t } = useGameLocale();
  const [quantity, setQuantity] = useState(100);
  const [requestId] = useState(() => `ui-purchase:${view.currentDate}:${view.finance.emergencyPurchases.length + 1}`);
  const supply = model.criticalResources.find((resource) => resource.type === 'water')?.purchase;
  const price = supply?.unitPrice ?? 0;
  return <div className="fg-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="purchase-title" className="fg-modal"><span className="fg-eyebrow">{t("EMERGENCY SUPPLY")}</span><h2 id="purchase-title">{t("确认应急采购水资源")}</h2><p>{t("确认后将扣除现金并增加蓄水池库存。采购需要有足够现金，不会自动透支。")}</p><form onSubmit={(event) => {event.preventDefault();const result = run('purchase', supply.resourceId, Number(quantity), requestId);if (result.accepted) close();}}><label>{t("采购数量（m³）")}<input type="number" data-testid="purchase-quantity" min="1" max={supply?.maxQuantity || 1} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><div className="fg-confirm-summary"><span>{t("可用现金 ")}{t(money(view.finance.cash))}{t(" · 单价 ")}{t(money(price))}{t(" / m³")}</span><strong>{t("预计扣款 ")}{t(money(Number(quantity) * price))}</strong></div><div className="fg-form-actions"><button type="button" className="fg-button fg-button--secondary" onClick={close}>{t("取消")}</button><button type="submit" className="fg-button fg-button--primary" data-testid="purchase-confirm" disabled={!supply}>{t("确认采购并付款")}</button></div></form></section></div>;
}

function RestartDialog({ view, model, run, close }) {const { t } = useGameLocale();
  const [mode, setMode] = useState('same');
  const [seed, setSeed] = useState(`${view.randomSeed}-next`);
  const [days, setDays] = useState(model.totalDays);
  return <div className="fg-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="restart-title" className="fg-modal"><span className="fg-eyebrow">{t("NEW PLAYTHROUGH")}</span><h2 id="restart-title">{t("重新开始这一轮")}</h2><p>{t("确认后会替换当前本地存档。当前轮次的决策与作业将从初始状态重建。")}</p><form onSubmit={(event) => {event.preventDefault();const result = run('restart', { seed: mode === 'same' ? view.randomSeed : seed.trim(), days: Number(days) });if (result.accepted) close();}}><div className="fg-action-options"><button type="button" className={`fg-action-choice ${mode === 'same' ? 'is-selected' : ''}`} data-testid="restart-same" onClick={() => setMode('same')}>{t("相同 seed")}</button><button type="button" className={`fg-action-choice ${mode === 'new' ? 'is-selected' : ''}`} data-testid="restart-new" onClick={() => setMode('new')}>{t("指定新 seed")}</button></div>{t(mode === 'new' && <label>{t("新的 seed")}<input data-testid="restart-seed" value={seed} onChange={(event) => setSeed(event.target.value)} required maxLength={100} /></label>)}<label>{t("模拟时长（天）")}<input type="number" data-testid="restart-days" min="7" max="120" value={days} onChange={(event) => setDays(event.target.value)} required /></label><div className="fg-form-actions"><button type="button" className="fg-button fg-button--secondary" onClick={close}>{t("保留当前进度")}</button><button type="submit" className="fg-button fg-button--primary" data-testid="restart-confirm">{t("确认重新开始")}</button></div></form></section></div>;
}

function Recovery({ controller, storageStatus }) {const { t, locale } = useGameLocale();
  const [confirmed, setConfirmed] = useState(false);
  return <div className="farm-game fg-recovery" lang={locale === "zh" ? "zh-CN" : "en"} data-locale={locale} data-testid="game-root"><LanguageTabs /><section className="fg-panel"><Glyph name="alert" size={32} /><span className="fg-eyebrow">{t("LOCAL SAVE")}</span><h1>{t("暂时无法恢复这份存档")}</h1><p>{t(storageStatus.message || '存档版本不兼容或数据损坏。当前存档仍被保留。')}</p><p>{t("开始新的一轮会替换当前本地存档；你也可以暂时返回原有 Demo。")}</p><label className="fg-confirm-check"><input data-testid="recover-save-confirmation" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{t("我确认替换这份存档并从头开始")}</label><button className="fg-button fg-button--primary" data-testid="recover-save" disabled={!confirmed} onClick={() => controller.resumeFresh()}>{t("确认开始新的一轮")}</button><Link to="/">{t("返回原有 Demo")}</Link></section></div>;
}

function GameContent() {const { t, locale } = useGameLocale();
  const [controller] = useState(() => createGameController({ feedback: true }));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [preferences] = useState(readPreferences);
  const [tab, setTab] = useState(preferences.tab);
  const [selectedUnitId, setSelectedUnitId] = useState(preferences.selectedUnitId);
  const [selectedIds, setSelectedIds] = useState([]);
  const [planning, setPlanning] = useState(null);
  const [focusedOperationId, setFocusedOperationId] = useState('');
  const [focusedCaseId, setFocusedCaseId] = useState('');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [varietyFilter, setVarietyFilter] = useState('all');
  const [overlay, setOverlay] = useState(preferences.overlay);
  const [spatial, setSpatial] = useState(false);
  const [layers, setLayers] = useState(['water', 'crop', 'freshness', 'equipment']);
  const [operationUnitFilter, setOperationUnitFilter] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const { view, model, storageStatus } = snapshot;
  useEffect(() => {
    if (!view) return;
    try {localStorage.setItem(UI_KEY, JSON.stringify({ tab, selectedUnitId, overlay }));}
    catch {/* Gameplay remains usable when preference storage is unavailable. */}
  }, [tab, selectedUnitId, overlay, view]);
  useEffect(() => {
    if (notice?.type !== 'error') return;
    const feedback = document.querySelector('[role="dialog"] [role="alert"]') || document.querySelector('[data-testid="game-error"]');
    feedback?.scrollIntoView({ block: 'center' });
    feedback?.focus();
  }, [notice]);
  useEffect(() => {
    window.scrollTo({ top: 0 }); document.querySelector('.fg-main')?.scrollTo({ top: 0 });
    const target = focusedOperationId ? document.getElementById(`operation-${focusedOperationId}`) : focusedCaseId ? document.getElementById(`case-${focusedCaseId}`) || document.getElementById(`decision-${focusedCaseId}`) : null;
    if (target) { for (let parent = target.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; target.scrollIntoView({ block: 'center' }); target.classList.add('fg-focus-target'); }
  }, [tab, focusedCaseId, focusedOperationId]);
  const navigate = (nextTab, objectId = '') => {
    setTab(nextTab); setFocusedCaseId(nextTab === 'decisions' ? objectId : ''); setFocusedOperationId(nextTab === 'operations' ? objectId : '');
    if (nextTab === 'operations' && objectId) setOperationUnitFilter('all');
    if (['map', 'units'].includes(nextTab) && objectId) setSelectedUnitId(objectId);
  };
  const toggleUnit = id => setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const planUnits = (ids, action = 'inspection') => { setPlanning(previous => ({ ids, action, version: (previous?.version || 0) + 1 })); requestAnimationFrame(() => document.getElementById('inline-task-planner')?.scrollIntoView({ block: 'center' })); };

  const run = (method, ...args) => {
    try {
      const result = controller[method](...args) || { accepted: true, conflicts: [] };
      if (!result.accepted) {
        const conflicts = (result.conflicts || []).map((conflict) => conflict.message || conflict.reason || `${conflict.resourceId || '资源'}：${conflict.type || '容量或库存不足'}`).join('；');
        setNotice({ type: 'error', text: result.error || conflicts || snapshot.error || '这项操作未被接受，请检查计划与资源。' });
      } else {
        setNotice({ type: 'success', text: method === 'executeDay' ? '已推进到下一阶段，报告与作业状态已更新。' : method === 'restart' ? '新的一轮已开始。' : '操作已记录。' });
        if (method === 'executeDay') navigate('today');
        if (method === 'restart') {setTab('today');setSelectedUnitId('');setSelectedIds([]);setPlanning(null);setFocusedCaseId('');setClusterFilter('all');setVarietyFilter('all');setOperationUnitFilter('all');}
      }
      return result;
    } catch (error) {setNotice({ type: 'error', text: error.message });return { accepted: false, error: error.message };}
  };
  if (!view || !model) return <Recovery controller={controller} storageStatus={storageStatus || { state: 'blocked' }} />;
  const currentTab = TABS.find((item) => item.id === tab);
  const water = view.resources.find((resource) => resource.id === 'water');
  const criticalResource = model.criticalResources[0] || water;
  const attention = view.attention || model.attention || {};
  const filteredUnits = model.units.filter((unit) => (clusterFilter === 'all' || unit.clusterId === clusterFilter) && (varietyFilter === 'all' || unit.varietyId === varietyFilter));
  const selectedUnit = filteredUnits.find(unit => unit.id === selectedUnitId) || filteredUnits[0];
  const clusterOptions = [...new Set(model.units.map((unit) => unit.clusterId))];
  const varietyOptions = [...new Map(model.units.map((unit) => [unit.varietyId, unit.varietyName])).entries()];
  return <div className="farm-game" lang={locale === "zh" ? "zh-CN" : "en"} data-locale={locale} data-testid="game-root" data-phase={view.management.phase} data-day-index={model.elapsedDays} data-seed={String(view.randomSeed)}>
    <aside className="fg-sidebar"><Link className="fg-brand" to="/game"><span className="fg-brand-mark"><Glyph name="leaf" size={27} /></span><div><strong>{t("SENTINEL")}</strong><span>{t("FARM MANAGER")}</span></div></Link><div className="fg-play-label"><span className="fg-dot" />{t(model.scenarioName)}</div>
      <nav aria-label={t("农场试玩导航")}>{t(TABS.map((item) => <button key={item.id} data-testid={`tab-${item.id}`} aria-label={t(item.label)} className={`fg-nav-item ${tab === item.id ? 'is-active' : ''}`} aria-current={tab === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Glyph name={item.icon} /><span>{t(item.label)}<small>{t(item.subtitle)}</small></span>{t(item.id === 'decisions' && model.openCaseCount > 0 && <b>{t(model.openCaseCount)}</b>)}</button>))}</nav>
      <div className="fg-sidebar-bottom"><div className="fg-manager"><span className="fg-avatar">{t("农")}</span><div><strong>{t("农场经理")}</strong><small>{t("你来决定下一步")}</small></div></div><Link className="fg-demo-link" to="/">{t("返回原有 Demo")}<Glyph name="arrow" size={15} /></Link><p>{t("观察 · 决策 · 执行 · 复盘")}</p></div>
    </aside>
    <div className="fg-workspace"><header className="fg-topbar"><div className="fg-breadcrumb">{t("农场经营 ")}<span>{t("/")}</span> {t(currentTab.label)}</div><div className="fg-topbar-tools"><LanguageTabs /><span className={`fg-save-status fg-save-status--${storageStatus.state}`} data-testid="save-status" title={t(storageStatus.message)}><Glyph name={storageStatus.state === 'saved' ? 'check' : 'alert'} size={14} />{t(storageStatus.state === 'saved' ? '进度已保存' : storageStatus.state === 'memory' ? '仅本次会话保存' : '存档需要关注')}</span><button className="fg-icon-button" aria-label={t("重新开始")} data-testid="restart-open" onClick={() => setDialog('restart')}><Glyph name="reset" size={18} /></button><span className="fg-topbar-avatar">{t("FM")}</span></div></header>
      <main className="fg-main"><section className="fg-page-heading"><div><span className="fg-eyebrow">{t("YUNNAN BLUEBERRY / TRAINING SCENARIO")}</span><h1>{t(currentTab.label)}<span>{t(tab === 'map' ? '看见农场，做出有依据的选择。' : '每一步选择，都留下可以追溯的记录。')}</span></h1></div><div className="fg-time-control"><div className="fg-date"><Glyph name="calendar" size={19} /><div><strong data-testid="game-date">{t(view.currentDate)}</strong><small>{t("第 ")}{t(model.elapsedDays)}{t(" / ")}{t(model.totalDays)}{t(" 天")}{t(view.ended ? ' · 已结束' : '')}</small></div></div><button className="fg-button fg-button--primary" data-testid="advance-day" disabled={view.ended} onClick={() => run('executeDay')}>{t(view.ended ? '本轮已结束' : { morning: '开始 Execution', execution: '进入 End of Day', end_of_day: 'Next Morning' }[view.management.phase])}<Glyph name="arrow" size={17} /></button></div></section>
      {t(!view.management.onboarded && <Onboarding run={run} />)}<div className="fg-phase-strip">{t("Morning Meeting → Execution → End of Day → Next Morning · 当前 ")}<b>{t(view.management.phase)}</b></div><div className="fg-season-progress" aria-label={t(`已完成 ${model.elapsedDays} / ${model.totalDays} 天`)}><span style={{ width: `${Math.min(100, model.elapsedDays / model.totalDays * 100)}%` }} /></div>
      <section className="fg-hud" aria-label={t("经营资源")}><article><span className="fg-stat-icon"><Glyph name="wallet" /></span><div><span>{t("可用现金")}</span><strong data-testid="cash" data-value={view.finance.cash}>{t(money(view.finance.cash))}</strong><small>{t("费用按实际执行记账")}</small></div></article><article><span className="fg-stat-icon"><Glyph name="people" /></span><div><span>{t("今日剩余 Labor")}</span><strong>{t(number(model.laborAvailable, 2))} <em>{t("Labor")}</em></strong><small>{t("日容量不结转")}</small></div></article><article><span className="fg-stat-icon fg-stat-icon--water"><Glyph name="drop" /></span><div><span>{t(criticalResource?.type === 'water' ? '水资源库存' : criticalResource?.name || '关键资源')}</span><strong data-testid="water-inventory" data-value={criticalResource?.quantity}>{t(number(criticalResource?.quantity, 1))} <em>{t(criticalResource?.unit === 'm3' ? 'm³' : criticalResource?.unit)}</em></strong><small>{t("用水与应急采购均可追溯")}</small></div></article><article><span className="fg-stat-icon fg-stat-icon--attention"><Glyph name="clock" /></span><div><span>{t("经理注意力")}</span><strong data-testid="attention-remaining" data-value={attention.remaining}>{t(number(attention.remaining, 2))} <em>{t("/ ")}{t(number(attention.dailyBudget, 2))}</em></strong><small>{t("早会固定 −1 · 普通排程免费")}</small></div></article></section>
      {t((notice || snapshot.error) && <div className={`fg-feedback fg-feedback--${notice?.type || 'error'}`} data-testid={notice?.type === 'success' ? 'game-status' : 'game-error'} tabIndex={-1} role={notice?.type === 'success' ? 'status' : 'alert'}><Glyph name={notice?.type === 'success' ? 'check' : 'alert'} size={17} /><span>{t(notice?.text || snapshot.error)}</span><button onClick={() => {setNotice(null);controller.clearError();}} aria-label={t("关闭提示")}>{t("×")}</button></div>)}
      {t(storageStatus.state !== 'saved' && storageStatus.message && <div className="fg-storage-warning" role="status">{t(storageStatus.message)}</div>)}
      {t(view.ended && tab !== 'management' && <div className="fg-end-banner"><div><strong>{t(model.totalDays)}{t(" 天经营已完成")}</strong><p>{t("查看财务、水资源、作业偏差与决策记录，复盘这一轮。")}</p></div><button className="fg-button fg-button--primary" onClick={() => navigate('management')}>{t("查看经营复盘")}<Glyph name="arrow" size={16} /></button></div>)}
      {t((tab === 'map' || tab === 'units') && <div className="fg-map-layout"><section className="fg-panel fg-map-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">{t(tab === 'map' ? 'FARM OVERVIEW' : 'PRODUCTION UNITS')}</span><h2>{t(tab === 'map' ? '农场全景' : '生产单元总览')}<span className="fg-count">{t(filteredUnits.length)}{t(" 个单元")}</span></h2></div><div className="fg-map-date"><span>{view.currentDate}</span><small>{t("玩家已知信息")}</small></div></div>
        <p className="fb-freshness-help">{t('信息新鲜度＝上次有效信息距今多久。水分信息来自传感器、巡查等；作物与设备信息来自现场观察。')}</p><div className="fb-actions"><button className="fg-button fg-button--secondary" data-testid="view-table" onClick={() => setSpatial(false)}>{t("Table View")}</button><button className="fg-button fg-button--secondary" data-testid="view-spatial" onClick={() => setSpatial(true)}>{t("Spatial View")}</button>{t(spatial && ['water', 'crop', 'freshness', 'equipment'].map((layer) => <label key={layer}><input type="checkbox" checked={layers.includes(layer)} onChange={(e) => setLayers(e.target.checked ? [...layers, layer] : layers.filter((l) => l !== layer))} />{t({ water: 'Water Risk', crop: 'Crop Status', freshness: 'Information Freshness', equipment: 'Irrigation Equipment' }[layer])}</label>))}</div><div className="fg-map-toolbar">{spatial && <div className="fg-layer-toggle" aria-label={t("地图图层")}>{t([{ id: 'water', label: '水分与风险' }, { id: 'tasks', label: '作业与决策' }, { id: 'freshness', label: '信息新鲜度' }].map((layer) => <button key={layer.id} className={overlay === layer.id ? 'is-active' : ''} onClick={() => setOverlay(layer.id)}>{t(layer.label)}</button>))}</div>}<div className="fg-map-filters"><label><span className="fg-sr-only">{t("分区筛选")}</span><select data-testid="cluster-filter" value={clusterFilter} onChange={(event) => {setClusterFilter(event.target.value);setSelectedIds(ids => ids.filter(id => model.units.some(u => u.id === id && (event.target.value === 'all' || u.clusterId === event.target.value) && (varietyFilter === 'all' || u.varietyId === varietyFilter))));setPlanning(null);}}><option value="all">{t("全部分区")}</option>{t(clusterOptions.map((id) => <option key={id} value={id}>{t(id)}</option>))}</select></label><label><span className="fg-sr-only">{t("品种筛选")}</span><select data-testid="variety-filter" value={varietyFilter} onChange={(event) => {setVarietyFilter(event.target.value);setSelectedIds(ids => ids.filter(id => model.units.some(u => u.id === id && (clusterFilter === 'all' || u.clusterId === clusterFilter) && (event.target.value === 'all' || u.varietyId === event.target.value))));setPlanning(null);}}><option value="all">{t("全部品种")}</option>{t(varietyOptions.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>))}</select></label></div></div>
        {t(!spatial ? <FarmStatusTable units={filteredUnits} selectedId={selectedUnit?.id} onSelect={setSelectedUnitId} selectedIds={selectedIds} onToggle={toggleUnit} /> : tab === 'map' ? <FarmMap layers={layers} units={model.units} clusters={model.clusters} selectedUnitId={selectedUnit?.id} onSelect={setSelectedUnitId} selectedIds={selectedIds} onToggle={toggleUnit} overlay={overlay} clusterFilter={clusterFilter} varietyFilter={varietyFilter} /> : <div className="fg-units-grid">{t(filteredUnits.map((unit) => <div className="fg-unit-select-tile" key={unit.id}><label><input type="checkbox" data-testid={`card-select-${unit.id}`} checked={selectedIds.includes(unit.id)} onChange={() => toggleUnit(unit.id)} />{t("选择")} {unit.id}</label><button className={`fg-unit-tile ${unit.id === selectedUnit?.id ? 'is-selected' : ''}`} data-testid={`unit-card-${unit.id}`} onClick={() => setSelectedUnitId(unit.id)}><div><strong>{t(unit.id)}</strong><Badge status={unit.water.status} /></div><span>{t(unit.varietyName)}</span><small>{t(unit.clusterId)}{t(" · ")}{t(number(unit.area.value, 2))} {t(unit.area.unit)}</small><div className="fg-unit-tile-bottom"><span>{t(unit.stage.label)}</span><b>{t(unit.risk.label)}</b></div></button></div>))}</div>)}
        <UnitSelection units={filteredUnits} selectedIds={selectedIds} onToggle={toggleUnit} onClear={() => {setSelectedIds([]);setPlanning(null);}} onPlan={() => planUnits(selectedIds)} enabled={view.management.phase === 'morning' && !view.ended} />
        {planning && <TaskPlanner key={`${view.currentDate}:${planning.ids.join(',')}:${planning.action}:${planning.version}`} management={view.management} controller={controller} run={run} unitIds={planning.ids} initialAction={planning.action} onViewTask={id => navigate('operations', id)} openPurchase={() => setDialog('purchase')} />}
        </section><UnitPanel unit={selectedUnit} view={view} run={run} navigate={navigate} selectedIds={selectedIds} onPlan={planUnits} /></div>)}
      {tab === 'guide' && <GameplayGuide navigate={navigate} />}
      {tab === 'knowledge' && <CropEncyclopedia navigate={navigate} activeCropIds={[...new Set(view.crops.map(crop => crop.cropPackId))]} />}
      {t(tab === 'today' && <><Today view={view} model={model} navigate={navigate} onPlan={(id, action) => {navigate('map', id);planUnits([id], action);}} /><DailyFeedback management={view.management} onSelectUnit={id => navigate('map', id)} onViewTask={id => navigate('operations', id)} /><details className="fg-fold"><summary>{t('Water Stress Trend')}</summary><WaterTrend management={view.management} /></details></>)}
      {tab === 'decisions' && <div className="fg-decisions-list"><div className="fg-section-intro"><h2>{t('今天需要你关注')}</h2><p>{t('不同角色可能基于不同来源形成观点。所有可见证据均已送达，计划仍需经过资源检查。')}</p></div>{view.decisionCases.filter(d => ['open', 'delayed', 'delegated', 'awaiting_approval', 'investigating'].includes(d.status)).toSorted((a, b) => (b.id === focusedCaseId ? 1 : 0) - (a.id === focusedCaseId ? 1 : 0) || b.openedAt.localeCompare(a.openedAt)).map(d => <DecisionCard key={`${d.id}:${view.currentDate}:${d.status}`} decision={d} view={view} run={run} openPurchase={() => setDialog('purchase')} controller={controller} focused={d.id === focusedCaseId} />)}<DecisionHistory management={view.management} run={run} controller={controller} openPurchase={() => setDialog('purchase')} /><details className="fg-fold"><summary>{t('已处理场景决策')}</summary>{view.decisionCases.filter(d => !['open', 'delayed', 'delegated', 'awaiting_approval', 'investigating'].includes(d.status)).map(d => <DecisionCard key={`${d.id}:${view.currentDate}:${d.status}`} decision={d} view={view} run={run} openPurchase={() => setDialog('purchase')} controller={controller} focused={d.id === focusedCaseId} />)}</details></div>}
      {tab === 'operations' && <div className="fg-operations-list">{!view.ended && <TaskPlanner key={view.currentDate} management={view.management} controller={controller} run={run} initialUnitId={selectedUnit?.id} onViewTask={id => navigate('operations', id)} openPurchase={() => setDialog('purchase')} />}<div className="fg-section-intro"><h2>{t('待执行与受阻任务')}</h2><label>{t('按生产单元筛选')}<select data-testid="operation-unit-filter" value={operationUnitFilter} onChange={event => setOperationUnitFilter(event.target.value)}><option value="all">{t('全部生产单元')}</option>{model.units.map(unit => <option key={unit.id} value={unit.id}>{unit.id}</option>)}</select></label></div>{view.operations.filter(op => ['scheduled', 'blocked'].includes(op.executionStatus) && (operationUnitFilter === 'all' || op.productionUnitIds.includes(operationUnitFilter))).toSorted((a, b) => a.plannedStart.localeCompare(b.plannedStart)).map(op => <OperationCard key={`${op.id}:${view.currentDate}:${op.plannedStart}`} operation={op} view={view} run={run} />)}<details className="fg-fold"><summary>{t('日历与传感器')}</summary><Calendars management={view.management} /><SensorDistribution management={view.management} /></details><details className="fg-fold"><summary>{t('已完成与取消的任务')} · {view.operations.filter(op => !['scheduled', 'blocked'].includes(op.executionStatus)).length}</summary>{view.operations.filter(op => !['scheduled', 'blocked'].includes(op.executionStatus) && (operationUnitFilter === 'all' || op.productionUnitIds.includes(operationUnitFilter))).toReversed().map(op => <OperationCard key={`${op.id}:${view.currentDate}`} operation={op} view={view} run={run} />)}</details></div>}
      {t(tab === 'management' && <><Management view={view} model={model} run={run} storageStatus={storageStatus} openPurchase={() => setDialog('purchase')} openRestart={() => setDialog('restart')} /><WaterTrend management={view.management} /><CropGuide units={view.management.units} /><DecisionHistory management={view.management} run={run} /></>)}
      {t(!view.ended && <KnownTimeline model={model} navigate={navigate} />)}
      <footer className="fg-main-footer"><span>{t("Sentinel Farm Simulation · 示例训练场景")}</span><span>{t("依据可见证据决策 · 本地自动保存")}</span></footer>
      </main></div>
    {t(dialog === 'purchase' && <PurchaseDialog view={view} model={model} run={run} close={() => setDialog(null)} />)}{t(dialog === 'restart' && <RestartDialog view={view} model={model} run={run} close={() => setDialog(null)} />)}
  </div>;
}

export default function GameApp() { return <GameLocaleProvider><GameContent /></GameLocaleProvider>; }

function LanguageTabs() { const { t, locale, setLocale } = useGameLocale(); return <div className="fg-language-tabs" role="tablist" aria-label={t("界面语言")}><button type="button" role="tab" data-testid="locale-en" aria-selected={locale === "en"} onClick={() => setLocale("en")}>EN</button><button type="button" role="tab" data-testid="locale-zh" aria-selected={locale === "zh"} onClick={() => setLocale("zh")}>中文</button></div>; }
