// Sprite engine adapted from the supplied Pixel Pets Deluxe file.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
      .join('')
  );
}
function mix(a, b, t) {
  const A = hex2rgb(a),
    B = hex2rgb(b);
  return rgb2hex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
const shade = (c, t) => (t < 0 ? mix(c, '#1b1030', -t) : mix(c, '#ffffff', t));
function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function P(c, col, x, y) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), 1, 1);
}
const SW = 36,
  SH = 48,
  CX = 17.5,
  HY = 24,
  BY = 37,
  TO = BY - 35;
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
class Grid {
  constructor() {
    this.d = new Array(SW * SH).fill(null);
    this.ol = '#20142a';
  }
  set(x, y, c) {
    if (x >= 0 && y >= 0 && x < SW && y < SH) this.d[y * SW + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < SW && y < SH ? this.d[y * SW + x] : null;
  }
}
const key = (x, y) => x + ',' + y;
function mEll(cx, cy, rx, ry) {
  const m = [];
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x - cx) / (rx + 0.5),
        dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy <= 1) m.push([x, y]);
    }
  return m;
}
function mTri(a, b, c) {
  const m = [],
    minx = Math.floor(Math.min(a[0], b[0], c[0])),
    maxx = Math.ceil(Math.max(a[0], b[0], c[0])),
    miny = Math.floor(Math.min(a[1], b[1], c[1])),
    maxy = Math.ceil(Math.max(a[1], b[1], c[1]));
  const e = (p, q, x, y) =>
    (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  for (let y = miny; y <= maxy; y++)
    for (let x = minx; x <= maxx; x++) {
      const d1 = e(a, b, x, y),
        d2 = e(b, c, x, y),
        d3 = e(c, a, x, y);
      const neg = d1 < -0.6 || d2 < -0.6 || d3 < -0.6,
        pos = d1 > 0.6 || d2 > 0.6 || d3 > 0.6;
      if (!(neg && pos)) m.push([x, y]);
    }
  return m;
}
function mRect(x, y, w, h) {
  const m = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) m.push([x + i, y + j]);
  return m;
}
const mChain = (pts, r) => {
  const s = new Map();
  for (const p of pts)
    for (const q of mEll(p[0], p[1], r, r)) s.set(key(q[0], q[1]), q);
  return [...s.values()];
};
const mPath = (pts, r) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
    for (let k = 0; k <= n; k++)
      out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return mChain(out, r);
};
const mirrorX = m => m.map(p => [35 - p[0], p[1]]);
function paint(g, mask, col, o = {}) {
  if (o.ol !== false) {
    const set = new Set(mask.map(p => key(p[0], p[1]))),
      oc = o.olc || g.ol;
    for (const [x, y] of mask)
      for (const [dx, dy] of N4)
        if (!set.has(key(x + dx, y + dy))) g.set(x + dx, y + dy, oc);
  }
  for (const [x, y] of mask) g.set(x, y, o.fn ? o.fn(x, y) : col);
}
function decal(g, mask, col, within) {
  for (const [x, y] of mask) {
    if (within && !within.has(key(x, y))) continue;
    const v = g.get(x, y);
    if (v && v !== g.ol) g.set(x, y, col);
  }
}
function shadeFn(cx, cy, rx, ry, base) {
  const sh = shade(base, -0.2),
    hi = shade(base, 0.18);
  return (x, y) => {
    const dx = (x - cx) / (rx + 0.5),
      dy = (y - cy) / (ry + 0.5),
      s = dx * 0.5 + dy * 0.85;
    if (s > 0.58) return sh;
    if (s < -0.6 && dy < -0.3 && dx < 0.2) return hi;
    return base;
  };
}
const ellS = (g, cx, cy, rx, ry, col, o = {}) => {
  const m = mEll(cx, cy, rx, ry);
  paint(g, m, col, Object.assign({ fn: shadeFn(cx, cy, rx, ry, col) }, o));
  return m;
};

