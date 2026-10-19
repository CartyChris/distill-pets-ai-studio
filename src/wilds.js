const AGENTS = ['milo', 'nova'];
const KINDS = ['research', 'code', 'task', 'teach'];
const STATUSES = ['queued', 'running', 'complete', 'failed', 'stopped'];
const BIOMES = {
  meadow: { title: 'Wildflower grove', subtitle: 'A gentle nature walk', sky: '#e3f0fa', earth: '#ebefd9', objects: ['Wildflower', 'Old oak', 'Creek stone'], symbols: ['✿', '♧', '◒'] },
  archive: { title: 'Moonlit archive', subtitle: 'Stories, maps, and little discoveries', sky: '#d7d8f0', earth: '#e8e0ed', objects: ['Open book', 'Star map', 'Pocket clock'], symbols: ['▤', '✧', '◷'] },
  coast: { title: 'Crystal coast', subtitle: 'Small wonders beside the sea', sky: '#cef0f1', earth: '#f0e6c7', objects: ['Seashell', 'Tide pool', 'Lighthouse'], symbols: ['❋', '≈', '♜'] },
  workshop: { title: 'Mossy workshop', subtitle: 'Make, test, and mend together', sky: '#efdfca', earth: '#d8e3d0', objects: ['Turning gear', 'Tiny bridge', 'Glowing lantern'], symbols: ['⚙', '⌁', '♟'] },
};
const bound = (value, length) => typeof value === 'string' ? value.slice(0, length) : '';
const safeURL = value => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href.slice(0, 2000) : '';
  } catch { return ''; }
};
const agentID = value => value === 'nova' ? 'nova' : 'milo';
const uid = () => globalThis.crypto?.randomUUID?.() || `expedition-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const KINDS_INFO = {
  research: { label: 'Research trail', zone: 'library', noun: 'sources', icon: 'research', help: 'Search with the selected model and OpenRouter’s web search plugin. Sources appear when the provider returns citations.' },
  code: { label: 'Build expedition', zone: 'mountain', noun: 'files', icon: 'code', help: 'Generate real project files, watch the code arrive, then edit and preview in Code studio.' },
  task: { label: 'Idea gathering', zone: 'meadow', noun: 'answers', icon: 'workspace', help: 'Send a specific task to your chosen model. The completed answer comes home to Workspace.' },
  teach: { label: 'Teacher + apprentice', zone: 'meadow', noun: 'demonstrations', icon: 'lessons', help: 'A teacher demonstrates a skill. The other companion watches the actual output. Approve the demonstration to draft a reusable model chip.' },
};
const PRESETS = [
  { id: 'sources', kind: 'research', title: 'Forage for facts', detail: 'Bring home trustworthy sources', goal: 'Research three practical ways to save water at home. Find reliable sources, link them, and distinguish well-supported claims from uncertainty.' },
  { id: 'garden', kind: 'code', title: 'Build a tiny garden', detail: 'A useful little website', goal: 'Build a responsive single-page garden planner with a list of plants, add/remove controls, and a watering checklist. Use accessible HTML, CSS, and JavaScript with no external dependencies.' },
  { id: 'plan', kind: 'task', title: 'Gather a good plan', detail: 'Make a fuzzy idea actionable', goal: 'Create a realistic seven-day plan for a beginner to learn JavaScript. Include one small hands-on task each day, a way to check understanding, and a simple final project.' },
  { id: 'teach', kind: 'teach', title: 'Teach a clear explanation', detail: 'Take an apprentice along', goal: 'Demonstrate how to explain a technical concept to a curious twelve-year-old. Explain how the internet delivers a web page, use one concrete analogy, and finish with a short question that checks understanding.', skill: 'Explain technical ideas simply, accurately, and with a check for understanding.' },
];

/** Bounded, credential-free expedition history. A saved running record becomes interrupted. */
export function cleanWilds(value) {
  const base = { goal: '', skill: '', kind: 'research', agent: 'milo', biome: 'meadow', selected: '', tab: 'map', follow: true, records: [], care: { milo: 0, nova: 0 } };
  if (!value || typeof value !== 'object') return base;
  base.goal = bound(value.goal, 20000);
  base.skill = bound(value.skill, 2000);
  base.kind = KINDS.includes(value.kind) ? value.kind : 'research';
  base.agent = agentID(value.agent);
  base.biome = Object.hasOwn(BIOMES, value.biome) ? value.biome : 'meadow';
  base.tab = ['map', 'journal', 'inventory'].includes(value.tab) ? value.tab : 'map';
  base.follow = value.follow !== false;
  for (const id of AGENTS) base.care[id] = Math.min(999, Math.max(0, Number(value.care?.[id]) || 0));
  base.records = Array.isArray(value.records) ? value.records.slice(-24).filter(r => r && typeof r.id === 'string' && KINDS.includes(r.kind)).map(r => {
    const interrupted = ['queued', 'running'].includes(r.status);
    return {
      id: bound(r.id, 100), kind: r.kind, biome: Object.hasOwn(BIOMES, r.biome) ? r.biome : 'meadow', agent: agentID(r.agent), student: r.kind === 'teach' || ['milo','nova'].includes(r.student) ? agentID(r.student === r.agent ? (r.agent === 'milo' ? 'nova' : 'milo') : r.student) : null,
      prompt: bound(r.prompt, 20000), skill: bound(r.skill, 2000), demo: !!r.demo,
      model: bound(r.model, 200), status: interrupted ? 'stopped' : STATUSES.includes(r.status) ? r.status : 'stopped',
      started: Math.max(0, Number(r.started) || Date.now()), finished: Math.max(0, Number(r.finished) || 0),
      runId: bound(r.runId, 100), taskId: bound(r.taskId, 100), text: bound(r.text, 16000), chars: Math.max(0, Math.min(250000, Number(r.chars) || 0)),
      error: interrupted ? 'This outing was interrupted when the page closed. Its gathered material was kept.' : bound(r.error, 1000),
      resources: cleanResources(r.resources),
      events: Array.isArray(r.events) ? r.events.slice(-30).filter(e => typeof e?.message === 'string').map(e => ({ message: bound(e.message, 500), time: Number(e.time) || Date.now() })) : [],
      cheers: Math.min(999, Math.max(0, Number(r.cheers) || 0)),
      streaming: !!r.streaming,
      dialogue: Array.isArray(r.dialogue) ? r.dialogue.slice(-12).map(m=>({id:bound(m.id,80),runId:bound(m.runId,80),agent:agentID(m.agent),model:bound(m.model,200),text:bound(m.text,12000),kind:bound(m.kind,80),status:bound(m.status,20),demo:!!m.demo,created:Number(m.created)||Date.now()})) : [],
    };
  }) : [];
  base.selected = base.records.some(r => r.id === value.selected) ? value.selected : base.records.at(-1)?.id || '';
  return base;
}
function cleanResources(resources) {
  return Array.isArray(resources) ? resources.slice(0, 36).filter(r => r && ['source', 'file', 'answer', 'demonstration'].includes(r.kind)).map(r => ({
    id: bound(r.id, 220), kind: r.kind, title: bound(r.title, 180), url: r.kind === 'source' ? safeURL(r.url) : '',
    path: bound(r.path, 160), excerpt: bound(r.excerpt, 1800), size: Math.min(250000, Math.max(0, Number(r.size) || 0)),
  })).filter(r => r.kind !== 'source' || r.url) : [];
}

const STYLES = `<style>
.wilds { display:grid; gap:20px; min-width:0 }
.wilds p { overflow-wrap:anywhere }
.wilds-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px }
.wilds-head h2 { margin:0 0 4px; font-size:25px }
.wilds-head p { margin:0; color:var(--muted) }
.wilds-layout { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(260px,1fr); gap:20px; align-items:start }
.wilds-panel { background:var(--paper,var(--panel,#fff)); border:1px solid var(--line,#e7e2d6); border-radius:20px; padding:22px; min-width:0 }
.wilds-panel h3 { margin:0 0 10px; font-size:18px }
.wilds-mode { display:inline-flex; gap:6px; align-items:center; border-radius:99px; padding:6px 10px; font-size:12px; background:var(--paper2,#f5f0e4); font-weight:700 }
.wilds-mode.sample { color:var(--orange,#b06f26) }
.wilds-scene { position:relative; min-height:338px; overflow:hidden; background:linear-gradient(#e3f0fa 0%,#eff6f8 43%,#dfeacb 44%,#ebefd9 100%); border-radius:18px; isolation:isolate; color:#344346 }
.wilds-scene.night { background:linear-gradient(#263c56 0%,#435672 43%,#506453 44%,#677552 100%) }
.wilds-scenery { display:block; width:100%; height:338px; position:absolute; inset:0; pointer-events:none }
.wilds-biomes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin:12px 0 }
.wilds-biomes button { min-height:44px; padding:9px; border-radius:10px; font-size:12px; text-align:left }
.wilds-biomes button.active { border-color:var(--blue,#567bc2); background:var(--paper2,#edf2fc) }
.wilds-biomes small { display:block; font-size:10px; color:var(--muted); margin-top:3px }
.wilds-object { position:absolute; z-index:6; border:1px solid #fff8; background:#fff5; min-width:44px; min-height:44px; border-radius:50%; color:#677557; font-size:24px; display:grid; place-items:center; touch-action:manipulation }
.wilds-object:hover,.wilds-object:focus-visible { background:#fff9; transform:scale(1.08) }
.wilds-object[data-stop='0'] { left:34%; top:67% }
.wilds-object[data-stop='1'] { left:56%; top:57% }
.wilds-object[data-stop='2'] { right:10%; top:74% }
.wilds-stop-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; margin:12px 0 }
.wilds-stop-list button { min-height:44px; padding:8px; border-radius:10px; font-size:12px }
.wilds-cloud { position:absolute; left:12%; top:12%; width:62px; height:17px; border-radius:30px; background:#fff9; box-shadow:29px 12px 0 #fff8; pointer-events:none }
.wilds-cloud.second { left:70%; top:19%; width:42px; height:13px; box-shadow:19px 8px 0 #fff7 }
.wilds-zone { position:absolute; z-index:3; padding:4px 9px; min-height:44px; font:inherit; font-size:12px; font-weight:700; color:#3f4c42; background:#fffce8ed; border:1px solid #becaad; border-radius:12px; box-shadow:0 3px 0 #aebc9a26; touch-action:manipulation }
.wilds-zone:hover,.wilds-zone:focus-visible { transform:translateY(-2px); background:#fff }
.wilds-zone[data-zone='meadow'] { left:13%; top:53% }
.wilds-zone[data-zone='library'] { left:44%; top:28% }
.wilds-zone[data-zone='mountain'] { right:8%; top:47% }
.wilds-home { position:absolute; bottom:16px; left:18px; padding:7px 11px; background:#fffce8de; border:1px solid #c4c9b0; border-radius:12px; font-size:12px; font-weight:700 }
.wilds-walker { position:absolute; left:0; top:0; z-index:5; display:flex; flex-direction:column; align-items:center; transform:translate(-50%,-70%); border:0; padding:0; background:none; min-width:58px; min-height:68px; will-change:left,top; cursor:pointer; touch-action:manipulation }
.wilds-walker .mascot { pointer-events:none }
.wilds-walker .mascot .thought { display:none }
.wilds-pet-label { font-family:inherit; font-weight:700; font-size:11px; line-height:1.3; background:#fffc; color:#344346; border:1px solid #c8cec0; padding:3px 7px; border-radius:8px; margin-top:2px; max-width:150px }
.wilds-backpack { position:absolute; width:13px; height:17px; border-radius:5px; background:#d89546; border:2px solid #8c693c; left:10px; top:25px; transform:rotate(-8deg); pointer-events:none }
.wilds-backpack:after { content:''; position:absolute; left:1px; right:1px; bottom:1px; height:6px; border-top:1px solid #8c693c }
.wilds-particle { position:absolute; z-index:7; pointer-events:none; font-size:22px; opacity:0; transform:translateY(0) }
.wilds-scene-caption { margin:12px 0 0; color:var(--muted); font-size:13px; line-height:1.6 }
.wilds-tabs { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 }
.wilds-tabs button { min-height:44px; flex:1 1 auto; font-size:13px; border-radius:12px }
.wilds-tabs button.active { background:var(--blue,#567bc2); color:white; border-color:var(--blue,#567bc2) }
.wilds-form { display:grid; gap:13px }
.wilds-form label { font-weight:700; display:block; font-size:13px; margin-bottom:6px }
.wilds-form :is(select,input,textarea) { width:100%; min-width:0; box-sizing:border-box; font-size:16px; min-height:44px }
.wilds-form textarea { min-height:132px; resize:vertical; line-height:1.5 }
.wilds-field-row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px }
.wilds-help { font-size:12px; line-height:1.65; color:var(--muted); margin:0 }
.wilds-call-info { border-radius:12px; background:var(--paper2,#f6f2e8); padding:12px; font-size:12px; line-height:1.6 }
.wilds-presets { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin-top:12px }
.wilds-preset { text-align:left; padding:12px; display:block; border-radius:12px; min-height:72px }
.wilds-preset b,.wilds-preset small { display:block }
.wilds-preset b { font-size:12px; margin-bottom:4px }
.wilds-preset small { font-size:11px; color:var(--muted); line-height:1.4 }
.wilds-status { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap }
.wilds-status strong { font-size:17px }
.wilds-status p { margin:5px 0 0; font-size:12px; color:var(--muted) }
.wilds-stats { display:flex; flex-wrap:wrap; gap:8px; margin:13px 0 }
.wilds-stats span { border:1px solid var(--line,#e5e0d6); border-radius:10px; padding:8px 10px; font-size:12px; background:var(--paper2,#f5f2e8) }
.wilds-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px }
.wilds-actions button { min-height:44px; font-size:13px }
.wilds-list { display:grid; gap:10px; margin-top:12px }
.wilds-entry { border:1px solid var(--line,#e5e0d6); border-radius:12px; padding:12px; min-width:0 }
.wilds-entry h4 { margin:0 0 5px; font-size:14px }
.wilds-entry p { margin:0; font-size:12px; color:var(--muted); line-height:1.6 }
.wilds-entry .row { margin-top:9px; flex-wrap:wrap }
.wilds-entry button { min-height:44px }
.wilds-transcript { white-space:pre-wrap; overflow-wrap:anywhere; max-height:270px; overflow:auto; font:13px/1.7 ui-monospace,monospace; background:var(--paper2,#f7f3e8); border-radius:12px; padding:14px; margin:12px 0 0 }
.wilds-event { display:grid; grid-template-columns:52px minmax(0,1fr); gap:9px; padding:8px 0; font-size:12px; line-height:1.5; border-bottom:1px dashed var(--line,#e5e0d6) }
.wilds-event time { color:var(--muted) }
.wilds-event p { margin:0 }
.wilds-log { max-height:190px; overflow:auto; margin-top:10px }
.wilds-history { display:grid; gap:8px; grid-template-columns:repeat(2,minmax(0,1fr)) }
.wilds-history button { text-align:left; padding:13px; min-height:75px; border-radius:12px; display:block }
.wilds-history button.selected { border-color:var(--blue,#567bc2); background:var(--paper2,#edf2fc) }
.wilds-history b,.wilds-history small { display:block; overflow-wrap:anywhere }
.wilds-history b { font-size:13px; margin:5px 0 }
.wilds-history small { font-size:11px; color:var(--muted) }
.wilds-empty { border:1px dashed var(--line,#ded8cb); border-radius:14px; padding:24px 18px; text-align:center; color:var(--muted); font-size:13px; line-height:1.7 }
.wilds-empty strong { display:block; color:var(--ink); margin-bottom:6px; font-size:17px }
.wilds-foot { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; font-size:12px; color:var(--muted) }
.wilds-follow { display:flex; align-items:center; gap:8px; min-height:44px; cursor:pointer }
.wilds-follow input { width:18px; height:18px; accent-color:var(--blue,#567bc2) }
@media(max-width:1000px) { .wilds-layout { grid-template-columns:minmax(0,1fr) } .wilds-launch { order:1 } .wilds-map-panel { order:0 } }
@media(max-width:600px) { .wilds { gap:15px } .wilds-panel { padding:15px; border-radius:16px } .wilds-scene { min-height:280px } .wilds-scenery { height:280px } .wilds-zone { font-size:11px; padding:4px 6px } .wilds-zone[data-zone='meadow'] { left:7%; top:52% } .wilds-zone[data-zone='library'] { left:39%; top:27% } .wilds-zone[data-zone='mountain'] { right:3%; top:47% } .wilds-home { bottom:12px; left:12px } .wilds-history { grid-template-columns:minmax(0,1fr) } .wilds-head h2 { font-size:22px } .wilds-pet-label { max-width:90px } }
@media(prefers-reduced-motion:reduce) { .wilds-walker,.wilds-zone { will-change:auto; transition:none } }
</style>`;

function scenicDetails(biome) {
  if (biome === 'coast') return '<path d="M0 298Q80 271 160 292T330 300T500 291T640 286V338H0Z" fill="#86c5ca88"/><path d="M30 319q50-19 90 0m184-5q35-14 70 0m122 6q40-16 75-2" fill="none" stroke="#e7fbef" stroke-width="3" stroke-linecap="round"/><g fill="#d9bde1" stroke="#a38bb1"><path d="m522 210 10-32 13 22-3 15Z"/><path d="m541 215 10-26 8 23Z"/></g>';
  if (biome === 'archive') return '<g stroke="#9a8da6" stroke-width="2" fill="#d2bdd2"><path d="M52 270q14-6 28 0v19q-14-6-28 0Z"/><path d="M80 270q14-6 28 0v19q-14-6-28 0Z"/></g><g fill="#f8f0c8"><path d="m119 63 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/><path d="m416 37 2 5 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1Z"/><circle cx="535" cy="57" r="9"/></g><path d="M538 48a10 10 0 0 0 0 18 9 9 0 1 1 0-18" fill="#f7f0cb"/>';
  if (biome === 'workshop') return '<g fill="#b9c8ae" stroke="#7c956f" stroke-width="3"><circle cx="492" cy="194" r="20"/><circle cx="492" cy="194" r="8" fill="#d9e5be"/><path d="M492 168v9m0 35v9m-26-27h9m35 0h9m-45-19 7 7m23 24 7 7m-37 0 7-7m23-24 7-7"/></g><path d="M205 233q24-21 48 0m-48 5h48m-38-12v13m19-17v17m-5-23v23" fill="none" stroke="#a08860" stroke-width="5"/><rect x="577" y="164" width="16" height="19" rx="4" fill="#f5d48a" stroke="#ad986f"/><path d="M581 164v-7h8v7" fill="none" stroke="#ad986f" stroke-width="2"/>';
  return '<g stroke="#829869" stroke-width="2"><path d="M84 267v16m0-6-7-4m7-1 7-4M457 271v16m0-6-7-4m7-1 7-4"/></g><g fill="#debcc9"><circle cx="84" cy="264" r="6"/><circle cx="457" cy="268" r="5"/></g><g fill="#f5e2ab"><circle cx="84" cy="264" r="2"/><circle cx="457" cy="268" r="2"/></g><g fill="#c8a080"><ellipse cx="261" cy="258" rx="8" ry="5"/><ellipse cx="267" cy="253" rx="5" ry="5"/><ellipse cx="266" cy="246" rx="2" ry="5"/><ellipse cx="271" cy="248" rx="2" ry="5"/></g>';
}

function teachingStops(text) {
  if (!text) return [];
  const markerStops = text.split(/===STOP:[^=\n]+===/i).slice(1).map(t => t.trim()).filter(Boolean);
  if (markerStops.length) return markerStops.slice(0, 3);
  const numbered = text.split(/(?=^\s*(?:#{1,4}\s*)?(?:Stop\s+|Teaching stop\s+)?[123][.) :])/im).map(t => t.trim()).filter(Boolean);
  if (numbered.length >= 3) return numbered.slice(-3);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  const chunk = Math.max(1, Math.ceil(paragraphs.length / 3));
  return [0, 1, 2].map(i => paragraphs.slice(i * chunk, (i + 1) * chunk).join('\n\n')).filter(Boolean);
}

/** UI + event adapter; all model work stays in the application's existing engines. */
export function createWilds(d) {
  const e = d.escape;
  const btn = d.button;
  const state = () => d.getDB().wilds;
  const getRecord = id => state().records.find(r => r.id === id);
  const selected = () => getRecord(state().selected) || state().records.at(-1);
  const name = id => d.getDB().agents[id]?.name || (id === 'nova' ? 'Nova' : 'Milo');
  let frame = 0;
  let persistTimer = 0;
  let animationNode = null;
  let reaction = null;
  let focusStop = null;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const statusText = r => !r ? 'Ready to explore' : ({ queued: 'Packing the backpack', running: r.kind === 'teach' ? 'A lesson on the trail' : 'Out gathering', complete: 'Back with something useful', failed: 'A bump on the trail', stopped: 'Taking a pause' })[r.status];
  const resourceName = r => r.kind === 'source' ? 'Source' : r.kind === 'file' ? 'Project file' : r.kind === 'demonstration' ? 'Teacher demonstration' : 'Answer';
  const pageFor = r => r.kind === 'research' ? 'research' : r.kind === 'code' ? 'code' : 'workspace';
  const controls = (r, compact = false) => `<div class="wilds-actions">${btn('wilds-pet', '♡ Check in', '', `data-agent="${r?.agent || state().agent}"`)}${btn('wilds-cheer', '✦ Cheer them on', '', r ? `data-id="${e(r.id)}"` : '')}${r ? btn('wilds-open', `${d.icon(KINDS_INFO[r.kind].icon)} ${r.status === 'running' ? 'Watch the work' : 'Open result'}`, '', `data-id="${e(r.id)}"`) : ''}${r?.status === 'running' ? btn('stop', 'Stop outing', '', 'aria-label="Stop the current expedition"') : ''}${!compact && r?.kind === 'teach' && r.taskId && r.status === 'complete' ? btn('wilds-teach', 'Teach this to a model chip', 'primary', `data-id="${e(r.id)}"`) : ''}</div>`;
  function view() {
    const s = state(), r = selected(), db = d.getDB();
    const playing = db.mode === 'demo';
    const active = s.records.find(a => a.status === 'running');
    return `${STYLES}<section class="wilds" aria-label="Expedition garden"><div class="wilds-head"><div><h2>Little paws. Big adventures.</h2><p>Send a companion out with a purpose. Watch useful work come home.</p></div><span class="wilds-mode ${playing ? 'sample' : ''}">${playing ? '◌ Playground · sample outings' : '↗ OpenRouter · real model work'}</span></div>${playing ? '<div class="notice demo"><b>A practice adventure.</b> Playground outings use prepared samples, including sample citations and files. They do not search the web or train a model.</div>' : ''}<div class="wilds-layout"><div class="wilds-panel wilds-map-panel"><div class="wilds-status"><div><strong>${e(statusText(r))}</strong><p>${r ? `${e(name(r.agent))}${r.student ? ' + ' + e(name(r.student)) : ''} · ${e(KINDS_INFO[r.kind].label)} · ${r.demo ? 'sample' : e(r.model || 'selected model')}` : 'Pick a mission, a companion, and a destination.'}</p></div>${r ? `<span class="wilds-mode ${r.demo ? 'sample' : ''}">${r.demo ? 'Sample' : 'Live'} · ${e(r.status)}</span>` : ''}</div><div class="wilds-tabs" role="group" aria-label="Expedition views">${['map', 'journal', 'inventory'].map(tab => btn('wilds-tab', `${tab === 'map' ? '⌁ Trail map' : tab === 'journal' ? '▤ Field journal' : '▧ Resource basket'}${tab === 'inventory' && r ? ` (${r.resources.length})` : ''}`, s.tab === tab ? 'active' : '', `data-tab="${tab}" aria-pressed="${s.tab === tab}"`)).join('')}</div>${s.tab === 'map' ? mapView(r) : s.tab === 'journal' ? journalView(r) : inventoryView(r)}${r ? `<div class="wilds-stats"><span>${r.chars.toLocaleString()} characters received</span><span>${r.resources.filter(a => a.kind === 'source').length} cited sources</span><span>${r.resources.filter(a => a.kind === 'file').length} project files</span>${r.kind === 'teach' ? '<span>Apprentice watching the demonstration</span>' : ''}</div>${r.error ? `<div class="error" role="alert">${e(r.error)}</div>` : ''}${controls(r)}` : controls(null)}<div class="wilds-foot"><label class="wilds-follow"><input type="checkbox" id="wilds-follow" ${s.follow ? 'checked' : ''}> Follow companions on the map</label><span>Pet care is for fun. Model results depend on the task and chip.</span></div></div><div class="wilds-panel wilds-launch"><h3>Where shall we go?</h3><div class="wilds-form"><div><label>Choose a little world</label><div class="wilds-biomes">${Object.entries(BIOMES).map(([id,b]) => btn('wilds-biome', `${e(b.title)}<small>${e(b.subtitle)}</small>`, id === s.biome ? 'active' : '', `data-biome="${id}" aria-pressed="${id === s.biome}" ${d.getBusy() ? 'disabled' : ''}`)).join('')}</div></div><div class="wilds-field-row"><div><label for="wilds-kind">Adventure</label><select id="wilds-kind" ${d.getBusy() ? 'disabled' : ''}>${KINDS.map(k => `<option value="${k}" ${k === s.kind ? 'selected' : ''}>${e(KINDS_INFO[k].label)}</option>`).join('')}</select></div><div><label for="wilds-agent">${s.kind === 'teach' ? 'Teacher' : 'Companion'}</label><select id="wilds-agent" ${d.getBusy() ? 'disabled' : ''}>${AGENTS.map(id => `<option value="${id}" ${id === s.agent ? 'selected' : ''}>${e(name(id))}</option>`).join('')}</select></div></div>${s.kind === 'teach' ? `<div class="notice">${e(name(s.agent === 'milo' ? 'nova' : 'milo'))} comes along as the apprentice. The lesson becomes a model chip after you review it.</div><div><label for="wilds-skill">Skill to pass on</label><input id="wilds-skill" maxlength="2000" value="${e(s.skill)}" placeholder="Clear explanations, concise emails, structured plans…" ${d.getBusy() ? 'disabled' : ''}></div>` : ''}<div><label for="wilds-goal">A specific goal</label><textarea id="wilds-goal" maxlength="20000" placeholder="What should your companion bring back? Include the audience, format, and what a good result looks like." ${d.getBusy() ? 'disabled' : ''}>${e(s.goal)}</textarea></div><p class="wilds-help">${e(KINDS_INFO[s.kind].help)}</p><div class="wilds-call-info">${callInfo(s, db)}${db.mode !== 'demo' && !db.agents[s.agent].model ? ' Choose a model and connect your key in Settings first.' : ''}</div>${btn('wilds-launch', `${d.icon('send')} ${s.kind === 'teach' ? 'Take the apprentice along' : 'Send into the wild'}`, 'primary', `${d.getBusy() ? 'disabled' : ''}`)}${active ? `<p class="wilds-help">${e(name(active.agent))} is already out. Stop or finish the current outing before launching another.</p>` : ''}</div><div class="wilds-presets">${PRESETS.map(p => btn('wilds-preset', `<b>${e(p.title)}</b><small>${e(p.detail)}</small>`, 'wilds-preset', `data-preset="${p.id}" ${d.getBusy() ? 'disabled' : ''}`)).join('')}</div><div class="wilds-actions">${btn('wilds-guide', 'How does teaching work?', '')}${btn('wilds-settings', 'Models & connection', '')}</div></div></div>${s.records.length ? `<div class="wilds-panel"><div class="wilds-head"><h3>Adventure scrapbook</h3><span class="wilds-help">Last ${s.records.length} outings · saved in this browser</span></div><div class="wilds-history">${s.records.slice().reverse().map(a => btn('wilds-select', `<small>${a.demo ? '◌ Sample' : '↗ Live'} · ${e(KINDS_INFO[a.kind].label)} · ${e(a.status)}</small><b>${e(a.prompt.slice(0, 100))}${a.prompt.length > 100 ? '…' : ''}</b><small>${e(name(a.agent))}${a.student ? ' + ' + e(name(a.student)) : ''} · ${a.resources.length} gathered items</small>`, a.id === r?.id ? 'selected' : '', `data-id="${e(a.id)}"`)).join('')}</div></div>` : ''}</section>`;
  }
  function callInfo(s, db) {
    if (db.mode === 'demo') return 'No API calls or credits: this is a sample outing.';
    const calls = s.kind === 'task' ? db.deep ? 2 : 1 : 1 + Math.max(0, (db.studio?.recursive ? db.studio.rounds : 1) - 1) * 2;
    return `${calls}${s.kind !== 'task' && db.studio?.autoLearn ? ' + 1 chip-draft' : ''} model call${calls > 1 ? 's' : ''}${s.kind !== 'task' ? ', using your studio refinement settings' : db.deep ? ', including a quality check' : ''}. ${s.kind === 'research' ? 'Research generation uses web search; search charges may apply. ' : ''}${s.kind === 'teach' ? 'Apprentice watching adds no model call. Distilling a chip later uses another call. ' : ''}Each call can use up to ${Number(db.maxTokens) || 2048} output tokens. Provider rates vary.`;
  }
  function mapView(r) {
    const db = d.getDB();
    const zone = KINDS_INFO[r?.kind || state().kind].zone;
    const biome = BIOMES[r?.biome || state().biome] || BIOMES.meadow;
    return `<div class="wilds-scene ${db.room === 'night' ? 'night' : ''}" data-wilds-scene data-zone="${zone}" data-expedition="${e(r?.id || '')}" style="background:${db.room === 'night' ? 'linear-gradient(#263c56 0%,#435672 43%,#506453 44%,#677552 100%)' : `linear-gradient(${biome.sky} 0%,${biome.sky} 43%,${biome.earth} 44%,${biome.earth} 100%)`}" aria-label="Illustrated expedition trail. ${e(statusText(r))}."><svg class="wilds-scenery" viewBox="0 0 640 338" preserveAspectRatio="none" aria-hidden="true"><path d="M416 151 480 42 540 144 574 100 640 176V205H409Z" fill="#a4b5c5"/><path d="m462 72 18-30 22 37-20-8-11 5Z" fill="#fff7"/><path d="M0 178Q125 102 243 163T490 171T640 157V338H0Z" fill="#c1d7ac"/><path d="M0 229Q135 169 243 219T468 204T640 238V338H0Z" fill="#d9e5be"/><path d="M91 294Q191 221 170 206Q150 187 203 194Q258 215 334 169Q371 142 404 196Q440 248 516 230" fill="none" stroke="#efdfba" stroke-width="26" stroke-linecap="round"/><path d="M91 294Q191 221 170 206Q150 187 203 194Q258 215 334 169Q371 142 404 196Q440 248 516 230" fill="none" stroke="#cab99a" stroke-width="2" stroke-dasharray="5 8"/><g fill="#839e6f"><ellipse cx="51" cy="202" rx="25" ry="19"/><ellipse cx="601" cy="238" rx="24" ry="18"/><ellipse cx="294" cy="259" rx="15" ry="13"/></g><g fill="#78906b"><rect x="48" y="205" width="7" height="24" rx="3"/><rect x="598" y="241" width="6" height="22" rx="3"/></g><g fill="#d8a859"><path d="M296 119h65v54h-65Z"/><path d="m287 120 42-30 42 30Z" fill="#8f9dab"/><path d="M322 142h15v31h-15Z" fill="#97733d"/><rect x="303" y="131" width="10" height="12" rx="2" fill="#f8e8af"/><rect x="345" y="131" width="10" height="12" rx="2" fill="#f8e8af"/></g><g fill="#efc572"><circle cx="150" cy="267" r="4"/><circle cx="223" cy="280" r="3"/><circle cx="557" cy="283" r="4"/><circle cx="371" cy="287" r="3"/></g><g fill="#edc3bb"><circle cx="158" cy="248" r="4"/><circle cx="560" cy="269" r="3"/><circle cx="382" cy="281" r="3"/></g>${scenicDetails(r?.biome || state().biome)}</svg><span class="wilds-cloud"></span><span class="wilds-cloud second"></span>${[['meadow','Idea meadow'],['library','Source library'],['mountain','Maker mountain']].map(([id,label]) => btn('wilds-zone', label, 'wilds-zone', `data-zone="${id}" aria-label="Inspect ${label}"`)).join('')}${biome.objects.map((object,i) => btn('wilds-stop', biome.symbols[i], 'wilds-object', `data-stop="${i}" data-id="${e(r?.id || '')}" aria-label="Pause beside the ${e(object.toLowerCase())}"`)).join('')}<span class="wilds-home">⌂ ${e(biome.title)}</span>${AGENTS.map(id => `<button class="wilds-walker" data-action="wilds-pet" data-agent="${id}" data-wilds-walker="${id}" aria-label="Check in with ${e(name(id))}"><span class="wilds-backpack"></span>${d.mascot(id)}<span class="wilds-pet-label">${e(name(id))}${r?.student === id ? ' · apprentice' : ''}</span></button>`).join('')}<span class="wilds-particle" data-wilds-particle aria-hidden="true"></span></div><p class="wilds-scene-caption">${r?.status === 'running' ? `${e(name(r.agent))} is ${r.kind === 'research' ? 'following the research trail while the provider searches' : r.kind === 'code' ? 'working at Maker mountain as project files arrive' : 'gathering an answer at Idea meadow'}. ${r.student ? `${e(name(r.student))} follows and watches the real demonstration. ` : ''}The walk reflects a running request; it does not estimate completion. Tap a world object to pause and inspect a teaching stop.` : r?.status === 'complete' ? `Your companion has returned. Open the basket to inspect what actually arrived${r.demo ? ' in this sample outing' : ''}.` : 'Tap a companion to check in, or a destination to see what can be gathered there.'}</p>${r?.kind === 'teach' && r.text ? `<div class="wilds-stop-list" aria-label="Teaching stops">${biome.objects.map((object,i) => btn('wilds-stop', `${biome.symbols[i]} Stop ${i+1}: ${e(object)}`, '', `data-id="${e(r.id)}" data-stop="${i}"`)).join('')}</div><p class="wilds-help">Pause beside an object to inspect a passage from the actual teacher demonstration. These notes are ready to review, rather than automatic model training.</p>` : ''}`;
  }
  function journalView(r) {
    if (!r) return empty('A journal waiting for its first story', 'The actual request, returned output, and engine events appear here when you launch an outing.');
    return `<div class="wilds-entry"><h4>The mission</h4><p>${e(r.prompt)}</p>${r.skill ? `<p style="margin-top:8px"><b>Skill:</b> ${e(r.skill)}</p>` : ''}</div>${r.text ? `<pre class="wilds-transcript" aria-label="Actual expedition output">${e(r.text)}${r.chars > r.text.length ? '\n\n[Scrapbook excerpt. Open the result for the complete output.]' : ''}</pre>` : `<div class="wilds-empty">${r.status === 'running' ? 'Waiting for the model’s first words. Streamed code and research appear here as they arrive; task answers appear when the response returns.' : 'No output was returned for this outing.'}</div>`}${r.student ? '<p class="wilds-help" style="margin-top:10px">The apprentice’s field notes are the actual teacher demonstration above. Watching alone does not update model weights or approve a chip.</p>' : ''}<div class="wilds-log" aria-label="Engine activity log">${r.events.map(ev => `<div class="wilds-event"><time>${new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><p>${e(ev.message)}</p></div>`).join('')}</div>`;
  }
  function empty(title, text) { return `<div class="wilds-empty"><strong>${e(title)}</strong>${e(text)}</div>`; }
  function inventoryView(r) {
    if (!r?.resources.length) return empty('An honest little basket', r?.status === 'running' ? 'Sources, generated files, or the returned answer appear when the engine actually produces them. The basket fills from the returned output.' : 'Send a companion on an outing to gather source links, project files, or a useful answer.');
    return `<p class="wilds-help">${r.demo ? 'These are prepared sample resources from a playground outing.' : 'These items came from this outing’s actual returned output.'} File cards keep a short snapshot; the full project stays in Code studio.</p><div class="wilds-list">${r.resources.map(a => `<article class="wilds-entry"><h4>${a.kind === 'source' ? '↗' : a.kind === 'file' ? '▧' : '✦'} ${e(a.title || a.path || resourceName(a))}</h4><p>${e(resourceName(a))}${a.size ? ` · ${a.size.toLocaleString()} characters` : ''}${a.kind === 'source' ? ` · ${e(new URL(a.url).hostname)}` : ''}</p><div class="row">${a.kind === 'source' ? `<a href="${e(a.url)}" target="_blank" rel="noopener noreferrer" class="button" style="min-height:44px;display:inline-flex;align-items:center">Open source ↗</a>` : btn('wilds-resource', 'Inspect gathered item', '', `data-id="${e(r.id)}" data-resource="${e(a.id)}"`)}</div></article>`).join('')}</div>`;
  }
  function addEvent(r, message) {
    if (!message || r.events.at(-1)?.message === message) return;
    r.events.push({ message: String(message).slice(0, 500), time: Date.now() });
    r.events = r.events.slice(-30);
  }
  function begin(details) {
    const s = state();
    const kind = KINDS.includes(details.kind) ? details.kind : 'task';
    const agent = agentID(details.agent);
    const r = { id: uid(), kind, biome: Object.hasOwn(BIOMES, details.biome) ? details.biome : state().biome, agent, student: kind === 'teach' || details.tutorDialogue ? agentID(details.student || (agent === 'milo' ? 'nova' : 'milo')) : null,
      prompt: bound(details.prompt, 20000), skill: bound(details.skill, 2000), demo: !!details.demo, model: bound(details.model, 200), status: 'running', started: Date.now(), finished: 0,
      runId: bound(details.runId, 100), taskId: bound(details.taskId, 100), text: '', chars: 0, error: '', resources: [], events: [], cheers: 0, streaming:!!details.streaming, dialogue:[] };
    if (r.student === r.agent) r.student = r.agent === 'milo' ? 'nova' : 'milo';
    s.records.push(r); s.records = s.records.slice(-24); s.selected = r.id; s.tab = 'map';
    addEvent(r, `${name(agent)} set out on ${r.demo ? 'a sample' : 'a live'} ${KINDS_INFO[kind].label.toLowerCase()}.`);
    if (r.student) addEvent(r, `${name(r.student)} is watching the teacher demonstration. No chip has been approved yet.`);
    d.save();
    return r.id;
  }
  function capture(id, details = {}) {
    const r = getRecord(id);
    if (!r) return;
    if (typeof details.runId === 'string') r.runId = bound(details.runId, 100);
    if (typeof details.taskId === 'string') r.taskId = bound(details.taskId, 100);
    if (typeof details.model === 'string') r.model = bound(details.model, 200);
    if (Array.isArray(details.dialogue)) r.dialogue=details.dialogue.slice(-12).map(m=>({...m,text:String(m.text||'').slice(0,12000)}));
    if (typeof details.text === 'string') { r.text = details.text.slice(0, 16000); r.chars = Math.min(250000, details.text.length); }
    const before = r.resources.length;
    if (Array.isArray(details.sources)) for (const a of details.sources.slice(0, 20)) {
      const url = safeURL(a?.url);
      if (url && !r.resources.some(item => item.kind === 'source' && item.url === url) && r.resources.length < 36)
        r.resources.push({ id: `source-${uid()}`, kind: 'source', title: bound(a.title || url, 180), url, path: '', excerpt: '', size: 0 });
    }
    if (Array.isArray(details.files)) for (const a of details.files.slice(0, 24)) {
      if (typeof a?.path !== 'string' || typeof a?.content !== 'string') continue;
      let resource = r.resources.find(item => item.kind === 'file' && item.path === a.path);
      if (!resource && r.resources.length < 36) { resource = { id: `file-${uid()}`, kind: 'file', title: bound(a.path, 180), path: bound(a.path, 160), url: '', excerpt: '', size: 0 }; r.resources.push(resource); }
      if (resource) { resource.excerpt = a.content.slice(0, 1800); resource.size = Math.min(250000, a.content.length); }
    }
    if (Array.isArray(details.events)) for (const event of details.events.slice(-30)) {
      if (typeof event?.message !== 'string' || r.events.some(a => a.message === event.message && a.time === event.time)) continue;
      r.events.push({ message: event.message.slice(0, 500), time: Number(event.time) || Date.now() });
    }
    r.events = r.events.slice(-30);
    if (r.resources.length > before) reaction = { started: performance.now(), symbol: r.kind === 'research' ? '▤' : '▧' };
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => d.save(), 650);
    return r;
  }
  function finish(id, details = {}) {
    const r = capture(id, details);
    if (!r) return;
    r.status = ['complete', 'failed', 'stopped'].includes(details.status) ? details.status : 'complete';
    r.finished = Date.now(); r.error = bound(details.error, 1000);
    if (r.text && ['task', 'teach'].includes(r.kind) && !r.resources.some(a => ['answer', 'demonstration'].includes(a.kind)))
      r.resources.push({ id: `answer-${uid()}`, kind: r.kind === 'teach' ? 'demonstration' : 'answer', title: r.kind === 'teach' ? 'The teacher’s demonstration' : 'The returned answer', url: '', path: '', excerpt: r.text.slice(0, 1800), size: r.chars });
    addEvent(r, r.status === 'complete' ? 'Returned to base camp. Inspect the result before using or teaching from it.' : r.status === 'stopped' ? 'Outing stopped. Any material already gathered has been kept.' : 'The request failed. Any material already gathered has been kept.');
    if (r.status === 'complete') reaction = { started: performance.now(), symbol: '✦' };
    clearTimeout(persistTimer); d.save();
    return r;
  }
  async function action(actionName, data = {}) {
    data = data.dataset || data;
    const s = state();
    if (actionName === 'wilds-launch') {
      if (d.getBusy()) return d.toast('Your companion is already working. Finish or stop that outing first.');
      const goal = s.goal.trim();
      if (!goal) return d.toast('Give your companion a specific goal first.');
      if (s.kind === 'teach' && !s.skill.trim()) return d.toast('Name the skill you want to pass to the other model.');
      await d.startExpedition(s.kind, goal, s.agent, { student: s.agent === 'milo' ? 'nova' : 'milo', skill: s.skill.trim(), biome: s.biome, objects: BIOMES[s.biome].objects });
    } else if (actionName === 'wilds-biome') {
      if (d.getBusy() || !Object.hasOwn(BIOMES, data.biome)) return;
      s.biome = data.biome; d.save(); d.render();
    } else if (actionName === 'wilds-stop') {
      const r = getRecord(data.id) || selected();
      const index = Math.max(0, Math.min(2, Number(data.stop) || 0));
      const biome = BIOMES[r?.biome || s.biome] || BIOMES.meadow;
      const stop = teachingStops(r?.text || '')[index];
      focusStop = { recordId: r?.id, index };
      d.openModal(`<h2 id="modal-title">${e(biome.symbols[index])} A pause beside the ${e(biome.objects[index].toLowerCase())}</h2><p class="help">${r?.kind === 'teach' ? `Teaching goal: ${e(r.skill || r.prompt)}` : 'A little world object. Launch a teacher + apprentice outing to explore a skill through three guided stops.'}</p>${r?.kind === 'teach' && stop ? `<p>${r.demo ? 'Prepared playground passage' : 'From the actual teacher demonstration'} · Stop ${index+1}</p><pre class="wilds-transcript">${e(stop)}</pre><p class="help">Review whether this analogy actually helps the chosen skill, and where it breaks down. An observation becomes reusable only after you approve a model chip.</p>` : `<div class="wilds-empty">${r?.kind === 'teach' && r.status === 'running' ? 'The teacher’s words have not reached this stop yet. The scene can pause here while you wait for actual output.' : 'No teacher passage is stored for this stop yet. Choose a skill and take an apprentice on a teaching outing.'}</div>`}<div class="row" style="flex-wrap:wrap">${r?.kind === 'teach' && r.taskId && r.status === 'complete' ? btn('wilds-teach', 'Review a model chip', 'primary', `data-id="${e(r.id)}"`) : ''}${btn('close', 'Keep walking')}</div>`);
      mount();
    } else if (actionName === 'wilds-preset') {
      if (d.getBusy()) return;
      const preset = PRESETS.find(p => p.id === data.preset); if (!preset) return;
      s.goal = preset.goal; s.kind = preset.kind; s.skill = preset.skill || ''; d.save(); d.render();
      document.getElementById('wilds-goal')?.focus();
    } else if (actionName === 'wilds-tab') {
      if (!['map', 'journal', 'inventory'].includes(data.tab)) return;
      s.tab = data.tab; d.save(); d.render();
    } else if (actionName === 'wilds-select') {
      if (!getRecord(data.id)) return; s.selected = data.id; d.save(); d.render();
    } else if (actionName === 'wilds-open') {
      const r = getRecord(data.id); if (!r) return;
      if (d.openExpedition) d.openExpedition(r); else d.setPage(pageFor(r));
    } else if (actionName === 'wilds-teach') {
      const r = getRecord(data.id); if (!r || r.kind !== 'teach' || !r.taskId || r.status !== 'complete') return;
      if (d.getBusy()) return d.toast('Finish the current outing before drafting a model chip.');
      if (d.teachExpedition) await d.teachExpedition(r);
    } else if (actionName === 'wilds-guide') d.setPage('academy');
    else if (actionName === 'wilds-settings') d.setPage('settings');
    else if (actionName === 'wilds-cheer') {
      const r = getRecord(data.id) || selected();
      if (r) { r.cheers = Math.min(999, r.cheers + 1); d.save(); }
      reaction = { started: performance.now(), symbol: '♡' }; mount();
      d.toast(`${name(r?.agent || s.agent)} got your encouragement. Little paws, one step at a time.`);
    } else if (actionName === 'wilds-pet') {
      const id = agentID(data.agent); const a = d.getDB().agents[id]; const current = s.records.find(r => r.status === 'running' && (r.agent === id || r.student === id));
      d.openModal(`<h2 id="modal-title">A moment with ${e(name(id))}</h2><div style="display:flex;gap:20px;align-items:center;margin:18px 0">${d.mascot(id, true)}<p>${current ? current.student === id ? 'Watching the teacher and taking field notes.' : `On ${e(KINDS_INFO[current.kind].label.toLowerCase())}, with your goal tucked in their backpack.` : 'Resting at base camp, ready for the next idea.'}</p></div><p class="help">${a.chipId ? 'This companion is powered by an equipped model chip.' : 'This companion uses its selected base model.'} Pet care is a playful interaction; it does not change API cost or model capability.</p><div class="row" style="flex-wrap:wrap">${btn('wilds-snack', 'Offer a trail snack', 'primary', `data-agent="${id}"`)}${btn('wilds-pat', 'Give a gentle pat', '', `data-agent="${id}"`)}${btn('close', 'Back to the trail')}</div>`);
    } else if (['wilds-snack', 'wilds-pat'].includes(actionName)) {
      const id = agentID(data.agent); const a = d.getDB().agents[id];
      if (actionName === 'wilds-snack') { a.energy = Math.min(100, Math.max(0, Number(a.energy) || 0) + 12); s.care[id] = Math.min(999, s.care[id] + 1); }
      else a.happiness = Math.min(100, Math.max(0, Number(a.happiness) || 0) + 10);
      d.save(); document.getElementById('modal')?.close();
      reaction = { started: performance.now(), symbol: actionName === 'wilds-snack' ? '🍎' : '♡' };
      d.render(); d.toast(actionName === 'wilds-snack' ? `${name(id)} enjoyed a trail snack.` : `${name(id)} feels appreciated.`);
    } else if (actionName === 'wilds-zone') {
      const content = { meadow: ['Idea meadow', 'Task answers and teacher demonstrations grow here. Give your model a concrete goal, an audience, and a useful format.', 'task'], library: ['Source library', 'Research outings use OpenRouter’s web search plugin. The basket holds only citations actually returned by the provider. Verify sources before relying on them.', 'research'], mountain: ['Maker mountain', 'Build outings gather project files. Open Code studio to inspect the code, edit it, and use the isolated HTML/CSS/JavaScript preview.', 'code'] }[data.zone];
      if (!content) return;
      const r = selected();
      const relevant = r?.resources.filter(a => data.zone === 'library' ? a.kind === 'source' : data.zone === 'mountain' ? a.kind === 'file' : ['answer', 'demonstration'].includes(a.kind)) || [];
      d.openModal(`<h2 id="modal-title">${content[0]}</h2><p>${content[1]}</p><p class="help">${relevant.length ? `${relevant.length} ${r?.demo ? 'sample ' : ''}item${relevant.length === 1 ? '' : 's'} in the selected outing’s basket.` : 'No gathered items from this destination in the selected outing yet.'}</p><div class="row">${btn('wilds-zone-plan', 'Plan an outing here', 'primary', `data-kind="${content[2]}" ${d.getBusy() ? 'disabled' : ''}`)}${btn('close', 'Keep exploring')}</div>`);
    } else if (actionName === 'wilds-zone-plan') {
      if (d.getBusy() || !KINDS.includes(data.kind)) return;
      s.kind = data.kind; d.save(); document.getElementById('modal')?.close(); d.render(); document.getElementById('wilds-goal')?.focus();
    } else if (actionName === 'wilds-resource') {
      const r = getRecord(data.id); const a = r?.resources.find(item => item.id === data.resource); if (!r || !a) return;
      d.openModal(`<h2 id="modal-title">${e(a.title)}</h2><p class="help">${e(resourceName(a))} · ${r.demo ? 'prepared sample' : 'returned from a live outing'}${a.size ? ` · ${a.size.toLocaleString()} characters` : ''}</p><pre class="wilds-transcript">${e(a.excerpt)}${a.size > a.excerpt.length ? '\n\n[Snapshot excerpt]' : ''}</pre><p class="help">${a.kind === 'file' ? 'The full working project is in Code studio. This scrapbook excerpt stays with its outing even if you later replace the project.' : 'The full answer is saved with its original task in Workspace.'}</p><div class="row">${btn('wilds-resource-open', 'Open the working result', 'primary', `data-id="${e(r.id)}"`)}${btn('close', 'Back to basket')}</div>`);
    } else if (actionName === 'wilds-resource-open') {
      document.getElementById('modal')?.close(); const r = getRecord(data.id); if (r) { if (d.openExpedition) d.openExpedition(r); else d.setPage(pageFor(r)); }
    }
  }
  // A single animation loop survives repeated stream renders without leaking loops.
  // Walking is activity illustration only; engine events alone create resources.
  function mount() {
    cancelAnimationFrame(frame); frame = 0;
    animationNode = document.querySelector('[data-wilds-scene]');
    if (!animationNode) return;
    const scene = animationNode;
    const r = getRecord(scene.dataset.expedition);
    const walkers = Object.fromEntries(AGENTS.map(id => [id, scene.querySelector(`[data-wilds-walker="${id}"]`)]));
    const particle = scene.querySelector('[data-wilds-particle]');
    const targets = { meadow: [0.32, 0.69], library: [0.56, 0.56], mountain: [0.82, 0.73] };
    const target = targets[scene.dataset.zone] || targets.meadow;
    const animate = now => {
      if (!scene.isConnected || animationNode !== scene) return;
      const paused = !!document.getElementById('modal')?.open;
      const still = reduced?.matches || d.getDB().appearance?.motion === 'reduced';
      const moving = r?.status === 'running' && state().follow && !still && !paused;
      const time = r ? (Date.now() - r.started) / 1000 : 0;
      for (const id of AGENTS) {
        const walker = walkers[id]; if (!walker) continue;
        let x = id === 'milo' ? 0.145 : 0.255, y = 0.86;
        if (r?.status === 'running' && (r.agent === id || r.student === id)) {
          const student = r.student === id;
          if (moving) {
            const t = (time * 0.18 - (student ? 0.5 : 0));
            const phase = (Math.sin(t) + 1) / 2;
            x = 0.17 + (target[0] - 0.17) * phase;
            y = 0.83 + (target[1] - 0.83) * phase - Math.sin(phase * Math.PI) * 0.08;
            y += Math.sin(time * 7 - (student ? 0.8 : 0)) * 0.009;
            if (student) { x -= 0.07; y += 0.035; }
          } else {
            const stopTarget = paused && focusStop?.recordId === r.id ? [[0.31,0.72],[0.60,0.61],[0.82,0.78]][focusStop.index] : target;
            x = stopTarget[0] - (student ? 0.095 : 0); y = stopTarget[1] + (student ? 0.05 : 0);
          }
        }
        walker.style.left = `${x * 100}%`; walker.style.top = `${y * 100}%`;
      }
      if (particle && reaction && !still) {
        const age = (now - reaction.started) / 1300;
        if (age >= 0 && age < 1) { particle.textContent = reaction.symbol; particle.style.left = `${(target[0] * 100)}%`; particle.style.top = `${(target[1] * 100) - age * 17}%`; particle.style.opacity = String(Math.sin(age * Math.PI)); }
        else particle.style.opacity = '0';
      }
      if ((r?.status === 'running' && state().follow && !still) || (reaction && now - reaction.started < 1300 && !still)) frame = requestAnimationFrame(animate);
    };
    animate(performance.now());
  }
  document.addEventListener('input', event => {
    if (event.target.id === 'wilds-goal') state().goal = event.target.value.slice(0, 20000);
    else if (event.target.id === 'wilds-skill') state().skill = event.target.value.slice(0, 2000);
    else return;
    clearTimeout(persistTimer); persistTimer = setTimeout(() => d.save(), 350);
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.id === 'wilds-kind' && KINDS.includes(el.value) && !d.getBusy()) { state().kind = el.value; d.save(); d.render(); }
    else if (el.id === 'wilds-agent' && AGENTS.includes(el.value) && !d.getBusy()) { state().agent = el.value; d.save(); d.render(); }
    else if (el.id === 'wilds-follow') { state().follow = el.checked; d.save(); mount(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; clearTimeout(persistTimer); d.save(); }
    else mount();
  });
  globalThis.addEventListener('pagehide', () => { clearTimeout(persistTimer); d.save(); });
  reduced?.addEventListener?.('change', mount);
  return { view, action, begin, capture, finish, mount, flush() { clearTimeout(persistTimer); d.save(); }, cancel(id) { return finish(id, { status: 'stopped' }); } };
}
