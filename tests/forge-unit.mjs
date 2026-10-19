import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanForge, validateUISchema, validateDiagramSource, workflowMermaid, FORGE_UI_TEMPLATES, createForge, sanitizeForgeCSS } from '../src/forge.js';

test('native UI schema accepts useful components and normalizes a portable document', () => {
  const schema = validateUISchema(FORGE_UI_TEMPLATES.dashboard);
  assert.equal(schema.version, 1);
  assert.ok(schema.blocks.some(block => block.type === 'metric' || block.children?.some(child => child.type === 'metric')));
  assert.ok(schema.blocks.some(block => block.type === 'checklist'));
});

test('UI schema rejects execution surfaces, unknown attributes, unsafe URLs, and over-budget trees', () => {
  const root = block => ({ version: 1, title: 'Test', blocks: [block] });
  for (const block of [
    { type: 'html', body: '<script>boom()</script>' },
    { type: 'card', title: 'Hello', body: 'Safe text', onclick: 'boom()' },
    { type: 'link', label: 'Bad', href: 'javascript:alert(1)' },
    { type: 'link', label: 'Bad', href: 'http://example.com' },
    { type: 'link', label: 'Bad', href: 'https://user:password@example.com' },
    { type: 'metric', label: 'Big', value: 'x'.repeat(9000) },
    { type: 'table', columns: ['A'], rows: [['A', 'Extra cell']] },
  ]) assert.throws(() => validateUISchema(root(block)));
  let nested = { type: 'notice', body: 'End' };
  for (let i = 0; i < 8; i++) nested = { type: 'card', title: 'Nested', children: [nested] };
  assert.throws(() => validateUISchema(root(nested)), /depth|nested/i);
  assert.throws(() => validateUISchema({ version: 1, title: 'Many', blocks: Array(100).fill({ type: 'metric', label: 'A', value: '1' }) }), /blocks|components|limit/i);
  assert.throws(() => validateUISchema('{"version":1, broken'), /JSON/i);
});

test('UI supports a safe prefill action and a native local form', () => {
  const doc = validateUISchema({ version: 1, title: 'Helper', blocks: [
    { type: 'action', label: 'Prepare a lesson', task: 'Explain rainbows.' },
    { type: 'form', title: 'Task brief', fields: [{ id: 'audience', label: 'Audience', kind: 'text', required: true }], taskPrefix: 'Write an explanation', buttonLabel: 'Prepare task' },
    { type: 'link', label: 'OpenRouter', href: 'https://openrouter.ai/docs' },
  ] });
  assert.equal(doc.blocks.length, 3);
  assert.equal(doc.blocks[1].fields[0].required, true);
});

test('diagram gate bounds input and disallows external rendering assets/configuration overrides', () => {
  assert.equal(validateDiagramSource('flowchart LR\n A["A"] --> B["B"]'), 'flowchart LR\n A["A"] --> B["B"]');
  for (const source of ['', 'x'.repeat(20001), '%%{init:{"securityLevel":"loose"}}%%\nflowchart LR\nA-->B', '---\nconfig:\n securityLevel: loose\n---\nflowchart LR\nA-->B', 'flowchart LR\nA@{img:"https://example.com/pixel"}', 'flowchart LR\nA["A"]\nstyle A fill:url(https://example.com/a)', '<img src="https://example.com/pixel">']) {
    assert.throws(() => validateDiagramSource(source));
  }
  assert.throws(() => validateDiagramSource('flowchart LR\nA-->B\nclassDef default background-image:image-set("https://example.com/a" 1x)'));
});

test('Mermaid CSS keeps local paints and layout while dropping all remote image/font mechanisms', () => {
  const source = 'fill:url(#arrow);stroke:rgb(20,30,40);font-size:16px;background-image:image-set("https://example.com/img" 1x);content:image("https://example.com/a");--remote:url(https://example.com/x);font-family:system-ui;filter:url(https://example.com/filter);';
  const clean = sanitizeForgeCSS(source);
  assert.ok(clean.includes('fill:url(#arrow)'));
  assert.ok(clean.includes('font-size:16px'));
  assert.ok(clean.includes('font-family:system-ui'));
  assert.equal(clean.includes('example.com'), false);
  assert.equal(clean.includes('image-set'), false);
  assert.equal(clean.includes('--remote'), false);
  assert.equal(sanitizeForgeCSS('rect:hover{fill:red;stroke:url(#arrow)} @font-face{font-family:bad;src:url(https://example.com/font)}', true).includes('example.com'), false);
});

