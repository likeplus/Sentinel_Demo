import { GROWTH_STAGES } from '../domain/growthStages.js';
import { addDays, clone, dateMs, daysBetween } from '../domain/validation.js';
import { createOperation, detectResourceConflicts } from '../domain/operation.js';
import { availableCapacity, isCapacityResource } from '../domain/resources.js';
import { createObservation } from '../domain/observation.js';
import { availableObservations } from './ObservationEngine.js';

export const FARM_ACTIONS = {
  inspection: { label: 'Field Inspection', zh: '田间巡查', labor: 1, attention: 0 },
  manager_inspection: { label: 'Manager Personal Inspection', zh: '经理亲自巡查', labor: 0, attention: 2 },
  irrigation: { label: 'Irrigation', zh: '系统灌溉', labor: 1, attention: 0, water: 20 },
  manual_watering: { label: 'Manual Watering', zh: '人工补水', labor: 2, attention: 0, water: 15 },
  spraying: { label: 'Spraying', zh: '喷施', labor: 1, attention: 0 },
  repair: { label: 'Equipment Repair', zh: '设备维修', labor: 1, attention: 0 },
  sensor_relocation: { label: 'Sensor Relocation', zh: '传感器迁移', labor: 1, attention: 0 },
};
export const ROLE_CAPABILITIES = {
  farm_manager: ['planning', 'delegation', 'high_level_decisions'],
  agronomist: ['crop_diagnosis', 'sampling', 'agronomic_assessment'],
  irrigation_manager: ['irrigation_diagnosis', 'valve_inspection', 'irrigation_repair'],
  field_supervisor: ['crop_management', 'field_inspection', 'manual_watering', 'spraying'],
  maintenance_lead: ['equipment_repair', 'sensor_relocation'],
};
const STAGE_DETAILS = {
  vegetative: { water: 'Moderate / 中', pest: 'Young leaves / 新叶', happening: 'Canopy and roots develop / 枝叶与根系发育', observe: 'Leaf color, vigor, root moisture / 叶色、长势、根区水分', priority: 'Build healthy canopy / 保持健康长势', sensitivity: 0.9 },
  flowering: { water: 'High / 高', pest: 'High: flower infection / 高：花部侵染', happening: 'Pollination and fruit set / 授粉与坐果', observe: 'Flowers, pollination, leaf wetness / 花、授粉、叶面湿润', priority: 'Stable moisture; inspect flower disease / 稳定水分，检查花部病害', sensitivity: 1.3 },
  fruit_set: { water: 'Very high / 很高', pest: 'Fruit and leaf disease / 果叶病害', happening: 'Fruit expansion / 果实膨大', observe: 'Fruit size, leaf wilt, dripper flow / 果径、萎蔫、滴头流量', priority: 'Avoid water deficit / 避免缺水', sensitivity: 1.5 },
  ripening: { water: 'High / 高', pest: 'Fruit rot / 果腐', happening: 'Color and quality develop / 着色与品质形成', observe: 'Fruit condition, cracking, water stress / 果况、裂果、水分胁迫', priority: 'Protect quality; avoid overwatering / 保品质，避免过量供水', sensitivity: 1.2 },
  harvest: { water: 'Moderate / 中', pest: 'Fruit rot / 果腐', happening: 'Harvest readiness / 进入适收窗口', observe: 'Ripeness, firmness, fruit health / 成熟度、硬度、果实健康', priority: 'Inspect readiness and harvest access / 检查适收情况与作业通道', sensitivity: 1 },
};
export const STAGE_GUIDE = Object.fromEntries(Object.entries(STAGE_DETAILS).map(([id, details]) => [id, { ...details, label: GROWTH_STAGES[id].en, zh: GROWTH_STAGES[id].zh }]));
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const active = task => ['scheduled', 'blocked', 'completed', 'failed'].includes(task.executionStatus);
const inspection = action => ['inspection', 'manager_inspection'].includes(action);
const actionKey = action => inspection(action) ? 'inspection' : action;
const tasks = s => s.scheduledOperations.filter(t => t.feedbackTask);
const pending = s => tasks(s).filter(t => ['scheduled', 'blocked'].includes(t.executionStatus));
const resource = (s, id) => s.farmState.resources.find(r => r.id === id);
const fail = (code, message, extra = {}) => ({ accepted: false, code, message, ...extra });

