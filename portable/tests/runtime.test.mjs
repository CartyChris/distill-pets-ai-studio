import test from 'node:test';
import assert from 'node:assert/strict';
import { router, json, error } from '../runtime.js';

test('route helpers preserve JSON, methods, query, and response headers', async () => {
  const handler = router({ 'GET /api/example': [async context => json({ query: context.query })], 'POST /api/example': [async context => json(context.body, 201)] });
  assert.deepEqual(JSON.parse((await handler({ method: 'GET', path: '/api/example', query: { q: 'rainbow' } })).body), { query: { q: 'rainbow' } });
  assert.equal((await handler({ method: 'POST', path: '/api/example', body: { hello: 'world' } })).statusCode, 201);
  assert.equal((await handler({ method: 'DELETE', path: '/api/example' })).statusCode, 405);
  assert.equal((await handler({ method: 'DELETE', path: '/api/example' })).headers.Allow, 'GET, POST');
  assert.equal((await handler({ method: 'GET', path: '/api/missing' })).statusCode, 404);
  assert.deepEqual(JSON.parse(error('A clear error', 422).body), { error: 'A clear error' });
  assert.throws(() => router({ invalid: [] }), TypeError);
});
