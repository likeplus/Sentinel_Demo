export const SAVE_KEY = 'sentinel:farm-game:save:v1';
export const SAVE_VERSION = 1;
export const CONTENT_VERSION = 'farm-sim-phase2-v1';

/** Deduplicate repeated historical observations, retaining current/stale versions separately. */
export function encodeSave(checkpoint, requestSequence = 0) {
  const pool = [];
  const lookup = new Map();
  const views = checkpoint.views.map(([date, view]) => [date, { ...view, observations: view.observations.map(observation => {
    const key = JSON.stringify(observation);
    if (!lookup.has(key)) { lookup.set(key, pool.length); pool.push(observation); }
    return lookup.get(key);
  }) }]);
  return JSON.stringify({ saveVersion: SAVE_VERSION, contentVersion: CONTENT_VERSION,
    encoding: 'observation-pool-v1', requestSequence, observationPool: pool, checkpoint: { ...checkpoint, views } });
}

export function decodeSave(text) {
  const save = JSON.parse(text);
  if (save.saveVersion !== SAVE_VERSION || save.contentVersion !== CONTENT_VERSION) throw new Error('存档版本与当前试玩不兼容');
  if (save.encoding !== 'observation-pool-v1' || !Array.isArray(save.observationPool)
    || !save.checkpoint || !Array.isArray(save.checkpoint.views) || !Number.isInteger(save.requestSequence) || save.requestSequence < 0) {
    throw new Error('存档结构不完整');
  }
  const views = save.checkpoint.views.map(([date, view]) => [date, { ...view, observations: view.observations.map(index => {
    if (!Number.isInteger(index) || index < 0 || index >= save.observationPool.length) throw new Error('存档观测索引无效');
    return save.observationPool[index];
  }) }]);
  return { checkpoint: { ...save.checkpoint, views }, requestSequence: save.requestSequence };
}