const ANIMALS = [
  {
    id: 'fox',
    name: 'Fox',
    tag: 'Clever & cuddly',
    body: '#f07a2a',
    belly: '#fff2de',
    feet: '#3e2418',
    ear: 'point',
    earIn: '#3e2418',
    earTip: '#3e2418',
    muzzle: '#fff2de',
    nose: '#2a1a22',
    tail: 'bushy',
    tailTip: '#fff6ea',
    pitch: 1.2,
    fav: 'fish',
    names: ['Rusty', 'Ember', 'Sunny'],
  },
  {
    id: 'bear',
    name: 'Bear',
    tag: 'Big hugs only',
    body: '#b0703e',
    belly: '#e8c79c',
    feet: '#8f5630',
    ear: 'round',
    earIn: '#e8c79c',
    muzzle: '#ecd0a6',
    nose: '#2b1a14',
    tail: 'nub',
    pitch: 0.62,
    fav: 'honey',
    names: ['Teddy', 'Mocha', 'Bruno'],
  },
  {
    id: 'bunny',
    name: 'Bunny',
    tag: 'Hoppy & sweet',
    body: '#fdf7f7',
    belly: '#ffe3ea',
    feet: '#ffd6e0',
    ear: 'long',
    earIn: '#ffb6c9',
    muzzle: null,
    nose: '#ff8fab',
    tail: 'puff',
    blush: '#ff9fb8',
    pitch: 1.55,
    fav: 'carrot',
    names: ['Mochi', 'Clover', 'Snowy'],
  },
  {
    id: 'cat',
    name: 'Cat',
    tag: 'Calico cutie',
    body: '#fbf4ea',
    belly: '#ffffff',
    feet: '#fbf4ea',
    ear: 'point',
    earIn: '#ffb6c0',
    muzzle: '#ffffff',
    nose: '#ff8fa3',
    tail: 'stripe',
    tailCol: '#e8933c',
    pitch: 1.3,
    fav: 'fish',
    names: ['Miso', 'Luna', 'Pumpkin'],
    deco: 'cat',
  },
  {
    id: 'dog',
    name: 'Dog',
    tag: 'Loyal best friend',
    body: '#d9a05b',
    belly: '#fff0d6',
    feet: '#fff0d6',
    ear: 'floppy',
    earCol: '#8f5a2c',
    muzzle: '#fff0d6',
    nose: '#2a1a1a',
    tail: 'wag',
    pitch: 0.95,
    fav: 'bone',
    names: ['Biscuit', 'Waffles', 'Cooper'],
    deco: 'dog',
  },
  {
    id: 'panda',
    name: 'Panda',
    tag: 'Bamboo buddy',
    body: '#fbfbfb',
    belly: '#ffffff',
    feet: '#2a2030',
    ear: 'round',
    earCol: '#2a2030',
    earIn: '#4a4058',
    muzzle: null,
    nose: '#2a2030',
    tail: 'nub',
    arms: '#2a2030',
    pitch: 0.72,
    fav: 'bamboo',
    names: ['Bao', 'Momo', 'Dumpling'],
    deco: 'panda',
  },
  {
    id: 'koala',
    name: 'Koala',
    tag: 'Sleepy snuggler',
    body: '#a4a9b8',
    belly: '#eceef4',
    feet: '#8a90a2',
    ear: 'round',
    big: 1,
    earIn: '#f4f5fa',
    muzzle: null,
    nose: '#2a2a35',
    noseBig: 1,
    tail: 'none',
    pitch: 0.82,
    fav: 'leaf',
    names: ['Kiki', 'Gumdrop', 'Ollie'],
  },
  {
    id: 'tiger',
    name: 'Tiger',
    tag: 'Tiny roar',
    body: '#f79a2c',
    belly: '#fff3e0',
    feet: '#fff3e0',
    ear: 'round',
    earCol: '#f79a2c',
    earIn: '#fff3e0',
    muzzle: '#fff3e0',
    nose: '#2a1a22',
    tail: 'stripe',
    tailCol: '#f79a2c',
    pitch: 0.52,
    fav: 'fish',
    names: ['Tigger', 'Blaze', 'Stripes'],
    deco: 'tiger',
  },
  {
    id: 'penguin',
    name: 'Penguin',
    tag: 'Waddle waddle',
    body: '#34446e',
    belly: '#ffffff',
    feet: '#ffa41f',
    ear: 'none',
    muzzle: null,
    nose: null,
    tail: 'nub',
    arms: '#2a3860',
    pitch: 1.4,
    fav: 'fish',
    names: ['Pebble', 'Waddles', 'Noot'],
    deco: 'penguin',
  },
  {
    id: 'pig',
    name: 'Pig',
    tag: 'Oink oink!',
    body: '#ffb3cb',
    belly: '#ffd0de',
    feet: '#e8789a',
    ear: 'point',
    earH: 0.55,
    earIn: '#ff8fb0',
    earCol: '#ff9fbd',
    muzzle: null,
    nose: null,
    tail: 'curl',
    tailCol: '#f08aab',
    pitch: 0.75,
    fav: 'apple',
    names: ['Truffle', 'Peaches', 'Hammy'],
    deco: 'pig',
  },
  {
    id: 'raccoon',
    name: 'Raccoon',
    tag: 'Masked mischief',
    body: '#818894',
    belly: '#eef0f5',
    feet: '#55596a',
    ear: 'point',
    earIn: '#c8ccd8',
    muzzle: '#eef0f5',
    nose: '#221826',
    tail: 'stripe',
    tailCol: '#818894',
    pitch: 1.05,
    fav: 'berries',
    names: ['Bandit', 'Pippin', 'Mischief'],
    deco: 'raccoon',
  },
  {
    id: 'hamster',
    name: 'Hamster',
    tag: 'Pocket sunshine',
    body: '#e7ad64',
    belly: '#fff2d8',
    feet: '#f5cc92',
    ear: 'round',
    earIn: '#ffd8de',
    muzzle: '#fff2d8',
    nose: '#ff8fa3',
    tail: 'nub',
    pitch: 1.45,
    fav: 'seed',
    names: ['Nibbles', 'Pip', 'Sesame'],
    deco: 'hamster',
  },
  {
    id: 'deer',
    name: 'Deer',
    tag: 'Gentle forest friend',
    body: '#c9894c',
    belly: '#fff0d0',
    feet: '#8a5530',
    ear: 'point',
    earH: 0.72,
    earIn: '#f2c89a',
    muzzle: '#fff0d0',
    nose: '#2a1a18',
    tail: 'puff',
    pitch: 0.9,
    fav: 'leaf',
    names: ['Fawn', 'Hazel', 'Maple'],
    deco: 'deer',
  },
  {
    id: 'frog',
    name: 'Frog',
    tag: 'Tiny pond prince',
    body: '#72bf5f',
    belly: '#e9f7b0',
    feet: '#5aa64d',
    ear: 'none',
    muzzle: null,
    nose: null,
    tail: 'none',
    pitch: 0.82,
    fav: 'mushroom',
    names: ['Pickle', 'Hop', 'Sprout'],
    deco: 'frog',
  },
  {
    id: 'owl',
    name: 'Owl',
    tag: 'Soft night watcher',
    body: '#8a5a3a',
    belly: '#f2d6a0',
    feet: '#e8a63a',
    ear: 'point',
    earH: 0.5,
    earIn: '#bf7a48',
    muzzle: null,
    nose: null,
    tail: 'none',
    pitch: 0.68,
    fav: 'seed',
    names: ['Hoot', 'Sage', 'Acorn'],
    deco: 'owl',
  },
  {
    id: 'dragon',
    name: 'Dragon',
    tag: 'Cuddly little spark',
    body: '#70c49a',
    belly: '#fff0aa',
    feet: '#4aa87c',
    ear: 'point',
    earIn: '#ffe18a',
    muzzle: '#d6fff0',
    nose: '#25503e',
    tail: 'stripe',
    tailCol: '#70c49a',
    pitch: 0.58,
    fav: 'cake',
    names: ['Sprout', 'Noodle', 'Moss'],
    deco: 'dragon',
  },
];

