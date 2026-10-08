export const SAVE_KEY = 'sentinel:farm-game:save:v1';
export const SAVE_VERSION = 1;
export const CONTENT_VERSION = 'farm-sim-phase2-feedback-v2';

/** Intern the entire JSON graph, including repeated historical snapshots. No history is dropped. */
export function encodeSave(checkpoint, requestSequence = 0) {
  const pool = [], lookup = new Map();
  const intern = value => {
    const node = Array.isArray(value) ? ['a', value.map(intern)]
      : value && typeof value === 'object' ? ['o', Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, intern(v)])]
      : ['v', value ?? null];
    const key = JSON.stringify(node);
    if (!lookup.has(key)) { lookup.set(key, pool.length); pool.push(node); }
    return lookup.get(key);
  };
  const root = intern(checkpoint);
  return JSON.stringify({ saveVersion: SAVE_VERSION, contentVersion: CONTENT_VERSION,
    encoding: 'object-pool-v2', requestSequence, root, pool });
}

export function decodeSave(text) {
  const save = JSON.parse(text);
  if (save.saveVersion !== SAVE_VERSION || save.contentVersion !== CONTENT_VERSION) throw new Error('存档版本与当前试玩不兼容');
  if (!Number.isInteger(save.requestSequence) || save.requestSequence < 0) throw new Error('存档结构不完整');
  if (save.encoding === 'object-pool-v2') {
    if (!Array.isArray(save.pool)) throw new Error('存档结构不完整');
    const memo = new Map(), visiting = new Set();
    const hydrate = index => {
      if (!Number.isInteger(index) || index < 0 || index >= save.pool.length || visiting.has(index)) throw new Error('存档索引无效');
      if (memo.has(index)) return memo.get(index);
      visiting.add(index);
      const node = save.pool[index];
      if (!Array.isArray(node) || node.length !== 2) throw new Error('存档节点无效');
      const [type, data] = node;
      let value;
      if (type === 'v' && (data === null || ['string', 'number', 'boolean'].includes(typeof data))) value = data;
      else if (type === 'a' && Array.isArray(data)) value = data.map(hydrate);
      else if (type === 'o' && Array.isArray(data)) value = Object.fromEntries(data.map(pair => {
        if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') throw new Error('存档字段无效');
        return [pair[0], hydrate(pair[1])];
      }));
      else throw new Error('存档节点无效');
      memo.set(index, value); visiting.delete(index); return value;
    };
    const checkpoint = hydrate(save.root);
    if (!checkpoint || !Array.isArray(checkpoint.views)) throw new Error('存档结构不完整');
    return { checkpoint, requestSequence: save.requestSequence };
  }
  // Existing Phase 2 saves remain readable and are upgraded on the next successful write.
  if (save.encoding !== 'observation-pool-v1' || !Array.isArray(save.observationPool)
    || !save.checkpoint || !Array.isArray(save.checkpoint.views)) throw new Error('存档结构不完整');
  const views = save.checkpoint.views.map(([date, view]) => [date, { ...view, observations: view.observations.map(index => {
    if (!Number.isInteger(index) || index < 0 || index >= save.observationPool.length) throw new Error('存档观测索引无效');
    return save.observationPool[index];
  }) }]);
  return { checkpoint: { ...save.checkpoint, views }, requestSequence: save.requestSequence };
}
