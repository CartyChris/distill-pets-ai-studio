import { animate } from 'motion/mini';
import { createWorldEngine, WORLD_BIOMES } from './world-engine.js';
import './adventure.css';

const BIOMES = Object.fromEntries(
  Object.entries(WORLD_BIOMES).map(([id, biome]) => [id, biome.title]),
);
const CLASSROOMS = {
  meadow: ['The Flower Classroom', 'The Question Oak', 'Mirror Pond'],
  archive: [
    'The Open-Air Archive',
    'Little Star Observatory',
    'The Ruins of Almost',
  ],
  coast: [
    'The Source Lighthouse',
    'Seashell Study Bay',
    'The Returning Harbor',
  ],
  workshop: [
    'The Mossy Makerspace',
    'The Little Test Bridge',
    'The Iteration Windmill',
  ],
};
const TABS = {
  mission: ['⚑', 'Mission'],
  results: ['▤', 'Results'],
  dialogue: ['☏', 'Team chat'],
  steer: ['➤', 'Guide'],
  field: ['♧', 'Field kit'],
  world: ['☼', 'World'],
};
export function createAdventure(d) {
  const { escape: h, button: btn, icon, mascot } = d;
  const state = () => d.getDB().adventure;
  const outing = () => d.getOuting();
  let selected = null,
    saveTimer,
    lastPanel = '',
    lastDialogue = '',
    lastGuidance = '',
    placeSearch = '',
    placeFilter = 'landmark';
  const engine = createWorldEngine({
    getState: () => ({
      ...state(),
      overlayHUD: true,
      motion:
        d.getDB().appearance.motion === 'reduced' ||
        matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'reduced'
          : state().motion,
    }),
    getAgents: () => d.getAgents(),
    getOuting: () => {
      const r = outing();
      return r
        ? {
            ...r,
            phase: currentRun()?.phase,
            speakingAgent: currentRun()?.speakingAgent,
          }
        : null;
    },
    onSelect: (item) => inspect(item),
    onScene: () => refreshScene(),
  });
  const currentRun = () => {
    const s = d.getDB().studio;
    return outing()?.runId && outing().runId === s.lastRun?.id
      ? s.lastRun
      : null;
  };
  const output = () =>
    currentRun() ? d.getDB().studio.output : outing()?.text || '';
  const dialogue = () =>
    currentRun() ? d.getDB().studio.dialogue || [] : outing()?.dialogue || [];
  const reduced = () =>
    d.getDB().appearance.motion === 'reduced' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  function callPlan() {
    const a = state(), s = d.getDB().studio;
    const rounds = s.recursive ? Math.min(3, Math.max(1, Number(s.rounds) || 1)) : 1;
    const count = rounds * 2 - 1 + (a.dialogue ? 2 : 0) + (a.practice ? 2 * a.practiceRounds : 0) + (s.autoLearn ? 1 : 0);
    return `${count} planned model call${count === 1 ? '' : 's'}${a.practice ? ` · ${a.practiceRounds} practice + feedback round${a.practiceRounds === 1 ? '' : 's'}` : ''}. Guidance can add up to two continuation calls. ${d.getDB().mode === 'demo' ? 'Playground uses prepared samples and no API credits.' : 'Live calls use your chosen OpenRouter models and provider credits.'}`;
  }
  function announce(message) {
    const status = document.querySelector('[data-world-camera-status]');
    if (status) status.textContent = message;
  }
  function refreshScene() {
    const root = document.getElementById('adventure-root');
    if (!root) return;
    const m = engine.metrics(), nav = m.navigation;
    root.dataset.gentle = String(reduced() || state().motion === 'reduced');
    root.querySelector('[data-world-location]').textContent = BIOMES[m.biome] || BIOMES[state().biome];
    root.querySelectorAll('.world-companion').forEach(el => el.setAttribute('aria-pressed', String(m.following === el.dataset.agent)));
    const path = root.querySelector('[data-world-walk]');
    if (path) { path.hidden = !nav; if (nav) { path.querySelector('b').textContent = `${nav.arrived ? 'A little stop at' : 'Walking to'} ${nav.title}`; path.querySelector('small').textContent = nav.arrived ? 'Enjoy the view, inspect a landmark, or continue the walk.' : 'Scenic walking · model results stay in the live journal.'; } }
  }
  function placeCards() {
    const query = placeSearch.trim().toLowerCase();
    const places = engine.directory().filter(p => (placeFilter === 'all' || p.type === placeFilter) && (!query || `${p.title} ${p.description} ${BIOMES[p.biome]}`.toLowerCase().includes(query)));
    if (!places.length) return '<p class="world-help" role="status">No places match. Try a different name or kind of place.</p>';
    return Object.entries(BIOMES).map(([biome, title]) => {
      const group = places.filter(p => p.biome === biome);
      return group.length ? `<details class="world-place-group" ${query || biome === state().biome ? 'open' : ''}><summary>${h(title)}<span>${group.length} places</span></summary>${group.map(p => `<article class="world-place"><div><span class="world-place-symbol" aria-hidden="true">${p.type === 'npc' ? '☏' : p.type === 'enemy' ? '☁' : WORLD_BIOMES[p.biome].symbol}</span><h4>${h(p.title)}</h4>${state().visited.includes(p.id) ? '<small>Inspected</small>' : ''}</div><p>${h(p.description)}</p><div class="world-place-actions">${btn('world-place-look', 'Look', '', `data-place="${p.id}" aria-label="Look at ${h(p.title)}"`)}${btn('world-place-walk', 'Walk together', '', `data-place="${p.id}" aria-label="Walk to ${h(p.title)}"`)}${btn('world-place-inspect', 'Inspect', '', `data-place="${p.id}" aria-label="Inspect ${h(p.title)}"`)}</div></article>`).join('')}</details>` : '';
    }).join('');
  }
  function places() {
    return `<section class="world-directory" aria-labelledby="world-directory-title"><h3 id="world-directory-title" class="world-section-title">Your field atlas</h3><p class="world-help">Look around, visit together, or inspect a place. These scenic actions use no model calls.</p><label for="world-place-search">Find a place or a little lesson</label><input type="search" id="world-place-search" maxlength="80" value="${h(placeSearch)}" placeholder="Try flowers, sources, or a workshop…"><label for="world-place-filter">Show</label><select id="world-place-filter">${Object.entries({landmark:'Landmarks & teaching stops',npc:'Workflow characters',enemy:'Mischievous scenic creatures',all:'All places & characters'}).map(([id, title]) => `<option value="${id}" ${placeFilter === id ? 'selected' : ''}>${title}</option>`).join('')}</select><div id="world-place-list">${placeCards()}</div></section>`;
  }
  function reveal(element) {
    if (element && !reduced())
      animate(
        element,
        { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] },
        { duration: 0.2 },
      );
  }
  function view() {
    return `<section id="adventure-root" class="adventure" aria-label="The Living Wilds open world">
      <canvas id="world-canvas" tabindex="0" aria-label="Adventure world. Drag to pan, pinch or scroll to zoom. Arrow keys move the camera."></canvas>
      <header class="world-top"><div class="world-brand"><span class="world-mark">✿</span><div><span class="world-eyebrow">DISTILL PETS · AN OPEN-WORLD ADVENTURE</span><h1>The Living Wilds<span>✧</span></h1></div></div><div class="world-top-actions">${btn('views', icon('workspace'), 'world-icon', 'aria-label="All views" title="All views"')}${btn('world-fullscreen', '⛶', 'world-icon', 'aria-label="Toggle full screen" title="Full screen"')}${btn('world-exit', '↩', 'world-icon', 'aria-label="Return to Wilds" title="Return to the original Wilds"')}</div></header>
      <div class="world-location"><i></i><span data-world-location>${BIOMES[state().biome]}</span><span class="world-mode" data-world-mode></span></div>
      <div class="world-error" data-world-error role="alert" hidden></div>
      <aside class="world-quest"><span class="world-eyebrow">YOUR LITTLE EXPEDITION</span><b data-world-quest>A whole world of little “aha!” moments.</b><span data-world-status>Companions are enjoying a little idle wandering.</span><div class="world-quest-actions">${btn('world-tab', '⚑ Send on an outing', '', 'data-tab="mission"')}${btn('world-tab', '➤ Guide the team', '', 'data-tab="steer"')}${btn('world-open-places', '♧ Field atlas')}</div></aside>
      <div class="world-camera-tools">${btn('world-zoom-in', '+', 'world-icon', 'aria-label="Zoom in"')}${btn('world-zoom-out', '−', 'world-icon', 'aria-label="Zoom out"')}${btn('world-home', '⌂', 'world-icon', 'aria-label="Return camera to camp"')}${btn('world-fit', '▧', 'world-icon', 'aria-label="View whole map"')}${btn('world-tour', '⌕', 'world-icon', 'aria-label="Tour the world"')}${btn('world-pause', 'Ⅱ', 'world-icon', 'aria-label="Pause scenery" data-world-pause')}</div>
      <div class="world-walk-route" data-world-walk hidden><span aria-hidden="true">⌁</span><div><b></b><small></small></div>${btn('world-resume-walk', 'Continue', '', 'aria-label="Continue the scenic adventure"')}</div>
      <p class="world-sr-only" data-world-camera-status role="status" aria-live="polite"></p>
      <div class="world-companions">${['milo', 'nova'].map((id) => `<button data-action="world-follow" data-agent="${id}" class="world-companion" aria-label="Follow ${h(d.getDB().agents[id].name)}">${mascot(id, false, true)}<span><b data-world-name="${id}">${h(d.getDB().agents[id].name)}</b><small data-world-role="${id}">${id === (outing()?.agent || state().agent) ? 'Lead / teacher model' : 'Student / companion'}</small></span><i>⌕</i></button>`).join('')}</div>
      <div class="world-bottom"><div class="world-legend"><span>✦ <b data-world-discoveries>${state().visited.length}</b> scenery discoveries</span><small>Drag to explore · tap a character or landmark</small></div><nav class="world-tabs" aria-label="World panels">${Object.entries(
        TABS,
      )
        .map(([id, [glyph, label]]) =>
          btn(
            'world-tab',
            `<span>${glyph}</span><small>${label}</small>`,
            '',
            `data-tab="${id}" aria-label="${label}"`,
          ),
        )
        .join('')}</nav></div>
      <aside id="world-panel" class="world-panel" aria-label="Adventure inspector" ${state().panelOpen ? '' : 'hidden'}><header><div><span class="world-eyebrow">A WINDOW INTO THE WORK</span><h2 id="world-panel-title"></h2></div>${btn('world-close-panel', '×', 'world-icon', 'aria-label="Close world panel"')}</header><div id="world-panel-body"></div></aside>
      <div class="world-footnote">A living illustration of your team’s work. AI runs when you launch an outing.</div>
    </section>`;
  }
  function mission() {
    const a = state(),
      db = d.getDB();
    return `<p class="world-intro">Give curiosity a destination.<br><b>Your team brings the useful things home.</b></p><label for="world-goal">What should the team work on?</label><textarea id="world-goal" maxlength="12000" placeholder="Teach a beginner how APIs work, find reliable sources, build a little website…">${h(a.goal)}</textarea><div class="world-form-pair"><div><label for="world-kind">Adventure</label><select id="world-kind">${Object.entries(
      {
        teach: 'Teacher + student walk',
        research: 'Research expedition',
        code: 'Build a project',
        task: 'Explore a task',
      },
    )
      .map(
        ([id, label]) =>
          `<option value="${id}" ${a.kind === id ? 'selected' : ''}>${label}</option>`,
      )
      .join(
        '',
      )}</select></div><div><label for="world-agent">Lead companion</label><select id="world-agent">${['milo', 'nova'].map((id) => `<option value="${id}" ${a.agent === id ? 'selected' : ''}>${h(db.agents[id].name)}</option>`).join('')}</select></div></div><label for="world-skill">What should the other model learn?</label><input id="world-skill" maxlength="1000" value="${h(a.skill)}" placeholder="Clear explanations, careful research, accessible code…"><label class="world-check"><input type="checkbox" id="world-dialogue" ${a.dialogue ? 'checked' : ''}>Let teacher and student exchange questions</label><fieldset class="world-practice"><legend>Turn a demonstration into practice</legend><label class="world-check"><input type="checkbox" id="world-practice" ${a.practice ? 'checked' : ''}>Let the student try, then ask the teacher for feedback</label><div id="world-practice-options" ${a.practice ? '' : 'hidden'}><label for="world-practice-rounds">Practice + feedback rounds</label><select id="world-practice-rounds">${[1,2,3].map(n=>`<option value="${n}" ${a.practiceRounds===n?'selected':''}>${n} round${n===1?'':'s'} · ${n*2} extra model calls</option>`).join('')}</select><p class="world-help">The student produces its own attempt and the teacher critiques it. Read both responses in Team chat, then review the material before approving a chip.</p></div></fieldset><p class="world-help" id="world-call-plan">${callPlan()}</p><div class="world-actions">${btn('world-launch', '✦ Set out together', 'primary', d.getBusy() ? 'disabled' : '')}${db.mode !== 'demo' && !d.hasKey() ? btn('world-demo', 'Try a sample outing') : ''}${d.getBusy() ? btn('stop', 'Stop outing') : ''}</div><div class="world-starters"><b>A little inspiration</b>${btn('world-preset', '🌼 Explain a big idea simply', '', 'data-preset="teach"')}${btn('world-preset', '📚 Gather evidence, not guesses', '', 'data-preset="research"')}${btn('world-preset', '🛠 Build a tiny interactive garden', '', 'data-preset="code"')}</div><p class="world-help">A chip stores reviewed instructions and examples. Your pets can share chips; hosted weights do not change here.</p>`;
  }
  function panel() {
    const a = state(),
      r = outing();
    if (a.panel === 'mission') return mission();
    if (a.panel === 'field') return d.fieldKit.view();
    if (a.panel === 'results')
      return `<div class="world-result-meta"><span>${r?.demo ? 'Prepared playground output' : r ? 'Returned model output' : 'No model run yet'}</span><small>${h(r?.model || '')}</small></div><pre id="world-response" class="world-response"></pre><div class="world-actions">${btn('world-copy', 'Copy result', '', !output() ? 'disabled' : '')}${btn('world-chip', 'Distill a model chip', 'blue', !r || r.status !== 'complete' || d.getBusy() ? 'disabled' : '')}${r ? btn('world-open-result', 'Open full result') : ''}</div><h3 class="world-section-title">Brought back from the outing</h3><div id="world-resources"></div>`;
    if (a.panel === 'dialogue')
      return `<p class="world-help">Actual messages between the chosen teacher and student models. ${r?.demo ? 'This outing uses prepared sample messages.' : 'The optional question exchange uses two calls; each enabled practice round adds a student attempt and a teacher feedback call.'}</p><div id="world-dialogue-list" class="world-dialogue-list"></div><p class="world-help">The team’s questions, explanations and responses are visible here. The activity log shows observable steps rather than private hidden thoughts.</p><h3 class="world-section-title">Activity & decisions</h3><div id="world-event-list"></div>`;
    if (a.panel === 'steer')
      return `<p class="world-intro">A gentle nudge can change the journey.</p><p class="world-help">Messages sent during a response are queued for the next model step. If the outing finishes first, they remain visibly unused. Sending while idle starts a new guided outing.</p><form id="world-guide-form"><label for="world-guide-target">Send guidance to</label><select id="world-guide-target"><option value="teacher">The teacher / lead model</option><option value="student">The student model</option></select><label for="world-guide-input">Your message</label><textarea id="world-guide-input" maxlength="2000" placeholder="Use a simpler example… check that source… make the button larger…"></textarea><div class="world-actions">${btn('world-guide-send', '➤ Send guidance', 'primary', 'type="submit"')}${d.getBusy() ? btn('stop', 'Stop outing') : ''}</div></form><div id="world-guidance-list" class="world-guidance-list"></div>`;
    return `<p class="world-intro">A world that feels like yours.</p><label for="world-biome">Travel to a biome</label><select id="world-biome">${Object.entries(
      BIOMES,
    )
      .map(
        ([id, title]) =>
          `<option value="${id}" ${a.biome === id ? 'selected' : ''}>${title}</option>`,
      )
      .join(
        '',
      )}</select><div class="world-form-pair"><div><label for="world-time">Light</label><select id="world-time">${['day', 'sunset', 'night', 'auto'].map((x) => `<option ${a.time === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div><label for="world-weather">Weather</label><select id="world-weather">${['clear', 'rain', 'snow', 'fireflies'].map((x) => `<option ${a.weather === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div><label for="world-seed">World seed</label><input id="world-seed" value="${h(a.seed)}" maxlength="80"><p class="world-help">The same seed creates the same landscape. Changing the scenery never changes your model results.</p><div class="world-actions">${btn('world-regenerate', '✧ Grow a new world')}${btn('world-home', '⌂ Back to camp')}</div><label class="world-check"><input id="world-gentle" type="checkbox" ${a.motion === 'reduced' ? 'checked' : ''}>Gentle scenery motion</label><div class="world-world-notes"><b>Who lives here?</b><p>Archivists represent sources. Makers represent files. Reviewers encourage verification. Mischievous enemies and finds are scenery; your real resource basket contains only returned work.</p></div>${places()}<div id="world-metrics" class="world-help"></div>`;
  }
  function renderPanel(force = false) {
    const root = document.getElementById('adventure-root');
    if (!root) return;
    const a = state(),
      pane = document.getElementById('world-panel');
    pane.hidden = !a.panelOpen;
    root.classList.toggle('is-panel-open', a.panelOpen);
    root
      .querySelectorAll('.world-tabs [data-tab]')
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(a.panelOpen && a.panel === b.dataset.tab),
        ),
      );
    if (force || lastPanel !== a.panel) {
      lastPanel = a.panel;
      document.getElementById('world-panel-title').textContent =
        TABS[a.panel][1];
      document.getElementById('world-panel-body').innerHTML = panel();
      lastDialogue = '';
      lastGuidance = '';
      d.paintPets();
      if (a.panelOpen) reveal(pane);
    }
  }
  function refresh() {
    const root = document.getElementById('adventure-root');
    if (!root) return;
    const a = state(),
      r = outing(),
      run = currentRun();
    root.querySelector('[data-world-quest]').textContent =
      r?.skill ||
      r?.prompt?.slice(0, 130) ||
      'A whole world of little “aha!” moments.';
    root.querySelector('[data-world-status]').textContent =
      r?.status === 'running'
        ? (run?.phase || 'The team is working…').replaceAll('-', ' ')
        : r?.status === 'complete'
          ? 'Back at camp. Review what the team brought home.'
          : r?.status === 'failed'
            ? 'This outing paused with an error. Its journal is kept.'
            : r?.status === 'stopped'
              ? 'Stopped. Partial work is safe in the journal.'
              : 'Idle wandering · scenery only, no model calls.';
    root.querySelector('[data-world-mode]').textContent =
      (r?.demo ?? d.getDB().mode === 'demo') ? 'PLAYGROUND' : 'OPENROUTER';
    refreshScene();
    root.querySelector('[data-world-discoveries]').textContent =
      a.visited.length;
    const warning = root.querySelector('[data-world-error]');
    warning.textContent = d.getError?.() || r?.error || '';
    warning.hidden = !warning.textContent;
    const chipButton = root.querySelector('[data-action="world-chip"]');
    if (chipButton)
      chipButton.disabled = !r || r.status !== 'complete' || d.getBusy();
    const copyButton = root.querySelector('[data-action="world-copy"]');
    if (copyButton) copyButton.disabled = !output();
    root
      .querySelector('[data-world-pause]')
      .setAttribute(
        'aria-label',
        a.paused ? 'Resume scenery' : 'Pause scenery',
      );
    root
      .querySelectorAll('[data-world-name]')
      .forEach(
        (el) => (el.textContent = d.getDB().agents[el.dataset.worldName].name),
      );
    root.querySelectorAll('[data-world-role]').forEach(el => {
      el.textContent = el.dataset.worldRole === (r?.agent || a.agent) ? 'Lead / teacher model' : 'Student / companion';
    });
    renderPanel();
    const response = document.getElementById('world-response');
    if (response) {
      const next =
        output().slice(-80000) ||
        'A new adventure begins with your first prompt.';
      if (response.textContent !== next) {
        const bottom =
          response.scrollTop + response.clientHeight >=
          response.scrollHeight - 40;
        response.textContent = next;
        if (bottom) response.scrollTop = response.scrollHeight;
      }
    }
    const list = document.getElementById('world-dialogue-list');
    if (list) {
      const messages = dialogue();
      const signature = JSON.stringify(messages);
      if (signature !== lastDialogue) {
        const near =
          list.scrollTop + list.clientHeight >= list.scrollHeight - 50;
        list.innerHTML = messages.length
          ? messages
              .map(
                (m) =>
                  `<article class="world-speech ${m.agent === (outing()?.agent || state().agent) ? 'teacher' : 'student'}"><div><b>${h(d.getDB().agents[m.agent]?.name || m.agent)}</b><small>${h(m.kind || 'Message')} · ${m.demo ? 'sample' : h(m.model || '')}</small></div><pre>${h(m.text || '…')}</pre>${m.status === 'failed' ? '<small>Response interrupted. Partial text kept.</small>' : ''}</article>`,
              )
              .join('')
          : '<div class="world-empty">The team’s conversation appears here when a tutor exchange begins. Enable it in Mission.</div>';
        lastDialogue = signature;
        if (near) list.scrollTop = list.scrollHeight;
      }
    }
    const events = document.getElementById('world-event-list');
    if (events)
      events.innerHTML = (r?.events || [])
        .slice(-12)
        .map(
          (e) =>
            `<div class="world-event"><i></i><span>${h(e.message)}</span></div>`,
        )
        .join('');
    const guide = document.getElementById('world-guidance-list');
    if (guide) {
      const messages = a.guidance.slice(-12),
        signature = JSON.stringify(messages);
      if (signature !== lastGuidance) {
        guide.innerHTML = messages
          .map(
            (m) =>
              `<article><span>${h(m.target)} · <b>${h(m.status)}</b></span><p>${h(m.text)}</p></article>`,
          )
          .join('');
        lastGuidance = signature;
      }
    }
    const resources = document.getElementById('world-resources');
    if (resources)
      resources.innerHTML =
        (r?.resources || [])
          .map(
            (x) =>
              `<button data-action="world-resource" data-resource="${h(x.id)}"><span>${x.kind === 'source' ? '↗' : x.kind === 'file' ? '▧' : '✦'}</span><b>${h(x.title || x.path || 'Returned result')}</b></button>`,
          )
          .join('') ||
        '<p class="world-help">Files, citations and completed answers appear only when actually returned.</p>';
    const metrics = document.getElementById('world-metrics');
    if (metrics) {
      const m = engine.metrics();
      metrics.textContent = `${m.assets || m.assetCount || 'Many'} generated scenery pieces · discoveries are cosmetic.`;
    }
  }
  function mount() {
    const canvas = document.getElementById('world-canvas');
    if (!canvas) {
      engine.mount(null);
      lastPanel = '';
      return;
    }
    engine.mount(canvas);
    renderPanel(true);
    refresh();
  }
  function inspect(item) {
    selected = item;
    if (!state().visited.includes(item.id)) {
      state().visited.push(item.id);
      state().visited = state().visited.slice(-200);
      d.save();
    }
    const real = item.type === 'resource';
    d.openModal(
      `<span class="eyebrow">${real ? 'Returned work' : 'A LITTLE WORLD DISCOVERY'}</span><h2 id="modal-title">${h(item.title || 'A curious discovery')}</h2><p>${h(item.description || 'A little landmark on the team’s journey.')}</p>${item.actor ? `<div class="row">${mascot(item.actor, true, true)}<b>${h(d.getDB().agents[item.actor]?.name || item.actor)}</b></div>` : ''}<p class="help">${real ? 'Inspect this item against the actual outing output.' : 'Scenery is a playful illustration. Its presence does not prove a model learned a fact or completed an action.'}</p><div class="row">${['landmark','npc','enemy'].includes(item.type) ? btn('world-place-walk', '⌁ Walk here together', '', `data-place="${h(item.id)}"`) : ''}${item.type === 'pet' ? `${btn('world-emote', '♡ A little affection', '', `data-agent="${item.actor || 'milo'}" data-kind="love"`)}${btn('world-emote', '✦ High five', '', `data-agent="${item.actor || 'milo'}" data-kind="cheer"`)}` : ''}${item.type === 'enemy' ? btn('world-befriend', '✿ Befriend this little creature', '', `data-place="${h(item.id)}"`) : ''}</div><div class="world-model-invite"><b>A question for your models</b><p class="help">These buttons send your explicit question to the team. During live work it is queued; while idle it starts a guided model call.</p><div class="row">${btn('world-ask-object', 'Ask the teacher for an analogy', 'blue')}${btn('world-ask-student', 'Ask the student to explain')}</div></div><div class="row">${btn('close', 'Keep exploring')}</div>`,
    );
    refresh();
  }
  async function action(name, data = {}) {
    data = data.dataset || data;
    const a = state();
    if (name === 'world-tab') {
      if (!TABS[data.tab]) return;
      a.panel = data.tab;
      a.panelOpen = true;
      renderPanel(true);
      refresh();
      d.save();
    } else if (name === 'world-close-panel') {
      a.panelOpen = false;
      renderPanel();
      d.save();
    } else if (name === 'world-exit') d.setPage('wilds');
    else if (name === 'world-open-places') {
      a.panel = 'world'; a.panelOpen = true; renderPanel(true); refresh(); d.save();
      document.getElementById('world-place-search')?.focus({preventScroll:true});
      document.querySelector('.world-directory')?.scrollIntoView({block:'nearest',behavior:reduced()?'instant':'smooth'});
    } else if (name === 'world-place-look' || name === 'world-place-walk' || name === 'world-place-inspect') {
      const place = engine.directory().find(p => p.id === data.place);
      if (!place) return;
      if (name === 'world-place-inspect') { engine.command('inspect', {id:place.id}); return; }
      document.getElementById('modal')?.close();
      a.panelOpen = false; renderPanel();
      if (name === 'world-place-look') { engine.command('travel', {id:place.id}); announce(`Camera at ${place.title}. Use Walk together to visit with the companions.`); }
      else { a.follow = outing()?.agent || a.agent; engine.command('walk-to', {id:place.id,agent:a.follow}); announce(`The companions are walking to ${place.title}. Scenic movement uses no model calls.`); }
      refresh(); d.save();
    } else if (name === 'world-resume-walk') {
      engine.command('resume-walk'); announce('The companions continue their scenic adventure.'); refresh();
    } else if (name === 'world-befriend') {
      engine.command('befriend', {id:data.place}); document.getElementById('modal')?.close(); announce('A friendly greeting for a scenic little creature.');
    }
    else if (name === 'world-follow') {
      a.follow = data.agent === 'nova' ? 'nova' : 'milo';
      engine.command('follow', { agent: a.follow });
      engine.command('zoom', { value: a.zoom });
      d.save();
      refresh();
    } else if (name === 'world-home') engine.command('home');
    else if (name === 'world-tour') engine.command('tour');
    else if (name === 'world-fit') engine.command('fit');
    else if (name === 'world-zoom-in' || name === 'world-zoom-out')
      engine.command('zoom', {
        delta: name === 'world-zoom-in' ? 0.15 : -0.15,
      });
    else if (name === 'world-pause') {
      a.paused = !a.paused;
      engine.command('pause', { paused: a.paused });
      refresh();
    } else if (name === 'world-fullscreen') {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else
        await document
          .getElementById('adventure-root')
          .requestFullscreen?.()
          .catch(() => {});
    } else if (name === 'world-regenerate') {
      a.seed = 'pip-' + Math.random().toString(36).slice(2, 9);
      a.visited = [];
      engine.command('regenerate', { seed: a.seed });
      d.save();
      renderPanel(true);
      refresh();
    } else if (name === 'world-preset') {
      const presets = {
        teach: [
          'Explain how the internet delivers a web page to a curious twelve-year-old.',
          'Explain technical concepts with accurate everyday analogies.',
        ],
        research: [
          'Find three well-supported ways to conserve water at home. Cite reliable sources and flag uncertainty.',
          'Careful evidence gathering.',
        ],
        code: [
          'Build a responsive interactive garden planner with add/remove plants and a watering checklist. Use HTML, CSS and JavaScript.',
          'Accessible, understandable web code.',
        ],
      };
      const p = presets[data.preset];
      if (p) {
        a.goal = p[0];
        a.skill = p[1];
        a.kind = data.preset;
        d.save();
        renderPanel(true);
      }
    } else if (name === 'world-launch') {
      if (d.getBusy()) return d.toast('Finish or stop this outing first.');
      if (!a.goal.trim())
        return d.toast('Give the team a specific goal first.');
      a.panelOpen = false;
      a.follow = a.agent;
      engine.command('follow', { agent: a.agent });
      engine.command('zoom', { value: a.zoom });
      renderPanel();
      await d.launch(a.kind, a.goal, a.agent, {
        skill: a.skill,
        biome: a.biome,
        objects: CLASSROOMS[a.biome],
        dialogue: a.dialogue,
        practice: a.practice,
        practiceRounds: a.practiceRounds,
        streaming: true,
        page: 'adventure',
      });
      refresh();
    } else if (name === 'world-demo') {
      d.setDemo();
      a.panelOpen = true;
      a.panel = 'mission';
      renderPanel(true);
      refresh();
    } else if (name === 'world-guide-send') return;
    else if (name === 'world-copy') {
      try {
        await navigator.clipboard.writeText(output());
        d.toast('Result copied.');
      } catch {
        d.toast('Select the result text to copy it.');
      }
    } else if (name === 'world-chip') {
      if (outing()) await d.teach(outing());
    } else if (name === 'world-open-result') {
      if (outing()) d.openResult(outing());
    } else if (name === 'world-resource') {
      const r = outing()?.resources?.find((x) => x.id === data.resource);
      if (r)
        d.openModal(
          `<h2 id="modal-title">${h(r.title || r.path)}</h2><pre class="output">${h(r.excerpt || r.url || 'Open the full result to inspect this item.')}</pre>${r.url && /^https?:\/\//.test(r.url) ? `<p><a href="${h(r.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a></p>` : ''}${btn('close', 'Back to the world')}`,
        );
    } else if (name === 'world-emote')
      engine.command('emote', { agent: data.agent, kind: data.kind || 'cheer' });
    else if ((name === 'world-ask-object' || name === 'world-ask-student') && selected) {
      document.getElementById('modal').close();
      await d.guide(
        `For the current task, ${name === 'world-ask-student' ? 'explain in your own words what you understand and where you are uncertain, using' : 'explain how'} the illustrated ${selected.title} ${name === 'world-ask-student' ? 'as an example' : 'can serve as a useful analogy'}. State the analogy’s limits and keep the topic facts accurate.`,
        name === 'world-ask-student' ? 'student' : 'teacher',
      );
      a.panel = 'steer';
      a.panelOpen = true;
      renderPanel(true);
      refresh();
    }
  }
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'world-guide-form') return;
    e.preventDefault();
    const input = document.getElementById('world-guide-input'),
      message = input.value.trim();
    if (!message) return;
    const target = document.getElementById('world-guide-target').value;
    try {
      await d.guide(message, target);
      input.value = '';
      refresh();
    } catch (err) {
      d.toast(err.message);
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target,
      a = state();
    if (t.id === 'world-goal') a.goal = t.value.slice(0, 12000);
    else if (t.id === 'world-skill') a.skill = t.value.slice(0, 1000);
    else if (t.id === 'world-place-search') { placeSearch = t.value.slice(0,80); document.getElementById('world-place-list').innerHTML = placeCards(); return; }
    else return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(d.save, 250);
  });
  document.addEventListener('change', (e) => {
    const t = e.target,
      a = state();
    const fields = {
      'world-kind': 'kind',
      'world-agent': 'agent',
      'world-biome': 'biome',
      'world-time': 'time',
      'world-weather': 'weather',
      'world-seed': 'seed',
    };
    if (fields[t.id]) {
      a[fields[t.id]] = t.value.slice(0, t.id === 'world-seed' ? 80 : 40);
      if (t.id === 'world-seed') engine.command('regenerate', { seed: a.seed });
      if (t.id === 'world-biome') engine.command('biome', { biome: a.biome });
      d.save();
      refresh();
    } else if (t.id === 'world-dialogue') {
      a.dialogue = t.checked;
      d.save();
      const plan = document.getElementById('world-call-plan'); if (plan) plan.textContent = callPlan();
    } else if (t.id === 'world-practice' || t.id === 'world-practice-rounds') {
      if (t.id === 'world-practice') a.practice = t.checked;
      else a.practiceRounds = Math.min(3,Math.max(1,Number(t.value)||1));
      const options = document.getElementById('world-practice-options'); if (options) options.hidden = !a.practice;
      const plan = document.getElementById('world-call-plan'); if (plan) plan.textContent = callPlan(); d.save();
    } else if (t.id === 'world-place-filter') {
      placeFilter = ['all','landmark','npc','enemy'].includes(t.value) ? t.value : 'landmark';
      document.getElementById('world-place-list').innerHTML = placeCards();
    } else if (t.id === 'world-gentle') {
      a.motion = t.checked ? 'reduced' : 'full';
      d.save();
      refreshScene();
    }
  });
  return {
    view,
    mount,
    refresh,
    action,
    emote: (agent, kind) => engine.command('emote', { agent, kind }),
    invalidate() {
      lastPanel = '';
      if (document.getElementById('adventure-root')) {
        renderPanel(true);
        refresh();
      }
    },
    metrics: () => engine.metrics(),
    destroy: () => engine.mount(null),
  };
}
