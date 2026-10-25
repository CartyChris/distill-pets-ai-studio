import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import {
  cleanChipLab,
  createChipLab,
  normalizeLabPrompt,
  preferenceRows,
  preferenceManifest,
} from '../src/chip-lab.js';

const result = text => ({ text, status: 'complete', truncated: false, error: '' });
function runFixture() {
  return {
    id: 'run-preferences', chipId: 'chip-original', chipTitle: 'Careful teacher',
    baseModel: 'test/student', demo: false, agent: 'nova', status: 'complete',
    setup: {
      baselineSystem: 'Use the user-provided task and answer accurately.',
      learnedSystem: 'Use the user-provided task. SECRET_CHIP_CONTEXT',
      profile: { temperature: 0.4, maxTokens: 1024 },
      chip: {
        id: 'chip-original', title: 'Careful teacher', demo: false,
        examples: [{ prompt: 'Known task', completion: 'Known answer' }],
        instructions: 'SECRET_CHIP_CONTEXT', revision: 2,
      },
    },
    cases: [
      {
        id: 'case-good', prompt: 'Explain the garden.', rubric: 'Accurate and clear',
        baseline: result('A clear baseline answer'), learned: result('A better learned answer'),
        preference: 'A', order: 'learned-first', notes: 'The example was helpful.', revealed: false,
      },
      {
        id: 'case-baseline', prompt: 'Explain a pond.', rubric: 'State uncertainty',
        baseline: result('A careful baseline answer'), learned: result('A weak learned answer'),
        preference: 'B', order: 'learned-first', notes: 'The chip overclaimed.', revealed: false,
      },
    ],
  };
}

const run = runFixture();
const rows = preferenceRows(run);
assert.equal(rows.length, 2);
assert.equal(rows[0].chosen[0].content, 'A better learned answer');
assert.equal(rows[0].rejected[0].content, 'A clear baseline answer');
assert.equal(rows[1].chosen[0].content, 'A careful baseline answer');
assert.deepEqual(rows[0].prompt, [
  { role: 'system', content: run.setup.baselineSystem },
  { role: 'user', content: 'Explain the garden.' },
]);
assert.ok(!JSON.stringify(rows).includes('SECRET_CHIP_CONTEXT'));
assert.match(preferenceManifest(run).contextCaveat, /different instruction contexts/);
assert.equal(preferenceManifest(run).pairs[0].chosenSide, 'learned');

for (const mutate of [
  r => { r.demo = true; },
  r => { r.setup = null; },
  r => { r.setup.chip.demo = true; },
  r => { r.cases[0].preference = 'tie'; },
  r => { r.cases[0].preference = ''; },
  r => { r.cases[0].learned.truncated = true; },
  r => { r.cases[0].baseline.status = 'failed'; },
  r => { r.cases[0].baseline.error = 'provider error'; },
  r => { r.cases[0].learned.text = r.cases[0].baseline.text + ' '; },
]) {
  const invalid = runFixture();
  invalid.cases = [invalid.cases[0]];
  mutate(invalid);
  assert.deepEqual(preferenceRows(invalid), [], 'ineligible data must never become preferences');
}

assert.equal(normalizeLabPrompt('  ＥＸＰＬＡＩＮ\u00a0  the\u200B garden. '), normalizeLabPrompt('Explain the garden.'));
assert.notEqual(normalizeLabPrompt('Explain x+y.'), normalizeLabPrompt('Explain x-y.'));

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function fixture() {
  const db = {
    mode: 'live', generation: {}, maxTokens: 1024,
    agents: { milo: { name: 'Milo', model: 'test/teacher' }, nova: { name: 'Nova', model: 'test/student' } },
    lessons: [{
      id: 'chip-original', title: 'Careful teacher', baseModel: 'test/student', teacherModel: 'test/teacher',
      examples: [{ prompt: 'Known task', completion: 'Known answer' }],
      instructions: 'Keep things accurate.', approved: true, reviewed: true, demo: false, revision: 2,
    }],
    tasks: [],
    chipLab: cleanChipLab({ selectedChip: 'chip-original', runs: [runFixture()] }),
  };
  let busy = false;
  const notices = [], downloads = [], calls = [], modals = [];
  const lab = createChipLab({
    getDB: () => db, escape,
    button: (action, label, cls = '', attributes = '') => `<button data-action="${action}" class="${cls}" ${attributes}>${label}</button>`,
    save() {}, render() {}, toast: message => notices.push(message),
    openModal: html => modals.push(html), download: (...args) => downloads.push(args),
    getBusy: () => busy, ready: () => true, start: () => 1, finish() {}, currentOp: () => 1,
    studentMessages: (prompt, chip) => [{ role: 'system', content: chip?.instructions || 'Base context' }, { role: 'user', content: prompt }],
    completion: async (...args) => { calls.push(args); return { text: 'Answer', finishReason: 'stop' }; },
  });
  return { db, lab, notices, downloads, calls, modals, setBusy: value => { busy = value; } };
}