export function initializeManagement(s, config, random) {
  s.management = { phase: 'morning', dailyLabor: config.dailyLabor, dailyAttention: config.dailyAttention,
    laborAvailability: config.laborAvailability || {}, attentionRemaining: config.dailyAttention - 1,
    meetingCost: 1, demoCapabilities: clone(config.demoCapabilities || ['manager_inspection']), equipment: clone(config.equipment),
    sensors: clone(config.sensors), estimates: {}, trend: [], decisions: [], history: [], sequence: 0,
    expectedImpacts: [], lastResults: [], weather: { ...s.worldState.weather, et: 3.2 } };
  if (config.sampleAtStart) refreshSensors(s, random);
  refreshEstimates(s, false);
  recordTrend(s);
  s.management.history.push({ date: s.currentDate, type: 'meeting', message: 'Morning Meeting: Manager Attention -1' });
}

function refreshSensors(s, random) {
  for (const sensor of s.management.sensors.filter(sensor => sensor.status === 'Normal')) {
    const crop = s.farmState.cropInstances.find(c => c.productionUnitId === sensor.location);
    sensor.lastUpdate = `${s.currentDate}T08:00:00Z`;
    const value = clamp(crop.trueState.waterStress * 100 + random.between(-3, 3));
    s.observations.push(createObservation({ id: `${sensor.id}:${s.currentDate}`, productionUnitId: sensor.location,
      sourceType: 'sensor', sourceId: sensor.id, variable: 'waterStress', value: value / 100, unit: 'ratio',
      uncertainty: 0.06, reliability: sensor.reliability, observedAt: sensor.lastUpdate,
      availableAt: sensor.lastUpdate, freshness: 1, domain: 'water', findings: ['Soil moisture update'], taskId: null }));
  }
}

function evidence(s) {
  return availableObservations(s.observations, `${s.currentDate}T${s.management.phase === 'morning' ? '08:00:00' : '23:59:59'}Z`).filter(o => o.status !== 'invalid');
}
function latestFor(s, id, variable) {
  return evidence(s).filter(o => o.productionUnitId === id && o.variable === variable)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt) || b.reliability - a.reliability)[0] || null;
}
function refreshEstimates(s, advance) {
  const m = s.management;
  for (const unit of s.farmState.productionUnits) {
    const last = latestFor(s, unit.id, 'waterStress');
    const previous = m.estimates[unit.id];
    const age = last ? daysBetween(last.observedAt.slice(0, 10), s.currentDate) : 99;
    const stage = latestFor(s, unit.id, 'stage')?.value || 'unknown';
    const change = advance ? m.weather.et * (STAGE_GUIDE[stage]?.sensitivity || 1) - m.weather.rainfall * 0.4 : 0;
    const newSample = !previous || last?.id !== previous.observationId;
    const reductionsSinceObservation = last ? tasks(s).flatMap(t => t.results).filter(r => r.unitId === unit.id && r.executedAt > last.observedAt)
      .reduce((sum, r) => sum + (r.stressReduction || 0), 0) : 0;
    const value = newSample && last ? last.value * 100 - reductionsSinceObservation + (age > 0 ? change : 0) : previous?.value != null ? previous.value + change : null;
    // Confidence depends on source quality AND age; age is separately displayed.
    const confidence = last ? clamp(last.reliability * 100 - age * 4, 20, 100) : 0;
    const sensorCoverage = m.sensors.some(sensor => sensor.location === unit.id && sensor.status === 'Normal');
    const width = clamp((last?.uncertainty ?? 0.2) * 100 + (100 - confidence) * 0.2 + age * 1.2 + (sensorCoverage ? 0 : 3), 3, 40);
    m.estimates[unit.id] = { value: value === null ? null : Math.round(clamp(value)), confidence: Math.round(confidence), freshness: age,
      range: value === null ? [0, 100] : [Math.round(clamp(value - width)), Math.round(clamp(value + width))],
      source: last?.sourceType || 'Unknown', observationId: last?.id || null, observedAt: last?.observedAt || null };
  }
}
function recordTrend(s) {
  s.management.trend.push({ date: s.currentDate, units: clone(s.management.estimates) });
}

export function farmCapacity(s, date, excludeId = null) {
  dateMs(date);
  const m = s.management;
  const onDate = tasks(s).filter(t => t.id !== excludeId && (t.plannedStart === date || (date === s.currentDate && t.plannedStart < date && ['scheduled', 'blocked'].includes(t.executionStatus))) && active(t));
  const crewCapacity = s.farmState.resources.filter(r => r.type === 'crew').reduce((sum, r) => sum + availableCapacity(r, date), 0);
  const labor = m.laborAvailability[date] ?? m.dailyLabor * crewCapacity;
  const reserved = onDate.reduce((sum, task) => sum + task.labor, 0);
  const attention = onDate.reduce((sum, task) => sum + task.attention, 0);
  const decisions = m.decisions.filter(d => d.date === date && d.maker === 'Manager').reduce((sum, d) => sum + d.attentionCost, 0);
  return { date, labor, reserved, remaining: labor - reserved,
    attentionAvailable: date === s.currentDate ? m.attentionRemaining + onDate.filter(t => t.executionStatus === 'completed').reduce((sum, t) => sum + t.attention, 0)
      : Math.max(0, m.dailyAttention - 1 - decisions), attentionReserved: attention,
    waterRemaining: resource(s, 'water').quantity - pending(s).filter(t => t.id !== excludeId).reduce((sum, t) => sum + t.water, 0) };
}

