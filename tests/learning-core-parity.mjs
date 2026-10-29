import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { evaluateCore } from '../src/learning-core/reference.js';
import { instantiateCore } from '../src/learning-core/wasm.js';
import { LearningEngine } from '../src/learning-core/client.js';
const fixtures = JSON.parse(await readFile(new URL('../core/fixtures.json', import.meta.url)));
const bytes = await readFile(new URL('../src/learning-core/distill_pets_core.wasm', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../core/wasm-manifest.json', import.meta.url)));
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
assert.deepEqual(Object.keys(manifest.sources).sort(),['core/rust/Cargo.toml','core/rust/Cargo.lock','core/rust/rust-toolchain.toml','core/rust/src/lib.rs','core/rust/src/main.rs','scripts/build-core.mjs'].sort());
for(const [name,hash] of Object.entries(manifest.sources||{})) assert.equal(createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex'),hash,'Rebuild WASM after editing '+name);
const wasm = await instantiateCore(bytes);
for (const fixture of fixtures) assert.deepEqual(wasm(fixture.input), evaluateCore(fixture.input), fixture.name);
for(const checks of [{required:null},{format:null},{minChars:null},{jsonKeys:['a'],format:'json'}]) {
  for(const text of ['1e999','['.repeat(80)+'0'+']'.repeat(80),'{}']) {
    const input={version:1,operation:'diagnose_output',text,checks};
    assert.deepEqual(wasm(input),evaluateCore(input),'Malformed constraints / bounded JSON');
  }
}
for (const text of ['ΟΣ ΟΣΑ', 'İ ı I', 'Ｃａｆｅ́', '中文\n🌻', '\ufeff A \u0085 B \u202f C', 'é\tß\r\n🇬🇷', 'line repeated at least twenty chars\nline repeated at least twenty chars']) {
  const input = {version:1, operation:'diagnose_output', text, checks:{required:[text],maxChars:120000}};
  assert.deepEqual(wasm(input), evaluateCore(input), 'Unicode parity: '+text);
}
const input = {version:1,operation:'plan_session',tasks:3,rounds:3,reference:true,maxTokens:8000};
for (let n=0;n<500;n++) assert.deepEqual(wasm(input),evaluateCore(input), 'Repeated buffer allocation/free');
const missing = new LearningEngine({workerFactory:() => {throw Error('no worker');}});
assert.equal((await missing.run(input)).plannedCalls,24);
assert.equal(missing.engine,'JavaScript fallback');
const stalled = new LearningEngine({workerFactory:() => ({postMessage(){},terminate(){}}),timeout:10});
assert.equal((await stalled.run(input)).plannedCalls,24,'worker timeout falls back');
const canceled = new LearningEngine({workerFactory:() => ({postMessage(){},terminate(){}})});
const controller = new AbortController();
const pending = canceled.run(input,{signal:controller.signal});
controller.abort();
await assert.rejects(pending,{name:'AbortError'});
assert.equal(canceled.pending.size,0);
const worker={postMessage(){},terminate(){this.terminated=true;}};
const concurrent=new LearningEngine({workerFactory:()=>worker});
const stopOne=new AbortController();
const first=concurrent.run(input,{signal:stopOne.signal});
const second=concurrent.run(input);
stopOne.abort();await assert.rejects(first,{name:'AbortError'});
assert.equal(worker.terminated,undefined,'Canceling one check must not terminate a concurrent teaching analysis');
worker.onmessage({data:{id:2,result:evaluateCore(input),engine:'Rust / WebAssembly'}});
assert.equal((await second).plannedCalls,24);
concurrent.reset();
console.log('PASS real compiled WASM/JS parity, artifact SHA-256, UTF-8 ABI lifetime, worker fallback, timeout and cancellation.');
