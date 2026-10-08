// Verify the production artifact on a strict static server without SPA rewrites.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const base = '/Sentinel_Demo/';
const root = path.resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const filename = path.resolve(root, decodeURIComponent(url.pathname.slice(base.length)) || 'index.html');
    if (!url.pathname.startsWith(base) || !filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
    fs.createReadStream(filename).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage(), errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    await page.setViewport({ width: 1440, height: 1000 });
    const click = async id => { const sel = `[data-testid="${id}"]`; await page.waitForSelector(sel); await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await page.click(sel); };
    const { decodeSave } = await import('../src/game/persistence.js');
    const checkpoint = async () => decodeSave(await page.evaluate(() => localStorage.getItem('sentinel:farm-game:save:v1'))).checkpoint;
    await page.goto(`${origin}${base}#/game`, { waitUntil: 'networkidle0' });
    await click('tab-map'); await page.waitForSelector('[data-testid="farm-status-table"]');
    await click('onboarding-dismiss');
    for (const tab of ['map', 'today', 'operations', 'units', 'decisions', 'management', 'guide', 'knowledge']) await click(`tab-${tab}`);
    await click('locale-en'); const before = await checkpoint();
    await page.reload({ waitUntil: 'networkidle0' }); assert.deepEqual(await checkpoint(), before);
    assert.equal(await page.$eval('[data-testid="game-root"]', el => el.dataset.locale), 'en');
    await click('tab-operations'); await click('task-confirm');
    await page.select('[data-testid="task-unit"]', 'PU-02'); await page.select('[data-testid="task-unit"]', 'PU-01');
    const route = page.url(), id = (await checkpoint()).state.scheduledOperations[0].id;
    await click(`duplicate-view-${id}`); assert.equal(page.url(), route, 'duplicate task navigation preserves #/game on Pages');
    await click('advance-day');
    assert.equal((await checkpoint()).state.scheduledOperations[0].executionStatus, 'completed');
    assert.equal((await checkpoint()).state.management.phase, 'end_of_day');
    await page.reload({ waitUntil: 'networkidle0' }); assert.equal((await checkpoint()).state.management.phase, 'end_of_day');
    // Link navigation must preserve the project directory when returning to the old app.
    await page.$eval('.fg-sidebar-bottom a', el => el.click());
    await page.waitForSelector('.page-title'); assert.equal(new URL(page.url()).pathname, base);
    for (const route of ['/', '/sensors', '/risk', '/prescription', '/execution', '/audit', '/history', '/scenarios', '/admin']) {
      await page.goto(`${origin}${base}#${route}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.page-title');
      await page.evaluate(() => document.querySelectorAll('img').forEach(img => { img.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.images].every(img => img.complete));
      assert.equal(await page.evaluate(() => [...document.images].filter(img => !img.naturalWidth).length), 0, `${route}: all images loaded`);
    }
    await page.goto(`${origin}${base}#/sensors`, { waitUntil: 'networkidle0' });
    await page.select('.field-selector', 'YN-A2');
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    const info = await (await fetch(`${origin}${base}build-info.json`)).json(); assert.match(info.commit, /^[a-f0-9]{40}$/);
    assert.deepEqual(errors, [], 'browser runtime errors'); assert.deepEqual(failures, [], 'missing assets or routes');
    console.log('PASS: production Pages artifact, eight game views, real scheduling/execution, hash reload, exact save restore, language persistence, navigation to legacy app, nine old routes and images, build provenance.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
