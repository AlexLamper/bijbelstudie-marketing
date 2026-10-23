// The 3D map journey set ("kaart"): a relief map of the Bible lands (real elevation, with the coast, lakes and
// rivers of map.json), a route that draws itself from place to place with pins and Dutch names, and a small
// caravan (a boat on the sea legs) travelling just ahead of the line. The camera starts on the first place,
// follows the travellers and ends on the whole journey.
// Elevation: engine/render/data/relief.png (scripts/build-relief.mjs) = ETOPO1 (NOAA NCEI, public domain) on a
// 0.05 degree grid over the map's box (lon -4..60, lat 12..54, north up), grey = 255 * sqrt(max(0, metres) / 5800).
// scene3d builds one world per map shot, so the heavy shared parts (relief, Path2D) are cached here per page.
// World frame: x east, z south (map units * s around the route's centre), y up; the route's long side is 60 units.
import { THREE, mat, mesh, at, rot, scl, group, G, V, clamp, lerp, prog, smooth, out, rng, faceted, blocky } from './core.js';
import { defineSet } from './sets.js';
import { person } from './people.js';

const W = 1080, H = 1920, FOV = 40;                       // portrait: ~23 degrees across
const TV = Math.tan(FOV * Math.PI / 360), TH = TV * W / H;
const SAFE = { x0: 170, x1: 910, y0: 500, y1: 1300 };     // where the whole route ends up (hook above, captions below)
const ROUTE = 60;                                         // the route's long side in world units
const ACC = '#0d9488', ACC_LIGHT = '#2dd4bf';
// extra spots for the sea names (map.json has one per sea, often far from the Bible lands' routes); the nearest in view is used
const SEA_SPOTS = { 'Middellandse Zee': [[32.3, 33.1], [24.5, 34.6], [29.5, 33.4]], 'Rode Zee': [[35.4, 26.6]], 'Perzische Golf': [[49.6, 28.6]], 'Zwarte Zee': [[33.5, 42.6]], 'Egeïsche Zee': [[25.4, 39.4]] };
const FOG = [.95, 2.5];                                   // haze from/to, in camera distances
const pinScale = d => .021 * d;                           // a pin ~110 px tall, whatever the zoom
const crewScale = d => .02 * d;                           // a person ~100 px tall

/* ---------- shared data (once per page) ---------- */
const RELIEF = { url: new URL('../data/relief.png', import.meta.url).href, lon0: -4, lat0: 54, step: .05, max: 5800 };
let reliefP = null;
const loadRelief = () => reliefP ||= new Promise((ok, bad) => {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; const m = new Float32Array(c.width * c.height);
    for (let i = 0; i < m.length; i++) { const v = d[i * 4] / 255; m[i] = v * v * RELIEF.max; }
    ok({ w: c.width, h: c.height, m });
  };
  im.onerror = () => bad(new Error('kaart: engine/render/data/relief.png did not load'));
  im.src = RELIEF.url;
});
/** Metres above sea level (0 for the sea and below), bilinear. */
function elevation(R, lon, lat) {
  const fx = clamp((lon - RELIEF.lon0) / RELIEF.step, 0, R.w - 1.001), fy = clamp((RELIEF.lat0 - lat) / RELIEF.step, 0, R.h - 1.001);
  const x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y, i = y * R.w + x;
  return (R.m[i] * (1 - u) + R.m[i + 1] * u) * (1 - v) + (R.m[i + R.w] * (1 - u) + R.m[i + R.w + 1] * u) * v;
}
const paths = new Map();
const path2d = d => { if (!paths.has(d)) paths.set(d, new Path2D(d)); return paths.get(d); };
/** SVG path data (M/m/L/l/Z, as written by scripts/build-map.mjs) -> polylines of [x, y]. */
function polylines(d) {
  const out = []; const tk = d.match(/[MmLlZz]|-?\d*\.?\d+/g) || []; let cmd = 'M', cur = null, x = 0, y = 0;
  for (let i = 0; i < tk.length;) {
    const t = tk[i];
    if (/[A-Za-z]/.test(t)) { cmd = t; i++; if (cmd === 'z' || cmd === 'Z') { if (cur?.length) cur.push([...cur[0]]); } continue; }
    const a = +tk[i], b = +tk[i + 1]; i += 2;
    if (cmd === 'M' || cmd === 'm') { x = cmd === 'M' ? a : x + a; y = cmd === 'M' ? b : y + b; cur = [[x, y]]; out.push(cur); cmd = cmd === 'M' ? 'L' : 'l'; }
    else { x = cmd === 'L' ? a : x + a; y = cmd === 'L' ? b : y + b; cur.push([x, y]); }
  }
  return out;
}
let hit = null;
const hitCtx = () => hit ||= document.createElement('canvas').getContext('2d');
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const backOut = x => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
/** Smooth value noise in [-1, 1] (2D, seeded), for gentle relief on flat land. */
function noise2(seed) {
  const r = rng(seed); const P = Array.from({ length: 256 }, () => r() * 2 - 1);
  const h = (i, j) => P[((i * 73856093) ^ (j * 19349663)) & 255];
  return (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = smooth(x - i), v = smooth(z - j);
    return lerp(lerp(h(i, j), h(i + 1, j), u), lerp(h(i, j + 1), h(i + 1, j + 1), u), v); };
}

/* ---------- colours (sRGB hex; mixed in linear space) ---------- */
const C = k => new THREE.Color(k);
const PAL = {
  sand: C('#e8cb92'), dry: C('#d4b779'), steppe: C('#bfb06d'), olive: C('#93a65a'), green: C('#7d9a4c'),
  hillDry: C('#c49a64'), hillGreen: C('#86904f'), rock: C('#97806a'), snow: C('#f4f1ea'), beach: C('#f0dfb0'),
  shallow: C('#8fd6cc'), deep: C('#2f7f98'), river: '#3d9fc4', sea: '#2b93b6', haze: '#dfe7e6',
};

