import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.addInitScript(()=>{if(window.top!==window||localStorage.getItem('pip-studio-v1'))return;localStorage.setItem('pip-studio-v1',JSON.stringify({version:1,mode:'demo',agents:{milo:{model:'test/teacher'},nova:{model:'test/student'}},tasks:[{id:'cut-short',prompt:'Cut-short result proof',text:'An incomplete answer',agent:'milo',model:'playground/sample',demo:true,status:'complete',truncated:true}],lessons:[{id:'draft',title:'Unreviewed laboratory draft',baseModel:'playground/sample',teacherModel:'playground/sample',instructions:'Rules requiring human review.',examples:[{prompt:'Example',completion:'Approved demonstration'}],approved:false,reviewed:false,demo:true,revision:1}]}));});
 await page.goto(process.env.APP_URL||'http://localhost:5190');await page.getByRole('button',{name:'Model chips',exact:true}).first().click();
 assert.equal(await page.getByRole('button',{name:'Equip Nova',exact:true}).isDisabled(),true,'A draft must require explicit instruction review before equipping.');
 await page.getByRole('button',{name:'Edit chip',exact:true}).click();await page.getByRole('button',{name:'Approve new revision',exact:true}).click();
 const db=await page.evaluate(()=>JSON.parse(localStorage.getItem('pip-studio-v1')));assert.equal(db.lessons[0].approved,false);assert.equal(db.lessons[1].parentId,'draft');assert.equal(db.lessons[1].approved,true);assert.equal(db.lessons[1].reviewed,true);
 await page.locator(`[data-action="equip"][data-agent="nova"][data-id="${db.lessons[1].id}"]`).click();const equipped=await page.evaluate(()=>JSON.parse(localStorage.getItem('pip-studio-v1')).agents.nova.chipId);assert.equal(equipped,db.lessons[1].id);
 await page.getByRole('button',{name:'Workspace',exact:true}).first().click();await page.getByRole('button',{name:'Saved tasks',exact:true}).click();await page.locator('#modal').getByRole('button',{name:'Cut-short result proof',exact:true}).click();await page.getByRole('button',{name:'Distill model chip',exact:true}).click();await page.getByText('This response was cut short. Generate a complete result before distilling it.',{exact:true}).waitFor();assert.equal(await page.locator('#modal').isVisible(),false);
 console.log('PASS: chip drafts cannot bypass review through Equip; approval creates a separate immutable revision before equipping.');
}finally{await browser.close();}
