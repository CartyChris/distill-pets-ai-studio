import assert from 'node:assert/strict';
import { cleanTeaching, createTeaching, teachingRowsForExport, parseTeachingImport } from '../src/teaching.js';
function fixture(responder) {
  const db={mode:'live',maxTokens:1024,generation:{temperature:.2},agents:{milo:{name:'Milo',model:'test/teacher'},nova:{name:'Nova',model:'test/student'}},lessons:[],teaching:cleanTeaching(null)};
  let busy=false,op=0;
  const calls=[],notices=[],downloads=[];
  const workshop=createTeaching({getDB:()=>db,escape:String,button:()=>'',save(){},render(){},toast:m=>notices.push(m),setError:m=>notices.push(m),getBusy:()=>busy,ready:()=>true,currentOp:()=>op,start:()=>{busy=true;return ++op;},finish:()=>{busy=false;},studentMessages:p=>[{role:'system',content:'Frozen system'},{role:'user',content:p}],completion:async(...args)=>{calls.push(args);return responder?responder(args,calls.length,db):{text:'Useful distinct output '+calls.length,finishReason:'stop'};},download:(...args)=>downloads.push(args),setPage(){}});
  return {db,workshop,calls,notices,downloads};
}
const full=fixture();
full.db.teaching.rounds=3;
full.db.teaching.reference=true;
full.db.teaching.cards=[1,2,3].map(n=>({id:'task-'+n,prompt:'Explain distinct topic '+n,rubric:'Be correct.',split:'train',selected:true}));
await full.workshop.action('learn-run');
assert.equal(full.calls.length,24);
assert.equal(full.db.teaching.runs[0].plannedCalls,24);
assert.equal(full.db.teaching.runs[0].status,'complete');
assert.equal(full.db.teaching.runs[0].items[0].rounds.length,2);
assert.ok(full.calls[4][1].at(-1).content.includes('Useful distinct output 4'),'round 2 feedback uses the actual round 1 revision');
assert.ok(full.calls[6][1].at(-1).content.includes('Useful distinct output 6'),'round 3 feedback uses round 2 revision');
assert.equal(full.db.teaching.rows[0].completion,'Useful distinct output 8');
assert.equal(full.db.teaching.rows.every(r=>!r.approved),true);
assert.equal(full.workshop.getOuting().dialogue.length,24);
assert.deepEqual(full.workshop.getOuting().dialogue.map(m=>m.text),Array.from({length:24},(_,n)=>'Useful distinct output '+(n+1)),'Wilds dialogue preserves the real call order across tasks and rounds');
const restored=cleanTeaching(full.db.teaching);
assert.equal(restored.runs[0].items[0].rounds[1].revision.text,'Useful distinct output 8');
assert.equal(restored.runs[0].calls,24);

const stagnant=fixture(args=>({text:args[2]==='learn-feedback'?'Keep the exact same answer.':'The same good explanation.',finishReason:'stop'}));
stagnant.db.teaching.rounds=3;
await stagnant.workshop.action('learn-run');
assert.equal(stagnant.calls.length,3);
assert.match(stagnant.db.teaching.runs[0].items[0].stopReason,/did not change/);
assert.equal(stagnant.db.teaching.rows[0].approved,false);

const checked=fixture(args=>({text:args[2]==='learn-attempt'?'wrong format':args[2]==='learn-revision'?' {"answer":"Sunlight"} ':'Return JSON with answer.',finishReason:'stop'}));
Object.assign(checked.db.teaching,{rounds:3,stopWhenChecksPass:true,checks:{format:'json',jsonKeys:['answer'],required:['Sunlight'],forbidden:[],minChars:0,maxChars:0}});
await checked.workshop.action('learn-run');
assert.equal(checked.calls.length,3);
assert.ok(checked.calls[1][1].at(-1).content.includes('"passed":false'),'teacher gets actual deterministic check failures');
assert.match(checked.db.teaching.runs[0].items[0].stopReason,/constraints passed/);
assert.equal(checked.db.teaching.rows[0].approved,false,'constraint success never grants review approval');
assert.equal(checked.db.teaching.runs[0].items[0].revision.diagnostics.failedChecks,0);
assert.ok(checked.db.teaching.rows[0].messages.at(-1).content.includes('Explicit output constraints'),'supervised prompt preserves frozen constraints');
assert.ok(checked.calls[0][1].at(-1).content.includes(checked.db.teaching.rubric),'global success checks remain in every task');
assert.ok(checked.calls[0][1].at(-1).content.includes(checked.db.teaching.cards[0].rubric),'task-specific success checks also remain');

