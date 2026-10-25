/* 2D looks for the story films: a reel-3d spec with style3d "getekend" or "stickman" is drawn here instead of
   in three.js (scene3d.js hands it to window.FILM2D). Same spec - sets and spots from engine/render/3d/catalog.json,
   actors with actions, moods and things in their hands, cameras, verse cards, the app on a phone, kaart
   journeys - only the look differs:
     getekend  hand-drawn: muted, dark worlds, round-headed off-white figures with soft dark outlines, lines
               that "boil" (redrawn 8 times a second), handwritten type
     stickman  flat vector: black round heads with a rim light, coloured clothes, stick limbs, soft blurred
               backgrounds, glow and particles, heavy type
   Everything is SVG, built once per world and posed from t (a pure function of time: frames render out of order). */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1080, H = 1920, FPS = 24;
  const sv = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (parent) parent.appendChild(e); return e; };
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const sm = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const r1 = x => Math.round(x * 10) / 10;
  function rng(seed) {
    let h = [...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
    return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const wave = (seed) => { const r = rng(seed); const f = [0, 1, 2].map(i => ({ a: .55 / (i + 1), w: (.7 + r() * .6) * (i + 1) * 1.7, p: r() * 6.28 })); return x => f.reduce((n, o) => n + o.a * Math.sin(x * o.w + o.p), 0); };

  /* ---------------- looks ---------------- */
  const LOOKS = ['getekend', 'stickman', 'schets', 'stift', 'krijt'];
  // palettes per look and time of day; sets add their own colours on top
  const PAL = {
    getekend: {
      dag: { sky: ['#a9ada6', '#d9d3c3'], far: '#a3a194', mid: '#8f8c7c', ground: '#7d7969', line: '#24211e', prop: '#b8b1a0', prop2: '#958d7b', light: '#fff1cf', dark: false },
      avond: { sky: ['#1a1316', '#6b3730'], far: '#3a2629', mid: '#2e2124', ground: '#261d20', line: '#5d4549', prop: '#3b2c30', prop2: '#4a383c', light: '#f2b467', dark: true },
      nacht: { sky: ['#0d0d0f', '#1b1b1f'], far: '#1c1c20', mid: '#212126', ground: '#26262b', line: '#4d4d55', prop: '#2c2c32', prop2: '#38383f', light: '#e9c27c', dark: true },
    },
    stickman: {
      dag: { sky: ['#5fa9de', '#f4e6c9'], far: '#a6c3c0', mid: '#86ad74', ground: '#5f8c4c', line: null, prop: '#c9a77a', prop2: '#9c7b56', light: '#fff4d8', dark: false },
      avond: { sky: ['#272a58', '#f3955a'], far: '#7a4c6c', mid: '#4a3858', ground: '#2c2440', line: null, prop: '#5a3f58', prop2: '#3f2c45', light: '#ffb466', dark: true },
      nacht: { sky: ['#060a1d', '#25335f'], far: '#1e274a', mid: '#161d3a', ground: '#10152c', line: null, prop: '#222c52', prop2: '#1a2245', light: '#a9cbff', dark: true },
    },
  };
  const STY = {
    getekend: { drawn: 1, pal: 'getekend', font: '"Patrick Hand", "Inter", sans-serif', title: '"Patrick Hand", "Inter", sans-serif', lw: 6, charLine: '#141416', skin: '#ebe6d9', eye: '#141416', boil: true, blur: 0 },
    stickman: { flat: 1, pal: 'stickman', font: 'Inter, sans-serif', title: '"Inter Black", Inter, sans-serif', lw: 0, charLine: null, skin: '#0c0c10', eye: '#f4f2ec', boil: false, blur: 0 },
    // poster looks: the story is drawn live, panel by panel, on one big sheet (see poster mode in FILM2D)
    schets: { drawn: 1, poster: 1, pal: 'getekend', font: '"Patrick Hand", "Inter", sans-serif', title: '"Patrick Hand", "Inter", sans-serif', lw: 4.5, charLine: '#1f1c18', skin: '#f1e9d7', eye: '#1f1c18', ink: '#1f1c18', paper: '#ebe1cb', tool: 'potlood' },
    stift: { drawn: 1, poster: 1, pal: 'stickman', font: '"Patrick Hand", "Inter", sans-serif', title: '"Patrick Hand", "Inter", sans-serif', lw: 5, charLine: '#2d2b36', skin: '#ffd8bd', eye: '#2d2b36', ink: '#2d2b36', paper: '#fbf9f3', tool: 'stift' },
    krijt: { drawn: 1, poster: 1, pal: 'getekend', font: '"Patrick Hand", "Inter", sans-serif', title: '"Patrick Hand", "Inter", sans-serif', lw: 5, charLine: '#eeeadf', skin: '#e9e3d4', eye: '#eeeadf', ink: '#eeeadf', paper: '#28342f', tool: 'krijt' },
  };
  // accents in the app's colour (project theme accent #0d9488): light on dark grounds, deep on paper, quiet in the drawn look
  const TEAL = { light: '#2dd4bf', mid: '#14b8a6', deep: '#0d9488', drawn: '#5fcfc1' };
  /** Mute a colour toward grey (the drawn look keeps colours quiet). */
  function mute(hex, k = .45, toward = '#6f6a62') {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const a = p(hex), b = p(toward);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, '0')).join('');
  }
  const shade = (hex, k) => mute(hex, Math.abs(k), k < 0 ? '#000000' : '#ffffff');

  /* ---------------- characters (catalog looks) ---------------- */
  // robe: long garment (biblical), top/bottom: modern clothes; head: hair | headcloth | veil | crown | helmet
  const PEOPLE = {
    'vrouw-modern': { female: 1, top: '#e5705b', bottom: '#3a4250', hair: '#6b3d22', head: 'long' },
    'vrouw-modern-2': { female: 1, top: '#e6b733', bottom: '#2e3440', hair: '#1f1712', head: 'curls' },
    'vrouw-modern-3': { female: 1, top: '#4f9a6b', bottom: '#2e3440', hair: '#5a3a24', head: 'bun' },
    'man-modern': { top: '#3e6fb5', bottom: '#2c323c', hair: '#5a3a24', head: 'short' },
    'man-modern-2': { top: '#4c7d55', bottom: '#2c323c', hair: '#1c1714', head: 'short', beard: '#1c1714' },
    'man-modern-3': { top: '#eeeae0', bottom: '#30363f', hair: '#16110e', head: 'curls' },
    'oudere-man': { top: '#6b5f52', bottom: '#3a3633', hair: '#b9b4ab', head: 'bald', beard: '#c9c4bb', glasses: 1 },
    'oudere-vrouw': { female: 1, top: '#7b5ea8', bottom: '#3a3633', hair: '#c4c0b8', head: 'bun', glasses: 1 },
    'man-bijbels': { robe: '#b48a5a', robe2: '#8a6640', cloth: '#ece6d6', band: '#7a5634', head: 'headcloth', beard: '#2a1d14' },
    'man-bijbels-2': { robe: '#5f8a5a', robe2: '#45683f', hair: '#2a1d14', head: 'short', beard: '#2a1d14' },
    'oude-man-bijbels': { robe: '#7b5d8f', robe2: '#5e4570', cloth: '#efe9da', band: '#6a4a2a', head: 'headcloth', beard: '#ededea', longBeard: 1, staff: 1 },
    'vrouw-bijbels': { female: 1, robe: '#d98a45', robe2: '#b66c2f', cloth: '#3f6fb0', head: 'veil' },
    'vrouw-bijbels-2': { female: 1, robe: '#4c6fa8', robe2: '#3a568a', cloth: '#efeae0', head: 'veil' },
    'herder': { robe: '#a2804f', robe2: '#7e6038', hair: '#2a1d14', head: 'curls', staff: 1, short: 1 },
    'visser': { robe: '#6d7f8c', robe2: '#53636e', hair: '#2a1d14', head: 'short', beard: '#2a1d14' },
    'zeeman': { robe: '#d9cdb5', robe2: '#b6a98e', cloth: '#c0392b', band: '#8e2a20', head: 'headcloth', beard: '#2a1d14', short: 1 },
    'koning': { robe: '#9b2f4a', robe2: '#6e2035', hair: '#2a1d14', head: 'crown', beard: '#2a1d14' },
    'soldaat': { robe: '#a8382f', robe2: '#7d2a23', head: 'helmet', short: 1 },
  };
  // rig sizes (local units, feet at y = 0, facing +x)
  const R = { hip: 165, sh: 318, head: 400, hr: 66, thigh: 86, shin: 82, upper: 78, fore: 72 };

  /** One figure: an SVG group, posed each frame by update(state).
   *  g (place + scale) holds a contact shadow and the pose group (turned flat for 'lie'); a figure with base
   *  'ride' sits on a donkey drawn in the same group, so the two move as one. */
  function makeActor(parent, lookKey, S, P, seed) {
    const L = PEOPLE[lookKey] || PEOPLE['man-modern'];
    const draw = S.drawn;
    const dk = c => draw ? mute(c, .38) : c;
    const robe = L.robe ? dk(L.robe) : null, robe2 = L.robe2 ? dk(L.robe2) : null;
    const top = L.top ? dk(L.top) : robe, bottom = L.bottom ? dk(L.bottom) : (robe2 || robe);
    const skin = S.skin, line = S.charLine, lw = S.lw;
    const g = sv('g', { 'data-actor': 1 }, parent);
    // the contact shadow on the ground (outside the pose group: it stays flat, under the feet or the body)
    const shadow = sv('ellipse', { cx: 0, cy: 0, rx: 75, ry: 13, fill: '#000', opacity: S.poster ? 0 : P.dark ? .34 : .2, 'data-nohaze': 1 }, g);
    const dunk = sv('g', {}, g);   // holds the pose; cut off at the water line while standing in water ('wade')
    const pose = sv('g', {}, dunk);
    const body = sv('g', {}, pose);
    // limbs: a tube (outline + fill) in the drawn look, one dark stroke for stickman
    const limb = (fill, w) => {
      const grp = sv('g', {}, body);
      const o = draw ? sv('path', { fill: 'none', stroke: line, 'stroke-width': w + lw * 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grp)
        : sv('path', { fill: 'none', stroke: P.dark ? '#8fb2ec' : '#ffffff', 'stroke-width': 21, opacity: P.dark ? .55 : .45, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grp);
      const f = sv('path', { fill: 'none', stroke: draw ? fill : '#0c0c10', 'stroke-width': draw ? w : 15, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-fs': draw ? 1 : null }, grp);
      return { grp, set: d => { o.setAttribute('d', d); f.setAttribute('d', d); } };
    };
    const legFill = robe ? skin : bottom, armFill = draw ? (robe || top) : null;
    const legB = limb(legFill, 26);
    // the donkey (base 'ride'): between the rider's far leg and near leg
    const ass = sv('g', { visibility: 'hidden' }, body);
    const assC = draw ? mute('#8f8578', .3) : '#8d8782', assD = draw ? mute('#5f574d', .3) : '#5e5853', assL = draw ? mute('#d8d0c2', .3) : '#d9d3c9', st0 = draw ? { stroke: line, 'stroke-width': lw * .8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } : {};
    const assLegs = [[-84, 0], [-58, 1], [72, 1], [98, 0]].map(([x, near]) => ({ x, near, n: sv('path', { fill: 'none', stroke: near ? assC : assD, 'stroke-width': 17, 'stroke-linecap': 'round' }, ass) }));
    if (draw) assLegs.forEach(l => { const o = l.n.cloneNode(); o.setAttribute('stroke', line); o.setAttribute('stroke-width', 17 + lw * 2); ass.insertBefore(o, l.n); l.o = o; });
    const assTail = sv('path', { fill: 'none', stroke: assD, 'stroke-width': 8, 'stroke-linecap': 'round' }, ass);
    sv('ellipse', { cx: 6, cy: -168, rx: 128, ry: 54, fill: assC, ...st0 }, ass);
    sv('ellipse', { cx: 6, cy: -138, rx: 92, ry: 22, fill: assL, opacity: .55 }, ass);
    const assHead = sv('g', {}, ass);
    sv('path', { d: 'M92 -200 Q130 -232 160 -262 L196 -236 Q160 -196 118 -150 Z', fill: assC, ...st0 }, assHead);
    for (const [x, r] of [[166, -14], [184, 6]]) sv('path', { d: `M${x} -262 Q${x - 10} -318 ${x + 4} -350 Q${x + 18} -318 ${x + 12} -262 Z`, fill: assC, ...st0, transform: `rotate(${r} ${x} -262)` }, assHead);
    sv('ellipse', { cx: 204, cy: -238, rx: 50, ry: 27, fill: assC, ...st0, transform: 'rotate(32 204 -238)' }, assHead);
    sv('ellipse', { cx: 232, cy: -220, rx: 20, ry: 16, fill: assL, transform: 'rotate(32 232 -220)' }, assHead);
    sv('circle', { cx: 196, cy: -252, r: 5, fill: '#141416' }, assHead);
    sv('path', { d: 'M100 -214 Q130 -244 158 -268', fill: 'none', stroke: assD, 'stroke-width': 12, 'stroke-linecap': 'round' }, assHead);   // mane
    sv('path', { d: 'M-40 -224 L54 -224 L58 -192 L-44 -192 Z', fill: draw ? mute('#7a3b34', .3) : '#a8432f', ...st0 }, ass);           // the saddle cloth
    const legF = limb(legFill, 26), armB = limb(armFill || skin, 24);
    const handB = sv('circle', { r: draw ? 15 : 13, fill: draw ? skin : '#f2efe8', stroke: line, 'stroke-width': lw }, body);
    // torso / robe
    const torso = sv('path', { fill: robe || top, stroke: line, 'stroke-width': lw, 'stroke-linejoin': 'round' }, body);
    const hem = robe ? sv('path', { fill: 'none', stroke: robe2, 'stroke-width': 9, 'stroke-linecap': 'round' }, body) : null;
    const armF = limb(armFill || skin, 24);
    const handF = sv('circle', { r: draw ? 15 : 13, fill: draw ? skin : '#f2efe8', stroke: line, 'stroke-width': lw }, body);
    // hand props (shown per action)
    const props = sv('g', {}, body);
    const book = sv('g', { visibility: 'hidden' }, props);
    sv('path', { d: 'M-34 -24 L0 -18 L34 -24 L34 22 L0 28 L-34 22 Z', fill: draw ? '#6a3a35' : '#7a2e2e', stroke: line, 'stroke-width': lw * .7 }, book);
    sv('path', { d: 'M-28 -18 L0 -12 L28 -18 L28 16 L0 22 L-28 16 Z', fill: draw ? '#e6dfcd' : '#f4eedf' }, book);
    sv('path', { d: 'M0 -12 L0 22', stroke: draw ? '#8a8270' : '#b8ad95', 'stroke-width': 2 }, book);
    const phoneP = sv('g', { visibility: 'hidden' }, props);
    sv('rect', { x: -15, y: -28, width: 30, height: 56, rx: 6, fill: '#15161a', stroke: line, 'stroke-width': lw * .6 }, phoneP);
    sv('rect', { x: -11, y: -23, width: 22, height: 46, rx: 3, fill: draw ? '#cfe3e6' : '#bfe9ff' }, phoneP);
    if (!draw) sv('circle', { r: 70, fill: 'url(#f2d-phoneglow)', opacity: .7 }, phoneP);
    const scrollP = sv('g', { visibility: 'hidden' }, props);
    sv('rect', { x: -40, y: -20, width: 80, height: 40, fill: '#efe2c2', stroke: line, 'stroke-width': lw * .6 }, scrollP);
    for (const x of [-42, 42]) sv('rect', { x: x - 6, y: -25, width: 12, height: 50, rx: 6, fill: '#7a5634' }, scrollP);
    const held = {}; const hs = { stroke: line, 'stroke-width': lw * .7 };
    const h1 = sv('g', { visibility: 'hidden' }, props); sv('path', { d: 'M-22 30 Q-36 0 -16 -20 L-12 -34 L12 -34 L16 -20 Q36 0 22 30 Z', fill: '#b8693f', ...hs }, h1); held.kruik = h1;
    const h2 = sv('g', { visibility: 'hidden' }, props); sv('rect', { x: -40, y: -24, width: 80, height: 48, rx: 4, fill: '#c8b38c', ...hs }, h2); held.steen = h2;
    const h3 = sv('g', { visibility: 'hidden' }, props); sv('ellipse', { cx: 0, cy: 0, rx: 44, ry: 28, fill: '#f3efe4', ...hs }, h3); sv('circle', { cx: 42, cy: -14, r: 16, fill: '#d9cdb8', stroke: line, 'stroke-width': lw * .6 }, h3); held.lam = h3;
    const h4 = sv('g', { visibility: 'hidden' }, props); sv('path', { d: 'M-36 -8 L36 -8 L28 26 L-28 26 Z', fill: '#b08a55', ...hs }, h4); for (const x of [-16, 4, 22]) sv('ellipse', { cx: x, cy: -14, rx: 14, ry: 9, fill: '#d9a35c' }, h4); held.mand = h4;
    const h5 = sv('g', { visibility: 'hidden' }, props); sv('ellipse', { cx: 0, cy: 0, rx: 34, ry: 22, fill: '#d29a55', ...hs }, h5); sv('path', { d: 'M-18 -6 Q0 -14 18 -6', fill: 'none', stroke: '#a26a32', 'stroke-width': 4 }, h5); held.brood = h5;
    const h6 = sv('g', { visibility: 'hidden' }, props); sv('path', { d: 'M-40 0 Q-10 -24 26 -4 L44 -18 L42 18 L26 4 Q-10 24 -40 0 Z', fill: draw ? '#9aa6ad' : '#a9c1cf', ...hs }, h6); sv('circle', { cx: -26, cy: -3, r: 3.5, fill: '#141416' }, h6); held.vis = h6;
    const h7 = sv('g', { visibility: 'hidden' }, props); sv('path', { d: 'M-22 -14 Q-30 22 0 26 Q30 22 22 -14 Q0 -6 -22 -14 Z', fill: '#8a6a3c', ...hs }, h7); sv('path', { d: 'M-16 -14 L-4 -28 L6 -14 L18 -26', fill: 'none', stroke: '#6a4a24', 'stroke-width': 5, 'stroke-linecap': 'round' }, h7); held.buidel = h7;
    const h8 = sv('g', { visibility: 'hidden' }, props); sv('path', { d: 'M-14 -30 L14 -30 L12 -12 Q24 0 20 22 Q0 32 -20 22 Q-24 0 -12 -12 Z', fill: draw ? '#7f8f6a' : '#7fae6a', ...hs }, h8); sv('rect', { x: -9, y: -40, width: 18, height: 12, rx: 3, fill: '#6a4a2a' }, h8); held.olie = h8;
    const staff = L.staff ? sv('path', { fill: 'none', stroke: draw ? '#5b4430' : '#6e4f33', 'stroke-width': 11, 'stroke-linecap': 'round' }, body) : null;
    // head
    const head = sv('g', {}, pose);
    const back = sv('g', {}, head);    // hair / veil behind the head
    if (L.head === 'veil') sv('path', { d: `M${-R.hr - 14} 10 Q${-R.hr - 18} ${-R.hr - 20} 0 ${-R.hr - 18} Q${R.hr + 18} ${-R.hr - 20} ${R.hr + 14} 10 L${R.hr + 30} 120 L${-R.hr - 34} 120 Z`, fill: dk(L.cloth), stroke: line, 'stroke-width': lw }, back);
    if (L.head === 'long') sv('path', { d: `M${-R.hr} -10 Q${-R.hr - 10} 90 ${-R.hr + 6} 110 L${R.hr - 6} 110 Q${R.hr + 10} 90 ${R.hr} -10 Z`, fill: dk(L.hair), stroke: line, 'stroke-width': lw }, back);
    if (L.head === 'headcloth') sv('path', { d: `M${-R.hr - 8} -6 L${-R.hr - 22} 96 L${-R.hr + 30} 70 Z`, fill: dk(L.cloth), stroke: line, 'stroke-width': lw, 'stroke-linejoin': 'round' }, back);
    if (!draw) { // rim light: a pale circle just behind the black head
      sv('circle', { cx: -7, cy: -5, r: R.hr + 5, fill: P.dark ? '#9fc4ff' : '#ffffff', opacity: P.dark ? .85 : .55 }, back);
    }
    sv('circle', { r: R.hr, fill: skin, stroke: line, 'stroke-width': lw }, head);
    const hairG = sv('g', {}, head);
    const hc = L.hair ? (draw ? '#2b2622' : '#050507') : null;
    if (L.head === 'short' && hc) sv('path', { d: `M${-R.hr + 2} -14 Q${-R.hr + 6} ${-R.hr - 4} 4 ${-R.hr - 2} Q${R.hr - 4} ${-R.hr + 2} ${R.hr - 4} -22 Q30 -46 -10 -40 Q-40 -38 ${-R.hr + 2} -14 Z`, fill: draw ? hc : L.hair === '#b9b4ab' ? '#9a958c' : hc, stroke: line, 'stroke-width': lw * .8 }, hairG);
    if (L.head === 'curls' && hc) for (const [x, y, r] of [[-44, -40, 22], [-18, -60, 24], [12, -64, 24], [40, -50, 22], [56, -24, 18], [-58, -14, 18]]) sv('circle', { cx: x, cy: y, r, fill: hc, stroke: line, 'stroke-width': lw * .7 }, hairG);
    if ((L.head === 'bun' || L.head === 'long') && L.hair) { sv('path', { d: `M${-R.hr + 2} -6 Q${-R.hr + 2} ${-R.hr - 6} 0 ${-R.hr - 4} Q${R.hr - 2} ${-R.hr - 6} ${R.hr - 2} -6 Q20 -40 ${-R.hr + 2} -6 Z`, fill: draw ? dk(L.hair) : L.hair === '#c4c0b8' ? '#a9a59d' : hc, stroke: line, 'stroke-width': lw * .8 }, hairG); if (L.head === 'bun') sv('circle', { cx: -26, cy: -R.hr - 14, r: 24, fill: draw ? dk(L.hair) : L.hair === '#c4c0b8' ? '#a9a59d' : hc, stroke: line, 'stroke-width': lw * .8 }, hairG); }
    if (L.head === 'bald' && L.hair) sv('path', { d: `M${-R.hr + 4} -4 Q${-R.hr} -30 ${-R.hr + 18} -40`, fill: 'none', stroke: draw ? dk(L.hair) : '#9a958c', 'stroke-width': 12, 'stroke-linecap': 'round' }, hairG);
    if (L.head === 'headcloth') { sv('path', { d: `M${-R.hr - 6} 0 Q${-R.hr - 10} ${-R.hr - 14} 2 ${-R.hr - 12} Q${R.hr + 8} ${-R.hr - 12} ${R.hr + 4} -4 L${R.hr - 4} -14 Q8 -40 ${-R.hr + 6} -12 Z`, fill: dk(L.cloth), stroke: line, 'stroke-width': lw * .9, 'stroke-linejoin': 'round' }, hairG); sv('path', { d: `M${-R.hr + 2} -26 Q4 -52 ${R.hr - 4} -22`, fill: 'none', stroke: dk(L.band), 'stroke-width': 10, 'stroke-linecap': 'round' }, hairG); }
    if (L.head === 'veil') sv('path', { d: `M${-R.hr - 4} 4 Q${-R.hr - 8} ${-R.hr - 14} 0 ${-R.hr - 12} Q${R.hr + 8} ${-R.hr - 14} ${R.hr + 4} 4 Q14 -36 ${-R.hr - 4} 4 Z`, fill: dk(L.cloth), stroke: line, 'stroke-width': lw * .9 }, hairG);
    if (L.head === 'crown') { sv('path', { d: `M-46 ${-R.hr + 8} L-46 ${-R.hr - 30} L-24 ${-R.hr - 10} L0 ${-R.hr - 38} L24 ${-R.hr - 10} L46 ${-R.hr - 30} L46 ${-R.hr + 8} Z`, fill: '#e3b341', stroke: line, 'stroke-width': lw * .8, 'stroke-linejoin': 'round' }, hairG); }
    if (L.head === 'helmet') { sv('path', { d: `M${-R.hr - 4} -6 Q${-R.hr} ${-R.hr - 10} 0 ${-R.hr - 8} Q${R.hr} ${-R.hr - 10} ${R.hr + 4} -6 Z`, fill: draw ? '#8e8b84' : '#b9b6ae', stroke: line, 'stroke-width': lw }, hairG); sv('path', { d: `M-6 ${-R.hr - 8} Q0 ${-R.hr - 46} 30 ${-R.hr - 40}`, fill: 'none', stroke: '#a8382f', 'stroke-width': 14, 'stroke-linecap': 'round' }, hairG); }
    // face (looks toward +x, slightly)
    const face = sv('g', {}, head);
    const eyeC = S.eye;
    // a beard follows the jaw, from the ear round the chin, and leaves the mouth free (a filled crescent under
    // the mouth read as a wide open mouth); a dark beard on stickman's black head is left out
    if (L.beard) {
      const bc = draw ? mute(L.beard, .3, '#8a7a66') : (L.beard === '#ededea' ? '#ededea' : null);
      if (bc) sv('path', { d: L.longBeard ? 'M-50 -2 Q-62 62 -8 100 Q16 116 36 94 Q62 62 58 14 L50 18 Q46 46 22 52 Q4 56 -14 46 Q-34 32 -38 -4 Z'
        : 'M-50 -2 Q-58 44 -18 72 Q16 92 48 60 Q62 40 58 14 L50 18 Q46 46 22 52 Q4 56 -14 46 Q-34 32 -38 -4 Z', fill: bc, stroke: line, 'stroke-width': lw * .7, 'stroke-linejoin': 'round' }, face);
      if (bc) sv('path', { d: 'M-2 22 Q12 16 28 22', fill: 'none', stroke: bc, 'stroke-width': 9, 'stroke-linecap': 'round' }, face);   // moustache
    }
    const eyes = [-8, 28].map(x => { const e = sv('g', { transform: `translate(${x} -6)` }, face); const ball = draw ? sv('circle', { r: 8, fill: eyeC }, e) : sv('rect', { x: -8, y: -11, width: 16, height: 22, rx: 8, fill: eyeC }, e); const lid = sv('rect', { x: -12, y: -16, width: 24, height: 0, fill: skin }, e); return { e, ball, lid }; });
    const brows = [-8, 28].map(x => sv('path', { fill: 'none', stroke: S.eye, 'stroke-width': draw ? 6 : 5, 'stroke-linecap': 'round' }, face));
    const mouthC = S.flat ? '#f4f2ec' : S.name === 'krijt' ? '#1d2622' : '#2b1714';
    const mouth = sv('path', { fill: mouthC, stroke: S.eye, 'stroke-width': draw ? 4 : 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, face);
    if (L.glasses) for (const x of [-8, 28]) sv('circle', { cx: x, cy: -6, r: 15, fill: 'none', stroke: S.eye, 'stroke-width': 4 }, face);
    const blinkAt = (() => { const r = rng(seed + 'blink'); return Array.from({ length: 60 }, (_, i) => i * 3.1 + r() * 2.2); })();
    const idle = wave(seed + 'idle'), gest = wave(seed + 'gest');
    // Standing in water (Alex, 24 Oct: Naaman "dipped himself in the Jordan" but bowed on the bank): base
    // 'wade' sinks the figure to the waist and hides what is under the water line; action 'dip' takes him
    // under and up again, with rings on the water.
    const WL = 28, cid = ('f2d-wade-' + seed).replace(/[^\w-]/g, '');
    const defsW = parent.ownerSVGElement?.querySelector('defs') || null;
    if (defsW) { const cp = sv('clipPath', { id: cid }, defsW); sv('rect', { x: -900, y: -3000, width: 1800, height: 3000 - WL }, cp); }
    const wake = sv('g', { visibility: 'hidden', 'data-nohaze': 1 }, g);
    const rings = [0, 1].map(i => sv('ellipse', { cx: 0, cy: -WL + 4, rx: 120, ry: 14, fill: 'none', stroke: '#ffffff', 'stroke-width': 5 - i * 1.5, opacity: 0, 'data-nohaze': 1 }, wake));

    // depth: the further away (smaller), the more the figure takes on the colour of the distance
    const hazeC = hexOf(P.far) || '#808080'; let hazeK = 0; let hazeEls = null;
    function haze(k) {
      if (k === hazeK) return; hazeK = k;
      if (!hazeEls) hazeEls = [...g.querySelectorAll('*')].filter(e => !e.hasAttribute('data-nohaze')).map(e => ({ e, f: hexOf(e.getAttribute('fill')), s: hexOf(e.getAttribute('stroke')) })).filter(o => o.f || o.s);
      for (const o of hazeEls) { if (o.f) o.e.setAttribute('fill', k ? mute(o.f, k, hazeC) : o.f); if (o.s) o.e.setAttribute('stroke', k ? mute(o.s, k, hazeC) : o.s); }
    }

    const pt = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l];
    let jit = () => 0;
    const seg3 = (a, b, c) => `M${r1(a[0] + jit())} ${r1(a[1] + jit())} L${r1(b[0] + jit())} ${r1(b[1] + jit())} L${r1(c[0] + jit())} ${r1(c[1] + jit())}`;
    const wS = draw ? 58 : 44, wH = draw ? 64 : 46;   // half widths of the shoulders and hips

    /** state: { x, y, s, dir, base, action, mood, talk, walk: {ph, amt, run}, holds, seat, t } */
    function update(st) {
      const t = st.t, act = st.action || 'idle', base = st.base || 'stand', mood = st.mood || 'neutraal';
      const lie = base === 'lie', ride = base === 'ride';
      if (st.boil) { const jr2 = rng(seed + 'b' + st.boil); jit = () => (jr2() - .5) * 4; } else jit = () => 0;
      let hipY = -R.hip, lean = 0, bob = 0, headTilt = 0, headY = 0, legDx = [-8, 8];
      let lh = [0.06, 0], rh = [-0.06, 0];          // [hip angle, knee bend]
      let la = [0.12, 0.15], ra = [-0.1, 0.15];      // [shoulder angle, elbow bend] (far arm "l", near arm "r")
      const breathe = Math.sin(t * 2.1) * 3;
      if (base === 'stand') { bob = breathe; lean = idle(t * .35) * .02; }
      if (base === 'walk') {
        const ph = st.walk.ph, k = st.walk.amt, run = st.walk.run ? 1.6 : 1;
        const sw = Math.sin(ph);
        lh = [sw * .42 * k * run, Math.max(0, Math.sin(ph + 1.9)) * .7 * k * run]; rh = [-sw * .42 * k * run, Math.max(0, Math.sin(ph + 1.9 + Math.PI)) * .7 * k * run];
        la = [-sw * .4 * k * run, .3 + (run > 1 ? 1 : 0)]; ra = [sw * .4 * k * run, .3 + (run > 1 ? 1 : 0)];
        bob = -Math.abs(Math.cos(ph)) * 8 * k; lean = .05 * k * run;
      }
      // sitting: thighs forward, shins down, hands in the lap
      if (base === 'sit') { hipY = -(st.seat ?? 95); lh = [1.5, 1.5]; rh = [1.4, 1.45]; la = [.62, .62]; ra = [.55, .7]; bob = breathe * .5; }
      // kneeling on one knee: the far knee on the ground with its shin behind, the near foot planted in front
      if (base === 'kneel') { hipY = -98; lh = [0.12, 1.66]; rh = [1.32, 1.36]; bob = breathe * .5; }
      // lying on the back: legs on the ground (one knee drawn up), one hand on the chest, the other along the side
      if (lie) { lh = [0.5, 1.02]; rh = [0.04, 0.08]; la = [0.6, 2.0]; ra = [-0.22, 0.12]; legDx = [-(wS - 14), -(wS - 20)]; bob = breathe * .4; }
      // riding the donkey: astride its back, legs hanging down its side, hands on the reins
      if (ride) { hipY = -212; lh = [0.62, 0.72]; rh = [0.55, 0.62]; la = [0.95, 0.95]; ra = [0.9, 0.9]; lean = .06; bob = st.walk ? -Math.abs(Math.sin(st.walk.ph)) * 6 * st.walk.amt : breathe * .3; }
      const kneel = base === 'kneel', wade = base === 'wade';
      if (wade) { bob = breathe * .4; la = [.55, .35]; ra = [-.5, .35]; }   // in the water: arms a little out
      // actions
      switch (act) {
        case 'read': case 'scroll': la = [0.95, 1.1]; ra = [0.85, 1.15]; headTilt = .28; break;
        case 'phone': ra = [0.55, 1.75]; headTilt = .26; break;
        case 'show-phone': ra = [1.45, 0.2]; break;
        case 'point': ra = [1.75, 0.1]; break;
        case 'wave': ra = [2.7, 0.35 + Math.sin(t * 9) * .35]; break;
        case 'think': ra = [0.35, 2.35]; headTilt = -.08; break;
        case 'pray': la = [0.55, 1.85]; ra = [0.6, 1.85]; headTilt = .3; break;
        case 'shrug': la = [0.35, 1.5]; ra = [0.3, 1.5]; headTilt = .12; break;
        case 'look-up': headTilt = -.42; break;
        case 'cheer': la = [2.75, 0.2]; ra = [2.85, 0.2]; headTilt = -.15; bob += Math.abs(Math.sin(t * 6)) * -10; break;
        case 'row': { const c = Math.sin(t * 3.2); la = [1.1 + c * .4, .5 - c * .3]; ra = [1.0 + c * .4, .5 - c * .3]; lean = .15 + c * .12; break; }
        case 'carry': la = [0.95, 0.75]; ra = [0.9, 0.8]; break;
        case 'fear': la = [0.7, 2.1]; ra = [0.75, 2.1]; bob += Math.sin(t * 30) * 2; break;
        case 'sleep': headTilt = .1; break;
        // bend over someone (lying or sitting) and tend to them: lean in, both hands down to them, slow work
        case 'help': { const w2 = Math.sin(t * 2.4) * .06; lean += kneel ? .3 : .42; la = [0.62 + w2, 0.42]; ra = [0.5 - w2, 0.36]; headTilt = .4; break; }
        // hold something out to someone (with 'holds': it is in the near hand)
        case 'give': ra = [1.32, 0.22]; la = [0.3, 0.45]; lean += .06; headTilt = .06; break;
        // arms around someone in front (stand close to them, facing them)
        case 'embrace': la = [1.5, 1.05]; ra = [1.38, 1.15]; lean += .12; headTilt = .14; break;
        // bow down: kneeling, the face to the ground and hands flat in front; standing, a deep bow
        case 'bow': lean += kneel ? 1.12 : .55; headTilt = .55; la = [1.35, 0.15]; ra = [1.25, 0.2]; break;
        // weep: hands over the face, head down, shoulders shaking a little
        case 'weep': la = [0.9, 2.3]; ra = [0.98, 2.35]; headTilt = .4; bob += Math.sin(t * 7) * 1.6; break;
        // raise both hands (praise, a blessing, Moses' hands over the battle)
        case 'raise': la = [1.78, 0.14]; ra = [2.24, 0.08]; headTilt = -.32; break;   // forward and up, clear of the head
        default: break;
      }
      if (st.talk > 0 && ['idle', 'talk', 'shrug'].includes(act) && !lie) { const g1 = gest(t * 1.3), g2 = gest(t * 1.1 + 7); ra = [0.35 + .35 * Math.max(0, g1), 0.9 + .4 * g2]; if (g2 > .1 && !ride) la = [0.2 + .25 * g2, 0.6]; }
      const moodLean = lie ? 0 : mood === 'verdrietig' ? .1 : mood === 'bang' ? -.04 : 0;
      lean += moodLean; headTilt += mood === 'verdrietig' && !lie ? .22 : 0;
      // joints (local, facing +x)
      const hip = [0, hipY + bob * .5], shoulder = [Math.sin(lean) * (R.sh - R.hip), hipY - (R.sh - R.hip) * Math.cos(lean) + bob];
      const legPts = ([a, kb], dx) => { const h = [hip[0] + dx, hip[1]]; const k = pt(h[0], h[1], a, R.thigh); const f = pt(k[0], k[1], a - kb, R.shin); return [h, k, f]; };
      const armPts = ([a, eb], dx) => { const s = [shoulder[0] + dx, shoulder[1] + 6]; const e = pt(s[0], s[1], a + lean * .6, R.upper); const h = pt(e[0], e[1], a + lean * .6 + eb, R.fore); return [s, e, h]; };
      const LB = legPts(lh, legDx[0]), LF = legPts(rh, legDx[1]), AB = armPts(la, -10), AF = armPts(ra, 10);
      legB.set(seg3(...LB)); legF.set(seg3(...LF)); armB.set(seg3(...AB)); armF.set(seg3(...AF));
      handB.setAttribute('cx', r1(AB[2][0])); handB.setAttribute('cy', r1(AB[2][1])); handF.setAttribute('cx', r1(AF[2][0])); handF.setAttribute('cy', r1(AF[2][1]));
      // torso: a bean from the shoulders to the hips (modern) or a robe (biblical) that drapes as the body is posed
      const sx = shoulder[0], sy = shoulder[1], hx = hip[0], hy = hip[1];
      const top0 = `M${r1(sx - wS)} ${r1(sy + 8)} Q${r1(sx)} ${r1(sy - 22)} ${r1(sx + wS)} ${r1(sy + 8)}`;
      if (robe) {
        let d, hd;
        if (base === 'sit' || ride) {
          // over the thighs to just past the knee; the shins come out below
          const K = LF[1], dn = ride ? 1 : 0;
          d = `${top0} L${r1(hx + wH * .8)} ${r1(hy - 30)} L${r1(K[0] + 10 - dn * 14)} ${r1(K[1] - 30 + dn * 6)} Q${r1(K[0] + 36)} ${r1(K[1] - 6)} ${r1(K[0] + 26)} ${r1(K[1] + 34)} L${r1(K[0] - 34)} ${r1(K[1] + 40)} Q${r1(hx - 10)} ${r1(hy + 44)} ${r1(hx - wH - 6)} ${r1(hy + 22)} Z`;
          hd = `M${r1(K[0] - 30)} ${r1(K[1] + 34)} L${r1(K[0] + 22)} ${r1(K[1] + 28)}`;
        } else if (kneel) {
          // over the raised front thigh to the knee and a little below it; behind, down to the knee on the ground
          const K = LF[1], Fb = LB[2];
          d = `${top0} L${r1(hx + wH * .8)} ${r1(hy - 26)} L${r1(K[0] + 4)} ${r1(K[1] - 30)} Q${r1(K[0] + 36)} ${r1(K[1] - 8)} ${r1(K[0] + 26)} ${r1(K[1] + 40)} L${r1(hx + 6)} ${r1(-2)} L${r1(Fb[0] - 6)} ${r1(-2)} Q${r1(hx - wH - 22)} ${r1(hy + 44)} ${r1(hx - wH - 4)} ${r1(hy - 6)} Z`;
          hd = `M${r1(K[0] + 22)} ${r1(K[1] + 34)} L${r1(hx + 8)} -8 L${r1(Fb[0])} -8`;
        } else if (lie) {
          // lying: the back stays flat on the ground (no flare behind), the front falls over the legs
          const by = hy + (L.short ? 70 : 128);
          d = `${top0} L${r1(hx + wH * .78)} ${r1(hy)} L${r1(hx + 6)} ${r1(by)} L${r1(hx - wS)} ${r1(by)} L${r1(hx - wS)} ${r1(hy)} Z`;
          hd = `M${r1(hx - wS + 6)} ${r1(by - 8)} L${r1(hx + 2)} ${r1(by - 8)}`;
        } else {
          const len = L.short ? 70 : 120; const flare = base === 'walk' ? Math.sin(st.walk.ph * 2) * 6 : 0;
          const by = hy + len;
          d = `${top0} L${r1(hx + wH + 18 + flare)} ${r1(by)} Q${r1(hx)} ${r1(by + 12)} ${r1(hx - wH - 18 + flare)} ${r1(by)} Z`;
          hd = `M${r1(hx - wH - 12 + flare)} ${r1(by - 8)} Q${r1(hx)} ${r1(by + 4)} ${r1(hx + wH + 12 + flare)} ${r1(by - 8)}`;
        }
        torso.setAttribute('d', d); hem.setAttribute('d', hd);
      } else {
        torso.setAttribute('d', `${top0} L${r1(hx + wH)} ${r1(hy + 6)} Q${r1(hx)} ${r1(hy + 20)} ${r1(hx - wH)} ${r1(hy + 6)} Z`);
      }
      // the donkey under a rider: legs walk when the rider travels, the tail and ears move
      ass.setAttribute('visibility', ride ? 'visible' : 'hidden');
      if (ride) {
        const ph = st.walk ? st.walk.ph * .9 : 0, amt = st.walk ? st.walk.amt : 0;
        assLegs.forEach((l, i) => { const a = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.2 : 0)) * .34 * amt; const kx = l.x + Math.sin(a) * 70, ky = -140 + Math.cos(a) * 70; const fx = kx + Math.sin(a * .5) * 70, fy = ky + Math.cos(a * .5) * 70;
          const dd = `M${l.x} -140 L${r1(kx)} ${r1(ky)} L${r1(fx)} ${r1(Math.min(0, fy))}`; l.n.setAttribute('d', dd); if (l.o) l.o.setAttribute('d', dd); });
        assTail.setAttribute('d', `M-118 -186 Q${r1(-150 + Math.sin(t * 2.2) * 8)} -150 ${r1(-146 + Math.sin(t * 2.2 + .6) * 14)} -96`);
        assHead.setAttribute('transform', `rotate(${r1(Math.sin(ph * 2) * 2.5 * amt + Math.sin(t * .8) * 1.2)} 110 -180)`);
      }
      // props in hand
      const handMid = [(AB[2][0] + AF[2][0]) / 2, (AB[2][1] + AF[2][1]) / 2];
      const show = (n, on, at, rot = 0) => { n.setAttribute('visibility', on ? 'visible' : 'hidden'); if (on) n.setAttribute('transform', `translate(${r1(at[0])} ${r1(at[1])}) rotate(${rot})`); };
      show(book, act === 'read', [handMid[0] + 6, handMid[1] - 10], -8);
      show(scrollP, act === 'scroll', [handMid[0] + 6, handMid[1] - 10], -6);
      show(phoneP, act === 'phone' || act === 'show-phone', [AF[2][0] + 4, AF[2][1] - 18], act === 'phone' ? -20 : 0);
      const item = st.holds || (act === 'carry' ? 'mand' : null);
      for (const [k, n] of Object.entries(held)) {
        const on = k === item && (act === 'carry' || act === 'give' || act === 'help' || (st.holds && ['idle', 'talk', 'point'].includes(act)));
        const at = act === 'carry' ? [handMid[0] + 8, handMid[1] - 8] : act === 'help' ? [AF[2][0] + 10, AF[2][1] + 4] : act === 'give' ? [AF[2][0] + 22, AF[2][1] - 6] : [AF[2][0] + 6, AF[2][1] + 14];
        show(n, on, at);
      }
      if (staff) { const hb = AB[2]; staff.setAttribute('d', `M${r1(hb[0] + 4)} ${r1(hb[1] - 90)} L${r1(hb[0] + 4)} ${r1(Math.min(0, hb[1] + 160))}`); staff.setAttribute('visibility', ['carry', 'read', 'scroll', 'pray', 'row', 'help', 'give', 'embrace', 'bow', 'weep', 'raise'].includes(act) || lie || ride || kneel || base === 'sit' ? 'hidden' : 'visible'); }
      // head: on the line of the spine (it follows a deep bow); lying, it rests on the ground
      const neck = R.head - R.sh;
      const hdx = shoulder[0] + Math.sin(lean) * neck + (lie ? R.hr - wS - 2 : 0), hdy = shoulder[1] - Math.cos(lean) * neck + headY;
      head.setAttribute('transform', `translate(${r1(hdx)} ${r1(hdy)}) rotate(${r1((headTilt + lean * .5) * 57)})`);
      // face: mood, blink, talking
      const blink = blinkAt.some(b => t >= b && t < b + .12) || act === 'sleep';
      const lidK = blink ? 1 : mood === 'nadenkend' || mood === 'verdrietig' ? (lie ? .7 : .35) : mood === 'boos' ? .3 : 0;
      eyes.forEach(({ ball, lid }) => { lid.setAttribute('height', r1(lidK * 26)); ball.setAttribute('transform', mood === 'verrast' || mood === 'bang' ? 'scale(1.25)' : ''); });
      const br = { neutraal: [0, 0], blij: [-.15, -2], verward: [.35, -4], nadenkend: [.25, 0], verrast: [-.2, -10], bang: [-.35, -8], verdrietig: [-.4, 0], boos: [.5, 2] }[mood] || [0, 0];
      brows.forEach(b => b.setAttribute('visibility', draw || ['boos', 'verrast', 'bang', 'verdrietig', 'verward'].includes(mood) ? 'visible' : 'hidden'));
      brows.forEach((b, i) => { const x = i ? 28 : -8, side = i ? 1 : -1; const tilt = br[0] * (i ? 1 : -1) * (mood === 'verward' && i ? -1 : 1); b.setAttribute('d', `M${x - 13} ${-28 + br[1] + tilt * 10 * side} L${x + 13} ${-28 + br[1] - tilt * 10 * side}`); });
      const open = cl(st.talk || 0) * 14;
      const smile = mood === 'blij' ? 10 : mood === 'verdrietig' || mood === 'bang' ? -8 : mood === 'boos' ? -5 : act === 'weep' ? -8 : 2;
      if (open > 1 || mood === 'verrast') { const o = Math.max(open, mood === 'verrast' ? 12 : 0); mouth.setAttribute('d', `M2 30 Q12 ${r1(30 - 3)} 22 30 Q12 ${r1(30 + o * 1.6)} 2 30 Z`); }
      else mouth.setAttribute('d', `M0 30 Q12 ${30 + smile} 24 30`);
      mouth.setAttribute('fill', open > 1 || mood === 'verrast' ? mouthC : 'none');
      // the shadow on the ground, sized to how the body meets it
      const sh = lie ? [-(R.head - R.hip) / 2 + 20, 250, 20] : ride ? [10, 160, 18] : base === 'sit' ? [40, 100, 15] : kneel ? [-10, 100, 15] : base === 'walk' ? [0, 66 + 8 * Math.abs(Math.sin(st.walk.ph)), 12] : [0, 74, 13];
      shadow.setAttribute('cx', sh[0]); shadow.setAttribute('rx', r1(sh[1])); shadow.setAttribute('ry', sh[2]);
      // place: lying, the pose turns flat with the back on the ground (head toward -x)
      let sink = 0;
      if (wade) {
        const ph = ((t + (seed.length % 5) * .37) % 2.8) / 2.8;
        const k = act === 'dip' ? (ph < .32 ? sm(ph / .32) : ph < .5 ? 1 : ph < .82 ? 1 - sm((ph - .5) / .32) : 0) : 0;
        sink = (R.hip - 18) + k * (R.head + R.hr + 60 - (R.hip - 18));
        const splash = act === 'dip' ? Math.max(0, 1 - Math.abs(ph - .41) / .2) : 0;   // rings when he goes under and comes up
        rings.forEach((e, i) => { e.setAttribute('rx', r1(100 + i * 50 + splash * 60)); e.setAttribute('ry', r1(12 + i * 4 + splash * 6)); e.setAttribute('opacity', r1(((.55 - i * .2) * (.4 + .6 * splash)) * 100) / 100); });
      }
      wake.setAttribute('visibility', wade ? 'visible' : 'hidden'); shadow.setAttribute('visibility', wade ? 'hidden' : 'visible');
      if (wade && defsW) dunk.setAttribute('clip-path', `url(#${cid})`); else dunk.removeAttribute('clip-path');
      pose.setAttribute('transform', lie ? `translate(0 ${R.hip - wS - (draw ? lw / 2 : 0)}) rotate(-90 0 ${-R.hip})` : wade ? `translate(0 ${r1(sink)})` : '');
      g.setAttribute('transform', `translate(${r1(st.x)} ${r1(st.y)}) scale(${r1(st.s * st.dir * 1000) / 1000} ${r1(st.s * 1000) / 1000})`);
      if (!S.poster) haze(Math.round(cl((.9 - st.s) / .5) * 5) / 10);
    }
    return { g, update, look: L };
  }

  /* ---------------- set pieces ---------------- */
  // every piece draws in world units; `st` = stroke attrs for the look (drawn: dark outline; stickman: none)
  const strokeOf = (S, P, w = 1) => S.drawn ? { stroke: S.ink || P.line, 'stroke-width': S.lw * w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } : {};
  const fillC = (S, c, k = .4) => S.drawn ? mute(c, k) : c;
  function hills(g, S, P, { x0 = -1200, x1 = 3400, y, amp = 60, freq = .004, seed = 1, fill, bottom = 3600, line = true }) {
    const f = wave(seed); let d = `M${x0} ${bottom} L${x0} ${y}`;
    for (let x = x0; x <= x1; x += 40) d += ` L${x} ${r1(y + f(x * freq) * amp)}`;
    d += ` L${x1} ${bottom} Z`;
    return sv('path', { d, fill, ...(line ? strokeOf(S, P, .8) : {}) }, g);
  }
  function sky(g, S, P, id) {
    const gr = sv('linearGradient', { id: `f2d-sky-${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, g.ownerSVGElement.querySelector('defs'));
    sv('stop', { offset: 0, 'stop-color': P.sky[0] }, gr); sv('stop', { offset: 1, 'stop-color': P.sky[1] }, gr);
    return sv('rect', { x: -3000, y: -2600, width: 9000, height: 4600, fill: `url(#f2d-sky-${id})` }, g);
  }
  function stars(g, n, seed, area = [-600, -320, 3200, 1260]) {
    const r = rng(seed); const list = [];
    for (let i = 0; i < n; i++) list.push({ c: sv('circle', { cx: r1(area[0] + r() * area[2]), cy: r1(area[1] + r() * area[3]), r: r1(1.4 + r() * 2.6), fill: '#f4f1e6' }, g), p: r() * 6.3, f: 1 + r() * 2 });
    return t => list.forEach(s => s.c.setAttribute('opacity', r1(.45 + .55 * (.5 + .5 * Math.sin(t * s.f + s.p)))));
  }
  /** A soft round light: a radial gradient per colour (currentColor in a gradient does not follow the user). */
  function glowId(svgRoot, color) {
    const id = 'f2d-glow-' + color.replace(/[^0-9a-z]/gi, ''); if (svgRoot.querySelector('#' + id)) return id;
    const rg = sv('radialGradient', { id }, svgRoot.querySelector('defs'));
    for (const [o, a] of [[0, 1], [.35, .35], [1, 0]]) sv('stop', { offset: o, 'stop-color': color, 'stop-opacity': a }, rg);
    return id;
  }
  function glowDot(g, x, y, r, color, op = .8) { return sv('circle', { cx: x, cy: y, r, fill: `url(#${glowId(g.ownerSVGElement, color)})`, opacity: op }, g); }
  function moon(g, S, P, x, y) { glowDot(g, x, y, 260, '#dfe7ff', S.flat ? .5 : .18); return sv('circle', { cx: x, cy: y, r: 62, fill: S.drawn ? '#d9d4c5' : '#eef2ff', ...strokeOf(S, P, .6) }, g); }
  function sun(g, S, x, y, c = '#ffd27a') { glowDot(g, x, y, 420, c, S.flat ? .75 : .35); return sv('circle', { cx: x, cy: y, r: 80, fill: S.drawn ? '#efc47a' : '#ffe29a' }, g); }
  function clouds(g, S, P, seed, n, y0, y1, color) {
    const r = rng(seed); const list = [];
    for (let i = 0; i < n; i++) {
      const x = -400 + r() * 2800, y = y0 + r() * (y1 - y0), s = .7 + r() * .8; const c = sv('g', {}, g);
      sv('path', { d: `M-140 0 Q-140 -50 -80 -54 Q-60 -110 0 -100 Q60 -130 100 -70 Q160 -70 160 0 Z`, fill: color, opacity: S.flat ? .85 : .9, ...strokeOf(S, P, .6) }, c);
      list.push({ c, x, y, s, v: 6 + r() * 10 });
    }
    return t => list.forEach(o => o.c.setAttribute('transform', `translate(${r1(o.x + o.v * t)} ${o.y}) scale(${o.s})`));
  }
  function palm(g, S, P, x, y, h = 360, seed = 1) {
    const r = rng('palm' + seed); const p = sv('g', { transform: `translate(${x} ${y})`, 'data-y': y }, g); const lean = (r() - .5) * 60;
    sv('path', { d: `M-12 0 Q${lean * .4} ${-h * .5} ${lean} ${-h} L${lean + 16} ${-h} Q${lean * .4 + 18} ${-h * .5} 12 0 Z`, fill: fillC(S, '#8a6a46'), ...strokeOf(S, P, .8) }, p);
    const top = sv('g', { transform: `translate(${lean + 8} ${-h})` }, p);
    for (let i = 0; i < 7; i++) { const a = -2.9 + i * .82 + (r() - .5) * .2, L = 120 + r() * 50; const ex = Math.cos(a) * L, ey = Math.sin(a) * L * .55 + 40;
      sv('path', { d: `M0 0 Q${r1(ex * .5)} ${r1(ey * .5 - 60)} ${r1(ex)} ${r1(ey)} Q${r1(ex * .45)} ${r1(ey * .5 - 20)} 0 8 Z`, fill: fillC(S, i % 2 ? '#4f8a3c' : '#5f9c44'), ...strokeOf(S, P, .6) }, top); }
    return { node: top, sway: t => top.setAttribute('transform', `translate(${lean + 8} ${-h}) rotate(${r1(Math.sin(t * .9 + seed) * 2.5)})`) };
  }
  function olive(g, S, P, x, y, s = 1, seed = 1) {
    const r = rng('olive' + seed); const p = sv('g', { transform: `translate(${x} ${y}) scale(${s})`, 'data-y': y }, g);
    sv('path', { d: 'M-16 0 Q-24 -80 -6 -140 L10 -140 Q24 -80 16 0 Z', fill: fillC(S, '#6e5536'), ...strokeOf(S, P, .8) }, p);
    for (const [cx, cy, rr] of [[-60, -170, 70], [40, -190, 80], [-10, -240, 76], [80, -140, 56], [-90, -130, 50]]) sv('circle', { cx: cx + (r() - .5) * 20, cy, r: rr, fill: fillC(S, '#7c9a4e'), ...strokeOf(S, P, .7) }, p);
    return p;
  }
  function rock(g, S, P, x, y, w = 120, h = 70) { return sv('path', { 'data-y': y, d: `M${x - w / 2} ${y} Q${x - w / 2 - 6} ${y - h * .7} ${x - w * .1} ${y - h} Q${x + w * .35} ${y - h * 1.05} ${x + w / 2} ${y - h * .3} L${x + w / 2 + 4} ${y} Z`, fill: fillC(S, '#9c958a', .3), ...strokeOf(S, P, .8) }, g); }
  function sheep(g, S, P, x, y, s = 1, seed = 1, dir = 1) {
    const p = sv('g', { transform: `translate(${x} ${y}) scale(${s * dir} ${s})`, 'data-y': y }, g); const wool = S.drawn ? '#e3ddcf' : '#f4f1ea', face = S.drawn ? '#3a3631' : '#1b1b1f';
    for (const lx of [-34, -14, 18, 36]) sv('path', { d: `M${lx} -20 L${lx} 0`, stroke: face, 'stroke-width': 9, 'stroke-linecap': 'round' }, p);
    const bodyG = sv('g', {}, p);
    for (const [cx, cy, rr] of [[-30, -50, 30], [0, -60, 34], [28, -50, 30], [0, -36, 34], [-24, -32, 24], [26, -32, 24]]) sv('circle', { cx, cy, r: rr, fill: wool, ...strokeOf(S, P, .55) }, bodyG);
    const headN = sv('ellipse', { cx: 58, cy: -56, rx: 20, ry: 25, fill: face }, p);
    return { p, headN, ph: rng('sheep' + seed)() * 6, update: t => headN.setAttribute('transform', `translate(0 ${r1(Math.max(0, Math.sin(t * .7 + seed)) * 26)})`) };
  }
  function fire(g, S, x, y, s = 1) {
    const p = sv('g', { transform: `translate(${x} ${y}) scale(${s})`, 'data-y': y }, g);
    glowDot(p, 0, -30, 260, '#ffb15a', S.flat ? .85 : .5);
    for (const a of [-.5, 0, .5]) sv('rect', { x: -60, y: -10, width: 120, height: 18, rx: 9, fill: '#5a3d26', transform: `rotate(${a * 30})` }, p);
    const fl = [sv('path', { fill: '#ff8a3a', 'data-dyn': 1 }, p), sv('path', { fill: '#ffd36a', 'data-dyn': 1 }, p)];
    return t => fl.forEach((f, i) => { const k = i ? .55 : 1, w = 34 * k, hgt = (90 + 18 * Math.sin(t * 9 + i * 2) + 10 * Math.sin(t * 13)) * k; const sw = 8 * Math.sin(t * 7 + i);
      f.setAttribute('d', `M${-w} 0 Q${-w - 4} ${r1(-hgt * .5)} ${r1(sw)} ${r1(-hgt)} Q${w + 4} ${r1(-hgt * .5)} ${w} 0 Z`); });
  }
  function tent(g, S, P, x, y, w = 360, h = 220, c = '#6b4f3a', c2 = '#8a6a4f') {
    const p = sv('g', { transform: `translate(${x} ${y})`, 'data-y': y }, g);
    sv('path', { d: `M${-w / 2} 0 L${-w * .32} ${-h} L${w * .32} ${-h} L${w / 2} 0 Z`, fill: fillC(S, c), ...strokeOf(S, P) }, p);
    for (let i = 1; i < 6; i++) sv('path', { d: `M${-w * .32 + i * w * .107} ${-h} L${-w / 2 + i * w / 6} 0`, stroke: fillC(S, c2), 'stroke-width': 10, fill: 'none' }, p);
    sv('path', { d: `M${-w * .12} 0 L${-w * .06} ${-h * .55} L${w * .06} ${-h * .55} L${w * .12} 0 Z`, fill: '#1c1512' }, p);
    return p;
  }
  function camel(g, S, P, x, y, s = 1, sitting = false, dir = 1) {
    const p = sv('g', { transform: `translate(${x} ${y}) scale(${s * dir} ${s})`, 'data-y': y }, g); const c = fillC(S, '#c49a62'), st = strokeOf(S, P, .8);
    if (!sitting) for (const lx of [-70, -40, 40, 70]) sv('path', { d: `M${lx} -110 L${lx + 4} 0`, stroke: S.drawn ? (S.ink || P.line) : c, 'stroke-width': 16, 'stroke-linecap': 'round' }, p);
    const by = sitting ? -40 : -120;
    sv('path', { d: `M-110 ${by} Q-120 ${by - 60} -60 ${by - 70} Q-30 ${by - 130} 0 ${by - 70} Q30 ${by - 120} 60 ${by - 70} Q110 ${by - 60} 100 ${by} Z`, fill: c, ...st }, p);
    sv('path', { d: `M90 ${by - 20} Q140 ${by - 60} 140 ${by - 120} L175 ${by - 130} Q190 ${by - 120} 175 ${by - 105} L160 ${by - 100} Q160 ${by - 40} 110 ${by} Z`, fill: c, ...st }, p);
    sv('path', { d: `M-40 ${by - 75} L40 ${by - 75} L36 ${by - 40} L-36 ${by - 40} Z`, fill: fillC(S, '#a8432f'), ...st }, p);
    return p;
  }
  function house(g, S, P, x, y, w, h, c = '#d9c19a', lit = false) {
    const p = sv('g', { transform: `translate(${x} ${y})`, 'data-y': y }, g);
    sv('rect', { x: -w / 2, y: -h, width: w, height: h, fill: fillC(S, c, .35), ...strokeOf(S, P) }, p);
    sv('rect', { x: -w / 2 - 10, y: -h - 16, width: w + 20, height: 18, fill: fillC(S, shade(c, -.15), .35), ...strokeOf(S, P, .8) }, p);
    sv('path', { d: `M${-w * .12} 0 L${-w * .12} ${-h * .45} Q0 ${-h * .55} ${w * .12} ${-h * .45} L${w * .12} 0 Z`, fill: fillC(S, '#6b4a33'), ...strokeOf(S, P, .7) }, p);
    for (const wx of [-w * .3, w * .3]) sv('rect', { x: wx - 18, y: -h * .78, width: 36, height: 42, rx: 4, fill: lit ? (S.flat ? '#ffcf7a' : '#e9b866') : fillC(S, '#3b2e24'), ...strokeOf(S, P, .6) }, p);
    return p;
  }
  function waterBody(g, S, P, d, c) { return sv('path', { d, fill: c, ...strokeOf(S, P, .7) }, g); }

  /* ---------------- sets ---------------- */
  // spot: { x, y, s (scale for distance), dir, base, seat }; wide: { cx } camera centre for empty shots
  const GY = 1380;
  const SETS2D = {
    heuvels: {
      spots: {
        heuvel: { x: 640, y: 1040, s: .62, dir: 1 }, 'pad-ver': { x: 930, y: 1020, s: .5, dir: 1 }, 'pad-boven': { x: 1020, y: 1190, s: .78, dir: 1 },
        pad: { x: 1110, y: GY, s: 1, dir: -1 }, 'pad-dichtbij': { x: 1230, y: 1470, s: 1.15, dir: -1 },
        berm: { x: 880, y: GY + 14, s: 1, dir: -1, base: 'lie' }, 'berm-naast': { x: 1250, y: GY + 4, s: 1, dir: -1, base: 'kneel' },
        veld: { x: 850, y: GY + 6, s: 1, dir: 1 },   // in the open, facing 'pad': far enough apart to talk, give or bow
        kudde: { x: 470, y: 1330, s: .95, dir: 1 }, boom: { x: 1500, y: 1330, s: .95, dir: -1, base: 'sit', seat: 70 }, rots: { x: 300, y: 1410, s: 1.02, dir: 1, base: 'sit', seat: 80 }, beek: { x: 1640, y: 1430, s: 1.05, dir: -1 }, 'in-beek': { x: 1480, y: 1592, s: 1.08, dir: -1, base: 'wade' },
      },
      cx: 1000,
      build(g, S, P, { time, seed }) {
        const L = layersOf(g); const ups = [];
        sky(L.sky, S, P, 'h' + time);
        if (time === 'nacht') { ups.push(stars(L.sky, 140, seed)); moon(L.sky, S, P, 1500, 380); } else if (time === 'avond') sun(L.sky, S, 1450, 980, '#ff9a5a'); else sun(L.sky, S, 1550, 300);
        if (time !== 'nacht') ups.push(clouds(L.sky, S, P, seed, 5, 250, 650, time === 'avond' ? (S.flat ? '#f6b08a' : '#6a4440') : (S.flat ? '#ffffff' : '#e7e2d6')));
        hills(L.far, S, P, { y: 980, amp: 90, freq: .0025, seed: seed + 'f', fill: P.far });
        // the hill with the path, the far town
        const town = sv('g', { transform: 'translate(330 905) scale(.35)' }, L.far); for (let i = 0; i < 7; i++) house(town, S, P, i * 150 - 450, (i % 2) * 20, 130, 90 + (i % 3) * 30, '#e3d2b0', time === 'nacht');
        hills(L.mid, S, P, { y: 1130, amp: 70, freq: .004, seed: seed + 'm', fill: P.mid });
        sv('path', { d: 'M260 1300 Q640 960 1020 1300 Z', fill: shade(P.mid, -.05), ...strokeOf(S, P, .8) }, L.mid);
        olive(L.mid, S, P, 200, 1200, .7, 2); olive(L.mid, S, P, 1700, 1180, .65, 3);
        hills(L.main, S, P, { y: 1290, amp: 30, freq: .006, seed: seed + 'g', fill: P.ground });
        // the path: from the hill top down toward the camera
        sv('path', { d: 'M905 1030 Q960 1100 990 1190 Q1060 1300 1110 1385 Q1180 1480 1300 1700 L1420 1700 Q1260 1470 1170 1380 Q1090 1290 1030 1190 Q990 1100 950 1030 Z', fill: S.drawn ? mute('#c4ab7c', .5) : '#d9be8c', opacity: .9 }, L.main);
        // stream in front
        const sy = 1520; sv('path', { d: `M-400 ${sy} Q300 ${sy - 40} 900 ${sy + 10} Q1500 ${sy + 50} 2600 ${sy} L2600 ${sy + 70} Q1500 ${sy + 120} 900 ${sy + 80} Q300 ${sy + 40} -400 ${sy + 70} Z`, fill: S.drawn ? mute('#5d8fa8', .45) : '#5fb0d8', ...strokeOf(S, P, .6) }, L.main);
        olive(L.main, S, P, 1560, 1330, 1.05, 1);
        rock(L.main, S, P, 300, 1410, 150, 80);
        const flock = []; const rr = rng(seed + 'sheep');
        for (const [x, y, s] of [[350, 1290, .8], [420, 1340, .9], [540, 1300, .82], [600, 1350, .92], [700, 1310, .8], [250, 1340, .88]]) flock.push(sheep(L.main, S, P, x + (rr() - .5) * 20, y, s, x, rr() < .5 ? 1 : -1));
        ups.push(t => flock.forEach(f => f.update(t)));
        if (time === 'nacht') ups.push(fire(L.main, S, 760, 1450, .8));
        return t => ups.forEach(u => u(t));
      },
    },
    woestijn: {
      spots: {
        tent: { x: 520, y: 1350, s: .95, dir: 1 }, midden: { x: 900, y: GY, s: 1, dir: 1 }, links: { x: 700, y: 1400, s: 1.02, dir: 1 }, rechts: { x: 1180, y: 1390, s: 1.01, dir: -1 },
        kampvuur: { x: 790, y: 1440, s: 1.05, dir: 1, base: 'sit', seat: 60 }, verte: { x: 1300, y: 1050, s: .42, dir: -1 },
        bron: { x: 1640, y: 1390, s: 1, dir: 1 }, 'bron-2': { x: 1500, y: 1360, s: .98, dir: 1 },
        'bron-3': { x: 1400, y: 1394, s: 1.01, dir: -1 },   // by the well, facing 'rechts' (giving water to someone there)
      },
      cx: 950,
      build(g, S, P, { time, seed }) {
        const L = layersOf(g); const ups = [];
        const sand = { dag: '#e2b878', avond: '#b9724c', nacht: '#2f2b46' }[time]; const sand2 = shade(sand, -.12);
        sky(L.sky, S, P, 'w' + time);
        if (time === 'nacht') { ups.push(stars(L.sky, 180, seed)); moon(L.sky, S, P, 380, 420); } else if (time === 'avond') sun(L.sky, S, 1250, 990, '#ff8a4a'); else sun(L.sky, S, 400, 320, '#fff0b0');
        hills(L.far, S, P, { y: 1010, amp: 50, freq: .002, seed: seed + 'f', fill: S.drawn ? mute(shade(sand, -.2), .5) : shade(sand, -.25) });
        hills(L.mid, S, P, { y: 1090, amp: 60, freq: .0035, seed: seed + 'm', fill: S.drawn ? mute(sand2, .45) : sand2 });
        hills(L.main, S, P, { y: 1290, amp: 24, freq: .005, seed: seed + 'g', fill: S.drawn ? mute(sand, .45) : sand });
        tent(L.mid, S, P, 1450, 1150, 260, 150, '#4a3b31', '#6b5847');
        tent(L.main, S, P, 430, 1330, 360, 220);
        camel(L.main, S, P, 1280, 1310, .75, true, -1); camel(L.mid, S, P, 260, 1160, .55, false, 1);
        // the spring among the palms
        waterBody(L.main, S, P, 'M1590 1420 Q1700 1380 1880 1395 Q1990 1410 1960 1450 Q1800 1480 1640 1462 Q1560 1450 1590 1420 Z', S.drawn ? mute('#4f8fa8', .45) : '#4fb0d0');
        const palms = [palm(L.main, S, P, 1760, 1380, 380, 1), palm(L.main, S, P, 1930, 1400, 330, 2), palm(L.mid, S, P, 1620, 1120, 260, 3), palm(L.mid, S, P, 120, 1140, 280, 4)];
        ups.push(t => palms.forEach(p => p.sway(t)));
        ups.push(fire(L.main, S, 960, 1460, .9));
        for (const [x, y] of [[620, 1360], [1080, 1330]]) sv('ellipse', { 'data-y': y + 34, cx: x, cy: y, rx: 26, ry: 34, fill: fillC(S, '#b9714a'), ...strokeOf(S, P, .6) }, L.main);   // jars
        return t => ups.forEach(u => u(t));
      },
    },
    stad: {
      spots: {
        poort: { x: 1000, y: 1120, s: .55, dir: 1 }, straat: { x: 940, y: 1250, s: .8, dir: 1 }, plein: { x: 860, y: GY, s: 1, dir: 1 }, markt: { x: 1300, y: 1400, s: 1.02, dir: -1 },
        trap: { x: 560, y: 1150, s: .9, dir: 1 }, muur: { x: 1520, y: 905, s: .55, dir: -1 },
      },
      cx: 980,
      build(g, S, P, { time, seed }) {
        const L = layersOf(g); const ups = []; const lit = time !== 'dag';
        sky(L.sky, S, P, 's' + time);
        if (time === 'nacht') { ups.push(stars(L.sky, 120, seed)); moon(L.sky, S, P, 380, 360); } else if (time === 'avond') sun(L.sky, S, 1000, 960, '#ff9a5a'); else sun(L.sky, S, 1550, 300);
        if (time === 'dag') ups.push(clouds(L.sky, S, P, seed, 4, 260, 600, S.flat ? '#ffffff' : '#e7e2d6'));
        const stone = '#d8c19a';
        // far: the city wall with a gate and towers at the end of the street
        const wallC = fillC(S, shade(stone, -.08), .35);
        sv('rect', { x: -400, y: 980, width: 3000, height: 160, fill: wallC, ...strokeOf(S, P) }, L.far);
        for (let x = -400; x < 2600; x += 60) sv('rect', { x, y: 952, width: 34, height: 30, fill: wallC, ...strokeOf(S, P, .6) }, L.far);
        for (const tx of [860, 1140, 1460]) { sv('rect', { x: tx - 70, y: 860, width: 140, height: 280, fill: fillC(S, shade(stone, -.15), .35), ...strokeOf(S, P) }, L.far); for (let i = 0; i < 4; i++) sv('rect', { x: tx - 70 + i * 40, y: 834, width: 24, height: 28, fill: fillC(S, shade(stone, -.15), .35), ...strokeOf(S, P, .6) }, L.far); }
        sv('path', { d: 'M940 1140 L940 1020 Q1000 960 1060 1020 L1060 1140 Z', fill: lit ? (S.flat ? '#ffb866' : '#5a3a2a') : fillC(S, '#4a3426'), ...strokeOf(S, P, .8) }, L.far);
        // mid: houses on both sides of the street, a stair up to a roof
        for (const [x, w, h, c] of [[160, 300, 340, '#e6d3b0'], [470, 260, 420, '#d9c39c'], [1480, 280, 380, '#e2cfa8'], [1800, 320, 330, '#d4bd94']]) house(L.mid, S, P, x, 1250, w, h, c, lit);
        for (let i = 0; i < 6; i++) sv('rect', { x: 560 + i * 22, y: 1250 - (i + 1) * 30, width: 60, height: 30, fill: fillC(S, '#c9b28a', .35), ...strokeOf(S, P, .6) }, L.mid);
        sv('path', { d: 'M-400 1250 L2600 1250 L2600 3600 L-400 3600 Z', fill: fillC(S, '#cdb48a', .45), ...strokeOf(S, P, .8) }, L.main);
        sv('path', { d: 'M960 1140 L1040 1140 L1400 1700 L600 1700 Z', fill: fillC(S, '#bfa57c', .45), opacity: .7 }, L.main);
        // market stall and a well in front
        const stall = sv('g', { transform: 'translate(1420 1400)', 'data-y': 1400 }, L.main);
        sv('rect', { x: -110, y: -120, width: 220, height: 90, fill: fillC(S, '#8a6a46'), ...strokeOf(S, P) }, stall);
        for (let i = 0; i < 5; i++) sv('path', { d: `M${-130 + i * 52} -220 L${-78 + i * 52} -220 L${-78 + i * 52} -180 L${-130 + i * 52} -180 Z`, fill: i % 2 ? '#f4ede0' : fillC(S, '#c0392b'), ...strokeOf(S, P, .6) }, stall);
        for (const x of [-100, 100]) sv('path', { d: `M${x} -180 L${x} 0`, stroke: S.drawn ? (S.ink || P.line) : '#6b4a33', 'stroke-width': 10 }, stall);
        for (const [x, c] of [[-60, '#e67e22'], [-20, '#c0392b'], [30, '#f1c40f'], [70, '#27ae60']]) sv('circle', { cx: x, cy: -132, r: 18, fill: fillC(S, c), ...strokeOf(S, P, .5) }, stall);
        const well = sv('g', { transform: 'translate(560 1430)', 'data-y': 1430 }, L.main); sv('path', { d: 'M-70 0 L-70 -70 L70 -70 L70 0 Z', fill: fillC(S, '#a99677', .35), ...strokeOf(S, P) }, well);
        palm(L.mid, S, P, 760, 1250, 300, 5); const pl = palm(L.main, S, P, 140, 1500, 420, 6); ups.push(t => pl.sway(t));
        if (lit) for (const x of [700, 1260]) glowDot(L.main, x, 1180, 160, '#ffb35a', S.flat ? .7 : .35);
        return t => ups.forEach(u => u(t));
      },
    },
    zee: {
      spots: {
        boeg: { x: 1330, y: 1270, s: .95, dir: 1 }, mast: { x: 930, y: 1300, s: .95, dir: 1 }, achtersteven: { x: 560, y: 1250, s: .95, dir: 1 }, reling: { x: 1150, y: 1300, s: .95, dir: 1 },
        dek: { x: 780, y: 1300, s: .95, dir: 1 }, ruim: { x: 980, y: 1448, s: .58, dir: 1, base: 'lie' }, 'ruim-staan': { x: 1120, y: 1448, s: .3, dir: -1 },
      },
      cx: 950,
      build(g, S, P, { time, weather, seed }) {
        const L = layersOf(g); const ups = []; const storm = weather === 'storm';
        sky(L.sky, S, P, 'z' + time + weather);
        if (storm) { sv('rect', { x: -3000, y: -2600, width: 9000, height: 4600, fill: S.drawn ? '#141519' : '#121a33', opacity: .65 }, L.sky); }
        if (time === 'nacht' && !storm) { ups.push(stars(L.sky, 150, seed)); moon(L.sky, S, P, 1500, 420); } else if (!storm && time === 'avond') sun(L.sky, S, 1450, 1000, '#ff9a5a'); else if (!storm) sun(L.sky, S, 400, 320);
        ups.push(clouds(L.sky, S, P, seed, storm ? 9 : 4, 150, 700, storm ? (S.flat ? '#2a3354' : '#26272c') : time === 'avond' ? '#f6b08a' : '#ffffff'));
        const sea = { dag: '#3f8fc4', avond: '#5a4a78', nacht: '#16224a' }[time], sea2 = shade(sea, -.2);
        const seaC = S.drawn ? mute(sea, .5) : sea, seaC2 = S.drawn ? mute(sea2, .5) : sea2;
        // a row of waves; in a storm with white foam on the crests
        const waveRow = (layer, y, amp, c, sp, ph) => { const p = sv('path', { fill: c, ...strokeOf(S, P, .6), 'data-dyn': 1 }, layer);
          const foam = storm ? sv('path', { fill: 'none', stroke: S.drawn ? '#d8d4c8' : '#e8f1ff', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': '38 46', opacity: .55, 'data-dyn': 1 }, layer) : null;
          return t => { let crest = ''; for (let x = -600; x <= 2700; x += 50) crest += ` L${x} ${r1(y + Math.sin(x * .012 + t * sp + ph) * amp + Math.sin(x * .031 - t * sp * 1.3) * amp * .35)}`;
            p.setAttribute('d', `M-600 3600 L-600 ${y}${crest} L2700 3600 Z`); if (foam) { foam.setAttribute('d', 'M' + crest.slice(2)); foam.setAttribute('stroke-dashoffset', r1(-t * 90)); } }; };
        ups.push(waveRow(L.far, 1180, storm ? 26 : 8, seaC2, storm ? 1.6 : .7, 1));
        // the ship (side view, a cut-away hold below deck)
        const shipG = sv('g', {}, L.main);
        const hull = 'M380 1280 L1460 1280 Q1430 1500 1260 1560 L600 1560 Q440 1500 380 1280 Z';
        sv('path', { d: hull, fill: fillC(S, '#8a5a33'), ...strokeOf(S, P) }, shipG);
        sv('path', { d: 'M560 1318 L1300 1318 L1284 1450 L590 1450 Z', fill: fillC(S, '#3a2a1e'), ...strokeOf(S, P, .7) }, shipG);   // the hold
        for (let x = 420; x < 1440; x += 80) sv('path', { d: `M${x} 1300 L${x + 30} 1300`, stroke: S.drawn ? (S.ink || P.line) : '#5b3a20', 'stroke-width': 6 }, shipG);
        sv('rect', { x: 920, y: 520, width: 22, height: 770, fill: fillC(S, '#6e4f33'), ...strokeOf(S, P, .8) }, shipG);
        const sail = sv('path', { fill: S.drawn ? mute('#e9e2cf', .3) : '#f2ece0', ...strokeOf(S, P), 'data-dyn': 1 }, shipG);
        const stripes = [0, 1, 2].map(i => sv('path', { fill: fillC(S, '#c0392b'), opacity: .9, 'data-dyn': 1 }, shipG));
        sv('path', { d: 'M380 1280 Q300 1180 340 1120', fill: 'none', stroke: S.drawn ? (S.ink || P.line) : '#6e4f33', 'stroke-width': 16, 'stroke-linecap': 'round' }, shipG);
        sv('path', { d: 'M1460 1280 Q1560 1200 1520 1120', fill: 'none', stroke: S.drawn ? (S.ink || P.line) : '#6e4f33', 'stroke-width': 16, 'stroke-linecap': 'round' }, shipG);
        for (const [x1, x2] of [[930, 420], [940, 1450]]) sv('path', { d: `M${x1} 540 L${x2} 1280`, stroke: S.drawn ? (S.ink || P.line) : '#3a2a1e', 'stroke-width': 3, fill: 'none' }, shipG);
        ups.push(t => { const bil = storm ? Math.sin(t * 1.3) * 22 : Math.sin(t * .8) * 6; const sw = storm ? 40 : 14; sail.setAttribute('d', `M950 560 Q${r1(1180 + sw * Math.sin(t * 2))} 760 950 ${r1(1060 + bil * .2)} Z`);
          stripes.forEach((s, i) => { const y0 = 620 + i * 140; s.setAttribute('d', `M950 ${y0} Q${r1(1100 + sw * .7 * Math.sin(t * 2))} ${y0 + 50} 950 ${y0 + 80} Z`); });
          // the ship and everyone on it pitch with the waves (hard in a storm)
          L.main.setAttribute('transform', storm ? `rotate(${r1(bil * .12)} 950 1420) translate(0 ${r1(bil * .5)})` : `translate(0 ${r1(bil * .6)})`); });
        ups.push(waveRow(L.front, 1500, storm ? 40 : 12, seaC, storm ? 2 : .9, 3));
        if (storm) {
          const rain = sv('g', { 'data-dyn': 1 }, L.front); const rr = rng(seed + 'rain'); const drops = Array.from({ length: 140 }, () => ({ x: -200 + rr() * 2400, y: rr() * 2400, l: 40 + rr() * 40, n: sv('path', { stroke: S.drawn ? '#8a8f99' : '#b8c9ff', 'stroke-width': 3, opacity: .55 }, rain) }));
          const flash = sv('rect', { x: -3000, y: -2600, width: 9000, height: 6000, fill: '#e8eeff', opacity: 0, 'data-dyn': 1, 'data-keep': 1 }, L.front);
          ups.push(t => { drops.forEach(d => { const y = ((d.y + t * 1400) % 2400) - 400, x = d.x - t * 260 % 2400; d.n.setAttribute('d', `M${r1(x)} ${r1(y)} l-14 ${d.l}`); }); const f = [3.2, 7.9, 12.4, 17.1, 23.8].reduce((m, a) => Math.max(m, t > a && t < a + .5 ? (1 - (t - a) / .5) * (Math.sin((t - a) * 40) > 0 ? 1 : .4) : 0), 0); flash.setAttribute('opacity', r1(f * .5 * 100) / 100); });
        }
        return t => ups.forEach(u => u(t));
      },
    },
    slaapkamer: {
      spots: { bed: { x: 430, y: 1360, s: 1, dir: 1, base: 'sit', seat: 105 }, 'bed-liggen': { x: 420, y: 1262, s: 1, dir: 1, base: 'lie' }, bureau: { x: 900, y: 1370, s: 1, dir: 1, base: 'sit', seat: 100 }, midden: { x: 680, y: GY, s: 1, dir: 1 }, deur: { x: 1150, y: GY, s: 1, dir: -1 }, raam: { x: 560, y: 1370, s: .98, dir: 1 } },
      cx: 700,
      build(g, S, P, { time }) {
        const L = layersOf(g); const night = time !== 'dag';
        const wall = S.drawn ? (night ? '#1c1c20' : '#cfc8b8') : (night ? '#232a4a' : '#e9e2d3'), floor = S.drawn ? (night ? '#26262b' : '#a38d70') : (night ? '#1a1f38' : '#b58b62');
        sv('rect', { x: -1000, y: -2600, width: 4000, height: 3980, fill: wall }, L.sky);
        sv('rect', { x: -1000, y: 1380, width: 4000, height: 2400, fill: floor, ...strokeOf(S, P, .8) }, L.main);
        // window with the moon or the sun
        const win = sv('g', { transform: 'translate(560 820)' }, L.mid);
        sv('rect', { x: -150, y: -180, width: 300, height: 340, fill: night ? (S.flat ? '#1b2a5c' : '#141418') : '#bfe0f5', ...strokeOf(S, P) }, win);
        if (night) { sv('circle', { cx: 50, cy: -80, r: 34, fill: '#e9e6da' }, win); for (const [x, y] of [[-90, -120], [-40, 40], [100, 60], [-100, 100]]) sv('circle', { cx: x, cy: y, r: 3, fill: '#e9e6da' }, win); }
        sv('path', { d: 'M0 -180 L0 160 M-150 -10 L150 -10', stroke: S.drawn ? (S.ink || P.line) : '#f4efe4', 'stroke-width': 10 }, win);
        if (night) glowDot(L.mid, 560, 820, 300, '#9fb8ff', S.flat ? .35 : .12);
        // bed with a blanket, a nightstand with a clock
        const bed = sv('g', { transform: 'translate(380 1380)' }, L.main);
        sv('rect', { x: -260, y: -260, width: 30, height: 260, rx: 10, fill: fillC(S, '#5a4636'), ...strokeOf(S, P) }, bed);
        sv('rect', { x: -250, y: -120, width: 470, height: 90, rx: 18, fill: fillC(S, '#e8e1d2', .3), ...strokeOf(S, P) }, bed);
        sv('rect', { x: -230, y: -165, width: 120, height: 50, rx: 22, fill: fillC(S, '#f1ece2', .3), ...strokeOf(S, P, .8) }, bed);
        sv('path', { d: 'M-80 -150 Q60 -176 224 -140 L232 -36 L-84 -36 Z', fill: fillC(S, '#4f6f9a'), ...strokeOf(S, P), transform: 'translate(380 1380)', 'data-y': 1290 }, L.main);   // the blanket: over whoever lies in the bed
        const ns = sv('g', { transform: 'translate(-20 1380)' }, L.main); sv('rect', { x: -70, y: -150, width: 140, height: 150, rx: 8, fill: fillC(S, '#4a3a2e'), ...strokeOf(S, P) }, ns);
        sv('rect', { x: -50, y: -200, width: 100, height: 50, rx: 10, fill: '#141416', ...strokeOf(S, P, .7) }, ns);
        sv('text', { x: 0, y: -165, 'text-anchor': 'middle', 'font-family': 'Inter', 'font-weight': 700, 'font-size': 30, fill: '#e04848' }, ns).textContent = '6:30';
        // desk with a lamp and a Bible
        const desk = sv('g', { transform: 'translate(1000 1380)' }, L.main);
        sv('rect', { x: -170, y: -190, width: 340, height: 24, fill: fillC(S, '#6b5038'), ...strokeOf(S, P) }, desk);
        for (const x of [-150, 150]) sv('rect', { x: x - 10, y: -170, width: 20, height: 170, fill: fillC(S, '#6b5038'), ...strokeOf(S, P, .7) }, desk);
        sv('path', { d: 'M100 -190 L110 -300 L60 -330', fill: 'none', stroke: S.drawn ? (S.ink || P.line) : '#333', 'stroke-width': 8 }, desk);
        sv('path', { d: 'M20 -340 L100 -340 L80 -300 L40 -300 Z', fill: fillC(S, '#e3b341'), ...strokeOf(S, P, .7) }, desk);
        if (night) glowDot(L.main, 1060, 1110, 260, '#ffcf7a', S.flat ? .7 : .4);
        sv('rect', { x: -60, y: -210, width: 80, height: 20, rx: 3, fill: fillC(S, '#6a3a35'), ...strokeOf(S, P, .6) }, desk);
        const chair = sv('g', { transform: 'translate(880 1380)' }, L.main); sv('rect', { x: -60, y: -100, width: 120, height: 16, fill: fillC(S, '#7a5a40'), ...strokeOf(S, P, .7) }, chair); sv('rect', { x: -60, y: -240, width: 16, height: 240, fill: fillC(S, '#7a5a40'), ...strokeOf(S, P, .7) }, chair);
        // a door on the right, a frame on the wall
        sv('rect', { x: 1110, y: 920, width: 190, height: 460, fill: fillC(S, '#6b5038'), ...strokeOf(S, P) }, L.mid);
        sv('rect', { x: 180, y: 760, width: 150, height: 110, fill: fillC(S, '#9cb7a4'), ...strokeOf(S, P) }, L.mid);
        return () => {};
      },
    },
    woonkamer: {
      spots: { 'bank-links': { x: 560, y: 1360, s: 1, dir: 1, base: 'sit', seat: 100 }, 'bank-rechts': { x: 760, y: 1360, s: 1, dir: -1, base: 'sit', seat: 100 }, stoel: { x: 1100, y: 1370, s: 1, dir: -1, base: 'sit', seat: 100 }, midden: { x: 860, y: GY, s: 1, dir: 1 }, deur: { x: 1300, y: GY, s: 1, dir: -1 }, raam: { x: 300, y: GY, s: 1, dir: 1 } },
      cx: 800,
      build(g, S, P, { time }) {
        const L = layersOf(g); const night = time === 'nacht', eve = time === 'avond';
        const wall = S.drawn ? (night || eve ? '#22201f' : '#cfc8b8') : (night || eve ? '#2c2a44' : '#efe6d6'), floor = S.drawn ? (night || eve ? '#2a2826' : '#a38d70') : (night || eve ? '#2a2238' : '#c79c6c');
        sv('rect', { x: -1000, y: -2600, width: 4000, height: 3980, fill: wall }, L.sky);
        sv('rect', { x: -1000, y: 1380, width: 4000, height: 2400, fill: floor, ...strokeOf(S, P, .8) }, L.main);
        const win = sv('g', { transform: 'translate(300 840)' }, L.mid); sv('rect', { x: -150, y: -170, width: 300, height: 320, fill: night ? '#141832' : eve ? '#f2a46a' : '#bfe0f5', ...strokeOf(S, P) }, win); sv('path', { d: 'M0 -170 L0 150 M-150 -10 L150 -10', stroke: S.drawn ? (S.ink || P.line) : '#f4efe4', 'stroke-width': 10 }, win);
        const sofa = sv('g', { transform: 'translate(660 1380)' }, L.main);
        sv('rect', { x: -230, y: -260, width: 460, height: 150, rx: 30, fill: fillC(S, '#5d8a87'), ...strokeOf(S, P) }, sofa);
        sv('rect', { x: -250, y: -130, width: 500, height: 110, rx: 26, fill: fillC(S, '#4f7774'), ...strokeOf(S, P) }, sofa);
        for (const x of [-250, 210]) sv('rect', { x, y: -180, width: 40, height: 160, rx: 18, fill: fillC(S, '#4a6f6c'), ...strokeOf(S, P) }, sofa);
        const arm = sv('g', { transform: 'translate(1110 1380)' }, L.main); sv('rect', { x: -110, y: -240, width: 220, height: 140, rx: 30, fill: fillC(S, '#c96f4a'), ...strokeOf(S, P) }, arm); sv('rect', { x: -120, y: -130, width: 240, height: 110, rx: 24, fill: fillC(S, '#b5603e'), ...strokeOf(S, P) }, arm);
        const tb = sv('g', { transform: 'translate(880 1420)' }, L.front); sv('rect', { x: -140, y: -90, width: 280, height: 20, rx: 6, fill: fillC(S, '#7a5a40'), ...strokeOf(S, P, .8) }, tb); sv('rect', { x: -40, y: -116, width: 70, height: 26, rx: 3, fill: fillC(S, '#6a3a35'), ...strokeOf(S, P, .6) }, tb);
        if (night || eve) glowDot(L.mid, 1350, 1000, 300, '#ffcf7a', S.flat ? .6 : .35);
        sv('rect', { x: 1260, y: 920, width: 190, height: 460, fill: fillC(S, '#6b5038'), ...strokeOf(S, P) }, L.mid);
        return () => {};
      },
    },
  };
  /** Parallax layers of a world: sky (far away), far, mid, main (the actors), front. */
  function layersOf(g) { return g._layers; }
  const PARALLAX = { sky: .15, far: .45, mid: .75, main: 1, front: 1.15 };

  /* ---------------- the 2D map (set "kaart") ---------------- */
  function buildMap(svg, S, places, id, { svgLabels = false } = {}) {
    const m = ctx.map?.proj ? ctx.map : null; const draw = S.drawn;
    const g = sv('g', {}, svg); const cam = sv('g', { 'data-dyn': 1 }, g);
    const sea = draw ? '#25292d' : '#123a6b', land = draw ? '#d9d1bc' : '#e9c47f', coast = draw ? '#141416' : '#c99a55', river = draw ? '#6b8597' : '#5fa8d3';
    sv('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: sea }, g).parentNode.insertBefore(g.lastChild, cam);
    if (m) {
      const st = { 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' };
      sv('path', { d: m.land, fill: land, stroke: coast, 'stroke-width': draw ? 3 : 1.5, ...st }, cam);
      if (m.lakes) sv('path', { d: m.lakes, fill: sea, stroke: coast, 'stroke-width': 1.5, ...st }, cam);
      if (m.rivers) sv('path', { d: m.rivers, fill: 'none', stroke: river, 'stroke-width': 3, ...st }, cam);
    }
    const proj = (lon, lat) => m ? { x: (lon - m.proj.lonMin) * m.proj.cos * m.proj.k, y: (m.proj.latMax - lat) * m.proj.k } : { x: lon * 100, y: -lat * 100 };
    const pts = places.map(k => ctx.places?.[k] ? { key: k, name: ctx.places[k].name, ...proj(ctx.places[k].lon, ctx.places[k].lat) } : null).filter(Boolean);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min(760 / Math.max(x1 - x0, 1), 720 / Math.max(y1 - y0, 1), 1.6);
    const C = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s: Math.max(sc, .05) };
    const route = sv('path', { 'data-dyn': 1, fill: 'none', stroke: draw ? TEAL.deep : TEAL.light, 'stroke-width': draw ? 7 : 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': draw ? '22 14' : null }, g);
    const routeGlow = draw ? null : sv('path', { 'data-dyn': 1, fill: 'none', stroke: '#ffffff', 'stroke-width': 22, opacity: .25, 'stroke-linecap': 'round', filter: 'url(#f2d-soft)' }, g);
    if (routeGlow) g.insertBefore(routeGlow, route);
    const pins = pts.map(() => { const p = sv('g', { 'data-dyn': 1 }, g); sv('circle', { r: 16, fill: draw ? TEAL.deep : TEAL.mid, stroke: draw ? '#141416' : '#ffffff', 'stroke-width': 5 }, p); return p; });
    const traveler = sv('g', { 'data-dyn': 1 }, g);
    const labels = svgLabels ? pts.map(p => { const n = sv('text', { 'data-dyn': 1, 'font-family': 'Patrick Hand', 'font-size': 52, fill: S.ink || '#141416', 'paint-order': 'stroke', stroke: S.paper || '#ffffff', 'stroke-width': 10, 'stroke-linejoin': 'round' }, g); n.textContent = p.name.toUpperCase(); return n; }) : null;
    if (draw) { sv('circle', { r: 14, fill: '#ebe6d9', stroke: '#141416', 'stroke-width': 4, cy: -38 }, traveler); sv('path', { d: 'M0 -24 L0 0', stroke: '#141416', 'stroke-width': 6 }, traveler); }
    else { sv('circle', { r: 30, fill: `url(#${glowId(svg.ownerSVGElement || svg, '#ffffff')})`, opacity: .8 }, traveler); sv('circle', { r: 12, fill: '#ffffff' }, traveler); }
    return { pts, C, render(t, k, popAt) {
      const z = C.s * (1 + .08 * sm(k)); const toS = p => ({ x: 540 + (p.x - C.x) * z, y: 900 + (p.y - C.y) * z });
      cam.setAttribute('transform', `translate(${r1(540 - C.x * z)} ${r1(900 - C.y * z)}) scale(${z.toFixed(5)})`);
      const sp = pts.map(toS);
      // route progress: from pin i to pin i+1 between their pop times
      let prog2 = 0; for (let i = 0; i < sp.length - 1; i++) { const a = popAt[i], b = popAt[i + 1]; if (t >= b) prog2 = i + 1; else if (t > a) { prog2 = i + sm((t - a) / Math.max(.3, b - a)); break; } }
      let d = ''; let pos = sp[0];
      for (let i = 0; i < sp.length - 1; i++) { const f = cl(prog2 - i); if (f <= 0) break; const a = sp[i], b = sp[i + 1]; const mx = (a.x + b.x) / 2 + (b.y - a.y) * .12, my = (a.y + b.y) / 2 - (b.x - a.x) * .12;
        const q = (u) => ({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * b.y });
        d += (i ? '' : `M${r1(a.x)} ${r1(a.y)}`); for (let s = 1; s <= 24; s++) { const p = q(f * s / 24); d += ` L${r1(p.x)} ${r1(p.y)}`; } pos = q(f); }
      route.setAttribute('d', d || 'M0 0'); if (routeGlow) routeGlow.setAttribute('d', d || 'M0 0');
      pins.forEach((p, i) => { const v = out(cl((t - popAt[i]) / .35)); p.setAttribute('transform', `translate(${r1(sp[i].x)} ${r1(sp[i].y)}) scale(${r1(v * 100) / 100})`); });
      traveler.setAttribute('transform', `translate(${r1(pos.x)} ${r1(pos.y)})`);
      if (labels) labels.forEach((n, i) => { const v = out(cl((t - popAt[i] - .1) / .35)); n.setAttribute('opacity', r1(v * 100) / 100); n.setAttribute('transform', `translate(${r1(sp[i].x + 28)} ${r1(sp[i].y - 26)})`); });
      sp.head = pos; sp.drawing = t > popAt[0] && t < popAt[popAt.length - 1] + .2; sp.route = route;
      return sp;
    } };
  }

  /* ---------------- poster looks: colours, paper, the pen, the live drawing ---------------- */
  const hexOf = c => { if (!c || typeof c !== 'string') return null; c = c.trim(); if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase(); if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map(x => x + x).join('').toLowerCase(); return null; };
  const mix = (a, b, k) => mute(a, k, b);
  /** Recolour a finished world for a poster look: ink on paper, colour markers, or chalk on a board. */
  const lum = c => { const h = hexOf(c); if (!h) return 1; const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return .2126 * r + .7152 * g + .0722 * b; };
  /** Pencil hatching (schets): diagonal lines over the tint, denser for darker colours; one pattern per tint and density. */
  function hatch(defs, tint, dark) {
    const gap = dark < .2 ? 9 : dark < .32 ? 13 : 19; const id = `f2d-h-${tint.slice(1)}-${gap}`;
    if (!defs.querySelector('#' + id)) { const p = sv('pattern', { id, patternUnits: 'userSpaceOnUse', width: gap, height: gap, patternTransform: 'rotate(38)' }, defs); sv('rect', { width: gap, height: gap, fill: tint }, p); sv('path', { d: `M0 0 L0 ${gap}`, stroke: '#2a241d', 'stroke-width': 1.6, opacity: .5 }, p); }
    return `url(#${id})`;
  }
  function recolor(root, S, defs) {
    const C = S.name === 'schets' ? { fill: c => mix(c, S.paper, .7), stroke: () => S.ink, fs: c => mix(c, S.paper, .7) }
      : S.name === 'stift' ? { fill: c => mix(c, '#ffffff', .12), stroke: (c, f) => shade(f || c, -.45), fs: c => mix(c, '#ffffff', .12) }
      : { fill: c => mix(c, S.paper, .62), stroke: (c, f) => mix(f || c, '#fbfaf4', .72), fs: c => mix(c, S.paper, .4) };
    root.querySelectorAll('*').forEach(e => {
      const f = hexOf(e.getAttribute('fill')), st = hexOf(e.getAttribute('stroke')), sc = hexOf(e.getAttribute('stop-color'));
      if (sc) e.setAttribute('stop-color', C.fill(sc));
      if (e.getAttribute('data-fs')) { if (st) e.setAttribute('stroke', C.fs(st)); return; }
      if (f) { const t2 = C.fill(f); const L = lum(f); e.setAttribute('fill', S.name === 'schets' && defs && L < .42 && !e.closest('[data-actor]') && e.tagName !== 'text' ? hatch(defs, t2, L) : t2); }
      if (st) e.setAttribute('stroke', C.stroke(st, f));
    });
  }
  /** Paper (or blackboard) grain as an SVG pattern, made once on a canvas. */
  function paperPattern(defs, S) {
    const N = 420, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const r = rng('paper' + S.name); const board = S.name === 'krijt';
    for (let i = 0; i < 3200; i++) { const v = board ? 240 : 80 + r() * 70; g.fillStyle = `rgba(${v},${v - 4},${v - 12},${board ? .02 + r() * .05 : .035 + r() * .07})`; g.fillRect(r() * N, r() * N, .8 + r() * 2.2, .8 + r() * 2.2); }
    for (let i = 0; i < 140; i++) { g.strokeStyle = board ? `rgba(255,255,255,${.02 + r() * .04})` : `rgba(110,90,60,${.05 + r() * .08})`; g.lineWidth = .6 + r() * .8; g.beginPath(); const x = r() * N, y = r() * N, a = r() * 6.3, l = 6 + r() * 26; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .4) * l * .5, y + Math.sin(a + .4) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    if (board) for (let i = 0; i < 26; i++) { const x = r() * N, y = r() * N, rr = 20 + r() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    const pat = sv('pattern', { id: 'f2d-paper', patternUnits: 'userSpaceOnUse', width: N, height: N }, defs);
    sv('image', { href: c.toDataURL('image/png'), width: N, height: N }, pat);
  }
  /** The drawing tool that follows the line being drawn: a pencil, a marker or a stick of chalk (tip at 0,0). */
  function makePen(parent, S) {
    const g = sv('g', { visibility: 'hidden' }, parent); const k = sv('g', { transform: 'rotate(32)' }, g); let tipC = null;
    if (S.tool === 'potlood') {
      sv('path', { d: 'M0 0 L-7 -16 L7 -16 Z', fill: '#2b2723' }, k); sv('path', { d: 'M-7 -16 L-19 -52 L19 -52 L7 -16 Z', fill: '#e9c891' }, k);
      sv('rect', { x: -19, y: -330, width: 38, height: 280, fill: '#f2b632' }, k); for (const x of [-6, 6]) sv('path', { d: `M${x} -330 L${x} -52`, stroke: '#d99a1e', 'stroke-width': 3 }, k);
      sv('rect', { x: -20, y: -368, width: 40, height: 40, fill: '#c9c6bf' }, k); sv('rect', { x: -19, y: -410, width: 38, height: 44, rx: 8, fill: '#e98f8a' }, k);
    } else if (S.tool === 'stift') {
      tipC = sv('path', { d: 'M-6 0 L-12 -26 L12 -26 L6 0 Z', fill: '#2d2b36' }, k);
      sv('rect', { x: -22, y: -60, width: 44, height: 36, rx: 6, fill: '#e9e9ee' }, k); sv('rect', { x: -24, y: -330, width: 48, height: 272, rx: 12, fill: '#fafafa', stroke: '#c9c9d2', 'stroke-width': 3 }, k);
      const band = sv('rect', { x: -24, y: -300, width: 48, height: 60, fill: '#2d2b36' }, k); tipC = [tipC, band];
    } else {
      sv('path', { d: 'M-16 -6 Q0 6 16 -6 L18 -190 Q0 -200 -18 -190 Z', fill: '#f4f2ea', stroke: '#d9d6cc', 'stroke-width': 2 }, k);
    }
    return { g, tip: tipC };
  }
  /**
   * The live drawing of a poster panel: every stroked shape is traced in order (sky to front), its colour
   * filled in just after; things that move (waves, sails, the map) and text fade in. list: [{ e, len, a, b }].
   */
  function revealList(els, t0, t1) {
    const items = els.map(e => {
      const st = e.getAttribute('stroke'); const dyn = !!e.closest('[data-dyn]') || e.tagName === 'text' || e.tagName === 'image';
      let len = 0; if (!dyn && st && st !== 'none' && e.getTotalLength) { try { len = e.getTotalLength(); } catch { len = 0; } }
      return { e, len, traced: len > 1, w: len > 1 ? Math.min(len, 1500) + 80 : 30, base: parseFloat(e.getAttribute('opacity') ?? '1') || 1 };
    });
    const total = items.reduce((n, x) => n + x.w, 0) || 1; let acc = 0;
    for (const x of items) { x.a = t0 + (t1 - t0) * acc / total; acc += x.w; x.b = t0 + (t1 - t0) * acc / total; }
    return items;
  }
  function applyReveal(items, T) {
    let cur = null;
    for (const x of items) {
      const st = x.e.style;
      if (x.traced) {
        const p = cl((T - x.a) / Math.max(.001, x.b - x.a)), f = cl((T - x.b) / .3);
        if (p >= 1 && f >= 1) { st.removeProperty('stroke-dasharray'); st.removeProperty('stroke-dashoffset'); st.removeProperty('fill-opacity'); continue; }
        st.strokeDasharray = `${r1(x.len)} ${r1(x.len + 2)}`; st.strokeDashoffset = r1(x.len * (1 - p)); st.fillOpacity = f;
        if (p > 0 && p < 1) cur = { x, p };
      } else { const f = cl((T - x.a) / .35); if (f >= 1) st.removeProperty('opacity'); else st.opacity = f * x.base; }
    }
    return cur;
  }
  const clearReveal = items => items.forEach(x => { const st = x.e.style; st.removeProperty('stroke-dasharray'); st.removeProperty('stroke-dashoffset'); st.removeProperty('fill-opacity'); st.removeProperty('opacity'); });

  /* ---------------- the film ---------------- */
  window.FILM2D = (spec, timing) => {
    const O = window.__3dopts || {};   // experiments only (render.mjs --stills with PERF3D)
    const S = { name: spec.style3d, ...STY[spec.style3d], ...(O.noblur ? { blur: 0 } : {}), ...(O.noboil ? { boil: false } : {}) };
    const draw = S.drawn;
    ground('dark', spec); stage.style.background = '#000';
    const cast = Object.fromEntries((spec.cast || []).map(c => [c.id, c]));
    const CAT = ctx.catalog3d || null;

    /* timeline: one shot per line (or hold), as in the 3D films */
    const shots = []; const segs = []; let at = 0, u = 0;
    spec.shots.forEach((s, i) => {
      const text = s.say || s.line; const lead = i === 0 ? .45 : .18; let end;
      if (text) { const tm = timing?.[u]; const dur = tm ? tm.dur : Math.max(1.4, text.length / 14);
        const seg = { text, start: at + lead, dur, words: tm?.words || null, by: s.by || null, shot: i }; segs.push(seg); u++; end = seg.start + dur + .32; }
      else end = at + (s.hold || 2.2);
      shots.push({ ...s, i, start: at, end, seg: text ? segs[segs.length - 1] : null }); at = end;
    });
    const POSTER = !!S.poster, OVERVIEW = POSTER ? 3.4 : 0;   // poster looks: the whole sheet once more before the end card
    const endStart = at + OVERVIEW + .1; const duration = endStart + END;
    segs.forEach(sg => { sg.wordsAbs = wordTimes(sg); });

    /* the drawing surface */
    const svg = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }); svg.style.cssText = 'position:absolute;left:0;top:0;z-index:0';
    stage.appendChild(svg);
    const defs = sv('defs', {}, svg);
    const pg = sv('radialGradient', { id: 'f2d-phoneglow' }, defs); sv('stop', { offset: 0, 'stop-color': '#bfe9ff', 'stop-opacity': .9 }, pg); sv('stop', { offset: 1, 'stop-color': '#bfe9ff', 'stop-opacity': 0 }, pg);
    const soft = sv('filter', { id: 'f2d-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs); sv('feGaussianBlur', { stdDeviation: 6 }, soft);
    for (const [id, sd] of [['f2d-blur-far', 7], ['f2d-blur-mid', 3.2]]) { const f = sv('filter', { id, x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs); sv('feGaussianBlur', { stdDeviation: sd }, f); }
    // The drawn look's "boil": 8 times a second the drawing shifts by a pixel or two and the figures' lines
    // wobble a little, as if every drawing was traced again. (An SVG displacement filter looks the same but
    // costs seconds per frame.)
    const boilOf = t => draw && S.boil ? Math.floor(t * 8) : 0;
    const root = sv('g', {}, svg);
    // poster looks: every shot is a panel on one big sheet of paper (or a blackboard); the camera glides from
    // panel to panel while the pen draws each one, and shows the whole sheet at the end
    const COLS = Math.max(2, Math.ceil(Math.sqrt(spec.shots.length * 1.3))), GAP = 170, ZF = .9;
    const panelPos = i => { const col = i % COLS, row = Math.floor(i / COLS); return { x: col * (W + GAP), y: row * (H + GAP) + (col === 1 ? 180 : 0), rot: [-.6, .45, -.3, .7, -.5, .35, -.2, .55, -.65][i % 9] }; };
    const panelC = i => { const p = panelPos(i); return { x: p.x + W / 2, y: p.y + H / 2 }; };
    let pen = null;
    if (POSTER) {
      paperPattern(defs, S);
      const n = spec.shots.length, rows = Math.ceil(n / COLS), sw = Math.min(n, COLS) * (W + GAP), sh = rows * (H + GAP) + 400;
      sv('rect', { x: -2400, y: -2400, width: sw + 4800, height: sh + 4800, fill: S.paper }, root);
      sv('rect', { x: -2400, y: -2400, width: sw + 4800, height: sh + 4800, fill: 'url(#f2d-paper)', opacity: S.name === 'krijt' ? .9 : .75, 'data-tex': 1 }, root);
      pen = makePen(svg, S);
    }
    const sheetBox = () => { const ps = shots.map(x => panelPos(x.i)); return { x0: Math.min(...ps.map(p => p.x)), y0: Math.min(...ps.map(p => p.y)), x1: Math.max(...ps.map(p => p.x + W)), y1: Math.max(...ps.map(p => p.y + H)) }; };
    // a soft vignette (the drawn look: darker, like an old print)
    const vig = el('div', 'abs full'); css(vig, { background: `radial-gradient(ellipse at 50% 45%, transparent ${draw ? 45 : 58}%, rgba(0,0,0,${POSTER ? .22 : draw ? .55 : .35}))`, zIndex: 1 });

    /* worlds: one per set + time + weather (kaart: one per shot) */
    const worlds = new Map();
    const worldOf = s => {
      const key = POSTER ? `p${s.i}` : `${s.set}|${s.time || ''}|${s.weather || ''}|${s.set === 'kaart' ? s.i : ''}`;
      if (!worlds.has(key)) {
        let g, panel = null;
        if (POSTER) {
          const pos = panelPos(s.i);
          panel = sv('g', { transform: `translate(${pos.x} ${pos.y}) rotate(${pos.rot} ${W / 2} ${H / 2})`, display: 'none' }, root);
          const cp = sv('clipPath', { id: `f2d-clip-${s.i}` }, defs); sv('rect', { width: W, height: H }, cp);
          g = sv('g', { 'clip-path': `url(#f2d-clip-${s.i})` }, panel);
        } else g = sv('g', { display: 'none' }, root);
        if (s.set === 'kaart') { const map = buildMap(g, S, s.places || [], key, { svgLabels: POSTER }); worlds.set(key, { g, panel, map, kaart: true, i: s.i }); }
        else {
          const def = SETS2D[s.set]; if (!def) throw new Error(`2D set "${s.set}" does not exist`);
          const time = s.time || (def.spots && ['slaapkamer'].includes(s.set) ? 'nacht' : 'dag');
          const P = PAL[S.pal][time] || PAL[S.pal].dag;
          g._layers = {};
          for (const k of Object.keys(PARALLAX)) { const lg = sv('g', {}, g); const inner = sv('g', S.blur && (k === 'far' || k === 'mid') && def.cx > 0 && !['slaapkamer', 'woonkamer'].includes(s.set) ? { filter: `url(#f2d-blur-${k})` } : {}, lg); lg._inner = inner; g._layers[k] = inner; g._layers[k]._outer = lg; }
          const update = def.build(g, S, P, { time, weather: s.weather, seed: spec.id + key });
          const actors = {};
          worlds.set(key, { g, panel, def, P, update, actors, time, i: s.i });
        }
      }
      const w = worlds.get(key);
      if (!w.kaart) for (const a of s.actors || []) if (!w.actors[a.id]) {
        const c = cast[a.id]; if (!c) throw new Error(`actor "${a.id}" is not in cast`);
        w.actors[a.id] = makeActor(w.g._layers.main, c.look, S, w.P, spec.id + a.id);
      }
      return w;
    };
    shots.forEach(s => { s.world = worldOf(s); });
    // actors are drawn after the set in the main layer; keep the front layer on top
    for (const w of worlds.values()) if (!w.kaart) { const m = w.g._layers.main; for (const a of Object.values(w.actors)) m.appendChild(a.g); }

    /* poster looks: recolour, name labels, frame and banner, and the drawing order of every panel */
    const BANNER = ['#d9534f', '#3d7ec9', '#2f9e6e', '#e0972f', '#8a5cc2'];
    if (POSTER) {
      recolor(defs, S);
      const seen = new Set();
      shots.forEach(s => {
        const w = s.world; const g = w.g;
        recolor(g, S, defs);
        // the first time someone appears: their name, hand-lettered, with an arrow
        if (!w.kaart) { const states0 = actorsAt(s, s.start + .01); const cam0 = shoot(s, s.start + .01, states0); for (const st of states0) {
          const c = cast[st.a.id]; if (!c?.name || seen.has(c.id)) continue; seen.add(c.id);
          const hx = st.x, hy = st.y - (st.base === 'lie' ? 80 : st.base === 'sit' ? 330 : 400) * st.s * .92;
          const name = c.name.toUpperCase(), half = name.length * 15 + 20;
          const sx = 540 + (hx - cam0.cx) * cam0.z; const shift = (cl(sx, 70 + half * cam0.z, 1010 - half * cam0.z) - sx) / cam0.z;
          const tx = hx + shift, ty = hy - 200;
          const lab = sv('g', { 'data-label': 1 }, g._layers.main);
          const txt = sv('text', { x: tx, y: ty, 'text-anchor': 'middle', 'font-family': 'Patrick Hand', 'font-size': 60, fill: S.ink, 'letter-spacing': 2 }, lab); txt.textContent = name;
          sv('path', { d: `M${tx} ${ty + 16} Q${(tx + hx) / 2 + 30} ${ty + 60} ${hx} ${hy - 44}`, fill: 'none', stroke: S.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, lab);
          sv('path', { d: `M${hx - 18} ${hy - 66} L${hx} ${hy - 44} L${hx + 20} ${hy - 64}`, fill: 'none', stroke: S.ink, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, lab);
        } }
        sv('rect', { width: W, height: H, fill: 'url(#f2d-paper)', opacity: S.name === 'krijt' ? .5 : .55, 'data-tex': 1 }, g);
        const frame = sv('rect', { x: 0, y: 0, width: W, height: H, fill: 'none', stroke: S.ink, 'stroke-width': 14, 'stroke-linejoin': 'round' }, w.panel);
        // banner: the panel's number, and its title (the shot's label, or the route of a map)
        const bn = sv('g', {}, w.panel); const col = BANNER[s.i % BANNER.length];
        const title = s.text || (w.kaart && w.map.pts.length ? w.map.pts.map(p => p.name).filter((x, j, a) => j === 0 || j === a.length - 1).join(' - ') : '');
        const boxFill = S.name === 'stift' ? '#ffffff' : S.paper;
        sv('rect', { x: 46, y: 46, width: 130, height: 130, rx: 6, fill: boxFill, stroke: S.ink, 'stroke-width': 8 }, bn);
        const num = sv('text', { x: 111, y: 142, 'text-anchor': 'middle', 'font-family': 'Patrick Hand', 'font-size': 104, fill: S.name === 'stift' ? col : S.ink }, bn); num.textContent = String(s.i + 1);
        if (title) {
          const tw = Math.min(800, 70 + title.length * 30);
          sv('path', { d: `M176 62 L${176 + tw} 62 L${176 + tw - 34} 111 L${176 + tw} 160 L176 160 Z`, fill: S.name === 'krijt' ? 'none' : S.name === 'stift' ? col : S.ink, stroke: S.ink, 'stroke-width': 7, 'stroke-linejoin': 'round' }, bn);
          const tt = sv('text', { x: 206, y: 132, 'font-family': 'Patrick Hand', 'font-size': 62, fill: S.name === 'krijt' ? S.ink : S.name === 'stift' ? '#ffffff' : S.paper, 'letter-spacing': 2 }, bn); tt.textContent = title.toUpperCase();
        }
        // the drawing order: frame, then the world from the sky to the front, the people, then labels and banner
        const geo = 'path,circle,rect,ellipse,line,polyline,polygon,text,image';
        const content = [...g.querySelectorAll(geo)].filter(e => !e.closest('[data-actor]') && !e.closest('[data-label]') && !e.hasAttribute('data-tex') && !e.closest('defs'));
        const labels = [...g.querySelectorAll('[data-label] *'), ...bn.querySelectorAll(geo)];
        const t0 = s.start + (s.i ? .25 : .35), D = cl((s.end - s.start) * .62, 1.6, 5.2);
        w.rev = revealList([frame, ...content], t0, t0 + D * .68);
        w.revLab = revealList(labels, t0 + D * .84, t0 + D);
        w.actWin = [t0 + D * .56, t0 + D * .9]; w.revStart = t0; w.revEnd = t0 + D + .45; w.state = '';
        w.actorEls = Object.fromEntries(Object.entries(w.actors || {}).map(([id, a]) => [id, [...a.g.querySelectorAll(geo)]]));
      });
    }

    /* where everyone is at time t in a shot */
    function actorsAt(s, t) {
      const def = s.world.def; const out2 = [];
      for (const a of s.actors || []) {
        const sp = def.spots[a.at]; if (!sp) throw new Error(`spot "${a.at}" is not in set ${s.set}`);
        let x = sp.x, y = sp.y, sc = sp.s, dir = sp.dir || 1, base = a.base || sp.base || 'stand', seat = sp.seat, walk = null;
        const riding = a.base === 'ride';
        if (a.to) {
          const to = def.spots[a.to]; if (!to) throw new Error(`spot "${a.to}" is not in set ${s.set}`);
          const dist = Math.hypot((to.x - x) / ((sp.s + to.s) / 2), (to.y - y) * 2.2), dur = Math.max(.6, dist / 230);
          const k = cl((t - s.start - .1) / dur);
          if (k < 1) { const e = sm(k) * .15 + k * .85; dir = to.x >= x ? 1 : -1; x = lerp(x, to.x, e); y = lerp(y, to.y, e); sc = lerp(sc, to.s, e); base = riding ? 'ride' : 'walk'; walk = { ph: (t - s.start) * (riding ? 5.4 : 6.2), amt: Math.min(1, Math.min(k, 1 - k) * 10) }; }
          else { x = to.x; y = to.y; sc = to.s; dir = to.dir || 1; base = a.base || to.base || 'stand'; seat = to.seat; }
        }
        out2.push({ a, x, y, s: sc, dir, base, seat, walk });
      }
      // face whom they talk to / look at
      for (const st of out2) {
        const face = st.a.face && out2.find(o => o.a.id === st.a.face);
        const talker = s.by && s.by !== st.a.id && out2.find(o => o.a.id === s.by);
        const other = face || talker;
        if (!st.walk && other && st.base !== 'lie') st.dir = other.x >= st.x ? 1 : -1;
      }
      return out2.sort((p, q) => p.y - q.y);
    }
    const mouth = (sg, t) => { if (!sg || t < sg.start || t > sg.start + sg.dur) return 0; const w = sg.wordsAbs.find(w => t >= w.a && t <= w.b); return w ? .35 + .65 * Math.abs(Math.sin((t - w.a) / Math.max(.08, w.b - w.a) * Math.PI)) : 0; };

    /* camera: { cx, cy, z } in world units */
    function shoot(s, t, states) {
      const k = cl((t - s.start) / Math.max(.1, s.end - s.start)); const e = inout(k);
      const def = s.world.def; const type = s.camera || (s.say || !states.length ? 'wide' : 'medium');
      const by = s.by && states.find(st => st.a.id === s.by); const on = (s.on && states.find(st => st.a.id === s.on)) || by || states[0];
      const head = st => ({ x: st.x + (st.base === 'lie' ? -(R.head - R.hip) * st.s * st.dir : 0), y: st.y - (st.base === 'lie' ? 60 : st.base === 'sit' ? (R.head - R.hip + (st.seat ?? 95)) : st.base === 'kneel' ? R.head - 75 : st.base === 'wade' ? R.head - R.hip + 18 : R.head) * st.s });
      const all = states.length ? states : null;
      const mx = all ? all.reduce((n, st) => n + st.x, 0) / all.length : def.cx;
      const wideC = { cx: cl(mx, 540, 2000), cy: 1010, z: 1.1 };
      let c;
      switch (type) {
        case 'establish': c = { cx: wideC.cx + lerp(-80, 0, e), cy: 940 + 60 * e, z: lerp(.88, 1.02, e) }; break;
        case 'aerial': case 'top': case 'orbit': c = { cx: wideC.cx + lerp(-140, 140, e), cy: 980, z: .98 }; break;
        case 'sky': c = { cx: wideC.cx, cy: lerp(960, -120, sm(cl((t - s.start - .4) / Math.max(1, s.end - s.start - .8)))), z: .95 }; break;
        case 'track': case 'follow': { const st = on || states[0]; c = { cx: st ? st.x : mx, cy: 920 + (st ? (st.y - GY) * .6 : 0), z: 1.05 }; break; }
        case 'low': c = { cx: on ? on.x : mx, cy: 1060, z: 1.2 }; break;
        case 'medium': { const h = on ? head(on) : { x: mx, y: 1000 }; c = { cx: h.x, cy: h.y + 190 * (on?.s || 1), z: 1.75 / (on?.s || 1) ** .5 }; break; }
        case 'close': case 'phone': { const h = on ? head(on) : { x: mx, y: 1000 }; c = { cx: h.x, cy: h.y + 60, z: 2.6 / (on?.s || 1) ** .5 }; break; }
        case 'push-in': { const h = on ? head(on) : { x: mx, y: 1000 }; c = { cx: lerp(wideC.cx, h.x, e), cy: lerp(960, h.y + 120, e), z: lerp(1.05, 2.2, e) }; break; }
        case 'two-shot': case 'over-shoulder': { const two = states.slice(0, 2); const x = two.reduce((n, st) => n + st.x, 0) / Math.max(1, two.length); const h = on ? head(on) : { y: 1000 }; c = { cx: x, cy: h.y + 260, z: 1.35 }; break; }
        default: c = { ...wideC, cx: wideC.cx + lerp(-30, 30, e), z: lerp(1, 1.04, e) };
      }
      // someone standing in the stream is low in the set: the shot goes down with him, so he stays above the subtitles
      const wd = states.filter(st => st.base === 'wade');
      if (wd.length && !['medium', 'close', 'phone', 'push-in', 'two-shot', 'over-shoulder'].includes(type)) c.cy += Math.max(0, Math.max(...wd.map(st => st.y)) - 330 - 1010);
      c.cx += Math.sin(t * .37) * 4; c.cy += Math.sin(t * .29 + 2) * 3;   // a breathing camera
      return c;
    }

    /* overlays: the hook and the verse cards start under the platforms' top bar and the watermark (top right corner, stage.html) */
    const TOP = Math.max(TEXT_TOP, WM.below);
    const hook = el('div', 'abs'); css(hook, { left: '70px', width: '940px', top: TOP + 'px', textAlign: draw ? 'left' : 'center', color: '#fff', fontFamily: S.title, fontWeight: draw ? 400 : 900, zIndex: 3,
      fontSize: (draw ? fit(spec.hook, [[22, 108], [36, 94], [60, 78]], 940) : fit(spec.hook, [[22, 96], [36, 84], [60, 68]], 940)) + 'px', lineHeight: draw ? 1.02 : 1.04, letterSpacing: draw ? '0' : '-2px', textWrap: 'balance',
      textShadow: draw ? '0 4px 0 rgba(0,0,0,.35), 0 0 22px rgba(10,10,14,.75), 0 0 6px rgba(10,10,14,.6)' : '0 8px 28px rgba(0,0,0,.55)', WebkitTextStroke: draw ? '0' : '10px rgba(8,10,16,.9)', paintOrder: 'stroke fill' });
    if (POSTER) css(hook, { color: S.ink, textShadow: 'none', textAlign: 'left', width: '900px', left: '90px', top: TOP + 'px', padding: '30px 40px', boxSizing: 'border-box', background: S.paper, border: `6px solid ${S.ink}`, borderRadius: '8px', boxShadow: '0 14px 30px rgba(0,0,0,.18)' });
    // the hook stays long enough to read it calmly twice (Alex, 24 Oct: a second longer than before)
    const HOOK_OUT = Math.min(5, Math.max(3.8, 1.3 + .24 * spec.hook.split(/\s+/).length));
    if (draw) hook.textContent = spec.hook;
    else { const words = spec.hook.split(/\s+/); const n = Math.min(3, Math.max(1, Math.round(words.length / 3))); hook.innerHTML = esc(words.slice(0, -n).join(' ')) + (words.length > n ? ' ' : '') + `<span style="color:${TEAL.light}">${esc(words.slice(-n).join(' '))}</span>`; }
    const label = el('div', 'abs'); css(label, draw ? { left: '70px', top: '120px', color: 'rgba(235,230,217,.9)', textShadow: '0 0 14px rgba(10,10,14,.8), 0 2px 0 rgba(0,0,0,.4)', fontFamily: S.font, fontSize: '40px', letterSpacing: '3px', textTransform: 'uppercase', zIndex: 3, opacity: 0 }
      : { left: '70px', top: '120px', color: 'rgba(255,255,255,.85)', fontFamily: 'Inter', fontWeight: 800, fontSize: '30px', letterSpacing: '6px', textTransform: 'uppercase', zIndex: 3, opacity: 0, textShadow: '0 2px 12px rgba(0,0,0,.5)' });
    const cap = subtitles(segs, spec.captions || 'karaoke', { top: 1500 });
    shots.forEach(s => {
      if (s.verseData) {
        const card = el('div', 'abs'); css(card, POSTER ? { left: '80px', width: '920px', top: TOP + 'px', boxSizing: 'border-box', padding: '40px 48px', borderRadius: '6px', background: S.name === 'krijt' ? '#323f39' : '#fffdf6', border: `5px solid ${S.ink}`, boxShadow: '0 18px 40px rgba(0,0,0,.22)', zIndex: 3, opacity: 0 } : draw ? { left: '70px', width: '940px', top: TOP + 'px', boxSizing: 'border-box', padding: '36px 44px', borderRadius: '10px', background: 'rgba(20,20,22,.88)', border: '3px solid rgba(235,230,217,.55)', zIndex: 3, opacity: 0 }
          : { left: '70px', width: '940px', top: TOP + 'px', boxSizing: 'border-box', padding: '38px 46px', borderRadius: '30px', background: 'rgba(10,14,28,.72)', backdropFilter: 'blur(6px)', boxShadow: '0 24px 60px rgba(0,0,0,.4)', zIndex: 3, opacity: 0 });
        if (POSTER) { const tape = el('div', 'abs', card); css(tape, { left: '380px', top: '-26px', width: '160px', height: '46px', background: S.name === 'krijt' ? 'rgba(240,236,224,.35)' : 'rgba(232,214,160,.75)', transform: 'rotate(-3deg)' }); }
        el('div', '', card, vref(s.verseData.ref)).style.cssText = POSTER ? `font-family:${S.font};font-size:36px;letter-spacing:3px;color:${S.name === 'krijt' ? TEAL.light : TEAL.deep};margin-bottom:12px` : draw ? `font-family:${S.font};font-size:34px;letter-spacing:3px;color:${TEAL.drawn};margin-bottom:14px` : `font-weight:800;font-size:26px;letter-spacing:3px;color:${TEAL.light};margin-bottom:16px`;
        el('div', draw ? '' : 'serif', card, esc(s.verseData.text)).style.cssText = POSTER ? `font-family:${S.font};font-size:${s.verseData.text.length > 150 ? 44 : 50}px;line-height:1.2;color:${S.ink}` : draw ? `font-family:${S.font};font-size:${s.verseData.text.length > 150 ? 42 : 48}px;line-height:1.22;color:#ebe6d9` : `font-size:${s.verseData.text.length > 150 ? 36 : 42}px;line-height:1.38;color:#fff`;
        s.card = card;
      }
      if (s.app) { const ph = phone(stage, s.app, 480); css(ph.node, { left: '300px', top: Math.min(300, 1340 - ph.h) + 'px', zIndex: 3, opacity: 0, boxShadow: '0 40px 90px rgba(0,0,0,.55)' }); s.phone = ph; }   // ends above the subtitles (1430px): they ran over the phone
      if (s.set === 'kaart' && !POSTER) s.mapLabels = (s.world.map.pts || []).map(p => { const n = el('div', 'abs'); css(n, draw ? { left: 0, top: 0, fontFamily: S.font, fontSize: '46px', color: '#141416', textShadow: '0 0 6px #d9d1bc, 0 0 12px #d9d1bc', zIndex: 3, opacity: 0, whiteSpace: 'nowrap' }
        : { left: 0, top: 0, fontFamily: '"Inter Black", Inter', fontWeight: 900, fontSize: '40px', color: '#fff', WebkitTextStroke: '8px rgba(8,10,16,.85)', paintOrder: 'stroke fill', zIndex: 3, opacity: 0, whiteSpace: 'nowrap' }); n.textContent = p.name; return n; });
    });
    const fade = el('div', 'abs full'); css(fade, { background: '#000', opacity: 0, zIndex: 5 });
    const wm = watermark(4);   // over the overlays, under the end card
    const end = endCard(spec); document.querySelector('.end').style.zIndex = 6;

    /* map pins: when each place is named, else spread over the line */
    const norm = w => String(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
    shots.filter(s => s.set === 'kaart').forEach(s => {
      const pts = s.world.map.pts; const sg = s.seg; const t0 = s.start + .3, t1 = sg ? sg.start + sg.dur * .92 : s.end - .3;
      const words = sg ? sg.wordsAbs : []; const n = pts.length;
      s.popAt = pts.map((p, i) => { const key = norm(p.name).slice(0, 5); const w = key.length >= 4 && words.find(w => norm(w.w).startsWith(key)); return i === 0 ? t0 : w ? w.a : lerp(t0, t1, i / Math.max(1, n - 1)); });
      for (let i = 1; i < n; i++) if (s.popAt[i] <= s.popAt[i - 1] + .4) s.popAt[i] = s.popAt[i - 1] + .6;
    });

    /** Pose a shot's world at time T: people, moving things, its own camera (the parallax layers). */
    function poseWorld(s, T, bo, cam = null) {   // cam: a camera to use instead of the shot's own (a glide between two shots)
      const w = s.world; const jr = bo ? rng('boil' + bo) : null;
      if (w.kaart) return w.map.render(T, cl((T - s.start) / (s.end - s.start)), s.popAt);
      Object.values(w.actors).forEach(a => a.g.setAttribute('display', 'none'));
      const states = actorsAt(s, Math.min(T, s.end));
      for (const st of states) {
        const a = w.actors[st.a.id]; a.g.setAttribute('display', 'inline');
        const speaking = s.by === st.a.id && T <= s.end;
        a.update({ t: T, boil: bo, x: st.x, y: st.y, s: st.s * .92, dir: st.dir, base: st.walk && st.base !== 'ride' ? 'walk' : st.base, action: st.walk && st.base !== 'ride' && st.a.do !== 'carry' ? 'idle' : (st.a.do || 'idle'), mood: st.a.mood, talk: speaking ? mouth(s.seg, T) : 0, walk: st.walk, holds: st.a.holds, seat: st.seat });
      }
      // depth: people and upright set pieces (data-y = where they stand) in order, the nearest drawn last
      if (!POSTER) {
        const main = w.g._layers.main;
        if (!w.upright) w.upright = [...main.children].filter(n => n.hasAttribute('data-y')).map(n => ({ n, y: +n.getAttribute('data-y') }));
        const list = [...w.upright, ...states.map(st => ({ n: w.actors[st.a.id].g, y: st.y + .5 }))].sort((p, q) => p.y - q.y);
        for (const o of list) main.appendChild(o.n);
      }
      if (w.update) w.update(T);
      const c = cam || shoot(s, Math.min(T, s.end), states);
      for (const [k, f] of Object.entries(PARALLAX)) {
        const lg = w.g._layers[k]._outer; const z = 1 + (c.z - 1) * f, ex = w.def.cx + (c.cx - w.def.cx) * f, ey = 960 + (c.cy - 960) * f;
        const jx = jr && k !== 'sky' ? (jr() - .5) * 2.4 : 0, jy = jr && k !== 'sky' ? (jr() - .5) * 2.4 : 0;
        lg.setAttribute('transform', `translate(${r1(540 - ex * z + jx)} ${r1(960 - ey * z + jy)}) scale(${z.toFixed(4)})`);
      }
      return states;
    }
    /** Poster looks: how far the pen has drawn a panel at time T; returns what is being drawn (for the pen). */
    function drawPanel(s, T) {
      const w = s.world; let cur = null;
      if (T >= w.revEnd) {
        if (w.state !== 'full') { clearReveal(w.rev); clearReveal(w.revLab); Object.values(w.actorEls).flat().forEach(e => { e.style.removeProperty('stroke-dasharray'); e.style.removeProperty('stroke-dashoffset'); e.style.removeProperty('fill-opacity'); }); Object.values(w.actors || {}).forEach(a => a.g.style.removeProperty('opacity')); w.state = 'full'; }
        return null;
      }
      w.state = 'partial';
      cur = applyReveal(w.rev, T);
      const lc = applyReveal(w.revLab, T); cur = cur || lc;
      // people: hidden until their turn, then traced part by part (their shapes change every frame, so measured now)
      const [a0, a1] = w.actWin;
      for (const [id, els] of Object.entries(w.actorEls)) {
        const g = w.actors[id].g;
        if (T < a0) { g.style.opacity = 0; continue; }
        g.style.removeProperty('opacity');
        const p = cl((T - a0) / (a1 - a0)), n = els.length;
        els.forEach((e, i) => {
          const local = cl(p * n - i); const st = e.style; const sk = e.getAttribute('stroke');
          if (local >= 1) { st.removeProperty('stroke-dasharray'); st.removeProperty('stroke-dashoffset'); st.removeProperty('fill-opacity'); return; }
          let len = 0; if (sk && sk !== 'none' && e.getTotalLength) { try { len = e.getTotalLength(); } catch { len = 0; } }
          if (len > 1) { st.strokeDasharray = `${r1(len)} ${r1(len + 2)}`; st.strokeDashoffset = r1(len * (1 - local)); st.fillOpacity = 0; if (local > 0) cur = { x: { e, len }, p: local }; }
          else st.fillOpacity = local > 0 ? 1 : 0;
        });
      }
      return cur;
    }

    // Alex, 24 Oct: scenes must flow into each other. Shots dissolve into the next one (XF seconds around
    // the cut) instead of cutting hard or dipping to black. The same world in both shots: the outgoing pose
    // is frozen into a copy (a ghost) laid over the incoming one while it fades away.
    const XF = draw ? .75 : .65;
    let ghost = null;
    // Alex, 24 Oct (weduwe 0:47): after a shot up into the sky the background jumped back down. Two shots in the
    // same world now share ONE camera across the cut, gliding from where the last shot ends to where the next
    // begins; the further apart, the longer the glide (up to 1.5 s). Only the people dissolve.
    const camAt = (s, t) => { const T = Math.min(Math.max(t, s.start + .01), s.end); return shoot(s, T, actorsAt(s, T)); };
    const xfs = new Map();
    const xfFor = nx => {
      if (xfs.has(nx.i)) return xfs.get(nx.i);
      const pv = shots[nx.i - 1]; let xf = XF;
      if (pv.world === nx.world && !nx.world.kaart) {
        const a = camAt(pv, pv.end), b = camAt(nx, nx.start);
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy) + 900 * Math.abs(Math.log(a.z / b.z));
        xf = Math.min(1.5, .8 * Math.min(pv.end - pv.start, nx.end - nx.start), Math.max(XF, .45 + d / 1100));
      }
      xfs.set(nx.i, xf); return xf;
    };
    function render(t) {
      if (ghost) { ghost.remove(); ghost = null; }
      const i = Math.max(0, shots.findIndex(s => t >= s.start && t < s.end)); const s = t >= at ? shots[shots.length - 1] : shots[i];
      const w = s.world;
      const bo = boilOf(t);
      let sp = null;
      if (!POSTER) {
        for (const x of worlds.values()) { x.g.setAttribute('display', x === w ? 'inline' : 'none'); x.g.removeAttribute('opacity'); }
        const nx = shots.find(x => x.i > 0 && Math.abs(t - x.start) < xfFor(x) / 2);
        if (nx) {
          const pv = shots[nx.i - 1]; const xf = xfFor(nx); const k = sm((t - (nx.start - xf / 2)) / xf);
          pv.world.g.setAttribute('display', 'inline'); nx.world.g.setAttribute('display', 'inline');
          let cam = null;
          if (pv.world === nx.world && !nx.world.kaart) {
            const ca = camAt(pv, t), cb = camAt(nx, t), e = inout(cl((t - (nx.start - xf / 2)) / xf));
            cam = { cx: lerp(ca.cx, cb.cx, e), cy: lerp(ca.cy, cb.cy, e), z: Math.exp(lerp(Math.log(ca.z), Math.log(cb.z), e)) };
          }
          const a = poseWorld(pv, t, bo, cam);
          if (pv.world === nx.world) { ghost = pv.world.g.cloneNode(true); pv.world.g.after(ghost); ghost.setAttribute('opacity', (1 - k).toFixed(3)); }
          const b = poseWorld(nx, t, bo, cam);
          sp = s === nx ? b : a;
          if (pv.world !== nx.world) {   // two worlds: the upper one fades
            const nxAbove = !!(pv.world.g.compareDocumentPosition(nx.world.g) & Node.DOCUMENT_POSITION_FOLLOWING);
            (nxAbove ? nx.world.g : pv.world.g).setAttribute('opacity', (nxAbove ? k : 1 - k).toFixed(3));
          }
        } else sp = poseWorld(s, t, bo);
      } else {
        // which panels are on the visible part of the sheet: this one and its neighbours (all of them in the overview)
        const over = t >= at;
        let cur = null;
        for (const x of shots) {
          const vis = over || Math.abs(x.i - s.i) <= 1;
          x.world.panel.setAttribute('display', vis ? 'inline' : 'none'); if (!vis) continue;
          const T = x === s ? t : x.i < s.i || over ? Math.max(x.end, x.world.revEnd) : Math.min(t, x.start - .01);
          const r = poseWorld(x, T, x === s ? bo : 0); if (x === s) sp = r;
          const c = drawPanel(x, T); if (x === s && c) cur = c;
        }
        // the sheet's camera: on this panel; between panels it glides over, a little zoomed out
        let cx, cy, z;
        const c1 = panelC(s.i);
        if (over) {
          const B = sheetBox(); const zo = Math.min(1080 * .9 / (B.x1 - B.x0), 1920 * .76 / (B.y1 - B.y0)); const k = inout(cl((t - at) / 1.5));
          cx = lerp(c1.x, (B.x0 + B.x1) / 2, k); cy = lerp(c1.y, (B.y0 + B.y1) / 2 + 60, k); z = Math.exp(lerp(Math.log(ZF), Math.log(zo), k));
        } else if (s.i > 0) {
          const c0 = panelC(s.i - 1); const k = inout(cl((t - s.start + .05) / 1.0));
          cx = lerp(c0.x, c1.x, k); cy = lerp(c0.y, c1.y, k); z = ZF * (1 - .32 * Math.sin(Math.PI * k));
        } else { cx = c1.x; cy = c1.y; z = ZF * lerp(.82, 1, inout(cl(t / 1.6))); }
        root.setAttribute('transform', `translate(${r1(540 - cx * z)} ${r1(960 - cy * z)}) scale(${z.toFixed(4)})`);
        // the pen: on the line being drawn (on a map: at the head of the route)
        let pp = null, tipColor = null;
        if (cur) { const e = cur.x.e; try { const q = e.getPointAtLength(cur.x.len * cur.p); const m = e.getCTM(); pp = new DOMPoint(q.x, q.y).matrixTransform(m); tipColor = e.getAttribute('stroke'); } catch { pp = null; } }
        else if (w.kaart && sp?.drawing && sp.head) { const m = sp.route.getCTM(); if (m) { pp = new DOMPoint(sp.head.x, sp.head.y).matrixTransform(m); tipColor = sp.route.getAttribute('stroke'); } }
        if (pp && !over) { pen.g.setAttribute('visibility', 'visible'); pen.g.setAttribute('transform', `translate(${r1(pp.x)} ${r1(pp.y)})`); if (pen.tip && tipColor) pen.tip.forEach(n => n.setAttribute('fill', tipColor)); }
        else pen.g.setAttribute('visibility', 'hidden');
      }
      if (w.kaart && s.mapLabels && sp) s.mapLabels.forEach((n, j) => { const v = out(cl((t - s.popAt[j] - .1) / .35)); n.style.opacity = v; n.style.transform = `translate(${r1(sp[j].x + 26)}px, ${r1(sp[j].y - 70 + (1 - v) * 14)}px)`; });
      // overlays (as in the 3D films)
      const hk = out(prog(t, .15, .5)) * (1 - prog(t, HOOK_OUT, HOOK_OUT + .35));
      set(hook, hk, (1 - hk) * 30, .94 + .06 * hk);
      const l0 = Math.max(s.start + .2, s.start < HOOK_OUT + .3 ? HOOK_OUT + .2 : 0);   // a place label waits for the hook to go
      const lk = s.text && !POSTER ? out(prog(t, l0, l0 + .35)) * (1 - prog(t, Math.max(s.start + 2.8, l0 + 2.2), Math.max(s.start + 3.2, l0 + 2.6))) : 0;
      if (s.text && label.textContent !== s.text) label.textContent = s.text;
      set(label, lk, (1 - lk) * 12);
      shots.forEach(x => {
        if (x.card) { const c0 = x.i === 0 ? Math.min(x.end - 1.2, Math.max(3.1, HOOK_OUT + .2)) : x.start + .3; const v = x === s ? out(prog(t, c0, c0 + .4)) * (1 - prog(t, x.end - .3, x.end)) : 0; set(x.card, v, (1 - v) * 24); }
        if (x.phone) { const v = x === s ? out(prog(t, x.start + .25, x.start + .75)) * (1 - prog(t, x.end - .25, x.end)) : 0; set(x.phone.node, v, (1 - v) * 260); const im = x.phone.node.querySelector('img'); im.style.transform = `translateY(${-140 * sm(prog(t, x.start + 1.2, x.end - .3))}px)`; }
        if (x.mapLabels && x !== s) x.mapLabels.forEach(n => { n.style.opacity = 0; });
      });
      fade.style.opacity = 0;   // shots dissolve now (above), no dip to black
      cap(t);
      wm(t, endStart);
      end(t, endStart);
    }
    return { width: W, height: H, duration, fps: FPS, starts: segs.map(s => s.start), render };
  };
  window.FILM2D.looks = LOOKS;
})();