export function scheduleFarmTask(s, input, replaceId = null, prepareOnly = false) {
  const m = s.management;
  if (m.phase !== 'morning' || s.ended) return fail('phase', 'Scheduling is only available during Morning Meeting.');
  const unitIds = input.productionUnitIds || [input.unitId];
  const unit = s.farmState.productionUnits.find(u => u.id === unitIds[0]);
  if (!unit || unitIds.some(id => !s.farmState.productionUnits.some(u => u.id === id))) return fail('unit', 'Choose a Production Unit.');
  dateMs(input.date);
  if (input.date < s.currentDate || input.date >= m.endDate) return fail('date', 'Choose Today or a remaining future date before season end.');
  if (!Array.isArray(input.actions) || !input.actions.length || input.actions.some(a => !FARM_ACTIONS[a])) return fail('action', 'Choose a supported action.');
  if (input.actions.includes('manager_inspection') && !m.demoCapabilities.includes('manager_inspection')) return fail('capability', 'This role does not have personal inspection capability.');
  const keys = input.actions.map(actionKey);
  if (new Set(keys).size !== keys.length) return fail('duplicate', 'A task cannot contain the same action twice.');
  const duplicates = tasks(s).filter(t => t.id !== replaceId && active(t) && t.productionUnitIds.some(id => unitIds.includes(id)) && t.plannedStart === input.date && t.actions.some(a => keys.includes(actionKey(a))));
  if (duplicates.length) return fail('duplicate', 'This action is already scheduled for this Production Unit on this date.', { taskIds: duplicates.map(t => t.id) });
  let costs = input.actions.reduce((sum, a) => ({ labor: sum.labor + FARM_ACTIONS[a].labor,
    attention: sum.attention + FARM_ACTIONS[a].attention, water: sum.water + (FARM_ACTIONS[a].water || 0) }), { labor: 0, attention: 0, water: 0 });
  if (input.plan) costs = { labor: input.plan.plannedDurationDays * m.dailyLabor, attention: costs.attention, water: input.plan.resourceQuantities?.water || 0 };
  const capacity = farmCapacity(s, input.date, replaceId);
  if (costs.labor > capacity.remaining || costs.attention + capacity.attentionReserved > capacity.attentionAvailable || costs.water > capacity.waterRemaining)
    return fail('capacity', 'Resource Conflict: insufficient Labor, Manager Attention, or reserved water.', { capacity, required: costs });
  let sensor = null;
  if (input.actions.includes('sensor_relocation')) {
    sensor = m.sensors.find(sensor => sensor.id === (input.sensorId || input.plan?.sensorId));
    if (!sensor || sensor.fixed || sensor.status !== 'Normal') return fail('sensor', 'Choose an operational Mobile Sensor.');
    const moves = pending(s).filter(t => t.id !== replaceId && t.sensorId === sensor.id).sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
    if (moves.some(t => t.plannedStart === input.date)) return fail('sensor', 'This Mobile Sensor is already reserved on this date.');
    const previous = moves.filter(t => t.plannedStart < input.date).at(-1);
    if ((previous?.unitId || sensor.location) === unit.id) return fail('sensor', 'Sensor is already at the destination.');
  }
  const assignedResourceIds = input.plan?.assignedResourceIds || [...(costs.labor ? [input.crewId || 'crew-a'] : []), ...(input.actions.includes('irrigation') ? ['irrigation-rig'] : []), ...(costs.water ? ['water'] : [])];
  const task = createOperation({ ...(input.plan || {}), id: replaceId || input.id || `TASK-${m.sequence + 1}`, feedbackTask: true, sourceType: input.plan?.sourceType || 'task', sourceId: input.decisionId || null,
    type: input.actions[0], productionUnitIds: [...unitIds], unitId: unit.id, actions: [...input.actions],
    plannedStart: input.date, executionStatus: 'scheduled', ...costs, sensorId: sensor?.id || null,
    createdAt: s.currentDate, actualStart: null, results: [], observationIds: [], outcomeIds: [],
    assignedResourceIds, plannedDurationDays: input.plan?.plannedDurationDays ?? costs.labor / m.dailyLabor,
    resourceQuantities: costs.water ? { water: costs.water } : {}, plannedOutput: input.plan?.plannedOutput || { water: costs.water },
    maintenanceEffects: input.actions.includes('repair') ? [{ resourceId: 'irrigation-rig', factor: 1, durationDays: 3 }] : [],
  });
  const repairPlanned = task.actions.includes('repair') || pending(s).some(t => t.plannedStart === input.date && t.actions.includes('repair') && t.productionUnitIds.some(id => unitIds.includes(id)));
  const resources = clone(s.farmState.resources);
  if (repairPlanned) resources.find(r => r.id === 'irrigation-rig').availability[input.date] = 1;
  const conflicts = detectResourceConflicts([...s.scheduledOperations.filter(t => t.id !== replaceId), task], resources).filter(c => c.operationIds.includes(task.id) && c.type !== 'incompatible_operation');
  if (conflicts.length) return fail('capacity', 'Resource Conflict: assigned crew, equipment or inventory unavailable.', { conflicts });
  const expectedCost = assignedResourceIds.reduce((sum, id) => sum + (isCapacityResource(resource(s, id)) ? resource(s, id).operatingCost * task.plannedDurationDays : 0), 0);
  const reservedCost = pending(s).filter(t => t.id !== replaceId).reduce((sum, t) => sum + (t.expectedCost || 0), 0);
  if (expectedCost + reservedCost > s.farmState.finance.cash) return fail('cash', 'Resource Conflict: insufficient cash for reserved operations.');
  task.expectedCost = expectedCost;
  if (prepareOnly) return { accepted: true, operation: clone(task), task: clone(task), conflicts: [] };
  if (replaceId) {
    const index = s.scheduledOperations.findIndex(t => t.id === replaceId);
    if (index < 0 || !['scheduled', 'blocked'].includes(s.scheduledOperations[index].executionStatus)) return fail('task', 'Only unexecuted tasks can be rescheduled.');
    s.scheduledOperations[index] = task;
  } else {
    m.sequence++;
    if (!input.decisionId) {
      const unitView = farmManagementView(s).units.find(u => u.id === unit.id);
      const decision = { id: `DEC-${++m.sequence}`, unitId: unit.id, date: s.currentDate, maker: 'Manager', attentionCost: 0,
        input: { water: unitView.water, cropStatus: unitView.cropStatus, equipment: unitView.equipment,
          sensors: unitView.sensors, weather: clone(m.weather), growthStage: unitView.growthStage,
          labor: capacity, observationIds: observationsForUnit(s, unit.id), existingSchedule: clone(pending(s)) },
        recommendedActions: [...input.actions], rationale: input.reason || '', confidence: unitView.water.confidence,
        status: 'scheduled', taskIds: [task.id], result: null };
      task.sourceId = decision.id; m.decisions.push(decision);
    }
    s.scheduledOperations.push(task);
  }
  m.history.push({ date: s.currentDate, type: replaceId ? 'rescheduled' : 'scheduled', taskId: task.id, unitId: unit.id, message: `${task.actions.join(' + ')} → ${task.plannedStart}` });
  return { accepted: true, task: clone(task) };
}