test('workflow source describes the known prompt/example boundary with stable quoted nodes', () => {
  const source = workflowMermaid();
  assert.ok(source.startsWith('flowchart'));
  assert.ok(source.includes('Teacher'));
  assert.ok(source.includes('Weights stay unchanged'));
  const supplied = workflowMermaid({ nodes: [{ id: 'a', label: 'Provided "source"' }, { id: 'b', label: 'Review' }], edges: [{ from: 'a', to: 'b', label: 'verified' }, { from: 'a', to: 'missing' }] });
  assert.ok(supplied.includes('#quot;source#quot;'));
  assert.ok(supplied.includes('n0 -->|"verified"| n1'));
  assert.equal(supplied.includes('missing'), false);
});

test('backup cleaner never trusts stored SVG, arbitrary local state, or in-flight generation', () => {
  const state = cleanForge({ diagramSource: 'x'.repeat(40000), svg: '<script>bad()</script>', zoom: 99, checked: { '0.item': true, '__proto__': true }, fields: { '1.name': 'y'.repeat(3000), 'onclick': 'bad' }, generation: { status: 'running', kind: 'ui' }, lastUISource: '<script>' });
  assert.equal(state.diagramSource.length, 20000);
  assert.equal('svg' in state, false);
  assert.equal(state.zoom, 1);
  assert.equal(state.fields['1.name'].length, 1000);
  assert.equal('onclick' in state.fields, false);
  assert.equal(state.generation.status, 'stopped');
  assert.equal(validateUISchema(state.lastUISource).version, 1);
});

test('native UI action prepares a draft without making a completion call', async () => {
  const db = { forge: cleanForge({ tab: 'ui', uiSource: JSON.stringify({ version: 1, title: 'Task', blocks: [{ type: 'action', label: 'Prepare', task: 'A useful task.' }] }) }), agents: { milo: {}, nova: {} } };
  const prepared = [];
  let completions = 0;
  const forge = createForge({ getDB: () => db, prepareTask: (...args) => prepared.push(args), completion: () => completions++ });
  await forge.action('forge-ui-apply');
  await forge.action('forge-ui-action', { path: '0' });
  assert.deepEqual(prepared, [['A useful task.', 'milo']]);
  assert.equal(completions, 0);
});

test('invalid JSON preserves the last good preview document and reports a useful error', async () => {
  const db = { forge: cleanForge(null) };
  const forge = createForge({ getDB: () => db });
  const good = db.forge.lastUISource;
  forge.input({ id: 'forge-ui-source', value: '{ "version": 1, invalid' });
  await forge.action('forge-ui-apply');
  assert.equal(db.forge.lastUISource, good);
  assert.match(db.forge.uiError, /JSON/i);
});

test('near-budget valid JSON survives preview serialization and backup restoration', async () => {
  const source = JSON.stringify({ version: 1, title: 'A full but valid document', blocks: Array.from({ length: 20 }, (_, i) => ({ type: 'card', title: 'Card ' + i, body: 'x'.repeat(1900) })) });
  assert.ok(source.length < 40000);
  const db = { forge: cleanForge({ uiSource: source }) };
  await createForge({ getDB: () => db }).action('forge-ui-apply');
  assert.equal(db.forge.uiError, '');
  assert.ok(db.forge.lastUISource.length <= 40000, 'Formatting must not exceed the persistence/source budget');
  const restored = cleanForge(JSON.parse(JSON.stringify(db.forge)));
  assert.equal(validateUISchema(restored.lastUISource).title, 'A full but valid document');
  assert.equal(validateUISchema(restored.lastUISource).blocks.length, 20);
});

