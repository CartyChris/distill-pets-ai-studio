import { build as frontend } from 'vite';
import { build as backend } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await frontend({ root, configFile: path.join(root, 'portable/vite.config.mjs') });
await backend({ entryPoints: [path.join(root, 'backend/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: path.join(root, 'build/backend.mjs'), sourcemap: false, logLevel: 'info' });
