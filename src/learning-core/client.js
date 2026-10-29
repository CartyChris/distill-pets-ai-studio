import { evaluateCore, MAX_INPUT_BYTES } from './reference.js';
const aborted = () => new DOMException('Analysis canceled', 'AbortError');

/** Lazy, bounded worker. Cancellation never starts or retries a provider request. */
export class LearningEngine {
  constructor({ workerFactory = () => new Worker(new URL('./worker.js', import.meta.url), {type:'module'}), timeout = 10000 } = {}) {
    this.workerFactory = workerFactory;
    this.timeout = timeout;
    this.worker = null;
    this.pending = new Map();
    this.serial = 0;
    this.engine = 'Ready on demand';
    this.disabled = false;
  }
  reset(reason = aborted()) {
    this.worker?.terminate(); this.worker = null;
    for (const job of [...this.pending.values()]) job.reject(reason);
    this.pending.clear();
  }
  async run(input, {signal} = {}) {
    if (signal?.aborted) throw aborted();
    const serialized = JSON.stringify(input);
    if (new TextEncoder().encode(serialized).length > MAX_INPUT_BYTES) throw Error('Local analysis accepts at most 1 MiB. Analyze fewer examples.');
    if (this.pending.size >= 4) throw Error('Local analysis is busy. Wait for the current check.');
    const snapshot = JSON.parse(serialized);
    if (!this.worker && !this.disabled) {
      try {
        this.worker = this.workerFactory();
        this.worker.onmessage = ({data}) => {
          const job = this.pending.get(data?.id);
          if (job) { this.engine = data.engine; job.resolve(data.result); }
        };
        this.worker.onerror = event => { event.preventDefault?.(); this.disabled = true; this.engine = 'JavaScript fallback'; this.reset(Error('Analysis worker unavailable')); };
      } catch { this.disabled = true; }
    }
    let result;
    if (!this.worker) { this.engine = 'JavaScript fallback'; result = evaluateCore(snapshot); }
    else {
      try {
        result = await new Promise((resolve, reject) => {
          const id = ++this.serial;
          const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); this.pending.delete(id); };
          const cancel = () => {
            this.pending.get(id)?.reject(aborted());
            // Another analysis may belong to an active teaching run. Cancel only
            // this request; terminate the worker once there is no remaining work.
            if(!this.pending.size) { this.worker?.terminate(); this.worker=null; }
          };
          const timer = setTimeout(() => { this.disabled = true; this.engine = 'JavaScript fallback'; this.reset(Error('Analysis worker timed out')); }, this.timeout);
          this.pending.set(id, {resolve:value => { cleanup(); resolve(value); }, reject:error => { cleanup(); reject(error); }});
          signal?.addEventListener('abort', cancel, {once:true});
          try { this.worker.postMessage({id, input:snapshot}); } catch (error) { this.disabled = true; this.reset(error); }
        });
      } catch (error) {
        if (error.name === 'AbortError' || signal?.aborted) throw aborted();
        this.engine = 'JavaScript fallback'; result = evaluateCore(snapshot);
      }
    }
    if (signal?.aborted) throw aborted();
    if (!result?.ok) throw Error(result?.error?.message || 'Local analysis could not complete');
    return { ...result.result, engine:this.engine };
  }
}
