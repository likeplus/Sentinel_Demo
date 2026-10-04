import { createObservation, OBSERVATION_CATEGORIES } from '../domain/observation.js';
import { createBelief } from '../domain/belief.js';
import { addDays, clone, DAY_MS } from '../domain/validation.js';

/** Stateless selector: availability AND sampling time guard all replay/actor access. */
export function availableObservations(observations, asOf) {
  const time = Date.parse(asOf);
  if (!Number.isFinite(time)) throw new RangeError('Invalid observation query time');
  return observations.filter(o => Date.parse(o.availableAt) <= time && Date.parse(o.observedAt) <= time)
    .map(o => ({ ...clone(o), status: o.status === 'invalid' ? 'invalid'
      : (o.status === 'stale' || (time - Date.parse(o.observedAt)) / DAY_MS > o.freshness) ? 'stale' : 'current' }));
}

/** Sample only the current true state; future reports remain in the engine-only queue. */
export function sampleObservations(crops, profiles, date, dayIndex, random) {
  const result = [];
  for (const profile of profiles) {
    if ((dayIndex - (profile.offsetDays ?? 0)) % profile.everyDays !== 0) continue;
    for (const crop of crops) {
      if (profile.productionUnitIds && !profile.productionUnitIds.includes(crop.productionUnitId)) continue;
      if (profile.variable === 'stage') {
        // A scout samples today's stage. It is visible only after report delivery.
        // Alternate crop packs with different vocabularies need an explicit report schema.
        if (!OBSERVATION_CATEGORIES.stage.includes(crop.stage)) continue;
        result.push(createObservation({ id: `${profile.id}:${crop.id}:${date}`, productionUnitId: crop.productionUnitId,
          sourceType: profile.sourceType, sourceId: profile.id, variable: 'stage', valueType: 'category', value: crop.stage,
          unit: '', uncertainty: profile.uncertainty, coverage: 1, reliability: profile.reliability,
          observedAt: date, availableAt: addDays(date, profile.delayDays), freshness: profile.freshness }));
        continue;
      }
      const value = crop.trueState[profile.variable];
      if (!Number.isFinite(value)) throw new TypeError(`Unknown observed crop variable: ${profile.variable}`);
      result.push(createObservation({ id: `${profile.id}:${crop.id}:${date}`, productionUnitId: crop.productionUnitId,
        sourceType: profile.sourceType, sourceId: profile.id, variable: profile.variable,
        value: Math.max(0, Math.min(1, value + (profile.bias ?? 0) + random.between(-profile.uncertainty, profile.uncertainty))),
        unit: 'ratio', uncertainty: profile.uncertainty, coverage: 1, reliability: profile.reliability,
        observedAt: date, availableAt: addDays(date, profile.delayDays), freshness: profile.freshness }));
    }
  }
  return result;
}

/** Actors receive the same available evidence, but can weigh its sources differently. */
export function updateBeliefs(people, observations, date) {
  const evidence = availableObservations(observations, date).filter(o => o.status !== 'invalid' && Number.isFinite(o.value) && o.valueType !== 'category');
  const latest = new Map();
  for (const observation of evidence) {
    const key = `${observation.productionUnitId}:${observation.variable}:${observation.sourceId}`;
    if (!latest.has(key) || latest.get(key).observedAt <= observation.observedAt) latest.set(key, observation);
  }
  const groups = new Map();
  for (const observation of latest.values()) {
    const key = `${observation.productionUnitId}:${observation.variable}`;
    groups.set(key, [...(groups.get(key) || []), observation]);
  }
  return people.flatMap(person => [...groups.values()].map(samples => {
    const weights = samples.map(o => (person.traits.sourceWeights?.[o.sourceType] ?? 1) * o.reliability * o.coverage * (o.status === 'stale' ? 0.25 : 1));
    const total = weights.reduce((sum, w) => sum + w, 0);
    const estimate = total ? samples.reduce((sum, o, i) => sum + o.value * weights[i], 0) / total : 0;
    return createBelief({ id: `${person.id}:${samples[0].productionUnitId}:${samples[0].variable}`,
      actorId: person.id, productionUnitId: samples[0].productionUnitId, subject: samples[0].variable,
      estimate, probability: Math.max(0, Math.min(1, estimate + (person.traits.riskBias ?? 0))),
      confidence: Math.min(1, total / samples.length), basedOnObservationIds: samples.map(o => o.id), updatedAt: date });
  }));
}
