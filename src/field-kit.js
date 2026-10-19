import { ANIMALS } from './pixels.js';
import { OUTFITS, cleanOutfit } from './customize.js';

export const PERSONALITIES = Object.freeze([
  {
    id: 'curious',
    name: 'Curious scout',
    glyph: '⌕',
    note: 'An inquisitive little wanderer.',
    motion: 'Bright steps, curious looks',
  },
  {
    id: 'calm',
    name: 'Gentle thinker',
    glyph: '☁',
    note: 'Takes the scenic route.',
    motion: 'Soft steps, slower breathing',
  },
  {
    id: 'bouncy',
    name: 'Pocket sunshine',
    glyph: '✧',
    note: 'A spring in every tiny step.',
    motion: 'Bouncy steps, excited hops',
  },
  {
    id: 'brave',
    name: 'Brave explorer',
    glyph: '⚑',
    note: 'First to greet a new idea.',
    motion: 'Confident steps, bold poses',
  },
]);
export const TEACHING_VOICES = Object.freeze([
  {
    id: 'warm',
    name: 'Warm & encouraging',
    note: 'Patient explanations with a friendly tone.',
  },
  {
    id: 'precise',
    name: 'Clear & precise',
    note: 'Direct language, clear definitions, and concrete steps.',
  },
  {
    id: 'playful',
    name: 'Playful storyteller',
    note: 'Memorable examples and light, useful analogies.',
  },
  {
    id: 'socratic',
    name: 'Socratic guide',
    note: 'Thoughtful questions, then clear explanations.',
  },
]);
export const AURAS = Object.freeze([
  { id: 'none', name: 'No aura', glyph: '○' },
  { id: 'sparkles', name: 'Little sparkles', glyph: '✧' },
  { id: 'leaves', name: 'Drifting leaves', glyph: '❧' },
  { id: 'stars', name: 'Orbiting stars', glyph: '★' },
]);
export const TRAILS = Object.freeze([
  { id: 'none', name: 'Leave no trail', glyph: '·' },
  { id: 'paws', name: 'Tiny pawprints', glyph: '🐾' },
  { id: 'hearts', name: 'A trail of hearts', glyph: '♡' },
  { id: 'stardust', name: 'Stardust footsteps', glyph: '✦' },
]);
const OWNERS = ['milo', 'nova'];
const EMOTES = ['wave', 'cheer', 'snooze', 'jump'];
const ACCENTS = [
  '#1677ff',
  '#d65078',
  '#9a61d4',
  '#2a916a',
  '#d48226',
  '#3593a5',
];
const pick = (value, options, fallback) =>
  options.some((item) => item.id === value) ? value : fallback;

/** Fields belong to an agent; the equipped model chip stays separate. */
export function cleanPersonality(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    personality: pick(source.personality, PERSONALITIES, 'curious'),
    accent:
      typeof source.accent === 'string' && /^#[\da-f]{6}$/i.test(source.accent)
        ? source.accent.toLowerCase()
        : '#1677ff',
    aura: pick(source.aura, AURAS, 'none'),
    voice: pick(source.voice, TEACHING_VOICES, 'warm'),
    trail: pick(source.trail, TRAILS, 'none'),
  };
}

