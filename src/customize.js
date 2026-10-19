import { ANIMALS, getSprite } from './pixels.js';

export const OUTFITS = Object.freeze([
  { id: 'none', name: 'Cozy original', mood: 'Ready for anything' },
  { id: 'bow', name: 'Bubblegum bow', mood: 'A little flourish' },
  { id: 'scarf', name: 'Adventure scarf', mood: 'Off to explore' },
  { id: 'flowers', name: 'Flower crown', mood: 'Ideas in bloom' },
  { id: 'party', name: 'Party hat', mood: 'Celebrate a breakthrough' },
  { id: 'phones', name: 'Headphones', mood: 'Deep work, tiny beats' },
  { id: 'shades', name: 'Sunglasses', mood: 'Research with style' },
  { id: 'wizard', name: 'Wizard hat', mood: 'A little learning magic' },
  { id: 'crown', name: 'Golden crown', mood: 'Royal problem solver' },
]);

export const THEMES = Object.freeze({
  pip: { name: 'Distill Pets AI Studio original', note: 'Warm paper, bright ideas', background: '#f5f3ee', surface: '#fffdf8', text: '#24231f', muted: '#706c64', accent: '#1677ff', secondary: '#f5a12a', success: '#23815c', border: '#e5e0d6' },
  night: { name: 'Midnight studio', note: 'A cozy night shift', background: '#141513', surface: '#1e201d', text: '#f8f3e8', muted: '#bab6aa', accent: '#77adff', secondary: '#f5b25d', success: '#88d1a8', border: '#3b3e36' },
  forest: { name: 'Moss & sunshine', note: 'A woodland workshop', background: '#ecf0e4', surface: '#fcfff5', text: '#223425', muted: '#596853', accent: '#26764d', secondary: '#e6a330', success: '#257856', border: '#d3deca' },
  lavender: { name: 'Lavender daydream', note: 'Soft clouds, curious minds', background: '#f0edf7', surface: '#fffbff', text: '#332846', muted: '#736580', accent: '#7750c8', secondary: '#e991ad', success: '#287760', border: '#dfd5ea' },
  ocean: { name: 'Tide pool', note: 'Fresh air for your ideas', background: '#eaf3f5', surface: '#f9ffff', text: '#203a42', muted: '#52717a', accent: '#167692', secondary: '#e99b51', success: '#238168', border: '#cee0e5' },
});
const COLOR_KEYS = ['background', 'surface', 'text', 'muted', 'accent', 'secondary', 'success', 'border'];
const validColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const clamp = (n, low, high, fallback) => Number.isFinite(Number(n)) ? Math.min(high, Math.max(low, Number(n))) : fallback;
const oneOf = (value, values, fallback) => values.includes(value) ? value : fallback;

export function cleanOutfit(value) {
  const id = typeof value === 'string' ? value : value?.accessory;
  return OUTFITS.some(outfit => outfit.id === id) ? id : 'none';
}

export function cleanAppearance(value) {
  const input = value && typeof value === 'object' ? value : {};
  const preset = Object.hasOwn(THEMES, input.preset) ? input.preset : input.preset === 'custom' ? 'custom' : 'pip';
  const fallback = THEMES[preset] || THEMES.pip;
  const result = {
    preset,
    scale: Math.round(clamp(input.scale, 0.9, 1.2, 1) * 100) / 100,
    radius: Math.round(clamp(input.radius, 8, 28, 20)),
    density: oneOf(input.density, ['compact', 'comfortable', 'spacious'], 'comfortable'),
    font: oneOf(input.font, ['system', 'rounded', 'mono'], 'system'),
    width: oneOf(input.width, ['cozy', 'balanced', 'wide'], 'balanced'),
    motion: oneOf(input.motion, ['system', 'full', 'reduced'], 'system'),
    decoration: oneOf(input.decoration, ['playful', 'minimal'], 'playful'),
    autoContrast: input.autoContrast !== false,
  };
  for (const key of COLOR_KEYS) result[key] = preset === 'custom' && validColor(input[key]) ? input[key].toLowerCase() : fallback[key];
  return result;
}

