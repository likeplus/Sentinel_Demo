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
    assert.deepEqual(errors, [], 'uncaught JavaScript errors');
    console.log('PASS: all nine legacy routes rendered');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
