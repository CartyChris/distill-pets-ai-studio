// The trail is an explanation of real workspace actions. No completion checkboxes,
// remote requests, or API credentials are kept here.
const PRESETS = {
  rainbow: {
    name: 'The rainbow storyteller',
    symbol: '🌈',
    skill: 'Explain a science idea simply and accurately',
    audience: 'A curious eight-year-old',
    criteria: 'Accurate facts; one everyday analogy; short sentences; one curiosity question.',
    teacherPrompt: 'Explain how a rainbow forms to a curious child.',
    heldOutPrompt: 'Explain why the Moon seems to change shape to a curious eight-year-old. Use an everyday analogy, keep the facts accurate, and end with one curiosity question.',
    hint: 'Turn a tricky idea into a little “aha!”',
  },
  email: {
    name: 'The warm welcome writer',
    symbol: '💌',
    skill: 'Write a warm, concise welcome email',
    audience: 'A new community member',
    criteria: 'Friendly greeting; under 150 words; one clear next step; no invented details.',
    teacherPrompt: 'Write a warm, concise welcome email for a new community member.',
    heldOutPrompt: 'Write a warm email welcoming a first-time volunteer to a neighborhood garden. Keep it under 150 words, invite them to reply with their availability, and do not invent meeting dates or contact details.',
    hint: 'Make words feel like a friendly wave.',
  },
  plan: {
    name: 'The tiny steps planner',
    symbol: '🪜',
    skill: 'Create a practical seven-day learning plan',
    audience: 'A complete beginner with 20 minutes a day',
    criteria: 'Seven numbered days; one small activity per day; a visible result; a final self-check.',
    teacherPrompt: 'Make a practical, seven-day plan for learning the basics of JavaScript.',
    heldOutPrompt: 'Make a seven-day plan for a complete beginner to learn the basics of taking better photos with a phone. Allow 20 minutes a day, give one small activity and visible result each day, and finish with a practical self-check.',
    hint: 'Help a big goal fit into a small day.',
  },
};

const STEP_NAMES = ['Pick a superpower', 'Collect good work', 'Review a chip', 'Equip a companion', 'Try a fresh task'];
const VOTES = new Set(['With the lesson', 'Without the lesson', 'About the same']);
const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const hasText = value => typeof value === 'string' && !!value.trim();
const bounded = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : '';
const defaultEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function cleanAcademy(value) {
  const result = { goal: null, step: 1, chipId: '', quizAnswer: '' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  if (Number.isInteger(value.step) && value.step >= 1 && value.step <= 5) result.step = value.step;
  result.chipId = safeId(value.chipId);
  result.quizAnswer = ['context', 'weights', 'universal'].includes(value.quizAnswer) ? value.quizAnswer : '';
  const candidate = value.goal;
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const goal = {
      preset: Object.hasOwn(PRESETS, candidate.preset) ? candidate.preset : 'custom',
      skill: bounded(candidate.skill, 140),
      audience: bounded(candidate.audience, 160),
      criteria: bounded(candidate.criteria, 800),
      teacherPrompt: bounded(candidate.teacherPrompt, 2000),
      heldOutPrompt: bounded(candidate.heldOutPrompt, 2000),
    };
    if (goal.skill && goal.audience && goal.criteria && goal.teacherPrompt && goal.heldOutPrompt) result.goal = goal;
  }
  return result;
}

