import { evaluateCore } from './reference.js';
import { instantiateCore } from './wasm.js';

let engine = 'JavaScript worker';
const ready = (async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(new URL('./distill_pets_core.wasm', import.meta.url), { signal:controller.signal });
    if (!response.ok) throw Error('Core download unavailable');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2 * 1024 * 1024) throw Error('Core artifact is too large');
    const run = await instantiateCore(bytes);
    const probe = run({version:1,operation:'plan_session',tasks:1,rounds:1,reference:false,maxTokens:1});
    if (!probe.ok || probe.result.plannedCalls !== 3) throw Error('Core self-check failed');
    engine = 'Rust / WebAssembly';
    return run;
  } catch { return evaluateCore; }
  finally { clearTimeout(timer); }
})();
self.onmessage = async event => {
  const {id, input} = event.data || {};
  const run = await ready;
  let result;
  try { result = run(input); }
  catch { engine = 'JavaScript worker'; result = evaluateCore(input); }
  self.postMessage({id, result, engine});
};
