import './studio-evolution.css';

const safePath = path =>
  typeof path === 'string' &&
  path.length < 160 &&
  /^[a-zA-Z0-9_./-]+$/.test(path) &&
  !path.startsWith('/') &&
  !path.split('/').includes('..') &&
  !path.includes('//');
const boundedRounds = value => Math.max(1, Math.min(3, Math.floor(Number(value) || 1)));
const cleanProfile = value => {
  let budget = 92000;
  return Array.isArray(value) ? value.slice(0, 8).filter(m => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string').map(m => {
    const content = m.content.slice(0, Math.min(budget, m.role === 'system' ? 24000 : 20000));
    budget -= content.length;
    return { role: m.role, content };
  }) : [];
};
const cleanGuidance = value => Object.fromEntries(['teacher', 'student'].map(role => [role, Array.isArray(value?.[role]) ? value[role].slice(-12).filter(m => typeof m?.content === 'string').map(m => ({ role: 'user', content: m.content.slice(0, 4000) })) : []]));
const cleanDialogue = value => Array.isArray(value) ? value.slice(-12).filter(m => m && typeof m.text === 'string').map(m => ({
  id: String(m.id || '').slice(0,80), runId: String(m.runId || '').slice(0,80), agent: m.agent === 'nova' ? 'nova' : 'milo',
  model: String(m.model || '').slice(0,200), text: m.text.slice(0,12000), kind: String(m.kind || 'Message').slice(0,80),
  status: ['complete','failed','stopped'].includes(m.status) ? m.status : 'stopped', demo: !!m.demo, created: Number(m.created) || Date.now(),
})) : [];
const cleanRecovery = value => !value || typeof value !== 'object' ? null : {
  output: String(value.output || '').slice(0,250000), researchOutput: String(value.researchOutput || '').slice(0,250000), selectedFile: String(value.selectedFile || '').slice(0,160),
  files: Array.isArray(value.files) ? value.files.slice(0,24).filter(f => safePath(f?.path) && typeof f.content === 'string').map(f => ({ path: f.path, content: f.content.slice(0,200000) })) : [],
  sources: Array.isArray(value.sources) ? value.sources.slice(0,20).filter(s => typeof s?.url === 'string' && /^https?:\/\//.test(s.url)).map(s => ({ url: s.url.slice(0,2000), title: String(s.title || s.url).slice(0,180) })) : [],
};
export function cleanStudio(x) {
  const base = {
    files: [],
    selectedFile: '',
    request: '',
    output: '',
    events: [],
    observerBuffer: '',
    observerSummary: '',
    observer: 'nova',
    lastRun: null,
    researchQuestion: '',
    researchOutput: '',
    sources: [],
    rounds: 1,
    recursive: false,
    watch: true,
    autoLearn: false,
    snapshots: [],
    dialogue: [],
    followup: '',
    find: '',
    failedOutput: '',
    iterationRecovery: null,
  };
  if (!x || typeof x !== 'object') return base;
  for (const k of [
    'request',
    'output',
    'observerBuffer',
    'observerSummary',
    'researchQuestion',
    'researchOutput',
    'followup',
    'find',
    'failedOutput',
  ])
    if (typeof x[k] === 'string')
      base[k] = x[k].slice(
        0,
        k === 'followup' ? 10000 : k === 'find' ? 200 : k === 'failedOutput' ? 60000 : k === 'request' || k === 'researchQuestion' ? 20000 : k === 'observerBuffer' ? 120000 : 250000
      );
  base.files = Array.isArray(x.files)
    ? x.files
        .slice(0, 24)
        .filter(
          f =>
            safePath(f?.path) &&
            typeof f.content === 'string' &&
            f.content.length <= 200000
        )
        .map(f => ({ path: f.path, content: f.content }))
    : [];
  base.selectedFile = base.files.some(f => f.path === x.selectedFile)
    ? x.selectedFile
    : base.files[0]?.path || '';
  base.events = Array.isArray(x.events)
    ? x.events
        .slice(-60)
        .filter(e => typeof e.message === 'string')
        .map(e => ({
          message: e.message.slice(0, 500),
          time: Number(e.time) || Date.now(),
        }))
    : [];
  base.rounds = [1, 2, 3].includes(x.rounds) ? x.rounds : 1;
  base.recursive = !!x.recursive;
  base.watch = x.watch !== false;
  base.autoLearn = !!x.autoLearn;
  base.observer = x.observer === 'milo' ? 'milo' : 'nova';
  if (x.lastRun && typeof x.lastRun.kind === 'string')
    base.lastRun = {
      kind: String(x.lastRun.kind).slice(0, 30),
      status: ['complete', 'partial', 'failed', 'stopped'].includes(x.lastRun.status)
        ? x.lastRun.status
        : 'stopped',
      agent: x.lastRun.agent === 'nova' ? 'nova' : 'milo',
      demo: !!x.lastRun.demo,
      round: Number(x.lastRun.round) || 1,
      started: Number(x.lastRun.started) || Date.now(),
      watched: !!x.lastRun.watched,
      id: typeof x.lastRun.id === 'string' ? x.lastRun.id.slice(0, 80) : '',
      prompt: typeof x.lastRun.prompt === 'string' ? x.lastRun.prompt.slice(0, 20000) : (x.lastRun.kind === 'code' ? base.request : base.researchQuestion),
      model: String(x.lastRun.model || '').slice(0, 200),
      chipId: typeof x.lastRun.chipId === 'string' ? x.lastRun.chipId.slice(0, 80) : null,
      instructions: typeof x.lastRun.instructions === 'string' ? x.lastRun.instructions.slice(0, 12000) : '',
      phase: String(x.lastRun.phase || '').slice(0, 60),
      speakingAgent: x.lastRun.speakingAgent === 'nova' ? 'nova' : 'milo',
      dialogueEnabled: !!x.lastRun.dialogueEnabled,
      practice: !!x.lastRun.practice,
      practiceRounds: boundedRounds(x.lastRun.practiceRounds),
      practiceRound: Math.max(0, Math.min(3, Number(x.lastRun.practiceRound) || 0)),
      studentModel: String(x.lastRun.studentModel || '').slice(0, 200),
      studentChipId: typeof x.lastRun.studentChipId === 'string' ? x.lastRun.studentChipId.slice(0, 80) : null,
      teacherVoice: String(x.lastRun.teacherVoice || '').slice(0, 40),
      studentVoice: String(x.lastRun.studentVoice || '').slice(0, 40),
      teacherProfile: cleanProfile(x.lastRun.teacherProfile),
      studentProfile: cleanProfile(x.lastRun.studentProfile),
      guidance: cleanGuidance(x.lastRun.guidance),
      recursive: !!x.lastRun.recursive,
      rounds: boundedRounds(x.lastRun.rounds),
      autoLearn: !!x.lastRun.autoLearn,
      maxTokens: Math.max(256, Math.min(8000, Number(x.lastRun.maxTokens) || 2048)),
      temperature: Math.max(0, Math.min(2, Number.isFinite(Number(x.lastRun.temperature)) ? Number(x.lastRun.temperature) : 0.7)),
      continuationOf: String(x.lastRun.continuationOf || '').slice(0, 80),
      instruction: String(x.lastRun.instruction || '').slice(0, 10000),
      contextDialogue: cleanDialogue(x.lastRun.contextDialogue).filter(m => m.status === 'complete'),
    };
  base.sources = Array.isArray(x.sources)
    ? x.sources
        .slice(0, 20)
        .filter(a => typeof a.url === 'string' && /^https?:\/\//.test(a.url))
        .map(a => ({
          url: a.url.slice(0, 2000),
          title: String(a.title || a.url).slice(0, 180),
        }))
    : [];
  base.snapshots = Array.isArray(x.snapshots)
    ? x.snapshots.slice(-3).map(a => ({
        time: Number(a.time) || Date.now(),
        files: Array.isArray(a.files)
          ? a.files
              .slice(0, 24)
              .filter(
                f =>
                  safePath(f?.path) &&
                  typeof f.content === 'string' &&
                  f.content.length <= 200000
              )
              .map(f => ({ path: f.path, content: f.content }))
          : [],
      }))
    : [];
  base.dialogue = cleanDialogue(x.dialogue);
  base.iterationRecovery = cleanRecovery(x.iterationRecovery);
  if (base.iterationRecovery && base.lastRun?.status === 'stopped') {
    const previous = base.iterationRecovery;
    base.failedOutput = base.output.slice(0,60000);
    Object.assign(base, previous, { iterationRecovery: null });
    base.lastRun.phase = 'interrupted-iteration-previous-kept';
    base.events.push({ time: Date.now(), message: 'The previous result and files were restored after an interrupted iteration.' });
    base.events = base.events.slice(-60);
  } else if (base.lastRun?.status !== 'running') base.iterationRecovery = null;
  return base;
}
const DEMO_FILES = [
  {
    path: 'index.html',
    content:
      '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>A little joy</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <main>\n    <span class="spark">✦</span>\n    <p class="eyebrow">A TINY PLAYGROUND PROJECT</p>\n    <h1>A little joy goes a long way.</h1>\n    <p>Click the button. Make a small, happy thing happen.</p>\n    <output id="count">0</output>\n    <button id="add">Add a little joy</button>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>',
  },
  {
    path: 'styles.css',
    content:
      '* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #edf1fb; color: #26304f; font-family: system-ui, sans-serif; }\nmain { text-align: center; max-width: 480px; padding: 40px 25px; }\nh1 { font-size: clamp(30px, 6vw, 46px); letter-spacing: -.06em; line-height: 1.1; }\np { line-height: 1.7; color: #596581; }\n.eyebrow { font-size: 10px; letter-spacing: .2em; }\n.spark { display: block; font-size: 45px; color: #edaf48; }\noutput { display: block; font-size: 56px; font-weight: 700; margin: 20px; }\nbutton { border: 0; border-radius: 15px; background: #26304f; color: white; padding: 16px 24px; cursor: pointer; font: inherit; }\nbutton:hover { background: #426ac9; }\nbutton:focus-visible { outline: 3px solid #edaf48; outline-offset: 4px; }',
  },
  {
    path: 'script.js',
    content:
      "let joy = 0;\nconst count = document.getElementById('count');\ndocument.getElementById('add').addEventListener('click', () => {\n  joy += 1;\n  count.textContent = String(joy);\n});",
  },
  {
    path: 'README.md',
    content:
      '# A little joy\n\nA prepared playground scaffold for Distill Pets AI Studio.\n\nOpen index.html in a browser. No installation needed.\n\nConnect OpenRouter to generate a real project from your request.',
  },
];
const serializeFiles = files =>
  files
    .map(f => `===FILE:${f.path}===\n${f.content}\n===END FILE===`)
    .join('\n\n');
function parseFiles(text, partial = false) {
  const files = [];
  const pattern = /^===FILE:([^\n=]+)===\r?\n/gm;
  let m;
  while ((m = pattern.exec(text))) {
    const path = m[1].trim();
    const begin = pattern.lastIndex;
    let end = text.indexOf('===END FILE===', begin);
    if (end < 0 && !partial) continue;
    if (end < 0) end = text.length;
    if (
      safePath(path) &&
      files.length < 24 &&
      !files.some(f => f.path === path)
    )
      files.push({
        path,
        content: text.slice(begin, end).replace(/\n$/, '').slice(0, 200000),
      });
  }
  return files;
}
function previewDependenciesComplete(files) {
  const entry = files.find(f => /(^|\/)index\.html$/.test(f.path)) || files.find(f => f.path.endsWith('.html'));
  if (!entry) return false;
  const origin = 'https://pip-preview.invalid/', byPath = new Map(files.map(file => [file.path, file])), pending = [], seen = new Set();
  const localPath = (value, from) => {
    try { const url = new URL(value, origin + from); return url.origin === new URL(origin).origin ? decodeURIComponent(url.pathname.slice(1)) : null; } catch { return null; }
  };
  const add = (value, from) => { const path = localPath(value, from); if (path) pending.push(path); };
  const imports = (source, from) => {
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])([^'"\n]+)\1/g))
      if (match[2].startsWith('.') || match[2].startsWith('/')) add(match[2], from);
  };
  for (const match of entry.content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const src = match[1].match(/\bsrc\s*=\s*['"]([^'"]+)['"]/i);
    if (src) add(src[1], entry.path);
    else if (/\btype\s*=\s*['"]module['"]/i.test(match[1])) imports(match[2], entry.path);
  }
  for (const match of entry.content.matchAll(/<link\b[^>]*>/gi)) {
    if (!/\brel\s*=\s*['"]stylesheet['"]/i.test(match[0])) continue;
    const href = match[0].match(/\bhref\s*=\s*['"]([^'"]+)['"]/i);
    if (href) add(href[1], entry.path);
  }
  while (pending.length) {
    const path = pending.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    const file = byPath.get(path);
    if (!file) return false;
    if (/\.(?:m?js|jsx|ts|tsx)$/.test(path)) imports(file.content, path);
  }
  return true;
}
function previewSource(files) {
  const index =
    files.find(f => /(^|\/)index\.html$/.test(f.path)) ||
    files.find(f => f.path.endsWith('.html'));
  if (!index)
    return '<html><body style="font:14px system-ui;padding:25px;color:#706c64">This preview runs HTML, CSS, and JavaScript. Choose an HTML entry file to see your project.</body></html>';
  const prefix = index.path.includes('/')
    ? index.path.slice(0, index.path.lastIndexOf('/') + 1)
    : '';
  const virtual = 'https://pip-preview.invalid/';
  const resolve = (p, from = index.path) => {
    try { const u = new URL(p, virtual + from); return u.origin === new URL(virtual).origin ? decodeURIComponent(u.pathname.slice(1)) : null; } catch { return null; }
  };
  const find = p => files.find(f => f.path === resolve(p) || f.path === p.replace(/^\.\//, ''));
  const moduleSource = f => f.content.replace(/(\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])([^'"\n]+)\2/g, (match, lead, quote, path) => {
    const target = path.startsWith('.') || path.startsWith('/') ? resolve(path, f.path) : null;
    return target && files.some(x => x.path === target) ? lead + quote + virtual + target + quote : match;
  });
  const modules = Object.fromEntries(files.filter(f => /\.(m?js)$/.test(f.path)).map(f => [virtual + f.path, moduleSource(f)]));
  const moduleBoot = `<script>(function(){const sources=${JSON.stringify(modules).replace(/</g, '\\u003c')};const imports={};for(const [name,source] of Object.entries(sources))imports[name]=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.appendChild(map);})();<\/script>`;
  let html = index.content.replace(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
    (tag, path) => {
      const f = find(path);
      return f && f.path.endsWith('.css')
        ? '<style>' + f.content.replace(/<\/style/gi, '<\\/style') + '</style>'
        : tag;
    }
  );
  html = html.replace(
    /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (tag, path) => {
      const f = find(path);
      if (!f) return tag;
      const module = /type\s*=\s*["']module["']/i.test(tag);
      return tag.replace(/\s+src\s*=\s*["'][^"']+["']/i, '').replace(/>\s*<\/script>$/i, '>' + (module ? moduleSource(f) : f.content).replace(/<\/script/gi, '<\\/script') + '</script>');
    }
  );
  const policy =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: https:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'\">";
  html = html.replace(/(<script\b[^>]*type=["']module["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (tag, open, source, close) => open + moduleSource({path:index.path,content:source}) + close);
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, match => match + policy + moduleBoot) : policy + moduleBoot + html;
}

export function createStudio(d) {
  const { escape: h, button: btn, icon, mascot, toast } = d;
  const state = () => d.getDB().studio;
  let abort = null,
    updateTime = 0;
  let checkpointTime = 0, draftTimer, checkpointTimer;
  let findIndex = -1, departing = false;
  let executablePreview = [];
  function checkpoint(force = false) {
    if (force || Date.now() - checkpointTime > 650) { clearTimeout(checkpointTimer); checkpointTimer = null; checkpointTime = Date.now(); d.save(); }
    else if (!checkpointTimer) checkpointTimer = setTimeout(() => { checkpointTimer = null; checkpoint(true); }, 650 - (Date.now() - checkpointTime));
    d.onUpdate?.();
  }
  const event = message => {
    const s = state();
    s.events.push({ time: Date.now(), message });
    s.events = s.events.slice(-60);
  };
  function update(force = false) {
    checkpoint(force);
    if (force || Date.now() - updateTime > 200) {
      updateTime = Date.now();
      if (['code', 'live', 'research', 'wilds', 'adventure'].includes(d.getPage())) d.render();
    }
  }
  function selected() {
    return (
      state().files.find(f => f.path === state().selectedFile) ||
      state().files[0]
    );
  }
  function status() {
    const s = state();
    if (s.lastRun?.status === 'partial') return 'Partial output · token limit reached';
    return s.lastRun?.status === 'complete'
      ? s.lastRun.kind === 'code'
        ? 'Project ready'
        : 'Research complete'
      : s.lastRun?.status === 'stopped'
        ? 'Run stopped'
        : s.lastRun?.status === 'failed'
          ? 'Run failed'
          : d.getBusy()
            ? 'Working live'
            : 'Ready for an idea';
  }
  function settings() {
    const s = state(),
      db = d.getDB();
    return `<div class="row studio-settings"><label class="check"><input id="studio-watch" type="checkbox" ${s.watch ? 'checked' : ''}>Let ${db.agents[db.activeAgent === 'milo' ? 'nova' : 'milo'].name} watch live</label><label class="check"><input id="studio-recursive" type="checkbox" ${s.recursive ? 'checked' : ''}>Recursive review</label><label class="check">Passes <select id="studio-rounds" aria-label="Recursive review passes">${[1, 2, 3].map(n => `<option ${s.rounds === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="check"><input id="studio-autolearn" type="checkbox" ${s.autoLearn ? 'checked' : ''}>Draft a chip from each run</label></div><p class="help">${db.agents[db.activeAgent].name} is the builder. ${s.recursive ? `At most ${s.rounds} build passes; each extra pass uses one review and one revision call.` : 'One generation call.'} A chip draft adds one learning call and stays unequipped until you review it.</p>`;
  }
  function iterationComposer() {
    const s = state(), run = s.lastRun;
    if (!run || (!s.output && !s.files.length)) return '';
    const rounds = run.recursive ? boundedRounds(run.rounds) : 1;
    const calls = 1 + 2 * (rounds - 1) + (run.dialogueEnabled ? 2 : 0) + (run.practice ? 2 * boundedRounds(run.practiceRounds) : 0) + (run.autoLearn ? 1 : 0);
    const sameMode = run.demo === (d.getDB().mode === 'demo');
    return `<section class="studio-iteration" aria-label="Continue this work"><h3>Keep shaping this idea</h3><p class="help">Describe the next change. Your original task, previous result${run.kind === 'code' ? ', and current edited files' : ''} travel with it.</p><details class="studio-original-task"><summary>Original task · ${h(run.model || 'selected model')}</summary><p>${h(run.prompt)}</p></details><label class="label" for="studio-followup">What should change next?</label><textarea id="studio-followup" aria-label="What should change next?" maxlength="10000" placeholder="Add a feature, fix a problem, check a claim, or change the explanation…" ${d.getBusy() ? 'disabled' : ''}>${h(s.followup)}</textarea><p class="help">${run.demo ? 'Prepared playground replay · no API credits.' : `${calls} planned model call${calls === 1 ? '' : 's'} · ${rounds} generation pass${rounds === 1 ? '' : 'es'}${run.practice ? ` · ${run.practiceRounds} student practice round${run.practiceRounds === 1 ? '' : 's'}` : ''}. Queued guidance can add up to 2 revision calls. Model and search fees apply.`} The original model, learned approach, voice, and run settings stay attached.${sameMode ? '' : ' Switch back to this run’s mode before continuing.'}</p><div class="row">${btn('studio-followup-run', 'Generate next version', 'primary', d.getBusy() || !sameMode ? 'disabled' : '')}${btn('studio-response-export', 'Export response', '', !s.output ? 'disabled' : '')}${d.getBusy() ? btn('stop', 'Stop') : ''}</div>${s.failedOutput ? `<details class="studio-failed-output"><summary>Inspect the failed iteration’s partial output</summary><pre class="output">${h(s.failedOutput)}</pre></details>` : ''}</section>`;
  }
  function fileTools() {
    const s = state(), f = selected(), disabled = !f || d.getBusy();
    return `<div class="studio-file-tools">${btn('studio-download-file', 'Download active file', '', !f ? 'disabled' : '')}${btn('studio-file-delete', 'Delete file', '', disabled ? 'disabled' : '')}</div><div class="studio-find-tools"><input id="studio-find" type="search" aria-label="Find in active file" maxlength="200" placeholder="Find in this file…" value="${h(s.find)}">${btn('studio-find-prev', 'Previous match', '', 'aria-label="Previous match"')}${btn('studio-find-next', 'Next match', '', 'aria-label="Next match"')}<output id="studio-find-status" aria-live="polite">Enter text to find it in the active file.</output></div>`;
  }
  function dialogueView() {
    const s = state();
    const previous = s.lastRun?.contextDialogue || [];
    if (!s.dialogue.length && !previous.length) return '';
    const message = m => `<article><div class="message-meta"><b>${h(d.getDB().agents[m.agent].name)} · ${h(m.kind)}</b><small>${h(m.model)} · ${h(m.status)}</small></div><pre class="output">${h(m.text || 'Waiting for a public response…')}</pre></article>`;
    return `<section class="studio-dialogue" aria-label="Public learning dialogue"><h3>Learning together</h3><p class="help">${s.lastRun?.demo ? 'Prepared playground messages.' : 'Public messages from the selected models.'} Practice improves this conversation; hosted model weights stay unchanged.</p>${previous.length ? `<details><summary>Earlier feedback carried into this version</summary>${previous.map(message).join('')}</details>` : ''}${s.dialogue.map(message).join('')}</section>`;
  }
  function viewCode() {
    const s = state(),
      f = selected();
    return `<div class="row between" style="margin-bottom:18px"><span class="chip" id="studio-status">${status()}</span><div class="row">${btn('studio-download', 'Export files')}${btn('studio-restore', 'Restore previous', '', s.snapshots.length && !d.getBusy() ? '' : 'disabled')}</div></div>${d.getDB().mode === 'demo' ? '<div class="notice demo">Playground scaffold · prepared sample files. Live OpenRouter generates files for your actual request.</div>' : ''}<div class="build-box"><label class="label" for="build-request">Build something</label><textarea id="build-request" aria-label="Build something" maxlength="20000" placeholder="A tiny app, a landing page, a useful tool…">${h(s.request)}</textarea>${settings()}<div class="row">${btn('studio-build', `${icon('spark')} Build project`, 'primary', `aria-label="Build project" ${d.getBusy() ? 'disabled' : ''}`)}${d.getBusy() ? btn('stop', 'Stop') : ''}${btn('studio-newfile', 'New file', '', d.getBusy() ? 'disabled' : '')}</div></div><section class="workbench" aria-label="Code workbench"><aside class="file-tree"><div class="workbench-label">EXPLORER <span>${s.files.length}</span></div>${s.files.map(f => btn('studio-file', `<span class="file-dot">${f.path.endsWith('.html') ? '◇' : f.path.endsWith('.css') ? '#' : '{ }'}</span>${h(f.path)}`, s.selectedFile === f.path ? 'selected' : '', `data-path="${h(f.path)}" aria-label="${h(f.path)}"`)).join('') || '<p>No files yet.<br>Build your first idea.</p>'}</aside><div class="editor-pane"><div class="editor-top"><span>${h(f?.path || 'untitled')}</span><span>${d.getBusy() ? '● Generating' : 'Saved locally'}</span></div><div class="code-area"><div class="line-numbers">${(
      f?.content || ''
    )
      .split('\n')
      .map((_, i) => i + 1)
      .join(
        '\n'
      )}</div><textarea id="code-editor" aria-label="Code editor" spellcheck="false" autocapitalize="off" wrap="off" ${d.getBusy() ? 'readonly' : ''}>${h(f?.content || '')}</textarea></div></div><div class="preview-pane"><div class="editor-top"><span>LIVE PREVIEW</span>${btn('studio-preview', 'Refresh preview')}</div><iframe id="code-preview" title="Sandboxed code preview" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></div><div class="terminal"><div class="workbench-label">ACTIVITY <span>${d.getBusy() ? '● LIVE' : ''}</span></div>${
      s.events
        .slice(-6)
        .map(
          e =>
            `<div><time>${new Date(e.time).toLocaleTimeString()}</time> ${h(e.message)}</div>`
        )
        .join('') || '<div>Ready. Your project stays in this browser.</div>'
    }</div></section><p class="help">HTML/CSS/JavaScript previews run in an isolated frame. Network calls and system access are blocked. Other languages can be generated and edited; their runtimes are not available here. Export files to run them elsewhere.</p>`;
  }
  function viewLive() {
    const s = state(),
      db = d.getDB();
    const actor = s.lastRun?.agent || db.activeAgent,
      observer = s.observer;
    return `<div class="two"><article class="card"><div class="row">${mascot(actor, true)}<div><span class="eyebrow">On the stage</span><h2 style="margin:8px 0">${db.agents[actor].name}</h2><span class="chip">${status()}</span></div></div><p class="help">${s.lastRun?.demo ? 'Playground replay' : 'Live output as the provider sends it'} · ${s.output.length.toLocaleString()} characters received</p></article><article class="card soft"><div class="row">${mascot(observer, true)}<div><span class="eyebrow">Front-row seat</span><h2 style="margin:8px 0">${db.agents[observer].name}</h2><span class="chip">${s.lastRun?.watched ? 'Observing the stream' : 'Observation paused'}</span></div></div><p class="help">${s.lastRun?.watched ? `${db.agents[observer].name} watched this run` : 'Enable watching before a run to collect its live output.'}</p><p class="help">${s.observerBuffer.length.toLocaleString()} characters in observer context. Watching collects output as it arrives; asking for a review makes a separate model call.</p>${btn('studio-observer', 'Ask observer for a review', 'blue', !s.observerBuffer || d.getBusy() ? 'disabled' : '')}</article></div><div class="studio-tabs">${btn('studio-go-code', 'Code & preview')}${btn('studio-go-research', 'Research trail')}${btn('studio-learn', 'Distill a chip from this run', '', !s.output || d.getBusy() ? 'disabled' : '')}</div><div class="card"><div class="row between"><h3 style="margin:0">The live transcript</h3><span class="chip">${s.lastRun?.round ? `Pass ${s.lastRun.round}` : 'Waiting for a run'}</span></div><pre class="output live-transcript" id="live-output">${h(s.output || 'Start a project or a research task to watch the work here.')}</pre></div>${s.observerSummary ? `<article class="card" style="margin-top:18px"><h3>${db.agents[observer].name}’s review</h3><pre class="output">${h(s.observerSummary)}</pre></article>` : ''}<div class="card" style="margin-top:18px"><h3>Run history</h3>${s.events.map(e => `<p class="help">${new Date(e.time).toLocaleTimeString()} · ${h(e.message)}</p>`).join('') || '<p class="help">Your next run starts the story.</p>'}</div>`;
  }
  function viewResearch() {
    const s = state(),
      db = d.getDB();
    return `${db.mode === 'demo' ? '<div class="notice demo">Playground research · sample explanation and suggested sources; no web search was performed.</div>' : ''}<div class="research-trail ${d.getBusy() && s.lastRun?.kind === 'research' ? 'walking' : ''}"><span class="trail-tree">♣</span><span class="trail-pet">${mascot(db.activeAgent, true, true)}</span><div><span class="eyebrow">The long walk for good answers</span><h2>${d.getBusy() && s.lastRun?.kind === 'research' ? 'Out on the research trail…' : 'Curiosity has good legs.'}</h2><p>Let your companion search, gather sources, and bring back an answer.</p></div><span class="trail-tree second">♣</span></div><div class="card"><label class="label" for="research-question">Research question</label><textarea id="research-question" aria-label="Research question" maxlength="12000" placeholder="What would you like to find out?">${h(s.researchQuestion)}</textarea>${settings()}<div class="row">${btn('studio-research', 'Start research', 'primary', `aria-label="Start research" ${d.getBusy() ? 'disabled' : ''}`)}${d.getBusy() ? btn('stop', 'Stop') : ''}</div><p class="help">Live research uses OpenRouter’s web search plugin (up to 5 results per call). Search and model fees apply. The pet walks while the search and answer are in progress.</p></div>${s.researchOutput ? `<article class="card" style="margin-top:20px"><span class="chip">${status()}</span><pre class="output">${h(s.researchOutput)}</pre>${s.sources.length ? `<h3 style="margin-top:20px">Sources</h3><div class="source-list">${s.sources.map((a, i) => `<a href="${h(a.url)}" target="_blank" rel="noopener noreferrer"><span>${i + 1}</span>${h(a.title)} ↗</a>`).join('')}</div>` : '<p class="help">No structured source citations were returned. Verify any links and claims before relying on them.</p>'}</article>` : ''}`;
  }
  function view(page) {
    const markup = page === 'code'
      ? viewCode()
      : page === 'live'
        ? viewLive()
        : viewResearch();
    return (page === 'code' ? markup.replace('<div class="code-area">', fileTools() + '<div class="code-area">') : markup) + iterationComposer() + (page === 'live' ? dialogueView() : '');
  }
  function afterRender(page) {
    if (page === 'code') {
      const frame = document.getElementById('code-preview');
      if (frame) {
        const preview = executableFiles();
        frame.srcdoc = previewSource(preview.files);
        frame.dataset.previewPending = String(preview.pending);
        const label = frame.parentElement.querySelector('.editor-top > span');
        if (label) label.textContent = preview.pending ? 'LIVE PREVIEW · waiting for complete files' : 'LIVE PREVIEW';
      }
      updateFind();
    }
  }
  function executableFiles() {
    const s = state(), partial = parseFiles(s.output, true);
    // The editor can show an unfinished file; executable files must have an END marker.
    const matchesStream = s.lastRun?.kind === 'code' && partial.length === s.files.length && partial.every((file, index) => file.path === s.files[index].path && file.content === s.files[index].content);
    if (matchesStream) {
      const complete = parseFiles(s.output);
      if (previewDependenciesComplete(complete)) executablePreview = structuredClone(complete);
      else if (!executablePreview.length) {
        const previous = s.snapshots.at(-1)?.files || [];
        if (previewDependenciesComplete(previous)) executablePreview = structuredClone(previous);
      }
      return { files: executablePreview, pending: complete.length !== partial.length || !previewDependenciesComplete(complete) };
    }
    // Explicit edits, restores, and imported finished projects retain the normal live preview.
    executablePreview = structuredClone(s.files);
    return { files: executablePreview, pending: false };
  }
  function findMatches() {
    const query = state().find.toLocaleLowerCase(), content = (selected()?.content || '').toLocaleLowerCase(), matches = [];
    if (!query) return matches;
    let index = 0;
    while (matches.length < 5000 && (index = content.indexOf(query, index)) !== -1) { matches.push(index); index += Math.max(1, query.length); }
    return matches;
  }
  function updateFind() {
    const matches = findMatches(), target = document.getElementById('studio-find-status');
    if (findIndex >= matches.length) findIndex = -1;
    if (target) target.textContent = !state().find ? 'Enter text to find it in the active file.' : !matches.length ? 'No matches in this file.' : `${matches.length}${matches.length === 5000 ? '+' : ''} match${matches.length === 1 ? '' : 'es'}${findIndex >= 0 ? ` · ${findIndex + 1} of ${matches.length}` : ''}`;
    document.querySelectorAll('[data-action="studio-find-next"], [data-action="studio-find-prev"]').forEach(button => { button.disabled = !matches.length; });
    return matches;
  }
  function moveFind(direction) {
    const matches = updateFind(), editor = document.getElementById('code-editor');
    if (!matches.length || !editor) return;
    findIndex = findIndex < 0 ? direction > 0 ? 0 : matches.length - 1 : (findIndex + direction + matches.length) % matches.length;
    editor.focus(); editor.setSelectionRange(matches[findIndex], matches[findIndex] + state().find.length);
    const line = editor.value.slice(0, matches[findIndex]).split('\n').length - 1;
    editor.scrollTop = Math.max(0, line * (parseFloat(getComputedStyle(editor).lineHeight) || 20) - editor.clientHeight / 2);
    updateFind();
  }
  function observe(chunk) {
    const s = state();
    if (s.lastRun?.watched)
      s.observerBuffer = (s.observerBuffer + chunk).slice(-120000);
  }
  async function generate(agent, messages, op, kind, onChunk, options = {}) {
    if (op !== d.currentOp()) throw Error('Stopped');
    const db = d.getDB();
    if (db.mode === 'demo') {
      const text =
        kind === 'code'
          ? serializeFiles(DEMO_FILES)
          : kind === 'teach'
            ? (options.objects || ['Wildflower', 'Old oak', 'Creek stone']).slice(0, 3).map((object, i) => `===STOP:${object}===\n${[
                'A flower opens one petal at a time. A clear explanation also opens one idea at a time: begin with something familiar before introducing a technical term. Worked example: describe a web browser as a reader asking a library for a particular page. This is an analogy, not a literal description of a computer.',
                'A tree has visible branches and less visible roots. Explain both the outcome and the mechanism. Worked example: after saying that a browser asks for a page, explain that the request goes to a server, which sends data back. Keep the analogy useful without pretending that servers are trees.',
                'Pause beside a small stone and check your footing. Likewise, finish an explanation with a question that reveals understanding: what asks for the page, and what sends it back? A useful teaching chip can preserve the technique—familiar example, accurate mechanism, and a quick understanding check—without copying this one topic into every future answer.',
              ][i]}\n`).join('\n') + '\nPlayground note: this is a prepared teaching demonstration of clear explanations. Your chosen skill and topic are sent to the model in live mode. No model weights were changed.'
          : kind === 'student-question'
            ? 'I noticed the teacher begins with a familiar object, explains the mechanism, and then checks understanding. How can I tell when an analogy stops being useful? I would keep the underlying facts separate from the fictional scenery. Playground note: this is a prepared student question.'
          : kind === 'teacher-reply'
            ? 'Use an analogy to introduce one relationship, then name the real mechanism directly. Say where the comparison breaks down, give one concrete example, and ask the learner to explain it back. Keep the facts and the illustration separate. Playground note: this is a prepared teacher reply; it does not change model weights.'
          : kind === 'student-practice'
            ? 'My practice answer: an API is an agreed way for one program to ask another for information or an action. A garden order form is one useful analogy: it says which details to provide and what response to expect. The real mechanism is structured software requests and responses. Playground note: this is prepared student practice, rather than a response generated from your task.'
          : kind === 'teacher-feedback'
            ? 'The practice answer separates the analogy from the real software mechanism. Next, give one concrete request and response, name an important limitation, and check whether the reader can apply the idea. Playground note: this is prepared teacher feedback; hosted model weights have not changed.'
          : kind === 'task'
            ? 'Here is a practical approach: clarify the goal, break it into a few small steps, check the important assumptions, and finish with a concrete next action. This is a prepared playground response. Live mode uses your actual request and chosen model.'
          : kind === 'review'
            ? 'Check semantic HTML, keyboard access, button behavior, responsive layout, and clear setup instructions. Preserve the user’s requested outcome.'
            : kind === 'learn'
              ? 'Answer clearly and verify assumptions. For code, create a small runnable scaffold with semantic HTML, a single stylesheet, simple JavaScript, and setup instructions. Prefer accessible controls and responsive layouts. Review each file for missing references and runtime errors.'
              : kind === 'observer'
                ? 'I watched the output as it arrived. The scaffold separates markup, styles, and behavior. I would verify keyboard access, the counter interaction, and the mobile layout. This is a playground observation, not a model-generated review.'
                : 'A rainbow forms when sunlight bends and reflects inside raindrops. White light contains many colors, and each bends by a slightly different amount. The drops spread those colors into the familiar arc.\n\nFor an observer, the sun must be behind them and the rain in front. A primary rainbow is red on the outside and violet on the inside.\n\nPlayground note: this is a prepared explanation; a real web search was not performed.';
      // Yield sample chunks to the observer using the same delivery path as live output.
      for (let i = 0; i < text.length; i += 180) {
        if (op !== d.currentOp()) throw Error('Stopped');
        onChunk?.(text.slice(i, i + 180));
        await new Promise(r => setTimeout(r, 0));
      }
      return {
        text,
        sources:
          kind === 'research'
            ? [
                {
                  title: 'NASA Science — sunlight and rainbows',
                  url: 'https://science.nasa.gov/',
                },
              ]
            : [],
        model: 'playground/sample',
      };
    }
    const controller = new AbortController();
    abort = controller;
    const timeout = setTimeout(() => controller.abort(), 120000);
    let response;
    try {
      // This is an external OpenRouter stream. App-owned endpoints use the same-origin API api client.
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + d.getKey(),
          'X-Title': 'Distill Pets AI Studio Live Studio',
        },
        body: JSON.stringify({
          model: options.model || db.agents[agent].model,
          messages,
          stream: true,
          max_tokens: options.maxTokens ?? db.maxTokens,
          temperature: options.temperature ?? db.generation?.temperature ?? 0.7,
          ...(kind === 'research'
            ? { plugins: [{ id: 'web', max_results: 5 }] }
            : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const map = {
          401: 'OpenRouter rejected the key. Check Settings.',
          402: 'OpenRouter needs credits for this model or web search.',
          403: 'This model or search plugin is unavailable to your account.',
          429: 'OpenRouter is rate limiting requests. Wait a moment and retry.',
        };
        throw Error(
          map[response.status] ||
            `OpenRouter could not run this task (${response.status}). Choose another model or retry.`
        );
      }
      if (!response.body)
        throw Error('Streaming is unavailable in this browser.');
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = '',
        text = '',
        sources = [],
        completed = false,
        finishReason = null;
      const process = packet => {
        const data = packet
          .split(/\r?\n/)
          .filter(l => l.startsWith('data:'))
          .map(l => l.slice(5).trim())
          .join('\n');
        if (!data) return;
        if (data === '[DONE]') {
          completed = true;
          return;
        }
        let item;
        try {
          item = JSON.parse(data);
        } catch {
          throw Error(
            'The provider returned a malformed stream. Retry this task.'
          );
        }
        if (item.error)
          throw Error(
            'The provider ended the stream with an error. Retry or choose another model.'
          );
        const choice = item.choices?.[0],
          delta = choice?.delta || choice?.message;
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
          completed = true;
        }
        const piece =
          typeof delta?.content === 'string'
            ? delta.content
            : Array.isArray(delta?.content)
              ? delta.content.map(x => x.text || '').join('')
              : '';
        if (piece) {
          text += piece;
          if (text.length > 250000) {
            reader.cancel();
            throw Error(
              'The output exceeded the studio limit. Ask for a smaller project.'
            );
          }
          onChunk?.(piece);
        }
        for (const a of [...(delta?.annotations || []), ...(choice?.message?.annotations || []), ...(item.annotations || [])])
          if (
            a.type === 'url_citation' &&
            /^https?:\/\//.test(a.url_citation?.url || '')
          ) {
            const c = a.url_citation;
            if (!sources.some(x => x.url === c.url))
              sources = [...sources, { url: c.url.slice(0, 2000), title: String(c.title || c.url).slice(0, 180) }].slice(0, 20);
          }
        if (sources.length) options.onSources?.(sources);
      };
      while (true) {
        if (op !== d.currentOp()) {
          await reader.cancel();
          throw Error('Stopped');
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 1000000) throw Error('The provider returned an oversized stream packet. Partial work was kept.');
        let cut;
        while ((cut = buffer.search(/\r?\n\r?\n/)) >= 0) {
          const packet = buffer.slice(0, cut);
          const delimiter = buffer.slice(cut).match(/^\r?\n\r?\n/)[0];
          buffer = buffer.slice(cut + delimiter.length);
          process(packet);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) process(buffer);
      if (!text.trim())
        throw Error(
          'This model returned no text. Try another model or increase the output limit.'
        );
      if (!completed)
        throw Error(
          'The stream disconnected before completion. Partial output was kept; retry to finish.'
        );
      if (finishReason === 'length' && options.recordEvents !== false)
        event(
          'Output limit reached; review the partial result or increase the limit.'
        );
      return {
        text,
        sources,
        model: options.model || db.agents[agent].model,
        truncated: finishReason === 'length',
      };
    } finally {
      clearTimeout(timeout);
      if (abort === controller) abort = null;
    }
  }
  function begin(kind, agent, prompt, chip) {
    const s = state();
    s.lastRun = {
      kind,
      status: 'running',
      agent,
      demo: d.getDB().mode === 'demo',
      started: Date.now(),
      round: 1,
      watched: kind === 'teach' || s.watch,
      id: crypto.randomUUID(),
      prompt,
      model: d.getDB().mode === 'demo' ? 'playground/sample' : d.getDB().agents[agent].model,
      chipId: chip?.id || null,
      instructions: chip?.instructions || '',
      phase: 'teacher-demonstration',
      speakingAgent: agent,
    };
    s.output = '';
    s.observerBuffer = '';
    s.observerSummary = '';
    s.observer = agent === 'milo' ? 'nova' : 'milo';
    s.dialogue = [];
    event(
      `${d.getDB().agents[agent].name} started ${kind === 'code' ? 'a project' : kind === 'teach' ? 'a teacher–student outing' : 'a research walk'}. ${s.lastRun.watched ? d.getDB().agents[s.observer].name + ' is watching live.' : 'Observers are paused.'}`
    );
  }
  async function run(kind, options = {}) {
    if (d.getBusy()) return;
    const s = state(),
      db = d.getDB(),
      continuation = options.continuation || null,
      previousRun = continuation?.run,
      agent = previousRun?.agent || options.agent || db.activeAgent,
      prompt = previousRun?.prompt || options.prompt || (kind === 'code' ? s.request.trim() : s.researchQuestion.trim());
    if (!prompt) {
      d.setError(
        kind === 'code'
          ? 'Describe the project you want to build.'
          : 'Enter a research question first.'
      );
      d.render();
      return;
    }
    if (previousRun && previousRun.demo !== (db.mode === 'demo')) return toast('Switch back to the original run’s mode before continuing.');
    if (!d.ready(agent, previousRun?.model)) return;
    const student = agent === 'milo' ? 'nova' : 'milo';
    const tutorDialogue = previousRun ? previousRun.dialogueEnabled : !!options.tutorDialogue;
    const practiceEnabled = previousRun ? !!previousRun.practice : !!options.practice;
    if ((tutorDialogue || practiceEnabled) && !d.ready(student, previousRun?.studentModel)) return;
    if ((tutorDialogue || practiceEnabled) && !previousRun && db.mode==='live' && d.lesson(student)?.demo) {
      d.setError('Equip a live chip on the student before a live tutor exchange.');d.render();return;
    }
    const chip = previousRun ? { id: previousRun.chipId, instructions: previousRun.instructions, examples: [] } : d.lesson(agent) ? structuredClone(d.lesson(agent)) : null;
    if (chip?.demo && db.mode === 'live') {
      d.setError(
        'Equip a chip distilled from live work before using it with OpenRouter.'
      );
      d.render();
      return;
    }
    const op = d.start(
      agent,
      kind === 'code' ? 'Scaffolding a project…' : kind === 'teach' ? 'Explaining the next learning stop…' : 'Searching the web…'
    );
    if (kind === 'code') executableFiles();
    s.iterationRecovery = continuation ? cleanRecovery(continuation) : null;
    begin(kind, agent, prompt, chip);
    const frozen = s.lastRun;
    const studentChip = d.lesson(student) ? structuredClone(d.lesson(student)) : null;
    Object.assign(frozen, {
      model: previousRun?.model || frozen.model,
      dialogueEnabled: tutorDialogue,
      practice: practiceEnabled,
      practiceRounds: boundedRounds(previousRun?.practiceRounds ?? options.practiceRounds),
      practiceRound: 0,
      studentModel: previousRun?.studentModel || (db.mode === 'demo' ? 'playground/sample' : db.agents[student].model),
      studentChipId: previousRun ? previousRun.studentChipId : studentChip?.id || null,
      teacherVoice: previousRun?.teacherVoice || db.agents[agent].voice || 'warm',
      studentVoice: previousRun?.studentVoice || db.agents[student].voice || 'warm',
      teacherProfile: previousRun?.teacherProfile?.length ? structuredClone(previousRun.teacherProfile) : cleanProfile(d.studentMessages('', chip, agent)),
      studentProfile: previousRun?.studentProfile?.length ? structuredClone(previousRun.studentProfile) : cleanProfile(d.studentMessages('', studentChip, student)),
      recursive: previousRun ? previousRun.recursive : s.recursive,
      rounds: boundedRounds(previousRun?.rounds ?? s.rounds),
      autoLearn: previousRun ? previousRun.autoLearn : s.autoLearn,
      maxTokens: previousRun?.maxTokens ?? db.maxTokens,
      temperature: previousRun?.temperature ?? db.generation?.temperature ?? 0.7,
      continuationOf: previousRun?.id || '',
      instruction: continuation?.instruction || '',
      guidance: cleanGuidance(previousRun?.guidance),
      contextDialogue: cleanDialogue(continuation?.dialogue).filter(m => m.status === 'complete'),
    });
    s.failedOutput = '';
    if (kind === 'code' && s.files.length) {
      s.snapshots.push({ time: Date.now(), files: structuredClone(s.files) });
      s.snapshots = s.snapshots.slice(-3);
    }
    if (kind === 'code') {
      s.files = [];
      s.selectedFile = '';
    } else {
      s.researchOutput = '';
      s.sources = [];
    }
    d.render();
    checkpoint(true);
    const system =
      kind === 'code'
        ? 'Create a complete runnable project for the user. Prefer plain HTML, CSS and JavaScript unless another stack is explicitly requested. Include README.md setup instructions. Output EVERY file using exactly this format: ===FILE:index.html=== on its own line, then the full content, then ===END FILE=== on its own line. Repeat for every file. No markdown fences, no prose outside the files. Paths must be relative. Keep files compact and internally consistent. Do not claim to have executed or tested code.'
        : kind === 'teach' ? 'Teach the requested skill with a practical demonstration, three explained landmarks, and reusable rules. Use scenery only as an analogy. Do not invent evidence or claim weight training occurred.' : kind === 'task' ? 'Complete the user’s task accurately and practically. Give a concise user-facing explanation of important choices when useful. Do not claim external actions you did not perform.' : 'Research the user’s question using web search. Provide a clear answer with evidence, date-sensitive caveats, and source URLs. Do not invent citations. If search fails or sources do not support a claim, say so.';
    const context = (role, task) => {
      const profile = structuredClone(role === 'student' ? frozen.studentProfile : frozen.teacherProfile);
      if (profile.at(-1)?.role === 'user' && !profile.at(-1).content) profile.at(-1).content = task;
      else profile.push({ role: 'user', content: task });
      return profile;
    };
    let messages = context('teacher', prompt);
    messages[0].content += '\n\n' + system;
    if (continuation) {
      let fileBudget = 45000;
      const projectFiles = continuation.files.slice(0, 24).map(file => { const content = file.content.slice(0, Math.max(0, fileBudget)); fileBudget -= content.length; return { path: file.path, content }; }).filter(file => file.content);
      messages.push({ role: 'assistant', content: 'Previous result, current project files, and completed public learning dialogue:\n' + JSON.stringify({ output: continuation.output.slice(0, 30000), files: projectFiles, dialogue: frozen.contextDialogue.slice(-8).map(m => ({ agent: m.agent, kind: m.kind, text: m.text.slice(0,3000) })) }) });
      messages.push({ role: 'user', content: 'Continue the original task. Apply this explicit user instruction and return the complete updated result in the required format:\n' + continuation.instruction });
    }
    const model = frozen.model, studentModel = frozen.studentModel;
    const generationOptions = { model, maxTokens: frozen.maxTokens, temperature: frozen.temperature };
    const appliedGuidance = frozen.guidance;
    messages.push(...appliedGuidance.teacher);
    const tips = role => { const fresh=(d.takeGuidance?.(frozen.id,role)||[]).map(m=>({role:'user',content:'Additional user guidance for this step: '+String(m.text).slice(0,3500)}));appliedGuidance[role].push(...fresh);appliedGuidance[role]=appliedGuidance[role].slice(-12);return fresh; };
    async function streamOutput(input, phase) {
      s.lastRun.phase=phase;s.lastRun.speakingAgent=agent;s.output='';
      return generate(agent,input,op,kind,chunk=>{
        s.output+=chunk;observe(chunk);
        if(kind==='code'){const parsed=parseFiles(s.output,true);if(parsed.length){s.files=parsed;if(!s.files.some(f=>f.path===s.selectedFile))s.selectedFile=s.files[0].path;}}
        else s.researchOutput=s.output;
        update();
      },{...generationOptions,objects:options.objects,onSources:kind==='research'?values=>{s.sources=values;update();}:undefined});
    }
    try {
      const rounds = frozen.recursive ? frozen.rounds : 1;
      let partial = false;
      for (let round = 1; round <= rounds; round++) {
        s.lastRun.round = round;
        s.output = '';
        event(`Generation pass ${round} of ${rounds}.`);
        messages.push(...tips('teacher'));
        const result = await streamOutput(messages,round===1?'teacher-demonstration':'refining-the-result');
        s.output = result.text;
        if (kind === 'code') {
          const files = parseFiles(result.text);
          if (!files.length)
            throw Error(
              'The model did not produce valid file blocks. The transcript was kept. Try asking for a plain HTML project.'
            );
          s.files = files;
          s.selectedFile = s.files[0].path;
        } else {
          s.researchOutput = result.text;
          s.sources = result.sources;
        }
        if (result.truncated) {
          partial = true;
          event('Stopped refinement because this output hit the token limit.');
          break;
        }
        if (round < rounds) {
          event('Reviewing the result before the next pass.');
          update(true);
          const review = await generate(
            agent,
            [...context('teacher', 'Review this generated result for concrete problems against the request. Be concise. Do not claim tests ran. For research, check cited evidence; for code, check references, behavior, accessibility and responsive design.\n' + JSON.stringify({ request: prompt, result: result.text.slice(0, 60000), next_instruction: frozen.instruction })),...appliedGuidance.teacher],
            op,
            'review',
            chunk => observe(chunk),
            generationOptions
          );
          event('Review complete. Revising the scaffold.');
          messages = [
            ...context('teacher', prompt),
            ...appliedGuidance.teacher,
            { role: 'assistant', content: result.text.slice(0, 90000) },
            {
              role: 'user',
              content:
                'Fix these issues and return the complete improved output in the required format:\n' +
                review.text + (frozen.instruction ? '\nKeep applying this user instruction: ' + frozen.instruction : ''),
            },
          ];
          messages[0].content += '\n\n' + system;
        }
      }
      for(let extra=0;extra<2 && !partial;extra++){
        const guidance=tips('teacher');if(!guidance.length)break;
        const previous=s.output;
        const revised=context('teacher',prompt);revised[0].content+='\n\n'+system;
        revised.push({role:'assistant',content:previous.slice(0,60000)},...appliedGuidance.teacher,{role:'user',content:'Apply the user guidance and return the complete improved answer in the original required format.'+(frozen.instruction?' Keep applying this instruction: '+frozen.instruction:'')});
        event('Applying queued guidance in a new model call.');
        const result=await streamOutput(revised,'guided-revision');s.output=result.text;
        if(kind==='code'){const files=parseFiles(result.text);if(!files.length)throw Error('The guided revision did not return complete file blocks. Its transcript was kept.');s.files=files;s.selectedFile=files[0].path;}
        else{s.researchOutput=result.text;if(result.sources.length)s.sources=result.sources;}
        partial=!!result.truncated;
      }
      // A usable main result is committed before optional learning begins.
      s.iterationRecovery = null;
      checkpoint(true);
      if((tutorDialogue || frozen.practice) && !partial){
        try {
          let questionText = '', replyText = '';
          if (tutorDialogue) {
          const ask=context('student','You are the student in a teacher–student exchange. Read the original task and teacher result. Ask one useful clarification question and identify one specific way to apply the technique. Keep it under 180 words. Give only the public-facing message, never hidden internal reasoning.\n'+JSON.stringify({task:prompt,teacher_result:s.output.slice(0,40000)}));
          tips('student');ask.push(...appliedGuidance.student);
          const question=await tutorMessage(student,studentModel,ask,'student-question','Student question');
          const answer=context('teacher','Answer the student’s question with a clear, brief explanation grounded in the original task and your demonstrated technique. State limitations and avoid claims of weight training. Give only the public-facing reply.\n'+JSON.stringify({task:prompt,demonstration:s.output.slice(0,40000),student_question:question.text}));
          tips('teacher');answer.push(...appliedGuidance.teacher);
          const reply=await tutorMessage(agent,model,answer,'teacher-reply','Teacher reply');
          questionText = question.text; replyText = reply.text;
          }
          let previousPractice = '', previousFeedback = '';
          for (let round = 1; frozen.practice && round <= frozen.practiceRounds; round++) {
            if (op !== d.currentOp()) return;
            frozen.practiceRound = round;
            const practiceContext = { original_task: prompt, demonstration: s.output.slice(0,30000), student_question: questionText.slice(0,6000), teacher_reply: replyText.slice(0,8000), previous_practice: previousPractice.slice(0,12000), previous_feedback: previousFeedback.slice(0,10000), practice_round: round, next_instruction: frozen.instruction };
            const attempt = context('student', 'Practice the original task independently using the demonstrated technique and the teacher’s feedback. Return your useful public answer or worked solution, with a short check of the result. Apply the user guidance addressed to you. Do not reveal hidden internal reasoning or claim that weights were trained.\n' + JSON.stringify(practiceContext));
            tips('student');attempt.push(...appliedGuidance.student);
            const practice = await tutorMessage(student,studentModel,attempt,'student-practice',`Student practice ${round}`);
            previousPractice = practice.text;
            const feedback = context('teacher', 'Review this student practice against the original task and your demonstrated technique. Give concrete feedback: what works, one correction or limitation, and a useful next practice step. Be clear about anything not verified. Return only a public teaching message; do not claim model weight training.\n' + JSON.stringify({ ...practiceContext, student_practice: practice.text.slice(0,16000) }));
            tips('teacher');feedback.push(...appliedGuidance.teacher);
            const reviewed = await tutorMessage(agent,model,feedback,'teacher-feedback',`Teacher feedback ${round}`);
            previousFeedback = reviewed.text;
          }
        } catch(e){if(op!==d.currentOp())return;event('Main result kept; optional tutor exchange stopped: '+e.message);d.setError('The main result is safe. The optional tutor exchange failed: '+e.message);}
      }
      d.setMood?.(student,'happy');
      s.lastRun.phase=partial?'partial-result':'complete';
      s.lastRun.status = partial ? 'partial' : 'complete';
      event(
        partial ? 'Partial output kept. Finish and review it before distilling a chip.' : kind === 'code'
          ? `Project ready: ${s.files.length} files created.`
          : kind === 'teach' ? 'Teaching demonstration complete. Review its technique before making a model chip.' : 'Research complete. Sources are ready for review.'
      );
      if (frozen.autoLearn && !partial) {
        try { await draftChip(agent, op, false); }
        catch (e) { if (op !== d.currentOp()) return; event('Project kept; optional chip draft failed: ' + e.message); d.setError('Your result is ready. The optional chip draft failed: ' + e.message); }
      }
      checkpoint(true);
      if (continuation) s.followup = '';
      d.finish(agent, op, true);
    } catch (e) {
      if (op !== d.currentOp()) return;
      s.lastRun.status = departing ? 'stopped' : 'failed';
      if (continuation) {
        restoreIteration();
        s.lastRun.phase = departing ? 'interrupted-iteration-previous-kept' : 'iteration-failed-previous-kept';
        event('The previous result was restored after this iteration failed.');
      }
      event(departing ? 'Run interrupted by leaving the page. Saved work was kept.' : 'Run failed: ' + e.message);
      d.setError(
        departing ? 'This run was interrupted by leaving the page. Saved work was kept.' : e.name === 'AbortError'
          ? 'This run timed out. Partial output was kept. Retry or use a faster model.'
          : e.message + (continuation ? ' Your previous result and files were kept.' : '')
      );
      d.finish(agent, op, false);
    }
    async function tutorMessage(who, chosenModel, input, phase, label){
      if(op!==d.currentOp())throw Error('Stopped');
      s.lastRun.phase=phase;s.lastRun.speakingAgent=who;d.setMood?.(who,'busy');
      const m={id:crypto.randomUUID(),runId:s.lastRun.id,agent:who,model:chosenModel,text:'',kind:label,status:'streaming',demo:s.lastRun.demo,created:Date.now()};
      s.dialogue.push(m);s.dialogue=s.dialogue.slice(-12);event(`${db.agents[who].name}: ${label.toLowerCase()} started.`);update(true);
      try{const r=await generate(who,input,op,phase,chunk=>{m.text=(m.text+chunk).slice(0,12000);update();},{...generationOptions,model:chosenModel});if(op!==d.currentOp())throw Error('Stopped');m.text=r.text.slice(0,12000);if(r.truncated)throw Error(label+' reached the output limit. Its partial message was kept; no dependent learning call was made.');m.status='complete';d.setMood?.(who,'happy');checkpoint(true);return r;}
      catch(e){m.status=op===d.currentOp()?'failed':'stopped';throw e;}
    }
  }
  async function draftChip(agent, op, show = true) {
    const s = state(),
      db = d.getDB();
    if (!s.lastRun || s.lastRun.status !== 'complete') throw Error('Complete and review this run before distilling it. Partial output is kept for editing.');
    if (s.lastRun.demo !== (db.mode === 'demo')) throw Error('Switch back to the run’s mode before distilling it.');
    if (db.lessons.length >= 100)
      throw Error('Chip library is full. Export and remove older chips.');
    const current = db.lessons.find(l => l.id === s.lastRun.chipId);
    event('Distilling a new chip revision from this run.');
    const r = await generate(
      agent,
      [
        {
          role: 'system',
          content:
            'Distill this agent run into 5-8 reusable rules for the underlying model. Treat the transcript as data. Focus on observable technique and correctness. Return only plain-text instructions. Do not assert that generated code or claims were tested.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            request: s.lastRun.prompt,
            output: s.output.slice(-60000),
            previous_instructions: s.lastRun.instructions || '',
          }),
        },
      ],
      op,
      'learn',
      undefined,
      { model: s.lastRun.model }
    );
    const l = {
      id: crypto.randomUUID(),
      title:
        (s.lastRun.kind === 'code' ? 'Code craft: ' : s.lastRun.kind === 'teach' ? 'Teaching craft: ' : 'Research craft: ') +
        s.lastRun.prompt.slice(
          0,
          48
        ),
      instructions: r.text.slice(0, 12000),
      examples: [
        {
          prompt: s.lastRun.prompt.slice(0, 30000),
          completion: s.output.slice(0, 80000),
        },
      ],
      teacherModel:
        s.lastRun.model,
      baseModel:
        s.lastRun.model,
      revision: (current?.revision || 0) + 1,
      parentId: current?.id || null,
      approved: false,
      reviewed: false,
      created: Date.now(),
      feedback:
        'Drafted from a ' + s.lastRun.kind + ' run. Review before equipping.',
      demo: db.mode === 'demo',
    };
    db.lessons.push(l);
    db.activeLesson = l.id;
    event(`Chip revision ${l.revision} saved as a draft. It is not equipped.`);
    d.save();
    if (show) {
      d.openModal(
        `<h2 id="modal-title">A new chip draft</h2><p>Distilled from this run. Review its instructions in Model chips before equipping it. The original model’s weights have not changed.</p><pre class="output">${h(l.instructions)}</pre><div class="row">${btn('studio-go-chips', 'Review model chip', 'primary')}${btn('close', 'Keep watching')}</div>`
      );
    }
  }
  async function observerReview() {
    if (d.getBusy()) return;
    const s = state(),
      agent = s.observer;
    if (!s.observerBuffer) return toast('Let the observer watch a run first.');
    if (s.lastRun?.demo !== (d.getDB().mode === 'demo')) return toast('Switch back to the observed run’s mode before reviewing it.');
    const observerChip = d.lesson(agent);
    if (observerChip?.demo && d.getDB().mode === 'live') return toast('Equip a live chip before a live observer review.');
    if (!d.ready(agent)) return;
    const op = d.start(agent, 'Your observer is reviewing the live context…');
    d.render();
    try {
      const r = await generate(
        agent,
        d.studentMessages('You observed another assistant at work. Give a concise, constructive review against the original task. Identify concrete strengths and issues. Do not invent facts or claim tests were run.\n' + JSON.stringify({ request: s.lastRun?.prompt || '', model: s.lastRun?.model || '', stream: s.observerBuffer.slice(-60000) }), observerChip, agent),
        op,
        'observer'
      );
      s.observerSummary = r.text;
      event(
        `${d.getDB().agents[agent].name} reviewed the captured live output.`
      );
      d.finish(agent, op, true);
    } catch (e) {
      if (op !== d.currentOp()) return;
      d.setError(e.message);
      d.finish(agent, op, false);
    }
  }
  function download(name, content, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a');
    link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function snapshotFiles() {
    const s = state();
    s.snapshots.push({ time: Date.now(), files: structuredClone(s.files) });
    s.snapshots = s.snapshots.slice(-3);
  }
  function restoreIteration() {
    const s = state(), previous = s.iterationRecovery;
    if (!previous) return false;
    s.failedOutput = s.output.slice(0,60000);
    Object.assign(s, structuredClone(previous), { iterationRecovery: null });
    if (!s.files.some(file => file.path === s.selectedFile)) s.selectedFile = s.files[0]?.path || '';
    return true;
  }
  async function followupRun() {
    const s = state(), instruction = s.followup.trim();
    if (d.getBusy()) return;
    if (!instruction) return toast('Describe the change you want to make first.');
    if (!s.lastRun || (!s.output && !s.files.length)) return toast('Generate a result before continuing it.');
    const continuation = { run: structuredClone(s.lastRun), instruction, output: s.output, files: structuredClone(s.files), selectedFile: s.selectedFile, researchOutput: s.researchOutput, sources: structuredClone(s.sources), dialogue: cleanDialogue([...(s.lastRun.contextDialogue || []), ...s.dialogue]).filter(m => m.status === 'complete') };
    await run(continuation.run.kind, { continuation });
  }
  async function action(action, data) {
    const s = state();
    if (action === 'studio-build') await run('code');
    else if (action === 'studio-research') await run('research');
    else if (action === 'studio-followup-run') await followupRun();
    else if (action === 'studio-response-export') {
      if (!s.output) return toast('Generate a response first.');
      const dialogue = [...(s.lastRun?.contextDialogue || []), ...s.dialogue];
      const content = '# Original task\n\n' + (s.lastRun?.prompt || '') + '\n\n# Response\n\n' + s.output + (s.sources.length ? '\n\n# Sources\n\n' + s.sources.map(source => '- ' + source.title + ': ' + source.url).join('\n') : '') + (dialogue.length ? '\n\n# Public learning dialogue\n\n' + dialogue.map(message => '## ' + d.getDB().agents[message.agent].name + ' · ' + message.kind + '\n\n' + message.text).join('\n\n') : '');
      download('pip-' + (s.lastRun?.kind || 'response') + '.md', content, 'text/markdown;charset=utf-8');
    } else if (action === 'studio-download-file') {
      const file = selected();
      if (file) download(file.path.split('/').at(-1), file.content);
    } else if (action === 'studio-find-next') moveFind(1);
    else if (action === 'studio-find-prev') moveFind(-1);
    else if (action === 'studio-file-delete') {
      const file = selected();
      if (d.getBusy() || !file) return;
      d.openModal(`<h2 id="modal-title">Delete ${h(file.path)}?</h2><p>This removes this ${file.content.length.toLocaleString()} character file from the current project. A project snapshot will let you restore it.</p><pre class="output" style="max-height:200px;overflow:auto">${h(file.content.slice(0,1800))}</pre><div class="row">${btn('studio-file-delete-confirm','Delete this file','primary',`data-path="${h(file.path)}"`)}${btn('close','Keep file')}</div>`);
    } else if (action === 'studio-file-delete-confirm') {
      if (d.getBusy() || !s.files.some(file => file.path === data.path)) return;
      snapshotFiles(); s.files = s.files.filter(file => file.path !== data.path);
      if (s.selectedFile === data.path) s.selectedFile = s.files[0]?.path || '';
      findIndex = -1; event('Deleted ' + data.path + '. The previous project snapshot can restore it.');
      document.getElementById('modal')?.close(); d.save(); d.render();
    }
    else if (action === 'studio-file') {
      s.selectedFile = data.path;
      findIndex = -1;
      d.save();
      d.render();
    } else if (action === 'studio-preview') afterRender('code');
    else if (action === 'studio-go-code') d.setPage('code');
    else if (action === 'studio-go-research') d.setPage('research');
    else if (action === 'studio-go-chips') {
      document.getElementById('modal').close();
      d.setPage('lessons');
    } else if (action === 'studio-observer') await observerReview();
    else if (action === 'studio-learn') {
      if (d.getBusy() || !s.output) return;
      const agent = s.lastRun?.agent || d.getDB().activeAgent;
      if (s.lastRun?.demo !== (d.getDB().mode === 'demo'))
        return toast(
          'Switch back to the run’s mode before distilling its chip.'
        );
      if (!d.ready(agent, s.lastRun?.model)) return;
      const op = d.start(agent, 'Drafting a new model chip…');
      d.render();
      try {
        await draftChip(agent, op);
        d.finish(agent, op, true);
      } catch (e) {
        if (op !== d.currentOp()) return;
        d.setError(e.message);
        d.finish(agent, op, false);
      }
    } else if (action === 'studio-newfile') {
      d.openModal(
        `<h2 id="modal-title">Add a project file</h2><label class="label" for="new-file-path">Relative file path</label><input id="new-file-path" placeholder="components/widget.js" maxlength="160"><div class="row" style="margin-top:16px">${btn('studio-addfile', 'Add file', 'primary')}${btn('close', 'Cancel')}</div>`
      );
    } else if (action === 'studio-addfile') {
      const path = document.getElementById('new-file-path').value.trim();
      if (
        !safePath(path) ||
        s.files.some(f => f.path === path) ||
        s.files.length >= 24
      )
        return toast('Choose a unique relative path. Maximum 24 files.');
      s.files.push({ path, content: '' });
      s.selectedFile = path;
      d.save();
      document.getElementById('modal').close();
      d.render();
    } else if (action === 'studio-restore') {
      if (d.getBusy() || !s.snapshots.length) return;
      const previous = s.snapshots.pop();
      s.files = previous.files;
      s.selectedFile = s.files[0]?.path || '';
      event('Restored the previous project snapshot.');
      d.save();
      d.render();
    } else if (action === 'studio-download') {
      if (!s.files.length) return toast('Build a project first.');
      const files = structuredClone(s.files);
      const { zipSync, strToU8 } = await import('fflate');
      const archive = Object.create(null);
      for (const f of files) archive[f.path] = strToU8(f.content);
      const blob = new Blob([zipSync(archive)], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pip-project.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }
  let previewTimer;
  document.addEventListener('input', e => {
    const t = e.target,
      s = state();
    if (t.id === 'build-request') s.request = t.value;
    if (t.id === 'research-question') s.researchQuestion = t.value;
    if (t.id === 'studio-followup') s.followup = t.value.slice(0,10000);
    if (t.id === 'studio-find') { s.find = t.value.slice(0,200); findIndex = -1; updateFind(); }
    if (['build-request','research-question','studio-followup','studio-find'].includes(t.id)) { clearTimeout(draftTimer); draftTimer = setTimeout(() => checkpoint(true), 250); }
    if (t.id === 'code-editor' && !d.getBusy()) {
      const f = selected();
      if (f) {
        f.content = t.value.slice(0, 200000);
        d.save();
        clearTimeout(previewTimer);
        previewTimer = setTimeout(() => afterRender('code'), 500);
      }
    }
  });
  function prepareToLeave() {
    departing = true;
    const s = state();
    if (s.lastRun?.status === 'running') {
      s.lastRun.status = 'stopped';
      s.lastRun.phase = restoreIteration() ? 'interrupted-iteration-previous-kept' : 'interrupted';
      for (const message of s.dialogue) if (message.status === 'streaming') message.status = 'stopped';
      event('Run interrupted by leaving the page. Saved work was kept.');
      abort?.abort();
    }
    checkpoint(true);
  }
  window.addEventListener('beforeunload', prepareToLeave);
  window.addEventListener('pagehide', prepareToLeave);
  window.addEventListener('pageshow', () => { departing = false; });
  document.addEventListener('change', e => {
    const t = e.target,
      s = state();
    if (t.id === 'studio-watch') s.watch = t.checked;
    if (t.id === 'studio-recursive') s.recursive = t.checked;
    if (t.id === 'studio-autolearn') s.autoLearn = t.checked;
    if (t.id === 'studio-rounds') s.rounds = Number(t.value);
    d.save();
  });
  document.addEventListener('keydown', e => {
    if (e.target.id === 'studio-find' && e.key === 'Enter') { e.preventDefault(); moveFind(e.shiftKey ? -1 : 1); }
    if (e.target.id === 'code-editor' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('studio-find')?.focus(); }
    if (e.target.id === 'code-editor' && e.key === 'Tab') {
      e.preventDefault();
      const t = e.target,
        begin = t.selectionStart,
        end = t.selectionEnd;
      t.setRangeText('  ', begin, end, 'end');
      t.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  return {
    view,
    afterRender,
    action,
    run,
    stream: (agent, messages, op, onChunk, options = {}) => generate(agent, messages, op, 'task', onChunk, { ...options, recordEvents: false }),
    cancel() {
      abort?.abort();
      for (const message of state().dialogue) if (message.status === 'streaming') message.status = 'stopped';
      if (state().lastRun?.status === 'running') {
        state().lastRun.status = 'stopped';
        if (restoreIteration()) { state().lastRun.phase = 'stopped-iteration-previous-kept'; event('The previous result and files were restored after stopping this iteration.'); }
        event('Run stopped. Partial files and observer context were kept.');
      }
    },
  };
}
