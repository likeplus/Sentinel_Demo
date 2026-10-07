// Run against a local Vite server. All player actions use the real browser UI.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const puppeteer = require('puppeteer');

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const outputDir = process.env.SMOKE_OUTPUT_DIR || '/tmp/sentinel-phase2-browser';
const saveKey = 'sentinel:farm-game:save:v1';
const selector = id => `[data-testid="${id}"]`;
const errorSelector = '[data-testid="game-error"],.fg-feedback[role="alert"]';
const dateAfter = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

function checkpointOf(record) {
  const candidates = [record?.checkpoint, record?.engineCheckpoint, record?.engine, record];
  const checkpoint = candidates.find(candidate => candidate?.state?.currentDate && candidate?.random);
  assert.ok(checkpoint, 'autosave must contain a restorable engine checkpoint');
  return checkpoint;
}

(async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];
  const timings = [];
  const screenshots = [];
  let page;
  try {
    page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1365, height: 900 });
    const response = await page.goto(`${baseUrl}/game`, { waitUntil: 'networkidle0' });
    assert.equal(response.status(), 200, '/game');
    await page.waitForSelector(selector('game-root'));

    const readSave = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
    const readCheckpoint = async () => checkpointOf(await readSave());
    const saved = async () => {
      await page.waitForFunction(id => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        return el && (el.dataset.status === 'saved' || /已.*保存|已恢复|保存成功|saved/i.test(el.textContent));
      }, {}, 'save-status');
    };
    const click = async (id, options = {}) => {
      await page.waitForSelector(selector(id));
      await page.$eval(selector(id), el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await page.waitForSelector(selector(id), { visible: true });
      await page.click(selector(id), options);
    };
    const fill = async (id, value) => {
      await page.waitForSelector(selector(id));
      await page.$eval(selector(id), el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await page.waitForSelector(selector(id), { visible: true });
      await page.$eval(selector(id), (el, next) => {
        const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, next);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, String(value));
    };
    const commitClick = async (id, options) => {
      const before = await page.evaluate(key => localStorage.getItem(key), saveKey);
      await click(id, options);
      await page.waitForFunction((key, previous) => localStorage.getItem(key) !== previous, {}, saveKey, before);
      await saved();
    };
    const showError = async () => {
      await page.waitForSelector(errorSelector);
      await page.$eval(errorSelector, el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await page.waitForSelector(errorSelector, { visible: true });
    };
    const absentOrDisabled = async id => page.$eval(selector('game-root'), (root, testId) => {
      const el = root.querySelector(`[data-testid="${testId}"]`);
      return !el || el.disabled;
    }, id);
    const screenshot = async filename => {
      const target = path.join(outputDir, filename);
      await page.screenshot({ path: target, fullPage: true });
      screenshots.push(target);
    };
    const advance = async () => {
      const before = await readCheckpoint();
      const start = performance.now();
      await click('advance-day');
      await page.waitForFunction(day => Number(document.querySelector('[data-testid="game-root"]')?.dataset.dayIndex) === day, {}, before.state.currentDayIndex + 1);
      await saved();
      const after = await readCheckpoint();
      assert.equal(after.state.currentDate, dateAfter(before.state.currentDate, 1), 'one click advances one calendar day');
      assert.equal(after.state.currentDayIndex, before.state.currentDayIndex + 1);
      timings.push(performance.now() - start);
      return after;
    };
    const selectUnit = async id => {
      await click('tab-map');
      await click(`map-unit-${id}`);
      await page.waitForFunction(unitId => document.querySelector('[data-testid="selected-unit"]')?.textContent.includes(unitId), {}, id);
    };
    const inspect = async (unitId, date, expectAccepted = true) => {
      await selectUnit(unitId);
      if (!(await page.$(selector('inspect-date')))) await click('inspect-unit');
      await fill('inspect-date', date);
      await page.select(selector('inspect-crew'), 'crew-a');
      await fill('inspect-reason', 'Browser acceptance: confirm field evidence before deciding.');
      const before = await readCheckpoint();
      if (expectAccepted) {
        await commitClick('inspect-confirm');
        const after = await readCheckpoint();
        assert.equal(after.state.scheduledOperations.length, before.state.scheduledOperations.length + 1, 'inspection creates one operation');
        return after.state.scheduledOperations.at(-1);
      }
      await click('inspect-confirm');
      await showError();
      assert.deepEqual(await readCheckpoint(), before, 'rejected inspection leaves Attention, schedule, and cash unchanged');
      const error = await page.$eval(errorSelector, el => el.textContent);
      assert.match(error, /crew|劳动力|容量|capacity|资源|冲突/i, 'resource rejection explains the conflict');
      assert.match(error, /crew-a|班组 A/, 'conflict identifies the occupied crew');
      assert.match(error, /1\.25/, 'conflict states the requested daily capacity');
      assert.ok(error.includes(date), 'conflict identifies the planned date');
      return null;
    };
    const assertObservationAbsent = async id => assert.equal(await page.$(selector(`observation-${id}`)), null, `${id} is not rendered before delivery`);
    const selectAction = async (caseId, optionId, reason) => {
      await click('tab-decisions');
      await click(`action-${optionId}`);
      await fill(`reason-${caseId}`, reason);
      await fill(`plan-date-${caseId}`, dateAfter((await readCheckpoint()).state.currentDate, 1));
      await commitClick(`submit-case-${caseId}`);
    };

    await saved();
    assert.equal((await readCheckpoint()).state.currentDayIndex, 0, 'fresh browser starts at day zero');
    await screenshot('game-desktop-overview.png');
    assert.equal(await page.$$eval('[data-testid^="map-unit-"]', els => els.length), 12, 'all 12 PU geometries render');
    assert.equal(await page.$eval(selector('map-unit-PU-01'), el => el.dataset.observationStatus), 'current');
    assert.equal(await page.$eval(selector('map-unit-PU-05'), el => el.dataset.observationStatus), 'stale');
    assert.equal(await page.$eval(selector('map-unit-PU-09'), el => el.dataset.observationStatus), 'unknown', 'stage and water freshness remain independent');
    await page.select(selector('cluster-filter'), 'CL-1');
    assert.equal(await page.$$eval('[data-testid^="map-unit-"]', els => els.length), 4, 'cluster filter shows its four PU geometries');
    await page.select(selector('cluster-filter'), 'all');
    const varietyId = await page.$eval(selector('variety-filter'), el => [...el.options].find(option => option.value !== 'all').value);
    await page.select(selector('variety-filter'), varietyId);
    assert.equal(await page.$$eval('[data-testid^="map-unit-"]', els => els.length), 4, 'variety filter spans clusters');
    await page.select(selector('variety-filter'), 'all');
    await page.evaluate(() => [...document.querySelectorAll('.fg-layer-toggle button')].find(button => button.textContent === '作业与决策').click());
    assert.equal(await page.$eval(selector('farm-map'), el => el.dataset.layer), 'tasks');
    await page.evaluate(() => [...document.querySelectorAll('.fg-layer-toggle button')].find(button => button.textContent === '水分与风险').click());
    assert.equal(await page.$eval(selector('farm-map'), el => el.dataset.layer), 'water');
    await page.click('[aria-label="缩小地图"]');
    assert.equal(await page.$$('.farm-map__cluster-button').then(els => els.length), 3, 'zoomed-out map aggregates the three clusters');
    await page.click('.farm-map__cluster-button');
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="farm-map"]')?.dataset.zoom) === 1);
    await page.click('[aria-label="显示整个农场"]');
    // Puppeteer 19's ElementHandle.focus rejects SVG elements; native SVG focus is supported.
    await page.$eval(selector('map-unit-PU-09'), el => el.focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-testid="selected-unit"]')?.textContent.includes('PU-09'));
    await screenshot('game-desktop-map.png');

    async function play28Days(runIndex) {
      const initial = await readCheckpoint();
      assert.equal(initial.state.currentDayIndex, 0);
      const inspection = await inspect('PU-03', '2026-03-02');
      if (runIndex === 0) {
        const savedBefore = await readSave();
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForSelector(selector('game-root'));
        await saved();
        assert.deepEqual(checkpointOf(await readSave()), checkpointOf(savedBefore), 'reload preserves the simulation exactly');
        assert.match(await page.$eval(selector('selected-unit'), el => el.textContent), /PU-03/, 'reload restores PU selection');
      }
      const dayOne = await advance();
      assert.equal(dayOne.state.scheduledOperations.find(op => op.id === inspection.id).executionStatus, 'completed');
      const pendingInspection = dayOne.state.observations.filter(obs => obs.sourceId === `inspection:${inspection.id}`);
      assert.ok(pendingInspection.length > 0, 'inspection produces a report with a delivery delay');
      for (const report of pendingInspection) {
        assert.ok(report.availableAt > dayOne.state.currentDate);
        await assertObservationAbsent(report.id);
      }
      await advance();
      await selectUnit('PU-03');
      for (const report of pendingInspection) await page.waitForSelector(selector(`observation-${report.id}`));
      await advance();
      await click('tab-decisions');
      await page.waitForSelector(selector('case-water-stress-pu03'));
      await click('delegate-water-stress-pu03');
      await fill('reason-water-stress-pu03', 'Browser acceptance: ask agronomist to propose an evidence-based response.');
      await page.select(selector('delegate-person-water-stress-pu03'), 'agronomist');
      const beforeDelegate = await readCheckpoint();
      await commitClick('submit-case-water-stress-pu03');
      const afterDelegate = await readCheckpoint();
      assert.equal(afterDelegate.state.scheduledOperations.length, beforeDelegate.state.scheduledOperations.length, 'delegation does not execute without approval');
      assert.ok(await absentOrDisabled('approve-water-stress-pu03'), 'approval is unavailable before proposal delivery');
      await advance();
      await click('tab-decisions');
      await assertObservationAbsent('pu03-lab-day4');
      await page.waitForSelector(selector('approve-water-stress-pu03'), { visible: true });
      await fill('reason-water-stress-pu03', 'Browser acceptance: approve the delivered recommendation.');
      await fill('plan-date-water-stress-pu03', '2026-03-06');
      const beforeApproval = await readCheckpoint();
      await commitClick('approve-water-stress-pu03');
      const afterApproval = await readCheckpoint();
      assert.equal(afterApproval.state.scheduledOperations.length, beforeApproval.state.scheduledOperations.length + 1, 'approval creates one plan');
      const approved = afterApproval.state.scheduledOperations.at(-1);
      assert.equal(approved.type, 'irrigation', 'default-seed agronomist proposes the configured irrigation response');
      assert.equal(approved.plannedDurationDays, 0.5);

      // Fill the remaining crew day, then recover a rejected plan and rejected reschedule.
      await inspect('PU-01', approved.plannedStart);
      await inspect('PU-02', approved.plannedStart);
      await inspect('PU-04', approved.plannedStart, false);
      const recovered = await inspect('PU-04', dateAfter(approved.plannedStart, 1));
      await click('tab-operations');
      await click(`reschedule-open-${recovered.id}`);
      await fill(`reschedule-date-${recovered.id}`, approved.plannedStart);
      const beforeConflict = await readCheckpoint();
      await click(`reschedule-${recovered.id}`);
      await showError();
      assert.deepEqual(await readCheckpoint(), beforeConflict, 'conflicting reschedule preserves the previous reservation');
      await fill(`reschedule-date-${recovered.id}`, dateAfter(approved.plannedStart, 2));
      await commitClick(`reschedule-${recovered.id}`);
      assert.equal((await readCheckpoint()).state.scheduledOperations.find(op => op.id === recovered.id).plannedStart, dateAfter(approved.plannedStart, 2));

      await click('tab-management');
      const beforePurchase = await readCheckpoint();
      await click('purchase-water');
      assert.deepEqual(await readCheckpoint(), beforePurchase, 'opening a purchase confirmation does not charge money');
      await commitClick('purchase-confirm', { clickCount: 2 });
      const afterPurchase = await readCheckpoint();
      const cashSpent = beforePurchase.state.farmState.finance.cash - afterPurchase.state.farmState.finance.cash;
      const waterBought = afterPurchase.state.farmState.resources.find(r => r.id === 'water').quantity - beforePurchase.state.farmState.resources.find(r => r.id === 'water').quantity;
      assert.ok(cashSpent > 0 && waterBought > 0, 'confirmed purchase debits cash and increases water');
      assert.equal(cashSpent, waterBought * 2, 'configured supply price reconciles');
      assert.equal(afterPurchase.state.farmState.finance.transactions.length, beforePurchase.state.farmState.finance.transactions.length + 1, 'purchase creates exactly one ledger entry');

      await advance();
      await selectUnit('PU-03');
      await page.waitForSelector(selector('observation-pu03-lab-day4'));
      assert.equal((await readCheckpoint()).state.currentDate, '2026-03-06');
      const acted = new Set(['water-stress-pu03']);
      while (!(await readCheckpoint()).state.ended) {
        const checkpoint = await readCheckpoint();
        for (const decision of checkpoint.state.openDecisionCases) {
          if (acted.has(decision.id) || !['open', 'delayed'].includes(decision.status)) continue;
          const option = decision.actionOptions.find(item => item.type === 'decide_now' && item.operation);
          assert.ok(option, `${decision.id} includes a playable operation`);
          await selectAction(decision.id, option.id, 'Browser acceptance: act on delivered evidence and available resources.');
          acted.add(decision.id);
        }
        await advance();
      }
      const terminal = await readCheckpoint();
      assert.equal(terminal.state.currentDayIndex, 28, 'browser completes all 28 daily steps');
      assert.equal(terminal.state.currentDate, '2026-03-29');
      assert.ok(acted.has('valve-disruption'), 'default seed reaches the equipment decision');
      assert.ok(acted.has('pre-harvest'), 'default seed reaches the pre-harvest tradeoff');
      assert.ok(await absentOrDisabled('advance-day'), 'time control stops at the configured end');
      await click('tab-management');
      await page.waitForSelector(selector('review'));
      const review = await page.$eval(selector('review'), el => el.textContent);
      assert.match(review, /现金|财务/);
      assert.match(review, /水/);
      assert.match(review, /作业|运营/);
      assert.match(review, /决策/);
      assert.match(review, /预计|预测/, 'review labels forecast output distinctly');
      assert.doesNotMatch(review, /总分/, 'review retains separate outcome dimensions');
      assert.equal(terminal.state.farmState.finance.transactions.length, new Set(terminal.state.farmState.finance.transactions.map(tx => tx.id)).size, 'ledger never duplicates entries');
      return terminal;
    }

    const first = await play28Days(0);
    await page.$eval('.fg-main', el => el.scrollTo(0, 0));
    await screenshot('game-desktop-review.png');
    await page.setViewport({ width: 390, height: 844 });
    await click('tab-map');
    await page.$eval('.fg-main', el => el.scrollTo(0, 0));
    await screenshot('game-mobile-overview.png');
    await selectUnit('PU-03');
    await screenshot('game-mobile-map.png');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile layout has no horizontal page overflow');
    await page.setViewport({ width: 1365, height: 900 });

    await click('restart-open');
    await click('restart-same');
    await commitClick('restart-confirm');
    const second = await play28Days(1);
    assert.deepEqual(second.state, first.state, 'same seed and the same ordered browser actions reproduce terminal state');
    assert.deepEqual(second.random, first.random, 'same-seed UI replay reproduces random cursor');

    await click('restart-open');
    await click('restart-new');
    await fill('restart-seed', 'browser-acceptance-new-seed');
    await commitClick('restart-confirm');
    assert.equal((await readCheckpoint()).state.randomSeed, 'browser-acceptance-new-seed');
    assert.equal((await readCheckpoint()).random.seed, 'browser-acceptance-new-seed');
    assert.notEqual((await readCheckpoint()).random.seed, first.random.seed, 'new seed initializes a distinct random stream');
    await advance();

    // An incompatible save is retained until the player explicitly starts a new run.
    const incompatibleSave = JSON.stringify({ ...await readSave(), saveVersion: 999 });
    await page.evaluate((key, record) => localStorage.setItem(key, record), saveKey, incompatibleSave);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector(selector('recover-save'), { visible: true });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), saveKey), incompatibleSave, 'unsupported save is not silently overwritten');
    await page.click('.fg-confirm-check input');
    await commitClick('recover-save');
    assert.equal((await readCheckpoint()).state.currentDayIndex, 0, 'explicit recovery starts a playable new run');

    assert.deepEqual(errors, [], 'no uncaught JavaScript errors during play, reload, restart, or responsive layout');
    const sortedTimings = timings.toSorted((a, b) => a - b);
    console.log(JSON.stringify({
      result: 'PASS', dailyClicks: timings.length, terminalDate: first.state.currentDate,
      decisionCases: first.state.openDecisionCases.map(item => ({ id: item.id, status: item.status })),
      operations: first.state.scheduledOperations.length,
      advanceMs: { median: Math.round(sortedTimings[Math.floor(sortedTimings.length / 2)]), max: Math.round(Math.max(...timings)) },
      screenshots,
      verified: ['map selection, filters, layers and keyboard/zoom', 'delayed reports', 'approval delegation', 'capacity conflict recovery', 'reschedule rollback', 'confirmed water purchase', 'autosave reload', '28-day review', 'same-seed replay', 'new seed', 'unsupported save recovery', 'responsive layout'],
    }, null, 2));
  } catch (error) {
    if (page) console.error(JSON.stringify({ browserErrors: errors, date: await page.$eval(selector('game-date'), el => el.textContent).catch(() => null), displayedError: await page.$eval(errorSelector, el => el.textContent).catch(() => null) }));
    if (page) await page.screenshot({ path: path.join(outputDir, 'game-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
