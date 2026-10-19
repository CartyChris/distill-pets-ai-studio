import { ANIMALS, getSprite } from './pixels.js';

// Original, deterministic scenery. Only provider output creates actual resources.
const WIDTH = 6144,
  HEIGHT = 4096,
  TAU = Math.PI * 2,
  MIN_ZOOM = 0.045;
const CAMP = { x: 2940, y: 2030 };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const WORLD_BIOMES = Object.freeze({
  meadow: {
    title: 'Wildflower Commons',
    x: 1730,
    y: 1270,
    ground: '#b9ce91',
    dark: '#7ea879',
    tree: '#71a779',
    accent: '#efbf68',
    symbol: '✿',
  },
  archive: {
    title: 'Starlight Archive',
    x: 4460,
    y: 1120,
    ground: '#b5b3d2',
    dark: '#8c96b2',
    tree: '#9d9abb',
    accent: '#d9bfec',
    symbol: '✧',
  },
  coast: {
    title: 'Whispering Coast',
    x: 4650,
    y: 3010,
    ground: '#e0d5ae',
    dark: '#c5bc91',
    tree: '#7eb5a4',
    accent: '#78cbd2',
    symbol: '≈',
  },
  workshop: {
    title: 'Moss & Copper Hollow',
    x: 1510,
    y: 3030,
    ground: '#a9bd99',
    dark: '#82a28a',
    tree: '#648f84',
    accent: '#e5ae7c',
    symbol: '⚙',
  },
});
const hash = (input) => {
  let h = 2166136261;
  for (const ch of String(input || 'pip-wilds')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const rngFrom = (seed) => {
  let s = hash(seed);
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const riverX = (y) => 3520 + Math.sin(y / 540) * 245 + Math.sin(y / 170) * 50;
const waterAt = (x, y) =>
  Math.abs(x - riverX(y)) < 63 ||
  ((x - 5710) / 1270) ** 2 + ((y - 3350) / 1040) ** 2 < 0.94 ||
  ((x - 1270) / 330) ** 2 + ((y - 710) / 195) ** 2 < 1;
const biomeAt = (x, y) =>
  x > 3370
    ? y < 2050
      ? 'archive'
      : 'coast'
    : y < 2290
      ? 'meadow'
      : 'workshop';
const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      0,
      1,
    );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};

// These scenic routes describe geography, never model progress or completed lessons.
const TEACHING_ROUTES = Object.freeze({
  meadow: ['flower-class', 'oak', 'pond', 'camp'],
  archive: ['library', 'observatory', 'ruins', 'camp'],
  coast: ['lighthouse', 'shells', 'harbor', 'camp'],
  workshop: ['workshop', 'bridge', 'windmill', 'camp'],
});
export function routeForOuting(outing) {
  if (outing?.kind === 'teach') return [...(TEACHING_ROUTES[outing.biome] || TEACHING_ROUTES.meadow)];
  return outing?.kind === 'code'
    ? ['workshop', 'bridge', 'forge', 'windmill', 'camp']
    : outing?.kind === 'research'
      ? ['library', 'observatory', 'lighthouse', 'shells', 'camp']
      : ['oak', 'flower-class', 'crystal', 'harbor', 'camp'];
}

export function generateWorld(seed = 'pip-wilds') {
  const random = rngFrom(seed);
  const sites = [
    [
      'camp',
      'Curiosity Camp',
      2940,
      2030,
      'camp',
      'A shared home for your companions. The world is a visualization; actual model activity appears in the live journal.',
    ],
    [
      'flower-class',
      'The Flower Classroom',
      1830,
      1360,
      'classroom',
      'A circle of cushions where examples become explanations. Read the live lesson to see what the models actually said.',
    ],
    [
      'oak',
      'The Question Oak',
      1120,
      1750,
      'oak',
      'Every adventure begins with a clear question. Try a narrower task or a concrete example.',
    ],
    [
      'pond',
      'Mirror Pond',
      1270,
      710,
      'pond',
      'Compare a fresh task to discover whether a model chip helps.',
    ],
    [
      'honey',
      'The Pollinator Post',
      2420,
      720,
      'beehive',
      'Reusable examples should cover meaningful variations of your task.',
    ],
    [
      'library',
      'The Open-Air Archive',
      4320,
      1140,
      'library',
      'The archivist organizes sources and examples. Only actual returned citations enter the resource collection.',
    ],
    [
      'observatory',
      'Little Star Observatory',
      5140,
      620,
      'observatory',
      'Check what an answer supports, what it assumes, and what remains uncertain.',
    ],
    [
      'ruins',
      'The Ruins of Almost',
      4660,
      1740,
      'ruins',
      'Old drafts can teach useful lessons. Review an example before approving it for a chip.',
    ],
    [
      'clock',
      'The Thinking Clock',
      3960,
      450,
      'clock',
      'Animations do not estimate provider progress or guarantee a result.',
    ],
    [
      'lighthouse',
      'The Source Lighthouse',
      5070,
      2650,
      'lighthouse',
      'Trace claims back to their source. Open the real links in your resource collection.',
    ],
    [
      'shells',
      'Seashell Study Bay',
      4240,
      3000,
      'shells',
      'A student can study a teacher demonstration without changing hosted model weights.',
    ],
    [
      'harbor',
      'The Returning Harbor',
      4720,
      3570,
      'harbor',
      'Real answers, files, sources, and demonstrations come home. Scenic objects stay in the world.',
    ],
    [
      'crystal',
      'The Crystal Clearing',
      3860,
      2470,
      'crystal',
      'A useful lesson explains when and why an approach works.',
    ],
    [
      'workshop',
      'The Mossy Makerspace',
      1630,
      2880,
      'workshop',
      'Open Code studio for actual generated files and the browser preview.',
    ],
    [
      'bridge',
      'The Little Test Bridge',
      2410,
      3370,
      'bridge',
      'A fresh task tests whether an approach generalizes beyond its examples.',
    ],
    [
      'windmill',
      'The Iteration Windmill',
      750,
      2860,
      'windmill',
      'Recursive passes need a clear limit and feedback. Live passes spend real model calls.',
    ],
    [
      'forge',
      'The Chip Garden',
      1190,
      3590,
      'forge',
      'Approved instructions and examples live in portable model chips. Equip another companion to use them.',
    ],
  ];
  const landmarks = sites.map(([id, title, x, y, kind, description]) => ({
    id,
    title,
    x,
    y,
    kind,
    description,
    type: 'landmark',
    biome: biomeAt(x, y),
    radius: id === 'camp' ? 164 : 110,
  }));
  const roads = [],
    route = (ids) =>
      ids.slice(1).forEach((id, i) => {
        const a = landmarks.find((l) => l.id === ids[i]),
          b = landmarks.find((l) => l.id === id);
        roads.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
      });
  route([
    'oak',
    'flower-class',
    'camp',
    'library',
    'ruins',
    'lighthouse',
    'shells',
    'harbor',
  ]);
  route(['pond', 'flower-class', 'honey']);
  route(['library', 'observatory', 'clock']);
  route(['camp', 'workshop', 'windmill']);
  route(['workshop', 'forge', 'bridge', 'crystal', 'lighthouse']);
  route(['camp', 'crystal']);
  const assets = [];
  for (let i = 0; i < 3100; i++) {
    const x = 110 + random() * (WIDTH - 220),
      y = 100 + random() * (HEIGHT - 200),
      biome = biomeAt(x, y),
      roll = random();
    if (
      waterAt(x, y) ||
      roads.some(({ a, b }) => segmentDistance({ x, y }, a, b) < 54) ||
      landmarks.some((l) => dist(l, { x, y }) < l.radius + 26)
    )
      continue;
    const kind =
      roll < 0.26
        ? 'tree'
        : roll < 0.35
          ? 'rock'
          : roll < 0.52
            ? 'bush'
            : roll < 0.78
              ? 'flowers'
              : roll < 0.88
                ? 'grass'
                : roll < 0.94
                  ? 'mushroom'
                  : biome === 'coast'
                    ? 'shell'
                    : 'stump';
    assets.push({
      id: 'scenery-' + i,
      x: Math.round(x),
      y: Math.round(y),
      kind,
      biome,
      variant: Math.floor(random() * 5),
      scale: 0.75 + random() * 0.7,
      phase: random() * TAU,
    });
  }
  for (let i = 0; i < 55; i++) {
    const a = (i / 55) * TAU,
      r = 240 + random() * 135;
    assets.push({
      id: 'camp-garden-' + i,
      x: CAMP.x + Math.cos(a) * r,
      y: CAMP.y + Math.sin(a) * r * 0.7,
      kind: i % 5 === 0 ? 'tree' : i % 3 === 0 ? 'mushroom' : 'flowers',
      biome: i % 3 === 0 ? 'archive' : 'meadow',
      variant: i % 5,
      scale: 0.7 + random() * 0.4,
      phase: a,
    });
  }
  const npcs = [
    [
      'archivist',
      'Sage the Archivist',
      'owl',
      'wizard',
      'library',
      'Source keeper',
      'Sage represents organizing actual sources returned by a research model.',
    ],
    [
      'reviewer',
      'Pip the Reviewer',
      'raccoon',
      'shades',
      'ruins',
      'Review station',
      'Inspect quality and limitations before approving an example.',
    ],
    [
      'builder',
      'Tinker the Builder',
      'bear',
      'scarf',
      'workshop',
      'File workshop',
      'Real files appear only when the model returns them.',
    ],
    [
      'courier',
      'Poco the Courier',
      'penguin',
      'bow',
      'harbor',
      'Result courier',
      'The resource collection contains material produced by an actual run.',
    ],
    [
      'guide',
      'Fern the Trail Guide',
      'deer',
      'flowers',
      'camp',
      'Question guide',
      'Choose a clear task, then watch the actual work in the live journal.',
    ],
    [
      'chipkeeper',
      'Moss the Chip Keeper',
      'frog',
      'crown',
      'forge',
      'Chip keeper',
      'A chip stores instructions and examples. It does not modify hosted model weights.',
    ],
    [
      'observer',
      'Lumi the Observer',
      'cat',
      'phones',
      'flower-class',
      'Student observer',
      'Observing output and producing a new student response are different steps.',
    ],
  ].map(([id, title, pet, outfit, site, topic, description], i) => {
    const l = landmarks.find((p) => p.id === site);
    return {
      id,
      title,
      pet,
      outfit,
      x: l.x + 105,
      y: l.y + 92,
      topic,
      description,
      phase: i * 1.73,
      type: 'npc',
      site,
    };
  });
  const enemies = [
    [
      'confusion',
      'Confusion Slime',
      3330,
      2200,
      'A friendly scenic obstacle: unclear instructions. Narrow the goal, add an example, or define a good result.',
    ],
    [
      'assumption',
      'Assumption Puff',
      4510,
      1490,
      'A scenic reminder to separate facts from assumptions. This is not a provider error.',
    ],
    [
      'tangle',
      'The Tangled Thought',
      1930,
      3150,
      'Split a large task into smaller steps and check each result.',
    ],
    [
      'echo',
      'The Echo Jelly',
      4240,
      2730,
      'Repeating an example is not proof of generalization. Try a fresh test task.',
    ],
  ].map(([id, title, x, y, description], i) => ({
    id,
    title,
    x,
    y,
    description,
    type: 'enemy',
    phase: i * 2.1,
    topic: 'Scenic workflow metaphor',
  }));
  return {
    seed: String(seed),
    width: WIDTH,
    height: HEIGHT,
    camp: { ...CAMP },
    regions: Object.entries(WORLD_BIOMES).map(([id, r]) => ({ id, ...r })),
    landmarks,
    assets,
    roads,
    npcs,
    enemies,
  };
}

function round(c, x, y, w, h, r = 10) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else {
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
  }
}
const oval = (c, x, y, rx, ry, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  c.fill();
};
const line = (c, p, color, w = 3) => {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  p.forEach((v, i) => (i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1])));
  c.stroke();
};
const poly = (c, p, color) => {
  c.fillStyle = color;
  c.beginPath();
  p.forEach((v, i) => (i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1])));
  c.closePath();
  c.fill();
};
const text = (c, s, x, y, size = 13, color = '#344841', weight = 700) => {
  c.font = weight + ' ' + size + 'px ui-rounded, system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(s, x, y);
};
const star = (c, x, y, r, color) => {
  const p = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    p.push([
      x + Math.cos(a) * r * (i % 2 ? 0.28 : 1),
      y + Math.sin(a) * r * (i % 2 ? 0.28 : 1),
    ]);
  }
  poly(c, p, color);
};

