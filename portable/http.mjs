import path from 'node:path';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const BODY_LIMIT = 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};
const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const PAGE_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://openrouter.ai; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
class HTTPFailure extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function writeJSON(res, status, value, extraHeaders = {}) {
  if (res.headersSent || res.destroyed) return;
  const body = JSON.stringify(value);
  res.writeHead(status, { ...BASE_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...extraHeaders });
  res.end(body);
}
function decodedPath(target) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) throw new HTTPFailure(400, 'Invalid request path.');
  let decoded;
  try { decoded = decodeURIComponent(target.split('?')[0]); } catch { throw new HTTPFailure(400, 'Invalid request path.'); }
  if (decoded.includes('\0') || decoded.includes('\\')) throw new HTTPFailure(400, 'Invalid request path.');
  if (decoded.split('/').some(part => part === '..' || part.startsWith('.'))) throw new HTTPFailure(403, 'This path is unavailable.');
  return decoded;
}
function isCrossOrigin(req, publicOrigin) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return true;
  if (!req.headers.origin) return false;
  try {
    const origin = new URL(req.headers.origin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== req.headers.origin) return true;
    return publicOrigin ? origin.origin !== publicOrigin : origin.host !== req.headers.host;
  } catch { return true; }
}
async function readJSON(req, limit) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') {
    req.resume();
    throw new HTTPFailure(415, 'Send this request as application/json.');
  }
  if (Number(req.headers['content-length']) > limit) {
    req.resume();
    throw new HTTPFailure(413, 'This request is too large. Shorten it and retry.');
  }
  const bytes = await new Promise((resolve, reject) => {
    let length = 0, chunks = [], settled = false;
    const cleanup = () => {
      req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAborted);
    };
    const fail = failure => { if (settled) return; settled = true; cleanup(); req.resume(); reject(failure); };
    const onData = chunk => {
      length += chunk.length;
      if (length > limit) return fail(new HTTPFailure(413, 'This request is too large. Shorten it and retry.'));
      chunks.push(chunk);
    };
    const onEnd = () => { if (settled) return; settled = true; cleanup(); resolve(Buffer.concat(chunks, length)); chunks = []; };
    const onError = () => fail(new HTTPFailure(400, 'The request body could not be read.'));
    const onAborted = () => fail(new HTTPFailure(400, 'The request was interrupted.'));
    req.on('data', onData); req.on('end', onEnd); req.on('error', onError); req.on('aborted', onAborted);
  });
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HTTPFailure(400, 'Send a valid JSON request body.'); }
}
function safeResult(result) {
  if (!result || !Number.isInteger(result.statusCode) || result.statusCode < 100 || result.statusCode > 599 || typeof result.body !== 'string') {
    throw new HTTPFailure(500, 'The server could not complete this request.');
  }
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  for (const name of ['Content-Type', 'Allow', 'Retry-After']) {
    const value = result.headers?.[name];
    if (typeof value === 'string' && !/[\r\n]/.test(value)) headers[name] = value;
  }
  return { status: result.statusCode, body: result.body, headers };
}

/** Same handler in development and production; API bodies are never logged. */
export async function createRequestHandler({ handler, staticDir, bodyLimit = BODY_LIMIT, publicOrigin } = {}) {
  if (typeof handler !== 'function') throw new TypeError('A backend handler is required.');
  const root = staticDir ? await realpath(staticDir) : null;
  const origin = publicOrigin ? new URL(publicOrigin).origin : undefined;
  const limit = Math.min(BODY_LIMIT, Math.max(1024, Number(bodyLimit) || BODY_LIMIT));
  return async function handle(req, res, next) {
    try {
      // Vite owns its dependency URLs (including hidden cache directories).
      // Apply filesystem restrictions only when serving the built static root.
      const rawPath = String(req.url || '').split('?')[0];
      if (!root && next && rawPath !== '/api' && !rawPath.startsWith('/api/')) return next();
      const pathname = decodedPath(req.url);
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        if (isCrossOrigin(req, origin)) return writeJSON(res, 403, { error: 'Use the API from this application’s own origin.' });
        const method = String(req.method || 'GET').toUpperCase();
        const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readJSON(req, limit) : null;
        const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
        const abort = new AbortController();
        req.once('aborted', () => abort.abort());
        const result = safeResult(await handler({ method, path: pathname, body, query, headers: req.headers, signal: abort.signal }));
        if (!res.destroyed) {
          res.writeHead(result.status, { ...BASE_HEADERS, ...result.headers, 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(result.body) });
          res.end(req.method === 'HEAD' ? undefined : result.body);
        }
        return;
      }
      if (!root && next) return next();
      if (!root) return writeJSON(res, 404, { error: 'Not found.' });
      if (!['GET', 'HEAD'].includes(req.method)) return writeJSON(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
      let file;
      try { file = await realpath(path.join(root, pathname === '/' ? 'index.html' : pathname.slice(1))); }
      catch (failure) {
        const acceptsHTML = String(req.headers.accept || '').includes('text/html');
        if (failure.code === 'ENOENT' && !path.extname(pathname) && acceptsHTML) file = await realpath(path.join(root, 'index.html'));
        else return writeJSON(res, 404, { error: 'Not found.' });
      }
      if (file !== root && !file.startsWith(root + path.sep)) return writeJSON(res, 403, { error: 'This path is unavailable.' });
      const opened = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        const stats = await opened.stat();
        if (!stats.isFile()) return writeJSON(res, 404, { error: 'Not found.' });
        const extension = path.extname(file).toLowerCase();
        const immutable = pathname.startsWith('/assets/') && /[-.][a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9]+$/.test(path.basename(file));
        const freshShell = extension === '.html' || extension === '.webmanifest' || pathname === '/sw.js';
        res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': MIME[extension] || 'application/octet-stream', 'Content-Length': stats.size, 'Cache-Control': freshShell ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600', 'Content-Security-Policy': PAGE_CSP, ...(pathname === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {}) });
        if (req.method === 'HEAD') res.end();
        else await pipeline(opened.createReadStream({ autoClose: false }), res);
      } finally { await opened.close(); }
    } catch (failure) {
      if (failure instanceof HTTPFailure) writeJSON(res, failure.status, { error: failure.message }, failure.status === 413 ? { Connection: 'close' } : {});
      else if (!res.headersSent) writeJSON(res, 500, { error: 'The server could not complete this request.' });
      else if (!res.destroyed) res.destroy();
    }
  };
}
