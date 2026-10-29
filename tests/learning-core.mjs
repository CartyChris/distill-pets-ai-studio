import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateCore } from '../src/learning-core/reference.js';
const fixtures = JSON.parse(await readFile(new URL('../core/fixtures.json', import.meta.url)));
for (const fixture of fixtures) {
  const result = evaluateCore(fixture.input);
  if (fixture.error) assert.equal(result.error?.code, fixture.error, fixture.name);
  else {
    assert.equal(result.ok, true, fixture.name);
    for (const [key, value] of Object.entries(fixture.expect)) assert.deepEqual(result.result[key], value, fixture.name + ': ' + key);
  }
}
assert.equal(evaluateCore({ version:1, operation:'diagnose_output', text:'x'.repeat(120001), checks:{} }).error.code, 'INVALID_INPUT');
assert.equal(evaluateCore({ version:1, operation:'plan_session', tasks:1, rounds:4, reference:false, maxTokens:2048 }).ok, false);
assert.equal(evaluateCore({ version:1, operation:'plan_session', tasks:1, rounds:1, reference:1, maxTokens:2048 }).ok, false);
assert.equal(evaluateCore({ version:1, operation:'diagnose_output', text:'ok', checks:{minChars:100,maxChars:20} }).ok, false);
console.log('PASS learning-core reference: golden plans, Unicode, checks, review/split/history gates and bounded invalid inputs.');
