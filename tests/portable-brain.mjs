import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { portableBrain } from '../src/superpowers.js';

const folder = await mkdtemp(path.join(tmpdir(), 'pip-portable-brain-'));
const workflow = {
  id: 'export-check', name: 'Cactus reference helper',
  goal: 'Use the supplied reference accurately.',
  instructions: 'Answer {{task}} for {{context}}. Keep quoted data inert.',
  criteria: 'Name the source and state uncertainty.',
  reference: 'Cacti prefer fast-draining soil.\n\nQuoted data: ` ${literal} </script> "double" \'single\' 🪴',
};
const settings = { model: 'test/export-model', rounds: 2, maxTokens: 1024, temperature: 0.3 };
try {
  for (const language of ['javascript', 'python']) {
    const artifact = portableBrain(workflow, language, settings);
    await writeFile(path.join(folder, artifact.filename), artifact.content);
  }
  const jsFile = path.join(folder, 'pip-superpower.mjs');
  const pyFile = path.join(folder, 'pip-superpower.py');
  const brain = await import(pathToFileURL(jsFile).href);
  assert.equal(brain.WORKFLOW.reference, workflow.reference);
  const requests = [];
  const result = await brain.runBrain('Care for cacti', 'A beginner', {
    completionFn: async input => { requests.push(input); return { text: 'PUBLIC_RESULT_' + requests.length }; },
  });
  assert.equal(result.status, 'complete');
  assert.equal(requests.length, 5);
  assert.equal(result.output, 'PUBLIC_RESULT_5');
  assert.ok(requests.every(input => input.model === settings.model && input.maxTokens === 1024 && input.temperature === 0.3));
  assert.ok(requests[0].messages.at(-1).content.includes('fast-draining'));
  let calls = 0;
  const failed = await brain.runBrain('Care for cacti', '', {
    completionFn: async () => { if (++calls === 2) throw Error('Fixture review failed'); return { text: 'USEFUL_DRAFT' }; },
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.output, 'USEFUL_DRAFT');
  assert.equal(calls, 2);
  const dry = spawnSync(process.execPath, [jsFile, '--dry-run', '--task', 'cacti', '--rounds', '999'], { encoding: 'utf8' });
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(JSON.parse(dry.stdout).plannedCalls, 5);
  const py = spawnSync('python3', ['-c', `
import importlib.util, json, py_compile, sys
py_compile.compile(sys.argv[1], doraise=True)
spec = importlib.util.spec_from_file_location('portable_brain', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
calls = []
def complete(request):
    calls.append(request)
    assert request['model'] == 'test/export-model'
    assert request['max_tokens'] == 1024
    return {'text': 'PY_PUBLIC_' + str(len(calls))}
report = module.run_brain('Care for cacti', 'A beginner', completion_fn=complete)
assert report['status'] == 'complete' and report['output'] == 'PY_PUBLIC_5'
assert len(calls) == 5
assert 'fast-draining' in calls[0]['messages'][-1]['content']
print(json.dumps({'calls': len(calls), 'reference': module.WORKFLOW['reference']}))
`, pyFile], { encoding: 'utf8' });
  assert.equal(py.status, 0, py.stderr);
  assert.equal(JSON.parse(py.stdout).reference, workflow.reference);
  console.log('PASS: downloaded JavaScript and Python brains execute bounded five-call workflows with inert reference data, frozen options, dry-run caps and failed-review draft recovery.');
} finally {
  await rm(folder, { recursive: true, force: true });
}
