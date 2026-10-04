/** Small deterministic weather skeleton; no API, wall clock, or real-world calibration. */
export function advanceWorld(world, date, random) {
  return { ...world, date, weather: { temperature: random.between(16, 28),
    rainfall: random.chance(0.2) ? random.between(1, 8) : 0, humidity: random.between(0.5, 0.9) } };
}