function drawTree(c, x, y, biome, scale, variant, wind = 0) {
  const p = WORLD_BIOMES[biome],
    tall = variant % 2 === 0,
    h = tall ? 146 : 118;
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  oval(c, 7, 4, 44, 14, '#40554428');
  line(
    c,
    [
      [2, -3],
      [-4, -h * 0.65],
    ],
    '#897463',
    15,
  );
  line(
    c,
    [
      [-2, -47],
      [-25, -76],
    ],
    '#897463',
    7,
  );
  c.translate(wind, 0);
  if (biome === 'coast' && variant < 3) {
    line(
      c,
      [
        [0, 0],
        [-5, -50],
        [8, -116],
      ],
      '#ab9474',
      13,
    );
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU,
        dx = Math.cos(a),
        dy = Math.sin(a);
      poly(
        c,
        [
          [8, -116],
          [8 + dx * 45 - dy * 15, -112 + dy * 30 + dx * 8],
          [8 + dx * 81, -91 + dy * 43],
          [8 + dx * 38 + dy * 8, -113 + dy * 20 - dx * 8],
        ],
        i % 2 ? '#7eaa83' : '#559b83',
      );
    }
    oval(c, 7, -107, 8, 8, '#b5936b');
  } else if (tall && biome !== 'meadow') {
    poly(
      c,
      [
        [0, -h - 18],
        [-49, -54],
        [-27, -58],
        [-59, -24],
        [54, -24],
        [29, -59],
        [47, -54],
      ],
      p.dark,
    );
    poly(
      c,
      [
        [-3, -h - 19],
        [-43, -64],
        [-18, -70],
        [-47, -35],
        [3, -35],
        [13, -72],
      ],
      p.tree,
    );
    line(
      c,
      [
        [-18, -96],
        [-30, -73],
      ],
      '#ffffff30',
      6,
    );
  } else {
    oval(c, 3, -h + 24, 55, 47, p.dark);
    oval(c, -27, -h + 35, 39, 36, p.tree);
    oval(c, 28, -h + 34, 37, 38, p.tree);
    oval(c, -7, -h + 7, 41, 35, p.tree);
    oval(c, -20, -h + 1, 23, 15, '#ffffff24');
    if (variant === 3)
      for (let i = 0; i < 6; i++)
        oval(
          c,
          Math.sin(i * 2) * 39,
          -h + 26 + Math.cos(i * 2) * 27,
          5,
          5,
          biome === 'archive' ? '#f1d5e6' : '#edbc79',
        );
  }
  c.restore();
}
function drawSmall(c, o) {
  const { kind, variant: v = 0, biome = 'meadow' } = o,
    p = WORLD_BIOMES[biome];
  c.save();
  c.translate(o.x, o.y);
  c.scale(o.scale || 1, o.scale || 1);
  if (kind === 'rock') {
    oval(c, 4, 2, 30, 9, '#475c4926');
    poly(
      c,
      [
        [-28, -5],
        [-20, -31],
        [5, -43],
        [27, -28],
        [33, -5],
        [8, 3],
      ],
      biome === 'archive' ? '#aaa1b5' : '#9fa99c',
    );
    poly(
      c,
      [
        [-20, -31],
        [5, -43],
        [27, -28],
        [-2, -21],
      ],
      '#c4c6b6',
    );
  } else if (kind === 'bush') {
    oval(c, 0, 2, 31, 8, '#4d6c4730');
    oval(c, -15, -13, 20, 18, p.dark);
    oval(c, 10, -18, 24, 23, p.tree);
    oval(c, -2, -30, 18, 13, p.tree);
    if (v % 2)
      for (let i = 0; i < 5; i++)
        oval(
          c,
          Math.sin(i * 1.9) * 18,
          -19 + Math.cos(i * 1.9) * 10,
          3,
          3,
          '#e7a6b2',
        );
  } else if (kind === 'flowers') {
    const colors = ['#f4d982', '#f5c1c1', '#c4b9e6', '#fff5cf', '#eeaa85'];
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 9,
        h = 12 + ((i * 7 + v * 3) % 15);
      line(
        c,
        [
          [x, 0],
          [x + 2, -h],
        ],
        '#759970',
        2,
      );
      for (let j = 0; j < 5; j++)
        oval(
          c,
          x + 2 + Math.cos((j / 5) * TAU) * 4,
          -h + Math.sin((j / 5) * TAU) * 4,
          3.8,
          3.8,
          colors[v % 5],
        );
      oval(c, x + 2, -h, 2.5, 2.5, '#e1b759');
    }
  } else if (kind === 'grass') {
    for (let i = 0; i < 5; i++)
      line(
        c,
        [
          [(i - 2) * 5, 0],
          [(i - 2) * 8, -10 - (i % 3) * 4],
        ],
        '#7d9f7880',
        2,
      );
  } else if (kind === 'mushroom') {
    for (let i = 0; i < 2; i++) {
      const x = i * 14 - 5,
        h = 18 + i * 5;
      line(
        c,
        [
          [x, 0],
          [x, -h],
        ],
        '#e7d5b4',
        6,
      );
      oval(
        c,
        x,
        -h,
        13 - i * 2,
        8,
        biome === 'archive' ? '#b497c6' : '#dc9982',
      );
      oval(c, x - 5, -h - 2, 2, 2, '#ffe8cb');
    }
  } else if (kind === 'shell') {
    poly(
      c,
      [
        [0, 1],
        [-17, -17],
        [-11, -25],
        [0, -28],
        [12, -23],
        [18, -16],
      ],
      '#f1c7b5',
    );
    for (let i = -1; i <= 1; i++)
      line(
        c,
        [
          [0, -2],
          [i * 11, -22],
        ],
        '#c99f97',
        2,
      );
  } else {
    oval(c, 0, -5, 18, 10, '#8e8670');
    c.fillStyle = '#ad9d7e';
    c.fillRect(-18, -23, 36, 18);
    oval(c, 0, -23, 18, 8, '#dbc7a0');
  }
  c.restore();
}

