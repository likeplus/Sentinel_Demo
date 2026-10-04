import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { createGameController } from './GameController.js';
import FarmMap from './FarmMap.jsx';
import './game.css';

const TABS = [
  { id: 'map', label: '农场地图', subtitle: 'MAP', icon: 'map' },
  { id: 'today', label: '今日工作', subtitle: 'TODAY', icon: 'sun' },
  { id: 'operations', label: '作业排程', subtitle: 'OPERATIONS', icon: 'calendar' },
  { id: 'units', label: '生产单元', subtitle: 'UNITS', icon: 'grid' },
  { id: 'decisions', label: '决策中心', subtitle: 'DECISIONS', icon: 'branch' },
  { id: 'management', label: '经营管理', subtitle: 'MANAGEMENT', icon: 'chart' },
];
const STATUS = { open: '待决策', delayed: '等待复查', delegated: '等待下属汇报', awaiting_approval: '待你批准',
  investigating: '调查中', scheduled: '已排程', completed: '已完成', resolved: '已处理', blocked: '执行受阻',
  cancelled: '已取消', expired: '已过期限', current: '当前有效', stale: '已过期', unknown: '尚无信息', invalid: '无效' };
const SOURCE = { sensor: '传感器', worker: '现场人员', lab: '实验室', inspection: '现场检查', report: '报告', estimate: '估计' };
const VARIABLE = { waterStress: '水分胁迫', growthStage: '生长阶段', stage: '生长阶段', diseasePressure: '病害压力', nutrientStatus: '营养状态' };
const OPERATION = { irrigation: '灌溉', inspection: '现场检查', maintenance: '设备维护', harvest: '采收' };
const ROLE = { farm_manager: '农场经理', agronomist: '农艺师', irrigation_manager: '灌溉主管', field_supervisor: '田间主管',
  maintenance_lead: '维护负责人', sentinel_agent: 'Sentinel 分析助手' };
const REASONS = [{ id: 'evidence', label: '依据现有证据' }, { id: 'risk', label: '控制作物风险' },
  { id: 'resource', label: '考虑资源约束' }, { id: 'uncertainty', label: '仍有信息不确定性' }];
const number = (value, digits = 0) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
const money = value => `¥${number(value, 0)}`;
const nextDate = (date, days = 1) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const personLabel = person => person?.nameZh || ROLE[person?.role] || person?.name || person?.id || '下属';
const operationLabel = operation => OPERATION[operation?.type] || operation?.type || '作业';
const unitLabel = unit => unit?.nameZh || `${unit?.id || ''} 蓝莓生产单元`;
const resourceLabel = resource => ({ water: '蓄水池', 'crew-a': '田间班组 A', 'irrigation-rig': '滴灌设备', 'maintenance-person': '维护人员' }[resource?.id] || resource?.nameZh || resource?.name || resource?.id);
const STAGE_LABEL = { vegetative: '营养生长期', flowering: '开花期', fruit_set: '坐果期', ripening: '转熟期', harvest: '采收期' };
const UI_KEY = 'sentinel:farm-game:ui:v1';
function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    return { tab: TABS.some(item => item.id === saved.tab) ? saved.tab : 'map',
      selectedUnitId: typeof saved.selectedUnitId === 'string' ? saved.selectedUnitId : '',
      overlay: ['water', 'tasks', 'freshness'].includes(saved.overlay) ? saved.overlay : 'water' };
  } catch { return { tab: 'map', selectedUnitId: '', overlay: 'water' }; }
}

