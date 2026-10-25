import assert from 'node:assert/strict';
import { cleanTeaching, createTeaching, parseTeachingImport, normalizeTeachingPrompt, teachingSplitConflicts, teachingRowsForExport, teachingRowPrompts, teachingPromptParts } from '../src/teaching.js';

function fixture(responder, extras = {}) {
  const db = {
    mode: 'live', maxTokens: 2048, generation: { temperature: .35 },
    agents: { milo: { name: 'Milo', model: 'test/teacher' }, nova: { name: 'Nova', model: 'test/student' } },
    lessons: [], teaching: cleanTeaching(null),
  };
  let busy = false, operation = 0;
  const calls = [], notices = [], downloads = [], chips = [], openedLab = [];
  const workshop = createTeaching({
    getDB: () => db, escape: value => String(value).replace(/[<>"&']/g, ''),
    button: (action, label, classes, attributes) => `<button data-action="${action}" ${attributes || ''}>${label}</button>`,
    mascot: () => '<span class="mascot"></span>', save() {}, render() {}, toast: message => notices.push(message), setError: message => notices.push(message), openModal() {},
    download: (...args) => downloads.push(args), getBusy: () => busy, ready: () => true,
    start: () => { busy = true; return ++operation; }, finish: (_, op) => { if (operation === op) busy = false; }, currentOp: () => operation,
    studentMessages: (prompt, chip, agent) => [{ role: 'system', content: 'FROZEN_PROFILE_' + db.generation.temperature + '_' + agent + (chip ? '_' + chip.instructions : '') }, { role: 'user', content: prompt }],
    completion: async (...args) => {
      calls.push(args);
      return responder ? responder(args, calls.length, db) : { text: args[2] + '_OUTPUT_' + calls.length, finishReason: 'stop' };
    },
    lesson: agent => db.lessons.find(chip => chip.id === db.agents[agent].chipId),
    createChip: payload => { const chip = { ...payload, id: 'saved-chip-' + (chips.length + 1), approved: false, reviewed: false }; chips.push(chip); db.lessons.push(chip); return chip; },
    openLab: options => openedLab.push(options), setPage() {}, ...extras,
  });
  return { db, workshop, calls, notices, downloads, chips, openedLab, invalidate() { operation++; busy = false; } };
}
const one = fixture();
assert.match(one.workshop.view(), /The Teaching Workshop/);
assert.equal(one.db.teaching.cards.filter(c => c.selected).length, 1);
assert.equal(one.db.teaching.cards.filter(c => c.split === 'validation').length, 1);
await one.workshop.action('learn-run');
assert.deepEqual(one.calls.map(call => call[2]), ['learn-attempt', 'learn-feedback', 'learn-revision']);
assert.equal(one.db.teaching.runs[0].status, 'complete');
assert.equal(one.db.teaching.runs[0].calls, 3);
assert.equal(one.db.teaching.rows.length, 1);
assert.equal(one.db.teaching.rows[0].approved, false, 'returned revisions require explicit human approval');
assert.ok(one.calls[1][1].at(-1).content.includes('learn-attempt_OUTPUT_1'), 'teacher receives actual student attempt');
assert.ok(one.calls[2][1].at(-1).content.includes('learn-feedback_OUTPUT_2'), 'student receives actual teacher feedback');
assert.equal(one.workshop.getOuting().dialogue.length, 3);
assert.equal(one.workshop.getOuting().kind, 'teach');
assert.equal(one.workshop.getOuting().workshop, true);
assert.equal(teachingRowsForExport(one.db.teaching.rows).length, 0);
one.workshop.change({ dataset: { learnReview: one.db.teaching.rows[0].id }, checked: true });
await one.workshop.action('learn-export-sft');
const exported = JSON.parse(one.downloads[0][1].trim());
assert.equal(exported.messages.at(-1).content, 'learn-revision_OUTPUT_3');
assert.match(exported.messages.at(-2).content, /Teaching goal:/, 'SFT retains task goal and success criteria context');
assert.equal(exported.messages[0].content, 'FROZEN_PROFILE_0.35_nova');

const ceiling = fixture();
ceiling.db.teaching.cards = [1, 2, 3].map(n => ({ id: 'practice-' + n, prompt: 'Distinct practice task ' + n, rubric: 'Be correct.', split: 'train', selected: true }));
ceiling.db.teaching.reference = true;
await ceiling.workshop.action('learn-run');
assert.equal(ceiling.calls.length, 12);
assert.equal(ceiling.db.teaching.runs[0].plannedCalls, 12);
assert.deepEqual(ceiling.calls.map(call => call[2]), Array(3).fill(['learn-reference', 'learn-attempt', 'learn-feedback', 'learn-revision']).flat());
assert.equal(ceiling.db.teaching.rows.length, 3);
assert.ok(!ceiling.calls[1][1].some(message => message.content.includes('learn-reference_OUTPUT')), 'student first attempt is not secretly given teacher reference');
assert.match(ceiling.calls[2][1].at(-1).content, /learn-reference_OUTPUT_1/);

const frozen = fixture(async (args, n, db) => {
  if (n === 1) {
    db.agents.milo.model = 'mutated/teacher'; db.agents.nova.model = 'mutated/student';
    db.generation.temperature = 1.5; db.maxTokens = 8000; db.teaching.goal = 'MUTATED_GOAL';
    db.teaching.cards[0].prompt = 'MUTATED_TASK';
  }
  return { text: 'Frozen response ' + n, finishReason: 'stop' };
});
await frozen.workshop.action('learn-run');
assert.deepEqual(frozen.calls.map(call => call[4].model), ['test/student', 'test/teacher', 'test/student']);
assert.ok(frozen.calls.every(call => call[4].temperature === .35 && call[4].maxTokens === 2048));
assert.ok(!JSON.stringify(frozen.calls).includes('MUTATED_'));
assert.ok(frozen.calls.every(call => call[1][0].content.includes('FROZEN_PROFILE_0.35')));
assert.ok(!JSON.stringify(frozen.db.teaching.runs).includes('MUTATED_'));

const leak = fixture();
leak.db.teaching.cards.push({ id: 'bad-holdout', prompt: '  EXPLAIN how a rainbow forms to a curious nine-year-old. ', split: 'validation', selected: false, rubric: '' });
await leak.workshop.action('learn-run');
assert.equal(leak.calls.length, 0);
assert.ok(leak.notices.some(message => /validation/i.test(message)));
assert.equal(teachingSplitConflicts(leak.db.teaching.cards).length, 1);
assert.equal(normalizeTeachingPrompt('  Hello \n WORLD '), 'hello world');
const previouslyUsed = fixture();
await previouslyUsed.workshop.action('learn-run');
const card = previouslyUsed.db.teaching.cards[0];
previouslyUsed.workshop.change({ dataset: { learnSplit: card.id }, value: 'validation' });
assert.equal(card.split, 'train', 'a taught task cannot later be relabeled fresh validation');

const failure = fixture(async (_, n) => { if (n === 2) throw Error('Provider unavailable'); return { text: 'Preserved first attempt', finishReason: 'stop' }; });
await failure.workshop.action('learn-run');
assert.equal(failure.calls.length, 2);
assert.equal(failure.db.teaching.runs[0].status, 'failed');
assert.equal(failure.db.teaching.runs[0].items[0].attempt.text, 'Preserved first attempt');
assert.equal(failure.db.teaching.rows.length, 0);
const truncated = fixture(async () => ({ text: 'Partial response', finishReason: 'length' }));
await truncated.workshop.action('learn-run');
assert.equal(truncated.calls.length, 1);
assert.equal(truncated.db.teaching.runs[0].items[0].attempt.truncated, true);
assert.equal(truncated.db.teaching.rows.length, 0);

let release;
const delayed = fixture(() => new Promise(resolve => { release = resolve; }));
const pending = delayed.workshop.action('learn-run');
await Promise.resolve();
assert.equal(delayed.workshop.stop(), true);
release({ text: 'Late response must be ignored', finishReason: 'stop' });
await pending;
assert.equal(delayed.calls.length, 1);
assert.equal(delayed.db.teaching.runs[0].status, 'stopped');
assert.equal(delayed.db.teaching.runs[0].items[0].attempt.text, '');
assert.equal(delayed.db.teaching.rows.length, 0);

const demo = fixture(); demo.db.mode = 'demo';
await demo.workshop.action('learn-run');
const demoRow = demo.db.teaching.rows[0];
demo.workshop.change({ dataset: { learnReview: demoRow.id }, checked: true });
await demo.workshop.action('learn-export-sft');
assert.equal(demo.downloads.length, 0);
assert.ok(demo.calls.every(call => call[4].demo === true && call[4].model === 'playground/sample'));
demo.db.mode = 'live';
await demo.workshop.action('learn-select-row', { id: demoRow.id });
assert.equal(demo.db.teaching.selectedRows.length, 0, 'opposite-mode rows cannot become chip examples');
assert.equal(teachingRowsForExport([demoRow]).length, 0);

const parsed = parseTeachingImport('{"prompt":"First task","completion":"Answer","approved":true,"demo":false}\n{"prompt":" first  TASK ","completion":"Another answer"}', true);
assert.equal(parsed.rows.length, 1);
assert.equal(parsed.duplicateCount, 1);
assert.equal(parsed.rows[0].approved, false);
assert.equal(parsed.rows[0].demo, true, 'file metadata cannot promote Playground examples to live');
assert.throws(() => parseTeachingImport('{"prompt":"x","completion":"a"}\n{"prompt":"missing answer"}'), /Example 2/);
assert.throws(() => parseTeachingImport('x'.repeat(512 * 1024 + 1)), /512 KiB/);
assert.throws(() => parseTeachingImport(JSON.stringify(Array.from({ length: 61 }, (_, i) => ({ prompt: 'task-' + i, completion: 'answer' })))), /60/);
assert.throws(() => parseTeachingImport(JSON.stringify({ prompt: 'x', completion: 'a'.repeat(12001) })), /12,000/);
assert.throws(() => parseTeachingImport(JSON.stringify({ messages: [{ role: 'user', content: 'Question' }, { role: 'tool', content: 'No' }] })), /plain-text/);
const messages = parseTeachingImport(JSON.stringify({ messages: [{ role: 'system', content: 'Use approved FAQ.' }, { role: 'user', content: 'Question' }, { role: 'assistant', content: 'Answer' }] }));
assert.equal(messages.rows[0].messages[0].content, 'Use approved FAQ.');

const imported = fixture();
await imported.workshop.importData({ name: 'examples.jsonl', size: 80, text: async () => '{"prompt":"New supplied task","completion":"Supplied answer"}' });
assert.equal(imported.db.teaching.rows.length, 1);
assert.equal(imported.db.teaching.rows[0].approved, false);
const count = imported.db.teaching.rows.length;
await assert.rejects(imported.workshop.importData({ name: 'bad.jsonl', size: 100, text: async () => '{"prompt":"Good","completion":"A"}\n{"prompt":"Bad"}' }), /Example 2/);
assert.equal(imported.db.teaching.rows.length, count, 'imports are atomic');
const validationPrompt = imported.db.teaching.cards.find(c => c.split === 'validation').prompt;
await assert.rejects(imported.workshop.importData({ name: 'leaky.json', size: 100, text: async () => JSON.stringify({ prompt: validationPrompt, completion: 'Do not import into train' }) }), /overlaps/);

await one.workshop.action('learn-select-row', { id: one.db.teaching.rows[0].id });
one.db.teaching.chipName = 'Reviewed teaching technique';
await one.workshop.action('learn-distill');
assert.equal(one.calls.length, 4);
assert.equal(one.chips.length, 1);
assert.equal(one.chips[0].approved, false);
assert.equal(one.chips[0].reviewed, false);
assert.match(one.chips[0].examples[0].prompt, /Teaching goal:/);
assert.equal(one.chips[0].examples[0].completion, 'learn-revision_OUTPUT_3');
one.chips[0].approved = true; one.chips[0].reviewed = true;
one.db.teaching.comparisonChip = one.chips[0].id;
await one.workshop.action('learn-open-lab');
assert.equal(one.openedLab.length, 1);
assert.equal(one.openedLab[0].cases.length, 1);
assert.equal(one.openedLab[0].chipId, one.chips[0].id);
assert.equal(one.openedLab[0].cases[0].prompt, one.db.teaching.cards.find(c => c.split === 'validation').prompt);
const restored = cleanTeaching({ ...one.db.teaching, key: 'DO_NOT_PERSIST', runs: [{ ...one.db.teaching.runs[0], status: 'running' }] });
assert.equal(restored.runs[0].status, 'stopped');
assert.equal(restored.runs[0].profiles.student[0].content, 'FROZEN_PROFILE_0.35_nova');
assert.ok(!JSON.stringify(restored).includes('DO_NOT_PERSIST'));
assert.equal(restored.rows[0].approved, true, 'untouched approved rows survive backup restore');
const oversized = cleanTeaching({ rows: [{ id: 'bad', prompt: 'task', completion: 'x'.repeat(12001), approved: true, messages: [] }] });
assert.equal(oversized.rows[0].approved, false);
assert.equal(oversized.rows[0].truncated, true);
const guided = fixture(undefined, { takeGuidance: (() => { let delivered = false; return () => { if (delivered) return []; delivered = true; return Array.from({ length: 8 }, (_, n) => ({ text: 'Steering message ' + n })); }; })() });
await guided.workshop.action('learn-run');
assert.equal(guided.calls[0][1].filter(message => message.content.startsWith('User steering for this step:')).length, 8, 'every consumed guidance item reaches the actual call');
assert.equal(guided.db.teaching.runs[0].guidance.length, 8);
assert.equal(cleanTeaching(guided.db.teaching).runs[0].guidance.length, 8);
assert.ok(guided.db.teaching.rows[0].messages.some(message => message.content.includes('Steering message 7')), 'supervised context retains applied user steering');
assert.equal(normalizeTeachingPrompt('Teaching goal: Be kind.\nSuccess checks: Be correct.\n\nTask:\n  A NEW task  '), 'a new task');
assert.equal(normalizeTeachingPrompt('Teaching goal: Be kind.\nSuccess checks: Be correct.\n\nTask:\nA NEW task\n\nUser steering supplied to the student:\nMake it shorter.'), 'a new task');
assert.match(one.calls.at(-1)[1].at(-1).content, /learn-feedback_OUTPUT_2/, 'distillation receives actual targeted teacher feedback, never just a revised answer');
const marked = fixture();
const reserved = marked.db.teaching.cards.find(c => c.split === 'validation');
marked.workshop.markDevelopment([reserved.prompt]);
await marked.workshop.action('learn-run');
assert.equal(marked.calls.length, 0, 'a validation result reused for improvement is no longer a fresh holdout');
assert.match(marked.workshop.view(), /overlaps practice data/);
const multi = fixture();
const hiddenValidation = multi.db.teaching.cards.find(c => c.split === 'validation').prompt;
const leakedMessages = [{ role: 'user', content: hiddenValidation }, { role: 'assistant', content: 'Prior answer' }, { role: 'user', content: 'Now explain another idea.' }, { role: 'assistant', content: 'New answer' }];
await assert.rejects(multi.workshop.importData({ name: 'multiturn.json', size: 500, text: async () => JSON.stringify({ messages: leakedMessages }) }), /overlaps/);
assert.equal(multi.db.teaching.rows.length, 0, 'earlier user turns cannot smuggle reserved tasks into the training basket');
const fullContext = fixture();
await fullContext.workshop.importData({ name: 'context.json', size: 500, text: async () => JSON.stringify({ messages: [{ content: 'The meeting city is Lisbon.', role: 'system' }, { role: 'user', content: 'Which city?' }, { role: 'assistant', content: 'Lisbon.' }, { role: 'user', content: 'Which country is that in?' }, { role: 'assistant', content: 'Portugal.' }] }) });
const contextRow = fullContext.db.teaching.rows[0];
fullContext.workshop.change({ dataset: { learnReview: contextRow.id }, checked: true });
assert.equal(cleanTeaching(fullContext.db.teaching).rows[0].approved, true, 'object property order does not invalidate an unchanged reviewed context');
await fullContext.workshop.action('learn-select-row', { id: contextRow.id });
fullContext.db.teaching.chipName = 'Use the supplied context';
await fullContext.workshop.action('learn-distill');
assert.match(fullContext.calls[0][1].at(-1).content, /Lisbon/);
assert.match(fullContext.chips[0].examples[0].prompt, /The meeting city is Lisbon/);
assert.match(fullContext.chips[0].examples[0].prompt, /assistant/);
assert.deepEqual(teachingPromptParts(fullContext.chips[0].examples[0].prompt), ['Which city?', 'Which country is that in?']);
assert.deepEqual(teachingRowPrompts(contextRow), ['Which country is that in?', 'Which city?']);
const inherited = fixture(undefined, { studentMessages: (prompt, chip) => [{ role: 'system', content: 'Use the chosen approach.' }, ...(chip?.examples || []).flatMap(example => [{ role: 'user', content: example.prompt }, { role: 'assistant', content: example.completion }]), { role: 'user', content: prompt }] });
inherited.db.lessons.push({ id: 'inherited-chip', instructions: 'A useful approach.', examples: [{ prompt: 'An already taught question.', completion: 'An already taught answer.' }], baseModel: 'test/student', teacherModel: 'test/teacher', approved: true, reviewed: true, demo: false });
inherited.db.agents.nova.chipId = 'inherited-chip'; inherited.db.teaching.useChip = true;
inherited.db.teaching.cards = [{ id: 'different-task', prompt: 'A different practice question.', rubric: 'Be correct.', split: 'train', selected: true }];
await inherited.workshop.action('learn-run');
assert.equal(inherited.calls.length, 3);
await inherited.workshop.action('learn-confirm-delete', { id: inherited.db.teaching.rows[0].id });
inherited.db.teaching.useChip = false;
inherited.db.teaching.cards.push({ id: 'leaky-reserved', prompt: 'An already taught question.', rubric: '', split: 'validation', selected: false });
await inherited.workshop.action('learn-export-validation');
assert.equal(inherited.downloads.length, 0, 'deleting a basket row cannot erase inherited chip exposure from the persistent history');
assert.match(inherited.workshop.view(), /overlaps practice data/);
const recovered = cleanTeaching({ ...inherited.db.teaching, developmentKeys: [] });
assert.ok(recovered.developmentKeys.length >= 2, 'run profile lineage reconstructs prior exposures on restore');
console.log('PASS Teaching Workshop: 3–12 frozen model calls; actual attempt/feedback/revision; review-gated live SFT; held-out isolation; atomic bounded imports; stop/late response; failure/partial recovery; draft chips; validation handoff; backup sanitization.');