export function cancelFarmTask(s, id) {
  if (s.management.phase !== 'morning') return fail('phase', 'Adjust tasks at the next Morning Meeting.');
  const task = pending(s).find(t => t.id === id);
  if (!task) return fail('task', 'Only unexecuted tasks can be cancelled.');
  task.executionStatus = 'cancelled';
  const decision = s.management.decisions.find(d => d.id === task.sourceId);
  if (decision) { decision.status = 'cancelled'; decision.result = [{ message: 'Cancelled; no operation or observation produced.' }]; }
  s.management.history.push({ date: s.currentDate, type: 'cancelled', taskId: id, unitId: task.unitId, message: 'Cancelled: Labor, Attention and reserved resources released.' });
  return { accepted: true };
}

export function executeFarmDay(s, packs, random) {
  const m = s.management;
  if (m.phase !== 'morning' || s.ended) return fail('phase', 'Execution begins once after Morning Meeting.');
  const today = pending(s).filter(t => t.plannedStart <= s.currentDate).sort((a, b) => (b.actions.includes('repair') ? 1 : 0) - (a.actions.includes('repair') ? 1 : 0));
  const cap = farmCapacity(s, s.currentDate);
  if (cap.remaining < 0 || cap.attentionReserved > cap.attentionAvailable) return fail('capacity', 'Resource Conflict: adjust today’s tasks before execution.');
  m.phase = 'execution';
  m.lastResults = [];
  m.expectedImpacts = [];
  const usage = new Map();
  for (const task of today) {
    // A combined repair restores equipment before its attached irrigation.
    if (task.actions.includes('repair')) for (const effect of task.maintenanceEffects) resource(s, effect.resourceId).availability[s.currentDate] = effect.factor;
    const unavailable = task.assignedResourceIds.filter(id => { const r = resource(s, id); return isCapacityResource(r) ? (usage.get(id) || 0) + task.plannedDurationDays > availableCapacity(r, s.currentDate) : r.status !== 'available' || (task.resourceQuantities[id] || 0) > r.quantity; });
    if (unavailable.length) { task.executionStatus = 'blocked'; task.deviations.push({ type: 'resource_unavailable', date: s.currentDate, resourceIds: unavailable }); m.lastResults.push({ taskId: task.id, unitId: task.unitId, status: 'blocked', labor: 0, results: [{ unitId: task.unitId, message: 'Resource Conflict: assigned crew, equipment or inventory unavailable.' }] }); continue; }
    task.actualDurationDays = task.plannedDurationDays; task.actualResourceIds = [...task.assignedResourceIds];
    task.cost = task.expectedCost || 0;
    task.actualOutput = { water: 0, waterConsumed: 0 };
    for (const id of task.assignedResourceIds) if (isCapacityResource(resource(s, id))) usage.set(id, (usage.get(id) || 0) + task.plannedDurationDays);
    for (const effect of task.maintenanceEffects) for (let day = 0; day < effect.durationDays; day++) resource(s, effect.resourceId).availability[addDays(s.currentDate, day)] = effect.factor;
    m.attentionRemaining -= task.attention;
    task.executionStatus = 'completed'; task.actualStart = s.currentDate;
    for (const unitId of task.productionUnitIds) {
    const crop = s.farmState.cropInstances.find(c => c.productionUnitId === unitId);
    const equipment = m.equipment[unitId];
    task.executionStatus = 'completed';
    task.actualStart = s.currentDate;
    // Inspection is recorded before attached operations; repair precedes watering.
    const ordered = [...task.actions].sort((a, b) => (inspection(a) ? -2 : a === 'repair' ? -1 : 0) - (inspection(b) ? -2 : b === 'repair' ? -1 : 0));
    for (const action of ordered) {
      let result = { action, status: 'completed', message: '', unitId: unitId, executedAt: `${s.currentDate}T11:00:00Z` };
      if (inspection(action)) {
        const manager = action === 'manager_inspection';
        const value = clamp(crop.trueState.waterStress * 100 + (manager ? 0 : random.between(-4, 4)));
        const findings = [value >= 50 ? 'Water stress signs / 水分胁迫迹象' : 'No visible water stress / 无明显缺水迹象',
          crop.trueState.diseasePressure >= 0.3 ? 'Pest/disease signs / 病虫害迹象' : 'Leaves and fruit normal / 叶片与果实正常',
          `Growth / 长势: ${crop.trueState.biomass > 1 ? 'vigorous / 良好' : 'steady / 稳定'}`,
          `Stage / 阶段: ${STAGE_GUIDE[crop.stage]?.label || crop.stage}`];
        const observedAt = `${s.currentDate}T10:00:00Z`;
        const cropObservation = {
          waterStressSigns: value >= 50 ? 'Wilting / 萎蔫迹象' : 'None / 无',
          growthStatus: crop.trueState.biomass > 1 ? 'Vigorous / 良好' : 'Steady / 稳定',
          leafCondition: crop.trueState.diseasePressure >= 0.3 ? 'Lesions / 病斑' : 'Normal / 正常',
          fruitCondition: crop.trueState.diseasePressure >= 0.3 && ['fruit_set', 'ripening', 'harvest'].includes(crop.stage) ? 'Check for lesions / 需检查病斑' : 'Normal / 正常',
          pestDiseaseSigns: crop.trueState.diseasePressure >= 0.3 ? 'Signs detected / 发现迹象' : 'None / 无',
          growthStageIssues: value >= 50 ? `${STAGE_GUIDE[crop.stage]?.priority || 'Assess water supply'}` : 'No observed stage-specific issue / 未发现阶段相关问题',
        };
        const sensorIssues = m.sensors.filter(sensor => sensor.location === unitId && sensor.status !== 'Normal');
        const observedIssues = [
          ...(value >= 50 ? ['Water stress signs / 水分胁迫迹象'] : []),
          ...(crop.trueState.diseasePressure >= 0.3 ? ['Pest/disease signs / 病虫害迹象'] : []),
          ...(equipment.status !== 'Normal' ? [`${equipment.issuePart || 'Irrigation'}: ${equipment.status}`] : []),
          ...sensorIssues.map(sensor => `${sensor.id}: ${sensor.status}`),
        ];
        const report = createObservation({ id: `inspection:${task.id}:${unitId}`, productionUnitId: unitId,
          sourceType: manager ? 'manager' : 'worker', sourceId: `inspection:${task.id}`, variable: 'waterStress', value: value / 100,
          unit: 'ratio', uncertainty: manager ? 0 : 0.05, reliability: manager ? 1 : 0.9,
          observedAt, availableAt: observedAt, freshness: 3, domain: 'crop_equipment', taskId: task.id,
          cropCondition: crop.trueState.diseasePressure >= 0.3 ? 'Warning' : 'Normal', equipmentCondition: equipment.status,
          equipmentFindings: ['Irrigation', 'Valves', 'Pipes', 'Drippers', 'Sensors'].map(part => ({ part, status: part === 'Sensors'
            ? (m.sensors.find(sensor => sensor.location === unitId && sensor.status !== 'Normal')?.status || 'Normal')
            : part === equipment.issuePart ? equipment.status : 'Normal' })),
          findings: [...findings, ...observedIssues], cropObservation, observedIssues, growthStage: crop.stage });
        s.observations.push(report);
        s.observations.push(createObservation({ id: `inspection-stage:${task.id}:${unitId}`, productionUnitId: unitId, sourceType: report.sourceType, sourceId: `inspection:${task.id}`, variable: 'stage', valueType: 'category', value: crop.stage, observedAt, availableAt: observedAt, reliability: report.reliability, freshness: 7 }));
        task.actualOutput.samples = (task.actualOutput.samples || 0) + 1;
        refreshEstimates(s, false);
        task.observationIds.push(report.id);
        result.message = `Crop + Equipment inspected; confidence ${manager ? 100 : 90}%. Findings enter next Morning Meeting.`;
      } else if (action === 'repair') {
        equipment.status = 'Normal'; equipment.issuePart = null;
        m.sensors.filter(sensor => sensor.location === unitId).forEach(sensor => { sensor.status = 'Normal'; });
        result.message = 'Irrigation, valves, pipes and drippers restored. Long-term reliability unchanged.';
      } else if (['irrigation', 'manual_watering'].includes(action)) {
        const amount = (task.actions.length === 1 ? task.water : FARM_ACTIONS[action].water) / task.productionUnitIds.length;
        if (resource(s, 'water').quantity < amount || (action === 'irrigation' && equipment.status === 'Fault')) {
          result.status = 'failed'; result.message = 'Watering failed: unavailable water or irrigation equipment Fault.';
          task.executionStatus = 'failed';
        } else {
          const efficiency = action === 'manual_watering' ? 0.75 : equipment.status === 'Significant issue' ? 0.5 : equipment.status === 'Warning' ? 0.8 : 1;
          const water = amount * efficiency;
          resource(s, 'water').quantity -= amount;
          task.actualOutput.waterConsumed += amount;
          const operation = { id: `${task.id}:${action}`, type: action === 'manual_watering' ? 'manual_watering' : 'irrigation', productionUnitIds: [unitId], actualOutput: { water }, actualStart: s.currentDate };
          const updated = packs[crop.cropPackId].applyOperation(crop, operation);
          Object.assign(crop, updated);
          const from = m.estimates[unitId].value;
          const to = from === null ? null : Math.round(clamp(from - water * 1.5));
          task.actualOutput.water += water;
          result.stressReduction = water * 1.5;
          m.estimates[unitId].value = to;
          m.estimates[unitId].range = from === null ? [0, 100] : m.estimates[unitId].range.map(v => Math.round(clamp(v - water * 1.5)));
          m.expectedImpacts.push({ taskId: task.id, unitId: unitId, action, from, to, water: amount, efficiency });
          result.message = `Expected Water Stress ${from} → ${to}; ${amount} m³ used. Formal update next morning.`;
        }
      } else if (action === 'spraying') {
        Object.assign(crop, packs[crop.cropPackId].applyOperation(crop, { id: `${task.id}:spraying`, type: 'spraying', actualStart: s.currentDate }));
        result.message = 'Spraying completed. Crop response will be checked by future observations.';
      } else if (action === 'sensor_relocation') {
        const sensor = m.sensors.find(sensor => sensor.id === task.sensorId);
        const from = sensor.location;
        sensor.location = unitId; sensor.lastUpdate = null;
        result.message = `${sensor.id}: ${from} → ${unitId}. First valid update next morning.`;
        result.from = from; result.to = unitId;
      }
      task.results.push(result);
      const outcome = { id: `result:${task.id}:${unitId}:${action}`, operationId: task.id, date: s.currentDate, output: clone(result) };
      s.outcomes.push(outcome); task.outcomeIds.push(outcome.id);
    }
    }
    m.lastResults.push({ taskId: task.id, unitId: task.unitId, status: task.executionStatus, labor: task.labor, results: clone(task.results) });
    const originalCase = s.openDecisionCases.find(d => d.id === task.sourceId);
    if (originalCase) { originalCase.outcomeIds.push(...task.outcomeIds); originalCase.status = task.executionStatus === 'failed' ? 'open' : task.actions.some(inspection) ? 'investigating' : 'resolved'; }
    if (task.sourceId) {
      const decision = m.decisions.find(d => d.id === task.sourceId);
      if (decision) { decision.result = clone(task.results); decision.status = task.executionStatus; }
    }
    m.history.push({ date: s.currentDate, type: task.executionStatus, taskId: task.id, unitId: task.unitId, message: task.results.map(r => r.message).join(' / ') });
  }
  return { accepted: true };
}

