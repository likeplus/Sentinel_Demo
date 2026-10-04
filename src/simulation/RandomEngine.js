/** Seeded Mulberry32 PRNG. Serializable state; no wall-clock/random defaults. */
export class RandomEngine {
  constructor(seed = 1) {
    if (!['number', 'string'].includes(typeof seed) || (typeof seed === 'number' && !Number.isFinite(seed))) throw new TypeError('Invalid seed');
    this.seed = seed;
    // Hash strings and numbers alike so seeds are stable across JSON round-trips.
    let hash = 2166136261;
    for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    this.state = hash >>> 0;
  }
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  between(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) throw new RangeError('Invalid range');
    return min + this.next() * (max - min);
  }
  chance(probability) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new RangeError('Invalid probability');
    return this.next() < probability;
  }
  gaussian(mean = 0, sigma = 1) {
    if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma < 0) throw new RangeError('Invalid Gaussian parameters');
    return mean + sigma * Math.sqrt(-2 * Math.log(1 - this.next())) * Math.cos(2 * Math.PI * this.next());
  }
  exportState() { return { seed: this.seed, state: this.state }; }
  static restore(snapshot) {
    if (!Number.isInteger(snapshot.state) || snapshot.state < 0 || snapshot.state > 0xFFFFFFFF) throw new RangeError('Invalid random state');
    const random = new RandomEngine(snapshot.seed);
    random.state = snapshot.state;
    return random;
  }
}
export default RandomEngine;
