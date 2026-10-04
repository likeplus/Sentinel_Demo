import { SimulationEngine } from '../simulation/SimulationEngine.js';
import { blueberryPack } from '../crop-packs/blueberry/index.js';
import { createYunnanBlueberryFixture } from '../scenarios/yunnan-blueberry-28d/index.js';
import { addDays, clone, daysBetween } from '../domain/validation.js';
import { buildGameModel } from './selectors.js';
import { SAVE_KEY, encodeSave, decodeSave } from './persistence.js';

const REGISTRY = { blueberry: blueberryPack };
const CONFLICT_LABELS = { capacity: '当天资源容量不足', inventory: '资源库存不足', unavailable: '资源不可用',
  incompatible: '资源不支持该作业', incompatible_operation: '资源不支持该作业', missing_resource: '找不到所选资源',
  manager_attention: '今日管理注意力不足', cash: '现金不足', insufficient_cash: '现金不足', quantity: '采购数量不符合限制' };

/** Browser session owns the engine privately. Subscribers receive only the safe view and projection. */
export class GameController {
  #engine = null;
  #storage;
  #registry;
  #baseFixture;
  #listeners = new Set();
  #snapshot;
  #requestSequence = 0;
  #storageStatus = { state: 'memory', message: '本轮暂存于内存' };
  #error = null;

