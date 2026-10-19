/** Browser transport for the same-origin Distill Pets AI Studio API. Never persists API keys. */
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.response = { status, data };
  }
}

function apiPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/api/') || path.includes('\\') || path.includes('#')) {
    throw new TypeError('API requests must use a same-origin /api/ path.');
  }
  let decoded;
  try { decoded = decodeURIComponent(path.split('?')[0]); } catch { throw new TypeError('Invalid API path.'); }
  if (decoded.split('/').some(part => part === '..' || part === '.')) throw new TypeError('Invalid API path.');
  return path;
}

async function request(method, path, body, options = {}) {
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', relayAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 70000);
  try {
    const response = await fetch(apiPath(path), {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
      signal: controller.signal,
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new APIError('The server returned an unreadable response. Retry the request.', response.status, {}); }
    if (!response.ok) {
      const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : 'The request could not be completed.';
      throw new APIError(message, response.status, data);
    }
    return { data };
  } catch (failure) {
    if (failure?.name === 'AbortError') throw new APIError('The request was stopped or timed out. Retry when ready.', 0, {});
    if (failure instanceof APIError || failure instanceof TypeError && /API path|same-origin/.test(failure.message)) throw failure;
    throw new APIError('Could not reach the server. Check the connection and retry.', 0, {});
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', relayAbort);
  }
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
};
