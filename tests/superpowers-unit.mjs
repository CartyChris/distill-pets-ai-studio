import assert from 'node:assert/strict';
import { cleanSuperpowers, createSuperpowers, normalizeReference, chunkReference, retrieveReference, renderTemplate, plannedCalls, portableBrain, processingMessages, teachingPrompt } from '../src/superpowers.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const workflow = { id: 'custom-flow', name: 'Reference helper', goal: 'Answer accurately.', instructions: 'Answer {{task}} using {{context}}. Check claims.', criteria: 'State uncertainties and cite the supplied reference labels.', reference: 'Orchids prefer bright indirect light.\n\nCacti need fast-draining soil and less frequent watering.' };
const model = 'test/workflow-model';
function fixture(complete) {
  const db = { mode: 'live', maxTokens: 1024, generation: { brief: 'FROZEN_BRIEF', temperature: 0.3 }, agents: { milo: { name: 'Milo', model, voice: 'precise' }, nova: { name: 'Nova', model: 'test/other' } }, lessons: [], superpowers: cleanSuperpowers({ workflows: [workflow], selected: workflow.id, task: 'How should I water cacti?', context: 'For an indoor beginner.', rounds: 2, agent: 'milo' }) };
  let op = 0, busy = false;
  const calls = [], notices = [], downloads = [], tasks = [], chips = [];
  const powers = createSuperpowers({ getDB: () => db, escape, button: (a,l,c='',at='') => `<button data-action="${a}" class="${c}" ${at}>${l}</button>`, save() {}, render() {}, toast: message => notices.push(message), setError: message => notices.push(message), openModal() {}, download: (...args) => downloads.push(args), getBusy: () => busy, ready: () => true, start: () => { busy = true; return ++op; }, finish: (_, token) => { if (token === op) busy = false; }, currentOp: () => op,
    studentMessages: (prompt, chip, agent) => [{ role: 'system', content: `Public assistant ${agent}. ${db.generation.brief}. ${db.agents[agent].voice || 'warm'}${chip ? '. ' + chip.instructions : ''}` }, { role: 'user', content: prompt }],
    completion: async (...args) => { calls.push(args); return complete ? complete(args, calls.length, db) : { text: calls.length % 2 ? 'Useful output ' + calls.length : 'Public critique ' + calls.length, finishReason: 'stop' }; },
    saveTask: value => { tasks.push(value); return true; }, prepareTask: value => notices.push(value), createChip: value => { chips.push(value); return true; },
  });
  return { db, powers, calls, notices, downloads, tasks, chips, invalidate() { op++; busy = false; } };
}

assert.equal(plannedCalls(0), 1); assert.equal(plannedCalls(1), 3); assert.equal(plannedCalls(99), 5);
assert.equal(renderTemplate('Task {{task}}; context {{ context }}; {{unknown}}', { task: '$& <b>safe</b>', context: 'notes' }), 'Task $& <b>safe</b>; context notes; {{unknown}}');
assert.equal(normalizeReference('\ufeffhello\u0000\r\nworld', 'notes.txt'), 'hello\nworld');
assert.equal(normalizeReference('{"plant":"cactus","water":2}', 'data.json'), '{\n  "plant": "cactus",\n  "water": 2\n}');
assert.throws(() => normalizeReference('{broken', 'data.json'), /JSON/i);
assert.throws(() => normalizeReference('x'.repeat(204801), 'notes.txt'), /200|large|limit/i);
assert.throws(() => normalizeReference('<script>run()</script>', 'notes.html'), /text|type|format|supported/i);
const corpus = 'Orchids like indirect light. '.repeat(35) + 'CACTI_UNIQUE need fast-draining soil. '.repeat(35);
const chunks = chunkReference(corpus);
assert.ok(chunks.length > 1 && chunks.length <= 320);
assert.ok(chunks.every(chunk => chunk.text.length <= 800));
assert.equal(chunkReference('a'.repeat(500), { size: 200, overlap: 0 })[1].start, 200);
const retrieved = retrieveReference(corpus, 'CACTI_UNIQUE soil', 3);
assert.ok(retrieved.length > 0 && retrieved[0].text.includes('CACTI_UNIQUE'));
assert.deepEqual(retrieveReference(corpus, 'CACTI_UNIQUE soil', 3), retrieved, 'Local retrieval is deterministic');
assert.ok(retrieveReference('', 'question').length === 0);
const normalized = cleanSuperpowers({ key: 'MUST_NOT_PERSIST', workflows: [workflow, { ...workflow }], history: [{ id: 'interrupted', status: 'running', output: 'Paid draft', setup: { task: 'original', model, agent: 'milo', demo: false } }], memory: [{ id: 'note', approved: false, text: 'Unreviewed' }] });
assert.equal(normalized.workflows.length, 1, 'Duplicate workflow IDs do not produce ambiguous selection');
assert.equal(normalized.history[0].status, 'stopped'); assert.equal(normalized.history[0].output, 'Paid draft');
assert.ok(!JSON.stringify(normalized).includes('MUST_NOT_PERSIST'));
assert.ok(normalized.memory.every(note => note.approved === true), 'Unreviewed notes cannot masquerade as reviewed learning memory');