  constructor(options = {}) {
    this.#registry = options.cropPacks || REGISTRY;
    this.#baseFixture = clone(options.fixture || createYunnanBlueberryFixture(options.scenarioOverrides || {}));
    if (Object.hasOwn(options, 'storage')) this.#storage = options.storage;
    else {
      try { this.#storage = typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage; }
      catch { this.#storage = null; this.#storageStatus = { state: 'warning', message: '浏览器无法读取存档，本轮暂存于内存' }; }
    }
    let saved = null;
    try { saved = this.#storage?.getItem(SAVE_KEY); }
    catch { this.#storage = null; this.#storageStatus = { state: 'warning', message: '无法读取本地存档，本轮暂存于内存' }; }
    if (saved) {
      try {
        const restored = decodeSave(saved);
        this.#engine = SimulationEngine.restore(restored.checkpoint, this.#registry);
        this.#baseFixture = clone(restored.checkpoint.fixture);
        this.#requestSequence = restored.requestSequence;
        this.#storageStatus = { state: 'saved', message: '已恢复自动存档', savedDate: this.#engine.currentDate };
        this.#publish();
      } catch (error) {
        this.#engine = null;
        this.#storageStatus = { state: 'blocked', message: `${error.message}。原存档已保留，选择重新开始后才会覆盖。` };
        this.#publish();
      }
    } else {
      this.#engine = new SimulationEngine(this.#baseFixture, this.#registry);
      this.#save();
      this.#publish();
    }
  }

  subscribe = listener => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  getSnapshot = () => this.#snapshot;

  #metadata() {
    const config = this.#baseFixture.scenario;
    const varieties = Object.fromEntries(Object.values(this.#registry).flatMap(pack => Object.values(pack.varieties).map(variety => [variety.id, { id: variety.id, name: variety.name }])));
    return { scenario: { id: config.id, name: config.name, startDate: config.startDate, endDate: config.endDate },
      varieties, criticalResourceIds: config.criticalResourceIds, emergencySupplies: config.emergencySupplies || [],
      riskThresholds: config.riskThresholds, initialResources: this.#baseFixture.resources.map(resource => ({ id: resource.id, quantity: resource.quantity })) };
  }

  #publish() {
    const view = this.#engine?.getPlayerView() ?? null;
    this.#snapshot = { view, model: view ? buildGameModel(view, this.#metadata()) : null,
      storageStatus: { ...this.#storageStatus }, error: this.#error };
    for (const listener of this.#listeners) listener();
  }

  #save() {
    if (!this.#storage) return;
    try {
      this.#storage.setItem(SAVE_KEY, encodeSave(this.#engine.exportCheckpoint(), this.#requestSequence));
      this.#storageStatus = { state: 'saved', message: '已自动保存', savedDate: this.#engine.currentDate };
    } catch {
      this.#storageStatus = { state: 'warning', message: '自动存档失败，当前仍可试玩；刷新可能丢失本次进度' };
    }
  }

  #request() { return `game:${this.#engine.currentDate}:${++this.#requestSequence}`; }
  #conflictMessage(conflict) {
    const resource = this.#engine.getPlayerView().resources.find(item => item.id === conflict.resourceId);
    const label = conflict.message || CONFLICT_LABELS[conflict.type] || '资源冲突';
    const quantity = value => Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    const unit = conflict.type === 'capacity' ? '人员/设备日' : conflict.type === 'manager_attention' ? '点'
      : conflict.type === 'cash' ? '元' : resource?.unit === 'm3' ? 'm³' : resource?.unit || '';
    return [label, resource ? `${resource.name}（${resource.id}）` : conflict.resourceId,
      conflict.date, Number.isFinite(conflict.requested) && Number.isFinite(conflict.available)
        ? `需求 ${quantity(conflict.requested)}，可用 ${quantity(conflict.available)} ${unit}` : null].filter(Boolean).join(' · ');
  }
  #run(action) {
    if (!this.#engine) return { accepted: false, conflicts: [], error: '请先处理存档提示' };
    try {
      const result = action();
      const response = result?.accepted === undefined ? { accepted: true, conflicts: [] } : result;
      this.#error = response.accepted ? null : response.conflicts.map(conflict => this.#conflictMessage(conflict)).join('；');
      if (response.accepted) this.#save();
      this.#publish();
      return { ...response, error: this.#error };
    } catch (error) {
      this.#error = error.message;
      this.#publish();
      return { accepted: false, conflicts: [], error: error.message };
    }
  }

  advance() { return this.#run(() => this.#engine.advanceOneDay()); }
  decide(caseId, selection) { return this.#run(() => this.#engine.decide(caseId, { ...selection, requestId: selection.requestId || this.#request() })); }
  inspect(unitId, options = {}) { return this.#run(() => this.#engine.inspectUnit(unitId, { ...options, requestId: options.requestId || this.#request() })); }
  approve(caseId, selection = {}) { return this.#run(() => this.#engine.approveDelegation(caseId, { ...selection, requestId: selection.requestId || this.#request() })); }
  reject(caseId, selection = {}) { return this.#run(() => this.#engine.rejectDelegation(caseId, { ...selection, requestId: selection.requestId || this.#request() })); }
  reschedule(operationId, date) { return this.#run(() => this.#engine.rescheduleOperation(operationId, date, { requestId: this.#request() })); }
  purchase(resourceId, quantity, requestId) { return this.#run(() => this.#engine.purchaseResource(resourceId, quantity, { requestId: requestId || this.#request() })); }
  clearError() { this.#error = null; this.#publish(); }

  restart({ seed, days } = {}) {
    try {
      const scenario = this.#baseFixture.scenario;
      const duration = days ?? daysBetween(scenario.startDate, scenario.endDate);
      if (!Number.isInteger(duration) || duration < 1 || duration > 365) throw new Error('试玩时长需为 1–365 个整数天');
      const nextFixture = clone(this.#baseFixture);
      nextFixture.scenario.seed = seed ?? scenario.seed;
      nextFixture.scenario.endDate = addDays(scenario.startDate, duration);
      nextFixture.scenario.endConditions = [{ type: 'date', date: nextFixture.scenario.endDate }];
      const engine = new SimulationEngine(nextFixture, this.#registry);
      this.#engine = engine;
      this.#baseFixture = nextFixture;
      this.#requestSequence = 0;
      this.#error = null;
      this.#save();
      this.#publish();
      return { accepted: true, conflicts: [] };
    } catch (error) {
      this.#error = error.message;
      this.#publish();
      return { accepted: false, conflicts: [], error: error.message };
    }
  }
  resumeFresh() { return this.restart(); }
}

export const createGameController = options => new GameController(options);