const f = fixture();
await f.lab.action('lab-preferences', { runId: 'run-preferences' });
assert.equal(f.downloads.length, 0, 'opening the export explanation must not download automatically');
assert.match(f.modals[0], /different instruction contexts/);
await f.lab.action('lab-preferences-confirm', { runId: 'run-preferences' });
assert.equal(f.downloads.length, 1, 'one mobile-compatible ZIP contains JSONL and a provenance report');
assert.equal(f.downloads[0][2], 'application/zip');
assert.ok(f.downloads[0][1] instanceof Uint8Array);
const archive = unzipSync(f.downloads[0][1]);
assert.deepEqual(Object.keys(archive).sort(), ['provenance.json', 'response-preferences.jsonl']);
const exported = strFromU8(archive['response-preferences.jsonl']).trim().split('\n').map(JSON.parse);
assert.equal(exported.length, 2);
assert.deepEqual(exported[0].prompt, rows[0].prompt);
const provenance = JSON.parse(strFromU8(archive['provenance.json']));
assert.match(provenance.contextCaveat, /different instruction contexts/);
assert.equal(provenance.runId, 'run-preferences');
assert.equal(provenance.pairs.length, 2);
assert.equal(provenance.pairs[0].role, 'development');
assert.equal(f.db.chipLab.runs[0].cases[0].role, 'development', 'exported training preferences consume the holdout');

const child = fixture();
const earlier = runFixture();
earlier.id = 'earlier-experiment';
earlier.cases[0].prompt = ' ＥＸＰＬＡＩＮ the garden. ';
child.db.chipLab.runs.unshift(earlier);
const originalChip = JSON.stringify(child.db.lessons[0]);
const originalAgents = JSON.stringify(child.db.agents);
await child.lab.action('lab-learn-review', { runId: 'run-preferences' });
assert.match(child.db.chipLab.curation.feedback, /example was helpful/);
assert.match(child.db.chipLab.curation.feedback, /chip overclaimed/);
assert.equal(child.db.chipLab.curation.approved, false);
assert.deepEqual(child.db.chipLab.curation.taskIds, []);
assert.equal(child.db.chipLab.runs[0].cases[0].role, 'development', 'consumption propagates to earlier matching reports');
assert.equal(cleanChipLab(child.db.chipLab).runs[0].cases[0].role, 'development');
assert.equal(JSON.stringify(child.db.lessons[0]), originalChip);
assert.equal(JSON.stringify(child.db.agents), originalAgents);
assert.equal(child.calls.length, 0, 'preparing feedback makes no model calls');
child.db.chipLab.cases = [{ id: 'development-rerun', prompt: '  ＥＸＰＬＡＩＮ the garden. ', rubric: 'Try again' }];
await child.lab.action('lab-run');
assert.equal(child.db.chipLab.runs.at(-1).cases[0].role, 'development', 'later normalized repeats retain development lineage');

const wrongMode = fixture();
wrongMode.db.mode = 'demo';
await wrongMode.lab.action('lab-preferences-confirm', { runId: 'run-preferences' });
assert.equal(wrongMode.downloads.length, 0, 'a historic live run is not exported while the workspace is in Playground');

const blocked = fixture();
blocked.setBusy(true);
await blocked.lab.action('lab-vote', { runId: 'run-preferences', caseId: 'case-good', vote: 'B' });
await blocked.lab.action('lab-reveal', { runId: 'run-preferences', caseId: 'case-good' });
await blocked.lab.action('lab-learn-review', { runId: 'run-preferences' });
blocked.lab.input({ id: 'lab-notes-run-preferences-case-good', dataset: { labRun: 'run-preferences', labCase: 'case-good' }, value: 'Changed while busy' });
assert.equal(blocked.db.chipLab.runs[0].cases[0].preference, 'A');
assert.equal(blocked.db.chipLab.runs[0].cases[0].revealed, false);
assert.equal(blocked.db.chipLab.runs[0].cases[0].notes, 'The example was helpful.');
assert.equal(blocked.db.chipLab.runs[0].cases[0].role, 'holdout');

const duplicate = fixture();
duplicate.db.chipLab.cases = [{ id: 'new-case', prompt: ' ＫＮＯＷＮ\u00a0task ', rubric: '' }];
await duplicate.lab.action('lab-run');
assert.equal(duplicate.calls.length, 0);
assert.ok(duplicate.notices.some(message => /fresh held-out/.test(message)));
duplicate.db.chipLab.cases = [
  { id: 'duplicate-one', prompt: 'Explain something new.', rubric: '' },
  { id: 'duplicate-two', prompt: ' Ｅｘｐｌａｉｎ something new. ', rubric: '' },
];
await duplicate.lab.action('lab-run');
assert.equal(duplicate.calls.length, 0);
assert.ok(duplicate.notices.some(message => /duplicate prompts/.test(message)));

const nested = fixture();
nested.db.lessons[0].examples = [{
  prompt: 'Supervised context (role-tagged data):\n' + JSON.stringify([
    { role: 'system', content: 'Use the supplied context.' },
    { role: 'user', content: 'Teaching goal: Be clear\nSuccess checks: Correct\n\nTask:\nA reserved nested question' },
    { role: 'assistant', content: 'Context answer' },
    { role: 'user', content: 'Another final question' },
  ]),
  completion: 'A final answer',
}];
nested.db.chipLab.cases = [{ id: 'nested-case', prompt: 'Ａ reserved nested question', rubric: '' }];
await nested.lab.action('lab-run');
assert.equal(nested.calls.length, 0, 'held-out prompts cannot hide inside a prior role-tagged chip example');

const safe = fixture();
safe.db.chipLab.runs[0].cases[0].notes = '<img src=x onerror=alert(1)>';
assert.ok(safe.lab.view().includes('&lt;img'));
assert.ok(!safe.lab.view().includes('<img src=x'));

console.log('PASS: preference export eligibility, common context and provenance, human confirmation, holdout-to-development lineage, immutable chips, busy review guards, Unicode duplicate rejection, and safe rendering.');
