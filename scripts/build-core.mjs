import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const root = fileURLToPath(new URL('../', import.meta.url));
const cargo = process.env.CARGO || 'cargo';
const toolchain = spawnSync(cargo,['--version'],{encoding:'utf8'});
if(!toolchain.stdout?.startsWith('cargo 1.90.0 ')) { console.error('Use the pinned Rust/Cargo 1.90.0 toolchain to build the release core.'); process.exit(1); }
const flags = ['-C','link-arg=--max-memory=67108864','--remap-path-prefix',root+'=/distill-pets/','--remap-path-prefix',homedir()+'/.cargo/registry/src=/cargo/registry/src'];
const options = {cwd:root, stdio:'inherit', env:{...process.env,CARGO_ENCODED_RUSTFLAGS:flags.join('\u001f')}};
const result = spawnSync(cargo, ['build','--manifest-path','core/rust/Cargo.toml','--locked','--release','--target','wasm32-unknown-unknown','--lib'], options);
if (result.error || result.status !== 0) { console.error('Install Rust 1.90.0 and its wasm32-unknown-unknown target; then retry npm run core:build.'); process.exit(1); }
const wasm = await readFile(new URL('../core/rust/target/wasm32-unknown-unknown/release/distill_pets_core.wasm', import.meta.url));
if (!WebAssembly.validate(wasm)) throw Error('Compiler output is not a valid WASM module');
await mkdir(new URL('../src/learning-core/', import.meta.url), {recursive:true});
await writeFile(new URL('../src/learning-core/distill_pets_core.wasm', import.meta.url), wasm);
const manifest = {contractVersion:1,rustVersion:'1.90.0',target:'wasm32-unknown-unknown',bytes:wasm.length,sha256:createHash('sha256').update(wasm).digest('hex')};
manifest.sources = {};
for(const name of ['core/rust/Cargo.toml','core/rust/Cargo.lock','core/rust/rust-toolchain.toml','core/rust/src/lib.rs','core/rust/src/main.rs','scripts/build-core.mjs']) manifest.sources[name] = createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
await writeFile(new URL('../core/wasm-manifest.json', import.meta.url), JSON.stringify(manifest,null,2)+'\n');
console.log('Built real Rust/WASM core:', manifest);
