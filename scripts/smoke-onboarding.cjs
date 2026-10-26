const { idle, respondToPending } = require('./game-browser-helpers.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

(async () => {
  const out = '/tmp/sentinel-onboarding';
  await fs.mkdir(out, { recursive: true });
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5195', '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
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
    await page.goto('http://127.0.0.1:5195/game', { waitUntil: 'networkidle0' });
    const sel = id => `[data-testid="${id}"]`;
    const click = async id => { await page.waitForSelector(sel(id)); await page.$eval(sel(id), element => { for (let p = element.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !(element.tagName === 'SUMMARY' && p === element.parentElement)) p.open = true; element.scrollIntoView({ block: 'center' }); }); await page.click(sel(id)); await idle(page); };
    const raw = () => page.evaluate(() => localStorage.getItem('sentinel:farm-game:save:v1'));
    const { decodeSave } = await import('../src/game/persistence.js');
    const checkpoint = async () => decodeSave(await raw()).checkpoint;
    const gameplay = async () => { const state = (await checkpoint()).state; delete state.management.onboarded; return state; };
    const expanded = async open => { await page.waitForFunction((selector, open) => document.querySelector(selector)?.open === open, {}, sel('onboarding'), open); };
    const otherTabs = ['decisions', 'management', 'guide', 'knowledge'];
    const baseline = await gameplay(), initialSave = await raw();
    await expanded(true);
    assert.equal(await page.$(`${sel('onboarding')} .fg-eyebrow`), null);
    assert.equal(await page.$eval(sel('onboarding-dismiss'), element => element.innerText), '收起说明');
    await page.screenshot({ path: `${out}/expanded-zh.png`, fullPage: true });
    for (const tab of otherTabs) { await click(`tab-${tab}`); assert.equal(await page.$(sel('onboarding')), null, `${tab} has no onboarding card`); }
    assert.deepEqual(await gameplay(), baseline);
    await click('tab-map'); await expanded(true);
    // Closing the native summary also acknowledges the initial guide; no game resource changes.
    await click('onboarding-toggle'); await expanded(false);
    await page.waitForFunction(initialSave => localStorage.getItem('sentinel:farm-game:save:v1') !== initialSave, {}, initialSave);
    assert.equal((await checkpoint()).state.management.onboarded, true);
    assert.deepEqual(await gameplay(), baseline);
    const acknowledged = await raw();
    await page.screenshot({ path: `${out}/collapsed-zh.png`, fullPage: true });
    await page.focus(sel('onboarding-toggle')); await page.keyboard.press('Enter'); await expanded(true);
    assert.equal(await raw(), acknowledged, 'reopening does not alter the save');
    await click('onboarding-dismiss'); await expanded(false);
    assert.equal(await raw(), acknowledged, 'collapsing a read guide does not alter gameplay');
    await click('tab-guide'); await click('tab-map'); await expanded(false);
    await page.reload({ waitUntil: 'networkidle0' }); await expanded(false); assert.equal(await raw(), acknowledged);
    await click('onboarding-toggle'); await expanded(true); await click('locale-en');
    assert.equal(await page.$eval(sel('onboarding-toggle'), element => element.innerText), 'Daily gameplay guide');
    assert.equal(await page.$eval(sel('onboarding-dismiss'), element => element.innerText), 'Collapse instructions');
    assert.doesNotMatch(await page.$eval(sel('onboarding'), element => element.innerText), /[\u4e00-\u9fff]|PHASE 2/);
    assert.equal(await raw(), acknowledged);
    // Even when temporarily reopened, the next morning uses the saved collapsed default.
    await click('advance-day'); await click('advance-day'); await expanded(false);
    assert.equal((await checkpoint()).state.currentDayIndex, 1);
    const nextMorning = await raw(); await click('onboarding-toggle'); await expanded(true);
    await click('onboarding-dismiss'); await expanded(false); assert.equal(await raw(), nextMorning);
    await click('locale-zh'); await page.setViewport({ width: 390, height: 844 });
    await click('onboarding-toggle'); await expanded(true);
    assert.ok(await page.$eval('body', element => element.scrollWidth) <= 395);
    await click('onboarding-dismiss'); await expanded(false);
    // Restarting with the same seed must still reset the new-session expanded guide.
    await page.setViewport({ width: 1440, height: 1000 }); await click('restart-open'); await click('restart-confirm'); await expanded(true);
    assert.equal((await checkpoint()).state.currentDayIndex, 0);
    await click('onboarding-dismiss'); await expanded(false);
    assert.deepEqual(await gameplay(), baseline);
    assert.deepEqual(errors, []);
    const report = { onlyOverview: true, otherTabsChecked: otherTabs, removedEyebrow: true,
      collapseSaved: true, reopenFree: true, keyboard: true, reload: true, nextMorning: true, sameSeedRestart: true,
      locales: ['zh', 'en'], mobileWidth: 390, errors };
    await fs.writeFile(`${out}/acceptance.json`, JSON.stringify(report, null, 2)); console.log('PASS onboarding:', report);
  } catch (error) { if (browser) { const pages = await browser.pages(); await pages.at(-1)?.screenshot({ path: `${out}/failure.png`, fullPage: true }); } throw error; }
  finally { if (browser) await browser.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
