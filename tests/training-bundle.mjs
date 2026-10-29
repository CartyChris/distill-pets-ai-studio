import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { zipSync,unzipSync,strToU8,strFromU8 } from 'fflate';
import { cleanTeaching,teachingRowsForExport } from '../src/teaching.js';
import { buildTrainingBundle } from '../src/training-bundle.js';
const folder=await mkdtemp(path.join(tmpdir(),'distill-pets-training-'));
const state=cleanTeaching(null);
state.rows=[{id:'row-1',prompt:'Who lives in Lisbon?',completion:'Ada lives in Lisbon.',messages:[{role:'system',content:'Use supplied facts.'},{role:'user',content:'Ada lives in Lisbon. Who lives in Lisbon?'}],rubric:'Be correct',split:'train',approved:true,demo:false,truncated:false,model:'fixture/student',teacherModel:'fixture/teacher',runId:'run-1',origin:'practice',created:1}];
const run=(script,...args)=>spawnSync('python3',[script,...args],{encoding:'utf8'});
try {
  const bundle=await buildTrainingBundle(state,teachingRowsForExport(state.rows));
  const zipPath=path.join(folder,'bundle.zip'); await writeFile(zipPath,bundle);
  const report=run('training/audit_bundle.py',zipPath);
  assert.equal(report.status,0,report.stderr);
  assert.equal(JSON.parse(report.stdout).trainingRows,1);
  const training=run('training/train_lora.py','--bundle',zipPath,'--model','fixture/no-model-download','--output',path.join(folder,'output'),'--dry-run');
  assert.equal(training.status,0,training.stderr);
  assert.equal(JSON.parse(training.stdout).status,'dry_run');
  const files=unzipSync(bundle);
  const manifest=JSON.parse(strFromU8(files['manifest.json']));
  assert.equal(manifest.files['train.jsonl'].sha256,createHash('sha256').update(files['train.jsonl']).digest('hex'));
  assert.ok(strFromU8(files['train.jsonl']).includes('Use supplied facts.'));
  // Change content without updating its manifest: integrity check must fail.
  const bad=unzipSync(bundle); bad['train.jsonl']=strToU8('{"messages":[]}\n');
  const badPath=path.join(folder,'bad.zip');await writeFile(badPath,zipSync(bad));
  assert.notEqual(run('training/audit_bundle.py',badPath).status,0);
  // A consistent archive with an approval bypass must also fail (not just checksum tests).
  const corrupt=unzipSync(bundle),provenance=JSON.parse(strFromU8(corrupt['provenance.json']));
  provenance.rows[0].approved=false;
  corrupt['provenance.json']=strToU8(JSON.stringify(provenance));
  const changed=JSON.parse(strFromU8(corrupt['manifest.json']));
  changed.files['provenance.json']={bytes:corrupt['provenance.json'].length,sha256:createHash('sha256').update(corrupt['provenance.json']).digest('hex')};
  corrupt['manifest.json']=strToU8(JSON.stringify(changed));
  await writeFile(badPath,zipSync(corrupt));
  assert.match(run('training/audit_bundle.py',badPath).stderr,/not approved/);
  const unreviewed=structuredClone(state);unreviewed.rows[0].approved=false;
  await assert.rejects(buildTrainingBundle(unreviewed,teachingRowsForExport(state.rows)),/reviewed live/);
  const leaky=structuredClone(state);leaky.cards.push({id:'overlap',prompt:'Who lives in Lisbon?',rubric:'',split:'validation'});
  await assert.rejects(buildTrainingBundle(leaky,teachingRowsForExport(leaky.rows)),/overlap/);
  const invalidRate=run('training/train_lora.py','--bundle',zipPath,'--model','fixture','--output',folder,'--dry-run','--learning-rate','nan');
  assert.notEqual(invalidRate.status,0);
  console.log('PASS reviewed training ZIP, exact role context, SHA-256 integrity, Python offline audit, approval mutation rejection, validation overlap and no-download trainer dry-run.');
} finally { await rm(folder,{recursive:true,force:true}); }