const frozen = fixture(async (args,n,db) => {
  if (n === 1) { db.agents.milo.model = 'test/MUTATED'; db.agents.milo.voice = 'MUTATED_VOICE'; db.generation.brief = 'MUTATED_BRIEF'; db.generation.temperature = 1.5; db.maxTokens = 8000; db.superpowers.workflows[0].instructions = 'MUTATED_FLOW'; db.superpowers.task = 'MUTATED_TASK'; }
  return { text: n % 2 ? 'Frozen output ' + n : 'Concrete public critique ' + n, finishReason: 'stop', reasoning: 'PRIVATE_REASONING' };
});
await frozen.powers.action('power-run');
assert.equal(frozen.calls.length, 5);
for (const call of frozen.calls) {
  assert.equal(call[4].model, model); assert.equal(call[4].maxTokens, 1024); assert.equal(call[4].temperature, 0.3);
  assert.ok(!JSON.stringify(call).includes('MUTATED_')); assert.ok(JSON.stringify(call[1]).includes('cacti'));
}
assert.equal(frozen.db.superpowers.history.at(-1).output, 'Frozen output 5');
assert.equal(frozen.db.superpowers.history.at(-1).status, 'complete');
assert.equal(frozen.tasks.length, 0, 'Successful runs never flood task history automatically');
assert.equal(frozen.chips.length, 0);
assert.ok(!JSON.stringify(frozen.db.superpowers).includes('PRIVATE_REASONING'));
await frozen.powers.action('power-save-task');
assert.equal(frozen.tasks.length, 1); assert.ok(frozen.tasks[0].prompt.includes('How should I water cacti?'));
for (const context of [workflow.instructions, workflow.criteria, 'Cacti need fast-draining soil', 'FROZEN_BRIEF', 'Concrete public critique 2']) assert.ok(frozen.tasks[0].prompt.includes(context), 'Saved teaching examples retain frozen input: ' + context);
await frozen.powers.action('power-save-task'); assert.equal(frozen.tasks.length, 1, 'Explicit task save is idempotent per run');

const failure = fixture(async (_,n) => { if (n === 2) throw Error('Review rate limited'); return { text: 'PAID_DRAFT_KEPT', finishReason: 'stop' }; });
await failure.powers.action('power-run');
assert.equal(failure.calls.length, 2); assert.equal(failure.db.superpowers.history[0].output, 'PAID_DRAFT_KEPT'); assert.equal(failure.db.superpowers.history[0].status, 'failed');
const reloaded = cleanSuperpowers(failure.db.superpowers); assert.equal(reloaded.history[0].output, 'PAID_DRAFT_KEPT');
await failure.powers.action('power-save-task');assert.equal(failure.tasks[0].status,'draft');assert.ok(failure.tasks[0].error.includes('rate limited'));

let release;
const pending = fixture(() => new Promise(resolve => { release = resolve; }));
const executing = pending.powers.action('power-run');
await Promise.resolve(); pending.powers.stop(); pending.invalidate(); release({ text: 'LATE_MUST_NOT_REPLACE', finishReason: 'stop' }); await executing;
assert.equal(pending.calls.length, 1); assert.equal(pending.db.superpowers.history[0].status, 'stopped'); assert.equal(pending.db.superpowers.history[0].output, '');