export function academyProgress(db) {
  const state = cleanAcademy(db?.academy);
  const goal = state.goal;
  const tasks = Array.isArray(db?.tasks) ? db.tasks : [];
  const lessons = Array.isArray(db?.lessons) ? db.lessons : [];
  const comparisons = Array.isArray(db?.comparisons) ? db.comparisons : [];
  const matchingTasks = goal ? tasks.filter(t => t && normalize(t.prompt) === normalize(goal.teacherPrompt) && hasText(t.text) && !t.error && !t.truncated && (!t.status || t.status === 'complete')) : [];
  const matchingChips = goal ? lessons.filter(l => l && hasText(l.instructions) && Array.isArray(l.examples) && l.examples.some(e => e && normalize(e.prompt) === normalize(goal.teacherPrompt) && hasText(e.completion))) : [];
  const reviewedChips = matchingChips.filter(l => l.approved === true && l.reviewed === true);
  const chip = reviewedChips.find(l => l.id === state.chipId)
    || reviewedChips.find(l => l.id === db?.activeLesson)
    || reviewedChips.at(-1)
    || matchingChips.find(l => l.id === state.chipId)
    || matchingChips.at(-1)
    || null;
  const chipReviewed = !!chip && chip.approved === true && chip.reviewed === true;
  const agents = Object.entries(db?.agents || {}).filter(([, agent]) => agent && chipReviewed && agent.chipId === chip.id);
  // A task already used in any chip is not held out, even when a different chip
  // supplied it. Exact reuse is checked here; people must also check near-duplicates.
  const taughtPrompts = new Set(lessons.flatMap(l => Array.isArray(l?.examples) ? l.examples.map(e => normalize(e?.prompt)) : []).filter(Boolean));
  const freshComparisons = chipReviewed ? comparisons.filter(c => c && c.lessonId === chip.id && !!c.demo === !!chip.demo && hasText(c.prompt) && hasText(c.baseline) && hasText(c.learned) && !c.error && !c.truncated && !taughtPrompts.has(normalize(c.prompt)) && normalize(c.prompt) !== normalize(goal.teacherPrompt)) : [];
  const reviewedComparison = freshComparisons.filter(c => VOTES.has(c.vote)).at(-1) || null;
  const steps = [!!goal, matchingTasks.length > 0, chipReviewed, agents.length > 0, !!reviewedComparison];
  return { state, goal, matchingTasks, matchingChips, reviewedChips, chip, agents, freshComparisons, reviewedComparison, steps, completed: steps.filter(Boolean).length };
}

export function academyFieldGuide(db) {
  const p = academyProgress(db);
  const goal = p.goal;
  return `# Distill Pets AI Studio's little distillation field guide\n\nSaved locally. No API key or private credentials are included.\n\n## Your experiment\n\nSkill: ${goal?.skill || 'Choose one narrow task.'}\nAudience: ${goal?.audience || 'Choose who the result is for.'}\nSuccess criteria: ${goal?.criteria || 'Write measurable checks before you start.'}\n\nTeacher task:\n${goal?.teacherPrompt || '(Choose a teaching example in the Distillation trail.)'}\n\nReserved held-out task:\n${goal?.heldOutPrompt || '(Choose a different task, and keep it out of the teaching examples.)'}\n\n## Two different routes\n\nInstructions and examples: Distill Pets AI Studio extracts reusable rules from approved teacher output. A model chip stores those rules, examples, a base-model ID, and revisions. Equipping it supplies that context on subsequent model calls. Hosted model weights remain unchanged. This can improve the requested behavior, but it is not a guarantee.\n\nSequence distillation: train a student on approved outputs produced by a teacher. Supervised fine-tuning (SFT) updates the student's weights using prompt/answer training examples. Traditional knowledge distillation can instead match teacher probability distributions; chat JSONL alone does not contain those distributions. OpenRouter inference does not provide a universal fine-tuning API.\n\n## Five-step checklist\n\n1. Choose a narrow skill, audience, and observable success criteria.\n2. Ask a teacher for good examples. Check facts, rights, private information, format, and tone. Reject inaccurate or unfinished answers. Use visible outputs, not hidden reasoning.\n3. Distill a chip. Review the instructions, remove task-specific facts, and save an approved revision.\n4. Equip a companion with the chip. The chip belongs to the model configuration; the pet is its interface.\n5. Compare the same learner model with and without the chip on a fresh held-out task. Review both answers. An unchanged or worse answer is useful evidence, too.\n\n## Make a stronger experiment\n\n- One example is a tutorial, not evidence of broad improvement. Collect varied, correct examples with edge cases and typical failures.\n- Reserve a held-out evaluation set before refining your instructions. Avoid exact copies and near-duplicates. Never add evaluation answers to the training set while using them as a test.\n- Keep the base model, test prompt, output limit, and relevant settings consistent. Generation is stochastic; repeat on multiple fresh tasks before claiming a gain.\n- Rate factual accuracy, audience fit, structure, and usefulness. Record costs and failures, not only the best answer.\n- Iterate: inspect a failure, improve a rule or example, save a new revision, and test on another fresh task.\n- A watching agent receives a bounded stream/context. That is observation, not an automatic update of model weights. Recursive review makes extra calls and is bounded; it does not autonomously retrain the model.\n\n## External weight-training route\n\n1. Create and review real live teaching examples. Playground samples are practice and must stay out of training exports.\n2. Export approved live examples as JSONL from Model chips. Review the exported file and confirm permission to use its contents.\n3. Split training and validation data, remove duplicates, and follow the trainer's specific schema and minimum dataset requirements.\n4. Use a provider or local trainer that supports training the student model and for which you have access and permission. Choose parameters and a budget appropriate to that model. Distill Pets AI Studio does not launch this training job.\n5. Evaluate the trained student on the untouched held-out set.\n6. The trained weights need a separate deployment endpoint. Serving the student through OpenRouter requires an available, authorized provider/model ID; exporting a dataset does not create one. This Distill Pets AI Studio harness calls OpenRouter chat inference.\n\nExample JSONL row shape (replace placeholders with reviewed live content):\n\n{ "messages": [ { "role": "system", "content": "Your base instructions" }, { "role": "user", "content": "A teaching prompt" }, { "role": "assistant", "content": "The approved teacher answer" } ] }\n\n## Calls and cost\n\nA minimal trail uses 4 model calls: 1 teacher response, 1 teacher distillation, and 2 learner comparison calls. Deep work adds a quality pass, bringing it to 5 calls. Selecting goals, editing, equipping, exports, and this guide use 0 model calls. Playground uses prepared samples and no API credits.\n\nActual cost depends on input, output, reasoning, selected model/provider prices, retries, and optional search. Instructions and example context increase input tokens. A chip does not inherently make each request cheaper. Stop prevents additional steps but an already submitted call may still be billed.\n\n## Tiny glossary\n\nTeacher: the model producing the examples you approve.\nStudent: the model receiving examples or undergoing a separate training process.\nChip: a portable configuration of a base model, instructions, examples, and revision history.\nWeights: the learned numeric parameters changed by model training.\nHeld-out task: a test never used as a teaching example.\nSFT: supervised fine-tuning on input/output examples.\nRevision: a saved change you can compare and roll back by equipping an earlier chip.\n\n## What your workspace currently shows\n\n${p.completed}/5 trail steps have supporting workspace records.\nTeacher responses for this goal: ${p.matchingTasks.length}.\nReviewed chips for this goal: ${p.reviewedChips.length}.\nFresh comparisons reviewed by you for the selected chip: ${p.reviewedComparison ? 1 : 0}.\n\nProgress reflects local records, not certification or a claim of model quality. Export a workspace backup to keep those records.\n`;
}

