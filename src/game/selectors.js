import { FARM_ACTIONS } from '../simulation/FarmManagement.js';
import { availableCapacity } from '../domain/resources.js';
import { addDays, daysBetween } from '../domain/validation.js';

import { GROWTH_STAGE_LABELS as STAGES } from '../domain/growthStages.js';
const SOURCES = { manager: '经理巡查', sensor: '传感器', worker: '工人', lab: '实验室', scout: '巡查', inspection: '现场检查' };
const latest = samples => [...samples].sort((a, b) => b.observedAt.localeCompare(a.observedAt) || b.availableAt.localeCompare(a.availableAt))[0];
const number = value => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const currency = value => `¥${number(value)}`;

/** Pure projection of a player view. This module never receives an engine checkpoint. */
export function buildGameModel(view, metadata = {}) {
  const scenario = view.scenario || metadata.scenario;
  const totalDays = scenario.durationDays ?? daysBetween(scenario.startDate, scenario.endDate);
  const units = view.productionUnits.map(unit => {
    const crops = view.crops.filter(crop => crop.productionUnitId === unit.id);
    const crop = crops[0];
    const variety = metadata.varieties?.[crop?.varietyId];
    const observations = view.observations.filter(sample => sample.productionUnitId === unit.id);
    const valid = observations.filter(sample => sample.status !== 'invalid');
    const stageSample = latest(valid.filter(sample => sample.variable === 'stage'));
    const stage = stageSample ? { value: stageSample.value, label: STAGES[stageSample.value] || String(stageSample.value),
      status: stageSample.status, observedAt: stageSample.observedAt, availableAt: stageSample.availableAt,
      source: SOURCES[stageSample.sourceType] || stageSample.sourceType, evidenceIds: [stageSample.id] }
      : { value: null, label: '阶段未知', status: 'unknown', observedAt: null, availableAt: null, source: '尚无阶段报告', evidenceIds: [] };
    const belief = view.beliefs.find(item => item.productionUnitId === unit.id && item.subject === 'waterStress');
    const waterSamples = valid.filter(sample => sample.variable === 'waterStress');
    const used = belief ? waterSamples.filter(sample => belief.basedOnObservationIds.includes(sample.id)) : waterSamples;
    const waterSample = latest(used);
    const waterValue = belief?.estimate ?? waterSample?.value ?? null;
    const water = { value: waterValue, label: waterValue === null ? '水分信息未知' : `水分胁迫估计 ${Math.round(waterValue * 100)}%`,
      status: waterSample ? (used.some(sample => sample.status === 'current') ? 'current' : 'stale') : 'unknown',
      observedAt: waterSample?.observedAt ?? null, availableAt: waterSample?.availableAt ?? null,
      source: belief ? `经理综合 ${used.length} 条可用观测` : waterSample ? SOURCES[waterSample.sourceType] || waterSample.sourceType : '尚无水分观测',
      confidence: belief?.confidence ?? waterSample?.reliability ?? null, evidenceIds: used.map(sample => sample.id) };
    const feedback = view.management?.units.find(u => u.id === unit.id);
    if (feedback) Object.assign(water, { value: feedback.water.value === null ? null : feedback.water.value / 100,
      label: feedback.water.value === null ? '水分信息未知' : `Water Stress ${feedback.water.value}${feedback.water.provisional ? '（预计）' : ''}`,
      confidence: feedback.water.confidence / 100, freshness: feedback.water.freshness, range: feedback.water.range,
      observedAt: feedback.water.observedAt, source: SOURCES[feedback.water.source] || feedback.water.source,
      status: feedback.water.value === null ? 'unknown' : feedback.water.freshness > 3 ? 'stale' : 'current' });
    const thresholds = metadata.riskThresholds || { high: 0.6, medium: 0.35 };
    const level = water.value === null ? 'unknown' : water.value >= thresholds.high ? 'high' : water.value >= thresholds.medium ? 'medium' : 'low';
    return { ...unit, varietyId: crop?.varietyId ?? 'unknown', varietyName: variety?.name || crop?.varietyId || '品种未知',
      cropId: crop?.id ?? null, cropPackId: crop?.cropPackId ?? null, ...(feedback || {}), stage, water,
      risk: { level, label: { unknown: '风险未知', high: '水分风险高', medium: '水分风险中', low: '水分风险低' }[level], status: water.status },
      observations: [...observations].sort((a, b) => b.availableAt.localeCompare(a.availableAt) || b.observedAt.localeCompare(a.observedAt)),
      operations: view.operations.filter(operation => operation.productionUnitIds.includes(unit.id)),
      decisions: view.decisionCases.filter(decision => decision.productionUnitIds.includes(unit.id)) };
  });
  const clusters = [...new Set(units.map(unit => unit.clusterId))].map(id => ({ id, name: `分区 ${String(id).replace('CL-', '')}` }));
  const varieties = [...new Set(units.map(unit => unit.varietyId))].map(id => ({ id, name: units.find(unit => unit.varietyId === id).varietyName }));
  const activeCases = view.decisionCases.filter(decision => decision.status !== 'resolved');
  const plannedOperations = view.operations.filter(operation => ['scheduled', 'blocked'].includes(operation.executionStatus));
  const purchases = metadata.emergencySupplies || [];
  const criticalIds = metadata.criticalResourceIds || [];
  const criticalResources = view.resources.filter(resource => criticalIds.includes(resource.id)).map(resource => ({ ...resource,
    purchase: purchases.find(purchase => purchase.resourceId === resource.id) || null }));
  const nextDate = view.ended ? view.currentDate : addDays(view.currentDate, 1);
  const laborAvailable = view.resources.filter(resource => resource.type === 'crew').reduce((sum, resource) => {
    const reserved = plannedOperations.filter(operation => operation.plannedStart <= nextDate && operation.assignedResourceIds.includes(resource.id))
      .reduce((total, operation) => total + operation.plannedDurationDays + operation.travelOverhead, 0);
    return sum + Math.max(0, availableCapacity(resource, nextDate) - reserved);
  }, 0);
  const timeline = plannedOperations.map(operation => ({ id: operation.id, date: operation.plannedStart,
    label: `${operation.actions ? operation.actions.map(a => FARM_ACTIONS[a]?.zh || a).join(' + ') : operation.type === 'inspection' ? '巡查' : operation.type === 'irrigation' ? '灌溉' : '维护'} · ${operation.productionUnitIds.join(' / ')}`,
    type: 'operation', productionUnitIds: operation.productionUnitIds }));
  for (const decision of activeCases) {
    const date = decision.status === 'delegated' ? decision.proposalDueAt : decision.status === 'delayed' ? decision.nextReviewAt : decision.deadline;
    if (date) timeline.push({ id: `case:${decision.id}`, date, label: decision.status === 'delegated' ? `委派汇报 · ${decision.title}` : decision.status === 'delayed' ? `复查 · ${decision.title}` : `决策期限 · ${decision.title}`,
      type: 'decision', productionUnitIds: decision.productionUnitIds });
  }
  const harvestWindows = new Set(view.crops.map(crop => crop.expectedHarvestWindow?.startDate).filter(Boolean));
  for (const date of harvestWindows) if (date >= view.currentDate) timeline.push({ id: `harvest:${date}`, date,
    label: '配置的预期采收窗口开始（预期）', type: 'forecast', productionUnitIds: [] });
  timeline.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const review = buildReview(view, units, metadata);
  return { units, clusters, varieties, activeCases, openCaseCount: activeCases.length, plannedOperations, criticalResources,
    laborAvailable: view.management?.resources.labor.remaining ?? laborAvailable, timeline: timeline.filter(item => item.date >= view.currentDate && item.date <= addDays(view.currentDate, 14)
      && item.date <= scenario.endDate).slice(0, 14), review,
    totalDays, elapsedDays: view.currentDayIndex, date: view.currentDate, nextDate, attention: view.attention,
    scenarioName: scenario.name, endDate: scenario.endDate };
}

