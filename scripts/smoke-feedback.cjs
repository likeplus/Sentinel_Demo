// Integrated Phase 2 browser acceptance: actions use the actual /game UI.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const puppeteer = require('puppeteer');
const url = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const out = process.env.SMOKE_OUTPUT_DIR || '/tmp/sentinel-phase2-feedback';
const key = 'sentinel:farm-game:save:v1';
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await browser.newPage(), errors = [], results = [];
  p.on('pageerror', e => errors.push(e.message)); p.setDefaultTimeout(15000);
  const sel = id => `[data-testid="${id}"]`;
  const click = async id => { await p.waitForSelector(sel(id)); await p.$eval(sel(id), e => e.scrollIntoView({ block: 'center' })); await p.click(sel(id)); };
  const fill = async (id, value) => p.$eval(sel(id), (el, value) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  const save = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const cp = async () => (await save()).checkpoint;
  const commit = async id => { const previous = await p.evaluate(key => localStorage.getItem(key), key); await click(id); await p.waitForFunction((key, old) => localStorage.getItem(key) !== old, {}, key, previous); };
  const phase = async () => { const previous = (await cp()).state.management.phase; await commit('advance-day'); assert.notEqual((await cp()).state.management.phase, previous); };
  const day = async () => { const before = (await cp()).state.currentDayIndex; await phase(); await phase(); await phase(); assert.equal((await cp()).state.currentDayIndex, before + 1); };
  const shot = async name => { await p.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };
  try {
    await p.setViewport({ width: 1440, height: 960 }); await p.goto(`${url}/game`, { waitUntil: 'networkidle0' });
    await p.waitForSelector(sel('farm-status-table')); assert.equal((await cp()).state.management.phase, 'morning');
    assert.equal(await p.$$(sel('farm-status-table') + ' tbody tr').then(x => x.length), 12);
    await shot('01-table-onboarding'); await commit('onboarding-dismiss');
    await p.setViewport({ width: 1920, height: 1600 }); await shot('00-full-overview'); await p.setViewport({ width: 1440, height: 960 });
    await click('view-spatial'); assert.equal(await p.$$('[data-testid^="map-unit-"]').then(x => x.length), 12);
    assert.equal(await p.$$('[data-layer-status]').then(x => x.length), 48);
    await p.select(sel('cluster-filter'), 'CL-1'); assert.equal(await p.$$('[data-testid^="map-unit-"]').then(x => x.length), 4);
    await p.select(sel('cluster-filter'), 'all');
    const variety = await p.$eval(sel('variety-filter'), e => e.options[1].value); await p.select(sel('variety-filter'), variety); assert.equal(await p.$$('[data-testid^="map-unit-"]').then(x => x.length), 4); await p.select(sel('variety-filter'), 'all');
    await p.click('[aria-label="缩小地图"]'); assert.equal(await p.$$('.farm-map__cluster-button').then(x => x.length), 3); await p.click('.farm-map__cluster-button'); await p.click('[aria-label="显示整个农场"]');
    await p.$eval(sel('map-unit-PU-09'), e => e.focus()); await p.keyboard.press('Enter'); assert.equal(await p.$eval(sel('selected-unit'), e => e.dataset.unitId), 'PU-09');
    await shot('02-map-layers'); results.push('Original geometry, filters, zoom, keyboard selection, 4 simultaneous layers');
    await click('tab-operations'); await p.select(sel('task-unit'), 'PU-01'); await click('attach-manual_watering'); await click('attach-spraying'); await commit('task-confirm');
    const first = (await cp()).state.scheduledOperations[0]; assert.equal(first.labor, 4); assert.equal((await cp()).state.attention.remaining, 3);
    await p.select(sel('task-action'), 'spraying'); const beforeDuplicate = await cp(); await click('task-confirm'); await p.waitForSelector('.fb-duplicate'); assert.deepEqual(await cp(), beforeDuplicate); assert.match(await p.$eval(sel('game-error'), e => e.textContent), /already scheduled|已安排这项作业/);
    await p.select(sel('task-action'), 'repair'); await commit('task-confirm'); const repair = (await cp()).state.scheduledOperations.at(-1); await commit(`cancel-${repair.id}`); assert.equal((await cp()).state.scheduledOperations.at(-1).executionStatus, 'cancelled');
    await p.select(sel('task-action'), 'sensor_relocation'); await p.select(sel('task-unit'), 'PU-04'); await commit('task-confirm');
    await shot('03-operations-planner'); const beforeReload = await cp(); await p.reload({ waitUntil: 'networkidle0' }); assert.deepEqual(await cp(), beforeReload);
    results.push('Today composite, duplicate prevention, cancellation, sensor move reservation, reload exactness');
    await click('tab-today'); await phase(); let state = (await cp()).state;
    assert.equal(state.scheduledOperations[0].executionStatus, 'completed'); assert.ok(state.management.expectedImpacts[0].to < state.management.expectedImpacts[0].from);
    assert.equal(state.management.sensors.find(s => !s.fixed).location, 'PU-04');
    await shot('04-execution-results'); await click('tab-operations'); assert.equal(await p.$eval(sel('task-confirm'), e => e.matches(':disabled')), true);
    await phase(); await phase(); assert.equal((await cp()).state.management.units, undefined); // state uses estimates, public units are projected.
    assert.ok((await cp()).state.management.estimates['PU-04'].value !== null);
    results.push('Same-day execution, Water Stress decrease, phase scheduling lock, next-morning sensor freshness');
    await day(); await day(); // March 4, original authored decision opens.
    await click('tab-decisions'); await commit('ai-delegate-water-stress-pu03'); assert.equal((await cp()).state.attention.remaining, 3); await day();
    await click('tab-decisions'); await p.waitForSelector(sel('approve-water-stress-pu03'));
    assert.equal(await p.$(sel('plan-date-water-stress-pu03')), null, 'AI offers no Modify');
    await commit('approve-water-stress-pu03'); const accepted = (await cp()).state.scheduledOperations.at(-1); assert.equal(accepted.plannedStart, (await cp()).state.currentDate); assert.equal((await cp()).state.attention.remaining, 3);
    await click('tab-management'); const cash = (await cp()).state.farmState.finance.cash; await click('purchase-water'); assert.equal((await cp()).state.farmState.finance.cash, cash); await commit('purchase-confirm'); assert.equal((await cp()).state.farmState.finance.cash, cash - 200);
    results.push('Original authored delegation, delayed proposal, AI Accept/Reject, no Attention charge, purchase confirmation and ledger');
    while (!(await cp()).state.ended) {
      const state = (await cp()).state;
      // Preserve original authored manager decision path, plan Today after paying entry once.
      for (const d of state.openDecisionCases.filter(d => d.status === 'open')) {
        await click('tab-decisions');
        const entry = await p.$(sel(`manager-enter-${d.id}`));
        if (entry && !(await entry.evaluate(e => e.disabled))) await commit(`manager-enter-${d.id}`);
        const option = d.actionOptions.find(o => o.type === 'decide_now' && o.operation);
        if (option) { await click(`action-${option.id}`); const button = await p.$(sel(`submit-case-${d.id}`)); if (button && !(await button.evaluate(e => e.disabled))) await click(`submit-case-${d.id}`); }
      }
      await day();
    }
    await click('tab-management'); const final = await cp(); assert.equal(final.state.currentDayIndex, 28); assert.equal(await p.$$('.fg-review-dimensions > article').then(x => x.length), 5); assert.equal(await p.$eval(sel('advance-day'), e => e.disabled), true);
    await shot('05-season-review'); results.push('28-day complete season, original manager cases, financial transactions, all 5 review dimensions');
    await p.setViewport({ width: 390, height: 844 }); await shot('06-mobile-review');
    assert.ok(await p.$eval('body', e => e.scrollWidth) <= 395, 'mobile page fits screen');
    await click('restart-open'); await commit('restart-confirm'); assert.equal((await cp()).state.currentDayIndex, 0); assert.equal((await cp()).state.management.phase, 'morning');
    await p.setViewport({ width: 1440, height: 960 }); await click('tab-map'); await shot('07-restarted');
    assert.deepEqual(errors, []); results.push('Mobile layout, restart, no browser runtime exceptions');
    await fs.writeFile(`${out}/acceptance.json`, JSON.stringify({ results, errors, finalSaveBytes: JSON.stringify(final).length }, null, 2)); console.log(JSON.stringify({ results, errors, artifacts: out }, null, 2));
  } catch (e) { await shot('failure'); throw e; } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
