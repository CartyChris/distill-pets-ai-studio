import test from 'node:test';
import assert from 'node:assert/strict';
import { api, APIError } from '../client.js';

test('browser transport sends JSON on same-origin paths and preserves structured errors', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/fail') return new Response(JSON.stringify({ error: 'Please retry later.' }), { status: 429 });
    return new Response(JSON.stringify({ text: 'A useful result' }));
  };
  try {
    assert.deepEqual(await api.post('/api/complete', { messages: [] }), { data: { text: 'A useful result' } });
    assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(calls[0].options.body, '{"messages":[]}');
    await assert.rejects(api.get('/api/fail'), failure => failure instanceof APIError && failure.response.status === 429 && failure.response.data.error === 'Please retry later.');
    await assert.rejects(api.post('https://example.com/api/complete', {}), /same-origin/);
    await assert.rejects(api.get('/api/../complete'), /Invalid API path/);
    await assert.rejects(api.get('/api/%2e%2e/complete'), /Invalid API path/);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = original; }
});

test('browser transport hides unreadable responses and connection internals', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502 });
  try { await assert.rejects(api.get('/api/example'), /unreadable response/); }
  finally { globalThis.fetch = original; }
  globalThis.fetch = async () => { throw new Error('Internal connection details'); };
  try { await assert.rejects(api.get('/api/example'), failure => failure.message.includes('Could not reach') && !failure.message.includes('Internal')); }
  finally { globalThis.fetch = original; }
});