test('generation preserves edits made while a model request is in flight', async () => {
  const db = { forge: cleanForge({ tab: 'ui', uiRequest: 'Make a dashboard.' }), agents: { milo: { model: 'test/model' } }, mode: 'demo', generation: { temperature: 0.3 }, maxTokens: 2048 };
  let resolve;
  const forge = createForge({ getDB: () => db, ready: () => true, start: () => 1, finish: () => {}, currentOp: () => 1, completion: () => new Promise(done => resolve = done) });
  const pending = forge.action('forge-generate', { kind: 'ui' });
  const edited = JSON.stringify({ version: 1, title: 'My manual edits', blocks: [] });
  forge.input({ id: 'forge-ui-source', value: edited });
  resolve({ text: JSON.stringify({ version: 1, title: 'Generated later', blocks: [] }) });
  await pending;
  assert.equal(db.forge.uiSource, edited);
  assert.equal(db.forge.generation.status, 'failed');
  assert.match(db.forge.generation.error, /edited the source/i);
  assert.ok(db.forge.uiRaw.includes('Generated later'));
});

test('truncated model output is never accepted even when it parses as JSON', async () => {
  const db = { forge: cleanForge({ tab: 'ui', uiRequest: 'Make a dashboard.' }), agents: { milo: { model: 'test/model' } }, mode: 'demo' };
  const previous = db.forge.uiSource;
  const forge = createForge({ getDB: () => db, ready: () => true, start: () => 1, finish: () => {}, currentOp: () => 1, completion: async () => ({ text: '{"version":1,"title":"Looks valid","blocks":[]}', truncated: true }) });
  await forge.action('forge-generate', { kind: 'ui' });
  assert.equal(db.forge.uiSource, previous);
  assert.equal(db.forge.generation.status, 'failed');
  assert.ok(db.forge.uiRaw.includes('Looks valid'));
});

test('generation freezes the selected model, mode, limits, style, and compatible chip messages', async () => {
  const chip = { id: 'chip', baseModel: 'teacher/model', approved: true, reviewed: true, demo: true };
  const db = { forge: cleanForge({ tab: 'ui', uiRequest: 'Make a dashboard.' }), agents: { milo: { model: 'teacher/model', chipId: 'chip' } }, lessons: [chip], mode: 'demo', generation: { temperature: 0.3, brief: 'For a beginner' }, maxTokens: 2048 };
  let complete, captured;
  const baseMessages = [{ role: 'system', content: 'Warm pet voice and approved chip instructions.' }, { role: 'user', content: 'A task.' }];
  const forge = createForge({ getDB: () => db, ready: () => true, start: () => 1, finish: () => {}, currentOp: () => 1,
    studentMessages: (prompt, passedChip) => { assert.equal(passedChip.id, chip.id); return baseMessages; },
    completion: (agent, messages, kind, op, options) => { captured = { agent, messages, kind, op, options }; return new Promise(resolve => complete = resolve); } });
  const pending = forge.action('forge-generate', { kind: 'ui' });
  db.mode = 'live'; db.generation.temperature = 1.5; db.maxTokens = 8000; baseMessages[0].content = 'Later edits';
  assert.equal(captured.options.demo, true);
  assert.equal(captured.options.model, 'teacher/model');
  assert.equal(captured.options.temperature, 0.3);
  assert.equal(captured.options.maxTokens, 2048);
  assert.ok(captured.messages[0].content.startsWith('Warm pet voice'));
  assert.ok(captured.messages[0].content.includes('Required artifact format'));
  complete({ text: '{"version":1,"title":"Safe response","blocks":[]}' });
  await pending;
  assert.equal(db.forge.generation.demo, true);
});

test('incompatible, unreviewed, and mismatched live chips cannot trigger a model call', async () => {
  for (const chip of [
    { id: 'chip', baseModel: 'chosen/model', approved: true, reviewed: false, demo: false },
    { id: 'chip', baseModel: 'chosen/model', approved: true, reviewed: true, demo: true },
    { id: 'chip', baseModel: 'other/model', approved: true, reviewed: true, demo: false },
  ]) {
    const db = { forge: cleanForge({ tab: 'ui', uiRequest: 'Make a dashboard.' }), agents: { milo: { model: 'chosen/model', chipId: 'chip' } }, lessons: [chip], mode: 'live' };
    let calls = 0;
    const forge = createForge({ getDB: () => db, ready: () => true, start: () => 1, finish: () => {}, completion: () => calls++ });
    await forge.action('forge-generate', { kind: 'ui' });
    assert.equal(calls, 0);
  }
});
