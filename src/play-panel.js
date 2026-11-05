import { FIELD_TRAILS, PLAY_ACTIVITIES, trailProgress } from './playbook.js';

export function playPanel({ book, agents, places, activity, escape: h, button: btn }) {
  const trail = trailProgress(book);
  const name = id => places.find(p => p.id === id)?.title || 'A little stop';
  const journalTitle = e => e.kind === 'visit' ? `Reached ${name(e.id)}` : e.kind === 'play'
    ? PLAY_ACTIVITIES.find(a => a.id === e.id)?.title || 'A little play break' : 'Made a Wilds postcard';
  return `<section class="world-playbook" aria-label="Play and field journal">
    <div class="playbook-welcome"><span class="playbook-flower" aria-hidden="true">✿</span><div><span class="world-eyebrow">SMALL MOMENTS, BIG WAGGING TAILS</span><h3>A little time together.</h3><p>${h(agents.milo.name)} & ${h(agents.nova.name)} have room for a little wonder.</p></div></div>
    <p class="world-help">Play is free scenery. Your AI work keeps running; chips and model learning stay in the teaching tools.</p>
    <div class="playbook-stats"><span><b>${book.moments}</b> play moments</span><span><b>${book.visits.length}</b> places reached</span><span><b>${book.postcards}</b> postcards made</span></div>
    <h3 class="world-section-title">Choose a little break</h3>
    ${activity ? `<p class="playbook-current" role="status">${activity.phase === 'gathering' ? 'Coming together for' : 'Enjoying'} ${h(activity.title.toLowerCase())}. ${btn('world-stop-play','Finish this break')}</p>` : ''}
    <div class="playbook-activities">${PLAY_ACTIVITIES.map(a => btn('world-play', `<span aria-hidden="true">${a.glyph}</span><b>${h(a.title)}</b><small>${h(a.note)}</small>${book.activities.includes(a.id) ? '<i aria-label="Tried">✓</i>' : ''}`, 'playbook-activity', `data-kind="${a.id}" ${activity ? 'disabled' : ''} aria-label="Play: ${h(a.title)}"`)).join('')}</div>
    <div class="playbook-camera"><span aria-hidden="true">▣</span><div><h3>A postcard for your pocket</h3><p>Frame the duo, choose a pose, and keep a real PNG of your world.</p></div>${btn('world-photo','Open postcard camera')}</div>
    <h3 class="world-section-title">Your nature-walk passport</h3><p class="world-help">A stamp appears when a companion reaches a landmark. Looking at the map doesn’t count. Keep walking at your own pace.</p>
    <div class="playbook-trails" aria-label="Nature trails">${FIELD_TRAILS.map(t => { const p = trailProgress(book,t.id); return btn('world-trail', `<span aria-hidden="true">${t.glyph}</span><b>${h(t.title)}</b><small>${p.complete}/3 stops${p.complete === 3 ? ' · ✓ stamped' : ''}</small>`, 'playbook-trail', `data-trail="${t.id}" aria-pressed="${book.trail === t.id}"`); }).join('')}</div>
    <article class="playbook-trail-card"><span class="playbook-stamp ${trail.complete === 3 ? 'is-earned' : ''}" aria-hidden="true">${trail.glyph}</span><div><h4>${h(trail.complete === 3 ? trail.badge : trail.title)}</h4><p>${h(trail.complete === 3 ? 'A lovely walk, now a little memory in your passport.' : trail.note)}</p></div><ol>${trail.stops.map(id => `<li class="${book.visits.includes(id) ? 'is-reached' : ''}"><span aria-hidden="true">${book.visits.includes(id) ? '✓' : '○'}</span>${h(name(id))}</li>`).join('')}</ol>${trail.next ? btn('world-place-walk', `⌁ Walk to ${h(name(trail.next))}`, 'primary', `data-place="${trail.next}"`) : btn('world-place-walk','Visit a favorite stop again','',`data-place="${trail.stops[0]}"`)}</article>
    <h3 class="world-section-title">Little moments, remembered</h3>
    <ol class="playbook-journal">${book.journal.length ? book.journal.slice(-10).reverse().map(e=>`<li><span aria-hidden="true">${e.kind === 'visit' ? '⌁' : e.kind === 'photo' ? '▣' : '♡'}</span><div><b>${h(journalTitle(e))}</b><time datetime="${new Date(e.at).toISOString()}">${h(new Date(e.at).toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</time></div></li>`).join('') : '<li><span aria-hidden="true">♡</span><p>Your first little memory is waiting outside.</p></li>'}</ol>
    <p class="world-help">Saved on this device with your workspace. Scenic stamps are keepsakes, not model scores.</p>${btn('world-journal-export', 'Download field journal', '', !book.journal.length ? 'disabled' : '')}
    <div class="world-actions">${btn('world-tab','Dress up the duo','', 'data-tab="field"')}${btn('world-tab','Return to AI results','', 'data-tab="results"')}</div>
  </section>`;
}
