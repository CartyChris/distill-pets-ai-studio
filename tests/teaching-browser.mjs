import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { unzipSync, strFromU8 } from 'fflate';

const base = process.env.APP_URL || 'http://localhost:5190';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 420, height: 912 }, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await context.newPage();
const errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  if (!localStorage.getItem('pip-studio-v1')) localStorage.setItem('pip-studio-v1', JSON.stringify({
    version: 1, mode: 'live', tasks: [], lessons: [],
    agents: { milo: { model: 'fixture/teacher', skin: 'pixel', pet: 'fox', outfit: 'wizard' }, nova: { model: 'fixture/student', skin: 'pixel', pet: 'bunny', outfit: 'flowers' } },
  }));
});
await page.route('**/api/models', route => route.fulfill({ json: { models: [] } }));
let releaseAttempt;
let holdAttempt = new Promise(resolve => { releaseAttempt = resolve; });
await page.route('**/api/complete', async route => {
  const input = route.request().postDataJSON();
  requests.push(input);
  if (input.kind === 'learn-attempt' && requests.length === 1) await holdAttempt;
  const messages = JSON.stringify(input.messages);
  if (input.kind === 'learn-feedback') assert.ok(messages.includes('STUDENT_FIRST_DRAFT'), 'teacher must critique the actual saved attempt');
  if (input.kind === 'learn-revision') assert.ok(messages.includes('TEACHER_CONCRETE_FEEDBACK'), 'revision must use returned teacher feedback');
  const text = {
    'learn-attempt': 'STUDENT_FIRST_DRAFT: Rainbows separate sunlight into colors.',
    'learn-feedback': 'TEACHER_CONCRETE_FEEDBACK: Add bending, internal reflection, and viewing direction.',
    'learn-revision': 'STUDENT_REVISED_ANSWER: Sunlight bends, reflects inside droplets, and bends again. The Sun is behind the observer.',
    teach: 'Begin with the mechanism. Use one accurate analogy and explain its limits. Check uncertainty.',
    compare: input.learned ? 'A careful answer with a concrete example.' : 'A short baseline answer.',
  }[input.kind] || 'A prepared fixture response.';
  await route.fulfill({ json: { text, model: input.model, demo: !!input.demo, finishReason: 'stop' } });
});
async function go(name) {
  await page.getByRole('button', { name: 'All views', exact: true }).filter({ visible: true }).first().click();
  await page.locator('#modal').getByRole('button', { name, exact: true }).click();
}
const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('pip-studio-v1')));
async function download(action) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-action="${action}"]`).first().click()]);
  return readFile(await file.path());
}
try {
  await page.goto(base);
  await go('Settings');
  await page.getByLabel('OpenRouter API key').fill('fixture-key-never-sent-to-provider');
  await go('Teaching workshop');
  assert.match(await page.locator('[data-action="learn-run"]').innerText(), /3 calls/);
  await page.locator('[data-action="learn-run"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).teaching.runs.at(-1)?.calls === 1);
  await page.locator('[data-action="learn-watch"]').click();
  await page.locator('#world-canvas').waitFor();
  await page.locator('[data-action="world-tab"][data-tab="steer"]').first().click();
  await page.locator('#world-guide-target').selectOption('teacher');
  await page.locator('#world-guide-input').fill('GUIDANCE_KEEP_ANALOGY_ACCURATE');
  await page.locator('[data-action="world-guide-send"]').click();
  assert.equal((await data()).adventure.guidance.at(-1).status, 'queued');
  releaseAttempt();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).teaching.runs.at(-1)?.status === 'complete');
  assert.equal(requests.length, 3);
  assert.deepEqual(requests.map(r => r.model), ['fixture/student', 'fixture/teacher', 'fixture/student']);
  assert.ok(JSON.stringify(requests[1].messages).includes('GUIDANCE_KEEP_ANALOGY_ACCURATE'));
  assert.ok(!JSON.stringify(requests).includes('Explain why ocean tides happen'), 'reserved validation task must not reach teaching calls');
  await page.locator('[data-action="world-tab"][data-tab="dialogue"]').click();
  await page.locator('#world-dialogue-list').getByText(/STUDENT_FIRST_DRAFT/).waitFor();
  await page.locator('#world-dialogue-list').getByText(/TEACHER_CONCRETE_FEEDBACK/).waitFor();
  await page.locator('[data-action="world-tab"][data-tab="results"]').click();
  await page.locator('#world-response').getByText(/STUDENT_REVISED_ANSWER/).waitFor();
  await page.locator('[data-action="world-open-result"]').click();
  await page.locator('.teaching-workshop').waitFor();
  const rowId = (await data()).teaching.rows[0].id;
  assert.equal((await data()).teaching.rows[0].approved, false);
  await page.locator(`[data-learn-review="${rowId}"]`).check();
  const sft = (await download('learn-export-sft')).toString().trim().split('\n').map(JSON.parse);
  assert.equal(sft.length, 1);
  assert.ok(sft[0].messages.at(-1).content.includes('STUDENT_REVISED_ANSWER'));
  assert.ok(sft[0].messages.some(message => message.role === 'user' && message.content.includes('Teaching goal:')));
  assert.ok(JSON.stringify(sft[0]).includes('GUIDANCE_KEEP_ANALOGY_ACCURATE'), 'applied steering must remain in the supervised context');
  await page.locator(`[data-action="learn-select-row"][data-id="${rowId}"]`).click();
  await page.locator('#learn-chip-name').fill('The careful rainbow guide');
  await page.locator('[data-action="learn-distill"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).lessons.length === 1);
  const chip = (await data()).lessons[0];
  assert.equal(chip.approved, false);
  assert.equal(chip.reviewed, false);
  assert.equal(chip.provenance.source, 'teaching-workshop');
  assert.ok(chip.provenance.sourcePrompts.some(prompt => prompt.includes('rainbow')));
  assert.equal((await data()).agents.nova.chipId, null);
  assert.equal(requests.length, 4, 'chip curation is exactly one separate deliberate call');
  await page.locator(`[data-action="chip-edit"][data-id="${chip.id}"]`).click();
  await page.locator('[data-action="chip-edit-save"]').click();
  const approvedId = (await data()).activeLesson;
  assert.notEqual(approvedId, chip.id, 'approval creates an immutable new revision');
  await page.locator('#learn-comparison-chip').selectOption(approvedId);
  await page.locator('[data-action="learn-open-lab"]').click();
  assert.equal((await data()).chipLab.cases.length, 1);
  await page.locator('[data-action="lab-run"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pip-studio-v1')).chipLab.runs.at(-1)?.status === 'complete');
  assert.equal(requests.length, 6);
  await page.locator('[data-action="lab-vote"][data-vote="A"]').click();
  await page.locator('[data-lab-run][data-lab-case]').fill('The concrete example helps; check the scientific limits.');
  await page.locator('[data-action="lab-preferences"]').click();
  const preferenceZip = unzipSync(await download('lab-preferences-confirm'));
  assert.deepEqual(Object.keys(preferenceZip).sort(), ['provenance.json', 'response-preferences.jsonl']);
  assert.equal(strFromU8(preferenceZip['response-preferences.jsonl']).trim().split('\n').length, 1);
  assert.match(strFromU8(preferenceZip['provenance.json']), /different instruction contexts/);
  assert.equal((await data()).chipLab.runs[0].cases[0].role, 'development');
  await page.locator('[data-action="lab-learn-review"]').click();
  assert.match((await data()).chipLab.curation.feedback, /concrete example helps/);
  assert.equal((await data()).chipLab.curation.approved, false);
  await go('Teaching workshop');
  await page.getByText('A reserved task overlaps practice data.', { exact: false }).waitFor();
  assert.ok((await data()).teaching.developmentKeys.length >= 2, 'consumed Chip lab tests also enter the shared development ledger');
  await page.locator('#learn-prompt-learn-seed-tides').fill('Explain why leaves change color to a curious nine-year-old.');
  await page.locator('#learn-prompt-learn-seed-tides').blur();
  assert.equal(await page.getByText('A reserved task overlaps practice data.', { exact: false }).count(), 0, 'editing and leaving the validation field refreshes its eligibility');
  await page.reload();
  await go('Teaching workshop');
  assert.equal((await data()).teaching.rows[0].approved, true);
  assert.equal((await data()).teaching.runs[0].status, 'complete');
  assert.ok(!JSON.stringify(await data()).includes('fixture-key-never-sent-to-provider'));
  await page.locator('#learn-import-file').setInputFiles({ name: 'invalid.jsonl', mimeType: 'application/x-ndjson', buffer: Buffer.from('{"prompt":"Valid","completion":"Answer"}\n{"prompt":"Missing answer"}') });
  await page.getByText(/Example 2 needs a task/).first().waitFor();
  assert.equal((await data()).teaching.rows.length, 1, 'bad import is atomic');
  for (const viewport of [{ width: 320, height: 568 }, { width: 420, height: 912 }, { width: 852, height: 393 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'teaching UI fits viewport');
    assert.ok(await page.locator('#learn-goal').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
  }
  await page.setViewportSize({ width: 420, height: 912 });
  await page.screenshot({ path: 'tests/teaching-phone.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: integrated teacher/student requests, live Wilds steering/transcripts, held-out isolation, reviewed SFT, immutable chip approval, frozen comparison, one-ZIP preferences/provenance, shared development ledger, review feedback, reload/key exclusion, atomic imports, phone/landscape/desktop.');
} finally {
  releaseAttempt();
  await browser.close();
}