const partial = fixture(async () => ({ text: 'Partial provider answer', finishReason: 'length' }));
await partial.powers.action('power-run'); assert.equal(partial.calls.length, 1); assert.equal(partial.db.superpowers.history[0].status, 'partial'); assert.equal(partial.db.superpowers.history[0].truncated, true);

const memory = fixture(); memory.db.superpowers.rounds = 0;
await memory.powers.action('power-run');
memory.powers.input({ id: 'power-memory-note', value: 'Prefer accurate mechanisms before using playful analogies.' });
await memory.powers.action('power-save-memory'); assert.equal(memory.db.superpowers.memory.length, 0, 'Human review is required before a note is usable');
memory.powers.change({ id: 'power-memory-approved', checked: true }); await memory.powers.action('power-save-memory');
assert.equal(memory.db.superpowers.memory.length, 1); assert.equal(memory.db.superpowers.memory[0].approved, true);
memory.powers.change({ id: 'power-use-memory', checked: true }); await memory.powers.action('power-run');
assert.ok(JSON.stringify(memory.calls.at(-1)[1]).includes('Prefer accurate mechanisms'));
memory.db.superpowers.agent = 'nova'; await memory.powers.action('power-run');
assert.ok(!JSON.stringify(memory.calls.at(-1)[1]).includes('Prefer accurate mechanisms'), 'Agent/model-mismatched memory cannot silently transfer');

const full = fixture();full.db.superpowers.rounds = 0;full.db.superpowers.task = 't'.repeat(12000);full.db.superpowers.context = 'q'.repeat(12000);full.db.superpowers.workflows[0].instructions = 'i'.repeat(12000);full.db.superpowers.workflows[0].criteria = 'c'.repeat(4000);
await full.powers.action('power-run');assert.throws(()=>teachingPrompt(full.db.superpowers.history.at(-1)),/30,000/);
await full.powers.action('power-save-task');assert.equal(full.tasks.length,0,'Oversized teaching context is rejected instead of silently losing sources');
full.powers.input({id:'power-memory-note',value:'A reviewed useful note'});full.powers.change({id:'power-memory-approved',checked:true});await full.powers.action('power-create-chip');assert.equal(full.chips.length,0,'Oversized teaching context cannot create a clipped model-chip example');
const quoted='"'.repeat(12000),bounded=processingMessages([{role:'system',content:'s'.repeat(24000)},{role:'user',content:'u'.repeat(18000)},{role:'assistant',content:'a'.repeat(18000)}],{task:quoted,context:quoted,workflow_instructions:quoted,workflow_goal:'g'.repeat(3000),output_criteria:'c'.repeat(4000),draft:'"'.repeat(24000),reference_excerpts:Array.from({length:4},()=>({text:'r'.repeat(800)})),reviewed_lesson_memory:['m'.repeat(2000)]},'critique');
assert.ok(bounded.excerpted);assert.ok(bounded.messages.reduce((sum,message)=>sum+message.content.length,0)<=150000);assert.ok(bounded.messages.at(-1).content.includes(JSON.stringify(quoted)),'Original task is preserved when optional context is excerpted');

const js = portableBrain(workflow, 'javascript', { model, rounds: 2 });
const py = portableBrain(workflow, 'python', { model, rounds: 2 });
assert.ok(js.filename.endsWith('.mjs') && js.content.includes('OPENROUTER_API_KEY'));
assert.ok(py.filename.endsWith('.py') && py.content.includes('OPENROUTER_API_KEY'));
assert.ok(!js.content.includes('eval(') && !py.content.includes('exec('));
assert.ok(frozen.powers.view().includes('Superpowers'));
assert.equal(frozen.powers.action('unrelated-action'), false);
assert.equal(frozen.powers.input({ id: 'custom-milo', value: 'other' }), false);
console.log('PASS: Superpowers normalized data/retrieval/templates, actual bounded frozen model pipeline, reviewed memory, explicit exports/saves, partial/error/reload/Stop recovery and portable artifact contracts.');
