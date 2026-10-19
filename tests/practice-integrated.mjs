import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:420,height:912},isMobile:true,hasTouch:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.APP_URL||'http://localhost:5190');await page.getByRole('button',{name:'Try the playground',exact:true}).click();
 await page.getByRole('button',{name:'All views',exact:true}).click();await page.locator('#modal').getByRole('button',{name:'Open World',exact:true}).click();
 await page.getByRole('button',{name:'Mission',exact:true}).click();await page.locator('#world-goal').fill('Explain an API using a precise everyday example.');await page.locator('#world-dialogue').uncheck();await page.locator('#world-practice').check();await page.locator('#world-practice-rounds').selectOption('2');
 assert.match(await page.locator('#world-call-plan').innerText(),/5 planned model calls/);
 await page.getByRole('button',{name:'Set out together',exact:false}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pip-studio-v1')).wilds.records.at(-1)?.status==='complete');
 const first=await page.evaluate(()=>JSON.parse(localStorage.getItem('pip-studio-v1')));assert.equal(first.studio.lastRun.dialogueEnabled,false);assert.equal(first.studio.lastRun.practice,true);assert.equal(first.studio.lastRun.practiceRounds,2);assert.equal(first.studio.dialogue.length,4);assert.equal(first.wilds.records.at(-1).student,'nova');assert.ok(first.studio.dialogue.some(m=>m.kind==='Student practice 2'));assert.ok(first.studio.dialogue.some(m=>m.kind==='Teacher feedback 2'));
 await page.getByRole('button',{name:'Team chat',exact:true}).click();await page.getByText(/Student practice 2/).first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.reload();const recovered=await page.evaluate(()=>JSON.parse(localStorage.getItem('pip-studio-v1')));assert.equal(recovered.wilds.records.at(-1).student,'nova');assert.equal(recovered.studio.dialogue.length,4);assert.equal(recovered.studio.lastRun.practice,true);
 assert.deepEqual(errors,[]);console.log('PASS: phone Mission→independent practice→actual student/teacher messages→outing journal→reload, with accurate five-call plan and preserved student identity.');
}finally{await browser.close();}
