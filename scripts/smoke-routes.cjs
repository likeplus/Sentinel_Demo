// Run against a local Vite dev or preview server; does not publish a web preview.
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/sensors', '/risk', '/prescription', '/execution', '/audit', '/history', '/scenarios', '/admin']) {
      const response = await page.goto(baseUrl + route, { waitUntil: 'networkidle0' });
      assert.equal(response.status(), 200, route);
      await page.waitForFunction(() => document.querySelector('.page-title')?.innerText.length > 0);
      const title = await page.$eval('.page-title', el => el.innerText);
      console.log(JSON.stringify({ route, status: response.status(), title }));
    }
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle0' });
    await page.select('.field-selector', 'YN-A2');
    await page.waitForFunction(() => document.querySelector('.page-subtitle')?.innerText.includes('Greenhouse A2'));
    await page.evaluate(() => [...document.querySelectorAll('.topbar button')].find(b => b.textContent.trim() === 'Chinese').click());
    await page.waitForFunction(() => document.querySelector('.sidebar-nav')?.innerText.includes('指挥中心'));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelector('.sidebar-nav')?.innerText.includes('指挥中心'));
    await page.evaluate(() => [...document.querySelectorAll('.topbar button')].find(b => b.textContent.trim() === 'EN').click());
    console.log('PASS: field switching and persisted Chinese localization');
    for (let index = 0; index < 6; index++) {
      await page.goto(baseUrl + '/scenarios', { waitUntil: 'networkidle0' });
      await page.waitForSelector('.page .grid.grid-2 > .card');
      const cards = await page.$$('.page .grid.grid-2 > .card');
      assert.equal(cards.length, 6, 'six legacy scenarios');
      await cards[index].click();
      await page.waitForSelector('.scenario-indicator');
      await page.evaluate(() => [...document.querySelectorAll('.page-header button')].find(b => b.textContent.trim().startsWith('Step')).click());
      await page.waitForFunction(() => document.querySelector('.scenario-progress')?.innerText.startsWith('Step 1/'));
    }
    console.log('PASS: all six legacy demo scenarios load and advance');
    assert.deepEqual(errors, [], 'uncaught JavaScript errors');
    console.log('PASS: all nine legacy routes rendered');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
