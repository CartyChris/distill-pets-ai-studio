import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url = process.env.APP_URL || 'http://localhost:5190';
const key = 'pip-studio-v1';
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const seed={version:1,mode:'demo',agents:{milo:{name:'Milo',model:'test/teacher'},nova:{name:'Nova',model:'test/student'}},tasks:[
  {id:'task-one',prompt:'Explain how a garden uses water.',text:'A clear approved answer about roots and water.',status:'complete',demo:true,agent:'milo',model:'playground/sample'},
  {id:'task-two',prompt:'Explain why plants need light.',text:'A useful approved answer about photosynthesis.',status:'complete',demo:true,agent:'milo',model:'playground/sample'},
  {id:'task-live',prompt:'LIVE_ONLY_TASK',text:'Live response.',status:'complete',demo:false,agent:'milo',model:'test/teacher'},
],lessons:[{id:'reviewed-chip',title:'Clear examples',instructions:'Explain accurately with a concrete example.',examples:[{prompt:'Original example.',completion:'Original approved response.'}],teacherModel:'playground/sample',baseModel:'playground/sample',revision:3,approved:true,reviewed:true,demo:true,created:Date.now()}],
chipLab:{selectedChip:'reviewed-chip',cases:[{id:'case-a',prompt:'Explain how APIs return a response.',rubric:'Accurate, useful, and clear.'},{id:'case-b',prompt:'Explain how a browser finds a web page.',rubric:'Concrete beginner example.'}]}};
await page.addInitScript(({key,seed})=>{if(window.top===window&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key,seed});
const calls=[];
await page.route('**/api/complete',async route=>{
  const body=route.request().postDataJSON();calls.push(body);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:body.kind==='teach'?'Explain accurately. Use a concrete example. State limitations. Check important claims. Keep the structure clear.':`Response ${calls.length}: `+(body.learned?'Apply the learned approach.':'Use the base approach.'),model:body.model,finishReason:'stop',demo:true})});
});
try {
  await page.goto(url);
  await page.locator('[data-page="lab"]:visible').first().click();
  await page.getByRole('heading',{name:'Chip lab',exact:true}).waitFor();
  assert.equal(await page.locator('#lab-example-task-live').count(),0,'opposite-provenance examples are excluded');
  await page.getByRole('button',{name:'Run 4 calls',exact:true}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).chipLab.runs.at(-1)?.status==='complete',key);
  assert.equal(calls.length,4);
  assert.ok(calls.every(call=>call.model==='playground/sample'&&call.kind==='compare'));
  assert.deepEqual(calls.map(call=>call.learned),[false,true,false,true]);
  assert.equal(await page.getByText('with chip',{exact:true}).count(),0,'setup starts blind');
  await page.getByRole('button',{name:'Prefer A',exact:true}).first().click();
  await page.locator('[data-lab-run]').first().fill('A is clearer for the stated audience.');
  await page.locator('[data-lab-run]').first().press('Tab');
  await page.getByRole('button',{name:'Reveal A/B setup',exact:true}).first().click();
  const revealed=(await page.locator('.lab-response').first().innerText()).toLowerCase();
  assert.ok(revealed.includes('base model')||revealed.includes('with chip'));
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export experiment report',exact:true}).click();
  const download=await downloadPromise;
  const report=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(report.run.cases[0].preference,'A');
  assert.equal(report.run.cases[0].notes,'A is clearer for the stated audience.');
  assert.ok(report.review.includes('Human preference only'));

  // Reading an example should never silently approve or select it.
  await page.locator('.lab-example details summary').first().click();
  assert.equal(await page.locator('#lab-example-task-two').isChecked(),false);
  await page.locator('#lab-example-task-one').check();
  await page.locator('#lab-example-task-two').check();
  await page.getByLabel('New chip name',{exact:true}).fill('Clear garden teacher');
  await page.getByLabel('What should the model learn?',{exact:true}).fill('Use accurate beginner examples.');
  await page.getByLabel('What makes these examples worth learning?',{exact:true}).fill('Their clarity and careful factual limits.');
  await page.getByLabel('I have read and approve these examples as teaching material.',{exact:true}).check();
  await page.getByRole('button',{name:'Distill an unreviewed draft',exact:true}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).chipLab.drafts.at(-1)?.status==='complete',key);
  assert.equal(calls.length,5);
  const db=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  const draft=db.lessons.at(-1);
  assert.equal(draft.parentId,'reviewed-chip');assert.equal(draft.revision,4);
  assert.equal(draft.approved,false);assert.equal(draft.reviewed,false);assert.equal(draft.examples.length,2);
  assert.equal(db.agents.nova.chipId,null);
  assert.equal(db.chipLab.curation.approved,false);
  for(const width of [320,390,420,430,1440]){
    await page.setViewportSize({width,height:1000});
    const metrics=await page.evaluate(()=>{
      const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
      return {overflow:document.documentElement.scrollWidth-innerWidth,
      buttons:[...document.querySelectorAll('.chip-lab button')].filter(visible).filter(e=>e.getBoundingClientRect().width<43.9||e.getBoundingClientRect().height<43.9).map(e=>e.textContent),
      forms:[...document.querySelectorAll('.chip-lab textarea,.chip-lab select,.chip-lab input:not([type=checkbox])')].filter(visible).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.id)};
    });
    assert.ok(metrics.overflow<=1,JSON.stringify({width,metrics}));assert.deepEqual(metrics.buttons,[],JSON.stringify({width,metrics}));assert.deepEqual(metrics.forms,[],JSON.stringify({width,metrics}));
  }
  await page.getByRole('button',{name:'Edit chip / approve revision',exact:true}).click();
  await page.getByRole('heading',{name:'Review model chip',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Distilled instructions',{exact:true}).inputValue(),draft.instructions);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  // Mode changes must leave no invisible opposite-mode parent or example IDs.
  await page.locator('[data-page="settings"]:visible').first().click();
  await page.getByRole('button',{name:'Use live OpenRouter',exact:true}).click();
  await page.locator('[data-page="lab"]:visible').first().click();
  const liveMode=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).chipLab,key);
  assert.equal(liveMode.selectedChip,'');assert.deepEqual(liveMode.curation.taskIds,[]);
  assert.equal(liveMode.curation.approved,false);
  assert.equal(await page.locator('#lab-chip').inputValue(),'');
  await page.locator('#lab-example-task-live').check();
  await page.locator('[data-page="settings"]:visible').first().click();
  await page.getByRole('button',{name:'Try the playground',exact:true}).click();
  await page.locator('[data-page="lab"]:visible').first().click();
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).chipLab.curation.taskIds,key),[]);

  // Deleting all library chips must not remove the report's experiment setup.
  await page.evaluate(key=>{const db=JSON.parse(localStorage.getItem(key));db.lessons=[];localStorage.setItem(key,JSON.stringify(db));},key);
  await page.reload();
  await page.locator('[data-page="lab"]:visible').first().click();
  const retained=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).chipLab.runs.at(-1),key);
  assert.equal(retained.setup.chip.instructions,'Explain accurately with a concrete example.');
  assert.equal(retained.setup.chip.revision,3);
  assert.equal(retained.setup.chip.examples[0].completion,'Original approved response.');
  const exportedAgain=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export experiment report',exact:true}).click();
  const retainedExport=JSON.parse(await fs.readFile(await (await exportedAgain).path(),'utf8'));
  assert.equal(retainedExport.run.setup.chip.instructions,retained.setup.chip.instructions);
  assert.deepEqual(errors,[]);
  console.log('PASS: integrated Chip Lab comparisons, blind review/report, explicit curation, approval handoff, five responsive sizes, mode boundaries, and setup export after chip deletion/reload.');
} finally {await browser.close();}
