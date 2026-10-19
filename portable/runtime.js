/** Minimal HTTP route helpers used by Distill Pets AI Studio's portable backend. */
export function json(value, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(value),
  };
}

export function error(message = 'Request failed.', statusCode = 400) {
  return json({ error: String(message) }, statusCode);
}

export function router(routes) {
  const table = new Map();
  for (const [key, steps] of Object.entries(routes)) {
    const match = /^([A-Z]+) (\/[^?#]*)$/.exec(key);
    if (!match || !Array.isArray(steps) || !steps.length || steps.some(step => typeof step !== 'function')) {
      throw new TypeError('Routes need a method, an absolute path, and handler functions.');
    }
    table.set(key, steps);
  }
  return async event => {
    const method = String(event.method || 'GET').toUpperCase();
    const path = event.path || '/';
    const steps = table.get(`${method} ${path}`);
    if (!steps) {
      const allowed = [...table.keys()].filter(key => key.slice(key.indexOf(' ') + 1) === path).map(key => key.slice(0, key.indexOf(' ')));
      return allowed.length
        ? json({ error: 'Method not allowed.' }, 405, { Allow: allowed.join(', ') })
        : error('Not found.', 404);
    }
    const context = { ...event, method, path, query: event.query || {}, params: {}, body: event.body ?? null };
    for (const step of steps) {
      const result = await step(context);
      if (result !== undefined) return result;
    }
    return error('The route did not return a response.', 500);
  };
}
