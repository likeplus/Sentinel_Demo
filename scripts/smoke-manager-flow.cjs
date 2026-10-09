// Exercise selection and planning through real controls, without injecting game state.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const puppeteer = require('puppeteer');
(async () => {
  const { decodeSave } = await import('../src/game/persistence.js');
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(), errors = [], out = '/tmp/sentinel-manager-flow';
  page.on('pageerror', e => errors.push(e.message)); await fs.mkdir(out, { recursive: true });
  const sel = id => `[data-testid="${id}"]`;
  const click = async id => { await page.waitForSelector(sel(id)); await page.$eval(sel(id), e => e.scrollIntoView({ block: 'center' })); await page.click(sel(id)); };
  const raw = () => page.evaluate(() => localStorage.getItem('sentinel:farm-game:save:v1'));
  const checkpoint = async () => decodeSave(await raw()).checkpoint;
  const count = async n => assert.equal(await page.$eval(sel('selection-count'), e => Number(e.textContent.match(/\d+/)[0])), n);
  try {
    await page.setViewport({ width: 1440, height: 1000 }); await page.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'}/game`, { waitUntil: 'networkidle0' });
    assert.equal(await page.$eval(sel('tab-today'), e => e.getAttribute('aria-current')), 'page'); await click('onboarding-dismiss');
    await click('tab-map'); await click('select-PU-01'); await click('selection-PU-02'); await count(2);
    await click('view-spatial'); assert.equal(await page.$eval(sel('map-select-PU-01'), e => e.getAttribute('aria-checked')), 'true');
    await page.$eval(sel('map-select-PU-03'), e => e.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await count(3);
    await click('tab-units'); await click('card-select-PU-04'); await count(4);
    await click('view-table'); assert.equal(await page.$eval(sel('select-PU-04'), e => e.checked), true);
    await click('batch-plan'); await click('task-confirm');
    let state = (await checkpoint()).state; assert.equal(state.scheduledOperations.length, 4); assert.equal(state.management.decisions.length, 4); assert.equal(state.attention.remaining, 3);
    assert.equal(await page.$eval(sel('task-confirm'), e => e.disabled), true, 'successful submission cannot be repeated accidentally');
    await click('tab-map'); await click('batch-plan'); await page.waitForSelector('.fb-duplicate');
    const before = await raw(); assert.equal(await page.$eval(sel('task-confirm'), e => e.disabled), true); assert.equal(await raw(), before);
    const first = state.scheduledOperations[0].id, currentUrl = page.url(); await click(`duplicate-view-${first}`);
    assert.equal(page.url(), currentUrl, 'view is UI navigation, not a fragment route change'); assert.ok(await page.$(sel(`operation-${first}`)));
    await click(`cancel-${first}`); assert.equal((await checkpoint()).state.scheduledOperations[0].executionStatus, 'cancelled');
    await click('tab-map'); await click('select-PU-05'); await page.select(sel('cluster-filter'), 'CL-1'); await count(4); await page.select(sel('cluster-filter'), 'all');
    await click('batch-plan'); const beforeAttentionConflict = await raw(); await page.select(sel('task-action'), 'manager_inspection'); await page.waitForFunction(() => document.querySelector('[data-testid="task-confirm"]').disabled); assert.equal(await raw(), beforeAttentionConflict);
    await page.select(sel('task-action'), 'sensor_relocation'); assert.match(await page.$eval(sel('task-planner'), e => e.textContent), /一个移动传感器|one Mobile Sensor/);
    await click('advance-day'); assert.equal((await checkpoint()).state.management.phase, 'end_of_day'); assert.equal((await checkpoint()).state.currentDayIndex, 0);
    assert.ok(await page.$(sel('tab-today'))); assert.match(await page.$eval('.fg-main', e => e.textContent), /PU-02/);
    const endOfDay = await raw(); await page.reload({ waitUntil: 'networkidle0' }); assert.equal(await raw(), endOfDay);
    await click('advance-day'); assert.equal((await checkpoint()).state.currentDayIndex, 1);
    // Fill the rest of the season with four inspections per day through the batch form.
    let phaseClicks = 2;
    while (!(await checkpoint()).state.ended) {
      await click('tab-map'); await click('selection-PU-01'); await click('selection-PU-02'); await click('selection-PU-03'); await click('selection-PU-04');
      await click('batch-plan'); await click('task-confirm'); await click('advance-day'); await click('advance-day'); phaseClicks += 2;
      // New day retains the chosen operation group; clear using the existing selection control.
      if (!(await checkpoint()).state.ended) { await click('tab-map'); await page.$eval(sel('unit-selection'), e => [...e.querySelectorAll('button')].find(b => /清空|Clear/.test(b.textContent)).click()); }
      assert.equal(await page.$eval(sel('save-status'), e => e.textContent.includes('进度已保存')), true);
    }
    assert.equal(phaseClicks, 56); const final = await checkpoint(), saveChars = (await raw()).length;
    assert.equal(final.state.currentDayIndex, 28); assert.equal(final.views.length, 29); assert.ok(saveChars * 2 < 5 * 1024 * 1024);
    await page.reload({ waitUntil: 'networkidle0' }); assert.deepEqual(await checkpoint(), final);
    await click('tab-operations'); await page.evaluate(() => document.querySelectorAll('details').forEach(e => {e.open = true;}));
    assert.match(await page.$eval('[data-testid="schedule-calendars"]', e => e.textContent), /03-22/); assert.match(await page.$eval('[data-testid="schedule-calendars"]', e => e.textContent), /03-28/);
    assert.equal(await page.$(sel('task-confirm')), null, 'season end offers review only'); assert.deepEqual(errors, []);
    const report = { phaseClicks, days: 28, operations: final.state.scheduledOperations.length, storedChars: saveChars, utf16Bytes: saveChars * 2, historicalDays: final.views.length, errors };
    await fs.writeFile(`${out}/acceptance.json`, JSON.stringify(report, null, 2)); console.log('PASS manager selection/atomic planning, duplicate navigation, 28-day quota and reload:', report);
  } catch(e) { await page.screenshot({ path: `${out}/failure.png`, fullPage: true }); throw e; } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
