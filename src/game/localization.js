import { GAME_TEXT, GAME_LABELS, GAME_MESSAGES, GAME_MIXED } from './gameText.js';

import { GROWTH_STAGES } from '../domain/growthStages.js';

const entries = new Map();
const add = (source, zh, en) => entries.set(source.toLowerCase(), { zh, en });
for (const [zh, en] of GAME_TEXT) { add(zh, zh, en); add(en, zh, en); }
for (const [source, zh, en = source] of [...GAME_LABELS, ...GAME_MESSAGES, ...GAME_MIXED]) {
  add(source, zh, en); add(zh, zh, en); add(en, zh, en);
}
const enumLabels = {
  open: ['待决策', 'Open'], proposed: ['待接受', 'Proposed'], scheduled: ['已排程', 'Scheduled'], rescheduled: ['已改期', 'Rescheduled'],
  completed: ['已完成', 'Completed'], cancelled: ['已取消', 'Cancelled'], failed: ['失败', 'Failed'], deferred: ['已延后', 'Deferred'],
  rejected: ['已拒绝', 'Rejected'], blocked: ['执行受阻', 'Blocked'], meeting: ['早会', 'Morning meeting'],
  morning: ['早会', 'Morning meeting'], end_of_day: ['日终复盘', 'End of day'], sensor: ['传感器', 'Sensor'], worker: ['现场人员', 'Field team'], manager: ['经理', 'Manager'],
  inspection: ['田间巡查', 'Field inspection'], manager_inspection: ['经理亲自巡查', 'Manager personal inspection'],
  irrigation: ['系统灌溉', 'Irrigation'], manual_watering: ['人工补水', 'Manual watering'], spraying: ['喷施', 'Spraying'], repair: ['设备维修', 'Equipment repair'], sensor_relocation: ['传感器迁移', 'Sensor relocation'],
  waterStress: ['水分胁迫', 'Water stress'], stage: ['生长阶段', 'Growth stage'],
  manager_judgment: ['经理判断', 'Manager review'], proposal_arrived: ['建议已送达', 'Proposal arrived'], review_reminder: ['复查提醒', 'Review reminder'], deadline_missed: ['错过期限', 'Deadline missed'],
  lab: ['实验室', 'Laboratory'], scout: ['巡查人员', 'Scout'], operations: ['作业', 'Operations'], water: ['水分', 'Water'], quality: ['品质', 'Quality'],
  'null': ['未知', 'Unknown'], Attention: ['注意力', 'Attention'], Sensor: ['传感器', 'Sensor'], Valves: ['阀门', 'Valves'], Pipes: ['管道', 'Pipes'], Drippers: ['滴头', 'Drippers'],
  biomass: ['生物量', 'Biomass'], Repairs: ['维修次数', 'Repairs'], waterConsumed: ['用水量', 'Water consumed'], Samples: ['样本', 'Samples'],
};
for (const [source, [zh, en]] of Object.entries(enumLabels)) add(source, zh, en);
for (const [id, { zh, en }] of Object.entries(GROWTH_STAGES)) { add(id, zh, en); add(zh, zh, en); add(en, zh, en); }
// Old save reports retain their original labels; normalize these at display time.
for (const [alias, id] of [['Fruit Development', 'fruit_set'], ['果实发育', 'fruit_set'], ['Harvest Preparation', 'harvest'], ['采收准备', 'harvest'], ['营养生长', 'vegetative'], ['成熟期', 'ripening']]) { const { zh, en } = GROWTH_STAGES[id]; add(alias, zh, en); }
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Legacy labels may themselves contain English terms. Normalize catalog output,
// rather than modifying stored observations or a player's own written rationale.
const zhTerms = [...GAME_LABELS.filter(([source]) => /^[A-Za-z]/.test(source)),
  ['Attention', '注意力'], ['Inspection', '巡查'], ['Estimate', '估计'], ['Uncertainty Range', '可信区间'],
  ['seed', '随机种子'], ['Demo', '演示应用'], ['Phase 2', '第二阶段']];
const zhWords = new Map(zhTerms.map(([source, zh]) => [source.toLowerCase(), zh]));
const zhMatcher = new RegExp([...zhWords.keys()].sort((a, b) => b.length - a.length)
  .map(word => `(?<![a-z0-9_-])${escape(word)}(?![a-z0-9_-])`).join('|'), 'gi');
for (const entry of entries.values()) entry.zh = entry.zh.replace(zhMatcher, match => zhWords.get(match.toLowerCase()));

const phrases = [...entries.keys()].filter(key => !['m', '/'].includes(key)).sort((a, b) => b.length - a.length).map(key => key.charCodeAt(0) < 128
  ? `(?<![a-z0-9_-])${escape(key)}(?![a-z0-9_-])` : escape(key));
const matcher = new RegExp(phrases.join('|'), 'gi');

