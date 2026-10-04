import { fraction, nonnegative } from '../domain/validation.js';
const operators = { gt: (a,b)=>a>b, gte: (a,b)=>a>=b, lt: (a,b)=>a<b, lte: (a,b)=>a<=b, eq: (a,b)=>a===b };
function readPath(context, path) {
  return path.split('.').reduce((value, key) => value && Object.hasOwn(value, key) ? value[key] : undefined, context);
}
export function meetsConditions(conditions, context) {
  return conditions.every(condition => {
    const actual = readPath(context, condition.path);
    return actual !== undefined && operators[condition.operator](actual, condition.value);
  });
}
export function validateEventRules(rules) {
  for (const rule of rules) {
    if (!rule.id || !Number.isInteger(rule.eligibleWindow.startDay) || !Number.isInteger(rule.eligibleWindow.endDay)
      || rule.eligibleWindow.startDay < 1 || rule.eligibleWindow.endDay < rule.eligibleWindow.startDay) throw new RangeError('Invalid event window (one-based days)');
    fraction(rule.baseProbability, 'baseProbability');
    if (!Number.isInteger(rule.maxOccurrences) || rule.maxOccurrences < 1) throw new RangeError('Invalid maxOccurrences');
    for (const condition of [...rule.conditions, ...rule.modifiers.flatMap(m => m.conditions)]) {
      if (!operators[condition.operator] || typeof condition.path !== 'string') throw new TypeError('Unsupported event condition');
    }
    for (const modifier of rule.modifiers) nonnegative(modifier.multiplier, 'probability multiplier');
  }
  if (new Set(rules.map(r=>r.id)).size !== rules.length) throw new TypeError('Duplicate event rule id');
}
/** Roll eligible rules in config order. Unmet conditions consume no PRNG draws. */
export function rollEvents(rules, context, day, random, counts) {
  const rolls = [];
  const events = [];
  for (const rule of rules) {
    if (day < rule.eligibleWindow.startDay || day > rule.eligibleWindow.endDay
      || (counts[rule.id] ?? 0) >= rule.maxOccurrences || !meetsConditions(rule.conditions, context)) continue;
    const multiplier = rule.modifiers.filter(m => meetsConditions(m.conditions, context)).reduce((value, m) => value * m.multiplier, 1);
    const probability = Math.min(1, rule.baseProbability * multiplier);
    const roll = random.next();
    rolls.push({ ruleId: rule.id, day, probability, roll, fired: roll < probability });
    if (roll < probability) events.push(rule);
  }
  return { rolls, events };
}
