import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 420, height: 912 }, isMobile: true, hasTouch: true });
const faults = [], requests = [];
page.on('pageerror', error => faults.push(error.message));
page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/complete')) requests.push(request); });
async function go(name) {
  await page.getByRole('button', { name: 'All views', exact: true }).filter({ visible: true }).first().click();
  await page.locator('#modal').getByRole('button', { name, exact: true }).click();
}
async function download(action) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-action="${action}"]`).click()]);
  return readFile(await file.path());
}
try {
  await page.route('**/api/models', route => route.fulfill({ json: { models: [] } }));
  await page.goto(process.env.APP_URL || 'http://localhost:5180');
  await page.getByRole('button', { name: 'Try the playground', exact: true }).click();
  await go('Superpowers');
  await page.locator('#power-task').fill('Explain a rainbow using clear steps.');
  await page.locator('#power-rounds').selectOption('0');
  await page.locator('[data-action="power-run"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).superpowers.history.at(-1)?.status === 'complete');
  assert.equal(requests.length, 1);
  assert.match(await page.getByLabel('Superpower output', { exact: true }).innerText(), /rainbow/i);
  assert.match((await download('power-export-js')).toString(), /export async function runBrain/);
  await go('Forge studio');
  await page.locator('#forge-diagram-mount svg').waitFor({ timeout: 30000 });
  assert.match((await download('forge-svg')).toString(), /<svg/);
  assert.equal((await download('forge-png')).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  await page.locator('[data-action="forge-tab"][data-tab="ui"]').click();
  const checkbox = page.locator('#forge-ui-preview input[type="checkbox"]').first();
  await checkbox.check();
  assert.equal(requests.length, 1, 'A native checklist never makes a model call');
  await page.locator('#forge-ui-request').fill('Make a small learning dashboard.');
  await page.locator('[data-action="forge-generate"][data-kind="ui"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).forge.generation.status === 'complete');
  assert.equal(requests.length, 2);
  await page.locator('#forge-ui-preview').getByText('Sample learning dashboard', { exact: true }).waitFor();
  for (const viewport of [{ width: 320, height: 568 }, { width: 420, height: 912 }, { width: 852, height: 393 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.locator('#forge-ui-source').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16));
  }
  await page.reload();
  await go('Superpowers');
  assert.match(await page.getByLabel('Superpower output', { exact: true }).innerText(), /rainbow/i);
  assert.deepEqual(faults, []);
  console.log('PASS: production Node server + CSP, actual playground processing/generative UI requests, local Mermaid SVG and real PNG, inert interactions, downloads, saved results and phone/landscape layouts.');
} finally {
  await browser.close();
}
