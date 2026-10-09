const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

(async () => {
  const out = '/tmp/sentinel-review-clarity';
  await fs.mkdir(out, { recursive: true });
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5194', '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on('data', data => { if (data.toString().includes('Local:')) resolve(); });
      server.on('error', reject); server.on('exit', code => reject(new Error(`Server exit ${code}`)));
    });
    browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:5194/game', { waitUntil: 'networkidle0' });
    const selector = id => `[data-testid="${id}"]`;
    const click = async id => {
      await page.waitForSelector(selector(id));
      await page.$eval(selector(id), element => element.scrollIntoView({ block: 'center' }));
      await page.click(selector(id));
    };
    const text = id => page.$eval(selector(id), element => element.textContent);
    const rawSave = () => page.evaluate(() => localStorage.getItem('sentinel:farm-game:save:v1'));
    await click('onboarding-dismiss');
    assert.doesNotMatch(await text('pending-decisions'), /资源与人员|劳动力|注意力/);
    await click('tab-map'); await click('table-unit-PU-01');
    const beforeReading = await rawSave();
    await click('unit-knowledge'); await page.waitForSelector('[data-current-stage="true"]');
    assert.equal(await page.$eval('[data-current-stage="true"]', element => element.dataset.guideCard), 'ripening');
    assert.match(await text('knowledge-context'), /PU-01.*转熟期/);
    await page.waitForFunction(() => {
      const card = document.querySelector('[data-current-stage="true"]'), rect = card.getBoundingClientRect();
      return rect.top >= 0 && rect.top < innerHeight;
    });
    await page.screenshot({ path: `${out}/current-stage-zh.png`, fullPage: true });
    await click('locale-en'); assert.match(await text('knowledge-context'), /PU-01.*Ripening/);
    assert.equal(await rawSave(), beforeReading, 'reading and switching language leave the save unchanged');
    await click('tab-map'); await click('table-unit-PU-09'); await click('unit-knowledge');
    assert.equal(await page.$('[data-current-stage="true"]'), null);
    assert.match(await text('knowledge-context'), /Stage unknown/);
    await click('tab-knowledge'); assert.equal(await page.$(selector('knowledge-context')), null, 'sidebar opens the general encyclopedia');
    await click('locale-zh'); await click('tab-operations');
    await page.select(selector('task-unit'), 'PU-01'); await click('attach-manual_watering'); await click('task-confirm');
    await click('advance-day');
    await page.waitForSelector(selector('daily-review-table'));
    const reportZh = await text('daily-feedback');
    assert.match(reportZh, /作物状态.*设备状态/); assert.doesNotMatch(reportZh, /Condition/);
    assert.match(reportZh, /预计水分胁迫/);
    const row = `${selector('daily-review-table')} tbody tr`;
    assert.equal(await page.$$eval(row, rows => rows.length), 1);
    assert.equal(await page.$eval(`${row} [data-review-water]`, element => element.textContent), '15');
    assert.equal(await page.$eval(`${row} [data-review-labor]`, element => element.textContent), '3');
    assert.equal(await page.$eval(`${row} details`, element => element.open), false);
    await page.$eval(`${row} details`, element => { element.open = true; });
    const expandedZh = await text('daily-feedback');
    assert.doesNotMatch(expandedZh, /Observation|Condition|source|Time|Efficiency/);
    await click('locale-en');
    const reportEn = await text('daily-feedback');
    assert.doesNotMatch(reportEn, /[\u4e00-\u9fff]/);
    assert.match(reportEn, /Crop condition.*Equipment condition/);
    await page.$eval(selector('daily-review-table'), element => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${out}/end-of-day-en.png`, fullPage: true });
    await page.$eval(`${row} details`, element => { element.open = false; });
    await click('locale-zh'); await page.$eval(selector('daily-review-table'), element => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${out}/end-of-day-zh.png`, fullPage: true });
    await click('locale-en'); await click('advance-day');
    const nextDayText = await text('pending-decisions');
    assert.match(nextDayText, /\d+\.\d°C/); assert.doesNotMatch(nextDayText, /\d+\.\d{2,}°C/);
    assert.match(await text('daily-review-table'), /2026-03-01/);
    const saveBeforeReload = await rawSave(); await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await rawSave(), saveBeforeReload);
    assert.match(await text('daily-review-table'), /2026-03-01/);
    await click('locale-zh'); await page.screenshot({ path: `${out}/next-morning-zh.png`, fullPage: true });
    await page.setViewport({ width: 390, height: 844 });
    assert.ok(await page.$eval('body', element => element.scrollWidth) <= 395, 'review table scrolls within the mobile page');
    await page.$eval(selector('daily-review-table'), element => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${out}/review-mobile.png`, fullPage: true });
    assert.deepEqual(errors, []);
    const results = { knownStage: 'ripening', unknownStageRetained: true, localeCoverage: ['zh', 'en'], consumedWater: 15,
      labor: 3, historicalWorkDate: '2026-03-01', nextMorningWeather: nextDayText, mobileWidth: 390, errors };
    await fs.writeFile(`${out}/acceptance.json`, JSON.stringify(results, null, 2));
    console.log('PASS review clarity: context navigation, unknown evidence, bilingual report, actual consumption, temperature, reload and mobile.', results);
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