const rgb = hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
const toHex = channels => '#' + channels.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('');
function mix(a, b, amount) {
  const left = rgb(a), right = rgb(b);
  return toHex(left.map((channel, index) => channel * (1 - amount) + right[index] * amount));
}
function luminance(hex) {
  return rgb(hex).map(channel => {
    const x = channel / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
export function contrastRatio(a, b) {
  const left = luminance(a), right = luminance(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}
function readable(color, backgrounds, threshold = 4.5) {
  const score = candidate => Math.min(...backgrounds.map(bg => contrastRatio(candidate, bg)));
  if (score(color) >= threshold) return color;
  const target = ['#1b1b1b', '#ffffff'].sort((a, b) => score(b) - score(a))[0];
  // Preserve the chosen hue while adjusting its brightness for readable text.
  for (let amount = 0.05; amount < 1; amount += 0.05) {
    const candidate = mix(color, target, amount);
    if (score(candidate) >= threshold) return candidate;
  }
  return target;
}
function palette(appearance) {
  const result = { ...appearance };
  if (result.autoContrast) {
    result.text = readable(result.text, [result.surface, result.background]);
    // Extremely opposite page and card colors cannot share readable text. Keep
    // the selected hue while bringing the page tone closer to the card tone.
    for (let n = 0; n < 20 && contrastRatio(result.text, result.background) < 4.5; n++) result.background = mix(result.background, result.surface, 0.15);
    result.muted = readable(result.muted, [result.surface, result.background]);
    result.accent = readable(result.accent, [result.surface]);
    result.success = readable(result.success, [result.surface]);
  }
  return result;
}

export function applyAppearance(value) {
  const appearance = cleanAppearance(value);
  const colors = palette(appearance);
  if (typeof document === 'undefined') return colors;
  const root = document.documentElement;
  const vars = {
    '--bg': colors.background, '--paper': colors.surface,
    '--paper2': mix(colors.surface, colors.background, 0.52),
    '--ink': colors.text, '--muted': colors.muted, '--line': colors.border,
    '--blue': colors.accent, '--orange': colors.secondary, '--green': colors.success,
    '--danger': luminance(colors.surface) < 0.2 ? '#ff9b91' : '#b43d38',
    '--ui-scale': String(appearance.scale), '--ui-radius': appearance.radius + 'px',
    '--ui-control-radius': Math.max(8, Math.round(appearance.radius * 0.65)) + 'px',
    '--ui-gap': ({ compact: 12, comfortable: 16, spacious: 22 })[appearance.density] + 'px',
    '--ui-max-width': ({ cozy: 1100, balanced: 1490, wide: 1800 })[appearance.width] + 'px',
    '--ui-font': ({ system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", rounded: "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif", mono: "ui-monospace, 'SFMono-Regular', Consolas, monospace" })[appearance.font],
  };
  for (const [name, color] of Object.entries(vars)) root.style.setProperty(name, color);
  root.style.colorScheme = luminance(colors.surface) < 0.2 ? 'dark' : 'light';
  root.dataset.motion = appearance.motion;
  if (document.body) {
    for (const key of ['density', 'font', 'motion', 'decoration']) document.body.dataset[key] = appearance[key];
  }
  return colors;
}

export function createCustomizer(deps) {
  const { getDB, escape, button, icon, save, render, toast } = deps;
  const getAppearance = () => cleanAppearance(getDB().appearance);
  const attrs = text => escape(text);
  function select(id, label, options, value) {
    return `<div><label class="label" for="custom-${id}">${label}</label><select id="custom-${id}">${options.map(([key, name]) => `<option value="${key}" ${value === key ? 'selected' : ''}>${name}</option>`).join('')}</select></div>`;
  }
  function colorField(id, label, value) {
    return `<label class="custom-color" for="custom-color-${id}"><span>${label}<small> ${attrs(value)}</small></span><input type="color" id="custom-color-${id}" value="${attrs(value)}" aria-label="${label} color"></label>`;
  }
  function view() {
    const appearance = getAppearance(), colors = palette(appearance);
    const textRatio = Math.min(contrastRatio(colors.text, colors.surface), contrastRatio(colors.text, colors.background));
    return `<section class="card customize-hero"><span class="eyebrow">Your studio, your little universe</span><h2 style="margin-top:10px">Make room for your kind of magic.</h2><p>Change the palette, tune your workspace, and dress your companions for their next adventure. Every accessory comes from the Pixel Pets wardrobe.</p><div class="row">${button('custom-random', `${icon('spark')} Surprise my companions`)}${button('custom-reset', 'Restore Distill Pets AI Studio appearance')}</div><p class="help" style="margin-bottom:0;margin-top:12px">Changes apply instantly and stay in this browser. Workspace exports include your style and outfits.</p></section><div class="customize-layout"><section class="card"><div class="row between"><h2 style="margin-bottom:0">The theme atelier</h2><span class="chip">${appearance.preset === 'custom' ? 'Your own palette' : attrs(THEMES[appearance.preset].name)}</span></div><p class="help" style="margin-top:12px">Pick a starting mood, then make every color your own.</p><div class="theme-presets">${Object.entries(THEMES).map(([id, theme]) => button('custom-preset', `<span class="theme-swatches"><i style="background:${theme.background}"></i><i style="background:${theme.accent}"></i><i style="background:${theme.secondary}"></i></span><b>${theme.name}</b><small>${theme.note}</small>`, 'theme-preset', `data-preset="${id}" aria-pressed="${appearance.preset === id}"`)).join('')}</div><div class="custom-fields" style="margin-top:20px">${colorField('background', 'Page', appearance.background)}${colorField('surface', 'Cards', appearance.surface)}${colorField('text', 'Text', appearance.text)}${colorField('muted', 'Quiet text', appearance.muted)}${colorField('accent', 'Accent', appearance.accent)}${colorField('secondary', 'Sunshine', appearance.secondary)}${colorField('success', 'Success', appearance.success)}${colorField('border', 'Borders', appearance.border)}</div><label class="check" style="margin-top:18px"><input id="custom-autoContrast" type="checkbox" ${appearance.autoContrast ? 'checked' : ''}>Keep text readable as colors change</label><p class="palette-status help" role="status">${appearance.autoContrast ? 'Readable text adjusts automatically. ' : ''}Text contrast: ${textRatio.toFixed(1)}:1.${textRatio < 4.5 ? ' Choose stronger text and card contrast, or turn on readable text.' : ' Comfortable for everyday reading.'}</p><div class="appearance-preview"><span class="eyebrow">A tiny preview of your studio</span><div class="preview-card"><div class="preview-row"><span>${icon('spark')} A bright new idea</span><span class="chip">Ready</span></div><p class="help">Your next great example begins with a little curiosity.</p>${button('custom-preview', 'Give your idea a high five', 'blue')}</div></div></section><section class="card"><h2>Make the space feel right</h2><p class="help">Choose a gentle, roomy studio or a focused desk with more on screen.</p><div class="custom-fields">${select('density', 'Room to breathe', [['compact', 'Focused'], ['comfortable', 'Comfortable'], ['spacious', 'Extra roomy']], appearance.density)}${select('font', 'Lettering', [['system', 'Crisp system'], ['rounded', 'Soft & rounded'], ['mono', 'Code notebook']], appearance.font)}${select('scale', 'Text size', [['0.9', 'Smaller'], ['1', 'Standard'], ['1.1', 'Larger'], ['1.2', 'Largest']], String(appearance.scale))}${select('width', 'Laptop workspace width', [['cozy', 'Cozy desk'], ['balanced', 'Balanced'], ['wide', 'Wide workshop']], appearance.width)}${select('radius', 'Corners', [['8', 'Neatly squared'], ['14', 'Soft corners'], ['20', 'Distill Pets AI Studio curves'], ['28', 'Extra bubbly']], String(appearance.radius))}${select('decoration', 'Illustrated atmosphere', [['playful', 'Playful colors'], ['minimal', 'Quiet & minimal']], appearance.decoration)}${select('motion', 'Animation comfort', [['system', 'Follow my device'], ['full', 'Playful movement'], ['reduced', 'Gentle stillness']], appearance.motion)}</div><p class="help" style="margin-top:18px">Gentle stillness keeps task progress visible with fewer moving details. Device accessibility preferences are respected in every mode.</p><div class="notice"><b>A little wardrobe freedom</b><br>Dress either companion however you like. Outfits are cosmetic; the equipped model chip still powers the agent’s work.</div></section>${['milo', 'nova'].map(id => wardrobe(id)).join('')}</div>`;
  }
  function wardrobe(id) {
    const agent = getDB().agents[id], outfit = cleanOutfit(agent.outfit);
    const outfitName = OUTFITS.find(item => item.id === outfit).name;
    return `<section class="card wardrobe-card"><div class="row between"><h2 style="margin-bottom:0">${escape(agent.name)}’s wardrobe</h2><span class="chip">${outfitName}</span></div><div class="wardrobe-stage"><canvas width="36" height="48" class="pixel wardrobe-pet" data-pet="${attrs(agent.pet)}" data-owner="${id}" data-outfit-preview="${outfit}" aria-label="${attrs(agent.name)} wearing ${outfitName}"></canvas><span class="wardrobe-caption">${OUTFITS.find(item => item.id === outfit).mood}</span></div><div class="custom-fields"><div><label class="label" for="custom-name-${id}">Companion’s nickname</label><input id="custom-name-${id}" value="${attrs(agent.name)}" maxlength="40" ${deps.getBusy?.() ? 'disabled' : ''}></div><div><label class="label" for="custom-species-${id}">Pixel pet species</label><select id="custom-species-${id}">${ANIMALS.map(pet => `<option value="${pet.id}" ${agent.pet === pet.id ? 'selected' : ''}>${escape(pet.name)}</option>`).join('')}</select></div><div><label class="label" for="custom-skin-${id}">Agent icon</label><select id="custom-skin-${id}"><option value="cartoon" ${agent.skin !== 'pixel' ? 'selected' : ''}>Expressive cartoon</option><option value="pixel" ${agent.skin === 'pixel' ? 'selected' : ''}>My dressed pixel pet</option></select></div></div><p class="help" style="margin-top:16px">Pick a look. Pixel pet outfits appear in the garden, live rooms, and research trails.</p><div class="outfit-grid">${OUTFITS.map(item => button('custom-outfit', `<canvas width="36" height="48" class="pixel" data-pet="${attrs(agent.pet)}" data-owner="${id}" data-outfit-preview="${item.id}" aria-hidden="true"></canvas><span>${item.name}</span>`, 'outfit-tile', `data-owner="${id}" data-outfit="${item.id}" aria-pressed="${outfit === item.id}" aria-label="Dress ${attrs(agent.name)} in ${item.name}"`)).join('')}</div></section>`;
  }
  let renderPending = false;
  function commit() {
    apply();
    save();
    // A focused nickname can emit change while another view replaces the DOM.
    // Render after that event finishes so blur never causes a nested innerHTML.
    if (renderPending) return;
    renderPending = true;
    queueMicrotask(() => {
      renderPending = false;
      render();
      requestAnimationFrame(paintPreviews);
    });
  }
  function action(action, element) {
    if (!action.startsWith('custom-')) return false;
    const data = element?.dataset || element || {};
    const db = getDB();
    if (action === 'custom-preset' && Object.hasOwn(THEMES, data.preset)) {
      db.appearance = cleanAppearance({ ...getAppearance(), ...THEMES[data.preset], preset: data.preset });
      db.theme = data.preset === 'night' ? 'dark' : 'light';
      commit();
      toast(THEMES[data.preset].name + ' is ready.');
    } else if (action === 'custom-outfit' && ['milo', 'nova'].includes(data.owner)) {
      db.agents[data.owner].outfit = cleanOutfit(data.outfit);
      commit();
      toast(db.agents[data.owner].name + ' is dressed for the next adventure.');
    } else if (action === 'custom-random') {
      for (const agent of Object.values(db.agents)) agent.outfit = OUTFITS[1 + Math.floor(Math.random() * (OUTFITS.length - 1))].id;
      commit();
      toast('Two tiny wardrobes, two fresh looks.');
    } else if (action === 'custom-reset') {
      db.appearance = cleanAppearance(null);
      db.theme = 'light';
      commit();
      toast('Distill Pets AI Studio’s warm original appearance is back.');
    } else if (action === 'custom-preview') {
      toast('High five! Your ideas look right at home. ✨');
    }
    return true;
  }
  function change(element) {
    if (!element?.id?.startsWith('custom-')) return false;
    const id = element.id.slice(7);
    // Existing model inputs also use custom-milo/custom-nova. Leave them to
    // the application’s model selector rather than consuming their events.
    if (['milo', 'nova'].includes(id)) return false;
    const db = getDB();
    let changed = false;
    if (id.startsWith('color-') && COLOR_KEYS.includes(id.slice(6)) && validColor(element.value)) {
      db.appearance = { ...getAppearance(), [id.slice(6)]: element.value, preset: 'custom' };
      changed = true;
    } else if (['density', 'font', 'scale', 'width', 'radius', 'decoration', 'motion', 'autoContrast'].includes(id)) {
      db.appearance = cleanAppearance({ ...getAppearance(), [id]: id === 'autoContrast' ? element.checked : element.value });
      changed = true;
    } else {
      const match = /^(name|species|skin)-(milo|nova)$/.exec(id);
      if (match) {
        const [, property, owner] = match, agent = db.agents[owner];
        if (property === 'name' && !deps.getBusy?.()) {
          const name = String(element.value).replace(/[<>&]/g, '').trim().slice(0, 40);
          if (name) agent.name = name;
          else element.value = agent.name;
          changed = true;
        } else if (property === 'species' && ANIMALS.some(pet => pet.id === element.value)) {
          agent.pet = element.value;
          changed = true;
        } else if (property === 'skin' && ['pixel', 'cartoon'].includes(element.value)) {
          agent.skin = element.value;
          changed = true;
        }
      }
    }
    if (changed) commit();
    return changed;
  }
  function apply() {
    const db = getDB();
    db.appearance = cleanAppearance(db.appearance);
    return applyAppearance(db.appearance);
  }
  function paintPreviews() {
    document.querySelectorAll('canvas[data-outfit-preview]').forEach(canvas => {
      const animal = ANIMALS.find(pet => pet.id === canvas.dataset.pet) || ANIMALS[0];
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 36, 48);
      ctx.drawImage(getSprite(animal, { eyes: 'happy', mouth: 'smile', tail: 0 }, cleanOutfit(canvas.dataset.outfitPreview)), 0, 0);
    });
  }
  return { view, action, change, apply, paintPreviews };
}