/* ---------- small models: camel, donkey, boat (face +z, feet at y = 0) ---------- */
/** A limb from a to b (cylinder, radius r0 at a, r1 at b). */
function bone(parent, a, b, r0, r1, m, seg = 8) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A); const o = mesh(G.cyl(r1, r0, +d.length().toFixed(3), seg), m);
  o.position.copy(A).add(B).multiplyScalar(.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); parent.add(o); return o;
}
function animal(kind) {
  const camel = kind === 'kameel';
  const fur = mat(camel ? '#b5824c' : '#8d867e'), dark = mat(camel ? '#93683b' : '#6a635b'), cloth = mat('#b8382c'), stripe = mat('#efe3c4'), bag = mat('#7a5a3a');
  const root = new THREE.Group(); const body = group(root);
  const legH = camel ? 1.05 : .6, bodyY = camel ? 1.3 : .86;
  body.add(scl(at(mesh(G.sphere(.5), fur), 0, bodyY, 0), camel ? .56 : .42, camel ? .52 : .44, camel ? 1.25 : .95));
  if (camel) body.add(scl(at(mesh(G.sphere(.34), fur), 0, bodyY + .32, -.06), .95, .95, 1.3));
  // a blanket round the middle and two bags
  body.add(at(mesh(G.box(camel ? .7 : .52, camel ? .36 : .26, camel ? .5 : .42), cloth), 0, bodyY + (camel ? .26 : .14), -.06));
  body.add(at(mesh(G.box(camel ? .72 : .54, .06, camel ? .52 : .44), stripe), 0, bodyY + (camel ? .12 : .04), -.06));
  for (const sx of [1, -1]) body.add(at(mesh(G.box(.14, .3, .32), bag), sx * (camel ? .38 : .3), bodyY - (camel ? .05 : .1), camel ? -.42 : -.28));
  // neck (pivot at the shoulder) and head
  const neck = at(group(body), 0, bodyY + .04, camel ? .52 : .38);
  if (camel) { bone(neck, [0, 0, 0], [0, -.16, .46], .15, .1, fur); bone(neck, [0, -.16, .46], [0, .5, .66], .1, .085, fur); }
  else bone(neck, [0, 0, 0], [0, .36, .26], .14, .1, fur);
  const head = at(group(neck), 0, camel ? .54 : .4, camel ? .74 : .36); head.rotation.x = camel ? .15 : .55;
  head.add(at(mesh(G.box(camel ? .17 : .15, camel ? .19 : .18, camel ? .42 : .38), fur), 0, 0, .1));
  head.add(at(mesh(G.box(camel ? .15 : .14, .13, .12), dark), 0, -.03, camel ? .33 : .31));
  for (const sx of [1, -1]) head.add(rot(at(mesh(G.cone(camel ? .04 : .05, camel ? .1 : .3, 5), dark), sx * .07, camel ? .13 : .2, -.04), -.25, 0, sx * -.3));
  // legs: one swing per pair, diagonal pairs together
  const legs = [];
  for (const [x, z, ph] of [[.16, .44, 0], [-.16, .44, Math.PI], [.16, -.44, Math.PI], [-.16, -.44, 0]]) {
    const hip = at(group(body), x * (camel ? 1 : .85), legH + .02, z * (camel ? 1 : .78));
    bone(hip, [0, 0, 0], [0, -legH * .52, .02], camel ? .08 : .07, camel ? .055 : .05, dark, 6);
    bone(hip, [0, -legH * .52, .02], [0, -legH, 0], camel ? .055 : .05, camel ? .05 : .045, dark, 6);
    hip.add(at(mesh(G.box(camel ? .14 : .1, .05, camel ? .18 : .12), dark), 0, -legH + .02, .03));
    legs.push({ hip, ph });
  }
  const tail = at(group(body), 0, bodyY + .08, camel ? -.6 : -.45); bone(tail, [0, 0, 0], [0, -.38, -.08], .035, .02, dark, 5);
  return {
    root, height: camel ? 2.2 : 1.45,
    pose(phase, amount, t) {
      for (const l of legs) l.hip.rotation.x = Math.sin(phase + l.ph) * .42 * amount;
      body.position.y = Math.abs(Math.cos(phase)) * .04 * amount;
      neck.rotation.x = Math.sin(phase * 2) * .06 * amount + Math.sin(t * 1.3) * .04;
      tail.rotation.z = Math.sin(t * 2.1) * .25;
    },
  };
}
function boat() {
  const root = new THREE.Group(); const wood = mat('#8a5a36'), dark = mat('#5e3d25'), sail = mat('#f3ead6', { side: THREE.DoubleSide });
  root.add(scl(at(mesh(G.box(.8, .32, 1.5), wood), 0, .16, 0), 1, 1, 1));
  root.add(rot(scl(at(mesh(G.cone(.4, .7, 4), wood), 0, .16, 1.08), 1, 1, .45), Math.PI / 2, Math.PI / 4, 0));
  root.add(at(mesh(G.box(.84, .06, 1.54), dark), 0, .33, 0));
  root.add(at(mesh(G.cyl(.035, .04, 1.7), dark), 0, 1.05, .1));
  root.add(at(mesh(G.box(1.15, .95, .04), sail), 0, 1.25, .12));
  return { root, height: 1.9 };
}

