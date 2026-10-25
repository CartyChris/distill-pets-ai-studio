import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 420, height: 912 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function go(name) {
  await page.getByRole('button', { name: 'All views', exact: true }).filter({ visible: true }).first().click();
  await page.locator('#modal').getByRole('button', { name, exact: true }).click();
}
try {
  await page.goto(process.env.APP_URL || 'http://localhost:5182');
  await page.getByRole('button', { name: 'Try the playground', exact: true }).click();
  await go('Teaching workshop');
  await page.locator('#learn-reference').check();
  assert.match(await page.locator('[data-action="learn-run"]').innerText(), /4 calls/);
  await page.locator('[data-action="learn-run"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).teaching.runs.at(-1)?.status === 'complete', null, { timeout: 60000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pip-studio-v1')));
  const run = saved.teaching.runs[0], item = run.items[0];
  assert.equal(run.calls, 4);
  assert.equal(run.demo, true);
  assert.match(item.reference.text, /Playground teacher demonstration/);
  assert.match(item.attempt.text, /Playground student first attempt/);
  assert.match(item.feedback.text, /Playground teacher feedback/);
  assert.match(item.revision.text, /Playground student revision/);
  assert.equal(saved.teaching.rows[0].approved, false);
  await page.locator('[data-learn-review]').check();
  assert.equal(await page.locator('[data-action="learn-export-sft"]').isDisabled(), true);
  await page.locator('[data-action="learn-watch"]').click();
  await page.locator('#world-canvas').waitFor();
  await page.locator('[data-action="world-tab"][data-tab="dialogue"]').click();
  assert.equal(await page.locator('#world-dialogue-list .world-speech').count(), 4);
  await page.locator('[data-action="world-tab"][data-tab="results"]').click();
  await page.locator('#world-response').getByText(/Playground student revision/).waitFor();
  await page.locator('[data-action="world-open-result"]').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (process.env.CAPTURE_SCENE) await page.locator('.learn-session').screenshot({ path: process.env.CAPTURE_SCENE });
  await page.reload();
  await go('Teaching workshop');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pip-studio-v1')).teaching.runs[0].status), 'complete');
  assert.deepEqual(errors, []);
  console.log('PASS: actual hosted/portable Playground backend returns four distinct teaching stages; reviewed sample training export stays blocked; Wilds shows four public messages and returned revision; phone fit and reload persist. No provider fixtures or paid inference used.');
} finally {
  await browser.close();
}