// Parameterized system messages also cover historical saves written before localization.
const templates = [
  [/^Growth \/ 长势: (.+)$/, (m, t) => `长势：${t(m[1])}`],
  [/^Stage \/ 阶段: (.+)$/, (m, t) => `阶段：${t(m[1])}`],
  [/^Crop \+ Equipment inspected; confidence (\d+)%\. Findings enter next Morning Meeting\.$/, m => `作物与设备已巡查；可信度 ${m[1]}%。次日早会处理发现的问题。`],
  [/^Expected Water Stress (.+?) → (.+?); (.+?) m³ used\. Formal update next morning\.$/, (m, t) => `预计水分胁迫 ${t(m[1])} → ${t(m[2])}；用水 ${m[3]} 立方米。次日早会正式更新。`],
  [/^(.+?): (.+?) → (.+?)\. First valid update next morning\.$/, m => `${m[1]}：${m[2]} → ${m[3]}。次日早会获得首条有效更新。`],
  [/^Morning Meeting: Manager Attention -1(?:; yesterday’s evidence and results available\.)?$/, () => '早会：经理注意力 −1；可回顾昨日观测和作业结果。'],
  [/^Water stress (.+?), confidence (.+?)%, freshness (.+?)d; equipment (.+?); stage (.+?); sensors (.+?); weather (.+?)°C, rain (.+?)mm, ET (.+?)mm; Labor remaining (.+?); (.+?) scheduled actions\. (.+)$/, (m, t) => `水分胁迫 ${t(m[1])}，可信度 ${m[2]}%，新鲜度 ${m[3]} 天；设备 ${t(m[4])}；阶段 ${t(m[5])}；传感器 ${m[6]} 个；天气 ${m[7]}°C，降雨 ${m[8]} 毫米，蒸散量 ${m[9]} 毫米；剩余劳动力 ${m[10]}；已有作业 ${m[11]} 项。${t(m[12])}`],
];

function translateText(locale, value) {
  if (Array.isArray(value)) return value.map(item => localizeGameText(locale, item));
  if (typeof value !== 'string' || !value) return value;
  const t = item => localizeGameText(locale, item);
  const age = value.match(/^(\d+)(?:天前| days? ago)$/);
  if (age) return locale === 'zh' ? `${age[1]}天前` : `${age[1]} ${age[1] === '1' ? 'day' : 'days'} ago`;
  const exact = entries.get(value.trim().toLowerCase());
  if (exact) return value.replace(value.trim(), exact[locale === 'zh' ? 'zh' : 'en']);
  const planDescription = value.match(/^使用 (.+) m³ 水和 (.+) 天班组\/设备容量；实际送水量受作业效率影响。$/);
  if (planDescription && locale === 'en') return `Uses ${planDescription[1]} m³ water and ${planDescription[2]} crew/equipment-days. Actual water output depends on operating efficiency.`;
  const advice = value.match(/^已送达证据估计水分胁迫为 (.+)，建议(.+)。$/);
  if (advice && locale === 'en') return `Available evidence estimates water stress at ${advice[1]}. Recommendation: ${t(advice[2])}.`;
  const finding = value.match(/^(Growth|Stage) \/ (?:长势|阶段): (.+)$/);
  if (finding) return `${t(finding[1])}: ${t(finding[2])}`;
  // Crop guides and inspection findings previously stored a bilingual source string.
  const bilingual = value.match(/^([^\u4e00-\u9fff]+?)\s+\/\s+([^/]*[\u4e00-\u9fff][^/]*)$/);
  if (bilingual) return t(locale === 'zh' ? bilingual[2] : bilingual[1]);
  if (locale === 'zh') {
    for (const [pattern, render] of templates) { const match = value.match(pattern); if (match) return render(match, t); }
  }
  if (locale === 'en' && !/[\u4e00-\u9fff]/.test(value)) return value;
  if (/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(value)) return value;
  if (locale === 'zh' && value.includes(' / ')) return value.split(' / ').map(t).join('；');
  let result = value.replace(matcher, match => entries.get(match.toLowerCase())[locale === 'zh' ? 'zh' : 'en']);
  if (locale === 'zh') result = result.replace(/\b(\d+)d(\+?)/g, '$1天$2').replace(/\bha\b/g, '公顷');
  return result;
}

// Unit typography is a display concern; never rewrite stored simulation values.
export function localizeGameText(locale, value) {
  if (Array.isArray(value)) return value.map(item => localizeGameText(locale, item));
  if (typeof value !== 'string') return value;
  if (value.trim() === '/') return value;
  const result = translateText(locale, value);
  return locale === 'zh' ? result.replace(/(?<![a-z])m(?:³|3)(?![a-z0-9])/gi, '立方米').replace(/\bmm\b/g, '毫米')
    : result.replaceAll('立方米', 'm³').replaceAll('公顷', 'ha').replaceAll('毫米', 'mm');
}