/* ---------- the set ---------- */
defineSet('kaart', {
  spots: {},
  fixedCamera: true,
  build({ places = [], ctx: cx = {}, layer, shot = {}, seed = 'kaart' } = {}) {
    const M = cx.map; if (!M?.proj) throw new Error('kaart: no map data (engine/render/data/map.json)');
    const PR = M.proj;
    const lonOf = mx => mx / (PR.cos * PR.k) + PR.lonMin, latOf = my => PR.latMax - my / PR.k;
    const pts = places.map(key => { const p = cx.places?.[key]; return p ? { key, name: p.name, lon: p.lon, lat: p.lat, mx: (p.lon - PR.lonMin) * PR.cos * PR.k, my: (PR.latMax - p.lat) * PR.k } : null; }).filter(Boolean);
    if (!pts.length) throw new Error(`kaart: none of the places ${places.join(', ')} are in places.json`);
    // world frame: centre of the route, its long side ROUTE units (at least ~1.6 degrees, like the 2D map)
    const mxs = pts.map(p => p.mx), mys = pts.map(p => p.my);
    const c = { x: (Math.min(...mxs) + Math.max(...mxs)) / 2, y: (Math.min(...mys) + Math.max(...mys)) / 2 };
    const s = ROUTE / Math.max(Math.max(...mxs) - Math.min(...mxs), Math.max(...mys) - Math.min(...mys), 320);
    const toW = (mx, my) => [(mx - c.x) * s, (my - c.y) * s];
    const lonW = x => lonOf(x / s + c.x), latW = z => latOf(z / s + c.y);
    const degU = PR.k * s;                                          // world units per degree of latitude
    const hk = .44 * Math.pow(degU, .42);                           // height per km of elevation (more exaggerated zoomed out)
    pts.forEach(p => { [p.x, p.z] = toW(p.mx, p.my); });

    /* ---- route: gentle arcs (as on the 2D map), bowing to stay over land where it can; sampled every ~.25 units ---- */
    const mid = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, z: a.z + p.z / pts.length }), { x: 0, z: 0 });
    const landPath = path2d(M.land);
    const onLand = (x, z) => hitCtx().isPointInPath(landPath, x / s + c.x, z / s + c.y);
    const bez = (a, q, b, u) => [(1 - u) ** 2 * a.x + 2 * (1 - u) * u * q.x + u * u * b.x, (1 - u) ** 2 * a.z + 2 * (1 - u) * u * q.z + u * u * b.z];
    const R = [{ x: pts[0].x, z: pts[0].z, s: 0 }]; const legs = []; let bow = null;
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1], b = pts[j]; const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1e-3;
      const nx = -dz / len, nz = dx / len, mx0 = (a.x + b.x) / 2, mz0 = (a.z + b.z) / 2;
      let side = (mx0 - mid.x) * nx + (mz0 - mid.z) * nz >= 0 ? 1 : -1;
      if (bow && (dx * bow.dx + dz * bow.dz) / len < -.6) side = nx * bow.nx + nz * bow.nz > 0 ? -1 : 1;
      // the drier of a few bows (the usual one first: it wins a tie)
      let q = null, dry = -1;
      for (const k of [.14 * side, -.14 * side, .28 * side, -.28 * side, 0]) {
        const cq = { x: mx0 + nx * len * k, z: mz0 + nz * len * k }; let d = 0;
        for (let u = 1; u < 24; u++) { const [x, z] = bez(a, cq, b, u / 24); if (onLand(x, z)) d++; }
        if (d > dry + 1) { dry = d; q = cq; if (d === 23) break; }
      }
      const sd = Math.sign((q.x - mx0) * nx + (q.z - mz0) * nz) || side;
      bow = { dx: dx / len, dz: dz / len, nx: nx * sd, nz: nz * sd };
      const n = Math.max(12, Math.ceil(len / .25));
      for (let i = 1; i <= n; i++) {
        const [x, z] = bez(a, q, b, i / n);
        const pr = R[R.length - 1]; R.push({ x, z, s: pr.s + Math.hypot(x - pr.x, z - pr.z) });
      }
      legs.push({ from: legs.length ? legs[legs.length - 1].to : 0, to: R[R.length - 1].s });
    }
    const total = R[R.length - 1].s;
    const cum = [0, ...legs.map(l => l.to)];
    /** Point on the route at arc length a (before the start / after the end: straight on along the end tangent). */
    function along(a) {
      if (R.length < 2) return { x: R[0].x, z: R[0].z, dx: 0, dz: 1 };
      if (a <= 0 || a >= total) {
        const [p, q] = a <= 0 ? [R[0], R[Math.min(3, R.length - 1)]] : [R[Math.max(0, R.length - 4)], R[R.length - 1]];
        const l = Math.hypot(q.x - p.x, q.z - p.z) || 1, dx = (q.x - p.x) / l, dz = (q.z - p.z) / l, e = a <= 0 ? R[0] : R[R.length - 1], o = a <= 0 ? a : a - total;
        return { x: e.x + dx * o, z: e.z + dz * o, dx, dz };
      }
      let lo = 0, hi = R.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R[m].s <= a) lo = m; else hi = m; }
      const p = R[lo], q = R[hi], k = (a - p.s) / Math.max(1e-6, q.s - p.s), l = Math.max(1e-6, q.s - p.s);
      return { x: lerp(p.x, q.x, k), z: lerp(p.z, q.z, k), dx: (q.x - p.x) / l, dz: (q.z - p.z) / l, i: lo, k };
    }

    /* ---- timing: arrivals when the place is spoken (else spread over the line), departures shortly before ---- */
    const sg = shot.seg; const st = shot.start ?? 0, en = shot.end ?? st + 6;
    const words = sg && typeof wordTimes === 'function' ? wordTimes(sg) : []; let wi = 0;
    const spoken = pts.map(p => { const first = norm(p.name.split(/[\s(]/)[0]); for (let k = wi; k < words.length; k++) if (norm(words[k].w) === first) { wi = k + 1; return words[k].a; } return null; });
    const n = pts.length, ta = (sg ? sg.start : st) + .3, tb = Math.max(ta + 1.3 * (n - 1), (sg ? sg.start + sg.dur * .82 : en - .8));
    const T = pts.map((_, i) => {
      if (spoken[i] != null) return spoken[i];
      const pi = spoken.slice(0, i).findLastIndex(v => v != null), ni = spoken.findIndex((v, k) => k > i && v != null);
      const a0 = pi >= 0 ? spoken[pi] : ta, b0 = ni >= 0 ? spoken[ni] : tb, ia = pi >= 0 ? pi : 0, ib = ni >= 0 ? ni : n - 1;
      return ib === ia ? a0 : lerp(a0, b0, (i - ia) / (ib - ia));
    });
    T[0] = Math.min(T[0], st + .4);
    for (let i = 1; i < n; i++) T[i] = Math.max(T[i], T[i - 1] + 1.1);
    const limit = en - .6; if (n > 1 && T[n - 1] > limit) { const f = Math.max(.3, limit - T[0]) / (T[n - 1] - T[0]); for (let i = 1; i < n; i++) T[i] = T[0] + (T[i] - T[0]) * f; }
    const maxLeg = Math.max(...legs.map(l => l.to - l.from), 1e-3);
    const dep = legs.map((l, j) => Math.max(T[j] + .3, T[j + 1] - (1.1 + 1.9 * (l.to - l.from) / maxLeg)));
    const pops = T.map((x, i) => i === 0 ? st - .5 : x);              // the first place stands when the shot begins
    const rings = T.map((x, i) => i === 0 ? st + .1 : x + .05);
    /** Arc length the travellers have reached at time t. */
    function travel(t) {
      for (let j = 0; j < legs.length; j++) {
        if (t < dep[j]) return cum[j];
        if (t < T[j + 1]) { const x = prog(t, dep[j], T[j + 1]); return cum[j] + (cum[j + 1] - cum[j]) * (.6 * smooth(x) + .4 * x); }
      }
      return total;
    }
    // the line: just behind the last traveller while they walk; it reaches the place soon after they stop
    const LAG = .45; const lineAt = t => { const tr = travel(t); return Math.min(tr, Math.max(tr - 5.1 * crewScale(cam(t).d), travel(t - LAG))); };

    /* ---- camera plan: heading so the route fits the portrait frame, distances, then the shot's path ---- */
    const basis = (focus, hd, pitch, d) => {
      const fh = V(Math.sin(hd), 0, -Math.cos(hd));
      const pos = focus.clone().addScaledVector(fh, -d * Math.cos(pitch)).add(V(0, d * Math.sin(pitch), 0));
      const f = focus.clone().sub(pos).normalize(), r = f.clone().cross(V(0, 1, 0)).normalize(), u = r.clone().cross(f);
      return { pos, f, r, u, fh };
    };
    const screen = (b, p) => { const v = p.clone().sub(b.pos); const z = v.dot(b.f); return { x: W / 2 + v.dot(b.r) / z / TH * W / 2, y: H / 2 - v.dot(b.u) / z / TV * H / 2, z }; };
    const P3 = pts.map(p => V(p.x, 0, p.z));
    const routeP3 = R.filter((_, i) => i % 6 === 0).map(p => V(p.x, 0, p.z));
    function fit(points, focus0, hd, pitch, box = SAFE) {
      let focus = focus0.clone(), d = 60;
      for (let it = 0; it < 4; it++) {
        const ok = dd => { const b = basis(focus, hd, pitch, dd); return points.every(p => { const q = screen(b, p); return q.z > .5 && q.x >= box.x0 && q.x <= box.x1 && q.y >= box.y0 && q.y <= box.y1; }); };
        let lo = 2, hi = 4000; for (let i = 0; i < 26; i++) { const m = Math.sqrt(lo * hi); if (ok(m)) hi = m; else lo = m; } d = hi;
        // recentre: move the focus so the points' screen box sits in the middle of the safe box
        const b = basis(focus, hd, pitch, d); const q = points.map(p => screen(b, p));
        const ex = (Math.min(...q.map(v => v.x)) + Math.max(...q.map(v => v.x))) / 2 - (box.x0 + box.x1) / 2;
        const ey = (Math.min(...q.map(v => v.y)) + Math.max(...q.map(v => v.y))) / 2 - (box.y0 + box.y1) / 2;
        const upx = 2 * d * TV / H;                                   // world units per px at the focus
        focus.addScaledVector(b.r, ex * upx).addScaledVector(b.fh, -ey * upx / Math.sin(pitch));
      }
      return { focus, d };
    }
    const PITCH0 = 36 * Math.PI / 180, PITCH1 = 54 * Math.PI / 180;
    const centre = V(0, 0, 0);
    const travelDir = Math.atan2(pts[n - 1].x - pts[0].x, -(pts[n - 1].z - pts[0].z));   // heading of first -> last
    let best = null;
    for (let deg = -80; deg <= 80; deg += 5) {
      const hd = deg * Math.PI / 180; const F = fit(routeP3.concat(P3), centre, hd, PITCH1);
      const away = n > 1 && Math.hypot(pts[n - 1].x - pts[0].x, pts[n - 1].z - pts[0].z) > 8 ? Math.cos(travelDir - hd) : 0;
      const score = F.d * (1 + .22 * Math.abs(deg) / 90 - .06 * away);
      if (!best || score < best.score) best = { score, hd, ...F };
    }
    const HD = best.hd, D1 = Math.max(best.d, 95), F1 = best.focus;
    const D0 = Math.max(D1 * .42, 42);
    const camMemo = new Map();
    /** Camera state at t: focus follows the travellers (smoothed), then settles on the whole route; zooms out on the way. */
    function cam(t) {
      const key = Math.round(t * 1000); if (camMemo.has(key)) return camMemo.get(key);
      const hs = [0, .25, .5, .75, 1].map(dt => along(travel(t - dt))); const head = V(hs.reduce((a, p) => a + p.x, 0) / hs.length, 0, hs.reduce((a, p) => a + p.z, 0) / hs.length);
      const tl = T[n - 1]; const wEnd = n > 1 ? smooth(prog(t, tl - .9, Math.max(tl - .3, Math.min(en - .15, tl + 1.3)))) : smooth(prog(t, st, en));
      const f = smooth(n > 1 ? .55 * travel(t) / total + .45 * wEnd : wEnd);
      const focus = head.clone().lerp(F1, wEnd);
      const d = Math.exp(lerp(Math.log(D0), Math.log(D1), f));
      const pitch = lerp(PITCH0, PITCH1, f);
      const hd = HD + (.5 - prog(t, st, en)) * .14;
      const b = basis(focus, hd, pitch, d);
      const res = { pos: b.pos, target: focus, fov: FOV, d, f, hd };
      if (camMemo.size > 64) camMemo.clear(); camMemo.set(key, res); return res;
    }

    /* ---- crop: everything the camera can see this shot (up to the fog), inside the map's box ---- */
    const frustumGround = cm => {
      const b = basis(cm.target, cm.hd, Math.asin(clamp((cm.pos.y - cm.target.y) / cm.pos.distanceTo(cm.target), -1, 1)), cm.d);
      const far = cm.d * FOG[1] * 1.12, reach = Math.sqrt(Math.max(1, far * far - b.pos.y * b.pos.y));   // ground further away is all haze
      return [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, 0], [1, 0]].map(([sx, sy]) => {
        const dir = b.f.clone().addScaledVector(b.r, sx * TH).addScaledVector(b.u, sy * TV).normalize();
        const hz = Math.hypot(dir.x, dir.z) || 1e-6; const tt = dir.y < -1e-3 ? Math.min(-b.pos.y / dir.y, reach / hz) : reach / hz;
        return [b.pos.x + dir.x * tt, b.pos.z + dir.z * tt];
      });
    };
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity, nx0 = Infinity, nx1 = -Infinity, nz0 = Infinity, nz1 = -Infinity;
    for (let i = 0; i <= 40; i++) frustumGround(cam(lerp(st, en, i / 40))).forEach(([x, z], k) => {
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z);
      if (k !== 2 && k !== 3) { nx0 = Math.min(nx0, x); nx1 = Math.max(nx1, x); nz0 = Math.min(nz0, z); nz1 = Math.max(nz1, z); }   // the near half of the view
    });
    const rx0 = Math.min(...R.map(p => p.x)), rx1 = Math.max(...R.map(p => p.x)), rz0 = Math.min(...R.map(p => p.z)), rz1 = Math.max(...R.map(p => p.z));
    const [mx0, mz0] = toW(0, 0), [mx1, mz1] = toW(M.size[0], M.size[1]);
    const mapBox = { x0: mx0, z0: mz0, x1: mx1, z1: mz1 }, edgeW = degU * 4;   // the map data's box: everything fades out over its last 4 degrees
    const crop = { x0: Math.max(mx0, Math.min(bx0, rx0 - 20)), x1: Math.min(mx1, Math.max(bx1, rx1 + 20)), z0: Math.max(mz0, Math.min(bz0, rz0 - 20)), z1: Math.min(mz1, Math.max(bz1, rz1 + 20)) };
    const mg = 14 + ROUTE * .22;                                     // the fine part of the grid: the route and around it
    const inner = { x0: Math.max(crop.x0, Math.min(rx0 - mg, nx0)), x1: Math.min(crop.x1, Math.max(rx1 + mg, nx1)), z0: Math.max(crop.z0, Math.min(rz0 - mg, nz0)), z1: Math.min(crop.z1, Math.max(rz1 + mg, nz1)) };

    /* ---- scene, light, haze ---- */
    const scene = new THREE.Scene(); const haze = new THREE.Color(PAL.haze);
    scene.background = haze; scene.fog = new THREE.Fog(haze, 100, 300);
    const sunDir = V(-.55, .62, -.35).applyAxisAngle(V(0, 1, 0), -HD).normalize();   // from the upper left of the frame
    const sun = new THREE.DirectionalLight('#fff0d8', 3.1); sun.position.copy(sunDir.clone().multiplyScalar(100)); scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight('#dce9f7', '#8f7a5c', .95));
    const terrainGroup = group(scene);

    /* ---- the land (built once the relief is in) ---- */
    let ground = () => 0, shoreAt = () => 1;
    const ready = loadRelief().then(RF => {
      // rasters over the crop, padded so a blur sees what lies beyond the edge: land, lakes, rivers, nearness of the sea
      const longC = Math.max(crop.x1 - crop.x0, crop.z1 - crop.z0), cell = (inner.x1 - inner.x0) / 100;
      const raster = (ppu, blurU, draw) => {
        const pad = blurU * 2.5 + 2 / ppu, x0 = crop.x0 - pad, z0 = crop.z0 - pad;
        const cw = Math.max(8, Math.ceil((crop.x1 - crop.x0 + 2 * pad) * ppu)), ch = Math.max(8, Math.ceil((crop.z1 - crop.z0 + 2 * pad) * ppu));
        const src = document.createElement('canvas'); src.width = cw; src.height = ch; const g = src.getContext('2d');
        g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); const k = s * ppu; g.setTransform(k, 0, 0, k, (-c.x * s - x0) * ppu, (-c.y * s - z0) * ppu); g.fillStyle = g.strokeStyle = '#fff'; draw(g);
        const dst = document.createElement('canvas'); dst.width = cw; dst.height = ch; const g2 = dst.getContext('2d', { willReadFrequently: true });
        g2.fillStyle = '#000'; g2.fillRect(0, 0, cw, ch); g2.filter = `blur(${Math.max(.4, blurU * ppu).toFixed(2)}px)`; g2.drawImage(src, 0, 0);
        const d = g2.getImageData(0, 0, cw, ch).data; const f = new Float32Array(cw * ch); for (let i = 0; i < f.length; i++) f[i] = d[i * 4] / 255;
        return (x, z) => {
          const fx = clamp((x - x0) * ppu - .5, 0, cw - 1.001), fz = clamp((z - z0) * ppu - .5, 0, ch - 1.001);
          const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, q = j * cw + i;
          return (f[q] * (1 - u) + f[q + 1] * u) * (1 - v) + (f[q + cw] * (1 - u) + f[q + cw + 1] * u) * v;
        };
      };
      const ppu = Math.min(16, 1900 / longC);
      // zoomed far out a grid cell is wider than a small island: grow the land a little (blur + lower threshold) so islands stay
      const dil = .14 * smooth((cell / degU - .05) / .25), th = .5 - dil;
      const maskAt = raster(ppu, Math.min(cell * .4, .45) + cell * dil * 1.4, g => g.fill(path2d(M.land)));
      const onLandPts = pts.filter(p => hitCtx().isPointInPath(landPath, p.mx, p.my));
      const lakeAt = raster(ppu, cell * .5, g => { if (M.lakes) g.fill(path2d(M.lakes)); });
      const riverAt = raster(ppu, .8 + .35 * degU / 5, g => { if (M.rivers) { g.lineJoin = g.lineCap = 'round'; g.lineWidth = 1.6 / s; g.stroke(path2d(M.rivers)); } });
      const seaAt = raster(12 / (degU * 1.4), degU * 1.4, g => g.fill(path2d(M.land)));   // 1 = far from any sea
      shoreAt = (x, z) => {
        const m = maskAt(x, z); let S = m >= th ? (m - th) / (1 - th) : (m - th) / th;
        for (const p of onLandPts) { const d = Math.hypot(x - p.x, z - p.z) / (cell * 1.6); if (d < 1) S = Math.max(S, .7 * (1 - d * d)); }   // a place on land always has land under it
        return S;
      };

      // grid: fine and even over the route, coarser (growing) toward the crop's edges
      const axis = (a0, a1, b0, b1, nIn) => {
        const cl = (b1 - b0) / nIn; const mid = Array.from({ length: nIn + 1 }, (_, i) => b0 + cl * i);
        const grow = (from, to, dir) => { const o = []; let x = from, stp = cl; while (dir * (to - x) > 1e-6) { stp = Math.min(stp * 1.22, cl * 6); let nx = x + dir * stp; if (dir * (to - nx) < stp * .6) nx = to; o.push(nx); x = nx; } return o; };
        return [...grow(b0, a0, -1).reverse(), ...mid, ...grow(b1, a1, 1)];
      };
      const longIn = Math.max(inner.x1 - inner.x0, inner.z1 - inner.z0);
      const nCells = faceted() ? 112 : 132;
      const xs = axis(crop.x0, crop.x1, inner.x0, inner.x1, Math.max(8, Math.round(nCells * (inner.x1 - inner.x0) / longIn)));
      const zs = axis(crop.z0, crop.z1, inner.z0, inner.z1, Math.max(8, Math.round(nCells * (inner.z1 - inner.z0) / longIn)));
      const nx = xs.length, nz = zs.length;
      const rnd = rng(seed + 'terrain'); const nz2 = noise2(seed + 'hills');
      const hgt = new Float32Array(nx * nz), elev = new Float32Array(nx * nz), shore = new Float32Array(nx * nz), lk = new Float32Array(nx * nz);
      const landH = e => .3 + hk * Math.pow(Math.max(0, e) / 1000, .85);
      // lakes in view, each with its own water level (Van and Urmia lie high, the Dead Sea low)
      const lakes = (M.lakes ? polylines(M.lakes) : []).map(ring => {
        const wr = ring.map(([a, b]) => toW(a, b)); const x = wr.reduce((a, p) => a + p[0], 0) / wr.length, z = wr.reduce((a, p) => a + p[1], 0) / wr.length;
        return { wr, x, z, level: Math.max(.12, landH(elevation(RF, lonW(x), latW(z))) - .12) };
      }).filter(o => o.x > crop.x0 - 30 && o.x < crop.x1 + 30 && o.z > crop.z0 - 30 && o.z < crop.z1 + 30);
      const lakeLevel = (x, z) => { let b = null, bd = Infinity; for (const o of lakes) { const d = (o.x - x) ** 2 + (o.z - z) ** 2; if (d < bd) { bd = d; b = o; } } return b ? b.level : .12; };
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = xs[i], z = zs[j]; const dx = ((xs[Math.min(nx - 1, i + 1)] - xs[Math.max(0, i - 1)]) / 6), dz = ((zs[Math.min(nz - 1, j + 1)] - zs[Math.max(0, j - 1)]) / 6);
        let e = 0; for (const [ox, oz] of [[0, 0], [dx, dz], [-dx, dz], [dx, -dz], [-dx, -dz]]) e += elevation(RF, lonW(x + ox), latW(z + oz)); e /= 5;
        const S = shoreAt(x, z); const k = j * nx + i;
        const edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
        const jit = edge ? 0 : (rnd() - .5) * (faceted() ? .26 : .05);
        const L = lakeAt(x, z);
        let h;
        if (S >= 0) h = smooth(S / .45) * lerp(landH(e) + .22 * (nz2(x / 5, z / 5) + 1) * .5, L > .01 ? lakeLevel(x, z) - .45 : 0, smooth(L / .6)) + jit * smooth(S / .3);
        else h = Math.max(-.9, S * 1.4) + jit * .5;
        hgt[k] = h; elev[k] = e; shore[k] = S; lk[k] = L;
      }
      if (window.__debug3d) { let nan = 0, neg = 0, mn = 1e9, mx = -1e9; for (let k = 0; k < hgt.length; k++) { if (!Number.isFinite(hgt[k])) nan++; else { mn = Math.min(mn, hgt[k]); mx = Math.max(mx, hgt[k]); } if (hgt[k] < 0 && elev[k] > 50) neg++; }
        console.log('kaart terrain', JSON.stringify({ places, st, en, T, dep, nx, nz, nan, neg, mn, mx, s, degU, hk, D0, D1, HD: HD * 180 / Math.PI, crop, inner, ppu })); }
      // which diagonal each cell uses (varied, for a less regular low-poly look)
      const diag = new Uint8Array((nx - 1) * (nz - 1)); for (let k = 0; k < diag.length; k++) diag[k] = rnd() < .5 ? 1 : 0;
      ground = (x, z) => {   // height of the actual triangles at (x, z)
        if (x <= xs[0] || x >= xs[nx - 1] || z <= zs[0] || z >= zs[nz - 1]) return 0;
        let a = 0, b = nx - 1; while (b - a > 1) { const m = (a + b) >> 1; if (xs[m] <= x) a = m; else b = m; }
        let e = 0, f = nz - 1; while (f - e > 1) { const m = (e + f) >> 1; if (zs[m] <= z) e = m; else f = m; }
        const u = (x - xs[a]) / (xs[b] - xs[a]), v = (z - zs[e]) / (zs[f] - zs[e]);
        const h00 = hgt[e * nx + a], h10 = hgt[e * nx + b], h01 = hgt[f * nx + a], h11 = hgt[f * nx + b];
        if (diag[e * (nx - 1) + a]) return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
        return u >= v ? h00 + (h10 - h11 + h11 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
      };
      // colour of a spot: water depth, beach, desert to green (south/inland = dry, rivers and the wet north = green), rock, snow
      const tmp2 = new THREE.Color();
      const ramp = [[0, PAL.sand], [.3, PAL.dry], [.5, PAL.steppe], [.72, PAL.olive], [1, PAL.green]];
      const wetColour = (w, o) => { for (let i = 1; i < ramp.length; i++) if (w <= ramp[i][0] || i === ramp.length - 1) return o.copy(ramp[i - 1][1]).lerp(ramp[i][1], clamp((w - ramp[i - 1][0]) / (ramp[i][0] - ramp[i - 1][0]))); return o; };
      const colourAt = (x, z, e, S, out, L = 0) => {
        if (S < 0) return out.copy(PAL.shallow).lerp(PAL.deep, smooth(-S / .7));
        if (L > .72) return out.copy(PAL.shallow).lerp(PAL.deep, smooth((L - .72) / .28) * .6);
        const lat = latW(z); const lb = seaAt(x, z), rv = riverAt(x, z);   // lb: how much land is around (1 = far from any sea)
        const south = smooth((36.5 - lat) / 5.5), inland = smooth((lb - .6) / .35);
        const arid = clamp(south * (.55 + .45 * inland) + .45 * inland * smooth((39.5 - lat) / 4));
        const wet = clamp((1 - arid) * .85 + rv * 1.4 + .32 * smooth(e / 700) * (1 - inland) * smooth((lat - 30.8) / 1.2));
        wetColour(wet, out);
        const hill = smooth((e - 500) / 1300), rock = smooth((e - 1700) / 1100), snow = smooth((e - 2900) / 700) * smooth((lat - 30.5) / 2);
        out.lerp(tmp2.copy(PAL.hillDry).lerp(PAL.hillGreen, smooth(wet)), hill * .75).lerp(PAL.rock, rock * .85).lerp(PAL.snow, snow);
        if (S < .18 && e < 60 && rv < .3) out.lerp(PAL.beach, .55 * (1 - S / .18));
        return out;
      };
      const blocks = blocky() ? blockTerrain() : null;
      function blockTerrain() {   // blok: every cell a column, heights in steps, rivers coloured into the cells
        const riverCell = raster(ppu, cell * .3, g => { if (M.rivers) { g.lineJoin = g.lineCap = 'round'; g.lineWidth = cell * 1.1 / s; g.stroke(path2d(M.rivers)); } });
        const cxn = nx - 1, czn = nz - 1, step = Math.max(.22, hk * .26); const colH = new Float32Array(cxn * czn); const cols = []; const cc2 = new THREE.Color(); const shadeB = rng(seed + 'blok');
        for (let j = 0; j < czn; j++) for (let i = 0; i < cxn; i++) {
          const ks = [j * nx + i, j * nx + i + 1, (j + 1) * nx + i, (j + 1) * nx + i + 1]; const av = f => ks.reduce((a, k) => a + f[k], 0) / 4;
          const S = av(shore), h = av(hgt), x = (xs[i] + xs[i + 1]) / 2, z = (zs[j] + zs[j + 1]) / 2, L = av(lk);
          colH[j * cxn + i] = S < 0 ? -.45 : Math.max(step, Math.round(h / step) * step);
          colourAt(x, z, av(elev), S, cc2, L); if (S > 0 && L < .5 && riverCell(x, z) > .45) cc2.set(PAL.river);
          const jb = 1 + (shadeB() - .5) * .08; cols.push([cc2.r * jb, cc2.g * jb, cc2.b * jb]);
        }
        const P = [], Cl = [];
        const quad = (a, b, c2, d, cl) => { for (const v of [a, b, c2, a, c2, d]) { P.push(...v); Cl.push(...cl); } };
        for (let j = 0; j < czn; j++) for (let i = 0; i < cxn; i++) {
          const k = j * cxn + i, h = colH[k], cl = cols[k], x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
          quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], cl);
          const side = cl.map(v => v * .82); const nb = (ii, jj) => ii < 0 || jj < 0 || ii >= cxn || jj >= czn ? -2 : colH[jj * cxn + ii];
          let o = nb(i, j + 1); if (o < h) quad([x0, h, z1], [x0, o, z1], [x1, o, z1], [x1, h, z1], side);
          o = nb(i, j - 1); if (o < h) quad([x1, h, z0], [x1, o, z0], [x0, o, z0], [x0, h, z0], side);
          o = nb(i + 1, j); if (o < h) quad([x1, h, z1], [x1, o, z1], [x1, o, z0], [x1, h, z0], side);
          o = nb(i - 1, j); if (o < h) quad([x0, h, z0], [x0, o, z0], [x0, o, z1], [x0, h, z1], side);
        }
        ground = (x, z) => {
          if (x <= xs[0] || x >= xs[nx - 1] || z <= zs[0] || z >= zs[nz - 1]) return 0;
          let a = 0, b = nx - 1; while (b - a > 1) { const m = (a + b) >> 1; if (xs[m] <= x) a = m; else b = m; }
          let e = 0, f = nz - 1; while (f - e > 1) { const m = (e + f) >> 1; if (zs[m] <= z) e = m; else f = m; }
          return colH[e * cxn + a];
        };
        return { pos: new Float32Array(P), col: new Float32Array(Cl) };
      }
      const nTri = blocks ? 0 : (nx - 1) * (nz - 1) * 2;
      const pos = blocks ? blocks.pos : new Float32Array(nTri * 9), col = blocks ? blocks.col : new Float32Array(nTri * 9); let q = 0;
      const smoothLook = !faceted();
      const vcol = smoothLook ? Array.from({ length: nx * nz }, (_, k) => colourAt(xs[k % nx], zs[(k / nx) | 0], elev[k], shore[k], new THREE.Color(), lk[k])) : null;
      const shadeR = rng(seed + 'shade'); const cc = new THREE.Color();
      if (!blocks) for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const k00 = j * nx + i, k10 = k00 + 1, k01 = k00 + nx, k11 = k01 + 1;
        const tris = diag[j * (nx - 1) + i] ? [[k00, k01, k10], [k11, k10, k01]] : [[k00, k11, k10], [k00, k01, k11]];
        for (const tri of tris) {
          if (!smoothLook) {
            const x = tri.reduce((a, k) => a + xs[k % nx], 0) / 3, z = tri.reduce((a, k) => a + zs[(k / nx) | 0], 0) / 3;
            const e = tri.reduce((a, k) => a + elev[k], 0) / 3, L = tri.reduce((a, k) => a + lk[k], 0) / 3, hh = tri.reduce((a, k) => a + hgt[k], 0) / 3;
            let S = tri.reduce((a, k) => a + shore[k], 0) / 3; if (hh > .04 && S < .01) S = .01; else if (hh <= .04 && S >= 0) S = -.01;   // above the water = land colour
            colourAt(x, z, e, S, cc, L); const jb = 1 + (shadeR() - .5) * .09; cc.r *= jb; cc.g *= jb; cc.b *= jb;
          }
          for (const k of tri) {
            pos[q] = xs[k % nx]; pos[q + 1] = hgt[k]; pos[q + 2] = zs[(k / nx) | 0];
            const cl = smoothLook ? vcol[k] : cc; col[q] = cl.r; col[q + 1] = cl.g; col[q + 2] = cl.b; q += 3;
          }
        }
      }
      let geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (smoothLook) geo = weld(geo);
      geo.computeVertexNormals();
      const uv = new Float32Array(geo.attributes.position.count * 2); for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = geo.attributes.position.array[i * 3] / 7; uv[i * 2 + 1] = geo.attributes.position.array[i * 3 + 2] / 7; }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      // the style's surface with vertex colours; matte standard surfaces become Lambert (same look, cheaper per pixel)
      const base = mat('#ffffff', { rough: .95 });
      const tm = base.isMeshStandardMaterial && window.__kaartLambert !== false ? new THREE.MeshLambertMaterial({ flatShading: base.flatShading, map: base.map }) : base.clone();
      tm.vertexColors = true; edgeFade(tm, mapBox, edgeW);
      if (tm.map) { tm.map = tm.map.clone(); tm.map.repeat.set(1, 1); tm.map.needsUpdate = true; }
      terrainGroup.add(mesh(geo, tm, { cast: false, receive: false }));

      // rivers: flat ribbons on the land (blok: coloured into the cells)
      if (M.rivers && !blocks) {
        const rw = .2 + .0016 * D1; const rp = [], ri = [];
        for (const line of polylines(M.rivers)) {
          const wpts = line.map(([a, b]) => toW(a, b)).filter(([x, z]) => x > crop.x0 && x < crop.x1 && z > crop.z0 && z < crop.z1);
          if (wpts.length < 2) continue;
          const dense = []; for (let k = 1; k < wpts.length; k++) { const [x0, z0] = wpts[k - 1], [x1, z1] = wpts[k]; const m = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (cell * .5))); for (let u = 0; u < m; u++) dense.push([lerp(x0, x1, u / m), lerp(z0, z1, u / m)]); }
          dense.push(wpts[wpts.length - 1]);
          const base = rp.length / 3;
          dense.forEach(([x, z], k) => {
            const [xa, za] = dense[Math.max(0, k - 1)], [xb, zb] = dense[Math.min(dense.length - 1, k + 1)]; const l = Math.hypot(xb - xa, zb - za) || 1; const ox = -(zb - za) / l * rw / 2, oz = (xb - xa) / l * rw / 2;
            for (const sgn of [1, -1]) { const px = x + ox * sgn, pz = z + oz * sgn; rp.push(px, Math.max(ground(px, pz), ground(x, z), ground((px + x) / 2, (pz + z) / 2)) + .1, pz); }
            if (k) { const a = base + (k - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
          });
        }
        if (rp.length) {
          const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setIndex(ri); rg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(rp.length).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
          const rm = mat(PAL.river, { rough: .35, side: THREE.DoubleSide }).clone(); rm.polygonOffset = true; rm.polygonOffsetFactor = -2; rm.polygonOffsetUnits = -4; rm.flatShading = false;
          terrainGroup.add(mesh(rg, rm, { cast: false, receive: false }));
        }
      }
      // lake water: flat, at each lake's level
      for (const { wr, level } of lakes) {
        const contour = wr.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z)); if (contour.length < 3) continue;
        const faces = THREE.ShapeUtils.triangulateShape(contour, []); const lp = [];
        for (const f of faces) { const [a, b, c2] = f.map(i => contour[i]); const flip = (b.x - a.x) * (c2.y - a.y) - (b.y - a.y) * (c2.x - a.x) > 0; for (const v of flip ? [a, c2, b] : [a, b, c2]) lp.push(v.x, level, v.y); }
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.computeVertexNormals();
        terrainGroup.add(mesh(lg, mat(PAL.sea, { rough: .3, transparent: true, opacity: .85 }), { cast: false, receive: false }));
      }
      buildRoute();
    });

    /* ---- the sea: one plane at y = 0, gently moving facets ---- */
    const seaSegX = faceted() ? 44 : 64, seaW = crop.x1 - crop.x0, seaD = crop.z1 - crop.z0;
    const seaGeo = new THREE.PlaneGeometry(seaW, seaD, seaSegX, Math.max(4, Math.round(seaSegX * seaD / seaW))); seaGeo.rotateX(-Math.PI / 2); seaGeo.translate((crop.x0 + crop.x1) / 2, 0, (crop.z0 + crop.z1) / 2);
    const seaBase = Float32Array.from(seaGeo.attributes.position.array);
    const seaR = rng(seed + 'sea'); const seaPh = new Float32Array(seaBase.length / 3).map(() => seaR() * 6.283);
    const seaMesh = mesh(seaGeo, edgeFade(mat(PAL.sea, { rough: .3, transparent: true, opacity: .8 }).clone(), mapBox, edgeW), { cast: false, receive: false }); scene.add(seaMesh);

    /* ---- route: a raised tube that grows, a glowing tip; pins that pop up with a ring ---- */
    let tube = null, tubeSegs = 0, tubeRad = 6, tip = null;
    const pins = [];
    function buildRoute() {
      const lift = .55, r = .0024 * D1;
      const ys = R.map(p => Math.max(0, ground(p.x, p.z)));
      const ym = ys.map((_, i) => Math.max(...ys.slice(Math.max(0, i - 4), i + 5)));
      const yy = ym.map((_, i) => { const w = ym.slice(Math.max(0, i - 4), i + 5); return w.reduce((a, b) => a + b, 0) / w.length; });
      R.forEach((p, i) => { p.y = yy[i] + lift + r; });
      if (R.length > 1) {
        const curve = new THREE.CatmullRomCurve3(R.map(p => V(p.x, p.y, p.z)), false, 'centripetal');
        tubeSegs = R.length - 1; tubeRad = blocky() ? 4 : faceted() ? 6 : 10;
        const tm = mat(ACC_LIGHT, { rough: .5, emissive: ACC, glow: .35 });
        tube = mesh(new THREE.TubeGeometry(curve, tubeSegs, r, tubeRad, false), tm, { cast: false, receive: false });
        tube.geometry.setDrawRange(0, 0); tube.frustumCulled = false; scene.add(tube);
        tip = mesh(G.sphere(r * 1.9, 16, 12), mat('#ffffff', { emissive: '#ffffff', glow: .55 }), { cast: false }); scene.add(tip);
      }
      for (const p of pts) {
        const g = new THREE.Group(); const y = Math.max(0, ground(p.x, p.z)); g.position.set(p.x, y, p.z); scene.add(g);
        const stem = group(g);
        stem.add(at(mesh(G.cyl(.62, .7, .14, 18), mat('#ffffff')), 0, .07, 0));
        stem.add(at(mesh(G.cyl(.46, .46, .16, 18), mat(ACC)), 0, .1, 0));
        stem.add(at(mesh(G.cyl(.07, .07, 1.5, 8), mat('#ffffff')), 0, .8, 0));
        stem.add(at(mesh(G.sphere(.42), mat(ACC, { emissive: ACC, glow: .25 })), 0, 1.6, 0));
        const ring = mesh(new THREE.RingGeometry(.8, 1.0, faceted() ? 12 : 40), new THREE.MeshBasicMaterial({ color: ACC_LIGHT, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }), { cast: false, receive: false });
        ring.rotation.x = -Math.PI / 2; ring.position.y = .12; g.add(ring);
        pins.push({ p, g, stem, ring, y });
      }
    }

    /* ---- travellers: a caravan on land, a boat at sea ---- */
    const desert = pts.some(p => p.lon > 38.5) || pts.reduce((a, p) => a + p.lat, 0) / n < 32.2;
    const lead = person(desert ? 'oude-man-bijbels' : 'man-bijbels', { seed: seed + 'lead' });
    const follow = person(desert ? 'vrouw-bijbels' : 'man-bijbels-2', { seed: seed + 'follow' });
    const beast = animal(desert ? 'kameel' : 'ezel'); const ship = boat();
    const crew = [{ o: lead.root, gap: 0, kind: 'p', p: lead }, { o: beast.root, gap: desert ? 2.2 : 1.7, kind: 'a', a: beast }, { o: follow.root, gap: desert ? 4.1 : 3.3, kind: 'p', p: follow }];
    for (const m of crew) scene.add(m.o); scene.add(ship.root);
    // how wet the route is at each sample (smoothed), once the land is in
    let wetAt = () => 0;
    ready.then(() => {
      const w = R.map(p => shoreAt(p.x, p.z) < -.05 ? 1 : 0);
      const ws = w.map((_, i) => { const a = w.slice(Math.max(0, i - 6), i + 7); return a.reduce((x, y) => x + y, 0) / a.length; });
      wetAt = a => { if (a <= 0) return ws[0]; if (a >= total) return ws[ws.length - 1]; const q = along(a); return lerp(ws[q.i], ws[Math.min(ws.length - 1, q.i + 1)], q.k); };
    });

    /* ---- labels: place names (white, dark halo, like the 2D map) and sea names ---- */
    const labels = pts.map(p => {
      const e = el('div', 'abs', layer, esc(p.name));
      css(e, { left: 0, top: 0, whiteSpace: 'nowrap', fontWeight: 700, fontSize: (n > 5 ? 40 : 46) + 'px', lineHeight: 1.1, letterSpacing: '-.3px', color: '#fff',
        webkitTextStroke: '10px rgba(8,18,22,.88)', paintOrder: 'stroke fill', textShadow: '0 3px 16px rgba(0,0,0,.35)', opacity: 0, willChange: 'transform' });
      return { e, w: 0, h: 0, off: null };
    });
    const inCrop = o => o.x > crop.x0 + 4 && o.x < crop.x1 - 4 && o.z > crop.z0 + 4 && o.z < crop.z1 - 4;
    const seas = (M.seas || []).map(sn => {
      const spots = [[sn.lon, sn.lat], ...(SEA_SPOTS[sn.name] || [])].map(([lon, lat]) => { const [x, z] = toW((lon - PR.lonMin) * PR.cos * PR.k, (PR.latMax - lat) * PR.k); return { sn, x, z }; }).filter(inCrop);
      return spots.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    }).filter(Boolean)
      .map(o => { const e = el('div', 'abs serif', layer, esc(o.sn.name)); css(e, { left: 0, top: 0, whiteSpace: 'nowrap', fontStyle: 'italic', fontWeight: 500, fontSize: Math.round(34 * (o.sn.size || 1)) + 'px', letterSpacing: '4px', color: 'rgba(236,250,252,.78)', textShadow: '0 2px 10px rgba(10,40,50,.45)', opacity: 0 }); return { ...o, e, w: 0, h: 0 }; });

    /* ---- per frame ---- */
    function update(t) {
      const cm = cam(t);
      scene.fog.near = cm.d * FOG[0]; scene.fog.far = cm.d * FOG[1];
      // sea facets
      const pa = seaGeo.attributes.position.array;
      for (let i = 0, v = 0; i < pa.length; i += 3, v++) { const x = seaBase[i], z = seaBase[i + 2]; pa[i + 1] = .07 * Math.sin(t * 1.3 + seaPh[v]) + .05 * Math.sin(x * .35 + z * .2 + t * .9); }
      seaGeo.attributes.position.needsUpdate = true; if (!faceted()) seaGeo.computeVertexNormals();
      // the line and its tip
      const sl = lineAt(t);
      if (tube) {
        const k = clamp(sl / total); const segN = Math.floor(k * tubeSegs);
        tube.geometry.setDrawRange(0, segN * tubeRad * 6); tube.visible = segN > 0;
        const q = along(Math.min(sl, total)); const i = q.i ?? (sl <= 0 ? 0 : R.length - 2), y = lerp(R[i].y, R[Math.min(R.length - 1, i + 1)].y, q.k ?? (sl <= 0 ? 0 : 1));
        tip.position.set(q.x, y, q.z); tip.visible = sl > .05 && sl < total - .05; tip.scale.setScalar(Math.pow(cm.d / D1, .5));
      }
      // pins
      const ps = pinScale(cm.d);
      pins.forEach((pn, i) => {
        const a = prog(t, pops[i], pops[i] + .45); pn.g.visible = a > 0;
        pn.stem.scale.set(ps * Math.min(1, a * 1.6), ps * backOut(a), ps * Math.min(1, a * 1.6));
        const rg = prog(t, rings[i], rings[i] + 1.05); pn.ring.visible = rg > 0 && rg < 1; pn.ring.scale.setScalar(ps * (1 + 2.6 * out(rg))); pn.ring.material.opacity = .85 * (1 - rg);
      });
      // travellers
      const cs = crewScale(cm.d); const sc = travel(t);
      const speed = Math.abs(travel(t + .06) - travel(t - .06)) / .12;
      const amount = clamp(speed / (1.4 * cs)); const phase = sc / (cs * .55);
      const wet = wetAt(sc);
      const land = smooth((.5 - wet) / .2 + .5), sea = 1 - land;
      for (const m of crew) {
        const q = along(sc - m.gap * cs); const side = .95 * cs;
        const x = q.x - q.dz * side, z = q.z + q.dx * side;
        m.o.visible = land > .02; m.o.position.set(x, Math.max(0, ground(x, z)), z); m.o.rotation.y = Math.atan2(q.dx, q.dz);
        m.o.scale.setScalar(cs * land);
        if (m.kind === 'p') m.p.pose(t, amount > .05 ? { base: 'walk', action: 'idle', walk: { phase: phase + m.gap, amount } } : { base: 'stand', action: 'idle' });
        else m.a.pose(phase * 1.15, amount, t);
      }
      { const q = along(sc - .8 * cs); const x = q.x - q.dz * cs * .6, z = q.z + q.dx * cs * .6;
        ship.root.visible = sea > .02; ship.root.position.set(x, .05 + .06 * Math.sin(t * 2.2), z); ship.root.rotation.set(.05 * Math.sin(t * 1.7), Math.atan2(q.dx, q.dz), .07 * Math.sin(t * 1.9 + 1)); ship.root.scale.setScalar(cs * 1.15 * sea); }
    }

    /* ---- HTML labels: placed once (at the final framing) where they cover no pin, label or line ---- */
    const v3 = new THREE.Vector3();
    const toScreen = (p, camera) => { v3.copy(p).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, ok: v3.z < 1 && v3.z > -1 }; };
    let laid = false;
    function layout() {
      laid = true;
      labels.forEach(l => { l.w = l.e.offsetWidth; l.h = l.e.offsetHeight; }); seas.forEach(o => { o.w = o.e.offsetWidth; o.h = o.e.offsetHeight; });
      const cm = cam(en - .01); const b = basis(cm.target, cm.hd, Math.asin((cm.pos.y - cm.target.y) / cm.pos.distanceTo(cm.target)), cm.d);
      const ps = pinScale(cm.d);
      const anchors = pins.map(pn => screen(b, V(pn.p.x, pn.y + 1.75 * ps, pn.p.z)));
      const route = R.filter((_, i) => i % 3 === 0).map(p => screen(b, V(p.x, p.y ?? 0, p.z)));
      const boxes = anchors.map(a => ({ x: a.x - 30, y: a.y - 30, w: 60, h: 60 + 70 }));
      // the travellers wait at the first place (behind it) and stand at the last one
      const cs0 = crewScale(cm.d);
      for (const [a, sgn] of [[0, -1], [total, -1]]) for (let g = 0; g <= 4.4; g += 1.1) {
        const q = along(a + sgn * g * cs0); const p = screen(b, V(q.x - q.dz * .95 * cs0, 1.1 * cs0, q.z + q.dx * .95 * cs0)); boxes.push({ x: p.x - 34, y: p.y - 60, w: 68, h: 110 });
      }
      const ov = (a, c2) => Math.max(0, Math.min(a.x + a.w, c2.x + c2.w) - Math.max(a.x, c2.x)) * Math.max(0, Math.min(a.y + a.h, c2.y + c2.h) - Math.max(a.y, c2.y));
      labels.forEach((l, i) => {
        const a = anchors[i]; const { w, h } = l;
        const cands = [[30, -h / 2, 0], [-30 - w, -h / 2, 1], [-w / 2, -h - 34, 1.5], [-w / 2, 40, 2.5], [24, -h - 14, 2], [-24 - w, -h - 14, 2]];
        let bestL = null;
        for (const [dx, dy, pref] of cands) {
          const bx = { x: a.x + dx, y: a.y + dy, w, h }; let sc = pref * 30;
          sc += 40 * (Math.max(0, 40 - bx.x) + Math.max(0, bx.x + w - (W - 40)) + Math.max(0, 470 - bx.y) + Math.max(0, bx.y + h - 1330));
          for (const o of boxes) sc += ov(bx, o) / 6;
          for (const r of route) if (r.x > bx.x - 8 && r.x < bx.x + w + 8 && r.y > bx.y - 8 && r.y < bx.y + h + 8) sc += 45;
          if (!bestL || sc < bestL.sc) bestL = { sc, dx, dy, bx };
        }
        l.off = { dx: bestL.dx, dy: bestL.dy }; boxes.push(bestL.bx);
      });
    }
    function overlay(t, sh, camera) {
      camera.updateMatrixWorld(); if (!laid) layout();
      const cm = cam(t); const ps = pinScale(cm.d); const busy = [];
      pins.forEach((pn, i) => {
        const l = labels[i]; const a = toScreen(V(pn.p.x, pn.y + 1.75 * ps, pn.p.z), camera);
        const edge = smooth((a.y - 260) / 90) * (1 - smooth((a.y - 1330) / 90)) * smooth((a.x + 20) / 60) * (1 - smooth((a.x - W + 40) / 60));   // pin leaving the frame
        const q = out(prog(t, pops[i] + .1, pops[i] + .5)) * edge;
        if (!a.ok || q <= 0) { l.e.style.opacity = 0; return; }
        const x = clamp(a.x + l.off.dx, 24, W - 24 - l.w), y = a.y + l.off.dy + (1 - q) * 12;
        l.e.style.opacity = q; l.e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        busy.push({ x: x - 12, y: y - 10, w: l.w + 24, h: l.h + 20, o: q }, { x: a.x - 40, y: a.y - 30, w: 80, h: 120, o: q });
      });
      { const p = toScreen(lead.root.getWorldPosition(new THREE.Vector3()), camera); if (p.ok) busy.push({ x: p.x - 160, y: p.y - 140, w: 320, h: 220, o: 1 }); }
      for (const o of seas) {
        const p = toScreen(V(o.x, 0, o.z), camera); if (!p.ok) { o.e.style.opacity = 0; continue; }
        const rad = (o.sn.rotate || 0) * Math.PI / 180; const d2 = 4;
        const pa = toScreen(V(o.x - Math.cos(rad) * d2, 0, o.z - Math.sin(rad) * d2), camera), pb = toScreen(V(o.x + Math.cos(rad) * d2, 0, o.z + Math.sin(rad) * d2), camera);
        let ang = Math.atan2(pb.y - pa.y, pb.x - pa.x); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
        const bx = { x: p.x - o.w / 2, y: p.y - o.h / 2, w: o.w, h: o.h };
        let op = .9 * (1 - smooth((p.y < 500 ? (500 - p.y) / 150 : p.y > 1340 ? (p.y - 1340) / 120 : 0)));
        for (const q of busy) { const ovl = Math.max(0, Math.min(bx.x + bx.w, q.x + q.w) - Math.max(bx.x, q.x)) * Math.max(0, Math.min(bx.y + bx.h, q.y + q.h) - Math.max(bx.y, q.y)); if (ovl > 0) op = Math.min(op, 1 - q.o); }
        if (bx.x > W || bx.x + bx.w < 0) op = 0;
        o.e.style.opacity = op; o.e.style.transform = `translate(${bx.x.toFixed(1)}px, ${bx.y.toFixed(1)}px) rotate(${(ang * 180 / Math.PI).toFixed(2)}deg)`;
      }
    }

    const end = cam(en - .01);
    return {
      scene, ready,
      wide: { pos: end.pos.toArray(), target: end.target.toArray() },
      groundY: (x, z) => Math.max(0, ground(x, z)),
      camera: t => { const cm = cam(t); return { pos: cm.pos.clone(), target: cm.target.clone(), fov: cm.fov }; },
      update, overlay,
    };
  },
});