function Glyph({ name, size = 20, ...props }) {
  const paths = {
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
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 8h18m-6 5h6m-4 2v.1" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.leaf}</svg>;
}

function Badge({ status, children }) {
  return <span className={`fg-badge fg-badge--${status || 'neutral'}`}>{children || STATUS[status] || status}</span>;
}

function Empty({ title, children, icon = 'leaf' }) {
  return <div className="fg-empty"><Glyph name={icon} size={30} /><strong>{title}</strong><p>{children}</p></div>;
}

function ObservationList({ observations = [], limit = 6 }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = observations.toSorted((a, b) => b.availableAt.localeCompare(a.availableAt) || b.observedAt.localeCompare(a.observedAt));
  const shown = expanded ? sorted : sorted.slice(0, limit);
  if (!shown.length) return <p className="fg-muted fg-observation-empty">还没有送达的观测。你可以安排现场检查。</p>;
  return <div className="fg-observations">{shown.map(observation => (
    <div className="fg-observation" key={observation.id} data-testid={`observation-${observation.id}`}>
      <div><strong>{VARIABLE[observation.variable] || observation.variable}</strong><Badge status={observation.status} /></div>
      <p><span>{SOURCE[observation.sourceType] || observation.sourceType}</span><b>{observation.label || (typeof observation.value === 'number' ? number(observation.value, 2) : STAGE_LABEL[observation.value] || String(observation.value))}{observation.unit && observation.unit !== 'ratio' ? ` ${observation.unit}` : ''}</b></p>
      <small>观测 {observation.observedAt} · 送达 {observation.availableAt} · 可靠度 {number(observation.reliability * 100)}%</small>
    </div>
  ))}{sorted.length > limit && <button className="fg-text-button" onClick={() => setExpanded(!expanded)}>{expanded ? '收起历史观测' : `查看全部 ${sorted.length} 条观测`}</button>}</div>;
}

function InspectionForm({ unit, view, model, run }) {
  const [open, setOpen] = useState(false);
  const [plannedStart, setPlannedStart] = useState(nextDate(view.currentDate));
  const [crewId, setCrewId] = useState(view.resources.find(resource => resource.type === 'crew')?.id || '');
  const [reasonText, setReasonText] = useState('核对生产单元的现场情况，补充可用证据。');
  const crews = view.resources.filter(resource => resource.type === 'crew' && resource.compatibleOperations?.includes('inspection'));
  const endDate = nextDate(model.endDate, -1);
  return <div className="fg-inspection">
    <button className="fg-button fg-button--secondary fg-full" data-testid="inspect-unit" disabled={view.ended} onClick={() => setOpen(!open)}><Glyph name="leaf" size={16} />安排现场检查</button>
    {open && <form className="fg-inline-form" onSubmit={event => { event.preventDefault(); const result = run('inspect', unit.id, { plannedStart, crewId, reasonText }); if (result.accepted) setOpen(false); }}>
      <p className="fg-muted">检查需要人员与经理注意力，报告在作业完成后按汇报时延送达。</p>
      <label>计划日期<input type="date" data-testid="inspect-date" value={plannedStart} min={nextDate(view.currentDate)} max={endDate} onChange={event => setPlannedStart(event.target.value)} required /></label>
      <label>执行人员<select data-testid="inspect-crew" value={crewId} onChange={event => setCrewId(event.target.value)}>{crews.map(crew => <option key={crew.id} value={crew.id}>{resourceLabel(crew)}</option>)}</select></label>
      <label>检查理由<textarea data-testid="inspect-reason" value={reasonText} onChange={event => setReasonText(event.target.value)} rows={2} required /></label>
      <button className="fg-button fg-button--primary" data-testid="inspect-confirm" type="submit">确认安排检查</button>
    </form>}
  </div>;
}

function UnitPanel({ unit, view, model, run, navigate }) {
  if (!unit) return <section className="fg-panel fg-unit-panel"><Empty title="选择一个生产单元">点击地图上的地块，查看你已经获得的信息。</Empty></section>;
  return <aside className="fg-panel fg-unit-panel" data-testid="selected-unit" data-unit-id={unit.id}>
    <div className="fg-panel-heading"><div><span className="fg-eyebrow">PRODUCTION UNIT</span><h2>{unit.id}</h2></div><Badge status={unit.water.status}>{unit.risk.label || '信息不足'}</Badge></div>
    <p className="fg-unit-name">{unitLabel(unit)}</p>
    <div className="fg-unit-meta"><span>{unit.varietyName}</span><span>{unit.clusterId} 分区</span><span>{number(unit.area?.value, 2)} {unit.area?.unit}</span></div>
    <div className="fg-unit-measures"><div><span>已知生长阶段</span><strong>{unit.stage.label}</strong><small>{unit.stage.status === 'unknown' ? '等待阶段报告' : `${unit.stage.observedAt || '—'} · ${unit.stage.source || '阶段报告'}`}</small><Badge status={unit.stage.status} /></div>
      <div><span>水分胁迫</span><strong>{unit.water.label || '未知'}</strong><small>{unit.water.observedAt ? `${unit.water.observedAt} · ${unit.water.source || '观测'}` : '暂无可用证据'}</small><Badge status={unit.water.status} /></div></div>
    <InspectionForm key={`${unit.id}:${view.currentDate}`} unit={unit} view={view} model={model} run={run} />
    {!!unit.decisions.length && <div className="fg-unit-links"><h3>关联决策</h3>{unit.decisions.map(decision => <button key={decision.id} className="fg-list-button" onClick={() => navigate('decisions', decision.id)}><span>{decision.titleZh || decision.title}</span><Glyph name="arrow" size={16} /></button>)}</div>}
    {!!unit.operations.length && <div className="fg-unit-links"><h3>关联作业</h3>{unit.operations.map(operation => <button key={operation.id} className="fg-list-button" onClick={() => navigate('operations')}><span>{operation.id} · {operationLabel(operation)}</span><Badge status={operation.executionStatus} /></button>)}</div>}
    <div className="fg-section-label"><h3>最新已送达观测</h3><span>{unit.observations.length} 条</span></div>
    <ObservationList key={unit.id} observations={unit.observations} limit={4} />
  </aside>;
}

function ReasonFields({ caseId, reasonText, setReasonText, reasonTags, setReasonTags }) {
  return <div className="fg-reasons"><label>决策理由<textarea rows={2} data-testid={`reason-${caseId}`} placeholder="你依据哪些证据？希望控制什么风险？" value={reasonText} onChange={event => setReasonText(event.target.value)} required /></label>
    <div className="fg-reason-tags">{REASONS.map(reason => <label key={reason.id}><input type="checkbox" checked={reasonTags.includes(reason.id)} onChange={event => setReasonTags(event.target.checked ? [...reasonTags, reason.id] : reasonTags.filter(id => id !== reason.id))} />{reason.label}</label>)}</div>
  </div>;
}

function DecisionCard({ decision, view, model, run, focused }) {
  const [reasonText, setReasonText] = useState('');
  const [reasonTags, setReasonTags] = useState(['evidence']);
  const options = [...decision.actionOptions, ...decision.investigationOptions].filter((option, index, all) => option.id && option.type !== 'custom' && (option.operation || ['delegate', 'delay', 'no_action'].includes(option.type)) && all.findIndex(item => item.id === option.id) === index);
  const [selectedOptionId, setSelectedOptionId] = useState(options[0]?.id || '');
  const [plannedStart, setPlannedStart] = useState(nextDate(view.currentDate));
  const [crewId, setCrewId] = useState('');
  const [delegateId, setDelegateId] = useState(view.people?.find(person => person.role === 'agronomist')?.id || 'agronomist');
  const [nextReviewAt, setNextReviewAt] = useState(nextDate(view.currentDate));
  const option = options.find(item => item.id === selectedOptionId);
  const actionable = ['open', 'delayed'].includes(decision.status) && !view.ended;
  const proposal = decision.delegationProposal;
  const awaitingApproval = decision.status === 'awaiting_approval' && proposal;
  const evidence = view.observations.filter(observation => decision.availableObservationIds.includes(observation.id));
  const endDate = nextDate(model.date, model.totalDays - model.elapsedDays);
  const people = view.people || [];
  const crews = view.resources.filter(resource => resource.type === 'crew' && (!option?.operation || resource.compatibleOperations?.includes(option.operation.type)));
  const selection = { type: option?.type, optionId: option?.id, plannedStart, reasonText, reasonTags,
    ...(crewId ? { crewId } : {}), ...(option?.type === 'delegate' ? { delegatedTo: delegateId } : {}), ...(option?.type === 'delay' ? { nextReviewAt } : {}) };
  const optionLabel = choice => choice.labelZh || choice.label || ({ decide_now: `${operationLabel(choice.operation)} · ${number(choice.operation?.plannedDurationDays, 2)} 人员日`, gather_information: '先调查，再判断', delegate: '请下属提出方案', delay: '延后复查', no_action: '暂不采取行动' }[choice.type] || choice.id);
  return <article className={`fg-panel fg-decision ${focused ? 'fg-decision--focused' : ''}`} data-testid={`case-${decision.id}`} data-case-status={decision.status} id={`case-${decision.id}`}>
    <div className="fg-panel-heading"><div><span className="fg-eyebrow">{decision.productionUnitIds.join(' · ')} / {decision.category}</span><h2>{decision.titleZh || decision.title}</h2></div><Badge status={decision.status} /></div>
    <div className="fg-case-meta"><span><Glyph name="calendar" size={14} />{decision.deadline ? `截止 ${decision.deadline}` : '无固定截止日期'}</span><span>关注：{decision.impactAreas.map(area => ({ water: '水资源', quality: '品质', labor: '人员', equipment: '设备', yield: '产量' }[area] || area)).join('、') || '农场运营'}</span>{decision.overdue && <Badge status="blocked">已过原定期限</Badge>}</div>
    {decision.descriptionZh || decision.description ? <p className="fg-case-description">{decision.descriptionZh || decision.description}</p> : null}
    {!!decision.disagreementTopics.length && <div className="fg-notice"><Glyph name="branch" size={18} /><div><strong>证据与观点存在差异</strong><p>{decision.disagreementTopicsZh?.join('；') || decision.disagreementTopics.join('；')}</p></div></div>}
    {!!decision.viewpoints.length && <div className="fg-viewpoints">{decision.viewpoints.slice(0, 4).map((point, index) => <div key={`${point.actorId}:${point.subject}:${index}`}><span>{personLabel(people.find(person => person.id === point.actorId))}</span><strong>{VARIABLE[point.subject] || point.subject}: {number(point.estimate, 2)}</strong><small>基于已送达证据 · 置信度 {number((point.confidence ?? 0) * 100)}%</small><p>{decision.participantGuidance?.find(guide => guide.actorId === point.actorId)?.text}</p></div>)}</div>}
    <details className="fg-evidence"><summary>查看决策证据 <span>{evidence.length} 条已送达观测</span></summary><ObservationList observations={evidence} limit={8} /></details>
    {decision.status === 'delegated' && <div className="fg-notice" data-testid={`proposal-pending-${decision.id}`}><Glyph name="clock" size={18} /><div><strong>{personLabel(people.find(person => person.id === decision.delegatedTo))}正在准备建议</strong><p>预计汇报 {decision.proposalDueAt || '待确认'}。建议送达并获你批准后，才会安排执行。</p></div></div>}
    {awaitingApproval && <form className="fg-proposal" data-testid={`proposal-${decision.id}`} onSubmit={event => { event.preventDefault(); run('approve', decision.id, { plannedStart, reasonText, reasonTags, ...(crewId ? { crewId } : {}) }); }}>
      <span className="fg-eyebrow">下属建议 · 规则生成</span><h3>{personLabel(people.find(person => person.id === proposal.actorId))}的建议已送达</h3><p>{proposal.reasonText}</p>
      <div className="fg-proposal-plan"><strong>{proposal.operation ? operationLabel(proposal.operation) : '采取建议行动'}</strong><span>引用 {proposal.evidenceIds?.length || 0} 条当时可用证据</span></div>
      <label>批准后的计划日期<input type="date" data-testid={`plan-date-${decision.id}`} min={nextDate(view.currentDate)} max={endDate} value={plannedStart} onChange={event => setPlannedStart(event.target.value)} required /></label>
      <ReasonFields caseId={decision.id} reasonText={reasonText} setReasonText={setReasonText} reasonTags={reasonTags} setReasonTags={setReasonTags} />
      <div className="fg-form-actions"><button className="fg-button fg-button--primary" type="submit" data-testid={`approve-${decision.id}`} disabled={view.ended}>批准并排程</button><button className="fg-button fg-button--secondary" type="button" data-testid={`reject-${decision.id}`} disabled={view.ended || !reasonText.trim()} onClick={() => run('reject', decision.id, { reasonText, reasonTags })}>拒绝并重新决策</button></div>
    </form>}
    {actionable && <form className="fg-decision-form" onSubmit={event => { event.preventDefault(); run('decide', decision.id, selection); }}>
      <h3>你的下一步</h3><div className="fg-action-options">{options.map(choice => <button type="button" key={choice.id} data-testid={choice.type === 'delegate' ? `delegate-${decision.id}` : `action-${choice.id}`} className={`fg-action-choice ${choice.id === selectedOptionId ? 'is-selected' : ''}`} onClick={() => { setSelectedOptionId(choice.id); setCrewId(''); }}><Glyph name={choice.type === 'delegate' ? 'people' : choice.type === 'delay' ? 'clock' : choice.type === 'no_action' ? 'check' : 'leaf'} size={17} />{optionLabel(choice)}</button>)}</div>
      {option?.operation && <div className="fg-plan-fields"><label>计划日期<input type="date" data-testid={`plan-date-${decision.id}`} min={nextDate(view.currentDate)} max={endDate} value={plannedStart} onChange={event => setPlannedStart(event.target.value)} required /></label>{option.operation.assignedResourceIds.some(id => view.resources.find(resource => resource.id === id)?.type === 'crew') && <label>执行班组<select data-testid={`crew-${decision.id}`} value={crewId} onChange={event => setCrewId(event.target.value)}><option value="">使用方案默认人员</option>{crews.map(crew => <option key={crew.id} value={crew.id}>{resourceLabel(crew)}</option>)}</select></label>}</div>}
      {option?.operation && <p className="fg-muted">计划占用 {number(option.operation.plannedDurationDays, 2)} 人员日{option.operation.plannedOutput?.water ? ` · 水 ${number(option.operation.plannedOutput.water)} m³` : ''}。资源容量与库存将在确认时校验。</p>}
      {option && <p className="fg-muted">{option.description}{option.estimatedCost != null ? ` 预计作业费用 ${money(option.estimatedCost)}。` : ''}经理注意力消耗 {number(option.attentionCost ?? view.attention?.costs?.[option.type] ?? 0)}。</p>}
      {!!decision.opportunityCosts.length && <div className="fg-notice"><div><strong>机会成本</strong>{decision.opportunityCosts.map((cost, index) => <p key={index}>{cost.label}</p>)}</div></div>}
      {option?.type === 'delegate' && <label>汇报对象<select data-testid={`delegate-person-${decision.id}`} value={delegateId} onChange={event => setDelegateId(event.target.value)}>{people.filter(person => person.id !== view.actorId).map(person => <option key={person.id} value={person.id}>{personLabel(person)}</option>)}</select><small>下属依据自己掌握的证据提出方案，未经你批准不会执行。</small></label>}
      {option?.type === 'delay' && <label>复查日期<input type="date" data-testid={`review-date-${decision.id}`} min={nextDate(view.currentDate)} max={endDate} value={nextReviewAt} onChange={event => setNextReviewAt(event.target.value)} required /></label>}
      <ReasonFields caseId={decision.id} reasonText={reasonText} setReasonText={setReasonText} reasonTags={reasonTags} setReasonTags={setReasonTags} />
      <div className="fg-form-actions"><span className="fg-muted">消耗经理注意力 · 接受行动后扣除</span><button className="fg-button fg-button--primary" type="submit" data-testid={`submit-case-${decision.id}`} disabled={!option}>确认{option?.type === 'delegate' ? '委派' : '选择'}</button></div>
    </form>}
    {!actionable && !awaitingApproval && decision.selectedAction && <div className="fg-decision-record"><strong>已记录的选择</strong><p>{decision.playerReasonText || '未填写理由'}</p>{decision.nextReviewAt && <small>复查日期：{decision.nextReviewAt}</small>}{!!decision.resultingOperationIds.length && <small>关联作业：{decision.resultingOperationIds.join('、')}</small>}</div>}
  </article>;
}

function OperationCard({ operation, view, model, run }) {
  const [plannedStart, setPlannedStart] = useState(operation.plannedStart > view.currentDate ? operation.plannedStart : nextDate(view.currentDate));
  const [showForm, setShowForm] = useState(false);
  const canReschedule = ['scheduled', 'blocked'].includes(operation.executionStatus) && !view.ended;
  const endDate = nextDate(model.date, model.totalDays - model.elapsedDays);
  return <article className="fg-panel fg-operation" data-testid={`operation-${operation.id}`} data-operation-id={operation.id} data-status={operation.executionStatus} data-planned-date={operation.plannedStart}>
    <div className="fg-panel-heading"><div><span className="fg-eyebrow">{operation.id} · {operation.productionUnitIds.join(' / ')}</span><h2>{operationLabel(operation)}</h2></div><Badge status={operation.executionStatus} /></div>
    <div className="fg-op-comparison"><div><span>计划</span><strong>{operation.plannedStart}</strong><p>{number(operation.plannedDurationDays, 2)} 日 · {Object.entries(operation.plannedOutput).map(([key, value]) => `${key === 'water' ? '水' : key === 'samples' ? '样本' : key} ${number(value, 2)}`).join(' / ') || '—'}</p></div><Glyph name="arrow" /><div><span>实际</span><strong>{operation.actualStart || '等待执行'}</strong><p>{operation.actualDurationDays != null ? `${number(operation.actualDurationDays, 2)} 日` : '—'} · {Object.entries(operation.actualOutput || {}).map(([key, value]) => `${key === 'water' ? '水' : key === 'samples' ? '样本' : key} ${number(value, 2)}`).join(' / ') || '尚无产出'}</p></div></div>
    <div className="fg-op-resources">{operation.assignedResourceIds.map(id => <span key={id}>{resourceLabel(view.resources.find(resource => resource.id === id) || { id })}</span>)}<span>已发生费用 {money(operation.cost || 0)}</span></div>
    {!!operation.deviations.length && <div className="fg-op-deviations">{operation.deviations.map((deviation, index) => <p key={index}><Badge status={['delay', 'attendance_delay', 'resource_conflict', 'resource_unavailable'].includes(deviation.type) ? 'blocked' : 'neutral'}>{({ productivity: '产能偏差', delay: '执行延迟', attendance_delay: '执行延迟', manual_reschedule: '手动改期', resource_unavailable: '资源不可用', resource_conflict: '资源冲突', availability: '可用性变化' }[deviation.type] || deviation.type)}</Badge><span>{deviation.message || deviation.reason || (deviation.resourceIds ? `${deviation.date} · ${deviation.resourceIds.map(id => resourceLabel(view.resources.find(resource => resource.id === id))).join('、')}` : deviation.planned != null ? `计划 ${typeof deviation.planned === 'number' ? number(deviation.planned, 2) : deviation.planned} → 实际 ${typeof deviation.actual === 'number' ? number(deviation.actual, 2) : deviation.actual}` : '')}</span></p>)}</div>}
    <details className="fg-evidence"><summary>移动开销与资源用量</summary><p className="fg-muted">额外移动开销 {number(operation.travelOverhead, 2)} 人员日；已计入容量和费用。</p>{Object.entries(operation.resourceQuantities).map(([id, quantity]) => <p className="fg-muted" key={id}>{resourceLabel(view.resources.find(resource => resource.id === id))}：{number(quantity, 2)}</p>)}</details>
    {canReschedule && <div className="fg-reschedule"><button className="fg-text-button" data-testid={`reschedule-open-${operation.id}`} onClick={() => setShowForm(!showForm)}><Glyph name="calendar" size={15} />手动改期</button>{showForm && <form onSubmit={event => { event.preventDefault(); const result = run('reschedule', operation.id, plannedStart); if (result.accepted) setShowForm(false); }}><label>新计划日期<input type="date" data-testid={`reschedule-date-${operation.id}`} value={plannedStart} min={nextDate(view.currentDate)} max={endDate} onChange={event => setPlannedStart(event.target.value)} required /></label><button className="fg-button fg-button--secondary" data-testid={`reschedule-${operation.id}`} type="submit">确认改期</button></form>}</div>}
  </article>;
}

function Today({ view, model, navigate }) {
  const arrived = view.observations.filter(observation => observation.availableAt === view.currentDate);
  const due = view.operations.filter(operation => ['scheduled', 'blocked'].includes(operation.executionStatus));
  return <div className="fg-today-grid"><section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">YOUR PRIORITIES</span><h2>今天需要你关注</h2></div><Badge status="open">{model.openCaseCount} 项</Badge></div>
    {model.activeCases.length ? model.activeCases.map(decision => <button className="fg-priority" key={decision.id} onClick={() => navigate('decisions', decision.id)}><span className="fg-priority-dot" /><div><strong>{decision.titleZh || decision.title}</strong><small>{decision.productionUnitIds.join('、')} · {STATUS[decision.status] || decision.status}{decision.deadline ? ` · 截止 ${decision.deadline}` : ''}</small></div><Glyph name="arrow" size={18} /></button>) : <Empty title="当前没有待处理决策">先查看农场信息，安排必要的检查，或推进一天等待新的报告。</Empty>}
    <button className="fg-button fg-button--secondary" onClick={() => navigate('map')}><Glyph name="map" size={16} />查看农场地图</button>
    </section><section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">INCOMING REPORTS</span><h2>今天送达的报告</h2></div><span className="fg-muted">{arrived.length} 条</span></div><ObservationList observations={arrived} limit={5} /></section>
    <section className="fg-panel fg-today-schedule"><div className="fg-panel-heading"><h2>已知作业安排</h2><button className="fg-text-button" onClick={() => navigate('operations')}>查看排程<Glyph name="arrow" size={15} /></button></div>{due.length ? due.map(operation => <div className="fg-schedule-row" key={operation.id}><span>{operation.plannedStart}</span><strong>{operationLabel(operation)}</strong><span>{operation.productionUnitIds.join('、')}</span><Badge status={operation.executionStatus} /></div>) : <p className="fg-muted">没有等待执行的作业。新的安排会出现在这里。</p>}</section>
  </div>;
}

function KnownTimeline({ model, navigate }) {
  return <section className="fg-panel fg-known-timeline" data-testid="known-timeline"><div className="fg-panel-heading"><div><span className="fg-eyebrow">KNOWN PLANS / NEXT 14 DAYS</span><h2>已知安排时间线</h2></div><small className="fg-muted">只显示已知计划、期限与预期窗口</small></div>
    <div className="fg-timeline-nodes">{model.timeline.length ? model.timeline.map(node => <button key={node.id} onClick={() => navigate(node.type === 'operation' ? 'operations' : node.type === 'decision' ? 'decisions' : 'map')}><small>{node.date}</small><strong>{node.label}</strong></button>) : <p className="fg-muted">未来两周暂无已知安排。尚未发生的随机事件与未送达报告不会显示在这里。</p>}</div>
  </section>;
}

function ActionAudit({ action, view }) {
  const evidence = view.observations.filter(observation => action.evidenceIds?.includes(observation.id));
  const label = { decide_now: '决定行动', gather_information: '调查', delegate: '委派', approve: '批准方案', reject: '拒绝方案',
    delay: '延后复查', no_action: '不采取行动', reschedule: '作业改期', custom: '自定义方案' }[action.type] || action.type;
  return <div className="fg-review-case"><strong>{action.date} · {label}</strong><p>{action.reasonText || '未填写文字理由'}</p>
    <small>当时引用 {evidence.length} 条证据 · 注意力 {action.attentionCost} · 关联作业 {action.operationId || '无'}</small>
    {!!action.viewpoints?.length && <details><summary>当时的人员观点</summary>{action.viewpoints.map(point => <p key={point.id} className="fg-muted">
      {personLabel(view.people.find(person => person.id === point.actorId))} · {VARIABLE[point.subject] || point.subject} {number(point.estimate, 2)} · 置信度 {number(point.confidence * 100)}%
    </p>)}</details>}
    {!!evidence.length && <details><summary>当时已送达的证据</summary>{evidence.map(observation => <p key={observation.id} className="fg-muted">
      {observation.productionUnitId} · {VARIABLE[observation.variable] || observation.variable} · {typeof observation.value === 'number' ? number(observation.value, 2) : STAGE_LABEL[observation.value] || observation.value}
      {' '}· {SOURCE[observation.sourceType] || observation.sourceType} · 观测 {observation.observedAt} / 送达 {observation.availableAt}
    </p>)}</details>}
  </div>;
}

function Review({ view, model }) {
  return <section className="fg-review" data-testid="review"><div className="fg-review-banner"><Glyph name="leaf" size={35} /><div><span className="fg-eyebrow">SEASON REVIEW</span><h2>这一轮经营已经结束</h2><p>{view.currentDate} · {model.elapsedDays} 天 · Seed {view.randomSeed}</p></div></div>
    <div className="fg-review-dimensions">{model.review.dimensions.map(dimension => <article className="fg-panel" key={dimension.id} data-testid={`review-${dimension.id}`}>
      <h3>{dimension.label}</h3><p>{dimension.summary}</p><dl className="fg-finance">{dimension.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
    </article>)}</div>
    <section className="fg-panel"><div className="fg-panel-heading"><h2>决策与理由回顾</h2><span className="fg-muted">{view.decisionCases.length} 个节点</span></div>{view.decisionCases.map(decision => <article className="fg-review-case" key={decision.id}><div><strong>{decision.titleZh || decision.title}</strong><Badge status={decision.status} /></div><p>{decision.playerReasonText || '尚未记录玩家行动理由'}</p><small>引用 {decision.availableObservationIds.length} 条可用证据 · 作业 {decision.resultingOperationIds.join('、') || '无'} · 已记录后果 {decision.outcomeIds.length} 项</small>
      {!!decision.actionHistory?.length && <details><summary>展开行动审计记录</summary>{decision.actionHistory.map((action, index) => <ActionAudit key={index} action={action} view={view} />)}</details>}</article>)}
    <p className="fg-footnote">本场景使用示例训练参数；复盘展示证据、选择和实际结果，不评定唯一“正确答案”。</p></section>
  </section>;
}

function Management({ view, model, run, storageStatus, openPurchase, openRestart }) {
  const resources = view.resources;
  return <div className="fg-management">{view.ended && <Review view={view} model={model} />}
    <div className="fg-management-grid"><section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">RESOURCES</span><h2>资源与人员</h2></div></div><div className="fg-resource-list">{resources.map(resource => <div className="fg-resource-row" key={resource.id}><Glyph name={resource.type === 'water' ? 'drop' : ['crew', 'person'].includes(resource.type) ? 'people' : 'calendar'} size={20} /><div><strong>{resourceLabel(resource)}</strong><small>{['crew', 'person', 'machine', 'robot'].includes(resource.type) ? `每日容量 ${number(resource.capacityPerDay, 2)} · 今日可用比例 ${number((resource.availability?.[view.currentDate] ?? 1) * 100)}%` : '库存资源'}</small></div><b>{['crew', 'person', 'machine', 'robot'].includes(resource.type) ? `${number(resource.capacityPerDay * (resource.availability?.[view.currentDate] ?? 1), 2)} 日` : `${number(resource.quantity, 1)} ${resource.unit === 'm3' ? 'm³' : resource.unit}`}</b></div>)}</div><button className="fg-button fg-button--secondary" data-testid="purchase-water" disabled={view.ended} onClick={openPurchase}><Glyph name="drop" size={16} />应急采购水资源</button></section>
      <section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">FINANCIAL POSITION</span><h2>经营账目</h2></div></div><dl className="fg-finance"><div><dt>可用现金</dt><dd>{money(view.finance.cash)}</dd></div><div><dt>已发生经营成本（含采购）</dt><dd>{money(view.finance.operatingCostToDate)}</dd></div><div><dt>预计收入</dt><dd>{money(view.finance.forecastRevenue)}</dd></div></dl><p className="fg-muted">预计收入是基于可用证据的估计，尚未形成销售到账，不等于实际利润。</p><details className="fg-evidence"><summary>查看资金流水<span>{view.finance.transactions.length} 笔</span></summary><div className="fg-ledger">{view.finance.transactions.map(transaction => <div key={transaction.id}><span>{transaction.date}</span><span>{transaction.type === 'operating_cost' ? '作业费用' : transaction.type === 'emergency_purchase' ? '应急采购' : transaction.type}</span><strong>{money(transaction.amount)}</strong></div>)}</div></details></section>
      <section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">TEAM</span><h2>你的农场团队</h2></div></div>{view.people?.filter(person => person.id !== view.actorId).map(person => <div className="fg-team-member" key={person.id}><span className="fg-avatar">{personLabel(person).slice(0, 1)}</span><div><strong>{personLabel(person)}</strong><small>{person.role === 'sentinel_agent' ? '本地规则分析 · 依据可用证据提出建议' : '可委派分析 · 方案需经理批准'}</small></div></div>)}</section>
      <section className="fg-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">THIS PLAYTHROUGH</span><h2>本轮与存档</h2></div></div><dl className="fg-finance"><div><dt>Seed</dt><dd className="fg-seed">{String(view.randomSeed)}</dd></div><div><dt>模拟时长</dt><dd>{model.totalDays} 天</dd></div><div><dt>本地存档</dt><dd>{storageStatus.state === 'saved' ? '自动保存已开启' : storageStatus.message}</dd></div></dl><p className="fg-muted">刷新浏览器会继续本机进度。相同 seed 配合相同的有序选择，可重复同一轮结果。</p><button className="fg-button fg-button--secondary" onClick={openRestart}><Glyph name="reset" size={16} />重新开始</button><p className="fg-footnote">本阶段固定扮演农场经理。存档保存在此浏览器，清除网站数据会移除存档。</p></section></div>
    {!view.ended && <button className="fg-text-button fg-return-map" onClick={() => run('advance')}>推进一天，查看下一批信息<Glyph name="arrow" size={16} /></button>}
  </div>;
}

function PurchaseDialog({ view, model, run, close }) {
  const [quantity, setQuantity] = useState(100);
  const [requestId] = useState(() => `ui-purchase:${view.currentDate}:${view.finance.emergencyPurchases.length + 1}`);
  const supply = model.criticalResources.find(resource => resource.type === 'water')?.purchase;
  const price = supply?.unitPrice ?? 0;
  return <div className="fg-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="purchase-title" className="fg-modal"><span className="fg-eyebrow">EMERGENCY SUPPLY</span><h2 id="purchase-title">确认应急采购水资源</h2><p>确认后将扣除现金并增加蓄水池库存。采购需要有足够现金，不会自动透支。</p><form onSubmit={event => { event.preventDefault(); const result = run('purchase', supply.resourceId, Number(quantity), requestId); if (result.accepted) close(); }}><label>采购数量（m³）<input type="number" data-testid="purchase-quantity" min="1" max={supply?.maxQuantity || 1} step="1" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label><div className="fg-confirm-summary"><span>可用现金 {money(view.finance.cash)} · 单价 {money(price)} / m³</span><strong>预计扣款 {money(Number(quantity) * price)}</strong></div><div className="fg-form-actions"><button type="button" className="fg-button fg-button--secondary" onClick={close}>取消</button><button type="submit" className="fg-button fg-button--primary" data-testid="purchase-confirm" disabled={!supply}>确认采购并付款</button></div></form></section></div>;
}

function RestartDialog({ view, model, run, close }) {
  const [mode, setMode] = useState('same');
  const [seed, setSeed] = useState(`${view.randomSeed}-next`);
  const [days, setDays] = useState(model.totalDays);
  return <div className="fg-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="restart-title" className="fg-modal"><span className="fg-eyebrow">NEW PLAYTHROUGH</span><h2 id="restart-title">重新开始这一轮</h2><p>确认后会替换当前本地存档。当前轮次的决策与作业将从初始状态重建。</p><form onSubmit={event => { event.preventDefault(); const result = run('restart', { seed: mode === 'same' ? view.randomSeed : seed.trim(), days: Number(days) }); if (result.accepted) close(); }}><div className="fg-action-options"><button type="button" className={`fg-action-choice ${mode === 'same' ? 'is-selected' : ''}`} data-testid="restart-same" onClick={() => setMode('same')}>相同 seed</button><button type="button" className={`fg-action-choice ${mode === 'new' ? 'is-selected' : ''}`} data-testid="restart-new" onClick={() => setMode('new')}>指定新 seed</button></div>{mode === 'new' && <label>新的 seed<input data-testid="restart-seed" value={seed} onChange={event => setSeed(event.target.value)} required maxLength={100} /></label>}<label>模拟时长（天）<input type="number" data-testid="restart-days" min="7" max="120" value={days} onChange={event => setDays(event.target.value)} required /></label><div className="fg-form-actions"><button type="button" className="fg-button fg-button--secondary" onClick={close}>保留当前进度</button><button type="submit" className="fg-button fg-button--primary" data-testid="restart-confirm">确认重新开始</button></div></form></section></div>;
}

function Recovery({ controller, storageStatus }) {
  const [confirmed, setConfirmed] = useState(false);
  return <div className="farm-game fg-recovery" data-testid="game-root"><section className="fg-panel"><Glyph name="alert" size={32} /><span className="fg-eyebrow">LOCAL SAVE</span><h1>暂时无法恢复这份存档</h1><p>{storageStatus.message || '存档版本不兼容或数据损坏。当前存档仍被保留。'}</p><p>开始新的一轮会替换当前本地存档；你也可以暂时返回原有 Demo。</p><label className="fg-confirm-check"><input data-testid="recover-save-confirmation" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />我确认替换这份存档并从头开始</label><button className="fg-button fg-button--primary" data-testid="recover-save" disabled={!confirmed} onClick={() => controller.resumeFresh()}>确认开始新的一轮</button><Link to="/">返回原有 Demo</Link></section></div>;
}

export default function GameApp() {
  const [controller] = useState(() => createGameController());
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [preferences] = useState(readPreferences);
  const [tab, setTab] = useState(preferences.tab);
  const [selectedUnitId, setSelectedUnitId] = useState(preferences.selectedUnitId);
  const [focusedCaseId, setFocusedCaseId] = useState('');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [varietyFilter, setVarietyFilter] = useState('all');
  const [overlay, setOverlay] = useState(preferences.overlay);
  const [operationUnitFilter, setOperationUnitFilter] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const { view, model, storageStatus } = snapshot;
  useEffect(() => {
    if (!view) return;
    try { localStorage.setItem(UI_KEY, JSON.stringify({ tab, selectedUnitId, overlay })); }
    catch { /* Gameplay remains usable when preference storage is unavailable. */ }
  }, [tab, selectedUnitId, overlay, view]);
  useEffect(() => {
    if (notice?.type !== 'error') return;
    const feedback = document.querySelector('[role="dialog"] [role="alert"]') || document.querySelector('[data-testid="game-error"]');
    feedback?.scrollIntoView({ block: 'center' });
    feedback?.focus();
  }, [notice]);
  const navigate = (nextTab, caseId = '') => { setTab(nextTab); setFocusedCaseId(caseId); };
  const run = (method, ...args) => {
    try {
      const result = controller[method](...args) || { accepted: true, conflicts: [] };
      if (!result.accepted) {
        const conflicts = (result.conflicts || []).map(conflict => conflict.message || conflict.reason || `${conflict.resourceId || '资源'}：${conflict.type || '容量或库存不足'}`).join('；');
        setNotice({ type: 'error', text: result.error || conflicts || snapshot.error || '这项操作未被接受，请检查计划与资源。' });
      } else {
        setNotice({ type: 'success', text: method === 'advance' ? '已推进一天，报告与作业状态已更新。' : method === 'restart' ? '新的一轮已开始。' : '操作已记录，进度已自动保存。' });
        if (method === 'restart') { setTab('map'); setSelectedUnitId(''); setFocusedCaseId(''); setClusterFilter('all'); setVarietyFilter('all'); setOperationUnitFilter('all'); }
      }
      return result;
    } catch (error) { setNotice({ type: 'error', text: error.message }); return { accepted: false, error: error.message }; }
  };
  if (!view || !model) return <Recovery controller={controller} storageStatus={storageStatus || { state: 'blocked' }} />;
  const selectedUnit = model.units.find(unit => unit.id === selectedUnitId) || model.units[0];
  const currentTab = TABS.find(item => item.id === tab);
  const water = view.resources.find(resource => resource.id === 'water');
  const criticalResource = model.criticalResources[0] || water;
  const attention = view.attention || model.attention || {};
  const filteredUnits = model.units.filter(unit => (clusterFilter === 'all' || unit.clusterId === clusterFilter) && (varietyFilter === 'all' || unit.varietyId === varietyFilter));
  const clusterOptions = [...new Set(model.units.map(unit => unit.clusterId))];
  const varietyOptions = [...new Map(model.units.map(unit => [unit.varietyId, unit.varietyName])).entries()];
  const dateParts = view.currentDate.split('-');
  return <div className="farm-game" data-testid="game-root" data-day-index={model.elapsedDays} data-seed={String(view.randomSeed)}>
    <aside className="fg-sidebar"><Link className="fg-brand" to="/game"><span className="fg-brand-mark"><Glyph name="leaf" size={27} /></span><div><strong>SENTINEL</strong><span>FARM MANAGER</span></div></Link><div className="fg-play-label"><span className="fg-dot" />{model.scenarioName}</div>
      <nav aria-label="农场试玩导航">{TABS.map(item => <button key={item.id} data-testid={`tab-${item.id}`} aria-label={item.label} className={`fg-nav-item ${tab === item.id ? 'is-active' : ''}`} aria-current={tab === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Glyph name={item.icon} /><span>{item.label}<small>{item.subtitle}</small></span>{item.id === 'decisions' && model.openCaseCount > 0 && <b>{model.openCaseCount}</b>}</button>)}</nav>
      <div className="fg-sidebar-bottom"><div className="fg-manager"><span className="fg-avatar">农</span><div><strong>农场经理</strong><small>你来决定下一步</small></div></div><Link className="fg-demo-link" to="/">返回原有 Demo<Glyph name="arrow" size={15} /></Link><p>观察 · 决策 · 执行 · 复盘</p></div>
    </aside>
    <div className="fg-workspace"><header className="fg-topbar"><div className="fg-breadcrumb">农场经营 <span>/</span> {currentTab.label}</div><div className="fg-topbar-tools"><span className={`fg-save-status fg-save-status--${storageStatus.state}`} data-testid="save-status" title={storageStatus.message}><Glyph name={storageStatus.state === 'saved' ? 'check' : 'alert'} size={14} />{storageStatus.state === 'saved' ? '进度已保存' : storageStatus.state === 'memory' ? '仅本次会话保存' : '存档需要关注'}</span><button className="fg-icon-button" aria-label="重新开始" data-testid="restart-open" onClick={() => setDialog('restart')}><Glyph name="reset" size={18} /></button><span className="fg-topbar-avatar">FM</span></div></header>
      <main className="fg-main"><section className="fg-page-heading"><div><span className="fg-eyebrow">YUNNAN BLUEBERRY / TRAINING SCENARIO</span><h1>{currentTab.label}<span>{tab === 'map' ? '看见农场，做出有依据的选择。' : '每一步选择，都留下可以追溯的记录。'}</span></h1></div><div className="fg-time-control"><div className="fg-date"><Glyph name="calendar" size={19} /><div><strong data-testid="game-date">{view.currentDate}</strong><small>第 {model.elapsedDays} / {model.totalDays} 天{view.ended ? ' · 已结束' : ''}</small></div></div><button className="fg-button fg-button--primary" data-testid="advance-day" disabled={view.ended} onClick={() => run('advance')}>{view.ended ? '本轮已结束' : '推进一天'}<Glyph name="arrow" size={17} /></button></div></section>
      <div className="fg-season-progress" aria-label={`已完成 ${model.elapsedDays} / ${model.totalDays} 天`}><span style={{ width: `${Math.min(100, model.elapsedDays / model.totalDays * 100)}%` }} /></div>
      <section className="fg-hud" aria-label="经营资源"><article><span className="fg-stat-icon"><Glyph name="wallet" /></span><div><span>可用现金</span><strong data-testid="cash" data-value={view.finance.cash}>{money(view.finance.cash)}</strong><small>费用按实际执行记账</small></div></article><article><span className="fg-stat-icon"><Glyph name="people" /></span><div><span>下个推进日可用劳动力</span><strong>{number(model.laborAvailable, 2)} <em>人员日</em></strong><small>日容量不结转</small></div></article><article><span className="fg-stat-icon fg-stat-icon--water"><Glyph name="drop" /></span><div><span>{criticalResource?.type === 'water' ? '水资源库存' : criticalResource?.name || '关键资源'}</span><strong data-testid="water-inventory" data-value={criticalResource?.quantity}>{number(criticalResource?.quantity, 1)} <em>{criticalResource?.unit === 'm3' ? 'm³' : criticalResource?.unit}</em></strong><small>用水与应急采购均可追溯</small></div></article><article><span className="fg-stat-icon fg-stat-icon--attention"><Glyph name="clock" /></span><div><span>经理注意力</span><strong data-testid="attention-remaining" data-value={attention.remaining}>{number(attention.remaining, 2)} <em>/ {number(attention.dailyBudget, 2)}</em></strong><small>推进一天后恢复每日预算</small></div></article></section>
      {(notice || snapshot.error) && <div className={`fg-feedback fg-feedback--${notice?.type || 'error'}`} data-testid={notice?.type === 'success' ? 'game-status' : 'game-error'} tabIndex={-1} role={notice?.type === 'success' ? 'status' : 'alert'}><Glyph name={notice?.type === 'success' ? 'check' : 'alert'} size={17} /><span>{notice?.text || snapshot.error}</span><button onClick={() => { setNotice(null); controller.clearError(); }} aria-label="关闭提示">×</button></div>}
      {storageStatus.state !== 'saved' && storageStatus.message && <div className="fg-storage-warning" role="status">{storageStatus.message}</div>}
      {view.ended && tab !== 'management' && <div className="fg-end-banner"><div><strong>{model.totalDays} 天经营已完成</strong><p>查看财务、水资源、作业偏差与决策记录，复盘这一轮。</p></div><button className="fg-button fg-button--primary" onClick={() => navigate('management')}>查看经营复盘<Glyph name="arrow" size={16} /></button></div>}
      {(tab === 'map' || tab === 'units') && <div className="fg-map-layout"><section className="fg-panel fg-map-panel"><div className="fg-panel-heading"><div><span className="fg-eyebrow">{tab === 'map' ? 'FARM OVERVIEW' : 'PRODUCTION UNITS'}</span><h2>{tab === 'map' ? '农场全景' : '生产单元总览'}<span className="fg-count">{filteredUnits.length} 个单元</span></h2></div><div className="fg-map-date"><span>{dateParts[1]}月{dateParts[2]}日</span><small>玩家已知信息</small></div></div>
        <div className="fg-map-toolbar"><div className="fg-layer-toggle" aria-label="地图图层">{[{ id: 'water', label: '水分与风险' }, { id: 'tasks', label: '作业与决策' }, { id: 'freshness', label: '信息新鲜度' }].map(layer => <button key={layer.id} className={overlay === layer.id ? 'is-active' : ''} onClick={() => setOverlay(layer.id)}>{layer.label}</button>)}</div><div className="fg-map-filters"><label><span className="fg-sr-only">分区筛选</span><select data-testid="cluster-filter" value={clusterFilter} onChange={event => setClusterFilter(event.target.value)}><option value="all">全部分区</option>{clusterOptions.map(id => <option key={id} value={id}>{id}</option>)}</select></label><label><span className="fg-sr-only">品种筛选</span><select data-testid="variety-filter" value={varietyFilter} onChange={event => setVarietyFilter(event.target.value)}><option value="all">全部品种</option>{varietyOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div></div>
        {tab === 'map' ? <FarmMap units={model.units} clusters={model.clusters} selectedUnitId={selectedUnit?.id} onSelect={setSelectedUnitId} overlay={overlay} clusterFilter={clusterFilter} varietyFilter={varietyFilter} /> : <div className="fg-units-grid">{filteredUnits.map(unit => <button key={unit.id} className={`fg-unit-tile ${unit.id === selectedUnit?.id ? 'is-selected' : ''}`} data-testid={`unit-card-${unit.id}`} onClick={() => setSelectedUnitId(unit.id)}><div><strong>{unit.id}</strong><Badge status={unit.water.status} /></div><span>{unit.varietyName}</span><small>{unit.clusterId} · {number(unit.area.value, 2)} {unit.area.unit}</small><div className="fg-unit-tile-bottom"><span>{unit.stage.label}</span><b>{unit.risk.label}</b></div></button>)}</div>}
        <div className="fg-map-footer"><span><Glyph name="leaf" size={15} />地图依据生产单元几何数据绘制</span><span>灰色表示未知或过期信息</span></div></section><UnitPanel unit={selectedUnit} view={view} model={model} run={run} navigate={navigate} /></div>}
      {tab === 'today' && <Today view={view} model={model} navigate={navigate} />}
      {tab === 'decisions' && <div className="fg-decisions-list"><div className="fg-section-intro"><h2>决定什么时候行动，也决定先获得什么信息。</h2><p>不同角色可能基于不同来源形成观点。所有可见证据均已送达，计划仍需经过资源检查。</p></div>{view.decisionCases.length ? view.decisionCases.toSorted((a, b) => (b.id === focusedCaseId ? 1 : 0) - (a.id === focusedCaseId ? 1 : 0) || b.openedAt.localeCompare(a.openedAt)).map(decision => <DecisionCard key={`${decision.id}:${view.currentDate}:${decision.status}`} decision={decision} view={view} model={model} run={run} focused={decision.id === focusedCaseId} />) : <section className="fg-panel"><Empty title="新的决策尚未出现" icon="branch">推进时间，等待证据与场景事件。你也可以先在地图上检查生产单元。</Empty></section>}</div>}
      {tab === 'operations' && <div className="fg-operations-list"><div className="fg-section-intro"><h2>计划与实际，放在一起看。</h2><p>人员、设备和库存会在排程与执行时分别检查；受阻的作业可以手动改期。</p><label>按生产单元筛选<select data-testid="operation-unit-filter" value={operationUnitFilter} onChange={event => setOperationUnitFilter(event.target.value)}><option value="all">全部生产单元</option>{model.units.map(unit => <option key={unit.id} value={unit.id}>{unit.id}</option>)}</select></label></div>{view.operations.length ? view.operations.filter(operation => operationUnitFilter === 'all' || operation.productionUnitIds.includes(operationUnitFilter)).toSorted((a, b) => b.plannedStart.localeCompare(a.plannedStart)).map(operation => <OperationCard key={`${operation.id}:${view.currentDate}:${operation.plannedStart}`} operation={operation} view={view} model={model} run={run} />) : <section className="fg-panel"><Empty title="还没有安排作业" icon="calendar">安排一次现场检查，或在决策中心选择可执行方案。</Empty></section>}</div>}
      {tab === 'management' && <Management view={view} model={model} run={run} storageStatus={storageStatus} openPurchase={() => setDialog('purchase')} openRestart={() => setDialog('restart')} />}
      {!view.ended && <KnownTimeline model={model} navigate={navigate} />}
      <footer className="fg-main-footer"><span>Sentinel Farm Simulation · 示例训练场景</span><span>依据可见证据决策 · 本地自动保存</span></footer>
      </main></div>
    {dialog === 'purchase' && <PurchaseDialog view={view} model={model} run={run} close={() => setDialog(null)} />}{dialog === 'restart' && <RestartDialog view={view} model={model} run={run} close={() => setDialog(null)} />}
  </div>;
}