function buildSprite(A, pose, acc) {
  pose = pose || {};
  const g = new Grid();
  g.ol = mix(A.body, '#150a1e', 0.84);
  if (A.id === 'penguin') g.ol = '#141a30';
  const dy = pose.dy || 0,
    tw = pose.tail ? 1 : 0,
    ear = pose.ear || 0;
  const hy = HY + dy,
    hrx = A.big ? 11.5 : 11.5,
    hry = 9.5,
    by = BY;
  const earC = A.earCol || A.body;
  // tail
  const ox = tw,
    oy = (tw ? -1 : 0) + TO;
  if (A.tail === 'bushy') {
    paint(g, mEll(27.5 + ox, 33 + oy, 3.8, 6.2), A.body, {
      fn: shadeFn(27.5, 33 + TO, 3.8, 6.2, A.body),
    });
    decal(g, mEll(28 + ox, 28.5 + oy, 3, 2.4), A.tailTip);
  } else if (A.tail === 'stripe') {
    const pts = [
      [25, 40 + TO],
      [28.5, 38.5 + TO],
      [30.8, 35 + TO],
      [31, 31 + TO],
      [30 + ox, 27.5 + oy],
    ];
    const dk = A.id === 'tiger' ? '#3a2216' : '#7a4a22';
    paint(g, mPath(pts, 1.9), A.tailCol, {
      fn: (x, y) => ((y + TO) % 5 === 0 && y < 38 + TO ? dk : A.tailCol),
    });
  } else if (A.tail === 'wag') {
    const pts = [
      [25, 40 + TO],
      [28.5, 38 + TO],
      [30 + ox, 34 + oy],
      [29.5 + ox, 30 + oy],
    ];
    paint(g, mPath(pts, 2.2), A.body, {
      fn: (x, y) => (y < 33 + TO ? shade(A.body, -0.18) : A.body),
    });
  } else if (A.tail === 'puff')
    paint(g, mEll(26.5 + ox, 39 + TO, 2.8, 2.8), '#ffffff', {
      fn: shadeFn(26.5, 39 + TO, 2.8, 2.8, '#ffffff'),
    });
  else if (A.tail === 'nub')
    paint(
      g,
      mEll(26.5 + ox, 40 + TO, 2.2, 2.2),
      A.id === 'panda' ? '#2a2030' : A.body,
      {}
    );
  else if (A.tail === 'curl') {
    const m = mPath(
      [
        [26, 40 + TO],
        [28, 39 + TO],
        [29.2, 37 + TO],
        [28.4, 35.4 + TO],
        [26.8, 36.2 + TO],
      ],
      0.55
    );
    paint(g, m, A.tailCol, { ol: false });
  }
  // back ears
  const eb = (m, col) => paint(g, m, col, { fn: null });
  if (A.ear === 'round') {
    const r = A.big ? 5 : 3.7,
      yy = hy - (A.big ? 6.5 : 8.5) + (ear ? 1 : 0),
      xo = A.big ? 9.5 : 8.5;
    for (const s of [-1, 1]) {
      const ex = CX + s * xo;
      paint(g, mEll(ex, yy, r, r), earC, { fn: shadeFn(ex, yy, r, r, earC) });
      if (A.earIn)
        decal(g, mEll(ex + s * 0.3, yy + 0.3, r - 1.8, r - 1.8), A.earIn);
    }
  }
  if (A.ear === 'point') {
    const yy = ear ? 1.5 : 0,
      oc = A.earCol || A.body;
    for (const s of [0, 1]) {
      const f = p => (s ? [35 - p[0], p[1]] : p);
      const eh = A.earH || 1,
        T = [
          [CX - 11, hy - 3.5 + yy],
          [CX - 3.5, hy - 9 + yy],
          [CX - 10.5 - (eh < 1 ? 1 : 0), hy - 9 - 7.5 * eh + yy * 2],
        ].map(f);
      paint(g, mTri(T[0], T[1], T[2]), oc, { fn: (x, y) => oc });
      const I = [
        [CX - 9.5, hy - 5.8 + yy],
        [CX - 6, hy - 9 + yy],
        [CX - 9.6, hy - 9 - 4 * eh + yy * 2],
      ].map(f);
      decal(g, mTri(I[0], I[1], I[2]), A.earIn);
      if (A.earTip)
        decal(
          g,
          mTri(
            T[2],
            [T[2][0] + (s ? -3 : 3), T[2][1] + 4],
            [T[2][0] + (s ? 1 : -1), T[2][1] + 4]
          ),
          A.earTip
        );
    }
  }
  if (A.ear === 'long') {
    for (const s of [-1, 1]) {
      const ex = CX + s * 5.3 + (ear ? s * 2 : 0),
        yy = hy - 15 + (ear ? 6 : 0),
        ry = ear ? 6 : 7.5;
      paint(g, mEll(ex, yy, 3.1, ry), A.body, {
        fn: shadeFn(ex, yy, 3.1, ry, A.body),
      });
      decal(g, mEll(ex, yy + 0.5, 1.6, ry - 2.2), A.earIn);
    }
  }
  // body
  const bodyM = ellS(g, CX, by, 7, 5.5, A.body);
  const bodySet = new Set(bodyM.map(p => key(p[0], p[1])));
  if (A.belly) decal(g, mEll(CX, by + 1.5, 4.6, 3.6), A.belly, bodySet);
  if (A.id === 'tiger') {
    for (const s of [-1, 1]) {
      decal(g, mRect(s < 0 ? 11 : 23, 32, 2, 1), '#3a2216', bodySet);
      decal(g, mRect(s < 0 ? 11 : 23, 35, 2, 1), '#3a2216', bodySet);
    }
  }
  if (A.id === 'penguin')
    decal(g, mEll(CX, by + 0.5, 5.6, 4.6), '#ffffff', bodySet);
  if (pose.dirty)
    for (const p of [
      [13, 36],
      [22, 34],
      [19, 38],
      [15, 33],
    ])
      decal(g, [p], '#8a6a4a', bodySet);
  // arms
  if (A.arms)
    for (const s of [-1, 1]) {
      const ax = CX + s * 8.3,
        ay = by - 1 + (pose.arms ? -2 : 0);
      paint(g, mEll(ax, ay, 2.4, 4.2), A.arms, {
        fn: shadeFn(ax, ay, 2.4, 4.2, A.arms),
      });
    }
  // feet
  for (const s of [-1, 1]) {
    const fx = CX + s * 4.7,
      fc = A.feet;
    paint(g, mEll(fx, by + 5, 3.1, 2.1), fc, {
      fn: shadeFn(fx, by + 5, 3.1, 2.1, fc),
    });
  }
  // head
  const headM = ellS(g, CX, hy, hrx, hry, A.body),
    headSet = new Set(headM.map(p => key(p[0], p[1])));
  const hd = (m, col) => decal(g, m, col, headSet);
  if (A.muzzle) hd(mEll(CX, hy + 5.6, 5.4, 3.7), A.muzzle);
  if (A.id === 'fox') {
    hd(mEll(CX, hy + 8, 11, 4.4), '#fff2de');
    hd(mEll(CX - 8, hy + 5.5, 4, 2.6), '#fff2de');
    hd(mEll(CX + 8, hy + 5.5, 4, 2.6), '#fff2de');
  }
  if (A.id === 'bear') hd(mEll(CX, hy + 5.6, 5.6, 4), A.muzzle);
  if (A.deco === 'cat') {
    hd(mEll(CX - 6.5, hy - 5, 6.5, 5.5), '#eb9a45');
    hd(mEll(CX + 8, hy - 3, 5, 5.5), '#8f8a9a');
    hd(mEll(CX - 3, hy - 9, 3, 2), '#eb9a45');
  }
  if (A.deco === 'dog') {
    hd(mEll(CX - 6.5, hy - 0.5, 4.3, 4.3), '#8f5a2c');
    hd(mEll(CX, hy + 5.6, 5.6, 4), A.muzzle);
    hd(mEll(CX, hy - 8, 1.6, 2.4), '#fff0d6');
  }
  if (A.deco === 'panda') {
    hd(mEll(CX - 6.3, hy + 1.8, 3.1, 3.9), '#2a2030');
    hd(mEll(CX + 6.3, hy + 1.8, 3.1, 3.9), '#2a2030');
  }
  if (A.deco === 'tiger') {
    const st = '#3a2216';
    hd(mRect(17, hy - 9, 2, 5), st);
    hd(mRect(13, hy - 9, 1, 3), st);
    hd(mRect(22, hy - 9, 1, 3), st);
    hd(mRect(6, hy + 1, 3, 1), st);
    hd(mRect(6, hy + 4, 3, 1), st);
    hd(mRect(27, hy + 1, 3, 1), st);
    hd(mRect(27, hy + 4, 3, 1), st);
    hd(mEll(CX, hy + 5.6, 5.4, 3.7), '#fff3e0');
  }
  if (A.deco === 'penguin') {
    hd(mEll(CX, hy + 3, 8.6, 6.4), '#ffffff');
    hd(mEll(CX, hy + 6.5, 9.5, 3.2), '#ffffff');
  }
  if (A.deco === 'pig') {
    paint(g, mEll(CX, hy + 5.6, 4.7, 3.3), '#ffc9da', { olc: '#e8789a' });
    for (const x of [16, 19]) {
      g.set(x, Math.round(hy + 5), '#d85a80');
      g.set(x, Math.round(hy + 6), '#d85a80');
    }
  }
  if (A.deco === 'raccoon') {
    hd(mEll(CX - 6.3, hy + 1.2, 4.3, 3.8), '#303443');
    hd(mEll(CX + 6.3, hy + 1.2, 4.3, 3.8), '#303443');
    hd(mEll(CX, hy + 5.8, 5.6, 3.5), '#eef0f5');
    for (const yy of [-8, -5])
      hd(mRect(6, hy + yy, 24, 1), shade(A.body, -0.22));
  }
  if (A.deco === 'hamster') {
    hd(mEll(CX - 6.8, hy + 5.6, 4.2, 3), '#ffd08c');
    hd(mEll(CX + 6.8, hy + 5.6, 4.2, 3), '#ffd08c');
    hd(mEll(CX, hy + 6.3, 4.6, 3.3), '#fff2d8');
  }
  if (A.deco === 'deer') {
    for (const [sx, sy] of [
      [-7, -2],
      [-9, 3],
      [8, -3],
      [10, 2],
    ])
      hd(mEll(CX + sx, hy + sy, 1.2, 1.2), '#fff0d0');
    for (const s of [-1, 1]) {
      paint(
        g,
        mPath(
          [
            [CX + s * 4, hy - 8],
            [CX + s * 4, hy - 13],
            [CX + s * 1.5, hy - 16],
          ],
          0.55
        ),
        '#6b4a30',
        { ol: false }
      );
      paint(
        g,
        mPath(
          [
            [CX + s * 4, hy - 12],
            [CX + s * 7, hy - 15],
          ],
          0.55
        ),
        '#6b4a30',
        { ol: false }
      );
    }
  }
  if (A.deco === 'frog') {
    hd(mEll(CX - 6.6, hy - 6.8, 4.5, 3.2), shade(A.body, 0.08));
    hd(mEll(CX + 6.6, hy - 6.8, 4.5, 3.2), shade(A.body, 0.08));
    for (const [sx, sy] of [
      [-9, 5],
      [-5, 7],
      [8, 5],
      [4, 7],
    ])
      hd(mEll(CX + sx, hy + sy, 1.1, 1.1), shade(A.body, -0.18));
  }
  if (A.deco === 'owl') {
    hd(mEll(CX - 5.2, hy + 0.6, 4.6, 4.4), '#f7e3b0');
    hd(mEll(CX + 5.2, hy + 0.6, 4.6, 4.4), '#f7e3b0');
    hd(mEll(CX, hy + 7.5, 5.2, 3.2), A.belly);
    paint(
      g,
      mTri([CX - 2, hy + 4], [CX + 2, hy + 4], [CX, hy + 8]),
      '#f0a020',
      { ol: false }
    );
  }
  if (A.deco === 'dragon') {
    for (const [sx, sy] of [
      [-7, -5],
      [0, -7],
      [7, -5],
    ])
      hd(
        mTri(
          [CX + sx - 2, hy + sy + 3],
          [CX + sx + 2, hy + sy + 3],
          [CX + sx, hy + sy - 1]
        ),
        '#ffe18a'
      );
    hd(mEll(CX, hy + 7, 6, 3.5), '#d6fff0');
    for (const s of [-1, 1])
      paint(
        g,
        mTri([CX + s * 10, hy + 2], [CX + s * 14, hy], [CX + s * 12, hy + 5]),
        '#ffe18a',
        { ol: false }
      );
  }
  if (A.id === 'koala') {
    hd(mEll(CX, hy + 8, 6, 2.6), '#c3c7d4');
  }
  if (pose.dirty)
    for (const p of [
      [9, hy - 2],
      [25, hy - 5],
      [14, hy - 7],
      [23, hy + 6],
    ])
      decal(g, [p], '#8a6a4a', headSet);
  // floppy ears (front)
  if (A.ear === 'floppy')
    for (const s of [-1, 1]) {
      const m = mChain(
        [
          [CX + s * 10.5, hy - 5 + (ear ? 1 : 0)],
          [CX + s * 11.6, hy + (ear ? 2 : 0)],
          [CX + s * 12, hy + 4 + (ear ? 2 : 0)],
        ],
        2.6
      );
      paint(g, m, A.earCol, { fn: shadeFn(CX + s * 11.5, hy, 3, 6, A.earCol) });
    }
  // nose + mouth
  const nd = A.nose;
  if (A.noseBig) {
    paint(g, mEll(CX, hy + 4.8, 2.4, 3.1), nd, { ol: false });
    g.set(16, Math.round(hy + 3), '#7a7a90');
  } else if (nd) {
    const ny = Math.round(hy + 4);
    for (const x of [16, 17, 18, 19]) g.set(x, ny, nd);
    g.set(17, ny + 1, nd);
    g.set(18, ny + 1, nd);
  }
  const my = Math.round(hy + (A.noseBig ? 9 : 7)),
    mc = '#3a1c28';
  if (A.id !== 'pig' && A.id !== 'penguin') {
    if (pose.mouth === 'open') {
      for (const [x, y] of [
        [16, my],
        [17, my],
        [18, my],
        [19, my],
        [17, my + 1],
        [18, my + 1],
      ])
        g.set(x, y, '#5a1f33');
      g.set(17, my + 1, '#ff8fa5');
      g.set(18, my + 1, '#ff8fa5');
    } else if (pose.mouth === 'sad') {
      for (const [x, y] of [
        [16, my + 1],
        [17, my],
        [18, my],
        [19, my + 1],
      ])
        g.set(x, y, mc);
    } else if (pose.mouth === 'small') {
      g.set(17, my, mc);
      g.set(18, my, mc);
    } else if (pose.mouth !== 'none') {
      for (const [x, y] of [
        [16, my],
        [17, my + 1],
        [18, my + 1],
        [19, my],
      ])
        g.set(x, y, mc);
    }
  } else if (A.id === 'penguin') {
    const bk =
      pose.mouth === 'open'
        ? [
            [16, hy + 5],
            [17, hy + 5],
            [18, hy + 5],
            [19, hy + 5],
            [16, hy + 6],
            [17, hy + 6],
            [18, hy + 6],
            [19, hy + 6],
            [17, hy + 7],
            [18, hy + 7],
          ]
        : [
            [16, hy + 5],
            [17, hy + 5],
            [18, hy + 5],
            [19, hy + 5],
            [17, hy + 6],
            [18, hy + 6],
          ];
    for (const [x, y] of bk) g.set(x, Math.round(y), '#ff9f1c');
    g.set(16, Math.round(hy + 5), '#ffc457');
    g.set(17, Math.round(hy + 5), '#ffc457');
    if (pose.mouth === 'open') {
      g.set(17, Math.round(hy + 6), '#c0455a');
      g.set(18, Math.round(hy + 6), '#c0455a');
    }
  } else if (pose.mouth === 'open') {
    g.set(17, my + 2, '#5a1f33');
    g.set(18, my + 2, '#5a1f33');
  }
  // eyes (3x4, big & shiny)
  const ey = Math.round(hy),
    lk = pose.look || 0,
    dk = '#1c1220',
    wh = '#ffffff',
    E = pose.eyes,
    cd = A.id === 'panda' ? '#f2ecff' : dk;
  for (const x0b of [10, 23]) {
    const x0 = x0b + lk,
      out = x0b < 15;
    const blk = (h0, h1) => {
      for (let x = x0; x < x0 + 3; x++)
        for (let y = ey + h0; y <= ey + h1; y++) g.set(x, y, dk);
    };
    if (E === 'wide') {
      blk(-1, 3);
      g.set(x0, ey - 1, wh);
      g.set(x0 + 1, ey - 1, wh);
      g.set(x0, ey, wh);
      g.set(x0 + 2, ey + 3, '#9aa8ff');
    } else if (E === 'blink') {
      for (let x = x0; x < x0 + 3; x++) g.set(x, ey + 2, cd);
    } else if (E === 'sleep') {
      g.set(x0, ey + 1, cd);
      g.set(x0 + 1, ey + 2, cd);
      g.set(x0 + 2, ey + 1, cd);
    } else if (E === 'happy') {
      g.set(x0, ey + 2, cd);
      g.set(x0 + 1, ey + 1, cd);
      g.set(x0 + 2, ey + 2, cd);
      g.set(x0 + 1, ey, cd);
    } else if (E === 'sad') {
      blk(0, 3);
      g.set(x0, ey, wh);
      g.set(x0, ey + 1, wh);
      const tx = out ? x0 - 1 : x0 + 3;
      g.set(tx, ey + 4, '#8fd8ff');
      g.set(tx, ey + 5, '#8fd8ff');
    } else {
      blk(0, 3);
      g.set(x0, ey, wh);
      g.set(x0, ey + 1, wh);
      g.set(x0 + 1, ey, wh);
      g.set(x0 + 2, ey + 3, '#8a78d0');
    }
  }
  // blush
  const bl = mix(
      A.body === '#fbfbfb' ? '#ffffff' : A.body,
      A.blush || '#ff6f91',
      0.55
    ),
    by2 = Math.round(hy + 4.6);
  if (
    (pose.eyes !== 'sad' && A.id !== 'fox' && A.id !== 'panda') ||
    A.id === 'panda'
  ) {
    for (const x of [8, 9, 26, 27])
      if (!(A.id === 'tiger' && false))
        g.set(
          x,
          by2,
          mix(g.get(x, by2) || bl, '#ff7a9c', A.id === 'panda' ? 0.5 : 0.45)
        );
  } else if (A.id === 'fox')
    for (const x of [8, 9, 26, 27]) g.set(x, by2, '#ffb5a0');
  // accessory
  if (acc && acc !== 'none') drawAcc(g, acc, hy);
  return gridToCanvas(g);
}
function gridToCanvas(g) {
  const c = mkCanvas(SW, SH),
    x = c.getContext('2d');
  for (let y = 0; y < SH; y++)
    for (let i = 0; i < SW; i++) {
      const v = g.d[y * SW + i];
      if (v) P(x, v, i, y);
    }
  return c;
}

