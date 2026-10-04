import { describe, expect, it } from 'vitest';
import { RandomEngine } from '../src/simulation/RandomEngine.js';
import { availableObservations, updateBeliefs } from '../src/simulation/ObservationEngine.js';
import { createObservation, createPerson } from '../src/domain/index.js';
const sample = extra => createObservation({id:'day4',productionUnitId:'PU-03',sourceId:'lab',sourceType:'lab',variable:'waterStress',value:0.7,
  observedAt:'2026-03-04',availableAt:'2026-03-06',freshness:3,...extra});

describe('RandomEngine', () => {
  it('reproduces sequences for equal seeds and differentiates other seeds', () => {
    const draws=seed=>{const r=new RandomEngine(seed);return Array.from({length:100},()=>r.next());};
    expect(draws('seed')).toEqual(draws('seed'));expect(draws('seed')).not.toEqual(draws('different'));
    expect(draws(0).every(n=>n>=0 && n<1)).toBe(true);
  });
  it('restores the exact next draws through JSON serialization', () => {
    const r=new RandomEngine('restore');r.next();r.gaussian();
    const restored=RandomEngine.restore(JSON.parse(JSON.stringify(r.exportState())));
    expect(Array.from({length:100},()=>restored.next())).toEqual(Array.from({length:100},()=>r.next()));
  });
  it('bounds helpers and rejects invalid input', () => {
    const r=new RandomEngine(10);
    expect(r.chance(0)).toBe(false);expect(r.chance(1)).toBe(true);
    for(let i=0;i<100;i++){expect(r.between(-2,3)).toBeGreaterThanOrEqual(-2);expect(r.between(-2,3)).toBeLessThan(3);}
    expect(Number.isFinite(r.gaussian())).toBe(true);
    expect(()=>r.chance(1.1)).toThrow();expect(()=>r.between(3,2)).toThrow();expect(()=>new RandomEngine(NaN)).toThrow();
    expect(()=>RandomEngine.restore({seed:1,state:-1})).toThrow();
  });
});
describe('observation and belief time boundaries', () => {
  it('hides Day-4 sample until Day-6 availability, including exact timestamps', () => {
    const observation=sample();
    expect(availableObservations([observation],'2026-03-05')).toEqual([]);
    expect(availableObservations([observation],'2026-03-06')).toHaveLength(1);
    const timed=sample({observedAt:'2026-03-04T12:00:00Z',availableAt:'2026-03-06T12:00:00Z'});
    expect(availableObservations([timed],'2026-03-06T11:59:59Z')).toEqual([]);
    expect(availableObservations([timed],'2026-03-06T12:00:00Z')).toHaveLength(1);
  });
  it('stales evidence without mutating observations or crop truth', () => {
    const observation=sample(); const truth={waterStress:0.2};
    expect(availableObservations([observation],'2026-03-08')[0].status).toBe('stale');
    expect(observation.status).toBe('current');expect(truth.waterStress).toBe(0.2);
    expect(availableObservations([sample({status:'invalid'})],'2026-03-08')[0].status).toBe('invalid');
  });
  it('two actors interpret the same available evidence differently; unavailable/invalid evidence is excluded', () => {
    const people=[createPerson({id:'agro',name:'Agronomist',role:'agronomist',traits:{sourceWeights:{sensor:0.5,worker:2}}}),
      createPerson({id:'sentinel',name:'Sentinel',role:'agent',traits:{sourceWeights:{sensor:2,worker:0.5}}})];
    const observations=[sample({id:'sensor',sourceId:'s',sourceType:'sensor',availableAt:'2026-03-04',value:0.85}),
      sample({id:'worker',sourceId:'w',sourceType:'worker',availableAt:'2026-03-04',value:0.2}),sample(),sample({id:'invalid',sourceId:'bad',status:'invalid'})];
    const beliefs=updateBeliefs(people,observations,'2026-03-05');
    expect(beliefs[0].basedOnObservationIds).toEqual(['sensor','worker']);
    expect(beliefs[1].basedOnObservationIds).toEqual(beliefs[0].basedOnObservationIds);
    expect(beliefs[0].estimate).toBeLessThan(beliefs[1].estimate);
  });
});
