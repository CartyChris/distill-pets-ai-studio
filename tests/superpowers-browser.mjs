import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const base=process.env.APP_URL||'http://localhost:5190',storage='pip-studio-v1',model='test/superpower-route',key='superpower-test-key-only',privateText='PRIVATE_POWER_REASONING';
const browser=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),faults=[],calls=[];
page.on('pageerror',error=>faults.push(error.message));page.setDefaultTimeout(15000);
await page.addInitScript(({storage,model})=>{if(!localStorage.getItem(storage))localStorage.setItem(storage,JSON.stringify({version:1,mode:'live',deep:false,maxTokens:1024,tasks:[],lessons:[],generation:{brief:'GLOBAL_POWER_BRIEF',temperature:0.25},agents:{milo:{name:'Milo',model,voice:'precise'},nova:{name:'Nova',model:'test/other'}},superpowers:{workflows:[],rounds:2}}));},{storage,model});
await page.route('**/api/models*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({models:[{id:model,name:'Test Superpower',pricing:{prompt:'0',completion:'0'}}]})}));
let mode='success',held,holdReady;
await page.route('**/api/complete',async route=>{
  const input=route.request().postDataJSON();calls.push(input);
  const isReview=input.messages.at(-1).content.startsWith('Review the draft');
  if(mode==='hold'&&isReview){await new Promise(resolve=>{held=()=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'LATE_REVIEW_MUST_BE_IGNORED',model})}).then(resolve);holdReady?.();});return;}
  if(mode==='failure'&&isReview){await route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'Power review temporarily limited'})});return;}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:isReview?'PUBLIC_REVIEW: cite the source and preserve the audience.':'POWER_OUTPUT_'+calls.length,model:'test/resolved-model',finishReason:'stop',reasoning:privateText})});
});
const action=(name,extra='')=>page.locator(`[data-action="${name}"]${extra}:visible`).first();
const nav=name=>action('page',`[data-page="${name}"]`).click();
const db=()=>page.evaluate(storage=>JSON.parse(localStorage.getItem(storage)),storage);
const waitRun=async expected=>{await page.waitForFunction(({storage,expected})=>JSON.parse(localStorage.getItem(storage)).superpowers.history.at(-1)?.status===expected,{storage,expected});return(await db()).superpowers.history.at(-1);};
const connect=async()=>{await nav('settings');await page.getByLabel('OpenRouter API key',{exact:true}).fill(key);await action('connect-key').click();await nav('powers');};
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'pip-superpowers-browser-'));
try{
  await page.goto(base);await connect();await action('power-new').click();
  await page.locator('#power-name').fill('The reference fox');await page.locator('#power-goal').fill('Answer carefully with supplied reference evidence.');
  await page.locator('#power-instructions').fill('For {{task}}, adapt to {{context}}. Cite supplied references and check the mechanism.');
  await page.locator('#power-criteria').fill('CRITERIA_SENTINEL: Ground claims in supplied facts; state unknowns.');
  const reference={plant:'CACTUS_SOURCE_SENTINEL',care:'Use fast-draining soil.',untrusted:'<img src=x onerror="window.POWER_INJECTED=true">'};
  await page.locator('#power-import-file').setInputFiles({name:'cactus.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(reference))});
  await page.getByText('Reference data loaded into the editor. Save the workflow to use it.',{exact:true}).waitFor();
  assert.deepEqual(JSON.parse(await page.locator('#power-reference').inputValue()),reference);
  await action('power-save-workflow').click();const workflowId=(await db()).superpowers.selected;
  await action('power-edit').click();await page.locator('#power-name').fill('The careful reference fox');await action('power-save-workflow').click();
  assert.equal((await db()).superpowers.workflows[0].revision,2);
  await action('power-duplicate').click();assert.equal((await db()).superpowers.workflows.length,2);
  await action('power-delete').click();await page.getByRole('dialog').getByRole('button',{name:'Delete workflow',exact:true}).click();
  assert.equal((await db()).superpowers.workflows.length,1);assert.equal((await db()).superpowers.selected,workflowId);
  await page.locator('#power-task').fill('ORIGINAL_POWER_TASK: How should I care for this cactus?');await page.locator('#power-context').fill('CONTEXT_SENTINEL: A beginner with one indoor plant.');
  await action('power-run').click();let run=await waitRun('complete');
  assert.equal(calls.length,5);assert.equal(run.output,'POWER_OUTPUT_5');assert.equal(run.setup.workflow.revision,2);assert.equal(run.layers.length,6);
  assert.ok(run.layers.filter(layer=>layer.kind==='model').every(layer=>layer.model==='test/resolved-model'));
  for(const request of calls){assert.equal(request.model,model);assert.equal(request.temperature,0.25);assert.equal(request.maxTokens,1024);assert.equal(request.key,key);assert.ok(JSON.stringify(request.messages).includes('CACTUS_SOURCE_SENTINEL'));assert.ok(JSON.stringify(request.messages).includes('GLOBAL_POWER_BRIEF'));}
  assert.ok(calls[2].messages.at(-1).content.includes('PUBLIC_REVIEW'));assert.equal((await db()).tasks.length,0);assert.equal((await db()).lessons.length,0);
  await action('power-save-task').click();let snapshot=await db();assert.equal(snapshot.tasks.length,1);
  for(const marker of ['ORIGINAL_POWER_TASK','CONTEXT_SENTINEL','CRITERIA_SENTINEL','CACTUS_SOURCE_SENTINEL','GLOBAL_POWER_BRIEF','PUBLIC_REVIEW'])assert.ok(snapshot.tasks[0].prompt.includes(marker),`Teaching example keeps ${marker}`);
  await page.locator('#power-memory-note').fill('LESSON_SENTINEL: Ground every plant-care claim in its supplied source.');
  await action('power-save-memory').click();assert.equal((await db()).superpowers.memory.length,0);
  await page.locator('#power-memory-approved').check();await action('power-save-memory').click();assert.equal((await db()).superpowers.memory.length,1);
  await page.locator('#power-memory-approved').check();await action('power-create-chip').click();snapshot=await db();assert.equal(snapshot.lessons.length,1);assert.equal(snapshot.lessons[0].approved,false);assert.equal(snapshot.lessons[0].reviewed,false);assert.equal(snapshot.agents.milo.chipId,null);assert.equal(snapshot.agents.nova.chipId,null);assert.ok(snapshot.lessons[0].examples[0].prompt.includes('CACTUS_SOURCE_SENTINEL'));
  await page.locator('#power-rounds').selectOption('0');await page.locator('#power-use-memory').check();await action('power-run').click();run=await waitRun('complete');assert.equal(calls.length,6);assert.ok(calls.at(-1).messages.at(-1).content.includes('LESSON_SENTINEL'));assert.equal(run.setup.memory.length,1);
  for(const [name,extension]of[['power-export-md','.md'],['power-export-js','.mjs'],['power-export-py','.py'],['power-export-run','.json']]){const[file]=await Promise.all([page.waitForEvent('download'),action(name).click()]);assert.ok(file.suggestedFilename().endsWith(extension));const output=path.join(temp,file.suggestedFilename());await file.saveAs(output);const content=await fs.readFile(output,'utf8');assert.ok(content.includes('CACTUS_SOURCE_SENTINEL'));assert.ok(!content.includes(key));assert.ok(!content.includes(privateText));}
  for(const viewport of[{width:320,height:700},{width:393,height:852},{width:430,height:932},{width:852,height:393}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>document.documentElement.style.setProperty('--ui-scale','1.2'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${viewport.width}`);
    const bad=await page.locator('.superpowers button,.superpowers input:not([type="checkbox"]),.superpowers select,.superpowers textarea,.superpowers summary').evaluateAll(items=>items.filter(item=>item.getClientRects().length&&((item.getBoundingClientRect().height<43.9)||(!item.matches('summary')&&parseFloat(getComputedStyle(item).fontSize)<19.1))).map(item=>({id:item.id,action:item.dataset.action,height:item.getBoundingClientRect().height,font:getComputedStyle(item).fontSize})));
    assert.deepEqual(bad,[],`44px controls and scaled font at ${viewport.width}`);
  }
  await page.setViewportSize({width:1440,height:1000});await page.reload();await nav('powers');snapshot=await db();assert.equal(snapshot.superpowers.history.length,2);assert.equal(snapshot.superpowers.memory.length,1);assert.equal(snapshot.lessons.length,1);assert.ok(!JSON.stringify(snapshot).includes(key));assert.ok(!JSON.stringify(snapshot).includes(privateText));assert.equal(await page.evaluate(()=>window.POWER_INJECTED),undefined);await connect();
  mode='failure';await page.locator('#power-rounds').selectOption('1');const beforeFailure=calls.length;await action('power-run').click();run=await waitRun('failed');assert.equal(calls.length,beforeFailure+2);assert.equal(run.output,'POWER_OUTPUT_'+(beforeFailure+1));await action('power-save-task').click();snapshot=await db();assert.equal(snapshot.tasks.at(-1).status,'draft');assert.ok(snapshot.tasks.at(-1).error);
  mode='hold';const reviewPending=new Promise(resolve=>{holdReady=resolve;});await action('power-run').click();await reviewPending;await action('power-stop').click();run=await waitRun('stopped');const preserved=run.output;await held();await page.waitForTimeout(150);snapshot=await db();assert.equal(snapshot.superpowers.history.at(-1).output,preserved);assert.equal(snapshot.superpowers.history.at(-1).status,'stopped');assert.ok(!JSON.stringify(snapshot).includes('LATE_REVIEW_MUST_BE_IGNORED'));
  await page.reload();await nav('powers');assert.equal((await db()).superpowers.history.at(-1).output,preserved);assert.deepEqual(faults,[]);
  console.log('PASS: integrated custom workflow CRUD/import, actual five-call frozen processing, contextual teaching saves, explicit reviewed memory/unreviewed chip, runnable exports, reload, scaled phone controls, failed-review recovery and Stop.');
}finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
