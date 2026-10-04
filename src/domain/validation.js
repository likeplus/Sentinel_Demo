/** Clone a JSON-only domain value; reject silent JSON data loss. */
export function clone(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol'
      || typeof item === 'bigint' || (typeof item === 'number' && !Number.isFinite(item))) {
      throw new TypeError('Domain data must be JSON serializable without loss');
    }
    return item;
  }));
}

export function model(defaults, input, required = ['id']) {
  const result = clone({ ...defaults, ...input });
  for (const key of required) {
    if (typeof result[key] !== 'string' || !result[key].trim()) throw new TypeError(`${key} is required`);
  }
  return result;
}

export function nonnegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be nonnegative`);
  return value;
}

export function fraction(value, name) {
  nonnegative(value, name);
  if (value > 1) throw new RangeError(`${name} must be between 0 and 1`);
  return value;
}

export const DAY_MS = 86_400_000;
/** Strict UTC date-only parsing prevents timezone/DST and invalid-date rollover. */
export function dateMs(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Expected YYYY-MM-DD');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new RangeError('Invalid calendar date');
  return time;
}
export const addDays = (date, days) => new Date(dateMs(date) + days * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (start, end) => (dateMs(end) - dateMs(start)) / DAY_MS;
