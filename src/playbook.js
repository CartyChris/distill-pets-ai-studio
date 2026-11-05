// Cosmetic world history. Nothing here is evidence of model learning or an API call.
export const PLAY_ACTIVITIES = Object.freeze([
  { id: 'picnic', title: 'Pocket picnic', glyph: '🍓', note: 'A berry, a blanket, a very good afternoon.', seconds: 7 },
  { id: 'dance', title: 'Happy little dance', glyph: '♫', note: 'Two tiny dancers. Absolutely no choreography.', seconds: 7 },
  { id: 'bubbles', title: 'Bubble wishes', glyph: '◌', note: 'Watch a handful of rainbow bubbles float away.', seconds: 8 },
  { id: 'read', title: 'Story under the sky', glyph: '📖', note: 'Share a picture book and a curious little look.', seconds: 8 },
  { id: 'highfive', title: 'Team high five', glyph: '✦', note: 'A small celebration for your favorite duo.', seconds: 5 },
  { id: 'rest', title: 'Cloud watching', glyph: '☁', note: 'A quiet breath between adventures.', seconds: 8 },
]);

export const FIELD_TRAILS = Object.freeze([
  { id: 'meadow', title: 'The wonder walk', glyph: '✿', note: 'Find a flower, ask an oak, meet your reflection.', stops: ['flower-class', 'oak', 'pond'], badge: 'Little botanist' },
  { id: 'archive', title: 'A pocket of starlight', glyph: '✧', note: 'Collect questions among books, stars and old ideas.', stops: ['library', 'observatory', 'ruins'], badge: 'Star listener' },
  { id: 'coast', title: 'Follow the tide', glyph: '≈', note: 'Trace a source from the lighthouse to the harbor.', stops: ['lighthouse', 'shells', 'harbor'], badge: 'Shore explorer' },
  { id: 'workshop', title: 'The tinkerer’s trail', glyph: '⚙', note: 'Imagine, test, and take another little turn.', stops: ['workshop', 'bridge', 'windmill'], badge: 'Mossy maker' },
]);
export const FIELD_STOPS = Object.freeze(['camp', 'honey', 'clock', 'forge', 'crystal', ...FIELD_TRAILS.flatMap(t => t.stops)]);
const activityIDs = PLAY_ACTIVITIES.map(a => a.id);
const unique = (list, allowed) => Array.isArray(list) ? [...new Set(list.filter(id => allowed.includes(id)))] : [];
const count = value => Number.isFinite(Number(value)) ? Math.min(9999, Math.max(0, Math.floor(Number(value)))) : 0;
const date = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;

export function cleanPlaybook(value) {
  const x = value && typeof value === 'object' ? value : {};
  return {
    visits: unique(x.visits, FIELD_STOPS),
    activities: unique(x.activities, activityIDs),
    moments: count(x.moments),
    postcards: count(x.postcards),
    trail: FIELD_TRAILS.some(t => t.id === x.trail) ? x.trail : 'meadow',
    format: ['landscape', 'square', 'portrait'].includes(x.format) ? x.format : 'landscape',
    journal: (Array.isArray(x.journal) ? x.journal : []).slice(-32).filter(e =>
      e && date(e.at) &&
      (e.kind === 'visit' && FIELD_STOPS.includes(e.id) || e.kind === 'play' && activityIDs.includes(e.id) || e.kind === 'photo' && ['landscape', 'square', 'portrait'].includes(e.id))
    ).map(e => ({ kind: e.kind, id: e.id, at: e.at })),
  };
}

export function recordMoment(book, kind, id, at = Date.now()) {
  if (!date(at)) return false;
  if (kind === 'visit') {
    if (!FIELD_STOPS.includes(id) || book.visits.includes(id)) return false;
    book.visits.push(id);
  } else if (kind === 'play') {
    if (!activityIDs.includes(id)) return false;
    if (!book.activities.includes(id)) book.activities.push(id);
    book.moments = count(book.moments + 1);
  } else if (kind === 'photo') {
    if (!['landscape', 'square', 'portrait'].includes(id)) return false;
    book.postcards = count(book.postcards + 1);
  } else return false;
  book.journal.push({ kind, id, at });
  book.journal = book.journal.slice(-32);
  return true;
}

export function trailProgress(book, id = book.trail) {
  const trail = FIELD_TRAILS.find(t => t.id === id) || FIELD_TRAILS[0];
  const complete = trail.stops.filter(stop => book.visits.includes(stop));
  return { ...trail, complete: complete.length, next: trail.stops.find(stop => !book.visits.includes(stop)) || null };
}

export function postcardCrop(width, height, format = 'landscape') {
  const aspect = format === 'square' ? 1 : format === 'portrait' ? 9 / 16 : 16 / 9;
  const w = Math.min(width, height * aspect), h = w / aspect;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}