export function createAcademy(deps = {}) {
  const h = deps.escape || defaultEscape;
  const icon = deps.icon || (() => '');
  const mascot = deps.mascot || (() => '<span aria-hidden="true">🦊</span>');
  const btn = deps.button || ((action, label, cls = '', attrs = '') => `<button data-action="${h(action)}" class="${h(cls)}" ${attrs}>${label}</button>`);
  const toast = deps.toast || (() => {});
  const database = () => deps.getDB?.() || {};
  const state = () => {
    const db = database();
    db.academy = cleanAcademy(db.academy);
    return db.academy;
  };
  const persist = () => { deps.save?.(); deps.render?.(); };
  const go = page => { deps.setPage?.(page); };
  const busy = () => !!deps.getBusy?.();
  const read = (id, fallback = '') => deps.readField ? deps.readField(id, fallback) : typeof document !== 'undefined' ? document.getElementById(id)?.value ?? fallback : fallback;
  const money = amount => amount === 0 ? '$0.00' : '$' + (amount < 0.01 ? amount.toFixed(4) : amount.toFixed(2));

  function costCard(db, p) {
    const deep = !!db.deep;
    const calls = deep ? 5 : 4;
    const catalog = deps.getModels?.() || [];
    const teacher = catalog.find(m => m.id === db.agents?.milo?.model);
    const learner = catalog.find(m => m.id === (p.chip?.baseModel || db.agents?.nova?.model));
    const rate = model => {
      const input = Number(model?.pricing?.prompt);
      const output = Number(model?.pricing?.completion);
      return model && Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0 ? input * 1000 + output * 600 : null;
    };
    const t = rate(teacher), l = rate(learner);
    const estimate = t !== null && l !== null ? money(t * (deep ? 3 : 2) + l * 2) : null;
    return `<article class="card academy-cost"><span class="eyebrow">Small steps, visible costs</span><h3>${db.mode === 'demo' ? 'Practice for $0' : `${calls} calls for one complete experiment`}</h3><p class="help">${db.mode === 'demo' ? 'Prepared playground samples · no API credits · no key needed.' : `Teacher: ${deep ? '2 calls with Deep work' : '1 call'}. Distill: 1 call. Compare: 2 calls on the same learner.`}</p><p class="help">${estimate && db.mode !== 'demo' ? `<b>${estimate} illustrative total</b> at the selected catalog prices, assuming 1,000 input + 600 output tokens per call. ` : ''}Actual live costs vary with tokens, reasoning, provider prices, retries, and optional search. Example context adds input tokens.</p><p class="help">Choose, review, equip, and export: <b>0 model calls</b>. A stop cannot undo credits for a call already submitted.</p></article>`;
  }

  function stepOne(p) {
    const g = p.goal;
    return `<p class="help">Teach one useful trick at a time. A clear audience and success checks make the experiment easier to judge.</p>${btn('academy-page', 'Create a new superpower', 'blue', 'data-page="powers"')}<div class="academy-presets">${Object.entries(PRESETS).map(([id, preset]) => `<article class="academy-preset ${g?.preset === id ? 'chosen' : ''}"><span class="academy-symbol" aria-hidden="true">${preset.symbol}</span><h3>${h(preset.name)}</h3><p class="help">${h(preset.hint)}</p>${btn('academy-preset', g?.preset === id ? 'Use this goal again' : 'Choose this goal', g?.preset === id ? 'blue' : '', `data-preset="${id}"`)}</article>`).join('')}</div>${g ? `<div class="academy-goal"><label class="label" for="academy-skill">The one skill we are teaching</label><input id="academy-skill" maxlength="140" value="${h(g.skill)}"><label class="label" for="academy-audience">Who is this for?</label><input id="academy-audience" maxlength="160" value="${h(g.audience)}"><label class="label" for="academy-criteria">What does a good answer need?</label><textarea id="academy-criteria" maxlength="800">${h(g.criteria)}</textarea><details class="academy-details"><summary>Customize the teaching and test tasks</summary><label class="label" for="academy-teacher-prompt">Teaching task</label><textarea id="academy-teacher-prompt" maxlength="2000">${h(g.teacherPrompt)}</textarea><label class="label" for="academy-heldout">Reserved fresh test</label><textarea id="academy-heldout" maxlength="2000">${h(g.heldOutPrompt)}</textarea><p class="help">Keep the test out of your teaching examples. Change the subject or scenario while keeping the same skill.</p></details><div class="row academy-actions">${btn('academy-save-goal', 'Save my goal', 'primary')}${btn('academy-step', 'Collect an example →', '', 'data-step="2"')}</div><p class="help">Progress follows these actual prompts, chips, and comparisons. Editing your goal may change which records count.</p></div>` : '<div class="notice">Pick a starter above. Then change the audience or goal to make it yours.</div>'}`;
  }

  function stepTwo(p) {
    if (!p.goal) return needGoal();
    const task = p.matchingTasks.at(-1);
    return optionalOuting() + `<p>Ask your teacher for an example of the skill. Read the answer before teaching it to anyone.</p><div class="academy-task"><span class="eyebrow">Your teaching task</span><p class="output">${h(p.goal.teacherPrompt)}</p></div><div class="row academy-actions">${btn('academy-teacher', `${icon('send')} Prepare a task for Milo`, 'primary', busy() ? 'disabled' : '')}${btn('academy-page', 'Models & connection', '', 'data-page="settings"')}</div><p class="help">Preparing the task uses no credits. You choose Playground or Live in Settings and press Send when ready.</p><div class="academy-checks"><b>Before approving, ask:</b><p>Is it correct? Does it fit ${h(p.goal.audience)}? Does it meet your checks? Is it complete? Do you have permission to use it?</p><p class="help">Your checks: ${h(p.goal.criteria)}</p></div>${task ? `<div class="notice"><b>${p.matchingTasks.length} completed response${p.matchingTasks.length === 1 ? '' : 's'} collected</b>${task.demo ? ' · Playground practice' : ' · Live model output'}<br>Review the latest answer, then use <b>Distill model chip</b> only if you would want another model to learn from it.</div><div class="row academy-actions">${btn('academy-review-example', 'Review & distill this answer', 'blue', `data-id="${h(task.id)}" ${busy() ? 'disabled' : ''}`)}</div>` : '<p class="help">This step becomes complete when a finished response to your teaching task is saved in Workspace. Failed or truncated responses do not count.</p>'}<details class="academy-details"><summary>How many examples should I collect?</summary><p class="help">One is enough to learn the interface. For dependable behavior, gather varied, verified examples: typical cases, edge cases, and common failures. A single charming answer cannot prove broad improvement.</p></details>`;
  }

  function stepThree(p) {
    if (!p.goal) return needGoal();
    return `<p>A chip carries the useful technique: a base model, reusable rules, approved examples, and revisions.</p><div class="notice"><b>The review is the learning moment.</b><br>Keep general techniques. Remove copied task facts, unsupported promises, and rules that conflict. Your hosted model’s weights stay unchanged.</div>${p.matchingChips.length ? p.matchingChips.slice().reverse().slice(0, 5).map(l => `<article class="academy-chip-item"><div class="row between"><h3>${h(l.title || 'Your model chip')}</h3><span class="chip">${l.reviewed === true && l.approved === true ? 'Reviewed' : 'Needs review'}${l.demo ? ' · Practice' : ''}</span></div><p class="help">${h(l.baseModel || 'Select a base model')} · revision ${Number(l.revision) || 1} · ${l.examples.length} example${l.examples.length === 1 ? '' : 's'}</p><pre class="output academy-instructions">${h(l.instructions)}</pre><div class="row academy-actions">${btn('academy-review-chip', 'Review or edit instructions', 'blue', `data-id="${h(l.id)}" ${busy() ? 'disabled' : ''}`)}${l.reviewed === true && l.approved === true ? btn('academy-select-chip', p.chip?.id === l.id ? 'Selected for this trail' : 'Use this chip', '', `data-id="${h(l.id)}"`) : ''}</div></article>`).join('') : `<p class="help">No chip for this goal yet. Collect an example, review the answer, and distill it from Workspace.</p>${btn('academy-step', 'Back to the teaching example', 'primary', 'data-step="2"')}`}<p class="help">A generated draft does not complete this step. Save an approved instruction review. Chips stay in Model chips, ready to equip or export.</p>`;
  }

  function stepFour(p, db) {
    if (!p.goal) return needGoal();
    if (!p.chip || !p.steps[2]) return `<p>Review and save a chip before giving it to a companion.</p>${btn('academy-step', 'Review a chip first', 'primary', 'data-step="3"')}`;
    const modeMatches = !!p.chip.demo === (db.mode === 'demo');
    return `<p>Your companion is the face; the chip is its model configuration. Move the same chip between pets without repeating distillation.</p><span class="chip">Selected: ${h(p.chip.title || 'Model chip')}</span><div class="two academy-companions">${Object.entries(db.agents || {}).map(([id, agent]) => `<article class="academy-companion"><div class="row">${mascot(id)}<div><h3>${h(agent.name || id)}</h3><p class="help">${agent.chipId === p.chip.id ? 'Equipped with this chip' : 'Ready for a new trick'}</p></div></div>${btn('academy-equip', agent.chipId === p.chip.id ? 'Already equipped ✓' : `Equip ${h(agent.name || id)}`, 'blue', `data-agent="${h(id)}" data-id="${h(p.chip.id)}" ${busy() || !modeMatches || agent.chipId === p.chip.id ? 'disabled' : ''}`)}</article>`).join('')}</div>${!modeMatches ? `<div class="notice">This is a ${p.chip.demo ? 'playground' : 'live'} chip. Switch to ${p.chip.demo ? 'Playground' : 'Live'} in Settings before equipping it here. Playground examples stay out of live model work.</div>${btn('academy-page', 'Open Settings', '', 'data-page="settings"')}` : ''}<p class="help">Equipping makes no API call. The chip's base model and context power future tasks. Treats and play affect the pet's mood; they do not train a model.</p><div class="row academy-actions">${btn('academy-page', 'Visit the learning garden', '', 'data-page="pets"')}${btn('academy-step', 'Try the skill on a fresh task →', 'primary', 'data-step="5"')}</div>`;
  }

  function stepFive(p) {
    if (!p.goal) return needGoal();
    if (!p.chip || !p.steps[2]) return `<p>A reviewed chip gives us something to test.</p>${btn('academy-step', 'Review your chip first', 'primary', 'data-step="3"')}`;
    const c = p.reviewedComparison;
    return `<p>Give the same learner model a new challenge twice: once with the chip, once without it. A new subject helps test whether the approach transfers.</p><div class="academy-task"><span class="eyebrow">Reserved fresh test</span><p class="output">${h(p.goal.heldOutPrompt)}</p></div><div class="row academy-actions">${btn('academy-compare', `${icon('compare')} Prepare a fair comparison`, 'primary', busy() ? 'disabled' : '')}${btn('academy-page', 'See comparisons', '', 'data-page="compare"')}</div><p class="help">Preparing is free. Press <b>Compare responses</b> there to make 2 learner calls. Keep the model, prompt, and output limit the same.</p><div class="academy-checks"><b>Judge both answers by the same checks</b><p>${h(p.goal.criteria)}</p><p class="help">Record “With the lesson,” “Without the lesson,” or “About the same.” A result that does not improve is still an honest completed experiment.</p></div>${c ? `<div class="notice"><b>Experiment reviewed ✓</b><br>Your judgment: ${h(c.vote)}${c.demo ? ' · Playground practice' : ' · Live comparison'}. The trail is complete when all five steps have records.</div><p class="help">Try several genuinely different held-out tasks before claiming improvement. One comparison is a starting point.</p><div class="row academy-actions">${btn('academy-step', 'Improve the chip & try again', 'blue', 'data-step="3"')}${btn('academy-guide', `${icon('download')} Keep my field guide`)}</div>` : `<p class="help">${p.freshComparisons.length ? 'A fresh comparison exists. Review both answers and save your judgment in Compare to finish.' : 'This step completes after a comparison on an unused prompt has two finished responses and your saved judgment.'}</p>`}<details class="academy-details"><summary>What makes a test genuinely held out?</summary><p class="help">Keep it out of every teaching example. Distill Pets AI Studio checks exact prompt reuse; also check paraphrases and near-duplicates yourself. For stronger evidence, reserve several tests before you refine the chip and keep them untouched. Generation varies, so repeat carefully.</p></details>`;
  }

  function needGoal() {
    return `<p>Choose a narrow skill so the trail can follow your actual work.</p>${btn('academy-step', 'Choose a starter goal', 'primary', 'data-step="1"')}`;
  }

  function optionalOuting() {
    return `<details class="academy-details academy-outing"><summary>Want a learning adventure, too?</summary><p>Take a teacher and learner into the Wilds for optional practice in a chosen skill. Watch the lesson unfold together, then review what was useful.</p><p class="help">Outings have their own activity records. This trail follows the teaching task you saved above. A pet adventure does not change hosted model weights.</p>${btn('academy-page', 'Explore the Wilds', 'blue', 'data-page="wilds"')}</details>`;
  }

  function view() {
    const db = database(), p = academyProgress(db), step = p.state.step;
    const panels = [() => stepOne(p), () => stepTwo(p), () => stepThree(p), () => stepFour(p, db), () => stepFive(p)];
    const feedback = {
      context: '<b>Exactly.</b> The next request receives the chip’s instructions and examples. Weights change only in a separate training process.',
      weights: '<b>Try this distinction:</b> equipping adds context to a request. Updating numeric weights requires a separate fine-tuning or distillation training job.',
      universal: '<b>Model support matters.</b> Distill Pets AI Studio uses text chat models on OpenRouter. Training requires a trainer and a model you have access and permission to modify.',
    };
    return `<div class="academy"><section class="card academy-intro"><div><span class="eyebrow">The distillation trail</span><h2>A tiny trick.<br>A new little superpower.</h2><p>Like the way one model works? Turn its best example into a chip, let a companion try it, and find out whether it helps.</p><div class="row">${btn('academy-step', p.goal ? 'Continue my trail' : 'Start with a tiny goal', 'primary', `data-step="${p.goal ? p.steps.findIndex(done => !done) < 0 ? 5 : p.steps.findIndex(done => !done) + 1 : 1}"`)}${btn('academy-guide', `${icon('download')} Pocket field guide`)}</div></div><div class="academy-scene" aria-hidden="true">${mascot('milo', true)}<span class="academy-scene-chip">✦<small>chip</small></span>${mascot('nova', true)}<span class="academy-scene-note">“Show me that trick!”</span></div></section><div class="notice academy-truth"><b>Start here: instruction & example distillation.</b><br>Distill Pets AI Studio distills reusable rules into a model chip. Equipping it changes the context sent to a model; hosted weights stay unchanged. Actual weight training has its own route below.</div><section class="academy-progress" aria-label="Your distillation progress"><div class="row between"><b>${p.completed} of 5 steps with workspace evidence</b><span class="help">${db.mode === 'demo' ? 'Playground practice' : 'Live workspace'}</span></div><div class="meter" role="progressbar" aria-label="Distillation trail completion" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${p.completed}"><i style="width:${p.completed * 20}%"></i></div><nav class="academy-trail" aria-label="Distillation steps">${STEP_NAMES.map((name, i) => btn('academy-step', `<span class="academy-step-number" aria-hidden="true">${p.steps[i] ? '✓' : i + 1}</span><span>${name}<small>${p.steps[i] ? 'Evidence saved' : 'To explore'}</small></span>`, `academy-trail-step ${step === i + 1 ? 'current' : ''} ${p.steps[i] ? 'complete' : ''}`, `data-step="${i + 1}" ${step === i + 1 ? 'aria-current="step"' : ''} aria-label="Step ${i + 1}: ${name}${p.steps[i] ? ', evidence saved' : ''}"`)).join('')}</nav></section><section class="card academy-panel" id="academy-panel" aria-labelledby="academy-step-heading"><div class="row between"><div><span class="eyebrow">Step ${step} of 5</span><h2 id="academy-step-heading">${STEP_NAMES[step - 1]}</h2></div><span class="academy-panel-symbol" aria-hidden="true">${['🌱', '🧺', '✦', '🦊', '🔍'][step - 1]}</span></div>${panels[step - 1]()}<div class="row between academy-pagination">${btn('academy-step', '← Previous', '', `data-step="${Math.max(1, step - 1)}" ${step === 1 ? 'disabled' : ''}`)}<span class="help">Explore at your own pace</span>${btn('academy-step', 'Next →', '', `data-step="${Math.min(5, step + 1)}" ${step === 5 ? 'disabled' : ''}`)}</div></section><div class="two academy-bottom">${costCard(db, p)}<article class="card academy-quiz"><span class="eyebrow">A tiny understanding check</span><h3>What changes when you equip a chip?</h3><div class="academy-quiz-options">${[['context', 'The instructions & examples in the next request'], ['weights', 'The hosted model’s numeric weights'], ['universal', 'Every model becomes trainable']].map(([id, label]) => btn('academy-quiz', label, p.state.quizAnswer === id ? 'blue' : '', `data-answer="${id}" aria-pressed="${p.state.quizAnswer === id}"`)).join('')}</div>${p.state.quizAnswer ? `<p class="academy-feedback" role="status">${feedback[p.state.quizAnswer]}</p>` : '<p class="help">Optional, free, and separate from your task progress.</p>'}</article></div><section class="card academy-deeper"><details class="academy-details"><summary>I want real model weight distillation</summary><p>Sequence distillation means training a student on a teacher’s approved outputs. Supervised fine-tuning (SFT) updates weights. Traditional distillation can match probability distributions; a chat-output JSONL export alone does not include those distributions.</p><ol><li>Collect varied <b>live</b> examples, review facts and data rights, and reserve a separate held-out set.</li><li>Export approved live training JSONL from Model chips. Playground samples and unreviewed examples are excluded.</li><li>Use a trainer that supports a model you have access and permission to modify. Follow its schema, dataset requirements, and budget. Distill Pets AI Studio does not run a training job.</li><li>Evaluate before deploying. Trained weights need their own <b>deployment endpoint</b>. OpenRouter access requires a provider-supported model ID; an export does not create one.</li></ol><p class="help">This harness calls OpenRouter chat inference. Training support and serving availability depend on the model and provider. There is no universal “train any OpenRouter model” API.</p>${btn('academy-page', 'Open Model chips & exports', '', 'data-page="lessons"')}</details><details class="academy-details"><summary>A pocket glossary</summary><dl class="academy-glossary"><dt>Teacher / learner</dt><dd>Models producing examples and trying the learned approach. The same model can play both roles.</dd><dt>Model chip</dt><dd>A base-model configuration with distilled rules, approved examples, and revision history.</dd><dt>Held-out task</dt><dd>A fresh challenge never used as a teaching example. It tests transfer.</dd><dt>Weights / SFT</dt><dd>Learned numeric parameters / supervised fine-tuning that changes them in a separate training job.</dd><dt>Live observation</dt><dd>A bounded stream of another agent’s output added to context. It does not silently retrain a model.</dd><dt>Recursive review</dt><dd>Extra, bounded generate-and-review passes. Check the result; repeated review can still repeat a mistake.</dd></dl></details></section></div>`;
  }

  function action(actionName, dataset = {}) {
    if (typeof actionName !== 'string' || !actionName.startsWith('academy-')) return false;
    const db = database();
    const current = state();
    const p = academyProgress(db);
    if (actionName === 'academy-preset') {
      const preset = Object.hasOwn(PRESETS, dataset.preset) ? PRESETS[dataset.preset] : null;
      if (!preset) return true;
      current.goal = cleanAcademy({ goal: { ...preset, preset: dataset.preset } }).goal;
      current.chipId = '';
      current.step = 1;
      persist();
      toast('Your starter goal is saved. Make it yours, then collect an example.');
    } else if (actionName === 'academy-save-goal') {
      if (!current.goal) return true;
      const previous = current.goal;
      const next = cleanAcademy({ goal: {
        preset: previous.preset,
        skill: read('academy-skill', previous.skill),
        audience: read('academy-audience', previous.audience),
        criteria: read('academy-criteria', previous.criteria),
        teacherPrompt: read('academy-teacher-prompt', previous.teacherPrompt),
        heldOutPrompt: read('academy-heldout', previous.heldOutPrompt),
      } }).goal;
      if (!next) { toast('Add a skill, audience, checks, teaching task, and fresh test.'); return true; }
      if (normalize(next.teacherPrompt) === normalize(next.heldOutPrompt)) { toast('Give the fresh test a different task from the teaching example.'); return true; }
      const starter = PRESETS[next.preset];
      if (!starter || ['skill', 'audience', 'criteria', 'teacherPrompt', 'heldOutPrompt'].some(field => next[field] !== starter[field])) next.preset = 'custom';
      current.goal = next;
      if (normalize(next.teacherPrompt) !== normalize(previous.teacherPrompt)) current.chipId = '';
      current.step = 2;
      persist();
      toast('Goal saved. Your teaching and test tasks are kept separate.');
    } else if (actionName === 'academy-step') {
      const next = Number(dataset.step);
      if (Number.isInteger(next) && next >= 1 && next <= 5) { current.step = next; persist(); }
    } else if (actionName === 'academy-teacher') {
      if (!p.goal || busy()) return true;
      if (db.agents?.milo) db.activeAgent = 'milo';
      deps.setDraft?.(p.goal.teacherPrompt);
      deps.save?.();
      go('workspace');
      toast('Teaching task prepared. Choose your mode and press Send when ready.');
    } else if (actionName === 'academy-review-example') {
      if (busy()) return true;
      const task = p.matchingTasks.find(t => t.id === dataset.id);
      if (!task) { toast('Collect a finished response to your teaching task first.'); return true; }
      if (deps.openTeach) deps.openTeach(task.id);
      else { deps.selectTask?.(task.id); go('workspace'); toast('Read the answer, then choose Distill model chip if you approve it.'); }
    } else if (actionName === 'academy-review-chip') {
      if (busy()) return true;
      const chip = p.matchingChips.find(l => l.id === dataset.id);
      if (!chip) return true;
      if (deps.openChip) deps.openChip(chip.id);
      else { db.activeLesson = chip.id; deps.save?.(); go('lessons'); toast('Choose Edit chip, review its rules, and save an approved revision.'); }
    } else if (actionName === 'academy-select-chip') {
      const chip = p.reviewedChips.find(l => l.id === dataset.id);
      if (!chip || busy()) return true;
      current.chipId = chip.id;
      current.step = 4;
      db.activeLesson = chip.id;
      persist();
    } else if (actionName === 'academy-equip') {
      const chip = p.reviewedChips.find(l => l.id === dataset.id);
      const agent = db.agents?.[dataset.agent];
      if (busy() || !chip || !agent) return true;
      if (!!chip.demo !== (db.mode === 'demo')) { toast('Use the same mode as this chip before equipping it.'); return true; }
      agent.chipId = chip.id;
      if (!chip.demo && chip.baseModel) agent.model = chip.baseModel;
      current.chipId = chip.id;
      db.activeLesson = chip.id;
      persist();
      toast(`${agent.name || 'Your companion'} is equipped. No model call needed.`);
    } else if (actionName === 'academy-compare') {
      if (!p.goal || !p.chip || !p.steps[2] || busy()) return true;
      const taught = (db.lessons || []).some(l => l.examples?.some(e => normalize(e?.prompt) === normalize(p.goal.heldOutPrompt)));
      if (taught) { toast('Your reserved test is now a teaching example. Save a new, unused test in step 1.'); return true; }
      db.activeLesson = p.chip.id;
      current.chipId = p.chip.id;
      deps.setFreshTask?.(p.goal.heldOutPrompt);
      deps.save?.();
      go('compare');
      toast('Fresh test prepared. Compare responses, then save your judgment.');
    } else if (actionName === 'academy-page') {
      if (['workspace', 'settings', 'lessons', 'compare', 'pets', 'code', 'live', 'research', 'wilds'].includes(dataset.page)) go(dataset.page);
    } else if (actionName === 'academy-quiz') {
      if (['context', 'weights', 'universal'].includes(dataset.answer)) { current.quizAnswer = dataset.answer; persist(); }
    } else if (actionName === 'academy-guide') {
      const content = academyFieldGuide(db);
      if (deps.download) deps.download('pip-distillation-field-guide.md', content, 'text/markdown;charset=utf-8');
      else if (typeof document !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pip-distillation-field-guide.md';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      toast('Your field guide is ready. No model call or API key involved.');
    }
    return true;
  }

  return { view, action };
}
