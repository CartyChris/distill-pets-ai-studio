import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const code = await build({ entryPoints: [process.env.PIP_TEST_BACKEND || path.join(root, 'backend/index.ts')], bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' });
const { handler } = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
const complete = body => handler({ method: 'POST', path: '/api/complete', body });
const task = { messages: [{ role: 'user', content: 'Explain a rainbow to a child.' }] };

test('the actual backend serves playground work and validates live input', async () => {
  assert.equal((await handler({ method: 'GET', path: '/api/_healthcheck' })).statusCode, 200);
  const response = await complete({ ...task, demo: true });
  const sample = JSON.parse(response.body);
  assert.equal(response.statusCode, 200); assert.equal(sample.demo, true); assert.equal(sample.model, 'playground/sample'); assert.match(sample.text, /rainbow/i);
  assert.equal((await complete({ messages: [] })).statusCode, 400);
  assert.equal((await complete({ ...task, model: 'provider/model' })).statusCode, 401);
  assert.equal((await complete({ ...task, key: 'not-a-real-provider-key', model: '<bad>' })).statusCode, 400);
  assert.equal((await complete({ messages: [{ role: 'user', content: 'x'.repeat(160001) }], demo: true })).statusCode, 400);
});

test('provider protocol and failures work with an in-memory provider fixture', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url, options = {}) => {
    requests++;
    if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'provider/text', name: 'Text model', architecture: { output_modalities: ['text'] } }, { id: 'provider/image', name: 'Image model', architecture: { output_modalities: ['image'] } }] }));
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer not-a-real-provider-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'provider/text');
    if (body.messages[0].content === 'rate-limit') return new Response('{}', { status: 429 });
    return new Response(JSON.stringify({ model: 'provider/text', choices: [{ message: { content: 'A fixture response.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 4 } }));
  };
  try {
    const models = JSON.parse((await handler({ method: 'GET', path: '/api/models' })).body).models;
    assert.deepEqual(models.map(model => model.id), ['provider/text']);
    const live = await complete({ ...task, key: 'not-a-real-provider-key', model: 'provider/text' });
    const data = JSON.parse(live.body);
    assert.equal(live.statusCode, 200); assert.equal(data.text, 'A fixture response.'); assert.equal(data.demo, false); assert.equal(data.finishReason, 'stop');
    assert.ok(!live.body.includes('not-a-real-provider-key'));
    const limited = await complete({ messages: [{ role: 'user', content: 'rate-limit' }], key: 'not-a-real-provider-key', model: 'provider/text' });
    assert.equal(limited.statusCode, 429); assert.match(JSON.parse(limited.body).error, /rate limit/i);
    assert.equal(requests, 3);
  } finally { globalThis.fetch = original; }
});
