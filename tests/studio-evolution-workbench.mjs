import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ENDPOINT, KEY, ORIGINAL, TEACHER, PRIVATE,
  newStudioPage, saved, waitIdle, waitSaved, sse,
} from './studio-evolution-harness.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'],
});
const pages = [];
const INITIAL_HTML = '<!doctype html>\n<html><body><h1>Needle one</h1><p>NEEDLE two</p></body></html>';
const EDITED_HTML = INITIAL_HTML.replace('</body>', '<p>USER_EDIT_SENTINEL: keep my manual work.</p></body>');
const UPDATED_HTML = EDITED_HTML.replace('</body>', '<button>FOLLOWUP_SUCCESS_SENTINEL</button></body>');
const README = 'WORKBENCH_README_SENTINEL\nOpen index.html in a browser.\n';
const INSTRUCTION = 'FOLLOWUP_INSTRUCTION_SENTINEL: preserve my edit and add one accessible button.';
const FAILED = 'FAILED_FOLLOWUP_SENTINEL: this incomplete response has no valid project file blocks.';
const project = html => `===FILE:index.html===\n${html}\n===END FILE===\n\n===FILE:docs/README.md===\n${README}===END FILE===`;
const text = request => request.messages.map(message => message.content).join('\n');
const action = (page, name) => page.locator(`[data-action="${name}"]`);

async function pageWithProject() {
  const page = await newStudioPage(browser, { studio: { request: ORIGINAL } });
  pages.push(page);
  const requests = [];
  const replies = [{ status: 200, contentType: 'text/event-stream', body: sse(project(INITIAL_HTML)) }];
  await page.route(ENDPOINT, async route => {
    requests.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
    const reply = replies.shift();
    await route.fulfill(reply || {
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unexpected extra test request' } }),
    });
  });
  await page.getByRole('button', { name: 'Build project', exact: true }).click();
  const db = await waitIdle(page);
  assert.equal(db.studio.lastRun.status, 'complete');
  assert.equal(requests.length, 1, 'One initial generation call');
  assert.equal(requests[0].authorization, `Bearer ${KEY}`);
  assert.equal(db.studio.files.length, 2);
  await page.locator('#studio-followup').waitFor();
  return { page, requests, replies, initial: db };
}

async function downloaded(page, button) {
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  assert.equal(await download.failure(), null);
  return { name: download.suggestedFilename(), text: await readFile(await download.path(), 'utf8') };
}

function assertFrozenContext(request, initial, expectedPreviousResult) {
  const run = initial.studio.lastRun;
  assert.equal(request.model, TEACHER, 'Continuation uses the generating model even after agent reassignment');
  assert.equal(request.max_tokens, run.maxTokens, 'Continuation keeps the original token budget');
  assert.equal(request.temperature, run.temperature, 'Continuation keeps the original temperature');
  assert.ok(text(request).includes(ORIGINAL), 'Continuation carries the original task');
  assert.ok(text(request).includes(INSTRUCTION), 'Continuation carries the explicit next instruction');
  assert.ok(text(request).includes('TEACHER_CHIP_SENTINEL'), 'Continuation preserves original chip instructions');
  assert.ok(text(request).includes('Approved example.'), 'Continuation preserves original chip examples');
  assert.ok(text(request).includes('Voice: precise.'), 'Continuation preserves original voice');
  assert.ok(text(request).includes('BRIEF_SENTINEL'), 'Continuation preserves original task brief');
  assert.ok(text(request).includes('USER_EDIT_SENTINEL'), 'Continuation includes current user-edited project files');
  assert.ok(text(request).includes(expectedPreviousResult), 'Continuation includes the prior usable model result');
  assert.ok(!text(request).includes('REPLACEMENT_PROFILE_SENTINEL'), 'Changed profile cannot overwrite original provenance');
  assert.ok(!text(request).includes('UNRELATED_NEW_TASK_SENTINEL'), 'Changed build draft cannot replace the original task');
  assert.deepEqual(request.messages.slice(1, 3), run.teacherProfile.slice(1, 3), 'Approved example turns are preserved');
}