function drawLandmark(c, l, t, motion) {
  const { x, y, kind } = l;
  c.save();
  c.translate(x, y);
  const roof = (cy, w, h, color) => {
    poly(
      c,
      [
        [-w, cy],
        [0, cy - h],
        [w, cy],
      ],
      color,
    );
    line(
      c,
      [
        [-w, cy],
        [0, cy - h],
        [w, cy],
      ],
      '#75675a',
      5,
    );
  };
  const lantern = (lx, ly) => {
    line(
      c,
      [
        [lx, ly + 15],
        [lx, ly - 55],
        [lx + 17, ly - 55],
      ],
      '#8a7861',
      4,
    );
    round(c, lx + 9, ly - 53, 17, 23, 5);
    c.fillStyle = '#f6d08b';
    c.fill();
    oval(c, lx + 17, ly - 41, 25, 26, '#ffe0a426');
  };
  oval(c, 4, 16, kind === 'camp' ? 163 : 108, 40, '#4c655127');
  if (kind === 'camp') {
    oval(c, 0, 0, 156, 96, '#d5cba3');
    oval(c, 0, 0, 133, 76, '#e8d8ad');
    poly(
      c,
      [
        [-143, -15],
        [-96, -106],
        [-31, -16],
      ],
      '#e4b579',
    );
    poly(
      c,
      [
        [-96, -106],
        [-49, -37],
        [-31, -16],
        [-88, -22],
      ],
      '#c89870',
    );
    poly(
      c,
      [
        [-116, -16],
        [-91, -64],
        [-71, -16],
      ],
      '#6b7c6a',
    );
    poly(
      c,
      [
        [49, -36],
        [91, -119],
        [145, -36],
      ],
      '#91ada0',
    );
    poly(
      c,
      [
        [91, -119],
        [144, -36],
        [101, -36],
      ],
      '#76978b',
    );
    poly(
      c,
      [
        [79, -36],
        [94, -77],
        [111, -36],
      ],
      '#596d65',
    );
    for (let i = 0; i < 7; i++)
      oval(
        c,
        Math.cos((i / 7) * TAU) * 25,
        19 + Math.sin((i / 7) * TAU) * 12,
        9,
        6,
        '#9b9e87',
      );
    line(
      c,
      [
        [-16, 27],
        [18, 8],
      ],
      '#9e7559',
      9,
    );
    line(
      c,
      [
        [-12, 7],
        [17, 27],
      ],
      '#9e7559',
      9,
    );
    for (let i = 0; i < 3; i++) {
      const dance = motion ? Math.sin(t * 6 + i * 2) * 3 : 0;
      poly(
        c,
        [
          [-13 + i * 10, 17],
          [-6 + i * 10 + dance, -16 - (i % 2) * 10],
          [4 + i * 8, 18],
        ],
        i % 2 ? '#edb367' : '#ef9564',
      );
    }
    line(
      c,
      [
        [-147, -81],
        [147, -121],
      ],
      '#a58f6c',
      2,
    );
    for (let i = 0; i < 11; i++)
      oval(
        c,
        -132 + i * 27,
        -75 - i * 3.7,
        4.5,
        6,
        i % 2 ? '#f2d2a0' : '#f0d8c0',
      );
    lantern(-167, 17);
    lantern(147, 18);
  } else if (kind === 'classroom') {
    oval(c, 0, 0, 103, 61, '#d5c797');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      oval(
        c,
        Math.cos(a) * 72,
        Math.sin(a) * 37 + 8,
        17,
        10,
        ['#c3a9b8', '#afbe97', '#d6b080'][i % 3],
      );
    }
    c.fillStyle = '#927c62';
    c.fillRect(-37, -91, 74, 8);
    c.fillRect(-30, -85, 5, 49);
    c.fillRect(25, -85, 5, 49);
    round(c, -31, -84, 62, 44, 3);
    c.fillStyle = '#658b7e';
    c.fill();
    line(
      c,
      [
        [-20, -68],
        [16, -68],
      ],
      '#e4ead4',
      3,
    );
    line(
      c,
      [
        [-20, -57],
        [1, -57],
      ],
      '#e4ead4',
      3,
    );
    drawSmall(c, {
      x: 0,
      y: 5,
      kind: 'flowers',
      biome: 'meadow',
      variant: 0,
      scale: 1.8,
    });
  } else if (kind === 'oak') {
    drawTree(c, 0, 6, 'meadow', 1.75, 3, motion ? Math.sin(t) * 2 : 0);
    round(c, -40, -12, 80, 20, 5);
    c.fillStyle = '#a88a66';
    c.fill();
  } else if (kind === 'pond') {
    oval(c, -10, 5, 137, 59, '#8cbea9');
    oval(c, -15, 0, 121, 47, '#91c2be');
    for (let i = 0; i < 5; i++) {
      oval(c, Math.cos(i * 2) * 70, Math.sin(i * 2) * 24, 15, 5, '#6aa78f');
      if (i % 2)
        oval(
          c,
          Math.cos(i * 2) * 70,
          Math.sin(i * 2) * 24 - 5,
          6,
          4,
          '#ead1d7',
        );
    }
  } else if (kind === 'beehive') {
    line(
      c,
      [
        [-57, 0],
        [-57, -85],
        [58, -85],
        [58, 0],
      ],
      '#a28962',
      8,
    );
    roof(-80, 77, 42, '#c8ae75');
    for (let i = 0; i < 4; i++)
      oval(c, 0, -60 + i * 12, 21 + i * 6, 10, i % 2 ? '#dbb46d' : '#e7c786');
    oval(c, 0, -26, 9, 11, '#816d50');
  } else if (kind === 'library') {
    c.fillStyle = '#e7daca';
    round(c, -93, -116, 186, 126, 7);
    c.fill();
    roof(-111, 114, 62, '#aaa0b8');
    for (const bx of [-61, 0, 61]) {
      c.fillStyle = '#8e7d7c';
      c.fillRect(bx - 21, -99, 42, 99);
      for (let row = 0; row < 3; row++) {
        c.fillStyle = '#ad9480';
        c.fillRect(bx - 22, -72 + row * 30, 44, 5);
        for (let j = 0; j < 5; j++) {
          c.fillStyle = ['#b4bdab', '#e4bd99', '#b8b0c9', '#a1bac0', '#dfcfa5'][
            j
          ];
          c.fillRect(
            bx - 18 + j * 7,
            -91 + row * 30 + (j % 2) * 3,
            5,
            20 - (j % 2) * 3,
          );
        }
      }
    }
    poly(
      c,
      [
        [-45, 26],
        [0, 17],
        [45, 26],
        [0, 36],
      ],
      '#bba688',
    );
    poly(
      c,
      [
        [-42, 22],
        [0, 13],
        [0, 31],
      ],
      '#f5ebd5',
    );
    poly(
      c,
      [
        [0, 13],
        [41, 22],
        [0, 31],
      ],
      '#e6d9bd',
    );
  } else if (kind === 'observatory') {
    c.fillStyle = '#ded6d1';
    round(c, -65, -82, 130, 91, 8);
    c.fill();
    c.fillStyle = '#a9a4be';
    c.beginPath();
    c.arc(0, -81, 69, Math.PI, 0);
    c.fill();
    line(
      c,
      [
        [-4, -145],
        [7, -86],
      ],
      '#d1c5da',
      8,
    );
    c.save();
    c.translate(13, -101);
    c.rotate(-0.5);
    c.fillStyle = '#8a8aa5';
    c.fillRect(-8, -56, 27, 73);
    oval(c, 5, -57, 19, 8, '#d3ccd6');
    c.restore();
    round(c, -16, -30, 32, 40, 12);
    c.fillStyle = '#817c94';
    c.fill();
    star(c, -40, -42, 8, '#f2d7a1');
  } else if (kind === 'ruins') {
    for (const [rx, rh] of [
      [-68, 94],
      [-29, 64],
      [55, 111],
    ]) {
      c.fillStyle = '#aca9ae';
      c.fillRect(rx - 14, -rh, 28, rh);
      c.fillStyle = '#cac3c3';
      c.fillRect(rx - 20, -rh - 7, 40, 10);
      for (let i = 0; i < 3; i++)
        line(
          c,
          [
            [rx - 9 + i * 9, -rh + 12],
            [rx - 9 + i * 9, -8],
          ],
          '#97999e',
          2,
        );
      oval(c, rx, -2, 23, 9, '#8fa08b');
    }
    line(
      c,
      [
        [-68, -102],
        [-20, -109],
        [21, -88],
        [55, -119],
      ],
      '#c4bec0',
      12,
    );
    drawSmall(c, {
      x: 12,
      y: 7,
      kind: 'bush',
      biome: 'archive',
      scale: 1.2,
      variant: 1,
    });
  } else if (kind === 'clock') {
    c.fillStyle = '#a7a1ad';
    round(c, -27, -143, 54, 152, 8);
    c.fill();
    oval(c, 0, -116, 34, 34, '#cbb69e');
    oval(c, 0, -116, 27, 27, '#f2e4c9');
    line(
      c,
      [
        [0, -134],
        [0, -116],
        [13, -109],
      ],
      '#8a7c71',
      3,
    );
    roof(-149, 43, 30, '#9189a5');
  } else if (kind === 'lighthouse') {
    poly(
      c,
      [
        [-35, 10],
        [-23, -156],
        [23, -156],
        [35, 10],
      ],
      '#f1e5cf',
    );
    poly(
      c,
      [
        [-32, -31],
        [-28, -70],
        [28, -70],
        [32, -31],
      ],
      '#d7a39a',
    );
    poly(
      c,
      [
        [-26, -102],
        [-23, -135],
        [23, -135],
        [26, -102],
      ],
      '#d7a39a',
    );
    c.fillStyle = '#a9bec0';
    c.fillRect(-27, -178, 54, 28);
    roof(-177, 39, 28, '#8a9da3');
    oval(c, 0, -163, 11, 11, '#f8d787');
    line(
      c,
      [
        [-38, -149],
        [38, -149],
      ],
      '#849896',
      4,
    );
    round(c, -12, -23, 24, 34, 10);
    c.fillStyle = '#a3a391';
    c.fill();
  } else if (kind === 'shells') {
    oval(c, 0, -3, 81, 27, '#b5d7cd');
    oval(c, 0, -8, 63, 18, '#8cbfb9');
    for (let i = 0; i < 7; i++)
      drawSmall(c, {
        kind: 'shell',
        x: Math.cos(i) * 87,
        y: Math.sin(i) * 31 + 10,
        scale: 0.8,
        variant: i,
      });
  } else if (kind === 'harbor') {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#b49f7e' : '#c5af88';
      c.fillRect(-50, -60 + i * 12, 100, 10);
    }
    line(
      c,
      [
        [-47, -70],
        [-47, 45],
      ],
      '#917f66',
      7,
    );
    line(
      c,
      [
        [47, -70],
        [47, 45],
      ],
      '#917f66',
      7,
    );
    poly(
      c,
      [
        [63, -2],
        [143, -2],
        [124, 23],
        [77, 23],
      ],
      '#aa8e71',
    );
    line(
      c,
      [
        [105, -1],
        [105, -84],
      ],
      '#928169',
      4,
    );
    poly(
      c,
      [
        [109, -82],
        [109, -12],
        [153, -12],
      ],
      '#f0d8b0',
    );
  } else if (kind === 'crystal') {
    for (let i = 0; i < 5; i++) {
      const cx = (i - 2) * 22,
        cy = Math.sin(i * 2) * 12,
        h = i === 2 ? 101 : 47 + i * 5;
      poly(
        c,
        [
          [cx - 15, cy],
          [cx - 11, cy - h + 15],
          [cx + 1, cy - h],
          [cx + 18, cy - h + 18],
          [cx + 16, cy],
        ],
        i % 2 ? '#aab1cd' : '#9dc9c9',
      );
      poly(
        c,
        [
          [cx + 1, cy - h],
          [cx + 18, cy - h + 18],
          [cx + 16, cy],
          [cx, cy],
        ],
        '#ffffff35',
      );
    }
  } else if (kind === 'workshop') {
    c.fillStyle = '#c1b598';
    c.fillRect(-80, -110, 160, 121);
    roof(-110, 103, 68, '#83a292');
    c.fillStyle = '#b3a38b';
    c.fillRect(51, -174, 26, 57);
    c.fillStyle = '#827c67';
    c.fillRect(-26, -49, 52, 60);
    for (const wx of [-54, 54]) {
      round(c, wx - 16, -90, 32, 28, 5);
      c.fillStyle = '#bed7c8';
      c.fill();
      line(
        c,
        [
          [wx, -90],
          [wx, -63],
        ],
        '#8e9d86',
        3,
      );
    }
    c.fillStyle = '#9e886b';
    c.fillRect(-101, 21, 66, 10);
    c.fillRect(-95, 30, 6, 21);
    c.fillRect(-46, 30, 6, 21);
  } else if (kind === 'bridge') {
    c.save();
    c.rotate(-0.12);
    for (let i = 0; i < 10; i++) {
      c.fillStyle = i % 2 ? '#baaa86' : '#c8b795';
      c.fillRect(-110 + i * 22, -25, 20, 65);
    }
    line(
      c,
      [
        [-110, -44],
        [-45, -62],
        [45, -62],
        [110, -44],
      ],
      '#8b9476',
      7,
    );
    for (const bx of [-110, -45, 45, 110])
      line(
        c,
        [
          [bx, -9],
          [bx, -59],
        ],
        '#8b9476',
        6,
      );
    c.restore();
  } else if (kind === 'windmill') {
    poly(
      c,
      [
        [-47, 11],
        [-29, -137],
        [29, -137],
        [47, 11],
      ],
      '#d9c9a4',
    );
    roof(-136, 51, 36, '#95aa97');
    c.save();
    c.translate(0, -109);
    c.rotate(motion ? t * 0.22 : 0.3);
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      line(
        c,
        [
          [0, 0],
          [0, -101],
        ],
        '#968b72',
        6,
      );
      poly(
        c,
        [
          [2, -30],
          [29, -31],
          [29, -96],
          [2, -96],
        ],
        '#e9dfba',
      );
      for (let j = 0; j < 4; j++)
        line(
          c,
          [
            [2, -38 - j * 16],
            [29, -38 - j * 16],
          ],
          '#b8ac89',
          2,
        );
    }
    oval(c, 0, 0, 12, 12, '#9b9279');
    c.restore();
  } else if (kind === 'forge') {
    oval(c, 0, 0, 99, 37, '#b7c69c');
    for (let i = 0; i < 5; i++) {
      const cx = (i - 2) * 35,
        cy = (i % 2) * 18;
      line(
        c,
        [
          [cx, cy],
          [cx, cy - 32],
        ],
        '#749b80',
        4,
      );
      round(c, cx - 14, cy - 55, 28, 27, 5);
      c.fillStyle = ['#d2bf8c', '#b4a7c8', '#90bbad'][i % 3];
      c.fill();
      for (let j = 0; j < 3; j++) {
        line(
          c,
          [
            [cx - 18, cy - 50 + j * 8],
            [cx - 14, cy - 50 + j * 8],
          ],
          '#9a9b7a',
          2,
        );
        line(
          c,
          [
            [cx + 14, cy - 50 + j * 8],
            [cx + 18, cy - 50 + j * 8],
          ],
          '#9a9b7a',
          2,
        );
      }
    }
  }
  if (kind !== 'pond') {
    line(
      c,
      [
        [-66, 49],
        [-66, 13],
      ],
      '#9b896b',
      5,
    );
    round(c, -92, 7, 53, 23, 6);
    c.fillStyle = '#e1d1aa';
    c.fill();
    text(c, WORLD_BIOMES[l.biome].symbol, -65, 19, 17, '#7d8263');
  }
  c.restore();
}

