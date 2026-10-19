import { defineConfig } from 'vite';
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from './http.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadBackend() {
  const result = await build({ entryPoints: [path.join(root, 'backend/index.ts')], bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' });
  return (await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))).handler;
}
export default defineConfig({
  root,
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { output: { manualChunks: { 'world-engine': ['./src/world-engine.js'], 'chip-lab': ['./src/chip-lab.js'], conversations: ['./src/conversations.js'], 'model-catalog': ['./src/catalog.json'], animation: ['motion/mini'] } } },
  },
  server: { host: '127.0.0.1', strictPort: true },
  plugins: [{
    name: 'pip-local-api',
    async configureServer(server) {
      let handler = await loadBackend();
      let reload = Promise.resolve();
      server.watcher.add([path.join(root, 'backend'), path.join(root, 'portable/runtime.js')]);
      server.watcher.on('change', file => {
        if (!file.startsWith(path.join(root, 'backend') + path.sep) && file !== path.join(root, 'portable/runtime.js')) return;
        reload = reload.then(async () => { handler = await loadBackend(); }).catch(() => { console.error('Backend update could not compile. Fix its source and save again.'); });
      });
      const handle = await createRequestHandler({ handler: event => handler(event) });
      server.middlewares.use(handle);
    },
  }],
});