export function advanceFarmMorning(s, random, endDate) {
  const m = s.management;
  m.endDate = endDate;
  m.phase = 'morning'; m.attentionRemaining = m.dailyAttention - 1;
  for (const decision of m.decisions.filter(d => d.status === 'proposed' && d.date < s.currentDate)) {
    decision.status = 'deferred'; decision.result = [{ message: 'Unaccepted recommendation expired. Review updated information before making a new decision.' }];
  }
  m.weather = { ...s.worldState.weather, et: Math.round((2 + (s.worldState.weather.temperature - 16) * 0.15) * 10) / 10 };
  refreshSensors(s, random);
  refreshEstimates(s, true);
  recordTrend(s);
  m.history.push({ date: s.currentDate, type: 'meeting', message: 'Morning Meeting: Manager Attention -1; yesterday’s evidence and results available.' });
}

export function farmManagementView(s) {
  const m = s.management;
  const observations = evidence(s);
  const units = s.farmState.productionUnits.map(unit => {
    const reports = observations.filter(o => o.productionUnitId === unit.id && o.domain === 'crop_equipment').sort((a, b) => b.observedAt.localeCompare(a.observedAt));
    const report = reports[0] || null;
    const estimate = m.estimates[unit.id];
    return { id: unit.id, name: unit.name, area: unit.area, clusterId: unit.clusterId, geometry: unit.geometry,
      water: { ...clone(estimate), provisional: m.phase !== 'morning' && m.expectedImpacts.some(impact => impact.unitId === unit.id) }, cropStatus: report?.cropCondition || 'Unknown',
      cropFreshness: report ? daysBetween(report.observedAt.slice(0, 10), s.currentDate) : 99,
      equipment: clone(m.equipment[unit.id]), sensors: m.sensors.filter(sensor => sensor.location === unit.id),
      latestObservation: latestFor(s, unit.id, 'waterStress'), latestInspection: report,
      // Stage is estimated from known planting date and variety, never hidden health.
      growthStage: latestFor(s, unit.id, 'stage')?.value || null, scheduledTasks: pending(s).filter(t => t.productionUnitIds.includes(unit.id)) };
  });
  return clone({ onboarded: m.onboarded || false, phase: m.phase, currentDate: s.currentDate, endDate: addDays(m.endDate, -1), ended: s.ended, units,
    dailyLabor: m.dailyLabor, sensors: m.sensors, tasks: tasks(s), observations: observations.filter(o => o.domain), decisions: m.decisions,
    history: m.history, trend: m.trend, weather: m.weather, expectedImpacts: m.expectedImpacts, lastResults: m.lastResults,
    resources: { labor: farmCapacity(s, s.currentDate), attention: m.attentionRemaining, dailyAttention: m.dailyAttention,
      attentionReserved: pending(s).filter(t => t.plannedStart === s.currentDate).reduce((sum, t) => sum + t.attention, 0), water: resource(s, 'water').quantity },
    roleCapabilities: ROLE_CAPABILITIES, demoCapabilities: m.demoCapabilities });
}

