import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { portableBrain } from '../src/superpowers.js';

const folder=await mkdtemp(path.join(tmpdir(),'pip-power-cancel-'));
let child,timer;
try{
  const artifact=portableBrain({id:'cancel-test',name:'Cancellation check',instructions:'Complete {{task}} using {{context}}.',reference:'Cactus care uses fast-draining soil.'},'javascript',{model:'test/cancel',rounds:1});
  const file=path.join(folder,artifact.filename),mock=path.join(folder,'mock-fetch.mjs');await writeFile(file,artifact.content);
  await writeFile(mock,`let calls=0;globalThis.fetch=async(_url,request)=>{if(++calls===1)return{ok:true,json:async()=>({model:'test/resolved',choices:[{message:{content:'PAID_DRAFT_BEFORE_CTRL_C',reasoning:'PRIVATE'},finish_reason:'stop'}]})};process.stderr.write('READY_TO_CANCEL\\n');return new Promise((_resolve,reject)=>{const abort=()=>reject(Object.assign(Error('Stopped'),{name:'AbortError'}));if(request.signal.aborted)abort();else request.signal.addEventListener('abort',abort,{once:true});});};`);
  let stdout='',stderr='',sent=false;
  const result=await new Promise((resolve,reject)=>{
    child=spawn(process.execPath,['--import',pathToFileURL(mock).href,file,'--task','Care for cacti','--rounds','1'],{env:{...process.env,OPENROUTER_API_KEY:'fake-key-never-sent'},stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',data=>{stdout+=data;});child.stderr.on('data',data=>{stderr+=data;if(!sent&&stderr.includes('READY_TO_CANCEL')){sent=true;child.kill('SIGINT');}});
    child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('CLI cancellation timed out'));},8000);
  });
  clearTimeout(timer);assert.equal(sent,true);assert.equal(result.code,1,stderr);assert.equal(result.signal,null);
  const report=JSON.parse(stdout);assert.equal(report.status,'stopped');assert.equal(report.output,'PAID_DRAFT_BEFORE_CTRL_C');assert.equal(report.layers.filter(layer=>layer.kind==='model').length,2);assert.equal(report.layers.at(-1).status,'stopped');assert.ok(!stdout.includes('fake-key-never-sent'));assert.ok(!stdout.includes('PRIVATE'));
  console.log('PASS: exported JavaScript CLI Ctrl-C aborts pending review and prints its preserved paid draft without keys or private provider fields.');
}finally{clearTimeout(timer);if(child&&!child.killed)child.kill('SIGKILL');await rm(folder,{recursive:true,force:true});}
