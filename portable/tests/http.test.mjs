import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { createRequestHandler } from '../http.mjs';
import { router, json } from '../runtime.js';

const folder = await mkdtemp(path.join(os.tmpdir(), 'pip-http-'));
const dist = path.join(folder, 'dist');
await mkdir(path.join(dist, 'assets'), { recursive: true });
await writeFile(path.join(dist, 'index.html'), '<!doctype html><title>Pip</title>');
await writeFile(path.join(dist, 'sw.js'), '/* public shell worker */');
await writeFile(path.join(dist, 'manifest.webmanifest'), '{"name":"Pip"}');
await writeFile(path.join(dist, 'assets/app-A1234567.js'), 'export const hello = true;');
await writeFile(path.join(folder, 'private.txt'), 'outside-public-directory');
await symlink(path.join(folder, 'private.txt'), path.join(dist, 'escape.txt'));
const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'POST /api/echo': [async ({ body }) => json(body)],
  'GET /api/failure': [async () => { throw new Error('Internal marker must not leave the server.'); }],
});
const server = http.createServer(await createRequestHandler({ handler, staticDir: dist, bodyLimit: 2048 }));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
function raw(target, { method = 'GET', headers = {}, chunks = [] } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, method, path: target, headers }, response => {
      const bytes = []; response.on('data', chunk => bytes.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(bytes).toString() }));
    });
    request.on('error', reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

test.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(folder, { recursive: true, force: true }); });

test('real HTTP JSON requests and failures have safe response shapes', async () => {
  const health = await fetch(base + '/api/_healthcheck');
  assert.equal(health.status, 200); assert.deepEqual(await health.json(), { message: 'Success' });
  assert.equal(health.headers.get('cache-control'), 'no-store');
  const echo = await fetch(base + '/api/echo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Teach a rainbow' }) });
  assert.deepEqual(await echo.json(), { prompt: 'Teach a rainbow' });
  const failure = await fetch(base + '/api/failure');
  assert.equal(failure.status, 500); assert.ok(!(await failure.text()).includes('Internal marker'));
  assert.equal((await fetch(base + '/api/unknown')).status, 404);
  assert.equal((await fetch(base + '/api/echo')).status, 405);
});

test('JSON parsing rejects malformed, unsupported, and oversized requests', async () => {
  const post = (body, headers = { 'Content-Type': 'application/json' }) => fetch(base + '/api/echo', { method: 'POST', headers, body });
  assert.equal((await post('{broken')).status, 400);
  assert.equal((await post('plain', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(JSON.stringify({ prompt: 'x'.repeat(3000) }))).status, 413);
  const chunked = await raw('/api/echo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' }, chunks: ['{"prompt":"', 'x'.repeat(3000), '"}'] });
  assert.equal(chunked.status, 413);
});

test('API accepts its own origin and blocks cross-site browser requests without CORS', async () => {
  const own = await fetch(base + '/api/_healthcheck', { headers: { Origin: base } });
  assert.equal(own.status, 200);
  const foreign = await fetch(base + '/api/_healthcheck', { headers: { Origin: 'https://example.com' } });
  assert.equal(foreign.status, 403); assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(base + '/api/_healthcheck', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(base + '/api/_healthcheck', { method: 'OPTIONS' })).status, 405);
});

test('static delivery handles HEAD, app routes, assets, and fresh service workers', async () => {
  const home = await fetch(base + '/');
  assert.equal(home.status, 200); assert.ok((await home.text()).includes('<title>Pip</title>'));
  assert.equal(home.headers.get('cache-control'), 'no-cache');
  assert.match(home.headers.get('content-security-policy'), /connect-src 'self' https:\/\/openrouter\.ai/);
  const head = await fetch(base + '/', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.ok(Number(head.headers.get('content-length')) > 0);
  assert.equal((await fetch(base + '/a-future-view', { headers: { Accept: 'text/html' } })).status, 200);
  assert.equal((await fetch(base + '/missing.js', { headers: { Accept: 'text/html' } })).status, 404);
  const asset = await fetch(base + '/assets/app-A1234567.js');
  assert.equal(asset.status, 200); assert.match(asset.headers.get('cache-control'), /immutable/);
  const sw = await fetch(base + '/sw.js');
  assert.equal(sw.headers.get('cache-control'), 'no-cache'); assert.equal(sw.headers.get('service-worker-allowed'), '/');
  assert.equal((await fetch(base + '/manifest.webmanifest')).headers.get('cache-control'), 'no-cache');
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
});

test('raw traversal, hidden files, malformed paths, and symlink escapes are unavailable', async () => {
  for (const target of ['/../private.txt', '/%2e%2e/private.txt', '/assets/%2e%2e/%2e%2e/private.txt', '/.env', '/escape.txt']) {
    const response = await raw(target);
    assert.equal(response.status, 403, target); assert.ok(!response.body.includes('outside-public-directory'));
  }
  assert.equal((await raw('/%00')).status, 400);
  assert.equal((await raw('/%zz')).status, 400);
  assert.equal((await raw('/assets%5c..%5cprivate.txt')).status, 400);
  assert.equal((await fetch(base + '/package.json')).status, 404);
});