const ACCS = [
  { id: 'none', name: 'None', price: 0 },
  { id: 'bow', name: 'Bow', price: 25 },
  { id: 'scarf', name: 'Scarf', price: 35 },
  { id: 'flowers', name: 'Flower crown', price: 40 },
  { id: 'party', name: 'Party hat', price: 45 },
  { id: 'phones', name: 'Headphones', price: 50 },
  { id: 'shades', name: 'Sunglasses', price: 60 },
  { id: 'wizard', name: 'Wizard hat', price: 80 },
  { id: 'crown', name: 'Crown', price: 100 },
];
function drawAcc(g, id, hy) {
  const top = Math.round(hy - 10);
  if (id === 'bow') {
    const bx = 27,
      by = top + 3;
    paint(
      g,
      mTri([bx - 1, by], [bx - 5, by - 3], [bx - 5, by + 3]),
      '#ff6fa5',
      {}
    );
    paint(
      g,
      mTri([bx + 1, by], [bx + 5, by - 3], [bx + 5, by + 3]),
      '#ff6fa5',
      {}
    );
    paint(g, mRect(bx - 1, by - 1, 3, 3), '#d63c7c', {});
  }
  if (id === 'party') {
    const pts = [
      [CX - 6.5, top + 1],
      [CX + 6.5, top + 1],
      [CX + 3, top - 12],
    ];
    paint(g, mTri(pts[0], pts[1], pts[2]), '#7ad7ff', {
      fn: (x, y) => ((x + y) % 6 < 2 ? '#ff7ab8' : '#7ad7ff'),
    });
    paint(g, mEll(CX + 3, top - 12, 1.8, 1.8), '#ffe14d', {});
  }
  if (id === 'crown') {
    paint(g, mRect(12, top - 3, 12, 4), '#ffd23f', {});
    for (const x of [12, 17, 22])
      paint(
        g,
        mTri([x, top - 3], [x + 2, top - 3], [x + 1, top - 8]),
        '#ffd23f',
        {}
      );
    for (const [x, c] of [
      [13, '#ff5c8a'],
      [17, '#5cd0ff'],
      [22, '#ff5c8a'],
    ])
      g.set(x, top - 1, c);
    for (const x of [12, 17, 22]) g.set(x + 1, top - 8, '#fff2a0');
  }
  if (id === 'wizard') {
    paint(g, mEll(CX, top + 1, 12.5, 2.4), '#5b3fb0', {});
    paint(
      g,
      mTri([CX - 7, top], [CX + 7, top], [CX + 5, top - 16]),
      '#6e4fd0',
      { fn: (x, y) => '#6e4fd0' }
    );
    g.set(15, top - 6, '#ffe14d');
    g.set(14, top - 5, '#ffe14d');
    g.set(16, top - 5, '#ffe14d');
    g.set(15, top - 4, '#ffe14d');
    g.set(19, top - 9, '#ffe14d');
    paint(g, mRect(CX - 7, top - 2, 15, 1), '#ffd23f', { ol: false });
  }
  if (id === 'shades') {
    const dk = '#1c1a28';
    for (const [x0, x1] of [
      [9, 13],
      [22, 26],
    ]) {
      paint(g, mRect(x0, hy, x1 - x0 + 1, 4), dk, { ol: false });
      g.set(x0 + 1, hy + 1, '#7a8cff');
      g.set(x0 + 2, hy + 1, '#7a8cff');
    }
    for (let x = 14; x <= 21; x++) g.set(x, hy, dk);
  }
  if (id === 'scarf') {
    const bandY = Math.round(hy + 10.4);
    paint(g, mEll(CX, bandY, 8.6, 1.8), '#ff4d5e', {});
    paint(g, mRect(20, bandY + 1, 3, 6), '#ff4d5e', {});
    for (let y = bandY + 2; y < bandY + 7; y += 2)
      for (let x = 20; x < 23; x++) g.set(x, y, '#ffe9ec');
  }
  if (id === 'flowers') {
    const cols = [
      '#ff7ab8',
      '#ffffff',
      '#ffd23f',
      '#a97bff',
      '#ff7ab8',
      '#ffffff',
      '#ffd23f',
    ];
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.12 + i * 0.125),
        fx = Math.round(CX + Math.cos(a) * 10.2),
        fy = Math.round(hy + Math.sin(a) * 8.6);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        g.set(fx + dx, fy + dy, cols[i]);
      g.set(fx, fy, '#ffb22e');
      if (i % 2 === 0) {
        g.set(fx + 2, fy + 1, '#4fbf5a');
        g.set(fx - 2, fy + 1, '#4fbf5a');
      }
    }
  }
  if (id === 'phones') {
    const m = [];
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI * (1 + i / 24);
      m.push([
        Math.round(CX + Math.cos(a) * 11.3),
        Math.round(hy + Math.sin(a) * 9.8),
      ]);
    }
    for (const [x, y] of m) {
      g.set(x, y, '#3a3450');
      g.set(x, y - 1, '#3a3450');
    }
    for (const s of [-1, 1])
      paint(g, mEll(CX + s * 11.8, hy - 1, 2, 3.2), '#ff5d8f', {
        fn: shadeFn(CX + s * 11.8, hy - 1, 2, 3.2, '#ff5d8f'),
      });
  }
}
const _sc = {};
function getSprite(A, pose, acc) {
  const k =
    A.id +
    '|' +
    ['eyes', 'mouth', 'look', 'tail', 'dy', 'ear', 'arms', 'dirty']
      .map(f => pose[f] || 0)
      .join('|') +
    '|' +
    (acc || 'none');
  return _sc[k] || (_sc[k] = buildSprite(A, pose, acc));
}

export { ANIMALS, getSprite };