/** Fade a surface into the haze (fog colour) near the edge of the map data (box in world x/z), so no edge shows. */
function edgeFade(m, box, w) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uBox = { value: new THREE.Vector4(box.x0, box.z0, box.x1, box.z1) }; sh.uniforms.uEdge = { value: w };
    sh.vertexShader = 'varying vec2 vWxz;\n' + sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n vWxz = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = 'varying vec2 vWxz;\nuniform vec4 uBox;\nuniform float uEdge;\n' + sh.fragmentShader.replace('#include <fog_fragment>',
      '#include <fog_fragment>\n#ifdef USE_FOG\n{ float e = min(min(vWxz.x - uBox.x, uBox.z - vWxz.x), min(vWxz.y - uBox.y, uBox.w - vWxz.y)); gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, smoothstep(0.0, uEdge, e)); }\n#endif');
  };
  m.customProgramCacheKey = () => 'kaart-edge-fade';
  return m;
}

/** Merge identical vertices (same position and colour) so a smooth look gets shared normals. */
function weld(geo) {
  const p = geo.attributes.position.array, c = geo.attributes.color.array; const map = new Map(); const np = [], nc = [], idx = [];
  for (let i = 0; i < p.length / 3; i++) {
    const key = `${p[i * 3].toFixed(4)},${p[i * 3 + 2].toFixed(4)}`;
    let k = map.get(key);
    if (k == null) { k = np.length / 3; map.set(key, k); np.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); nc.push(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]); }
    idx.push(k);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(np, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(nc, 3)); g.setIndex(idx); return g;
}