export function openFarmDecision(s, unitId, maker) {
  const m = s.management;
  if (m.phase !== 'morning' || s.ended) return fail('phase', 'Decisions are made during Morning Meeting.');
  if (!['Manager', 'Team', 'AI Assistant'].includes(maker)) return fail('maker', 'Unknown decision maker.');
  const unit = farmManagementView(s).units.find(u => u.id === unitId);
  if (!unit) return fail('unit', 'Choose a Production Unit.');
  const complex = needsComplexDecision(unit);
  if (!complex) return fail('routine', 'Routine decisions can be scheduled directly without Attention.');
  const existing = m.decisions.find(d => d.unitId === unitId && d.date === s.currentDate && d.status === 'proposed' && d.maker === maker);
  if (existing) return { accepted: true, decision: clone(existing) };
  const capacity = farmCapacity(s, s.currentDate);
  if (maker === 'Manager' && m.attentionRemaining - capacity.attentionReserved < 1) return fail('attention', 'Attention exhausted. Delegate to Team or AI Assistant.');
  let recommended = unit.water.confidence < 60 ? ['inspection'] : unit.equipment.status === 'Fault' && unit.water.value >= 45
    ? ['repair', 'manual_watering'] : unit.cropStatus === 'Warning' ? ['inspection', 'spraying'] : ['irrigation'];
  const labor = actions => actions.reduce((sum, action) => sum + FARM_ACTIONS[action].labor, 0);
  if (labor(recommended) > capacity.remaining) recommended = unit.water.value >= 70 && unit.equipment.status !== 'Fault' && capacity.remaining >= 1 ? ['irrigation'] : [];
  const duplicateKeys = pending(s).filter(t => t.unitId === unitId && t.plannedStart === s.currentDate).flatMap(t => t.actions.map(actionKey));
  recommended = recommended.filter(a => !duplicateKeys.includes(actionKey(a)));
  if (recommended.reduce((sum, a) => sum + (FARM_ACTIONS[a].water || 0), 0) > capacity.waterRemaining) recommended = [];
  if (maker === 'Manager') m.attentionRemaining -= 1;
  const rationale = `Water stress ${unit.water.value}, confidence ${unit.water.confidence}%, freshness ${unit.water.freshness}d; equipment ${unit.equipment.status}; stage ${unit.growthStage}; sensors ${unit.sensors.filter(sensor => sensor.status === 'Normal').length}; weather ${m.weather.temperature.toFixed(1)}°C, rain ${m.weather.rainfall.toFixed(1)}mm, ET ${m.weather.et}mm; Labor remaining ${capacity.remaining}; ${duplicateKeys.length} scheduled actions. ${recommended.length ? 'Prioritize evidence when uncertain, then feasible risk reduction.' : 'Existing schedule or limited resources: defer to next Morning Meeting.'}`;
  const decision = { id: `DEC-${++m.sequence}`, unitId, date: s.currentDate, maker, attentionCost: maker === 'Manager' ? 1 : 0,
    input: { cropStatus: unit.cropStatus, water: unit.water, equipment: unit.equipment, sensors: unit.sensors,
      weather: m.weather, growthStage: unit.growthStage, labor: capacity, existingSchedule: clone(pending(s)),
      observationIds: observationsForUnit(s, unitId) }, recommendedActions: recommended,
    rationale: maker === 'Manager' ? '' : rationale, confidence: clamp(unit.water.confidence - (maker === 'Team' ? 10 : 5)),
    status: 'proposed', taskIds: [], result: null };
  m.decisions.push(decision);
  return { accepted: true, decision: clone(decision) };
}
const observationsForUnit = (s, id) => evidence(s).filter(o => o.productionUnitId === id).map(o => o.id);

