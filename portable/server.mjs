import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequestHandler } from './http.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function startServer({ host = process.env.HOST || '127.0.0.1', port = process.env.PORT || 3000, root = projectRoot, publicOrigin = process.env.PUBLIC_ORIGIN } = {}) {
  const number = Number(port);
  if (!Number.isInteger(number) || number < 0 || number > 65535) throw new TypeError('PORT must be a number from 0 to 65535.');
  const { handler } = await import(pathToFileURL(path.join(root, 'build/backend.mjs')).href);
  const handle = await createRequestHandler({ handler, staticDir: path.join(root, 'dist'), publicOrigin });
  const server = http.createServer(handle);
  server.requestTimeout = 75000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(number, host, () => { server.off('error', reject); resolve(); }); });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = await startServer();
    const address = server.address();
    console.log(`Distill Pets AI Studio is ready on port ${typeof address === 'object' ? address.port : process.env.PORT || 3000}.`);
    const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 10000).unref(); };
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
  } catch {
    console.error('Distill Pets AI Studio could not start. Run npm run build first, then check HOST, PORT, and PUBLIC_ORIGIN.');
    process.exitCode = 1;
  }
}
