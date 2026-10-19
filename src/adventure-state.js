const one = (value, choices, fallback) =>
  choices.includes(value) ? value : fallback;
const text = (value, max) =>
  typeof value === 'string' ? value.slice(0, max) : '';
export function cleanAdventure(value) {
  const x = value && typeof value === 'object' ? value : {};
  return {
    seed: text(x.seed, 80) || 'pip-living-wilds',
    biome: one(x.biome, ['meadow', 'archive', 'coast', 'workshop'], 'meadow'),
    weather: one(x.weather, ['clear', 'rain', 'snow', 'fireflies'], 'clear'),
    time: one(x.time, ['day', 'sunset', 'night', 'auto'], 'sunset'),
    follow: one(x.follow, ['milo', 'nova', 'free'], 'milo'),
    zoom: Math.min(2, Math.max(0.35, Number(x.zoom) || 1)),
    motion: one(x.motion, ['full', 'reduced'], 'full'),
    density: one(x.density, ['lush', 'balanced'], 'lush'),
    panel: one(
      x.panel,
      ['mission', 'results', 'dialogue', 'steer', 'field', 'world'],
      'mission',
    ),
    panelOpen: x.panelOpen === true,
    dialogue: x.dialogue !== false,
    practice: x.practice === true,
    practiceRounds: Math.min(3, Math.max(1, Math.round(Number(x.practiceRounds) || 1))),
    paused: false,
    goal: text(x.goal, 12000),
    skill: text(x.skill, 1000),
    kind: one(x.kind, ['teach', 'research', 'code', 'task'], 'teach'),
    agent: one(x.agent, ['milo', 'nova'], 'milo'),
    visited: Array.isArray(x.visited)
      ? [
          ...new Set(
            x.visited
              .filter((i) => typeof i === 'string')
              .map((i) => i.slice(0, 100)),
          ),
        ].slice(-200)
      : [],
    guidance: Array.isArray(x.guidance)
      ? x.guidance
          .slice(-24)
          .filter(
            (m) =>
              m && typeof m.text === 'string' && typeof m.runId === 'string',
          )
          .map((m) => ({
            id: text(m.id, 80),
            runId: text(m.runId, 80),
            text: text(m.text, 2000),
            target: one(m.target, ['teacher', 'student'], 'teacher'),
            status:
              m.status === 'queued'
                ? 'waiting'
                : one(m.status, ['applied', 'stopped', 'waiting'], 'waiting'),
            created: Number(m.created) || Date.now(),
            appliedAt: Number(m.appliedAt) || 0,
          }))
      : [],
  };
}
export function queueGuidance(
  state,
  { runId, text: message, target = 'teacher' },
) {
  if (typeof runId !== 'string' || !runId || !String(message || '').trim())
    throw Error('Enter guidance for an active outing.');
  if (state.guidance.filter((m) => m.status === 'queued').length >= 8)
    throw Error(
      'Eight messages are already queued. Let the next step begin first.',
    );
  const entry = {
    id: crypto.randomUUID(),
    runId: runId.slice(0, 80),
    text: String(message).trim().slice(0, 2000),
    target: target === 'student' ? 'student' : 'teacher',
    status: 'queued',
    created: Date.now(),
    appliedAt: 0,
  };
  state.guidance.push(entry);
  state.guidance = state.guidance.slice(-24);
  return entry;
}
export function takeGuidance(state, runId, target) {
  const messages = state.guidance.filter(
    (m) => m.runId === runId && m.target === target && m.status === 'queued',
  );
  for (const m of messages) {
    m.status = 'applied';
    m.appliedAt = Date.now();
  }
  return messages.map((m) => ({ ...m }));
}
export function stopGuidance(state, runId) {
  for (const m of state.guidance)
    if (m.runId === runId && m.status === 'queued') m.status = 'stopped';
}
export function settleGuidance(state, runId) {
  for (const m of state.guidance)
    if (m.runId === runId && m.status === 'queued') m.status = 'waiting';
}