function makeTerrain(world) {
  const scale = 0.45,
    canvas = document.createElement('canvas');
  canvas.width = Math.ceil(WIDTH * scale);
  canvas.height = Math.ceil(HEIGHT * scale);
  const c = canvas.getContext('2d');
  c.scale(scale, scale);
  c.fillStyle = '#b9ca99';
  c.fillRect(0, 0, WIDTH, HEIGHT);
  for (const region of world.regions) {
    const gradient = c.createRadialGradient(
      region.x,
      region.y,
      200,
      region.x,
      region.y,
      2500,
    );
    gradient.addColorStop(0, region.ground);
    gradient.addColorStop(0.65, region.ground + 'b8');
    gradient.addColorStop(1, region.ground + '00');
    c.fillStyle = gradient;
    c.fillRect(0, 0, WIDTH, HEIGHT);
  }
  const random = rngFrom(world.seed + '-terrain');
  for (let i = 0; i < 5600; i++) {
    const x = random() * WIDTH,
      y = random() * HEIGHT;
    oval(
      c,
      x,
      y,
      6 + random() * 35,
      2 + random() * 10,
      i % 2 ? '#ffffff0c' : '#526c4a08',
    );
  }
  // Soft shore, lake, and winding river; reflections animate separately.
  oval(c, 5710, 3350, 1293, 1057, '#ece2bd');
  oval(c, 5710, 3350, 1260, 1027, '#8dbbbd');
  oval(c, 5710, 3350, 1210, 977, '#82afb7');
  oval(c, 1270, 710, 350, 210, '#a3bfa0');
  oval(c, 1270, 710, 331, 194, '#99c1b5');
  const river = [];
  for (let y = -100; y <= HEIGHT + 100; y += 24) river.push([riverX(y), y]);
  line(c, river, '#d0d0a6', 164);
  line(c, river, '#9bc2b9', 134);
  line(c, river, '#8bb6b2', 98);
  line(
    c,
    river.map(([x, y]) => [x - 30, y]),
    '#c7ded02e',
    22,
  );
  for (const { a, b } of world.roads) {
    line(
      c,
      [
        [a.x, a.y],
        [b.x, b.y],
      ],
      '#b3ae8730',
      95,
    );
    line(
      c,
      [
        [a.x, a.y],
        [b.x, b.y],
      ],
      '#d6c99f',
      75,
    );
    line(
      c,
      [
        [a.x, a.y],
        [b.x, b.y],
      ],
      '#e0d1ab',
      57,
    );
  }
  // Draw a wooden crossing at every trail / river intersection.
  for (const { a, b } of world.roads) {
    let crossing = null;
    const samples = Math.ceil(dist(a, b) / 15);
    for (let i = 1; i < samples; i++) {
      const x = lerp(a.x, b.x, i / samples),
        y = lerp(a.y, b.y, i / samples);
      if (Math.abs(x - riverX(y)) < 15) {
        crossing = { x, y };
        break;
      }
    }
    if (crossing) {
      c.save();
      c.translate(crossing.x, crossing.y);
      c.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      for (let i = 0; i < 12; i++) {
        c.fillStyle = i % 2 ? '#b4a183' : '#c9b797';
        c.fillRect(-126 + i * 21, -42, 19, 84);
      }
      line(
        c,
        [
          [-132, -46],
          [132, -46],
        ],
        '#8f9276',
        7,
      );
      line(
        c,
        [
          [-132, 46],
          [132, 46],
        ],
        '#8f9276',
        7,
      );
      c.restore();
    }
  }
  // A boundary forest hints at a larger world while keeping the playable map finite.
  for (let i = 0; i < 140; i++) {
    const x = random() * WIDTH,
      y = i % 2 ? 50 : HEIGHT - 35;
    drawTree(c, x, y, biomeAt(x, y), 1.1 + random() * 0.6, i % 5);
  }
  return canvas;
}