const STYLES = `<style>
.field-kit{display:grid;gap:16px;min-width:0;color:var(--ink)}
.field-kit *{box-sizing:border-box}.field-kit h2,.field-kit h3,.field-kit p{margin:0}.field-kit .field-intro{display:grid;gap:9px}.field-kit .field-intro p,.field-kit .field-hint{color:var(--muted);font-size:13px;line-height:1.55}.field-kit .field-companion{border:1px solid var(--line);border-radius:var(--ui-radius,20px);background:var(--paper);overflow:hidden;min-width:0}.field-kit .field-companion>summary{display:flex;align-items:center;gap:12px;min-height:64px;padding:14px;cursor:pointer;list-style:none}.field-kit .field-companion>summary::-webkit-details-marker{display:none}.field-kit .field-summary-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:12px;border:2px solid var(--field-accent);color:var(--field-accent);font-size:24px;flex-shrink:0}.field-kit .field-companion>summary>span:nth-child(2){min-width:0;flex:1}.field-kit .field-companion>summary b{display:block;overflow-wrap:anywhere}.field-kit .field-companion>summary small{display:block;color:var(--muted);font-size:12px;margin-top:4px}.field-kit .field-companion>summary:after{content:'＋';font-size:19px;color:var(--muted)}.field-kit .field-companion[open]>summary:after{content:'−'}.field-kit .field-body{padding:0 14px 16px;display:grid;gap:17px}.field-kit .field-preview{height:180px;position:relative;isolation:isolate;display:grid;place-items:center;background:var(--paper2);border:1px solid var(--line);border-radius:16px;overflow:hidden}.field-kit .field-preview:before{content:'';position:absolute;width:155px;height:40px;background:var(--field-accent);opacity:.1;border-radius:50%;left:calc(50% - 77px);bottom:31px}.field-kit .field-preview:after{content:'✿     ·     ✿';position:absolute;bottom:13px;color:var(--field-accent);opacity:.65;letter-spacing:8px;font-size:17px;white-space:pre}.field-kit .field-sprite{position:relative;z-index:1;image-rendering:pixelated;width:108px;height:144px;object-fit:contain;transform-origin:50% 87%;animation:field-breathe 3s ease-in-out infinite}.field-kit [data-personality=bouncy] .field-sprite{animation:field-bounce 1.2s ease-in-out infinite}.field-kit [data-personality=curious] .field-sprite{animation:field-curious 3.5s ease-in-out infinite}.field-kit [data-personality=brave] .field-sprite{animation:field-brave 2.8s ease-in-out infinite}.field-kit [data-personality=calm] .field-sprite{animation-duration:4.8s}.field-kit .field-aura{position:absolute;inset:0;pointer-events:none;color:var(--field-accent)}.field-kit .field-aura i{position:absolute;font-style:normal;font-size:22px;animation:field-float 3.5s ease-in-out infinite;left:23%;top:24%}.field-kit .field-aura i:nth-child(2){left:72%;top:39%;animation-delay:-1.2s;font-size:16px}.field-kit .field-aura i:nth-child(3){left:66%;top:14%;animation-delay:-2.4s;font-size:13px}.field-kit .field-trail{position:absolute;bottom:25px;left:13%;color:var(--field-accent);font-size:18px;letter-spacing:12px;opacity:.55;transform:rotate(-12deg);animation:field-trail 4s ease-in-out infinite}.field-kit .field-preview[data-emote=wave] .field-sprite{animation:field-wave .42s ease-in-out 3}.field-kit .field-preview[data-emote=cheer] .field-sprite{animation:field-cheer .55s ease-in-out 3}.field-kit .field-preview[data-emote=snooze] .field-sprite{animation:field-snooze 1.1s ease-in-out 2}.field-kit .field-preview[data-emote=jump] .field-sprite{animation:field-jump .8s ease-out 2}.field-kit .field-preview[data-emote=snooze] .field-emote-caption:after{content:' · z Z z'}.field-kit .field-emote-caption{position:absolute;left:10px;top:9px;max-width:calc(100% - 20px);background:var(--paper);border:1px solid var(--line);border-radius:99px;padding:4px 9px;font-size:11px;color:var(--muted);z-index:3;overflow-wrap:anywhere}.field-kit .field-emotes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.field-kit button{min-height:44px;touch-action:manipulation;max-width:100%;font:inherit}.field-kit .field-emotes button{display:grid;gap:3px;place-content:center;font-size:12px;padding:7px 3px}.field-kit .field-emotes b{font-size:20px;line-height:1}.field-kit label,.field-kit legend{font-size:13px;font-weight:650}.field-kit .field-input{display:grid;gap:8px;min-width:0}.field-kit input:not([type=color]),.field-kit select{width:100%;min-height:44px;font-size:16px;min-width:0;background:var(--paper);color:var(--ink);border:1px solid var(--line);padding:10px 11px;border-radius:12px}.field-kit fieldset{padding:0;margin:0;border:0;min-width:0}.field-kit legend{margin-bottom:9px}.field-kit .field-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.field-kit .field-personalities{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.field-kit .field-personality{display:grid;grid-template-columns:24px 1fr;align-items:start;text-align:left;gap:5px;padding:10px;background:var(--paper2);border:1px solid var(--line);border-radius:12px}.field-kit .field-personality>span{font-size:22px;color:var(--field-accent)}.field-kit .field-personality b{display:block;font-size:12px;line-height:1.4}.field-kit .field-personality small{display:block;color:var(--muted);font-size:11px;line-height:1.4;margin-top:4px}.field-kit button[aria-pressed=true]{border-color:var(--field-accent);box-shadow:inset 0 0 0 1px var(--field-accent)}.field-kit .field-color-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.field-kit input[type=color]{font-size:16px;width:52px;height:44px;border:1px solid var(--line);border-radius:10px;padding:3px;background:var(--paper);cursor:pointer}.field-kit .field-swatch{min-width:44px;min-height:44px;padding:6px;border-radius:10px;display:grid;place-items:center}.field-kit .field-swatch span{width:19px;height:19px;border-radius:50%;background:var(--swatch);border:1px solid var(--line)}.field-kit .field-wardrobe{border-top:1px solid var(--line);padding-top:12px}.field-kit .field-wardrobe>summary{min-height:44px;display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:650;list-style:none}.field-kit .field-wardrobe>summary:after{content:'＋';margin-left:auto;color:var(--muted)}.field-kit .field-wardrobe[open]>summary:after{content:'−'}.field-kit .field-outfits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px}.field-kit .field-outfit{display:grid;justify-items:center;gap:3px;background:var(--paper2);border:1px solid var(--line);border-radius:11px;padding:6px 3px;font-size:10px;line-height:1.4;overflow-wrap:anywhere}.field-kit .field-outfit canvas{width:54px;height:72px;image-rendering:pixelated}.field-kit .field-note{background:var(--paper2);border:1px solid var(--line);border-radius:12px;padding:11px;font-size:12px;line-height:1.5;color:var(--muted)}.field-kit .field-footer{display:flex;gap:8px;flex-wrap:wrap}.field-kit .field-footer button{flex:1;font-size:12px;padding:9px}.field-kit :focus-visible{outline:3px solid var(--field-accent,var(--blue));outline-offset:3px}.field-kit button:disabled,.field-kit input:disabled,.field-kit select:disabled{opacity:.5;cursor:wait}
@keyframes field-breathe{50%{transform:translateY(-3px) scale(1.025,1.015)}}@keyframes field-bounce{0%,100%{transform:translateY(0) scale(1.04,.97)}45%{transform:translateY(-11px) rotate(3deg)}75%{transform:translateY(-2px) rotate(-2deg)}}@keyframes field-curious{0%,55%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-4px) rotate(-4deg)}75%{transform:translateY(-2px) rotate(3deg)}}@keyframes field-brave{50%{transform:translateY(-3px) scale(1.04) rotate(-2deg)}}@keyframes field-float{50%{transform:translateY(-9px) rotate(25deg);opacity:.4}}@keyframes field-trail{50%{opacity:.2;transform:translateX(-6px) rotate(-12deg)}}@keyframes field-wave{25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}@keyframes field-cheer{25%,75%{transform:translateY(-9px) rotate(-5deg)}50%{transform:translateY(-3px) rotate(5deg)}}@keyframes field-snooze{50%{transform:translateY(4px) rotate(-7deg) scale(1.04,.94)}}@keyframes field-jump{0%,100%{transform:translateY(0)}45%{transform:translateY(-26px) rotate(6deg)}80%{transform:translateY(0) scale(1.08,.9)}}
html[data-motion=reduced] .field-kit .field-sprite,html[data-motion=reduced] .field-kit .field-aura i,html[data-motion=reduced] .field-kit .field-trail{animation:none!important}
@media(prefers-reduced-motion:reduce){.field-kit .field-sprite,.field-kit .field-aura i,.field-kit .field-trail{animation:none!important}}
@media(max-width:360px){.field-kit .field-pair{grid-template-columns:1fr}.field-kit .field-personality{padding:9px 7px;grid-template-columns:18px 1fr}.field-kit .field-personality>span{font-size:19px}}
</style>`;

