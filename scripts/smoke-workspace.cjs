// A manager's playthrough uses real controls; save reads verify domain effects.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const puppeteer = require('puppeteer');
(async () => {
  const out = process.env.WORKSPACE_SCREENSHOTS || 'docs/validation/screenshots/workspace';
  await fs.mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await browser.newPage(), errors = [], checks = [];
  p.on('pageerror', e => errors.push(e.message));
  const sel = id => `[data-testid="${id}"]`;
  const click = async id => { await p.waitForSelector(sel(id)); await p.$eval(sel(id), e => { for (let parent = e.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS' && !(e.tagName === 'SUMMARY' && parent === e.parentElement)) parent.open = true; e.scrollIntoView({ block: 'center' }); }); await p.click(sel(id)); };
  const fill = async (id, value) => p.$eval(sel(id), (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  const raw = () => p.evaluate(() => localStorage.getItem('sentinel:farm-game:save:v1'));
  const { decodeSave } = await import('../src/game/persistence.js');
  const state = async () => decodeSave(await raw()).checkpoint.state;
  const text = id => p.$eval(sel(id), e => e.innerText);
  const capture = async name => {
    await p.setViewport({ width: 1920, height: 1080 });
    const height = await p.evaluate(() => { document.querySelectorAll('.fb-scroll').forEach(e => { e.scrollTop = 0; e.scrollLeft = 0; }); const main = document.querySelector('.fg-main'); main.scrollTop = 0; return Math.max(1080, main.scrollHeight + 70); });
    await p.setViewport({ width: 1920, height }); await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    await p.setViewport({ width: 1920, height: 1080 });
  };
  try {
    await p.setViewport({ width: 1920, height: 1080 }); await p.goto(`${process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5190'}/game`, { waitUntil: 'networkidle0' });
    await click('onboarding-dismiss');
    assert.equal(await p.$eval(sel('tab-map'), e => e.getAttribute('aria-current')), 'page');
    for (const removed of ['today', 'units', 'operations']) assert.equal(await p.$(sel(`tab-${removed}`)), null);
    const columns = await p.evaluate(() => ['farm-observation-column', 'farm-planning-column'].map(id => { const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect(); return { x: r.x, width: r.width }; }));
    assert.ok(columns[0].x + columns[0].width < columns[1].x);
    assert.match(await text('inspection-confidence-PU-01'), /70%/); assert.match(await text('pest-signs-PU-01'), /未单独记录/);
    assert.match(await text('inspection-confidence-PU-04'), /暂无巡查/);
    await capture('01-overview');
    const beforeRead = await raw();
    await click('toggle-calendar'); await p.select(sel('calendar-mode'), 'observation'); await click('calendar-PU-01-2026-03-01');
    assert.match(await text('calendar-detail'), /现场人员/);
    await click('view-spatial'); assert.equal(await p.$$('[data-layer-status]').then(x => x.length), 48);
    await click('map-unit-PU-05'); await capture('02-map-calendar');
    await click('view-table');
    // Set a future draft, read the crop context, and resume without re-entry.
    await p.select(sel('task-action'), 'manual_watering'); await fill('task-date', '2026-03-02'); await fill('task-reason', '先核对设备，再补水');
    await click('unit-knowledge'); await click('tab-map');
    assert.equal(await p.$eval(sel('task-date'), e => e.value), '2026-03-02');
    assert.equal(await p.$eval(sel('task-action'), e => e.value), 'manual_watering');
    assert.equal(await p.$eval(sel('task-reason'), e => e.value), '先核对设备，再补水');
    assert.equal(await raw(), beforeRead);
    await click('select-PU-04'); await click('selection-PU-05');
    assert.match(await text('task-planner'), /PU-04 · PU-05/);
    assert.equal(await text('remaining-labor'), '4');
    await click('task-confirm'); let s = await state(); assert.equal(s.scheduledOperations.length, 2); assert.equal(s.attention.remaining, 3);
    assert.ok(s.scheduledOperations.every(op => op.plannedStart === '2026-03-02'));
    await p.$eval(sel('unit-selection'), e => [...e.querySelectorAll('button')].find(b => /清空/.test(b.textContent)).click());
    await p.select(sel('task-unit'), 'PU-01'); await fill('task-date', '2026-03-01'); await p.select(sel('task-action'), 'inspection'); await click('attach-manual_watering');
    await click('task-confirm'); s = await state(); assert.equal(s.scheduledOperations.at(-1).labor, 3);
    const inspectionId = s.scheduledOperations.at(-1).id;
    await p.select(sel('operation-unit-filter'), 'PU-04');
    await p.$eval(`${sel('task-created')} button`, e => {e.scrollIntoView({block: 'center'}); e.click();});
    await p.waitForSelector(sel(`operation-${inspectionId}`), {visible: true});
    assert.ok(await p.$eval(sel(`operation-${inspectionId}`), e => e.getBoundingClientRect().height > 0), 'linked tasks stay reachable across task filters');
    await p.select(sel('operation-unit-filter'), 'all');
    await click('advance-day'); s = await state(); assert.equal(s.management.phase, 'end_of_day');
    const report = s.observations.find(o => o.taskId === s.scheduledOperations.at(-1).id && o.domain === 'crop_equipment');
    assert.ok(report); assert.equal(report.reliability, .9);
    assert.match(await text('inspection-confidence-PU-01'), /90%/);
    assert.match(await text('pest-signs-PU-01'), /未见病虫害迹象|发现病虫害迹象/);
    assert.match(await text('daily-feedback'), /预计水分胁迫/);
    const reviewBox = await p.$eval(sel('daily-feedback'), e => e.getBoundingClientRect().top);
    const taskBox = await p.$eval('.fg-workspace-tasks', e => e.getBoundingClientRect().top);
    assert.ok(reviewBox < taskBox, 'settlement moves ahead of the remaining task list');
    await capture('03-results');
    const frozen = await raw(); await p.reload({ waitUntil: 'networkidle0' }); assert.equal(await raw(), frozen);
    assert.equal(await p.$eval(sel('toggle-calendar'), e => e.checked), true);
    await click('advance-day'); s = await state(); assert.equal(s.currentDate, '2026-03-02');
    assert.match(await text('freshness-PU-01'), /当天/); assert.match(await text('pest-signs-PU-01'), /1天前/);
    assert.match(await text('inspection-confidence-PU-01'), /90%/);
    await click('advance-day'); s = await state(); assert.ok(s.scheduledOperations.filter(op => op.plannedStart === '2026-03-02').every(op => op.executionStatus === 'completed'));
    await click('advance-day');
    await click('tab-management'); assert.ok(await p.$(sel('sensor-assets'))); assert.equal(await p.$eval('.fb-trend', e => e.getBoundingClientRect().width), 0, 'trend is not shown in the assets view');
    await capture('04-assets');
    await click('relocate-soil-PU-03'); assert.equal(await p.$eval(sel('task-action'), e => e.value), 'sensor_relocation');
    await p.select(sel('task-unit'), 'PU-06'); await click('task-confirm'); await click('advance-day');
    s = await state(); assert.equal(s.management.sensors.find(sensor => !sensor.fixed).location, 'PU-06');
    await click('tab-guide'); assert.match(await p.$eval('.fg-main', e => e.innerText), /病虫害|信息/); await capture('05-gameplay-guide');
    await click('tab-knowledge'); await capture('06-crop-knowledge');
    // Legacy preferences migrate without mutating the saved run.
    const stable = await raw();
    for (const tab of ['today', 'operations', 'units']) {
      await p.evaluate(tab => localStorage.setItem('sentinel:farm-game:ui:v1', JSON.stringify({ tab, selectedUnitId: 'PU-01', showCalendar: true })), tab);
      await p.reload({ waitUntil: 'networkidle0' }); assert.equal(await p.$eval(sel('tab-map'), e => e.getAttribute('aria-current')), 'page'); assert.equal(await raw(), stable);
    }
    await p.setViewport({ width: 390, height: 844 }); assert.ok(await p.$eval('body', e => e.scrollWidth) <= 395);
    await click('locale-en'); assert.doesNotMatch(await p.$eval('.fg-main', e => e.innerText), /[\u4e00-\u9fff]/);
    checks.push('Merged desktop workspace', 'inspection confidence and historical unknowns', 'table/map multi-select', 'inline calendar', 'draft survives knowledge navigation', 'future and same-day operations', 'settlement then next morning', 'independent sensor freshness', 'asset-based relocation', 'old preference migration', 'task links across filters', 'mobile width', 'read-only browsing');
    assert.deepEqual(errors, []);
    await fs.writeFile('/tmp/workspace-playthrough.json', JSON.stringify({ checks, errors, screenshots: out, completedDayIndex: s.currentDayIndex }, null, 2));
    console.log('PASS workspace manager playthrough:', checks);
  } catch (e) { await p.screenshot({ path: '/tmp/workspace-playthrough-failure.png', fullPage: true }); throw e; } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