try {
  // The explicit next-version action has its own instruction and immutable run context.
  {
    const { page, requests, replies, initial } = await pageWithProject();
    await page.getByLabel('Code editor', { exact: true }).fill(EDITED_HTML);
    await waitSaved(page, db => db.studio.files[0]?.content.includes('USER_EDIT_SENTINEL'));
    await page.getByLabel('Build something', { exact: true }).fill('UNRELATED_NEW_TASK_SENTINEL: start a different project.');
    await page.evaluate(() => {
      const { db, setPage } = window.__evolution;
      db.agents.milo.model = 'test/replacement';
      db.agents.milo.voice = 'playful';
      db.agents.milo.chipId = 'replacement-chip';
      db.lessons.push({ id: 'replacement-chip', instructions: 'REPLACEMENT_PROFILE_SENTINEL', examples: [], demo: false });
      db.activeAgent = 'nova';
      db.maxTokens = 512;
      db.generation = { brief: 'REPLACEMENT_PROFILE_SENTINEL', temperature: 1.5 };
      db.studio.recursive = true;
      db.studio.rounds = 3;
      setPage('code');
    });
    const beforeFailure = await page.evaluate(() => structuredClone(window.__evolution.db.studio));
    await page.locator('#studio-followup').fill(INSTRUCTION);
    replies.push({ status: 200, contentType: 'text/event-stream', body: sse(FAILED) });
    await action(page, 'studio-followup-run').click();
    const failed = await waitIdle(page);
    assert.equal(requests.length, 2, 'Changed recursive controls cannot add calls to the existing one-pass run');
    assertFrozenContext(requests[1].body, initial, 'Needle one');
    assert.equal(failed.studio.lastRun.prompt, ORIGINAL);
    assert.equal(failed.studio.lastRun.agent, 'milo');
    assert.equal(failed.studio.lastRun.model, initial.studio.lastRun.model);
    assert.equal(failed.studio.lastRun.continuationOf, initial.studio.lastRun.id);
    assert.equal(failed.studio.lastRun.status, 'failed');
    assert.equal(failed.studio.lastRun.phase, 'iteration-failed-previous-kept');
    assert.deepEqual(failed.studio.files, beforeFailure.files, 'Failed iteration restores manually edited files');
    assert.equal(failed.studio.selectedFile, beforeFailure.selectedFile, 'Failed iteration restores active file');
    assert.equal(failed.studio.output, beforeFailure.output, 'Failed iteration preserves the usable prior result');
    assert.equal(failed.studio.failedOutput, FAILED, 'Failed partial transcript remains available for inspection');
    assert.equal(failed.studio.followup, INSTRUCTION, 'The failed instruction stays available to edit or retry');
    assert.ok(await page.getByRole('alert').textContent().then(value => value.includes('previous result and files were kept')));
    await page.getByText('Inspect the failed iteration’s partial output', { exact: true }).click();
    assert.equal(await page.locator('.studio-failed-output pre').textContent(), FAILED);

    // Exporting after a failed version still exports the safe prior response.
    const keptExport = await downloaded(page, action(page, 'studio-response-export'));
    assert.equal(keptExport.name, 'pip-code.md');
    assert.ok(keptExport.text.includes(ORIGINAL));
    assert.ok(keptExport.text.includes(beforeFailure.output));
    assert.ok(!keptExport.text.includes(FAILED));
    assert.ok(!keptExport.text.includes('UNRELATED_NEW_TASK_SENTINEL'));

    // A retry also keeps the frozen original context, then clears the followup draft.
    replies.push({ status: 200, contentType: 'text/event-stream', body: sse(project(UPDATED_HTML)) });
    await action(page, 'studio-followup-run').click();
    const completed = await waitIdle(page);
    assert.equal(requests.length, 3);
    assertFrozenContext(requests[2].body, initial, 'Needle one');
    assert.equal(completed.studio.lastRun.status, 'complete');
    assert.equal(completed.studio.lastRun.prompt, ORIGINAL);
    assert.equal(completed.studio.lastRun.agent, 'milo');
    assert.deepEqual(completed.studio.lastRun.teacherProfile, initial.studio.lastRun.teacherProfile);
    assert.equal(completed.studio.lastRun.maxTokens, initial.studio.lastRun.maxTokens);
    assert.equal(completed.studio.lastRun.temperature, initial.studio.lastRun.temperature);
    assert.equal(completed.studio.followup, '');
    assert.equal(completed.studio.failedOutput, '');
    assert.ok(completed.studio.files[0].content.includes('FOLLOWUP_SUCCESS_SENTINEL'));
    assert.ok(!(await saved(page)).studio.output.includes(PRIVATE), 'Provider private reasoning is excluded from saved responses');
    console.log('PASS explicit followup: frozen task/model/profile/settings, edited-file context, failed-version restore, retry, safe export');
  }

  // File tools act on the selected file and make destructive changes reviewable/reversible.
  {
    const { page, initial } = await pageWithProject();
    const editor = page.getByLabel('Code editor', { exact: true });
    await editor.focus();
    await editor.press('Control+f');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'studio-find', 'Editor shortcut opens file find');
    const find = page.getByLabel('Find in active file', { exact: true });
    await find.fill('needle');
    assert.equal(await page.locator('#studio-find-status').textContent(), '2 matches');
    const offsets = [INITIAL_HTML.toLowerCase().indexOf('needle'), INITIAL_HTML.toLowerCase().lastIndexOf('needle')];
    async function selection() { return editor.evaluate(node => [node.selectionStart, node.selectionEnd]); }
    await page.getByRole('button', { name: 'Next match', exact: true }).click();
    assert.deepEqual(await selection(), [offsets[0], offsets[0] + 6]);
    await page.getByRole('button', { name: 'Next match', exact: true }).click();
    assert.deepEqual(await selection(), [offsets[1], offsets[1] + 6]);
    await page.getByRole('button', { name: 'Next match', exact: true }).click();
    assert.deepEqual(await selection(), [offsets[0], offsets[0] + 6], 'Next wraps to first match');
    await page.getByRole('button', { name: 'Previous match', exact: true }).click();
    assert.deepEqual(await selection(), [offsets[1], offsets[1] + 6], 'Previous wraps to last match');
    assert.equal(await page.locator('#studio-find-status').textContent(), '2 matches · 2 of 2');
    await find.fill('absent-search-sentinel');
    assert.equal(await page.locator('#studio-find-status').textContent(), 'No matches in this file.');
    assert.equal(await page.getByRole('button', { name: 'Next match', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Previous match', exact: true }).isDisabled(), true);

    await page.getByRole('button', { name: 'docs/README.md', exact: true }).click();
    const fileExport = await downloaded(page, action(page, 'studio-download-file'));
    assert.equal(fileExport.name, 'README.md', 'Active-file export uses the selected nested file basename');
    assert.equal(fileExport.text, initial.studio.files.find(file => file.path === 'docs/README.md').content);
    const beforeDelete = (await saved(page)).studio.files;
    await action(page, 'studio-file-delete').click();
    const modal = page.locator('#modal');
    assert.equal(await modal.getByRole('heading').textContent(), 'Delete docs/README.md?');
    assert.equal(await modal.locator('pre').textContent(), fileExport.text, 'Delete review shows the exact file being removed');
    assert.deepEqual((await saved(page)).studio.files, beforeDelete, 'Opening delete review does not remove the file');
    await modal.getByRole('button', { name: 'Keep file', exact: true }).click();
    assert.deepEqual((await saved(page)).studio.files, beforeDelete, 'Cancel keeps the file');
    await action(page, 'studio-file-delete').click();
    await modal.getByRole('button', { name: 'Delete this file', exact: true }).click();
    const deleted = await saved(page);
    assert.equal(deleted.studio.files.length, 1);
    assert.equal(deleted.studio.files[0].path, 'index.html');
    assert.equal(deleted.studio.selectedFile, 'index.html');
    assert.deepEqual(deleted.studio.snapshots.at(-1).files, beforeDelete, 'Deletion checkpoints the full previous project');
    await action(page, 'studio-restore').click();
    assert.deepEqual((await saved(page)).studio.files, beforeDelete, 'Restore returns all deleted file contents');

    const response = await downloaded(page, action(page, 'studio-response-export'));
    assert.equal(response.name, 'pip-code.md');
    assert.ok(response.text.startsWith('# Original task\n\n' + ORIGINAL + '\n\n# Response\n\n'));
    assert.ok(response.text.endsWith(initial.studio.output));
    assert.ok(!response.text.includes(KEY), 'Response export never includes the API key');
    assert.ok(!response.text.includes(PRIVATE), 'Response export never includes provider private reasoning');
    console.log('PASS file tools: cyclic find/shortcut, selected-file bytes, delete review/cancel/restore, response Markdown');
  }

  for (const page of pages) assert.deepEqual(page.__evolutionErrors, [], 'Workbench emits no browser errors');
  console.log('Studio evolution workbench regressions passed. Intercepted provider only; no paid inference.');
} finally {
  await browser.close();
}