export function createWorldEngine({
  getState = () => ({}),
  getAgents = () => ({}),
  getOuting = () => null,
  onSelect = () => {},
  onScene = () => {},
} = {}) {
  let settings = getState() || {},
    world = generateWorld(settings.seed || 'pip-wilds'),
    terrain = null;
  let canvas = null,
    ctx = null,
    resize = null,
    raf = 0,
    lastTime = 0,
    elapsed = 0,
    frames = 0,
    painted = 0,
    visibleCount = 0,
    paused = false,
    dead = false;
  let width = 800,
    height = 540,
    ratio = 1,
    cleanup = [],
    followOverride = null,
    lastFollow = settings.follow || 'milo',
    lastZoom = Number(settings.zoom) || 0.75;
  const camera = {
    x: CAMP.x,
    y: CAMP.y - 70,
    zoom: clamp(lastZoom, MIN_ZOOM, 1.8),
    targetZoom: clamp(lastZoom, MIN_ZOOM, 1.8),
  };
  const companions = {
    milo: {
      id: 'milo',
      x: CAMP.x - 37,
      y: CAMP.y + 94,
      target: null,
      path: [],
      walking: false,
      facing: 1,
      stop: 0,
      stride: 0,
    },
    nova: {
      id: 'nova',
      x: CAMP.x + 51,
      y: CAMP.y + 127,
      target: null,
      path: [],
      walking: false,
      facing: -1,
      stop: 0,
      stride: 2,
    },
  };
  let outingID = '',
    outingStatus = '',
    waypoint = 0,
    manualTarget = null,
    navigation = null,
    touring = false,
    selected = null,
    hover = null;
  const resourceSpots = new Map(),
    particles = [],
    pings = [],
    keys = new Set(),
    pointers = new Map(),
    assetCache = new Map();
  let pointerStart = null,
    pinchDistance = 0,
    pointerMoved = false,
    minimap = null;
  let sceneSignature = '';
  const spatial = new Map();
  function buildIndex() {
    spatial.clear();
    for (const a of world.assets) {
      const key = Math.floor(a.x / 320) + ',' + Math.floor(a.y / 320);
      if (!spatial.has(key)) spatial.set(key, []);
      spatial.get(key).push(a);
    }
  }
  buildIndex();
  const reduced = () =>
    settings.motion === 'reduced' ||
    !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const stateAgents = () => getAgents() || {};
  const site = (id) =>
    world.landmarks.find((l) => l.id === id) || world.landmarks[0];
  const running = (o) => o && ['queued', 'running'].includes(o.status);
  const safeAgents = () => {
    const a = stateAgents();
    return {
      milo: a.milo || { name: 'Milo', pet: 'fox' },
      nova: a.nova || { name: 'Nova', pet: 'bunny' },
    };
  };
  function bounds() {
    const hw = width / camera.zoom / 2,
      hh = height / camera.zoom / 2;
    camera.x =
      hw > WIDTH / 2 ? WIDTH / 2 : clamp(camera.x, hw - 50, WIDTH - hw + 50);
    camera.y =
      hh > HEIGHT / 2 ? HEIGHT / 2 : clamp(camera.y, hh - 50, HEIGHT - hh + 50);
  }
  function toWorld(x, y) {
    return {
      x: (x - width / 2) / camera.zoom + camera.x,
      y: (y - height / 2) / camera.zoom + camera.y,
    };
  }
  function coordinates(e) {
    const box = canvas.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }
  function burst(x, y, color = '#f5d49b', count = 12) {
    if (reduced()) return;
    const random = rngFrom(elapsed + ':' + x);
    for (let i = 0; i < count; i++) {
      const a = random() * TAU,
        speed = 20 + random() * 55;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 30,
        life: 0.8 + random() * 0.5,
        max: 1.3,
        color,
        kind: i % 2 ? 'star' : 'dot',
      });
    }
    if (particles.length > 140) particles.splice(0, particles.length - 140);
  }
  function pathBetween(from, to) {
    const nearest = world.landmarks.reduce((a, b) =>
        dist(from, a) < dist(from, b) ? a : b,
      ),
      target = typeof to === 'string' ? site(to) : to;
    if (!target?.id || nearest.id === target.id)
      return [{ x: target.x, y: target.y + 66 }];
    const queue = [[nearest.id]],
      seen = new Set([nearest.id]);
    while (queue.length) {
      const ids = queue.shift(),
        current = site(ids.at(-1));
      if (current.id === target.id)
        return ids.map((id) => ({ x: site(id).x, y: site(id).y + 66 }));
      for (const r of world.roads) {
        let next = null;
        if (dist(current, r.a) < 1)
          next = world.landmarks.find((l) => dist(l, r.b) < 1);
        else if (dist(current, r.b) < 1)
          next = world.landmarks.find((l) => dist(l, r.a) < 1);
        if (next && !seen.has(next.id)) {
          seen.add(next.id);
          queue.push([...ids, next.id]);
        }
      }
    }
    return [{ x: target.x, y: target.y + 66 }];
  }
  function setPath(p, target) {
    p.path = pathBetween(p, target);
    p.target = p.path.shift() || null;
  }
  function directory() {
    return [...world.landmarks, ...world.npcs, ...world.enemies].map(item => ({
      id: item.id, title: item.title, type: item.type, kind: item.kind,
      biome: item.biome || biomeAt(item.x, item.y), x: item.x, y: item.y,
      description: item.description, topic: item.topic, site: item.site,
    }));
  }
  function walkTo(payload = {}) {
    const target = payload.id ? directory().find(item => item.id === payload.id) : null;
    const point = target || (Number.isFinite(Number(payload.x)) && Number.isFinite(Number(payload.y))
      ? { x: clamp(Number(payload.x), 100, WIDTH - 100), y: clamp(Number(payload.y), 100, HEIGHT - 100), title: 'Your chosen spot', id: 'chosen-spot' } : null);
    if (!point || (!target && waterAt(point.x, point.y))) return false;
    const actor = ['milo', 'nova'].includes(payload.agent) ? payload.agent : getOuting()?.agent === 'nova' || (!getOuting() && settings.agent === 'nova') ? 'nova' : 'milo';
    const p = companions[actor];
    const anchor = target?.type === 'landmark' ? site(target.id) : target?.site ? site(target.site)
      : world.landmarks.reduce((a, b) => dist(point, a) < dist(point, b) ? a : b);
    p.path = dist(p, point) > 240 ? pathBetween(p, anchor) : [];
    p.path.push({ x: point.x, y: point.y + (target ? 66 : 0) });
    p.target = p.path.shift(); p.stop = 0;
    navigation = { targetId: point.id, title: point.title, actor, arrived: false };
    manualTarget = null; touring = false; followOverride = actor;
    pings.push({ x: point.x, y: point.y + (target ? 66 : 0), life: 1 });
    return true;
  }
  function advance(p, dt, speed, still) {
    if (!p.target || p.stop > elapsed || still) {
      p.walking = false;
      return;
    }
    const d = dist(p, p.target);
    if (d < 7) {
      p.target = p.path.shift() || null;
      if (!p.target) p.stop = elapsed + 3.5;
      p.walking = false;
      return;
    }
    const step = Math.min(d, speed * dt);
    const dx = (p.target.x - p.x) / d,
      dy = (p.target.y - p.y) / d;
    p.x += dx * step;
    p.y += dy * step;
    if (Math.abs(dx) > 0.1) p.facing = dx > 0 ? 1 : -1;
    p.walking = true;
    p.stride += step / 13;
    const trail = safeAgents()[p.id]?.trail;
    if (frames % 13 === 0 && !reduced() && trail !== 'none') {
      particles.push({
        x: p.x,
        y: p.y + 2,
        vx: -dx * 9,
        vy: -dy * 9,
        life: 0.65,
        max: 0.65,
        color: trail === 'hearts' ? '#e8a6b7' : trail === 'stardust' ? '#f6df9b' : '#b59c7e',
        kind: trail === 'hearts' ? 'heart' : trail === 'stardust' ? 'star' : trail === 'paws' ? 'paw' : 'dot',
      });
      if (particles.length > 140) particles.shift();
    }
  }
  function update(dt) {
    settings = getState() || {};
    if (String(settings.seed || 'pip-wilds') !== world.seed)
      regenerate(settings.seed || 'pip-wilds');
    if (settings.follow && settings.follow !== lastFollow) {
      lastFollow = settings.follow;
      followOverride = null;
    }
    const z = Number(settings.zoom);
    if (Number.isFinite(z) && z > 0 && z !== lastZoom) {
      lastZoom = z;
      camera.targetZoom = clamp(z, MIN_ZOOM, 1.8);
    }
    const o = getOuting(),
      agents = safeAgents(),
      active = running(o);
    if ((o?.id || '') !== outingID) {
      outingID = o?.id || '';
      outingStatus = '';
      waypoint = 0;
      manualTarget = null;
      navigation = null;
      resourceSpots.clear();
      for (const p of Object.values(companions)) {
        p.target = null;
        p.path = [];
        p.stop = 0;
      }
    }
    if ((o?.status || '') !== outingStatus) {
      outingStatus = o?.status || '';
      if (o && !active) {
        setPath(companions.milo, 'camp');
        setPath(companions.nova, 'camp');
        manualTarget = null;
        navigation = null;
        touring = false;
      }
    }
    const leadID = navigation?.actor || (o?.agent === 'nova' ? 'nova' : 'milo'),
      followerID = leadID === 'milo' ? 'nova' : 'milo',
      lead = companions[leadID],
      follower = companions[followerID];
    const observing = active && (o?.kind === 'teach' || !!o?.student),
      phase = o?.phase || '';
    // Model phases affect expression, never estimated progress. Brief scenic stops keep the walk legible.
    const discussing = active && /question|reply|practice|feedback|reflection/.test(phase);
    if (manualTarget && !lead.target) {
      lead.target = manualTarget;
      lead.path = [];
      manualTarget = null;
    }
    if (
      (active || touring) &&
      !navigation &&
      !lead.target &&
      lead.stop <= elapsed &&
      !discussing
    ) {
      const route = touring
        ? [
            'flower-class',
            'pond',
            'library',
            'lighthouse',
            'harbor',
            'workshop',
            'forge',
            'camp',
          ]
        : routeForOuting(o);
      setPath(lead, route[waypoint++ % route.length]);
    }
    if (!active && !touring && !navigation && !lead.target && lead.stop <= elapsed) {
      const a = Math.sin(elapsed * 0.09 + (hash(world.seed) % 8)) * TAU;
      lead.target = {
        x: CAMP.x + Math.cos(a) * 100,
        y: CAMP.y + 90 + Math.sin(a) * 65,
      };
      lead.stop = elapsed + 1;
    }
    const speed =
      agents[leadID]?.personality === 'bouncy'
        ? 104
        : agents[leadID]?.personality === 'calm'
          ? 69
          : 87;
    advance(lead, dt, speed, discussing || paused);
    if (navigation && !lead.target && !lead.path.length && !navigation.arrived) {
      navigation.arrived = true;
      burst(lead.x, lead.y - 55, '#e8d59c', 10);
    }
    const following = observing || touring || active || !!navigation;
    if (following && dist(lead, follower) > 100) {
      follower.target = { x: lead.x - lead.facing * 66, y: lead.y + 37 };
      follower.stop = 0;
    } else if (
      !following &&
      !active &&
      !follower.target &&
      follower.stop <= elapsed
    ) {
      follower.target = {
        x: CAMP.x + 60 + Math.sin(elapsed * 0.13) * 96,
        y: CAMP.y + 100 + Math.cos(elapsed * 0.11) * 50,
      };
      follower.stop = elapsed + 2;
    }
    advance(follower, dt, speed * 1.08, discussing || paused);
    if (!paused && dist(lead, follower) < 75) {
      const separation = dist(lead, follower) || 1,
        push = Math.min(75 - separation, dt * 55);
      follower.x += ((follower.x - lead.x || 1) / separation) * push;
      follower.y += ((follower.y - lead.y) / separation) * push;
    }
    for (const r of (o?.resources || []).slice(0, 36)) {
      const key = r.id || r.kind + ':' + (r.path || r.url || r.title);
      if (!resourceSpots.has(key)) {
        const n = resourceSpots.size,
          a = n * 2.399,
          radius = 165 + Math.floor(n / 10) * 34;
        resourceSpots.set(key, {
          id: key,
          type: 'resource',
          title: String(r.title || r.path || r.kind || 'Resource'),
          resource: r,
          x: CAMP.x + Math.cos(a) * radius,
          y: CAMP.y + 96 + Math.sin(a) * radius * 0.4,
          born: elapsed,
        });
      }
    }
    const follow = followOverride || settings.follow || 'milo';
    if (keys.size) {
      followOverride = 'free';
      const speed = (450 / camera.zoom) * dt;
      if (keys.has('arrowleft') || keys.has('a')) camera.x -= speed;
      if (keys.has('arrowright') || keys.has('d')) camera.x += speed;
      if (keys.has('arrowup') || keys.has('w')) camera.y -= speed;
      if (keys.has('arrowdown') || keys.has('s')) camera.y += speed;
    } else if (companions[follow] && pointers.size === 0) {
      const p = companions[follow],
        easing = reduced() ? 1 : 1 - Math.exp(-dt * 4);
      camera.x = lerp(camera.x, p.x, easing);
      camera.y = lerp(camera.y, p.y - 70, easing);
    }
    camera.zoom = lerp(
      camera.zoom,
      camera.targetZoom,
      reduced() ? 1 : 1 - Math.exp(-dt * 10),
    );
    bounds();
    const nextScene = [biomeAt(camera.x, camera.y), followOverride || settings.follow || 'milo', navigation?.targetId || '', !!navigation?.arrived, paused].join('|');
    if (nextScene !== sceneSignature) { sceneSignature = nextScene; onScene(); }
    if (!paused)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += dt * 12;
        if (p.life <= 0) particles.splice(i, 1);
      }
    if (!paused)
      for (let i = pings.length - 1; i >= 0; i--) {
        pings[i].life -= dt;
        if (pings[i].life <= 0) pings.splice(i, 1);
      }
  }

  function cachedAsset(o) {
    const key = o.kind + ':' + o.biome + ':' + o.variant;
    if (!assetCache.has(key)) {
      const c = document.createElement('canvas');
      c.width = o.kind === 'tree' ? 200 : 100;
      c.height = o.kind === 'tree' ? 235 : 100;
      const a = c.getContext('2d'),
        x = c.width / 2,
        y = c.height - 25;
      if (o.kind === 'tree') drawTree(a, x, y, o.biome, 1, o.variant);
      else drawSmall(a, { ...o, x, y, scale: 1 });
      assetCache.set(key, c);
    }
    return assetCache.get(key);
  }
  function visibleAssets(view) {
    const result = [];
    for (
      let x = Math.floor(view.left / 320);
      x <= Math.floor(view.right / 320);
      x++
    )
      for (
        let y = Math.floor(view.top / 320);
        y <= Math.floor(view.bottom / 320);
        y++
      )
        for (const o of spatial.get(x + ',' + y) || [])
          if (
            o.x >= view.left &&
            o.x <= view.right &&
            o.y >= view.top &&
            o.y <= view.bottom
          ) {
            if (settings.density === 'balanced' && o.kind === 'grass') continue;
            if (
              camera.zoom < 0.23 &&
              !['tree', 'rock', 'bush'].includes(o.kind)
            )
              continue;
            result.push(o);
          }
    return result;
  }
  function badge(title, x, y, color = '#fdf8e9', ink = '#40534b', size = 12) {
    ctx.font = '700 ' + size + 'px ui-rounded, system-ui, sans-serif';
    const w = Math.min(280, ctx.measureText(title).width + 20);
    round(ctx, x - w / 2, y - 11, w, 22, 9);
    ctx.fillStyle = color;
    ctx.fill();
    text(ctx, title, x, y + 1, size, ink);
  }
  function drawCompanion(p, agent, o, motion) {
    const time = elapsed,
      active = running(o),
      working =
        active &&
        (o?.speakingAgent ? o.speakingAgent === p.id : o?.agent === p.id),
      factor = p.id === 'milo' ? 2.65 : 2.42;
    const emote = p.emote && p.emote.until > time ? p.emote.kind : '';
    const bob = motion
      ? p.walking
        ? Math.abs(Math.sin(p.stride)) * 5
        : emote === 'jump' ? Math.abs(Math.sin(time * 5)) * 19 : Math.sin(time * 2.3 + p.stride) * 1.4
      : 0;
    const blink = motion && (time + (p.id === 'milo' ? 0 : 2.3)) % 5.7 < 0.13;
    const happy = emote || agent.mood === 'happy',
      sad = agent.mood === 'stressed' || o?.status === 'failed';
    const animal =
      ANIMALS.find(
        (a) =>
          a.id === (typeof agent.pet === 'string' ? agent.pet : agent.pet?.id),
      ) || ANIMALS[p.id === 'milo' ? 0 : 2];
    const speaking = active && o?.speakingAgent === p.id;
    const pose = {
      eyes: emote === 'snooze' ? 'sleep' : blink
        ? 'blink'
        : sad
          ? 'sad'
          : happy
            ? 'happy'
            : working
              ? 'wide'
              : 'normal',
      mouth:
        speaking && Math.floor(time * 5) % 2 ? 'open' : sad ? 'small' : 'smile',
      look: p.facing > 0 ? 1 : -1,
      tail: motion && Math.floor(time * (p.walking ? 5 : 2)) % 2,
      ear: motion && Math.floor(time * 1.7) % 2,
      arms: (emote === 'wave' ? !motion || Math.floor(time * 4) % 2 : !!emote) || speaking,
    };
    const sprite = getSprite(
      animal,
      pose,
      typeof agent.outfit === 'string'
        ? agent.outfit
        : agent.outfit?.accessory || 'none',
    );
    oval(ctx, p.x, p.y + 2, 32, 10, '#36574d35');
    if (agent.aura && agent.aura !== 'none')
      for (let i = 0; i < 5; i++) {
        const a = time * 0.7 + (i / 5) * TAU,
          ax = p.x + Math.cos(a) * 45,
          ay = p.y - 55 + Math.sin(a) * 25;
        if (agent.aura === 'leaves') oval(ctx, ax, ay, 5, 2, '#e7ebbd');
        else
          star(
            ctx,
            ax,
            ay,
            agent.aura === 'stars' ? 6 : 3,
            agent.accent || '#ffe7ab',
          );
      }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite,
      Math.round(p.x - 18 * factor),
      Math.round(p.y - 46 * factor - bob),
      36 * factor,
      48 * factor,
    );
    ctx.restore();
    const accent = /^#[\da-f]{6}$/i.test(agent.accent || '')
      ? agent.accent
      : p.id === 'milo'
        ? '#f3ca93'
        : '#d5c4eb';
    badge(
      String(agent.name || p.id).slice(0, 32),
      p.x,
      p.y + 26,
      accent,
      '#354b45',
      Math.min(17, Math.max(12, 12 / camera.zoom)),
    );
    if (working) {
      const sx = p.x + 37,
        sy = p.y - 83;
      for (let i = 0; i < 3; i++)
        oval(
          ctx,
          sx + i * 8,
          sy + (motion ? Math.sin(time * 5 - i) * 3 : 0),
          2.5,
          2.5,
          '#fdf3d5',
        );
      if (/refin|review|revis/.test(o.phase || '')) {
        ctx.save();
        ctx.translate(p.x + 27, p.y - 115);
        ctx.rotate(time * 0.5);
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#fff0bb';
          ctx.fillRect(-2, -12, 4, 6);
        }
        ctx.restore();
      }
    }
    if (working && /practice|feedback/.test(o.phase || '') && camera.zoom > 0.4) {
      badge(/feedback/.test(o.phase) ? 'Giving feedback' : 'Trying the skill', p.x, p.y - 137, '#fff3c9e8', '#667452', 11);
    }
    if (emote) {
      const ey = p.y - 132 - (motion ? Math.sin(time * 4) * 4 : 0);
      if (emote === 'snooze') { text(ctx, 'z z', p.x + 18, ey, 17, '#b6b9dc'); }
      else if (/love|pet|heart|care/.test(emote)) {
        ctx.save();
        ctx.translate(p.x, ey);
        ctx.fillStyle = '#e9a8b6';
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.bezierCurveTo(-27, -7, -10, -22, 0, -10);
        ctx.bezierCurveTo(10, -22, 27, -7, 0, 8);
        ctx.fill();
        ctx.restore();
      } else {
        star(ctx, p.x - 19, ey, 9, '#ffe4a4');
        star(ctx, p.x + 19, ey - 8, 6, '#fff0c9');
      }
    }
    const dialogue = Array.isArray(o?.dialogue) ? o.dialogue.at(-1) : null;
    if (speaking && dialogue && camera.zoom > 0.42) {
      const who = dialogue.actor || dialogue.agent || dialogue.speaker;
      if (!who || who === p.id) {
        const words = String(dialogue.text || dialogue.content || '')
          .replace(/\s+/g, ' ')
          .slice(0, 58);
        if (words)
          badge(
            words +
              (String(dialogue.text || dialogue.content || '').length > 58
                ? '…'
                : ''),
            p.x,
            p.y - 153,
            '#fff9e8ed',
            '#526052',
            12,
          );
      }
    }
  }
  function drawNPC(n, o, motion) {
    const x = n.x + (motion ? Math.sin(elapsed * 0.3 + n.phase) * 14 : 0),
      y = n.y + (motion ? Math.cos(elapsed * 0.25 + n.phase) * 8 : 0),
      animal = ANIMALS.find((a) => a.id === n.pet) || ANIMALS[0];
    const relevant =
      running(o) &&
      ((n.id === 'builder' && o.kind === 'code') ||
        (n.id === 'archivist' && o.kind === 'research') ||
        (n.id === 'observer' && o.kind === 'teach') ||
        (n.id === 'reviewer' && /review|refin/.test(o.phase || '')));
    oval(ctx, x, y + 2, 24, 8, '#405c4d2a');
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      getSprite(
        animal,
        {
          eyes:
            motion && (elapsed + n.phase) % 7 < 0.13
              ? 'blink'
              : relevant
                ? 'wide'
                : 'happy',
          mouth: 'smile',
          tail: motion ? Math.floor(elapsed + n.phase) % 2 : 0,
        },
        n.outfit,
      ),
      x - 36,
      y - 93,
      72,
      96,
    );
    ctx.restore();
    if (camera.zoom > 0.38)
      badge(
        n.title,
        x,
        y + 21,
        relevant ? '#f6e3b0' : '#f9f3e3dd',
        '#5c6252',
        11,
      );
    if (relevant)
      star(
        ctx,
        x + 29,
        y - 82 + (motion ? Math.sin(elapsed * 2) * 4 : 0),
        8,
        '#ffe5a6',
      );
    n.drawX = x;
    n.drawY = y;
  }
  function drawEnemy(e, motion) {
    const x = e.x + (motion ? Math.sin(elapsed * 0.5 + e.phase) * 25 : 0),
      y = e.y + (motion ? Math.cos(elapsed * 0.7 + e.phase) * 9 : 0),
      squish = motion ? Math.sin(elapsed * 2.4 + e.phase) * 3 : 0;
    oval(ctx, x, y + 3, 28, 9, '#54635a26');
    oval(
      ctx,
      x,
      y - 20,
      30 + squish,
      26 - squish,
      e.id === 'confusion'
        ? '#bbaccb'
        : e.id === 'assumption'
          ? '#c6c4d5'
          : e.id === 'tangle'
            ? '#a0bc9b'
            : '#a6c9ce',
    );
    if (e.friendlyUntil > elapsed) {
      line(ctx, [[x - 14, y - 24], [x - 10, y - 28], [x - 6, y - 24]], '#657560', 2);
      line(ctx, [[x + 6, y - 24], [x + 10, y - 28], [x + 14, y - 24]], '#657560', 2);
      star(ctx, x + 32, y - 45, 7, '#f4d7a0');
    } else {
      oval(ctx, x - 10, y - 26, 3, 4, '#5f6570');
      oval(ctx, x + 10, y - 26, 3, 4, '#5f6570');
    }
    line(
      ctx,
      [
        [x - 4, y - 14],
        [x + 4, y - 14],
      ],
      '#7d7b85',
      2,
    );
    oval(ctx, x - 18, y - 16, 4, 2, '#ecc6c6');
    oval(ctx, x + 18, y - 16, 4, 2, '#ecc6c6');
    if (camera.zoom > 0.4)
      badge(e.title, x, y + 24, '#f2e8e5df', '#6c6571', 11);
    text(ctx, '?', x + 15, y - 61, 17, '#f8ecca');
    e.drawX = x;
    e.drawY = y;
  }
  function drawResource(r, motion) {
    const age = elapsed - r.born,
      bob = motion ? Math.sin(elapsed * 2 + r.x) * 3 : 0,
      y = r.y - bob;
    oval(ctx, r.x, r.y + 4, 18, 6, '#465b4a20');
    if (age < 2) oval(ctx, r.x, y - 13, 28, 26, '#fff1b13b');
    round(ctx, r.x - 15, y - 35, 30, 34, 6);
    ctx.fillStyle =
      r.resource.kind === 'file'
        ? '#f3d8a7'
        : r.resource.kind === 'source'
          ? '#c3d7d1'
          : '#d6c5e7';
    ctx.fill();
    line(
      ctx,
      [
        [r.x - 8, y - 24],
        [r.x + 7, y - 24],
      ],
      '#7b8c807e',
      2,
    );
    line(
      ctx,
      [
        [r.x - 8, y - 17],
        [r.x + 4, y - 17],
      ],
      '#7b8c807e',
      2,
    );
    star(ctx, r.x + 14, y - 35, 5, '#fff1be');
  }
  function drawWorld() {
    if (!ctx || !canvas || !width || !height) return;
    if (!terrain) terrain = makeTerrain(world);
    const motion = !reduced() && !paused,
      t = reduced() ? 0 : elapsed,
      o = getOuting(),
      agents = safeAgents();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#c2cfb0';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrain, 0, 0, WIDTH, HEIGHT);
    const view = {
      left: camera.x - width / camera.zoom / 2 - 220,
      right: camera.x + width / camera.zoom / 2 + 220,
      top: camera.y - height / camera.zoom / 2 - 220,
      bottom: camera.y + height / camera.zoom / 2 + 270,
    };
    const within = (p) =>
      p.x > view.left &&
      p.x < view.right &&
      p.y > view.top &&
      p.y < view.bottom;
    for (let i = 0; i < 45; i++) {
      const wy = camera.y - height / camera.zoom / 2 + i * 45,
        wx = riverX(wy);
      if (within({ x: wx, y: wy })) {
        const rx = wx + Math.sin(i * 2 + t * 0.5) * 27;
        line(
          ctx,
          [
            [rx - 15, wy],
            [rx + 13, wy],
          ],
          '#d4e9dc55',
          2,
        );
      }
    }
    if (navigation) {
      const walker = companions[navigation.actor];
      const points = [[walker.x, walker.y], ...(walker.target ? [[walker.target.x,walker.target.y]] : []), ...walker.path.map(p=>[p.x,p.y])];
      ctx.save(); ctx.setLineDash([7, 10]); line(ctx, points, '#fff4c6a3', 3 / Math.max(camera.zoom,0.3)); ctx.restore();
    }
    const drawables = visibleAssets(view).map((o) => ({
      ...o,
      layer: 'asset',
    }));
    for (const l of world.landmarks)
      if (within(l)) drawables.push({ ...l, layer: 'landmark' });
    for (const n of world.npcs)
      if (within(n)) drawables.push({ ...n, layer: 'npc', original: n });
    for (const e of world.enemies)
      if (within(e)) drawables.push({ ...e, layer: 'enemy', original: e });
    for (const r of resourceSpots.values())
      if (within(r)) drawables.push({ ...r, layer: 'resource' });
    for (const p of Object.values(companions))
      if (within(p)) drawables.push({ ...p, layer: 'pet', original: p });
    drawables.sort((a, b) => a.y - b.y);
    visibleCount = drawables.length;
    for (const item of drawables) {
      if (item.layer === 'asset') {
        const sprite = cachedAsset(item),
          sway =
            motion && item.kind === 'tree'
              ? Math.sin(t * 0.8 + item.phase) * 1.3
              : 0;
        const occludesPet =
          item.kind === 'tree' &&
          Object.values(companions).some(
            (p) =>
              Math.abs(p.x - item.x) < 66 * item.scale &&
              p.y < item.y + 5 &&
              p.y > item.y - 145 * item.scale,
          );
        if (occludesPet) ctx.globalAlpha = 0.32;
        ctx.drawImage(
          sprite,
          item.x - (sprite.width / 2) * item.scale + sway,
          item.y - (sprite.height - 25) * item.scale,
          sprite.width * item.scale,
          sprite.height * item.scale,
        );
        ctx.globalAlpha = 1;
      } else if (item.layer === 'landmark') drawLandmark(ctx, item, t, motion);
      else if (item.layer === 'pet')
        drawCompanion(item.original, agents[item.id], o, motion);
      else if (item.layer === 'npc') drawNPC(item.original, o, motion);
      else if (item.layer === 'enemy') drawEnemy(item.original, motion);
      else drawResource(item, motion);
    }
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'star') star(ctx, p.x, p.y, 4, p.color);
      else if (p.kind === 'heart') { ctx.save();ctx.translate(p.x,p.y);ctx.scale(.3,.3);ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(0,8);ctx.bezierCurveTo(-22,-5,-9,-20,0,-9);ctx.bezierCurveTo(9,-20,22,-5,0,8);ctx.fill();ctx.restore(); }
      else if (p.kind === 'paw') { oval(ctx,p.x,p.y,3.5,2.5,p.color);oval(ctx,p.x-3,p.y-4,1.5,1.5,p.color);oval(ctx,p.x+1,p.y-5,1.5,1.5,p.color);oval(ctx,p.x+4,p.y-3,1.5,1.5,p.color); }
      else oval(ctx, p.x, p.y, 3, 2, p.color);
    }
    ctx.globalAlpha = 1;
    for (const p of pings) {
      ctx.strokeStyle = '#fff4ca';
      ctx.lineWidth = 2 / camera.zoom;
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y,
        (1 - p.life) * 50 + 10,
        (1 - p.life) * 25 + 6,
        0,
        0,
        TAU,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (motion)
      for (let i = 0; i < 17; i++) {
        const a = t * (0.13 + (i % 3) * 0.04) + i * 7,
          bx = camera.x + Math.sin(a + i) * 700,
          by = camera.y + Math.cos(a * 0.8 + i) * 400,
          flap = Math.sin(t * 10 + i) * 4;
        oval(
          ctx,
          bx - 4,
          by,
          4,
          Math.max(1, 3 + flap),
          i % 3 ? '#f0d9a680' : '#d8bee580',
        );
        oval(
          ctx,
          bx + 4,
          by,
          4,
          Math.max(1, 3 + flap),
          i % 3 ? '#f0d9a680' : '#d8bee580',
        );
      }
    const focus = hover || selected;
    if (focus && focus.x != null) {
      const fx = focus.drawX ?? focus.x,
        fy = focus.drawY ?? focus.y;
      ctx.strokeStyle = '#fff4ce';
      ctx.lineWidth = 2.5 / camera.zoom;
      ctx.beginPath();
      ctx.ellipse(fx, fy + 10, 43, 17, 0, 0, TAU);
      ctx.stroke();
    }
    if (camera.zoom < 0.35)
      for (const r of world.regions) {
        const size = 18 / camera.zoom;
        text(ctx, r.title, r.x, r.y - 200, size, '#3c514cc9', 800);
      }
    ctx.restore();
    drawAtmosphere(motion);
    drawHUD(o);
    painted++;
  }
  function drawAtmosphere(motion) {
    const hour = new Date().getHours(),
      time =
        settings.time === 'auto'
          ? hour < 6 || hour >= 20
            ? 'night'
            : hour >= 17
              ? 'sunset'
              : 'day'
          : settings.time || 'day';
    if (time === 'night') {
      ctx.fillStyle = '#1c2f544f';
      ctx.fillRect(0, 0, width, height);
      const lights = [
        ...Object.values(companions),
        ...world.landmarks.filter((l) =>
          ['camp', 'lighthouse', 'forge', 'library'].includes(l.id),
        ),
      ];
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const l of lights) {
        const x = (l.x - camera.x) * camera.zoom + width / 2,
          y = (l.y - camera.y - 45) * camera.zoom + height / 2;
        const radius = 95 * camera.zoom;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, '#f5d4904a');
        gradient.addColorStop(1, '#f5d49000');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      ctx.restore();
    } else if (time === 'sunset') {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, '#edbc8c22');
      g.addColorStop(1, '#b695b02a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    const weather = settings.weather || 'clear',
      count = Math.min(90, Math.floor(width / 9)),
      t = motion ? elapsed : 0;
    if (weather === 'rain') {
      ctx.fillStyle = '#748d9a15';
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < count; i++) {
        const x =
            ((((i * 137.7 - t * 95) % (width + 100)) + width + 100) %
              (width + 100)) -
            40,
          y = ((i * 79.9 + t * 390) % (height + 100)) - 50;
        line(
          ctx,
          [
            [x, y],
            [x - 6, y + 18],
          ],
          '#eef6ed65',
          1,
        );
      }
    } else if (weather === 'snow')
      for (let i = 0; i < count; i++) {
        const x =
            (((i * 117.8 + Math.sin(t * 0.7 + i) * 30) % width) + width) %
            width,
          y = ((i * 93.7 + t * (17 + (i % 4) * 6)) % (height + 20)) - 10;
        oval(ctx, x, y, 1.5 + (i % 3) * 0.6, 1.5 + (i % 3) * 0.6, '#fffbedbc');
      }
    else if (weather === 'fireflies' || time === 'night')
      for (let i = 0; i < Math.min(30, width / 20); i++) {
        const x =
            (((i * 117.9 + Math.sin(t * 0.25 + i) * 42) % width) + width) %
            width,
          y =
            (((i * 79.3 + Math.cos(t * 0.3 + i) * 27) % height) + height) %
            height,
          alpha = motion ? 0.4 + Math.sin(t * 1.7 + i) * 0.3 : 0.6;
        ctx.globalAlpha = alpha;
        oval(ctx, x, y, 3, 3, '#f7e7a0');
        oval(ctx, x, y, 8, 8, '#f7e7a01a');
      }
    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.67,
    );
    vignette.addColorStop(0, '#304b3b00');
    vignette.addColorStop(1, '#304b3b22');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
  function drawHUD(o) {
    const region = WORLD_BIOMES[biomeAt(camera.x, camera.y)],
      small = width < 550;
    if (!settings.overlayHUD) {
      ctx.save();
      round(ctx, 14, 14, small ? 191 : 236, 47, 12);
      ctx.fillStyle = '#fffae9dc';
      ctx.fill();
      ctx.font =
        '800 ' + (small ? 12 : 14) + 'px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#42554a';
      ctx.fillText(region.symbol + ' ' + region.title, 26, 34);
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillStyle = '#67755e';
      ctx.fillText(
        paused
          ? 'Scenery paused · model work continues'
          : running(o)
            ? 'Adventure illustrates the live task'
            : touring
              ? 'Scenic tour · no model calls'
              : 'Companions roaming · scenic idle',
        26,
        49,
      );
      ctx.restore();
    }
    if (settings.overlayHUD && width <= 760) {
      minimap = null;
      return;
    }
    const mw = small ? 112 : 152,
      mh = (mw * HEIGHT) / WIDTH,
      mx = width - mw - 14,
      my = height - mh - (settings.overlayHUD ? 145 : 14);
    minimap = { x: mx, y: my, w: mw, h: mh };
    ctx.save();
    round(ctx, mx - 4, my - 4, mw + 8, mh + 8, 10);
    ctx.fillStyle = '#fff9e9e8';
    ctx.fill();
    ctx.save();
    round(ctx, mx, my, mw, mh, 7);
    ctx.clip();
    ctx.drawImage(terrain, mx, my, mw, mh);
    for (const l of world.landmarks)
      oval(
        ctx,
        mx + (l.x / WIDTH) * mw,
        my + (l.y / HEIGHT) * mh,
        1.6,
        1.6,
        '#586f62',
      );
    for (const p of Object.values(companions))
      oval(
        ctx,
        mx + (p.x / WIDTH) * mw,
        my + (p.y / HEIGHT) * mh,
        3.5,
        3.5,
        p.id === 'milo' ? '#b25e3e' : '#775aaf',
      );
    const vw = (width / camera.zoom / WIDTH) * mw,
      vh = (height / camera.zoom / HEIGHT) * mh;
    ctx.strokeStyle = '#fffbed';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      mx + (camera.x / WIDTH) * mw - vw / 2,
      my + (camera.y / HEIGHT) * mh - vh / 2,
      vw,
      vh,
    );
    ctx.restore();
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = '#435c4ac9';
    ctx.fillText(Math.round(camera.zoom * 100) + '%', 17, height - 17);
    ctx.restore();
  }

  function hit(point) {
    const near = [];
    for (const p of Object.values(companions))
      if (
        Math.abs(point.x - p.x) < 39 &&
        point.y > p.y - 125 &&
        point.y < p.y + 26
      ) {
        const agent = safeAgents()[p.id];
        near.push({
          ...p,
          type: 'pet',
          actor: p.id,
          title: agent.name || p.id,
          topic:
            p.id === (getOuting()?.agent || 'milo')
              ? 'Lead companion'
              : 'Companion',
          description:
            'This companion’s appearance belongs to the pet. Its equipped model chip powers the actual work.',
          radius: 45,
        });
      }
    for (const r of resourceSpots.values())
      if (dist(point, { x: r.x, y: r.y - 16 }) < 28)
        near.push({ ...r, radius: 20 });
    for (const n of [...world.npcs, ...world.enemies])
      if (
        Math.abs(point.x - (n.drawX ?? n.x)) < 37 &&
        point.y > (n.drawY ?? n.y) - (n.type === 'npc' ? 96 : 54) &&
        point.y < (n.drawY ?? n.y) + 22
      )
        near.push({ ...n, radius: 45 });
    for (const l of world.landmarks)
      if (
        Math.abs(point.x - l.x) < l.radius &&
        point.y > l.y - 160 &&
        point.y < l.y + 42
      )
        near.push(l);
    return (
      near.sort(
        (a, b) =>
          (a.type === 'resource' ? -100 : 0) -
          (b.type === 'resource' ? -100 : 0) +
          dist(point, a) -
          dist(point, b),
      )[0] || null
    );
  }
  function inspect(target) {
    selected = target;
    if (!target) return;
    onSelect({
      type: target.type,
      id: target.id,
      title: target.title,
      description:
        target.description ||
        (target.type === 'resource'
          ? 'Actual returned ' +
            target.resource?.kind +
            '. Open the live journal or resource collection to inspect this material.'
          : ''),
      actor: target.actor,
      topic: target.topic,
      resource: target.resource,
      x: target.x,
      y: target.y,
    });
  }
  function moveCameraTo(point) {
    followOverride = 'free';
    camera.x = clamp(point.x, 0, WIDTH);
    camera.y = clamp(point.y, 0, HEIGHT);
    bounds();
  }
  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    const p = coordinates(e);
    pointers.set(e.pointerId, p);
    canvas.setPointerCapture?.(e.pointerId);
    canvas.focus({ preventScroll: true });
    if (pointers.size === 1) {
      pointerStart = {
        ...p,
        cameraX: camera.x,
        cameraY: camera.y,
        id: e.pointerId,
      };
      pointerMoved = false;
    }
    if (pointers.size === 2) {
      const points = [...pointers.values()];
      pinchDistance = dist(points[0], points[1]);
      pointerMoved = true;
    }
  }
  function onPointerMove(e) {
    const p = coordinates(e);
    if (!pointers.has(e.pointerId)) {
      hover = hit(toWorld(p.x, p.y));
      canvas.style.cursor = hover ? 'pointer' : 'grab';
      return;
    }
    pointers.set(e.pointerId, p);
    if (pointers.size > 1) {
      const points = [...pointers.values()],
        gap = dist(points[0], points[1]);
      if (pinchDistance > 0) {
        const mid = {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2,
          },
          before = toWorld(mid.x, mid.y);
        camera.targetZoom = clamp(
          (camera.targetZoom * gap) / pinchDistance,
          MIN_ZOOM,
          1.8,
        );
        camera.zoom = camera.targetZoom;
        const after = toWorld(mid.x, mid.y);
        camera.x += before.x - after.x;
        camera.y += before.y - after.y;
        followOverride = 'free';
        bounds();
      }
      pinchDistance = gap;
      return;
    }
    if (!pointerStart || pointerStart.id !== e.pointerId) return;
    const dx = p.x - pointerStart.x,
      dy = p.y - pointerStart.y;
    if (Math.hypot(dx, dy) > 5) pointerMoved = true;
    if (pointerMoved) {
      followOverride = 'free';
      camera.x = pointerStart.cameraX - dx / camera.zoom;
      camera.y = pointerStart.cameraY - dy / camera.zoom;
      bounds();
      canvas.style.cursor = 'grabbing';
    }
  }
  function onPointerUp(e) {
    const p = coordinates(e),
      wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    canvas.releasePointerCapture?.(e.pointerId);
    if (
      e.type === 'pointerup' &&
      !pointerMoved &&
      wasSingle &&
      pointerStart?.id === e.pointerId
    ) {
      if (
        minimap &&
        p.x >= minimap.x &&
        p.x <= minimap.x + minimap.w &&
        p.y >= minimap.y &&
        p.y <= minimap.y + minimap.h
      )
        moveCameraTo({
          x: ((p.x - minimap.x) / minimap.w) * WIDTH,
          y: ((p.y - minimap.y) / minimap.h) * HEIGHT,
        });
      else {
        const point = toWorld(p.x, p.y),
          target = hit(point);
        if (target) inspect(target);
        else {
          pings.push({ ...point, life: 1 });
          if (!waterAt(point.x, point.y)) walkTo(point);
          selected = null;
        }
      }
    }
    if (!pointers.size) {
      pointerStart = null;
      pinchDistance = 0;
      canvas.style.cursor = 'grab';
    } else {
      const [id, next] = [...pointers.entries()][0];
      pointerStart = { ...next, cameraX: camera.x, cameraY: camera.y, id };
    }
  }
  function onWheel(e) {
    e.preventDefault();
    const p = coordinates(e),
      point = toWorld(p.x, p.y);
    camera.targetZoom = clamp(
      camera.targetZoom * Math.exp(-e.deltaY * 0.0014),
      MIN_ZOOM,
      1.8,
    );
    camera.zoom = camera.targetZoom;
    const next = toWorld(p.x, p.y);
    camera.x += point.x - next.x;
    camera.y += point.y - next.y;
    followOverride = 'free';
    bounds();
  }
  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (
      [
        'arrowleft',
        'arrowright',
        'arrowup',
        'arrowdown',
        'w',
        'a',
        's',
        'd',
      ].includes(key)
    ) {
      e.preventDefault();
      keys.add(key);
    } else if (key === '+' || key === '=') {
      e.preventDefault();
      command('zoom', { delta: 0.15 });
    } else if (key === '-') {
      e.preventDefault();
      command('zoom', { delta: -0.15 });
    } else if (key === 'home') {
      e.preventDefault();
      command('home');
    } else if (key === 'enter') {
      e.preventDefault();
      const closest = [
        ...world.landmarks,
        ...world.npcs,
        ...world.enemies,
        ...resourceSpots.values(),
      ].reduce((a, b) => (dist(camera, a) < dist(camera, b) ? a : b));
      inspect(closest);
    } else if (key === 'escape') {
      selected = null;
      hover = null;
    }
  }
  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
  }
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      lastTime = 0;
      keys.clear();
    } else if (canvas && !dead && !raf) raf = requestAnimationFrame(frame);
  }
  function frame(time) {
    raf = 0;
    if (!canvas || dead || document.hidden || !canvas.isConnected) return;
    const delta = lastTime ? clamp((time - lastTime) / 1000, 0, 0.1) : 0;
    lastTime = time;
    if (!paused) elapsed += delta;
    frames++;
    update(delta);
    drawWorld();
    raf = requestAnimationFrame(frame);
  }
  function measure() {
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width || canvas.clientWidth || 800);
    height = Math.max(1, box.height || canvas.clientHeight || 540);
    ratio = clamp(globalThis.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    bounds();
    drawWorld();
  }
  function detach() {
    globalThis.cancelAnimationFrame?.(raf);
    raf = 0;
    lastTime = 0;
    resize?.disconnect();
    resize = null;
    for (const off of cleanup) off();
    cleanup = [];
    pointers.clear();
    keys.clear();
    pointerStart = null;
    canvas = null;
    ctx = null;
  }
  function mount(next) {
    if (canvas === next && next) {
      measure();
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
      return;
    }
    detach();
    if (!next || dead) return;
    canvas = next;
    ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      canvas = null;
      return;
    }
    canvas.tabIndex = canvas.tabIndex >= 0 ? canvas.tabIndex : 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute(
      'aria-label',
      'The Wilds interactive world. Drag to explore, pinch or use plus and minus to zoom. Arrow keys move the camera; Home returns to camp; Enter inspects the nearest world character or landmark.',
    );
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    const listen = (target, name, handler, options) => {
      target.addEventListener(name, handler, options);
      cleanup.push(() => target.removeEventListener(name, handler, options));
    };
    listen(canvas, 'pointerdown', onPointerDown);
    listen(canvas, 'pointermove', onPointerMove);
    listen(canvas, 'pointerup', onPointerUp);
    listen(canvas, 'pointercancel', onPointerUp);
    listen(canvas, 'pointerleave', () => {
      hover = null;
    });
    listen(canvas, 'wheel', onWheel, { passive: false });
    listen(canvas, 'keydown', onKeyDown);
    listen(canvas, 'keyup', onKeyUp);
    listen(canvas, 'blur', () => keys.clear());
    listen(document, 'visibilitychange', onVisibility);
    if (typeof ResizeObserver !== 'undefined') {
      resize = new ResizeObserver(measure);
      resize.observe(canvas);
    } else listen(window, 'resize', measure);
    measure();
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }
  function regenerate(seed) {
    world = generateWorld(seed);
    terrain = null;
    assetCache.clear();
    buildIndex();
    resourceSpots.clear();
    particles.length = 0;
    pings.length = 0;
    for (const p of Object.values(companions)) {
      p.x = CAMP.x + (p.id === 'milo' ? -37 : 51);
      p.y = CAMP.y + (p.id === 'milo' ? 94 : 127);
      p.target = null;
      p.path = [];
      p.stop = 0;
    }
    camera.x = CAMP.x;
    camera.y = CAMP.y - 70;
    waypoint = 0;
    selected = null;
    hover = null;
    manualTarget = null;
    navigation = null;
  }
  function command(type, payload = {}) {
    if (type === 'follow') {
      const id = payload.agent || payload.id || 'milo';
      followOverride = ['milo', 'nova', 'free'].includes(id) ? id : 'milo';
      if (companions[id]) {
        camera.x = companions[id].x;
        camera.y = companions[id].y - 70;
      }
    } else if (type === 'zoom')
      camera.targetZoom = clamp(
        Number.isFinite(Number(payload.value))
          ? Number(payload.value)
          : camera.targetZoom + (Number(payload.delta) || 0),
        MIN_ZOOM,
        1.8,
      );
    else if (type === 'home') {
      followOverride = 'free';
      camera.x = CAMP.x;
      camera.y = CAMP.y - 45;
      camera.targetZoom = Math.min(0.9, Math.max(0.55, width / 900));
    } else if (type === 'fit') {
      followOverride = 'free';
      camera.x = WIDTH / 2;
      camera.y = HEIGHT / 2;
      camera.targetZoom = clamp(
        Math.min(width / WIDTH, height / HEIGHT) * 0.95,
        MIN_ZOOM,
        1.8,
      );
    } else if (type === 'pause') paused = payload.paused !== false;
    else if (type === 'regenerate')
      regenerate(String(payload.seed || settings.seed || 'pip-wilds'));
    else if (
      type === 'move' &&
      Number.isFinite(Number(payload.x)) &&
      Number.isFinite(Number(payload.y))
    ) {
      walkTo(payload);
    } else if (type === 'walk-to') {
      walkTo(payload);
    } else if (type === 'resume-walk') {
      navigation = null;
      for (const p of Object.values(companions)) { p.target = null; p.path = []; p.stop = 0; }
    } else if (type === 'travel') {
      const target = directory().find(item => item.id === payload.id);
      if (target) { selected = target; moveCameraTo(target); camera.targetZoom = clamp(Number(payload.zoom) || Math.max(0.65, camera.targetZoom), MIN_ZOOM, 1.8); }
    } else if (type === 'emote') {
      const p = companions[payload.agent || 'milo'];
      if (p) {
        p.emote = { kind: String(payload.kind || 'cheer'), until: elapsed + 4 };
        burst(p.x, p.y - 80, payload.color || '#f5d49b', 18);
      }
    } else if (type === 'befriend') {
      const creature = world.enemies.find(item => item.id === payload.id);
      if (creature) { creature.friendlyUntil = elapsed + 8; burst(creature.x,creature.y-34,'#f0d5a6',16); }
    } else if (type === 'tour') {
      touring = payload.active !== false;
      navigation = null;
      waypoint = 0;
      const p = companions[getOuting()?.agent === 'nova' ? 'nova' : 'milo'];
      p.target = null;
      p.path = [];
      p.stop = 0;
      followOverride = p.id;
    } else if (type === 'biome') {
      const region = WORLD_BIOMES[payload.biome || payload.id];
      if (region) {
        followOverride = 'free';
        camera.x = region.x;
        camera.y = region.y;
      }
    } else if (type === 'inspect') {
      const target = [
        ...world.landmarks,
        ...world.npcs,
        ...world.enemies,
        ...resourceSpots.values(),
      ].find((item) => item.id === payload.id);
      if (target) {
        moveCameraTo(target);
        inspect(target);
      }
    }
    bounds();
    if (canvas) drawWorld();
    onScene();
    return metrics();
  }
  function metrics() {
    return {
      seed: world.seed,
      width: WIDTH,
      height: HEIGHT,
      assets: world.assets.length,
      landmarks: world.landmarks.length,
      npcs: world.npcs.length,
      enemies: world.enemies.length,
      visible: visibleCount,
      frames: painted,
      mounted: !!canvas,
      runningLoops: raf ? 1 : 0,
      paused,
      reducedMotion: reduced(),
      camera: { ...camera },
      companions: Object.fromEntries(
        Object.entries(companions).map(([id, p]) => [
          id,
          { x: Math.round(p.x), y: Math.round(p.y), walking: p.walking },
        ]),
      ),
      resources: resourceSpots.size,
      cachedAssets: assetCache.size,
      touring,
      biome: biomeAt(camera.x, camera.y),
      following: followOverride || settings.follow || 'milo',
      route: routeForOuting(getOuting()),
      navigation: navigation ? { ...navigation } : null,
    };
  }
  function destroy() {
    detach();
    dead = true;
    terrain = null;
    assetCache.clear();
    resourceSpots.clear();
    particles.length = 0;
  }
  return { mount, command, destroy, metrics, directory };
}