export function createFieldKit(deps) {
  const { getDB, escape, button, save, render, toast } = deps;
  let renderPending = false;
  let lastEmote = { owner: '', kind: '', time: 0 };
  const openCompanions = new Set(OWNERS);
  const openWardrobes = new Set();
  const attr = (value) => escape(String(value));
  const busy = () => Boolean(deps.getBusy?.());
  const byID = (id) => (OWNERS.includes(id) ? getDB().agents[id] : null);
  const random = (options) =>
    options[Math.floor(Math.random() * options.length)];

  function rememberPanels() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-field-companion]').forEach((element) => {
      if (element.open) openCompanions.add(element.dataset.fieldCompanion);
      else openCompanions.delete(element.dataset.fieldCompanion);
    });
    document.querySelectorAll('[data-field-wardrobe]').forEach((element) => {
      if (element.open) openWardrobes.add(element.dataset.fieldWardrobe);
      else openWardrobes.delete(element.dataset.fieldWardrobe);
    });
  }

  function commit() {
    save();
    if (renderPending) return;
    renderPending = true;
    queueMicrotask(() => {
      renderPending = false;
      render();
    });
  }
  function choice(id, owner, label, choices, selected, disabled) {
    return `<div class="field-input"><label for="field-${id}-${owner}">${label}</label><select id="field-${id}-${owner}" ${disabled}>${choices.map((item) => `<option value="${attr(item.id)}" ${selected === item.id ? 'selected' : ''}>${attr(item.name)}</option>`).join('')}</select></div>`;
  }
  function companion(owner) {
    const agent = byID(owner);
    const look = cleanPersonality(agent);
    const outfit = cleanOutfit(agent.outfit);
    const selectedOutfit = OUTFITS.find((item) => item.id === outfit);
    const personality = PERSONALITIES.find(
      (item) => item.id === look.personality,
    );
    const voice = TEACHING_VOICES.find((item) => item.id === look.voice);
    const aura = AURAS.find((item) => item.id === look.aura);
    const trail = TRAILS.find((item) => item.id === look.trail);
    const disabled = busy() ? 'disabled' : '';
    return `<details class="field-companion" style="--field-accent:${look.accent}" data-field-companion="${owner}" ${openCompanions.has(owner) ? 'open' : ''}><summary><span class="field-summary-mark" aria-hidden="true">${owner === 'milo' ? '⚑' : '✧'}</span><span><b>${attr(agent.name)}’s field kit</b><small>${owner === 'milo' ? 'Teacher companion' : 'Student companion'} · ${attr(selectedOutfit.name)}</small></span></summary><div class="field-body"><div class="field-preview" data-field-preview="${owner}" data-personality="${look.personality}" role="img" aria-label="${attr(agent.name)}, ${attr(personality.name.toLowerCase())}, wearing ${attr(selectedOutfit.name.toLowerCase())}"><span class="field-emote-caption" data-field-emote-caption="${owner}">${attr(personality.motion)}</span>${look.trail !== 'none' ? `<span class="field-trail" aria-hidden="true">${trail.glyph} ${trail.glyph} ${trail.glyph}</span>` : ''}<canvas class="pixel field-sprite" width="36" height="48" data-pet="${attr(agent.pet)}" data-owner="${owner}" data-outfit-preview="${outfit}" aria-hidden="true"></canvas>${look.aura !== 'none' ? `<span class="field-aura" aria-hidden="true"><i>${aura.glyph}</i><i>${aura.glyph}</i><i>${aura.glyph}</i></span>` : ''}</div><div class="field-emotes" aria-label="Play with ${attr(agent.name)}">${[
      ['wave', '♡', 'Wave'],
      ['cheer', '✧', 'Cheer'],
      ['snooze', '☾', 'Snooze'],
      ['jump', '↑', 'Jump'],
    ]
      .map(([id, glyph, label]) =>
        button(
          'field-emote',
          `<b aria-hidden="true">${glyph}</b><span>${label}</span>`,
          '',
          `data-owner="${owner}" data-emote="${id}" aria-label="Ask ${attr(agent.name)} to ${label.toLowerCase()}"`,
        ),
      )
      .join(
        '',
      )}</div><div class="field-input"><label for="field-name-${owner}">Nickname</label><input id="field-name-${owner}" value="${attr(agent.name)}" maxlength="40" autocomplete="off" ${disabled}></div><div class="field-pair">${choice('pet', owner, 'Pixel pet species', ANIMALS, agent.pet, disabled)}${choice(
      'skin',
      owner,
      'Agent icon',
      [
        { id: 'pixel', name: 'My dressed pixel pet' },
        { id: 'cartoon', name: 'Expressive cartoon' },
      ],
      agent.skin || 'cartoon',
      disabled,
    )}</div><fieldset><legend>Adventure personality</legend><div class="field-personalities">${PERSONALITIES.map((item) => button('field-personality', `<span aria-hidden="true">${item.glyph}</span><span><b>${item.name}</b><small>${item.note}</small></span>`, 'field-personality', `data-owner="${owner}" data-personality="${item.id}" aria-pressed="${look.personality === item.id}" ${disabled}`)).join('')}</div><p class="field-hint" style="margin-top:8px">Changes the way your companion moves, poses, and explores.</p></fieldset>${choice('voice', owner, 'Teaching voice · writing style', TEACHING_VOICES, look.voice, disabled)}<p class="field-hint" style="margin-top:-10px">${voice.note} This steers model responses; it does not play audio.</p><div class="field-input"><label for="field-accent-${owner}">Companion’s signature color</label><div class="field-color-row"><input type="color" id="field-accent-${owner}" value="${look.accent}" aria-label="${attr(agent.name)}’s signature color" ${disabled}>${ACCENTS.map((color, index) => button('field-accent', `<span aria-hidden="true"></span>`, 'field-swatch', `style="--swatch:${color}" data-owner="${owner}" data-color="${color}" aria-label="Signature color ${['blue', 'rose', 'lavender', 'fern', 'amber', 'lagoon'][index]}" aria-pressed="${look.accent === color}" ${disabled}`)).join('')}</div></div><div class="field-pair">${choice('aura', owner, 'Little aura', AURAS, look.aura, disabled)}${choice('trail', owner, 'Footstep trail', TRAILS, look.trail, disabled)}</div><details class="field-wardrobe" data-field-wardrobe="${owner}" ${openWardrobes.has(owner) ? 'open' : ''}><summary>Open the Pixel Pets wardrobe <span class="chip">9 looks</span></summary><div class="field-outfits">${OUTFITS.map((item) => button('field-outfit', `<canvas width="36" height="48" class="pixel" data-pet="${attr(agent.pet)}" data-owner="${owner}" data-outfit-preview="${item.id}" aria-hidden="true"></canvas><span>${item.name}</span>`, 'field-outfit', `data-owner="${owner}" data-outfit="${item.id}" aria-pressed="${outfit === item.id}" aria-label="Dress ${attr(agent.name)} in ${item.name}" ${disabled}`)).join('')}</div></details><div class="field-footer">${button('field-surprise', '✧ Surprise my style', '', `data-owner="${owner}" ${disabled}`)}${button('field-reset', 'Reset personality', '', `data-owner="${owner}" ${disabled}`)}</div></div></details>`;
  }
  function view() {
    rememberPanels();
    return `${STYLES}<section class="field-kit" aria-label="Companion field kits"><div class="field-intro"><span class="eyebrow">A little more them. A little more you.</span><h2>Dress for a grand adventure.</h2><p>Give your teacher and student their own look, little habits, and teaching voice. These choices travel with the companion; model chips stay swappable.</p>${busy() ? '<p class="field-note" role="status">A model is working. You can still play with your companions; save new identity choices when the run finishes.</p>' : ''}</div>${OWNERS.map(companion).join('')}<p class="field-note">Outfits, auras, and trails are cosmetic. Teaching voice changes prompt style, not the model’s weights or abilities. Motion follows your studio and device accessibility preferences.</p></section>`;
  }
  function emote(owner, kind) {
    const now = Date.now();
    if (
      lastEmote.owner === owner &&
      lastEmote.kind === kind &&
      now - lastEmote.time < 150
    )
      return;
    lastEmote = { owner, kind, time: now };
    deps.emote?.(owner, kind);
    if (typeof document !== 'undefined') {
      const preview = document.querySelector(`[data-field-preview="${owner}"]`);
      if (preview) {
        preview.removeAttribute('data-emote');
        // Restart the selected animation without replacing a focused control.
        void preview.offsetWidth;
        preview.dataset.emote = kind;
        preview.dataset.emoteToken = String(now);
        const caption = preview.querySelector('[data-field-emote-caption]');
        if (caption)
          caption.textContent = {
            wave: 'A little hello for you',
            cheer: 'You make a great team!',
            snooze: 'A tiny thinking break',
            jump: 'One very happy explorer',
          }[kind];
        setTimeout(() => {
          if (
            preview.isConnected &&
            preview.dataset.emoteToken === String(now)
          ) {
            preview.removeAttribute('data-emote');
            preview.removeAttribute('data-emote-token');
            if (caption)
              caption.textContent = PERSONALITIES.find(
                (item) => item.id === cleanPersonality(byID(owner)).personality,
              ).motion;
          }
        }, 2400);
      }
    }
    toast(
      `${byID(owner).name} ${{ wave: 'waves hello.', cheer: 'cheers you on!', snooze: 'takes a tiny breather.', jump: 'does a happy hop!' }[kind]}`,
    );
  }
  function action(actionName, element) {
    if (!actionName?.startsWith('field-')) return false;
    const data = element?.dataset || element || {};
    const agent = byID(data.owner);
    if (!agent) return true;
    if (actionName === 'field-emote' && EMOTES.includes(data.emote)) {
      emote(data.owner, data.emote);
      return true;
    }
    if (busy()) {
      toast(
        'Your companion is working. Change their field kit when this run finishes.',
      );
      return true;
    }
    if (
      actionName === 'field-personality' &&
      PERSONALITIES.some((item) => item.id === data.personality)
    ) {
      agent.personality = data.personality;
    } else if (
      actionName === 'field-accent' &&
      /^#[\da-f]{6}$/i.test(data.color || '')
    ) {
      agent.accent = data.color.toLowerCase();
    } else if (
      actionName === 'field-outfit' &&
      OUTFITS.some((item) => item.id === data.outfit)
    ) {
      agent.outfit = data.outfit;
    } else if (actionName === 'field-surprise') {
      Object.assign(agent, {
        personality: random(PERSONALITIES).id,
        accent: random(ACCENTS),
        aura: random(AURAS).id,
        trail: random(TRAILS).id,
        outfit: random(OUTFITS).id,
      });
      toast(
        `${agent.name} is dressed for a fresh adventure. Teaching voice stays yours to choose.`,
      );
    } else if (actionName === 'field-reset') {
      Object.assign(agent, cleanPersonality(null));
      toast(
        `${agent.name}’s original personality is back. Their outfit and model chip stay equipped.`,
      );
    } else return true;
    commit();
    return true;
  }
  function change(element) {
    const match =
      /^field-(name|pet|skin|voice|accent|aura|trail)-(milo|nova)$/.exec(
        element?.id || '',
      );
    if (!match) return false;
    const [, key, owner] = match;
    const agent = byID(owner);
    if (busy()) {
      element.value = agent[key] || cleanPersonality(agent)[key] || '';
      toast(
        'Your companion is working. Change their field kit when this run finishes.',
      );
      return true;
    }
    const value = String(element.value || '');
    if (key === 'name') {
      const name = value
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, 40);
      if (!name) {
        element.value = agent.name;
        return true;
      }
      agent.name = name;
    } else if (key === 'pet' && ANIMALS.some((item) => item.id === value))
      agent.pet = value;
    else if (key === 'skin' && ['cartoon', 'pixel'].includes(value))
      agent.skin = value;
    else if (
      key === 'voice' &&
      TEACHING_VOICES.some((item) => item.id === value)
    )
      agent.voice = value;
    else if (key === 'accent' && /^#[\da-f]{6}$/i.test(value))
      agent.accent = value.toLowerCase();
    else if (key === 'aura' && AURAS.some((item) => item.id === value))
      agent.aura = value;
    else if (key === 'trail' && TRAILS.some((item) => item.id === value))
      agent.trail = value;
    else return true;
    commit();
    return true;
  }
  return { view, action, change };
}