export function resolveFarmDecision(s, id, accept, reason = '', managerActions = null) {
  if (s.management.phase !== 'morning') return fail('phase', 'Resolve at the next Morning Meeting.');
  const decision = s.management.decisions.find(d => d.id === id && d.status === 'proposed');
  if (!decision) return fail('decision', 'Decision is unavailable.');
  if (!accept) { decision.status = 'rejected'; decision.result = [{ message: 'Rejected; no action executed.' }]; return { accepted: true }; }
  const actions = decision.maker === 'Manager' && managerActions ? managerActions : decision.recommendedActions;
  if (actions.length) {
    const scheduled = scheduleFarmTask(s, { unitId: decision.unitId, date: s.currentDate, actions, decisionId: id });
    if (!scheduled.accepted) return scheduled;
    decision.taskIds.push(scheduled.task.id);
  }
  decision.rationale = decision.maker === 'Manager' ? reason : decision.rationale;
  decision.status = actions.length ? 'scheduled' : 'deferred';
  if (!actions.length) decision.result = [{ message: 'No new action: review next morning.' }];
  return { accepted: true };
}

export const needsComplexDecision = unit => unit.water.value >= 70 || (unit.equipment.status === 'Fault' && unit.water.value >= 45) || unit.water.confidence < 60 || unit.cropStatus === 'Warning';