function buildReview(view, units, metadata) {
  const completed = view.operations.filter(operation => operation.executionStatus === 'completed');
  const irrigation = view.operations.filter(o => o.actualStart).filter(operation => operation.type === 'irrigation' || operation.actions?.some(a => ['irrigation', 'manual_watering'].includes(a)));
  const waterId = view.resources.find(resource => resource.type === 'water')?.id;
  const waterResource = view.resources.find(resource => resource.id === waterId);
  const purchased = (view.finance.emergencyPurchases || []).reduce((sum, purchase) => sum + (purchase.resourceId === waterId ? purchase.quantity || 0 : 0), 0);
  const financial = { cash: view.finance.cash, forecastRevenue: view.finance.forecastRevenue, operatingCost: view.finance.operatingCostToDate };
  const crop = { knownUnits: units.filter(unit => unit.water.status !== 'unknown').length,
    unknownUnits: units.filter(unit => unit.water.status === 'unknown').length,
    staleUnits: units.filter(unit => unit.water.status === 'stale').length, highRiskUnits: units.filter(unit => unit.risk.level === 'high').length };
  const water = { remaining: waterResource?.quantity ?? 0, initialQuantity: metadata.initialResources?.find(resource => resource.id === waterId)?.quantity ?? 0,
    irrigationInput: irrigation.reduce((sum, operation) => sum + (operation.actualOutput?.waterConsumed ?? operation.resourceQuantities[waterId] ?? 0), 0),
    actualApplied: irrigation.reduce((sum, operation) => sum + (operation.actualOutput.water || 0), 0), purchased };
  const operations = { planned: view.operations.length, completed: completed.length,
    blocked: view.operations.filter(operation => operation.executionStatus === 'blocked').length,
    delayed: view.operations.filter(operation => operation.deviations.some(deviation => ['delay', 'attendance_delay', 'manual_reschedule', 'resource_unavailable'].includes(deviation.type))).length };
  const histories = view.decisionCases.flatMap(decision => decision.actionHistory || []);
  const feedbackDecisions = view.management?.decisions || [];
  const decisions = { total: view.decisionCases.length + feedbackDecisions.length, resolved: view.decisionCases.filter(decision => decision.status === 'resolved').length + feedbackDecisions.filter(d => ['completed', 'rejected', 'deferred', 'cancelled'].includes(d.status)).length,
    withReasons: histories.filter(action => action.reasonText || action.reasonTags?.length).length + feedbackDecisions.filter(d => d.rationale).length,
    investigations: view.operations.filter(operation => operation.type === 'inspection' || operation.actions?.some(a => a.endsWith('inspection'))).length,
    delegations: histories.filter(action => action.type === 'delegate').length + feedbackDecisions.filter(d => d.maker !== 'Manager').length };
  const dimensions = [
    { id: 'finance', label: '财务状况', summary: '现金与已发生费用单独核对；预计收入并未实现。', metrics: [
      { label: '期末现金', value: currency(financial.cash) }, { label: '已发生成本', value: currency(financial.operatingCost) },
      { label: '预计收入', value: currency(financial.forecastRevenue), hint: '基于可用证据与示例品种参数，非实际利润' }] },
    { id: 'crop', label: '作物与信息覆盖', summary: '依据玩家已获得的观测和估计，未知信息保持未知。', metrics: [
      { label: '有水分信息的单元', value: `${crop.knownUnits} / ${units.length}` }, { label: '水分信息过期', value: String(crop.staleUnits) },
      { label: '已知高水分风险', value: String(crop.highRiskUnits) }] },
    { id: 'water', label: '水资源使用', summary: '核对库存、投入与实际作业产出；未灌溉的库存变化包含场景资源事件。', metrics: [
      { label: '剩余库存', value: `${number(water.remaining)} m³` }, { label: '灌溉投入', value: `${number(water.irrigationInput)} m³` },
      { label: '实际施用', value: `${number(water.actualApplied)} m³` }, { label: '应急补水', value: `${number(water.purchased)} m³` }] },
    { id: 'operations', label: '运营可靠性', summary: '作业完成、阻塞和延迟分开展示。', metrics: [
      { label: '完成 / 计划', value: `${operations.completed} / ${operations.planned}` }, { label: '仍阻塞', value: String(operations.blocked) },
      { label: '发生延迟的作业', value: String(operations.delayed) }] },
    { id: 'decisions', label: '决策与审计', summary: '保留当时可见证据、理由、批准记录和实际后果。', metrics: [
      { label: '已处理 / 决策', value: `${decisions.resolved} / ${decisions.total}` }, { label: '记录理由的行动', value: String(decisions.withReasons) },
      { label: '巡查作业', value: String(decisions.investigations) }, { label: '委派', value: String(decisions.delegations) }] },
  ];
  return { dimensions, financial, crop, water, operations, decisions };
}
