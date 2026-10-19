import assert from 'node:assert/strict';

export const APP_URL = process.env.APP_URL || 'http://localhost:5190';
export const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const KEY = 'test-key-studio-evolution-only';
export const ORIGINAL = 'ORIGINAL_TASK_SENTINEL: Explain a useful idea clearly and check the result.';
export const TEACHER = 'test/evolution-teacher';
export const STUDENT = 'test/evolution-student';
export const PRIVATE = 'PRIVATE_PROVIDER_REASONING_SENTINEL';

function chip(id, model, instructions) {
  return { id, title: id, instructions, examples: [{ prompt: 'Approved example.', completion: 'Clear approved answer.' }], teacherModel: model, baseModel: model, revision: 1, approved: true, reviewed: true, created: Date.now(), demo: false };
}
function seed(overrides) {
  const base = {
    mode: 'live', activeAgent: 'milo', maxTokens: 2048,
    generation: { brief: 'BRIEF_SENTINEL: respect the original audience.', temperature: 0.4 },
    agents: { milo: { name: 'Milo', model: TEACHER, chipId: 'teacher-chip', voice: 'precise' }, nova: { name: 'Nova', model: STUDENT, chipId: 'student-chip', voice: 'socratic' } },
    lessons: [chip('teacher-chip', TEACHER, 'TEACHER_CHIP_SENTINEL: demonstrate accurate technique.'), chip('student-chip', STUDENT, 'STUDENT_CHIP_SENTINEL: practice the technique and check understanding.')],
    studio: { watch: true, recursive: false, autoLearn: false },
  };
  return { ...base, ...overrides, agents: { ...base.agents, ...overrides?.agents }, generation: { ...base.generation, ...overrides?.generation }, studio: { ...base.studio, ...overrides?.studio } };
}

const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles.css"></head><body><div id="harness-views"><button data-view="code">Code view</button><button data-view="research">Research view</button><button data-view="live">Live view</button></div><main id="app" style="max-width:1300px;margin:20px auto;padding:20px"></main><dialog id="modal" aria-labelledby="modal-title"></dialog><div id="toast" role="status"></div><script type="module">
import { createStudio, cleanStudio } from '/src/studio.js';
const input = JSON.parse(localStorage.getItem('studio-evolution-fixture') || 'null') || window.__seed;
const db = { ...input, studio: cleanStudio(input.studio) };
let busy = false, operation = 0, page = 'code', error = '', studio;
const queue = { teacher: [], student: [] };
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save = () => localStorage.setItem('studio-evolution-fixture', JSON.stringify(db));
const render = () => { document.getElementById('app').innerHTML = (error ? '<div class="error" role="alert">'+h(error)+'</div>' : '') + studio.view(page); studio.afterRender(page); };
const button = (action,label,cls='',attrs='') => '<button data-action="'+action+'" class="'+cls+'" '+attrs+'>'+label+'</button>';
studio = createStudio({ getDB:()=>db, getBusy:()=>busy, currentOp:()=>operation, getKey:()=> '${KEY}', getPage:()=>page, escape:h, button, icon:()=>'', mascot:()=>'<span aria-hidden="true">●</span>',
  save, render, setPage:value=>{ page=value; render(); }, setError:value=>{error=value;}, toast:value=>{document.getElementById('toast').textContent=value;},
  openModal:content=>{const modal=document.getElementById('modal');modal.innerHTML=content;if(!modal.open)modal.showModal();},
  ready:(agent,override)=>db.mode==='demo'||!!(override||db.agents[agent].model),
  start:()=>{busy=true;error='';return ++operation;},
  finish:(agent,op)=>{if(op!==operation)return;busy=false;save();render();},
  lesson:agent=>db.lessons.find(item=>item.id===db.agents[agent].chipId),
  takeGuidance:(id,role)=>queue[role].splice(0),
  studentMessages:(prompt,chip,agent)=>{
    const messages=[{role:'system',content:'Public task assistant. Voice: '+db.agents[agent].voice+'. '+db.generation.brief+(chip?' '+chip.instructions:'')}];
    for(const example of chip?.examples||[])messages.push({role:'user',content:example.prompt},{role:'assistant',content:example.completion});
    messages.push({role:'user',content:prompt});return messages;
  },
});
const stop = () => { studio.cancel();operation++;busy=false;save();render(); };
document.addEventListener('click',event=>{const view=event.target.closest('[data-view]');if(view){page=view.dataset.view;render();return;}const target=event.target.closest('[data-action]');if(!target||target.disabled)return;if(target.dataset.action==='stop'){stop();return;}if(target.dataset.action==='close'){document.getElementById('modal').close();return;}Promise.resolve(studio.action(target.dataset.action,target.dataset)).catch(problem=>{error=problem.message;busy=false;save();render();});});
window.__evolution={db,studio,queue,stop,setPage:value=>{page=value;render();},get busy(){return busy;},get error(){return error;},get op(){return operation;}};
save();render();
</script></body></html>`;

export function sse(text, { finishReason = 'stop' } = {}) {
  return 'data: ' + JSON.stringify({ choices: [{ delta: { reasoning: PRIVATE }, finish_reason: null }] }) + '\r\n\r\n' +
    'data: ' + JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] }) + '\r\n\r\n' +
    'data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: finishReason }] }) + '\n\ndata: [DONE]\n\n';
}
export async function newStudioPage(browser, overrides = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.__evolutionErrors = [];
  page.on('pageerror', error => page.__evolutionErrors.push(error.message));
  page.setDefaultTimeout(12000);
  await page.addInitScript(data => { if(window.top===window)window.__seed=data; }, seed(overrides));
  await page.route('**/__studio_evolution__/', route => route.fulfill({ status: 200, contentType: 'text/html', body: fixture }));
  await page.goto(new URL('/__studio_evolution__/', APP_URL).href);
  await page.waitForFunction(() => !!window.__evolution);
  return page;
}
export async function saved(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('studio-evolution-fixture')));
}
export async function waitSaved(page, predicate) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const db = await saved(page);
    if (db && predicate(db)) return db;
    await page.waitForTimeout(80);
  }
  assert.fail('Expected studio state was not saved: ' + predicate.toString());
}
export async function waitIdle(page) {
  await page.waitForFunction(() => !window.__evolution.busy);
  return saved(page);
}