const frozen=fixture((_,n,db)=>{
  if(n===1) {db.teaching.rounds=1;db.teaching.checks={format:'json'};db.teaching.stopWhenChecksPass=true;}
  return {text:'Frozen answer '+n,finishReason:'stop'};
});
frozen.db.teaching.rounds=3;
await frozen.workshop.action('learn-run');
assert.equal(frozen.calls.length,7);
assert.equal(frozen.db.teaching.runs[0].settings.checks.format,'text');
assert.equal(frozen.db.teaching.runs[0].settings.rounds,3);

const failure=fixture((_,n)=>{if(n===4)throw Error('Second round teacher unavailable');return {text:'Saved response '+n,finishReason:'stop'};});
failure.db.teaching.rounds=3;
await failure.workshop.action('learn-run');
assert.equal(failure.db.teaching.runs[0].status,'failed');
assert.equal(failure.db.teaching.runs[0].items[0].revision.text,'Saved response 3');
assert.equal(failure.db.teaching.rows.length,0,'incomplete recursive walk cannot leak to approved export');
assert.equal(failure.db.teaching.runs[0].items[0].rounds[0].feedback.status,'failed');

let release;
const stopped=fixture((_,n)=>n===4?new Promise(resolve=>{release=resolve;}):{text:'Completed stage '+n,finishReason:'stop'});
stopped.db.teaching.rounds=3;
const pending=stopped.workshop.action('learn-run');
while(!release) await new Promise(resolve=>setImmediate(resolve));
stopped.workshop.stop(); release({text:'Too late',finishReason:'stop'}); await pending;
assert.equal(stopped.calls.length,4);
assert.equal(stopped.db.teaching.runs[0].items[0].rounds[0].feedback.text,'');
assert.equal(stopped.db.teaching.runs[0].items[0].rounds[0].feedback.status,'stopped');
assert.equal(stopped.db.teaching.rows.length,0);

const starters=fixture();
await starters.workshop.action('learn-preset',{id:'structured'});
assert.equal(starters.calls.length,0);
assert.equal(starters.db.teaching.cards.length,6);
assert.equal(starters.db.teaching.cards.filter(c=>c.selected).length,2);
assert.equal(starters.db.teaching.checks.format,'json');
await starters.workshop.action('learn-prioritize');
assert.ok(starters.db.teaching.cards.filter(c=>c.selected).every(c=>c.split==='train'));
assert.equal(starters.calls.length,0);
await checked.workshop.action('learn-audit');
assert.ok(checked.workshop.view().includes('Latest dataset check'));
assert.equal(teachingRowsForExport(checked.db.teaching.rows).length,0);
const maximumContext=Array.from({length:12},(_,n)=>({role:n===0?'system':n===11?'user':n%2?'user':'assistant',content:'Context turn '+n}));
const roundTrip=parseTeachingImport(JSON.stringify({messages:[...maximumContext,{role:'assistant',content:'Complete final answer'}]}));
assert.equal(roundTrip.rows[0].messages.length,12);
assert.equal(roundTrip.rows[0].approved,false,'Round-trip import never inherits approval');
console.log('PASS recursive teaching: 24-call ceiling, frozen 3 rounds, actual latest feedback, early stop, no automatic approval, later failure/cancel recovery, restoration, curriculum and diagnostics.');
