import assert from 'node:assert/strict';
import { cleanChipLab, createChipLab } from '../src/chip-lab.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function reviewedChip() {
  return {id:'parent-chip',title:'Clear teacher',baseModel:'test/frozen-base',teacherModel:'test/teacher',instructions:'CHIP_CONTEXT',examples:[{prompt:'Known example',completion:'Known response'}],revision:3,approved:true,reviewed:true,demo:false};
}
function task(id, demo=false) {
  return {id,prompt:'Task '+id,text:'Approved answer '+id,agent:'milo',model:'test/teacher',demo,status:'complete',truncated:false};
}
function fixture(complete) {
  const db={mode:'live',generation:{brief:'FROZEN_PROFILE_BRIEF',style:'concise',format:'markdown',temperature:0.3},maxTokens:1024,agents:{milo:{name:'Milo',model:'test/teacher'},nova:{name:'Nova',model:'test/student'}},lessons:[reviewedChip()],tasks:[task('task-1'),task('task-2'),task('sample',true)],chipLab:cleanChipLab(null)};
  db.chipLab.selectedChip='parent-chip';
  db.chipLab.cases=[1,2,3].map(i=>({id:'case-'+i,prompt:'HELD_OUT_'+i,rubric:'Check factual accuracy.'}));
  let op=0,busy=false;
  const calls=[],notices=[],downloads=[];
  const lab=createChipLab({
    getDB:()=>db,escape,button:(a,l,c='',at='')=>`<button data-action="${a}" class="${c}" ${at}>${l}</button>`,
    save(){},render(){},toast:m=>notices.push(m),setError:m=>notices.push(m),openModal(){},download:(...args)=>downloads.push(args),
    getBusy:()=>busy,ready:()=>true,start:()=>{busy=true;return ++op;},finish:(_,operation)=>{if(operation===op)busy=false;},currentOp:()=>op,
    studentMessages:(prompt,chip,agent)=>[{role:'system',content:'Agent '+agent+' '+db.generation.brief+(chip?' '+chip.instructions:'')},...(chip?.examples||[]).flatMap(e=>[{role:'user',content:e.prompt},{role:'assistant',content:e.completion}]),{role:'user',content:prompt}],
    completion:async(...args)=>{calls.push(args);return complete?complete(args,calls.length,db):{text:'Result '+calls.length,finishReason:'stop'};},
  });
  return {db,lab,calls,notices,downloads,invalidate(){op++;busy=false;}};
}

const clean=cleanChipLab({key:'MUST_NOT_PERSIST',cases:Array.from({length:8},(_,i)=>({id:'case-'+i,prompt:'x'.repeat(20000),rubric:'y'.repeat(3000)})),runs:Array.from({length:20},(_,i)=>({id:'run-'+i,status:'running',baseModel:'test/base',cases:[]}))});
assert.equal(clean.cases.length,3);
assert.ok(clean.cases[0].prompt.length<=12000);
assert.equal(clean.runs.length,8);
assert.equal(clean.runs[0].status,'stopped','reload must not imply an interrupted job is still running');
assert.ok(!JSON.stringify(clean).includes('MUST_NOT_PERSIST'));
const oversized=cleanChipLab({runs:[{id:'oversized',cases:[{id:'case-over',baseline:{text:'x'.repeat(25000),status:'complete'},learned:{text:'small',status:'complete'}}]}]});
assert.equal(oversized.runs[0].cases[0].baseline.text.length,24000);
assert.equal(oversized.runs[0].cases[0].baseline.truncated,true,'imported oversized results must be explicitly marked excerpted');

const switched=fixture();switched.lab.view();
switched.db.chipLab.curation={...switched.db.chipLab.curation,taskIds:['task-1','task-2'],approved:true,baseModel:'test/old-base'};
switched.db.mode='demo';switched.lab.view();
assert.equal(switched.db.chipLab.selectedChip,'','mode switch clears an incompatible hidden parent');
assert.deepEqual(switched.db.chipLab.curation.taskIds,[],'mode switch clears hidden opposite-mode example selections');
assert.equal(switched.db.chipLab.curation.approved,false);
assert.equal(switched.db.chipLab.curation.baseModel,'');
switched.lab.change({id:'lab-example-sample',dataset:{labTask:'sample'},checked:true});
assert.deepEqual(switched.db.chipLab.curation.taskIds,['sample'],'compatible examples remain selectable after switching mode');

