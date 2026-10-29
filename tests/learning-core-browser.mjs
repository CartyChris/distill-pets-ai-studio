import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const base=process.env.APP_URL||'http://127.0.0.1:5194';
const folder=await mkdtemp(path.join(tmpdir(),'distill-pets-browser-'));
async function go(page,name) {
  await page.getByRole('button',{name:'All views',exact:true}).filter({visible:true}).first().click();
  await page.locator('#modal').getByRole('button',{name,exact:true}).click();
}
try {
  const context=await browser.newContext({viewport:{width:420,height:912},isMobile:true,hasTouch:true,acceptDownloads:true});
  await context.addInitScript(()=>{
    if(!localStorage.getItem('pip-studio-v1')) localStorage.setItem('pip-studio-v1',JSON.stringify({version:1,mode:'live',tasks:[],lessons:[],agents:{milo:{model:'fixture/teacher'},nova:{model:'fixture/student'}}}));
  });
  const page=await context.newPage(),errors=[],requests=[];let revisions=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/models',route=>route.fulfill({json:{models:[]}}));
  await page.route('**/api/complete',route=>{
    const input=route.request().postDataJSON();requests.push(input);
    const text=input.kind==='learn-attempt'?'A short first answer.':input.kind==='learn-feedback'?'Add sunlight and accuracy, then revise.':JSON.stringify({answer:'Sunlight revision '+(++revisions),source:'Supplied classroom facts'});
    return route.fulfill({json:{text,model:input.model,finishReason:'stop'}});
  });
  await page.goto(base);
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:15000});
  await go(page,'Settings');await page.getByLabel('OpenRouter API key').fill('fixture-key-no-network');
  await go(page,'Teaching workshop');
  await page.locator('#learn-rounds').selectOption('3');
  await page.locator('.learn-constraints summary').click();
  await page.locator('#learn-format').selectOption('json');
  assert.equal(await page.locator('.learn-constraints').evaluate(e=>e.open),true,'Constraint editor stays open as controls change');
  await page.locator('#learn-check-jsonKeys').fill('answer\nsource');await page.locator('#learn-check-jsonKeys').blur();
  assert.match(await page.locator('[data-action="learn-run"]').innerText(),/7 calls/);
  await page.locator('[data-action="learn-run"]').click();
  await page.waitForFunction(()=>{const run=JSON.parse(localStorage.getItem('pip-studio-v1')).teaching.runs.at(-1);return run&&run.status!=='running';});
  let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('pip-studio-v1')));
  assert.equal(state.teaching.runs[0]?.status,'complete',state.teaching.runs[0]?.error||'No run saved');
  assert.equal(requests.length,7);
  assert.equal(state.teaching.runs[0].items[0].rounds[1].revision.diagnostics.engine,'Rust / WebAssembly','Real worker must use compiled WASM under production CSP');
  assert.equal(state.teaching.runs[0].items[0].rounds[1].revision.diagnostics.failedChecks,0);
  assert.equal(state.teaching.rows[0].approved,false);
  await page.locator('[data-learn-review]').check();
  await page.locator('[data-action="learn-audit"]').click();
  await page.getByText('Latest dataset check',{exact:true}).waitFor();
  assert.match(await page.locator('.learn-core').innerText(),/Rust \/ WebAssembly/);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="learn-export-bundle"]').click()]);
  const target=path.join(folder,'bundle.zip');await download.saveAs(target);
  const audit=spawnSync('python3',['training/audit_bundle.py',target],{encoding:'utf8'});
  assert.equal(audit.status,0,audit.stderr);
  assert.equal(JSON.parse(audit.stdout).trainingRows,1);
  await go(page,'Open World');
  await page.locator('[data-action="world-tab"][data-tab="dialogue"]').click();
  assert.equal(await page.locator('#world-dialogue-list .world-speech').count(),7);
  await page.reload();await go(page,'Teaching workshop');
  state=await page.evaluate(()=>JSON.parse(localStorage.getItem('pip-studio-v1')));
  assert.equal(state.teaching.runs[0].items[0].rounds.length,2);
  assert.equal(state.teaching.rows[0].approved,true);
  assert.equal(requests.length,7,'reload never resubmits model calls');
  for(const [width,height] of [[320,568],[393,852],[402,874],[420,912],[430,932],[852,393],[1440,900]]) {
    await page.setViewportSize({width,height});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Fits '+width);
    assert.ok(await page.locator('#learn-rounds').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
  }
  await page.setViewportSize({width:420,height:912});
  await page.screenshot({path:'tests/learning-core-mobile.png',fullPage:true});
  await context.setOffline(true);
  await page.reload();await go(page,'Teaching workshop');
  await page.locator('[data-action="learn-audit"]').click();
  await page.getByText('Latest dataset check',{exact:true}).waitFor();
  assert.equal(requests.length,7,'offline local analysis makes no model call');
  const cache=await page.evaluate(async()=>{const names=await caches.keys();return (await Promise.all(names.map(async name=>(await(await caches.open(name)).keys()).map(r=>r.url)))).flat();});
  assert.ok(cache.some(url=>url.endsWith('.wasm')),'WASM cached as a static asset');
  assert.ok(!cache.some(url=>url.includes('/api/')),'API data excluded from caches');
  assert.deepEqual(errors,[]);
  await context.close();

  const fallback=await browser.newContext({serviceWorkers:'block',viewport:{width:420,height:912}});
  await fallback.route('**/*.wasm',route=>route.fulfill({status:200,contentType:'application/wasm',body:'not-a-wasm-binary'}));
  const other=await fallback.newPage();await other.goto(base);await go(other,'Teaching workshop');
  await other.locator('[data-action="learn-audit"]').click();await other.getByText('Latest dataset check',{exact:true}).waitFor();
  assert.match(await other.locator('.learn-core').innerText(),/JavaScript worker/,'Invalid WASM keeps dataset analysis usable');
  await fallback.close();
  console.log('PASS production browser: real Rust/WASM worker and CSP, seven-call recursive flow, review/export/Python audit, Wilds dialogue, restore, 7 screen sizes, offline local analysis and corrupt-WASM fallback.');
} finally {await browser.close();await rm(folder,{recursive:true,force:true});}
