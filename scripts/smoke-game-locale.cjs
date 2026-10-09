const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const out = '/tmp/sentinel-game-localization';
const previews = 'docs/validation/screenshots/latest';
(async () => {
  await fs.mkdir(out, { recursive: true });
  await fs.mkdir(previews, { recursive: true });
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', d => { if (d.toString().includes('Local:')) resolve(); }); server.on('error', reject); server.on('exit', c => reject(new Error(`Server exit ${c}`))); });
    browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage(), errors = [], audit = {};
    page.on('pageerror', e => errors.push(e.message)); await page.setViewport({ width: 1440, height: 1050 });
    await page.goto('http://127.0.0.1:5193/game', { waitUntil: 'networkidle0' });
    const click = async id => { const s = `[data-testid="${id}"]`; await page.waitForSelector(s); await page.$eval(s, e => e.scrollIntoView({ block: 'center' })); await page.click(s); };
    const body = () => page.$eval('[data-testid="game-root"]', e => e.innerText);
    const { decodeSave } = await import('../src/game/persistence.js');
    const checkpoint = async () => decodeSave(await page.evaluate(() => localStorage.getItem('sentinel:farm-game:save:v1'))).checkpoint;
    assert.equal(await page.$eval('[data-testid="game-root"]', e => e.dataset.locale), 'zh');
    const initial = await checkpoint();
    await click('tab-map');
    const age = await page.$eval('[data-testid="freshness-PU-01"]', e => e.textContent);
    assert.match(age, /水分信息更新: 当天/); assert.match(age, /作物与设备信息更新: 当天/);
    assert.match(await page.$eval('[data-testid="freshness-PU-05"]', e => e.textContent), /作物与设备信息更新: 5天前/);
    assert.doesNotMatch(age, /0d|作物\s*\d+天|5天\+/);
    assert.match(await page.$eval('[data-testid="freshness-PU-04"]', e => e.textContent), /暂无信息/);
    await click('table-unit-PU-05'); await page.select('[data-testid="cluster-filter"]', 'CL-1');
    assert.notEqual(await page.$eval('[data-testid="selected-unit"]', e => e.dataset.unitId), 'PU-05', 'details remain inside the visible filter');
    await page.select('[data-testid="cluster-filter"]', 'all');
    for (const tab of ['guide', 'knowledge']) { await click(`tab-${tab}`); if (tab === 'guide') { await page.evaluate(() => document.querySelectorAll('details').forEach(d => {d.open = true;})); assert.match(await body(), /信息新鲜度：这些信息是什么时候获得的/); assert.match(await body(), /例如昨天巡查、今天传感器更新/); } assert.deepEqual(await checkpoint(), initial, 'reading guides does not change time, resources or game state'); }
    await click('locale-en'); assert.deepEqual(await checkpoint(), initial, 'switching language does not mutate game state');
    for (const locale of ['en', 'zh']) {
      await click(`locale-${locale}`); audit[locale] = {};
      for (const tab of ['map', 'today', 'operations', 'units', 'decisions', 'management', 'guide', 'knowledge']) {
        await click(`tab-${tab}`);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
        const text = await body(); audit[locale][tab] = text;
        if (locale === 'en') {
          const chinese = text.split('\n').filter(line => /[\u4e00-\u9fff]/.test(line) && line.trim() !== '中文');
          assert.deepEqual(chinese, [], `English ${tab} contains untranslated system text`);
        } else {
          const english = text.split('\n').filter(line => /[A-Za-z]{3,}/.test(line) && !/^SENTINEL|Sentinel|O'Neal|Legacy|Bluecrop|soil-PU|PU-|^CL-|^\d/.test(line));
          assert.deepEqual(english.filter(line => !/^[a-z0-9_-]+(?:\.[0-9]+)?$/.test(line)), [], `Chinese ${tab} contains English interface terms`);
        }
      }
    }
    await click('tab-map'); await click('table-unit-PU-04'); await page.$eval('[data-testid="unit-delegate-ai"]', e => e.click());
    await click('tab-decisions'); await click('accept-DEC-1');
    await click('tab-operations'); await page.select('[data-testid="task-unit"]', 'PU-01'); await click('attach-manual_watering'); await click('task-confirm');
    await click('advance-day'); await click('tab-today'); await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    audit.zh.results = await body(); await click('locale-en'); audit.en.results = await body();
    assert.deepEqual(audit.en.results.split('\n').filter(line => /[\u4e00-\u9fff]/.test(line) && line !== '中文'), [], 'English execution and AI history remain localized');
    for (const tab of ['map', 'operations', 'decisions', 'management']) { await click(`tab-${tab}`); await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; })); const content = await body(); assert.deepEqual(content.split('\n').filter(line => /[\u4e00-\u9fff]/.test(line) && line !== '中文'), [], `English ${tab} localizes execution reports and rationale`); }
    await click('advance-day');
    for (let i = 0; i < 2; i++) { await click('advance-day'); await click('advance-day'); }
    await click('tab-decisions'); await click('ai-delegate-water-stress-pu03');
    await click('advance-day'); await click('advance-day');
    await click('tab-decisions'); await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    assert.deepEqual((await body()).split('\n').filter(line => /[\u4e00-\u9fff]/.test(line) && line !== '中文'), [], 'English authored case and AI proposal');
    await click('locale-zh');
    if (await page.$('[data-testid="onboarding-dismiss"]')) await click('onboarding-dismiss');
    await page.setViewport({ width: 1920, height: 1080 });
    for (const [index, tab] of ['map', 'today', 'decisions', 'operations', 'guide', 'knowledge'].entries()) {
      await click(`tab-${tab}`);
      if (tab === 'map') await click('table-unit-PU-04');
      await page.setViewport({ width: 1920, height: 1080 });
      const height = await page.evaluate(() => { document.querySelectorAll('details').forEach(d => { d.open = false; }); const main = document.querySelector('.fg-main'); main.scrollTop = 0; return Math.max(1080, main.scrollHeight + document.querySelector('.fg-topbar').offsetHeight + 2); });
      await page.setViewport({ width: 1920, height });
      await page.evaluate(() => { document.querySelector('.fg-main').scrollTop = 0; window.scrollTo(0, 0); });
      await page.screenshot({ path: `${previews}/${String(index + 1).padStart(2, '0')}-${tab}-zh.png`, fullPage: true });
    }
    for (const locale of ['en', 'zh']) { await click(`locale-${locale}`); await click('tab-map'); await page.screenshot({ path: `${out}/overview-${locale}.png`, fullPage: true }); }
    await click('locale-en'); const saved = await checkpoint(); await page.reload({ waitUntil: 'networkidle0' }); assert.equal(await page.$eval('[data-testid="game-root"]', e => e.dataset.locale), 'en'); assert.deepEqual(await checkpoint(), saved);
    await page.goto('http://127.0.0.1:5193/', { waitUntil: 'networkidle0' }); assert.ok((await page.$eval('.page-title', e => e.innerText)).includes('Mission Control'), 'legacy Demo shares English choice');
    await page.evaluate(() => [...document.querySelectorAll('.topbar button')].find(b => b.textContent.trim() === 'Chinese').click());
    await page.goto('http://127.0.0.1:5193/game', { waitUntil: 'networkidle0' }); assert.equal(await page.$eval('[data-testid="game-root"]', e => e.dataset.locale), 'zh');
    await page.setViewport({ width: 390, height: 844 });
    for (const tab of ['map', 'guide', 'knowledge']) { await click(`tab-${tab}`); assert.ok(await page.$eval('body', e => e.scrollWidth) <= 395, `${tab} fits mobile`); }
    await page.screenshot({ path: `${out}/mobile-language-tabs.png`, fullPage: true }); assert.ok(await page.$eval('body', e => e.scrollWidth) <= 395); assert.deepEqual(errors, []);
    await fs.writeFile(`${out}/audit.json`, JSON.stringify(audit, null, 2)); console.log('PASS: locale persistence, shared Demo preference, unchanged game state, mobile switch, no runtime errors. Audit:', out);
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