// Same model, immutable case/chip snapshots, and a real six-call ceiling.
const frozen=fixture(async(args,n,db)=>{
  if(n===1){db.agents.nova.model='test/replacement';db.lessons[0].instructions='MUTATED_CHIP';db.chipLab.cases[0].prompt='MUTATED_CASE';db.generation.brief='MUTATED_PROFILE';db.generation.temperature=1.5;db.maxTokens=8000;}
  return {text:'Output '+n,finishReason:'stop'};
});
await frozen.lab.action('lab-run',{});
assert.equal(frozen.calls.length,6);
for(const call of frozen.calls)assert.equal(call[4].model,'test/frozen-base');
assert.ok(frozen.calls.every(call=>call[2]==='compare'));
assert.deepEqual(frozen.calls.map(call=>call[4].learned),[false,true,false,true,false,true]);
assert.ok(frozen.calls.every(call=>call[4].temperature===0.3&&call[4].maxTokens===1024),'all six calls use one frozen generation profile');
assert.ok(!JSON.stringify(frozen.calls).includes('MUTATED_CHIP'));
assert.ok(!JSON.stringify(frozen.calls).includes('MUTATED_CASE'));
assert.ok(!JSON.stringify(frozen.calls).includes('MUTATED_PROFILE'));
assert.equal(frozen.db.chipLab.runs[0].status,'complete');
assert.ok(frozen.db.chipLab.runs[0].cases.every(c=>c.baseline.text&&c.learned.text));
assert.ok(frozen.calls[1][1][0].content.includes('CHIP_CONTEXT'));
assert.ok(!frozen.calls[0][1][0].content.includes('CHIP_CONTEXT'));
const row=frozen.db.chipLab.runs[0].cases[0];
await frozen.lab.action('lab-vote',{runId:frozen.db.chipLab.runs[0].id,caseId:row.id,vote:'A'});
assert.equal(row.preference,'A');
assert.equal(row.revealed,false,'human preference does not automatically unblind setup');
await frozen.lab.action('lab-export',{runId:frozen.db.chipLab.runs[0].id});
assert.equal(frozen.downloads.length,1);
assert.ok(frozen.downloads[0][1].includes('HELD_OUT_1'));
frozen.db.lessons=[];
await frozen.lab.action('lab-export',{runId:frozen.db.chipLab.runs[0].id});
const retainedReport=JSON.parse(frozen.downloads[1][1]);
assert.equal(retainedReport.run.setup.chip.instructions,'CHIP_CONTEXT');
assert.equal(retainedReport.run.setup.chip.revision,3);
assert.equal(retainedReport.run.setup.chip.examples[0].completion,'Known response');
assert.equal(retainedReport.run.setup.profile.temperature,0.3);
assert.equal(retainedReport.run.setup.profile.brief,'FROZEN_PROFILE_BRIEF');
assert.equal(cleanChipLab(frozen.db.chipLab).runs[0].setup.chip.instructions,'CHIP_CONTEXT','the frozen setup survives workspace reload');

const failed=fixture(async(_,n)=>{if(n===2)throw Error('Provider unavailable');return{text:'Paid first answer',finishReason:'stop'};});
await failed.lab.action('lab-run',{});
assert.equal(failed.calls.length,2);
assert.equal(failed.db.chipLab.runs[0].status,'failed');
assert.equal(failed.db.chipLab.runs[0].cases[0].baseline.text,'Paid first answer');
assert.equal(failed.db.chipLab.runs[0].cases[0].learned.status,'failed');

let release;
const pending=fixture(()=>new Promise(resolve=>{release=resolve;}));
const running=pending.lab.action('lab-run',{});
await Promise.resolve();
pending.lab.stop();pending.invalidate();release({text:'Late answer',finishReason:'stop'});await running;
assert.equal(pending.calls.length,1);
assert.equal(pending.db.chipLab.runs[0].status,'stopped');
assert.equal(pending.db.chipLab.runs[0].cases[0].baseline.text,'');

const draft=fixture();
draft.db.chipLab.curation={...draft.db.chipLab.curation,taskIds:['task-1','task-2'],title:'A new chip',goal:'Explain clearly',baseModel:'test/student',approved:false};
await draft.lab.action('lab-distill',{});assert.equal(draft.calls.length,0,'human approval is required');
draft.db.chipLab.curation.approved=true;
const parent=JSON.stringify(draft.db.lessons[0]);
await draft.lab.action('lab-distill',{});
assert.equal(draft.calls.length,1);
const child=draft.db.lessons[1];
assert.equal(child.parentId,'parent-chip');assert.equal(child.revision,4);
assert.equal(child.approved,false);assert.equal(child.reviewed,false);
assert.equal(child.examples.length,2);assert.equal(child.baseModel,'test/student');
assert.equal(JSON.stringify(draft.db.lessons[0]),parent,'distillation must leave its parent immutable');
assert.equal(draft.db.agents.nova.chipId,undefined,'a draft must never be auto-equipped');

const mismatch=fixture();
mismatch.db.chipLab.curation={...mismatch.db.chipLab.curation,taskIds:['task-1','sample'],title:'Mixed',goal:'Teach',baseModel:'test/student',approved:true};
await mismatch.lab.action('lab-distill',{});assert.equal(mismatch.calls.length,0,'live and sample work must not mix');
const unreviewed=fixture();unreviewed.db.lessons[0].reviewed=false;
await unreviewed.lab.action('lab-run',{});assert.equal(unreviewed.calls.length,0,'unreviewed chips cannot be benchmarked as approved');

assert.equal(draft.lab.action('other',{}),false);
assert.equal(draft.lab.change({id:'custom-milo',value:'other'}),false);
assert.ok(draft.lab.view().includes('Chip lab'));
console.log('PASS: Chip Lab boundaries, frozen blind comparisons, six-call ceiling, partial recovery, Stop, explicit curation approval, provenance, and immutable draft revisions.');
