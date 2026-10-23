// Narrated story reel (reel-story): a spoken hook, then 3-8 scenes that each show a map with a route,
// a timeline, a big line, a verse, a photo, a counting number (stat), a family line (tree), two sides
// (compare) or a Hebrew/Greek word (word), with burned-in subtitles and the end card.
// Looks: dark (default), light, photo. Loaded by stage.html after base.js; uses its helpers.
// render(t) is a pure function of t: frames can be rendered in any order (the cover is taken at 2.4 s).
(() => {
  const W = 1080, H = 1920;
  const FADE = .35;                                                   // crossfade between scenes
  const SAFE = { left: 64, right: W - 160, top: 270, bottom: 1385 };  // scene text stays inside (subtitles at 1430)
  const FIT = { left: 190, right: 790, top: 450, bottom: 1210 };      // where the camera frames a scene's places
  const CX = (FIT.left + FIT.right) / 2, CY = (FIT.top + FIT.bottom) / 2;
  const NS = 'http://www.w3.org/2000/svg';

  const lerp = (a, b, k) => a + (b - a) * k;
  const backOut = x => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const r1 = v => Math.round(v * 10) / 10;
  const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  /** Colours for the map and accents, per look (photo uses the dark map). */
  const palette = L => L.dark ? {
    sea: '#0c1c22', land: '#1d343a', coast: 'rgba(153,246,228,.32)', river: 'rgba(94,234,212,.28)', grid: 'rgba(255,255,255,.04)', seaName: 'rgba(204,251,241,.36)',
    ground: 'var(--panel)', label: '#fff', halo: 'rgba(8,18,22,.94)', acc: 'color-mix(in srgb, var(--accent) 52%, #fff)', pinRing: '#fff',
  } : {
    sea: '#e2f0ee', land: '#ffffff', coast: 'rgba(15,118,110,.38)', river: 'rgba(13,148,136,.34)', grid: 'rgba(15,118,110,.07)', seaName: 'rgba(15,118,110,.55)',
    ground: 'var(--surface)', label: 'var(--ink)', halo: 'rgba(255,255,255,.96)', acc: 'var(--accent)', pinRing: '#fff',
  };

  /* ---------- map: projection, camera, base layer ---------- */
  const FALLBACK = { proj: { lonMin: -4, latMax: 54, lat0: 34, cos: Math.cos(34 * Math.PI / 180), k: 200 }, size: [10612, 8400], land: '', lakes: '', rivers: '', seas: [] };
  const mapData = () => ctx.map?.proj ? ctx.map : FALLBACK;
  const project = (m, lon, lat) => ({ x: (lon - m.proj.lonMin) * m.proj.cos * m.proj.k, y: (m.proj.latMax - lat) * m.proj.k });
  const toScreen = (c, p) => ({ x: CX + (p.x - c.x) * c.s, y: CY + (p.y - c.y) * c.s });

  /** Camera (centre in map units + scale in px per unit) that frames the places inside FIT. */
  function fitCam(pts, k) {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let s = Math.min((FIT.right - FIT.left) / Math.max(x1 - x0, 1), (FIT.bottom - FIT.top) / Math.max(y1 - y0, 1));
    s = Math.min(s, W / ((pts.length === 1 ? 7.5 : 1.6) * k));        // never closer than ~1.6 degrees across (one pin: ~7.5, for context)
    s = Math.max(s, W / (42 * k));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s };
  }
  /** Move between two cameras; when they are far apart, zoom out on the way so it reads as one journey. */
  function fly(a, b, e) {
    const s0 = Math.min(a.s, b.s), d = Math.hypot(b.x - a.x, b.y - a.y);
    const need = Math.min(s0, W * .75 / Math.max(d, 1));
    const s = Math.exp(lerp(Math.log(a.s), Math.log(b.s), e)) * (1 - (1 - need / s0) * Math.sin(Math.PI * e));
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), s };
  }

  /** The base map as one SVG (sea, graticule, land, lakes, rivers); land fades out at the data's edges. */
  function baseMap(parent, P) {
    const m = mapData(); const [mw, mh] = m.size;
    const root = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, parent); root.style.cssText = 'position:absolute;left:0;top:0';
    const defs = svgEl('defs', {}, root);
    for (const [id, x2, y2] of [['x', mw, 0], ['y', 0, mh]]) {
      const g = svgEl('linearGradient', { id: `story-g${id}`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2, y2 }, defs);
      for (const [o, a] of [[0, 0], [.06, 1], [.94, 1], [1, 0]]) svgEl('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, g);
      const k = svgEl('mask', { id: `story-m${id}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: mw, height: mh }, defs);
      svgEl('rect', { width: mw, height: mh, fill: `url(#story-g${id})` }, k);
    }
    svgEl('rect', { width: W, height: H }, root).style.fill = P.sea;
    const cam = svgEl('g', {}, root);
    let grid = '';
    for (let lon = -5; lon <= 60; lon += 5) grid += `M${r1(project(m, lon, 0).x)} 0V${mh}`;
    for (let lat = 10; lat <= 55; lat += 5) grid += `M0 ${r1(project(m, 0, lat).y)}H${mw}`;
    const line = (d, st) => { const p = svgEl('path', { d, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }); Object.assign(p.style, st); return p; };
    cam.appendChild(line(grid, { fill: 'none', stroke: P.grid, strokeWidth: 1.5 }));
    const g = svgEl('g', { mask: 'url(#story-my)' }, svgEl('g', { mask: 'url(#story-mx)' }, cam));
    g.appendChild(line(m.land, { fill: P.land, stroke: P.coast, strokeWidth: 1.6 }));
    if (m.lakes) g.appendChild(line(m.lakes, { fill: P.sea, stroke: P.coast, strokeWidth: 1.2 }));
    if (m.rivers) g.appendChild(line(m.rivers, { fill: 'none', stroke: P.river, strokeWidth: 2.2 }));
    return c => cam.setAttribute('transform', `translate(${r1(CX - c.x * c.s)} ${r1(CY - c.y * c.s)}) scale(${c.s.toFixed(5)})`);
  }

  /** When each pin appears: when its name is spoken, else spread over the line; carried-over pins are already there. */
  function popTimes(seg, pts, carried) {
    const words = wordTimes(seg); let wi = 0;
    const spoken = pts.map(p => {
      const first = norm(p.name.split(/[\s(]/)[0]);
      for (let k = wi; k < words.length; k++) if (norm(words[k].w) === first) { wi = k + 1; return words[k].a - .05; }
      return null;
    });
    const n = pts.length, t0 = seg.start + .35, t1 = Math.max(t0 + .7 * (n - 1), seg.start + seg.dur * .78);
    const res = pts.map((p, i) => carried.has(p.key) ? seg.start - 1 : spoken[i] ?? (n === 1 ? t0 : lerp(t0, t1, i / (n - 1))));
    for (let i = 1; i < n; i++) res[i] = Math.max(res[i], res[i - 1] + .6);   // the route needs time to draw
    return res;
  }

  /** Times for words shown on screen: when the same word is spoken, else spread between known neighbours. */
  function alignWords(shown, seg) {
    const spoken = wordTimes(seg); const res = []; let j = 0;
    for (const w of shown) {
      let hit = -1; for (let k = j; k < Math.min(spoken.length, j + 6); k++) if (norm(spoken[k].w) === norm(w)) { hit = k; break; }
      if (hit >= 0) { res.push(spoken[hit].a); j = hit + 1; } else res.push(null);
    }
    const known = res.map((v, i) => v == null ? null : i).filter(v => v != null);
    const first = seg.start + .1, last = seg.start + seg.dur * .85;
    return res.map((v, i) => {
      if (v != null) return v;
      const a = known.filter(k => k < i).pop(), b = known.find(k => k > i);
      const ta = a == null ? first : res[a], tb = b == null ? last : res[b], ia = a == null ? -1 : a, ib = b == null ? shown.length : b;
      return lerp(ta, tb, (i - ia) / (ib - ia));
    });
  }

  /* ---------- fonts the stat and word scenes need: loaded only when a reel uses them. The faces are added
     to document.fonts while setup() builds the reel, so its `await document.fonts.ready` waits for them. */
  const FONT_DIR = '../../assets/fonts/';                              // relative to stage.html
  const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const FACES = {
    stat: [['Story Number', 'Inter-ExtraBold-Latin.woff2', { weight: '800', unicodeRange: LATIN }]],
    word: [
      ['Story Hebrew', 'NotoSerifHebrew-SemiBold.woff2', { weight: '600' }],
      ['Story Greek', 'NotoSerif-Greek-SemiBold.woff2', { weight: '600', unicodeRange: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF' }],
      ['Story Greek', 'NotoSerif-GreekExt-SemiBold.woff2', { weight: '600', unicodeRange: 'U+1F00-1FFF' }],
      ['Story Italic', 'Lora-MediumItalic-Latin.woff2', { weight: '500', style: 'italic', unicodeRange: LATIN }],
      ['Story Italic', 'Lora-MediumItalic-LatinExt.woff2', { weight: '500', style: 'italic', unicodeRange: LATIN_EXT }],
    ],
  };
  const fonts = { asked: new Set(), error: null };
  function needFonts(scene) {
    if (fonts.asked.has(scene)) return; fonts.asked.add(scene);
    for (const [family, file, desc] of FACES[scene]) {
      const face = new FontFace(family, `url("${FONT_DIR}${file}")`, desc);
      document.fonts.add(face);
      face.load().catch(() => { fonts.error = new Error(`reel-story: font ${file} did not load (assets/fonts/)`); });
    }
  }

  /** When each shown item is spoken: the first later spoken word that matches one of its words (4+ letters),
   *  else its share of [a, b] kept between the known neighbours; never before a, at least gap apart, all by limit. */
  const STOP = new Set(['naar', 'werd', 'zijn', 'haar', 'heeft', 'hebben', 'over', 'voor', 'door', 'deze', 'maar', 'want', 'toen', 'daar', 'waar', 'wordt', 'worden',
    'tegen', 'onder', 'veel', 'later', 'alle', 'heel', 'hele', 'eerst', 'samen', 'juist', 'staat', 'komt', 'kwam', 'wat', 'jouw', 'zich']);
  function cueTimes(items, seg, a, b, gap = .45, limit = Infinity) {
    const spoken = wordTimes(seg).map(w => ({ n: norm(w.w), a: w.a })); let j = 0;
    const hit = items.map(txt => {
      const keys = String(txt).split(/\s+/).map(norm).filter(k => k.length >= 4 && !STOP.has(k));
      for (let q = j; q < spoken.length; q++) {
        const n = spoken[q].n;
        if (keys.some(k => n === k || (n.startsWith(k) && n.length - k.length <= 2))) { j = q + 1; return spoken[q].a - .05; }
      }
      return null;
    });
    const n = items.length;
    const res = hit.map((v, i) => {
      if (v != null) return Math.max(a, v);
      let t = n === 1 ? a : lerp(a, b, i / (n - 1));
      const prev = hit.slice(0, i).findLastIndex(x => x != null), next = hit.findIndex((x, k) => k > i && x != null);
      if (prev >= 0) t = Math.max(t, hit[prev] + gap * (i - prev));
      if (next >= 0) t = Math.min(t, hit[next] - gap * (next - i));
      return Math.max(a, t);
    });
    for (let i = 1; i < n; i++) res[i] = Math.max(res[i], res[i - 1] + gap);
    const last = res[n - 1];
    if (last > limit && n > 1) { const f = Math.max(0, limit - res[0]) / (last - res[0]); return res.map(x => res[0] + (x - res[0]) * f); }
    return res;
  }

  /** How a whole number can be spoken in Dutch ("honderd", "vijftienhonderd", "tweeëntwintig"); [] when not a whole number. */
  const NL = ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien'];
  const NL_TENS = ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig'];
  function dutch(n) {
    if (n < 20) return NL[n];
    if (n < 100) { const u = n % 10, t = NL_TENS[Math.floor(n / 10)]; return u ? `${NL[u]}${u === 2 || u === 3 ? 'ën' : 'en'}${t}` : t; }
    if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return `${h > 1 ? NL[h] : ''}honderd${r ? dutch(r) : ''}`; }
    const k = Math.floor(n / 1000), r = n % 1000; return `${k > 1 ? dutch(k) : ''}duizend${r ? dutch(r) : ''}`;
  }
  const dutchNumber = n => {
    if (!Number.isInteger(n) || n < 0 || n >= 1e6) return [];
    const ways = [dutch(n)];
    if (n > 1000 && n < 10000 && n % 100 === 0 && n % 1000) ways.push(`${dutch(n / 100)}honderd`);   // 1500: vijftienhonderd
    return ways;
  };

  T['reel-story'] = (spec, timing) => {
    const L = ground(spec.style || 'dark', spec); const P = palette(L);
    // text = the spoken line (subtitles and word timing use it), shown = the scene's own `text` field
    const segs = layout(T['reel-story'].units(spec), timing).map((s, i) => { const sc = i ? spec.scenes[i - 1] : { show: 'hook' }; return { ...s, ...sc, text: s.text, shown: sc.text, i }; });
    const talkEnd = endOf(segs) + .25;
    const duration = talkEnd + .4 + END;
    const endStart = duration - END;
    const until = i => segs[i + 1]?.start ?? endStart;
    /** Scene visibility: fades in around its start, out around the next start (the last one stays under the end card). */
    const vis = (i, t) => {
      const s = segs[i]; const a = out(prog(t, s.start - FADE, s.start + .05));
      const b = i === segs.length - 1 ? 0 : inout(prog(t, until(i) - FADE + .05, until(i) + .05));
      return { a, o: a * (1 - b) };
    };

    /* ---- map runs: consecutive map scenes share one map and the camera flies between them */
    const m = mapData(); const k = m.proj.k;
    const runs = []; segs.forEach((s, i) => { if (s.show !== 'map') return; const r = runs[runs.length - 1]; if (r && r[r.length - 1] === i - 1) r.push(i); else runs.push([i]); });
    const preview = runs.length > 0;                                 // the hook sits on the first map's region, zoomed out and dimmed
    const mapFirst = runs[0]?.[0] === 1;                             // ...and when the map comes next, the camera flies on in from there
    let mapLayer = null, setCam = null, overlay = null, shade = null, seaNames = [];
    const mapScenes = {};
    if (runs.length) {
      mapLayer = el('div', 'abs full'); mapLayer.style.opacity = 0;
      setCam = baseMap(mapLayer, P);
      seaNames = (m.seas || []).map(sn => {
        const e = el('div', 'abs serif', mapLayer, esc(sn.name));
        css(e, { left: 0, top: 0, whiteSpace: 'nowrap', fontStyle: 'italic', fontWeight: 500, fontSize: Math.round(34 * (sn.size || 1)) + 'px', letterSpacing: '3px', color: P.seaName });
        return { e, p: project(m, sn.lon, sn.lat), rot: sn.rotate || 0, w: 0, h: 0 };
      });
      shade = el('div', 'abs full', mapLayer);   // the map melts into the ground at the top and under the subtitles
      const routeSvg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, mapLayer); routeSvg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
      overlay = el('div', 'abs full', mapLayer);
      for (const run of runs) run.forEach((i, ri) => {
        const s = segs[i];
        const pts = s.places.map(key => { const pl = ctx.places[key]; return pl ? { key, name: pl.name, ...project(m, pl.lon, pl.lat) } : null; }).filter(Boolean);
        if (!pts.length) return;
        const prev = ri ? mapScenes[run[ri - 1]] : null;
        const carried = new Set(prev ? prev.pts.map(p => p.key).filter(key => pts.some(p => p.key === key)) : []);
        const cam = fitCam(pts, k);
        const pops = popTimes(s, pts, carried);
        // routes: gentle arcs that bow away from the middle of the route
        const mid = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
        let bow = null;                                // the previous leg's bulge, so a leg that turns back bows the other way
        const legs = pts.slice(1).map((b, j) => {
          const a = pts[j]; const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          let side = (cx - mid.x) * nx + (cy - mid.y) * ny >= 0 ? 1 : -1;
          if (bow && (dx * bow.dx + dy * bow.dy) / len < -.6) side = nx * bow.nx + ny * bow.ny > 0 ? -1 : 1;
          bow = { dx: dx / len, dy: dy / len, nx: nx * side, ny: ny * side };
          const c = { x: cx + nx * len * .16 * side, y: cy + ny * len * .16 * side };
          const casing = svgEl('path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, routeSvg);
          Object.assign(casing.style, { stroke: P.halo, strokeWidth: 12, opacity: .5 });
          const path = svgEl('path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': '0.1 17' }, routeSvg);
          Object.assign(path.style, { stroke: P.acc, strokeWidth: 9 });
          const head = el('div', 'abs', overlay); css(head, { left: 0, top: 0, width: '24px', height: '24px', borderRadius: '50%', background: '#fff', boxShadow: `0 0 0 7px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 28px 6px color-mix(in srgb, var(--accent) 70%, transparent)` });
          const a0 = pops[j] + .1, b0 = pops[j + 1] - .03;
          return { a, b, c, casing, path, head, t0: Math.max(a0, b0 - 1.15), t1: b0 };
        });
        const size = pts.length === 1 ? 42 : 34;
        const pins = pts.map(p => {
          const rings = [0, 1].map(() => { const r = el('div', 'abs', overlay); css(r, { left: 0, top: 0, width: size + 'px', height: size + 'px', borderRadius: '50%', boxSizing: 'border-box', border: `4px solid ${P.acc}` }); return r; });
          const dot = el('div', 'abs', overlay);
          css(dot, { left: 0, top: 0, width: size + 'px', height: size + 'px', borderRadius: '50%', boxSizing: 'border-box', background: 'var(--accent)', border: `${size > 34 ? 8 : 7}px solid ${P.pinRing}`, boxShadow: '0 4px 16px rgba(0,0,0,.45)' });
          const label = el('div', 'abs', overlay, esc(p.name));
          css(label, { left: 0, top: 0, whiteSpace: 'nowrap', fontWeight: 600, fontSize: (pts.length === 1 ? 52 : 44) + 'px', lineHeight: 1.15, letterSpacing: '-.3px', color: P.label,
            webkitTextStroke: `10px ${P.halo}`, paintOrder: 'stroke fill', textShadow: '0 2px 14px rgba(0,0,0,.35)' });
          return { p, rings, dot, label, off: null, w: 0, h: 0, r: size / 2 };
        });
        mapScenes[i] = { i, run, ri, pts, cam, pops, legs, pins, carried, prev, runEnd: until(run[run.length - 1]) };
      });
    }
    // which later scene in the run takes over a place (the earlier pin then hides)
    for (const sc of Object.values(mapScenes)) {
      const later = sc.run.slice(sc.ri + 1).map(j => mapScenes[j]).filter(Boolean);
      sc.pins.forEach(pin => { pin.hideAt = later.find(n => n.pts.some(q => q.key === pin.p.key))?.i; pin.hideAt = pin.hideAt == null ? Infinity : segs[pin.hideAt].start; });
      sc.next = sc.run[sc.ri + 1] != null ? mapScenes[sc.run[sc.ri + 1]] : null;
    }

    /** Camera at time t: within a run it eases from scene to scene; the first scene zooms in from a wider view. */
    const drift = (sc, t) => ({ ...sc.cam, s: sc.cam.s * (1 + .035 * prog(t, segs[sc.i].start, until(sc.i))) });
    function cameraAt(t) {
      const list = runs.map(r => r.map(i => mapScenes[i]).filter(Boolean)).filter(r => r.length);
      let run = list[0]; if (!run) return fitCam([{ x: 0, y: 0 }], k);
      for (const r of list) if (segs[r[0].i].start - 1 <= t) run = r;
      let ri = 0; run.forEach((sc, j) => { if (segs[sc.i].start - .15 <= t) ri = j; });
      const sc = run[ri]; const st = segs[sc.i].start;
      if (ri === 0) {
        const wide = s0 => ({ ...sc.cam, s: sc.cam.s * s0 });
        const hookEnd = segs[1]?.start ?? st;
        if (!mapFirst && t < hookEnd + .2) return wide(.5 + .06 * prog(t, 0, hookEnd));   // behind the hook only
        const from = mapFirst ? wide(.5 + .06 * prog(t, 0, st)) : wide(.8);
        const fromAt = mapFirst ? wide(.5 + .06 * prog(st - .2, 0, st)) : from;
        return fly(t < st - .2 ? from : fromAt, drift(sc, t), inout(prog(t, st - .2, st + 1.5)));
      }
      return fly(drift(run[ri - 1], st - .15), drift(sc, t), inout(prog(t, st - .15, st + 1.3)));
    }

    /** Labels: measured once fonts are in, then placed beside their pin where they hit nothing and stay in the safe area. */
    let placed = false;
    function placeLabels() {
      placed = true;
      for (const sn of seaNames) { sn.w = sn.e.offsetWidth; sn.h = sn.e.offsetHeight; }
      for (const sc of Object.values(mapScenes)) {
        const cam = { ...sc.cam, s: sc.cam.s * 1.0175 };
        const pos = sc.pts.map(p => toScreen(cam, p));
        const route = sc.legs.flatMap(l => { const a = toScreen(cam, l.a), b = toScreen(cam, l.b), c = toScreen(cam, l.c);
          return Array.from({ length: 15 }, (_, q) => { const u = q / 14; return { x: (1 - u) ** 2 * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, y: (1 - u) ** 2 * a.y + 2 * (1 - u) * u * c.y + u * u * b.y }; }); });
        const boxes = pos.map(p => ({ x: p.x - 22, y: p.y - 22, w: 44, h: 44 }));
        sc.pins.forEach((pin, j) => {
          pin.w = pin.label.offsetWidth; pin.h = pin.label.offsetHeight;
          const { w, h } = pin; const p = pos[j]; const g = pin.r + 13, d = pin.r + 5;
          const cands = [[g, -h / 2, 0], [-g - w, -h / 2, 1], [-w / 2, -g - h + 4, 2], [-w / 2, g - 4, 2], [d, -d - h + 8, 3], [d, d - 8, 3], [-d - w, -d - h + 8, 3], [-d - w, d - 8, 3]];
          const before = sc.prev?.pins.find(q => q.p.key === pin.p.key);   // carried over: keep its spot if it still works
          if (before?.off) cands.unshift([before.off.dx, before.off.dy, -1]);
          let best = null;
          for (const [dx, dy, pref] of cands) {
            const b = { x: p.x + dx, y: p.y + dy, w, h };
            let score = pref * 40;
            score += 30 * (Math.max(0, SAFE.left - b.x) + Math.max(0, b.x + w - SAFE.right) + Math.max(0, SAFE.top - b.y) + Math.max(0, b.y + h - SAFE.bottom));
            for (const o of boxes) score += overlap(b, o) / 8;
            for (const q of route) if (q.x > b.x - 6 && q.x < b.x + w + 6 && q.y > b.y - 6 && q.y < b.y + h + 6) score += 60;
            if (!best || score < best.score) best = { score, dx, dy, b };
          }
          pin.off = { dx: best.dx, dy: best.dy }; boxes.push(best.b);
          pin.moved = !!before && (before.off.dx !== best.dx || before.off.dy !== best.dy);   // then the new label waits for the old one
        });
      }
    }

    /* ---- the other scenes */
    const ACC = P.acc;
    const visuals = segs.map(s => {
      if (s.show === 'map') return null;
      const v = el('div', 'abs full'); v.style.opacity = 0;
      if (s.show === 'hook') {
        if (preview) v.style.background = `linear-gradient(180deg, color-mix(in srgb, ${P.ground} 72%, transparent), color-mix(in srgb, ${P.ground} 45%, transparent) 50%, color-mix(in srgb, ${P.ground} 80%, transparent))`;
        const box = el('div', '', v); css(box, { position: 'absolute', left: '96px', width: '840px', top: '300px', height: '1080px', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
        const bar = el('div', '', box); bar.style.cssText = 'width:124px;height:8px;border-radius:4px;background:var(--accent);margin-bottom:52px';
        const h = el('div', 'serif', box); h.style.cssText = `font-weight:600;font-size:${fit(s.text, [[30, 100], [55, 88], [999, 74]], 840)}px;line-height:1.1;letter-spacing:-1px;color:${L.ink}`;
        const words = s.text.split(/\s+/).filter(Boolean).map(w => { const e = el('span', '', h, esc(w)); e.style.display = 'inline-block'; h.append(' '); return e; });
        s.noCap = true;
        return { v, draw: t => {
          bar.style.width = 124 * out(prog(t, .05, .5)) + 'px';
          words.forEach((e, j) => { const q = out(prog(t, .12 + j * .055, .52 + j * .055)); set(e, q, (1 - q) * 26); });
        } };
      }
      if (s.show === 'timeline') {
        const ev = s.events; const n = ev.length; const focus = Math.min(s.focus ?? -1, n - 1);
        const gap = Math.min(250, Math.max(150, 860 / Math.max(1, n - 1))); const y0 = 830 - gap * (n - 1) / 2;
        const LX = 172;
        const track = el('div', '', v); css(track, { position: 'absolute', left: LX - 2 + 'px', width: '4px', top: y0 - 90 + 'px', height: gap * (n - 1) + 180 + 'px', borderRadius: '2px', background: `linear-gradient(180deg, transparent, ${L.line} 14%, ${L.line} 86%, transparent)` });
        const fill = el('div', '', v); css(fill, { position: 'absolute', left: LX - 3 + 'px', width: '6px', top: y0 - 60 + 'px', height: '0px', borderRadius: '3px', background: `linear-gradient(180deg, transparent, var(--accent) 60px)` });
        const card = el('div', '', v);
        const items = ev.map((e, j) => {
          const y = y0 + j * gap; const f = j === focus;
          const dot = el('div', '', v); const ds = f ? 46 : 30;
          css(dot, { position: 'absolute', left: LX - ds / 2 + 'px', top: y - ds / 2 + 'px', width: ds + 'px', height: ds + 'px', borderRadius: '50%', boxSizing: 'border-box',
            background: f ? 'var(--accent)' : P.ground, border: `${f ? 7 : 5}px solid ${f ? ACC : L.ink}`, boxShadow: f ? '0 0 0 10px color-mix(in srgb, var(--accent) 22%, transparent)' : 'none' });
          const tx = el('div', '', v); css(tx, { position: 'absolute', left: LX + 62 + 'px', width: SAFE.right - LX - 62 + 'px', top: y + 'px' });
          const yr = el('div', '', tx, esc(e.year)); yr.style.cssText = `font-weight:700;font-size:${f ? 76 : 54}px;line-height:1.05;letter-spacing:-1px;color:${L.ink}`;
          const lb = el('div', '', tx, esc(e.label)); lb.style.cssText = `margin-top:${f ? 10 : 6}px;font-weight:${f ? 600 : 400};font-size:${f ? 44 : 38}px;line-height:1.2;color:${f ? L.ink : L.body}`;
          return { y, f, dot, tx, yr };
        });
        // events in order over the first ~60% of the line (squeezed into a short line, so all of them show)
        const t0 = s.start + .25, t1 = Math.min(Math.max(t0 + .5 * (n - 1), s.start + s.dur * .6), Math.max(t0 + .2 * (n - 1), s.start + s.dur - .7));
        const times = ev.map((_, j) => n === 1 ? t0 : lerp(t0, t1, j / (n - 1)));
        const hl = Math.min(times[n - 1] + .4, Math.max(times[n - 1], s.start + s.dur - .35));
        let cardSet = false;
        return { v, draw: t => {
          if (!cardSet && focus >= 0) {   // the highlight card hugs the focus event's text (measured once fonts are in)
            cardSet = true; const it = items[focus]; const hgt = it.tx.offsetHeight;
            css(card, { position: 'absolute', left: LX - 56 + 'px', width: SAFE.right - LX + 56 + 'px', top: it.y - hgt / 2 - 28 + 'px', height: hgt + 56 + 'px', borderRadius: '28px',
              background: 'color-mix(in srgb, var(--accent) 16%, transparent)', border: '2px solid color-mix(in srgb, var(--accent) 42%, transparent)', boxSizing: 'border-box' });
          }
          // the accent line grows from event to event
          let yEnd = y0 - 60;
          items.forEach((it, j) => { const q = inout(prog(t, (times[j - 1] ?? s.start - .2) + .05, times[j])); if (q > 0) yEnd = lerp(j ? items[j - 1].y : y0 - 60, it.y, q); });
          yEnd = lerp(yEnd, items[n - 1].y + 70, inout(prog(t, times[n - 1], times[n - 1] + .6)));
          fill.style.height = Math.max(0, yEnd - (y0 - 60)) + 'px';
          const h = inout(prog(t, hl, hl + .55));
          items.forEach((it, j) => {
            const q = out(prog(t, times[j], times[j] + .4)); const pop = backOut(prog(t, times[j] - .05, times[j] + .35));
            it.dot.style.opacity = Math.min(1, q * 2) * (it.f || focus < 0 ? 1 : 1 - .45 * h); it.dot.style.transform = `scale(${pop})`;
            set(it.tx, q * (it.f || focus < 0 ? 1 : 1 - .45 * h), 0, 1, (1 - q) * 30);
            it.tx.style.transform += ' translateY(-50%)';
            if (it.f) it.yr.style.color = `color-mix(in srgb, ${ACC} ${Math.round(h * 100)}%, ${L.ink})`;
          });
          if (focus >= 0) { card.style.opacity = h; card.style.transform = `scale(${.97 + .03 * h})`; }
        } };
      }
      if (s.show === 'text') {
        const line = s.shown || s.say;
        const words = line.split(/\s+/).filter(Boolean);
        const spoken = new Set(String(s.say).split(/\s+/).map(norm));
        if (!s.shown || words.filter(w => spoken.has(norm(w))).length >= words.length * .7) s.noCap = true;   // the words are on screen
        const box = el('div', '', v); css(box, { position: 'absolute', left: '100px', width: '820px', top: '290px', height: '1070px', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
        const bar = el('div', '', box); bar.style.cssText = 'width:96px;height:8px;border-radius:4px;background:var(--accent);margin-bottom:48px';
        const p = el('div', 'serif', box); p.style.cssText = `font-weight:600;font-size:${fit(line, [[24, 96], [44, 86], [70, 78], [999, 68]], 820)}px;line-height:1.16;letter-spacing:-1px;color:${L.ink}`;
        const spans = words.map(w => { const e = el('span', '', p, esc(w)); e.style.display = 'inline-block'; p.append(' '); return e; });
        const times = alignWords(words, s);
        return { v, draw: t => {
          bar.style.width = 96 * out(prog(t, s.start - .2, s.start + .3)) + 'px';
          spans.forEach((e, j) => {
            const a = times[j]; const q = out(prog(t, a - .08, a + .3)); set(e, q, (1 - q) * 22);
            const c = prog(t, a + .1, a + .8); e.style.color = c < 1 ? `color-mix(in srgb, ${ACC} ${Math.round((1 - c) * 100)}%, ${L.ink})` : L.ink;
          });
        } };
      }
      if (s.show === 'verse' && s.verseData) {
        const box = el('div', '', v); css(box, { position: 'absolute', left: '96px', width: '830px', top: '290px', height: '1080px', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
        // opaque on the plain looks, so a map fading out behind it does not show through as a box
        const bg = L.look === 'photo' ? L.card : L.dark ? 'color-mix(in srgb, #fff 8%, var(--panel))' : L.card;
        const card = el('div', '', box); card.style.cssText = `background:${bg};border-radius:28px;padding:56px 56px 60px;box-sizing:border-box;border-left:8px solid var(--accent)`;
        const ey = el('div', '', card, vref(s.verseData.ref)); ey.style.cssText = `font-weight:700;font-size:28px;letter-spacing:3px;color:${L.accentText}`;
        const tx = el('div', 'serif', card, esc(s.verseData.text)); tx.style.cssText = `margin-top:28px;font-size:${fit(s.verseData.text, [[90, 62], [180, 52], [300, 44], [999, 38]], 710)}px;line-height:1.42;color:${L.ink}`;
        return { v, draw: t => {
          const q = out(prog(t, s.start - FADE, s.start + .4)); set(card, 1, (1 - q) * 40, .97 + .03 * q);
          const e = out(prog(t, s.start - FADE + .05, s.start + .3)); ey.style.opacity = e;     // the words arrive with the card
          const x = out(prog(t, s.start - FADE + .1, s.start + .45)); set(tx, x, (1 - x) * 16);
        } };
      }
      // cards on the stat/compare/word scenes: opaque on the plain looks (a map fading out behind does not show through)
      const cardBg = L.look === 'photo' ? 'rgba(6,14,18,.56)' : L.dark ? 'color-mix(in srgb, #fff 7%, var(--panel))' : 'var(--accent-faint)';
      const cardEdge = L.look === 'light' ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'rgba(255,255,255,.10)';
      const fade = (e, t, a, d = .4, dy = 18) => { const q = out(prog(t, a, a + d)); set(e, q, (1 - q) * dy); return q; };
      const flash = (t, a, base) => { const c = prog(t, a + .25, a + 1.05); return c < 1 ? `color-mix(in srgb, ${ACC} ${Math.round((1 - c) * 100)}%, ${base})` : base; };
      if (L.look === 'photo' && ['stat', 'tree', 'word'].includes(s.show)) v.style.textShadow = '0 2px 18px rgba(0,0,0,.5)';   // free text over a busy photo

      if (s.show === 'stat') {
        // a big number counts up from 0 (prefix/suffix kept), a ring (short numbers) or a bar fills with it
        needFonts('stat');
        const val = String(s.stat.value).trim();
        const m = val.match(/^(.*?)(\d[\d.,]*\d|\d)(.*)$/) || ['', '', '', val];
        const [, pre, num, suf] = m;
        const grouped = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(num), decSep = grouped || num.includes(',') ? ',' : '.';   // Dutch: 1.500 / 2,5
        const [ip, fp = ''] = (grouped ? num.replace(/\./g, '') : num).split(decSep);
        const target = Number(ip.replace(/\D/g, '') + (fp ? '.' + fp.replace(/\D/g, '') : '')) || 0;
        const fmt = x => { const [a, b] = x.toFixed(fp.length).split('.'); return (grouped ? a.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : a) + (b ? decSep + b : ''); };
        const box = el('div', '', v); css(box, { position: 'absolute', left: '160px', width: '760px', top: '290px', height: '1080px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' });
        const fig = el('div', '', box); css(fig, { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' });
        const R = 300, C = R + 24, CIRC = 2 * Math.PI * R;
        const ring = svgEl('svg', { width: 2 * C, height: 2 * C, viewBox: `0 0 ${2 * C} ${2 * C}` }, fig); ring.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;display:none';
        svgEl('circle', { cx: C, cy: C, r: R }, ring).style.fill = `color-mix(in srgb, var(--accent) ${L.dark ? 9 : 6}%, transparent)`;
        svgEl('circle', { cx: C, cy: C, r: R, fill: 'none' }, ring).style.cssText = `stroke:${L.line};stroke-width:6`;
        const burst = svgEl('circle', { cx: C, cy: C, r: R, fill: 'none' }, ring); burst.style.cssText = `stroke:${ACC};stroke-width:4;opacity:0`;
        const arc = svgEl('circle', { cx: C, cy: C, r: R, fill: 'none', transform: `rotate(-90 ${C} ${C})`, 'stroke-linecap': 'round', 'stroke-dasharray': `${CIRC} ${CIRC}` }, ring);
        arc.style.cssText = `stroke:${ACC};stroke-width:12`;
        const head = el('div', '', fig); css(head, { position: 'absolute', left: 0, top: 0, width: '26px', height: '26px', borderRadius: '50%', background: '#fff', opacity: 0, display: 'none',
          boxShadow: '0 0 0 7px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 30px 8px color-mix(in srgb, var(--accent) 70%, transparent)' });
        const numRow = el('div', '', fig); css(numRow, { position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'center', whiteSpace: 'nowrap',
          fontFamily: '"Story Number", var(--font-sans), Inter, sans-serif', fontWeight: 800, lineHeight: 1, letterSpacing: '-.045em', fontVariantNumeric: 'tabular-nums', color: ACC });
        const side = txt => { const e = el('span', '', numRow, esc(txt)); css(e, { fontSize: '.6em', letterSpacing: '-.02em', marginLeft: '.04em', marginRight: '.04em' }); return e; };
        if (pre) side(pre);
        const digits = el('span', '', numRow, esc(num)); css(digits, { display: 'inline-block', textAlign: suf ? 'right' : pre ? 'left' : 'center' });   // the count hugs its "+" or "x"
        if (suf) side(suf);
        const bar = el('div', '', box); css(bar, { position: 'relative', width: '520px', height: '10px', borderRadius: '5px', background: L.line, marginTop: '46px', overflow: 'hidden', display: 'none' });
        const barFill = el('div', '', bar); css(barFill, { position: 'absolute', left: 0, top: 0, bottom: 0, width: '0px', borderRadius: '5px', background: ACC });
        const label = el('div', '', box, esc(s.stat.label));
        label.style.cssText = `margin-top:48px;max-width:760px;font-weight:700;font-size:${fit(s.stat.label, [[24, 60], [40, 54], [999, 48]], 760)}px;line-height:1.15;letter-spacing:-.8px;color:${L.ink};text-wrap:balance`;
        const small = s.shown ? el('div', '', box, esc(s.shown)) : null;
        if (small) small.style.cssText = `margin-top:22px;max-width:700px;font-weight:500;font-size:${fit(s.shown, [[50, 38], [999, 34]], 700)}px;line-height:1.35;color:${L.muted};text-wrap:balance`;
        let mode = null;
        const lay = () => {   // measured once the fonts are in: size the number, fix the digits' width (prefix/suffix stay put while it counts)
          numRow.style.fontSize = '300px'; const w = numRow.offsetWidth;
          mode = w <= 600 ? 'ring' : 'bar';
          numRow.style.fontSize = Math.floor(300 * Math.min(1, (mode === 'ring' ? 490 : 740) / w)) + 'px';
          digits.style.width = digits.getBoundingClientRect().width + 'px';
          if (mode === 'ring') { ring.style.display = 'block'; head.style.display = 'block'; css(fig, { width: 2 * C + 'px', height: 2 * C + 'px' }); label.style.marginTop = '34px'; }
          else bar.style.display = 'block';
        };
        // the count starts with the scene and, when the number is spoken ("100" or "honderd"), slows to land on that word
        const said = fp ? [] : [ip, ...(target > 1 ? dutchNumber(target) : [])].map(norm);   // not "een": that is also the article
        const hit = wordTimes(s).find(w => said.includes(norm(w.w)));
        const c0 = s.start + .1, c1 = hit ? Math.min(c0 + 3.2, Math.max(c0 + .9, hit.a + .15)) : c0 + Math.min(1.1, Math.max(.6, s.dur * .45));
        return { v, draw: t => {
          if (!mode) lay();
          const k = 1 - Math.pow(1 - prog(t, c0, c1), 4);
          digits.textContent = k >= 1 ? num : fmt(target * k);
          const ap = out(prog(t, s.start - .3, s.start + .15));
          const pulse = .035 * Math.sin(Math.PI * prog(t, c1 - .05, c1 + .45));
          set(numRow, ap, (1 - ap) * 24, .94 + .06 * ap + pulse);
          if (mode === 'ring') {
            ring.style.opacity = ap; ring.style.transform = `scale(${.94 + .06 * ap})`;
            arc.setAttribute('stroke-dashoffset', r1(CIRC * (1 - k))); arc.style.opacity = k > 0 ? 1 : 0;
            const ang = -Math.PI / 2 + 2 * Math.PI * k;
            head.style.opacity = k > 0 ? Math.min(1, k * 10) * (1 - prog(t, c1, c1 + .35)) : 0;
            head.style.transform = `translate(${r1(C + R * Math.cos(ang) - 13)}px, ${r1(C + R * Math.sin(ang) - 13)}px)`;
            const b = prog(t, c1 - .05, c1 + .9);
            burst.style.opacity = b > 0 && b < 1 ? .55 * (1 - out(b)) : 0; burst.setAttribute('r', r1(R * (1 + .12 * out(b))));
          } else { bar.style.opacity = ap; barFill.style.width = r1(520 * k) + 'px'; }
          fade(label, t, c1 - .45, .5, 22);
          if (small) fade(small, t, c1 - .15, .45, 16);
        } };
      }

      if (s.show === 'tree') {
        // a family line, top to bottom in a gentle zig-zag: each person appears when their name is spoken, the line grows to them
        const n = s.tree.length;
        const gap = Math.min(n > 4 ? 200 : 250, 920 / (n - 1)), y0 = 815 - gap * (n - 1) / 2, D = n > 4 ? 58 : 64;
        const nodes = s.tree.map((it, j) => ({ ...it, x: j % 2 ? 340 : 200, y: y0 + j * gap }));
        const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, v); svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
        const links = nodes.slice(1).map((b, j) => {
          const a = nodes[j]; const d = `M${a.x} ${a.y}C${a.x} ${r1(a.y + gap * .62)} ${b.x} ${r1(b.y - gap * .62)} ${b.x} ${b.y}`;
          const glow = svgEl('path', { d, fill: 'none', 'stroke-linecap': 'round' }, svg); glow.style.cssText = `stroke:${ACC};stroke-width:18;opacity:.16`;
          const path = svgEl('path', { d, fill: 'none', 'stroke-linecap': 'round' }, svg); path.style.cssText = `stroke:${ACC};stroke-width:6`;
          const len = path.getTotalLength(); for (const p of [glow, path]) p.style.strokeDasharray = `${len} ${len}`;
          const hd = el('div', 'abs', v); css(hd, { left: 0, top: 0, width: '22px', height: '22px', borderRadius: '50%', background: '#fff', opacity: 0,
            boxShadow: '0 0 0 6px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 26px 6px color-mix(in srgb, var(--accent) 70%, transparent)' });
          return { glow, path, len, hd };
        });
        const people = nodes.map(nd => {
          const ring = el('div', 'abs', v); css(ring, { left: nd.x - D / 2 + 'px', top: nd.y - D / 2 + 'px', width: D + 'px', height: D + 'px', borderRadius: '50%', boxSizing: 'border-box', border: `4px solid ${ACC}`, opacity: 0 });
          const dot = el('div', 'abs', v); css(dot, { left: nd.x - D / 2 + 'px', top: nd.y - D / 2 + 'px', width: D + 'px', height: D + 'px', borderRadius: '50%', boxSizing: 'border-box',
            background: P.ground, border: `6px solid ${ACC}`, display: 'grid', placeItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.25)' });
          css(el('div', '', dot), { width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)' });
          const left = nd.x + D / 2 + 30, width = SAFE.right - left;
          const fs = fit(nd.name, [[10, 76], [16, 66], [24, 56]], width);
          const tx = el('div', 'abs', v); css(tx, { left: left + 'px', top: r1(nd.y - fs * .56) + 'px', width: width + 'px' });
          const nm = el('div', '', tx, esc(nd.name)); nm.style.cssText = `font-weight:700;font-size:${fs}px;line-height:1.12;letter-spacing:-1.2px;color:${L.ink}`;
          const nt = nd.note ? el('div', '', tx, esc(nd.note)) : null;
          if (nt) nt.style.cssText = `margin-top:6px;font-weight:500;font-size:${n > 4 ? 34 : 36}px;line-height:1.25;color:${L.muted}`;
          return { ring, dot, tx, nm, nt };
        });
        const pops = cueTimes(s.tree.map(x => x.name), s, s.start + .15, s.start + s.dur * .8, .55, Math.max(s.start + .5, until(s.i) - .7));
        pops[0] = Math.min(pops[0], s.start + .5);
        return { v, draw: t => {
          links.forEach((l, j) => {
            const t1 = pops[j + 1] - .02, t0 = Math.max(pops[j] + .1, t1 - .75);
            const u = inout(prog(t, t0, t1));
            l.path.style.strokeDashoffset = l.glow.style.strokeDashoffset = r1(l.len * (1 - u));
            l.path.style.opacity = u > 0 ? 1 : 0; l.glow.style.opacity = u > 0 ? .16 : 0;   // a round cap would show as a dot
            l.hd.style.opacity = u > 0 && u < 1 ? Math.min(1, u * 8, (1 - u) * 10) : 0;
            if (u > 0 && u < 1) { const p = l.path.getPointAtLength(l.len * u); l.hd.style.transform = `translate(${r1(p.x - 11)}px, ${r1(p.y - 11)}px)`; }
          });
          people.forEach((pe, j) => {
            const pt = pops[j]; const pp = prog(t, pt - .05, pt + .4);
            pe.dot.style.opacity = Math.min(1, pp * 3); pe.dot.style.transform = `scale(${backOut(pp)})`;
            const b = prog(t, pt, pt + .9); pe.ring.style.opacity = b > 0 && b < 1 ? .7 * (1 - out(b)) : 0; pe.ring.style.transform = `scale(${1 + 1.5 * out(b)})`;
            const q = out(prog(t, pt + .02, pt + .42)); set(pe.tx, q, 0, 1, (1 - q) * 28);
            pe.nm.style.color = flash(t, pt, L.ink);
            if (pe.nt) fade(pe.nt, t, pt + .2, .4, 10);
          });
        } };
      }

      if (s.show === 'compare') {
        // two cards side by side with a thin "vs" divider; the points appear one by one, left and right in turn
        const box = el('div', '', v); css(box, { position: 'absolute', left: '96px', width: '888px', top: '290px', height: '1080px', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
        const head = s.shown ? el('div', 'serif', box, esc(s.shown)) : null;
        if (head) head.style.cssText = `margin-bottom:52px;max-width:824px;font-weight:600;font-size:${fit(s.shown, [[30, 66], [60, 58], [999, 50]], 824)}px;line-height:1.12;letter-spacing:-.8px;color:${L.ink};text-wrap:balance`;
        const row = el('div', '', box); css(row, { position: 'relative', display: 'flex', gap: '48px', alignItems: 'stretch' });
        const longest = Math.max(...['left', 'right'].flatMap(k => s.compare[k].points.map(p => p.length)));
        const pfs = longest <= 18 ? 42 : longest <= 28 ? 40 : 36;
        const sides = ['left', 'right'].map((k, si) => {
          const d = s.compare[k];
          const card = el('div', '', row);   // the right card's text stays left of x=920 (padding-right), clear of the app buttons
          card.style.cssText = `flex:none;width:420px;box-sizing:border-box;background:${cardBg};border:2px solid ${cardEdge};border-radius:30px;padding:46px ${si ? 62 : 40}px 52px 40px`;
          const ti = el('div', '', card, esc(d.title)); ti.style.cssText = `font-weight:700;font-size:${fit(d.title, [[9, 64], [14, 54], [24, 46]], 314)}px;line-height:1.08;letter-spacing:-1.2px;color:${L.ink}`;
          const bar = el('div', '', card); bar.style.cssText = `margin:26px 0 38px;width:0;height:6px;border-radius:3px;background:${ACC}`;
          const pts = d.points.map((p, j) => {
            const r = el('div', '', card); r.style.cssText = `display:flex;gap:16px;align-items:flex-start;margin-top:${j ? 30 : 0}px`;
            const mk = el('div', '', r); mk.style.cssText = `flex:none;width:12px;height:12px;border-radius:50%;margin-top:${r1((pfs * 1.28 - 12) / 2)}px;background:${ACC}`;
            const tx = el('div', '', r, esc(p)); tx.style.cssText = `font-weight:500;font-size:${pfs}px;line-height:1.28;color:${L.body}`;
            return { r, mk, tx, text: p };
          });
          return { card, bar, pts };
        });
        const divider = el('div', '', row); css(divider, { position: 'absolute', left: '443px', top: '24px', bottom: '24px', width: '2px', background: `linear-gradient(180deg, transparent, ${L.line} 18%, ${L.line} 82%, transparent)` });
        const vs = el('div', '', row, 'vs'); css(vs, { position: 'absolute', left: '400px', top: '50%', width: '88px', height: '88px', marginTop: '-44px', borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: '34px', letterSpacing: '-.5px', lineHeight: 1,
          boxShadow: L.look === 'photo' ? '0 10px 30px rgba(0,0,0,.35)' : `0 0 0 10px ${P.ground}, 0 10px 30px rgba(0,0,0,.22)` });
        const seq = []; const [lp, rp] = sides.map(sd => sd.pts);
        for (let j = 0; j < Math.max(lp.length, rp.length); j++) { if (lp[j]) seq.push(lp[j]); if (rp[j]) seq.push(rp[j]); }
        const a = s.start + .75, lim = Math.max(a + .3, until(s.i) - .8);
        const times = cueTimes(seq.map(p => p.text), s, a, Math.min(lim, Math.max(a + .5 * (seq.length - 1), s.start + s.dur * .8)), .4, lim);
        return { v, draw: t => {
          if (head) fade(head, t, s.start - .3, .45, 16);
          sides.forEach((sd, si) => {
            const q = out(prog(t, s.start - .3 + si * .12, s.start + .35 + si * .12));
            set(sd.card, q, 0, 1, (1 - q) * (si ? 80 : -80));
            sd.bar.style.width = r1(72 * out(prog(t, s.start + .15 + si * .12, s.start + .65 + si * .12))) + 'px';
          });
          const dq = inout(prog(t, s.start + .05, s.start + .6)); divider.style.opacity = dq; divider.style.transform = `scaleY(${dq})`;
          const vq = prog(t, s.start + .2, s.start + .62); vs.style.opacity = Math.min(1, vq * 3); vs.style.transform = `scale(${backOut(vq)})`;
          seq.forEach((p, j) => {
            const q = out(prog(t, times[j] - .05, times[j] + .38)); set(p.r, q, (1 - q) * 18);
            p.mk.style.transform = `scale(${backOut(prog(t, times[j], times[j] + .35))})`;
            p.tx.style.color = flash(t, times[j], L.body);
          });
        } };
      }

      if (s.show === 'word') {
        // an original-language word: big serif in its own script (Hebrew right to left), revealed by a soft wipe
        // in reading direction, then the transliteration (italic), the meaning and, small, the verse
        needFonts('word');
        const wd = s.word; const heb = wd.lang === 'hebreeuws';
        const orig = heb ? wd.original.trim() : wd.original.trim().normalize('NFC');
        const box = el('div', '', v); css(box, { position: 'absolute', left: '160px', width: '760px', top: '290px', height: '1080px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' });
        const top = el('div', '', box); css(top, { display: 'flex', flexDirection: 'column', alignItems: 'center' });   // eyebrow + word: centred alone, rising when the rest comes
        const ey = el('div', '', top); css(ey, { display: 'flex', alignItems: 'center', gap: '22px', fontWeight: 700, fontSize: '28px', letterSpacing: '5px', color: L.accentText });
        const ruleL = el('div', '', ey); el('div', '', ey, heb ? 'HEBREEUWS' : 'GRIEKS'); const ruleR = el('div', '', ey);
        for (const r of [ruleL, ruleR]) r.style.cssText = `width:0;height:3px;border-radius:2px;background:${ACC}`;
        const wrap = el('div', '', top); css(wrap, { position: 'relative', marginTop: '22px' });
        const glow = el('div', '', wrap); css(glow, { position: 'absolute', left: '50%', top: '50%', width: '920px', height: '560px', marginLeft: '-460px', marginTop: '-280px', borderRadius: '50%', opacity: 0,
          background: `radial-gradient(closest-side, color-mix(in srgb, var(--accent) ${L.dark ? 30 : 15}%, transparent), transparent)` });
        const word = el('div', '', wrap, esc(orig)); word.dir = heb ? 'rtl' : 'ltr'; word.lang = heb ? 'he' : 'grc';
        css(word, { position: 'relative', display: 'inline-block', padding: '.1em .3em', fontFamily: heb ? '"Story Hebrew", serif' : '"Story Greek", serif', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', color: L.ink });
        const tr = el('div', '', box, esc(wd.translit)); css(tr, { fontFamily: '"Story Italic", var(--font-serif), Lora, serif', fontStyle: 'italic', fontWeight: 500,
          fontSize: fit(wd.translit, [[14, 66], [22, 58], [30, 50]], 760) + 'px', lineHeight: 1.2, color: L.accentText });
        const rule = el('div', '', box); css(rule, { marginTop: '40px', width: '0px', height: '4px', borderRadius: '2px', background: ACC, opacity: .7 });
        const mean = el('div', '', box, esc(wd.meaning)); css(mean, { marginTop: '36px', maxWidth: '760px', fontWeight: 600, fontSize: fit(wd.meaning, [[26, 60], [48, 52], [999, 46]], 760) + 'px',
          lineHeight: 1.2, letterSpacing: '-.6px', color: L.ink, textWrap: 'balance' });
        let card = null;
        if (s.verseData) {
          card = el('div', '', box); card.style.cssText = `margin-top:52px;width:760px;box-sizing:border-box;text-align:left;background:${cardBg};border-radius:24px;padding:28px 36px 32px;border-left:6px solid var(--accent)`;
          el('div', '', card, vref(s.verseData.ref)).style.cssText = `font-weight:700;font-size:24px;letter-spacing:3px;color:${L.accentText}`;
          el('div', 'serif', card, esc(s.verseData.text)).style.cssText = `margin-top:12px;font-size:${fit(s.verseData.text, [[90, 36], [160, 32], [999, 29]], 680)}px;line-height:1.4;color:${L.body}`;
        }
        let laid = false, dy = 0;
        const lay = () => {   // measured once the fonts are in: as big as fits; how far the word sits below its final place while alone
          if (!document.fonts.check(`600 100px "Story ${heb ? 'Hebrew' : 'Greek'}"`, orig)) throw new Error(`reel-story: the ${wd.lang} font is not loaded`);
          laid = true; const base = card ? (heb ? 230 : 190) : (heb ? 280 : 230);
          word.style.fontSize = base + 'px'; const w = word.getBoundingClientRect().width - .6 * base;
          word.style.fontSize = Math.floor(base * Math.min(1, 700 / Math.max(1, w))) + 'px';
          dy = Math.max(0, box.clientHeight / 2 - (top.offsetTop + top.offsetHeight / 2));
        };
        // the transliteration lands when the narrator says the word ("sjalom" counts for "shalom"), the meaning on its first
        // word spoken after that; without those, they follow the reveal
        const r0 = s.start - .15, r1w = s.start + 1.0;
        const sounds = x => norm(x).replace(/sj/g, 'sh');
        const spoken = wordTimes(s).map(x => ({ n: sounds(x.w), a: x.a }));
        const near = (n, k) => k.length >= 3 && (n === k || ((n.startsWith(k) || n.endsWith(k)) && n.length - k.length <= 2));
        const ti = spoken.findIndex(x => near(x.n, sounds(wd.translit.split(/\s+/)[0])));
        const keys = wd.meaning.split(/\s+/).map(sounds).filter(k => k.length >= 4 && !STOP.has(k));
        const mi = spoken.findIndex((x, q) => q > ti && keys.some(k => near(x.n, k)));
        const latest = Math.max(r1w + .2, until(s.i) - 1.8);   // the verse card still gets time to be read
        const tt = Math.min(latest - .5, Math.max(r1w - .3, ti >= 0 ? spoken[ti].a - .1 : 0));
        const mt = Math.min(latest, Math.max(tt + .55, mi >= 0 ? spoken[mi].a - .05 : tt + .9));
        const wipe = heb ? 'to left' : 'to right';
        return { v, draw: t => {
          if (!laid) lay();
          top.style.transform = `translateY(${r1(dy * (1 - inout(prog(t, tt - .45, tt + .3))))}px)`;
          const eq = fade(ey, t, s.start - .3, .45, 12); ruleL.style.width = ruleR.style.width = r1(56 * eq) + 'px';
          const p = inout(prog(t, r0, r1w)); const e = -30 + 160 * p;
          word.style.webkitMaskImage = word.style.maskImage = p < 1 ? `linear-gradient(${wipe}, #000 ${r1(e)}%, transparent ${r1(e + 30)}%)` : 'none';
          const wq = out(prog(t, r0, r1w + .3)); set(word, 1, (1 - wq) * 18, 1.04 - .04 * wq);
          glow.style.opacity = out(prog(t, s.start, r1w + .4)) * (.85 + .15 * Math.sin((t - s.start) * 1.6));
          fade(tr, t, tt, .5, 16);
          rule.style.width = r1(120 * inout(prog(t, tt + .2, tt + .75))) + 'px';
          fade(mean, t, mt, .45, 18);
          if (card) fade(card, t, mt + .3, .45, 24);
        } };
      }

      // photo (also the fallback when a verse is missing): full-bleed, slow Ken Burns, subtitles carry the words
      const ph = img(photoSrc(s.photo || hashNo(spec.id + s.i, ctx.photoCount || 365)), 'abs full photo', v);
      el('div', 'abs full scrim', v);
      el('div', 'abs full', v).style.background = 'linear-gradient(180deg, rgba(0,0,0,.25), transparent 22%, transparent 62%, rgba(0,0,0,.5))';
      const dir = s.i % 2 ? 1 : -1;
      return { v, draw: t => { const k2 = prog(t, s.start - FADE, until(s.i) + FADE); ph.style.transform = `translate(${dir * 24 * (k2 - .5)}px, ${-14 * k2}px) scale(${1.06 + .08 * k2})`; } };
    });

    const subs = subtitles(segs, spec.captions || 'block');
    const end = endCard(spec);

    return { width: W, height: H, duration, starts: segs.map(s => s.start), render(t) {
      if (fonts.error) throw fonts.error;   // never render the Hebrew/Greek word as boxes
      if (L.bg) L.bg.style.transform = `scale(${1 + .06 * (t / duration)})`;
      // scene layers
      segs.forEach((s, i) => {
        const vz = visuals[i]; if (!vz) return;
        const { a, o } = vis(i, t);
        vz.v.style.opacity = o; vz.v.style.transform = s.show === 'photo' ? 'none' : `translateY(${(1 - a) * 30}px)`;
        if (o > 0) vz.draw(t);
      });
      // map
      if (mapLayer) {
        if (!placed) placeLabels();
        const dimIn = .55 * out(prog(t, 0, .6));
        let op = mapFirst ? 0 : dimIn * (1 - inout(prog(t, until(0) - FADE + .05, until(0) + .05)));   // behind the hook
        for (const r of runs) {
          const a = out(prog(t, segs[r[0]].start - FADE, segs[r[0]].start + .05));
          const last = r[r.length - 1]; const b = last === segs.length - 1 ? 0 : inout(prog(t, until(last) - FADE + .05, until(last) + .05));
          op = Math.max(op, (r === runs[0] && mapFirst ? lerp(dimIn, 1, a) : a) * (1 - b));
        }
        mapLayer.style.opacity = op;
        if (op > 0) drawMap(t);
      }
      subs(t);
      end(t, endStart);
    } };

    function drawMap(t) {
      const cam = cameraAt(t); setCam(cam);
      // shade: always over the top safe area and under the subtitles; further in when zoomed out past the data's edges
      const mh = m.size[1], ys = f => toScreen(cam, { x: 0, y: mh * f }).y;
      const top1 = Math.max(360, ys(.17)), top0 = Math.min(Math.max(0, ys(.02)), top1 - 120);
      const bot0 = Math.min(1250, ys(.86)), bot1 = Math.max(bot0 + 120, Math.min(1560, ys(.97)));
      const g = a => `color-mix(in srgb, ${P.ground} ${a}%, transparent)`;
      shade.style.background = `linear-gradient(180deg, ${g(94)} 0, ${g(94)} ${r1(top0)}px, ${g(40)} ${r1(lerp(top0, top1, .45))}px, ${g(0)} ${r1(top1)}px, `
        + `${g(0)} ${r1(bot0)}px, ${g(50)} ${r1(lerp(bot0, bot1, .55))}px, ${g(86)} ${r1(bot1)}px, ${g(96)} 1920px)`;
      const boxes = [];
      for (const sc of Object.values(mapScenes)) {
        const st = segs[sc.i].start;
        const inK = t > sc.runEnd + .06 ? 0 : out(prog(t, st - .25, st + .1));   // only while its own run of map scenes shows
        const hist = sc.next ? prog(t, segs[sc.next.i].start - .3, segs[sc.next.i].start + .05) : 0;
        const pos = sc.pts.map(p => toScreen(cam, p));
        sc.legs.forEach((l, j) => {
          const u = inout(prog(t, l.t0, l.t1));
          const show = u > 0 && inK > 0;
          if (!show) { l.casing.style.opacity = 0; l.path.style.opacity = 0; l.head.style.opacity = 0; return; }
          const a = pos[j], b = pos[j + 1], c = toScreen(cam, l.c);
          const q0 = { x: lerp(a.x, c.x, u), y: lerp(a.y, c.y, u) }, q1 = { x: lerp(c.x, b.x, u), y: lerp(c.y, b.y, u) }, e = { x: lerp(q0.x, q1.x, u), y: lerp(q0.y, q1.y, u) };
          const d = `M${r1(a.x)} ${r1(a.y)}Q${r1(q0.x)} ${r1(q0.y)} ${r1(e.x)} ${r1(e.y)}`;
          const o = inK * lerp(1, .38, hist);
          l.casing.setAttribute('d', d); l.path.setAttribute('d', d); l.casing.style.opacity = .5 * o; l.path.style.opacity = o;
          const ho = u < 1 ? inK * (1 - hist) * Math.min(1, u * 8, (1 - u) * 12) : 0;
          l.head.style.opacity = ho; l.head.style.transform = `translate(${r1(e.x - 12)}px, ${r1(e.y - 12)}px)`;
        });
        sc.pins.forEach((pin, j) => {
          const p = pos[j]; const pt = sc.pops[j];
          const pp = prog(t, pt, pt + .42); const carried = sc.next && pin.hideAt === segs[sc.next.i].start;
          const gone = t >= pin.hideAt ? 0 : 1;
          const dim = carried ? 1 : lerp(1, .55, hist), shrink = carried ? 1 : lerp(1, .62, hist);
          const o = inK * Math.min(1, pp * 3) * gone; const R = pin.r;
          pin.dot.style.opacity = o * dim; pin.dot.style.transform = `translate(${r1(p.x - R)}px, ${r1(p.y - R)}px) scale(${backOut(pp) * shrink})`;
          // rings: a pulse for a single place, one burst when a route pin lands
          pin.rings.forEach((r, ri) => {
            let ph, a0;
            if (sc.pts.length === 1) { const per = 1.9; const tt = t - pt - .25 - ri * per / 2; ph = tt < 0 ? -1 : (tt % per) / per; a0 = .7; }
            else { ph = ri || sc.carried.has(pin.p.key) ? -1 : prog(t, pt + .05, pt + 1.0); a0 = .75; if (ph >= 1) ph = -1; }
            if (ph < 0 || ph >= 1) { r.style.opacity = 0; return; }
            r.style.opacity = o * (1 - hist) * a0 * (1 - out(ph)); r.style.transform = `translate(${r1(p.x - R)}px, ${r1(p.y - R)}px) scale(${1 + out(ph) * 2.4})`;
          });
          const la = pin.moved ? st + .05 : pt + .08; const lq = out(prog(t, la, la + .37));
          const lo = inK * lq * (1 - hist) * gone;
          pin.label.style.opacity = lo;
          const lx = p.x + pin.off.dx, ly = p.y + pin.off.dy;
          pin.label.style.transform = `translate(${r1(lx)}px, ${r1(ly + (1 - lq) * 10)}px)`;
          if (lo > .02) boxes.push({ x: lx - 16, y: ly - 12, w: pin.w + 32, h: pin.h + 24, o: lo });
          if (o > .02) boxes.push({ x: p.x - 30, y: p.y - 30, w: 60, h: 60, o });
        });
      }
      // sea names fade where a place label or pin needs the room
      for (const sn of seaNames) {
        const p = toScreen(cam, sn.p); const b = { x: p.x - sn.w / 2, y: p.y - sn.h / 2, w: sn.w, h: sn.h };
        let o = 1; for (const q of boxes) if (overlap(b, q) > 0) o = Math.min(o, 1 - q.o);
        if (b.x > W || b.x + b.w < 0 || b.y > H || b.y + b.h < 0) o = 0;
        sn.e.style.opacity = o; sn.e.style.transform = `translate(${r1(b.x)}px, ${r1(b.y)}px) rotate(${sn.rot}deg)`;
      }
    }
  };
  T['reel-story'].units = spec => [{ text: spec.hook }, ...spec.scenes.map(s => ({ text: s.say }))];
})();
