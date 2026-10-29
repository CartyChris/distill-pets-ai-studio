import { MAX_INPUT_BYTES } from './reference.js';

/** A real compiled Rust module, using an owned UTF-8 buffer ABI. */
export async function instantiateCore(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const { memory, core_alloc:allocate, core_evaluate:evaluate, core_free:free } = instance.exports;
  if (!(memory instanceof WebAssembly.Memory) || !allocate || !evaluate || !free) throw Error('Unsupported learning-core ABI');
  return input => {
    const payload = new TextEncoder().encode(JSON.stringify(input));
    if (!payload.length || payload.length > MAX_INPUT_BYTES) return {version:1,ok:false,error:{code:'INPUT_TOO_LARGE',message:'Input exceeds 1 MiB'}};
    const pointer = allocate(payload.length);
    if (!pointer) throw Error('Core allocation failed');
    let output = 0, outputLength = 0;
    try {
      new Uint8Array(memory.buffer, pointer, payload.length).set(payload);
      output = evaluate(pointer, payload.length);
      if (!output || output + 4 > memory.buffer.byteLength) throw Error('Core returned an invalid buffer');
      outputLength = new DataView(memory.buffer).getUint32(output, true);
      if (outputLength > MAX_INPUT_BYTES || output + 4 + outputLength > memory.buffer.byteLength) { outputLength = 0; throw Error('Core returned an oversized buffer'); }
      return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(new Uint8Array(memory.buffer, output + 4, outputLength)));
    } finally {
      free(pointer, payload.length);
      if (output && outputLength) free(output, outputLength + 4);
    }
  };
}
