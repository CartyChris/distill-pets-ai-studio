import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox'] });
const folder = await mkdtemp(path.join(tmpdir(),'distill-pets-postcards-'));
const base = process.env.APP_URL || 'http://127.0.0.1:5194';
async function go(page,name) {
  if (name === 'Open World' && await page.locator('.sidebar').isVisible()) {
    await page.locator('.sidebar [data-page="adventure"]').click(); return;
  }
  await page.getByRole('button',{name:'All views',exact:true}).filter({visible:true}).first().click();
  await page.locator('#modal').getByRole('button',{name,exact:true}).click();
}
async function playTab(page) { await page.locator('.world-tabs [data-tab="play"]').click(); }
const state = page => page.evaluate(()=>JSON.parse(localStorage.getItem('pip-studio-v1')).adventure.playbook);
try {
  const context = await browser.newContext({viewport:{width:420,height:912},isMobile:true,hasTouch:true,acceptDownloads:true});
  await context.addInitScript(()=>{
    if (!localStorage.getItem('pip-studio-v1')) localStorage.setItem('pip-studio-v1',JSON.stringify({version:1,mode:'demo',tasks:[],lessons:[],agents:{milo:{model:'',name:'Milo',pet:'fox',skin:'pixel',outfit:'wizard',aura:'leaves',trail:'paws'},nova:{model:'',name:'Nova',pet:'bunny',skin:'pixel',outfit:'flowers',aura:'sparkles',trail:'hearts'}}}));
  });
  const page = await context.newPage(), errors=[], inference=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/models',r=>r.fulfill({json:{models:[]}}));
  await page.route(/\/api\/(complete|stream)/,r=>{inference.push(r.request().url());return r.abort();});
  await page.goto(base,{waitUntil:'domcontentloaded'}); await go(page,'Open World'); await playTab(page);
  assert.equal(await page.locator('.playbook-activity').count(),6);
  await page.locator('[data-action="world-play"][data-kind="picnic"]').click();
  await page.getByText('A little play break · AI work continues.',{exact:true}).waitFor({timeout:15000});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pip-studio-v1')).adventure.playbook.moments===1,null,{timeout:30000});
  assert.deepEqual((await state(page)).activities,['picnic']);

  await playTab(page); await page.locator('[data-action="world-play"][data-kind="dance"]').click();
  await page.getByText('A little play break · AI work continues.',{exact:true}).waitFor({timeout:15000});
  await page.locator('[data-action="world-pause"]').click();
  await page.waitForTimeout(1200);
  assert.equal((await state(page)).moments,1,'Paused play does not finish or mint memories');
  await page.locator('[data-action="world-stop-play"]').filter({visible:true}).click();
  assert.equal((await state(page)).moments,1,'Cancelled play is not recorded');

  // Reaching camp records a visit. Merely looking at a distant landmark does not.
  await page.locator('[data-action="world-pause"]').click();
  await page.locator('[data-action="world-open-places"]').click();
  await page.locator('#world-place-search').fill('lighthouse');
  await page.locator('[data-action="world-place-look"]').click();
  assert.ok(!(await state(page)).visits.includes('lighthouse'));
  await page.locator('[data-action="world-open-places"]').click();
  await page.locator('#world-place-search').fill('Curiosity Camp');
  await page.locator('[data-action="world-place-walk"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pip-studio-v1')).adventure.playbook.visits.includes('camp'),null,{timeout:10000});
  await playTab(page); await page.locator('[data-action="world-trail"][data-trail="coast"]').click();
  assert.match(await page.locator('.playbook-trail-card').innerText(),/Source Lighthouse/);
  assert.equal((await state(page)).trail,'coast');
  await page.screenshot({path:'tests/world-play-phone.png'});

  await page.locator('[data-action="world-play"][data-kind="bubbles"]').click();
  await page.getByText('A little play break · AI work continues.',{exact:true}).waitFor({timeout:15000});
  await page.locator('[data-action="world-pause"]').click();
  await playTab(page);await page.locator('[data-action="world-photo"]').click();
  assert.equal(await page.locator('#adventure-root').evaluate(e=>e.classList.contains('is-photo-mode')),true);
  assert.equal(await page.locator('.world-tabs').isVisible(),false);
  await page.locator('#world-photo-caption').fill('Milo & Nova · wishing on bubbles');
  for (const [format,ratio] of [['landscape',16/9],['square',1],['portrait',9/16]]) {
    await page.locator('#world-photo-format').selectOption(format);
    await page.locator('[data-action="world-photo-save"]').click();
    const preview=page.locator('.world-postcard-preview');await preview.waitFor();
    await preview.evaluate(e=>e.decode());
    const size=await preview.evaluate(e=>({width:e.naturalWidth,height:e.naturalHeight}));
    assert.ok(Math.abs(size.width/size.height-ratio)<.01,format+' keeps proportions');
    assert.ok(Math.max(size.width,size.height)<=1600);
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#modal a[download]').click()]);
    const target=path.join(folder,format+'.png');await download.saveAs(target);const png=await readFile(target);
    assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.length>5000);
    assert.equal(png.readUInt32BE(16),size.width);assert.equal(png.readUInt32BE(20),size.height);
    if(format==='landscape' && process.env.CAPTURE_POSTCARD) await download.saveAs(process.env.CAPTURE_POSTCARD);
    await page.locator('#modal [data-action="close"]').last().click();
  }
  assert.equal((await state(page)).postcards,3);
  for(const [width,height] of [[320,568],[393,852],[402,874],[420,912],[430,932],[568,320],[1440,900]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(120);
    const invalid=await page.locator('.world-photo-top button,.world-photo-bottom input,.world-photo-bottom select,.world-photo-bottom button').evaluateAll(els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.width<43||r.height<43||r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1;}).map(e=>e.id||e.textContent));
    assert.deepEqual(invalid,[],`Postcard controls fit ${width}×${height}`);
    assert.ok(await page.locator('#world-photo-caption').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
    await page.locator('[data-action="world-photo-close"]').click();
    const tabs=await page.locator('.world-tabs button').evaluateAll(els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.width<43||r.left<0||r.right>innerWidth+1;}).map(e=>e.textContent));
    assert.deepEqual(tabs,[],`All seven panels fit ${width}`);
    await page.locator('[data-action="world-photo"]').click();
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('.world-photo-controls').isVisible(),false);
  const [journal]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="world-journal-export"]').click()]);
  const jsonPath=path.join(folder,'journal.json');await journal.saveAs(jsonPath);
  const exported=JSON.parse(await readFile(jsonPath,'utf8'));assert.equal(exported.kind,'scenic-field-journal');assert.equal(exported.postcards,3);
  await page.reload({waitUntil:'domcontentloaded'});await go(page,'Open World');await playTab(page);
  assert.equal((await state(page)).postcards,3);assert.ok((await state(page)).visits.includes('camp'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('[data-action="world-play"][data-kind="highfive"]').click();
  await page.getByText('A little play break · AI work continues.',{exact:true}).waitFor({timeout:15000});
  assert.equal(await page.locator('#adventure-root').getAttribute('data-gentle'),'true');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pip-studio-v1')).adventure.playbook.activities.includes('highfive'),null,{timeout:12000});
  assert.equal(inference.length,0,'Play, scenery, photos and journals never call a model');
  assert.deepEqual(errors,[]);
  console.log('PASS: real app play/gather/pause/cancel, arrival-only passport, persistent journal, three downloadable proportional PNGs, seven phone/desktop layouts, keyboard exit, reduced motion, zero model calls.');
  await context.close();
} finally { await browser.close();await rm(folder,{recursive:true,force:true}); }
