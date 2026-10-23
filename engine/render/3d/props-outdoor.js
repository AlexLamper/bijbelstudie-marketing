// Outdoor props for the Bible-times sets (sets-outdoor.js): ship, hold, tents, camels, campfire, palms,
// olive trees, rocks, sheep, houses, market stall. Each returns a THREE.Group standing on y = 0, front +z
// (or { group, update(t) } when it moves). Built with mat() + G.* (or segs()/faceted() for custom
// geometry) so every look (lowpoly, rond, toon, blok, klei) works. Animated parts carry
// userData.dynamic = true, so bake() leaves them alone.
import { THREE, mat, mesh, at, rot, scl, group, G, rng, wobble, segs, faceted, basic, V, clamp, smooth, bake } from './core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const wood = (c = '#9a6b43') => mat(c, { rough: .85 });
const dyn = o => { o.userData.dynamic = true; return o; };
const UP = V(0, 1, 0);

/** A cylinder (rope, pole, beam) from point a to point b. */
export function beam(a, b, r, m, seg = 6) {
  const d = b.clone().sub(a); const o = mesh(G.cyl(r, r, 1, seg), m);
  o.scale.set(1, d.length(), 1); o.position.copy(a).lerp(b, .5); o.quaternion.setFromUnitVectors(UP, d.normalize()); return o;
}
/** A curved tube through points. */
export function tube(points, r, m, n = 24, radial = 8) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segs(n, 8), r, segs(radial, 5), false), m);
}
/** Merge geometries with their matrices into one (mixed indexed / non-indexed is fine). */
export function mergeParts(parts) {
  const list = parts.map(([g, m]) => { let c = g.index ? g.toNonIndexed() : g.clone(); if (m) c.applyMatrix4(m);
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal'].includes(k)) c.deleteAttribute(k); return c; });
  const out = mergeGeometries(list, false); list.forEach(g => g.dispose()); return out;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));

/* ---------- rocks ---------- */
const rockCache = new Map();
/** Rough rock geometry: an icosahedron whose corners are pushed in/out by a hash of their position. */
export function rockGeo(seed = 1, detail = 1) {
  const key = `${seed},${detail},${faceted()}`; if (rockCache.has(key)) return rockCache.get(key);
  const g = new THREE.IcosahedronGeometry(1, faceted() ? detail : detail + 2); const p = g.attributes.position;
  const hash = (x, y, z) => { const s = Math.sin(Math.round(x * 997) * 12.9898 + Math.round(y * 991) * 78.233 + Math.round(z * 983) * 37.719 + seed * 4.13) * 43758.5453; return s - Math.floor(s); };
  const w = wobble('rock' + seed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = faceted() ? .78 + hash(x, y, z) * .4 : .88 + .12 * w(x * 2 + z * 1.3 + y);
    p.setXYZ(i, x * k, Math.max(y * k, -.35), z * k);   // flat-ish bottom
  }
  g.computeVertexNormals(); rockCache.set(key, g); return g;
}
export function rock({ s = .5, seed = 1, c = '#a39a8c', sy = .7 } = {}) {
  const m = mesh(rockGeo(seed % 7, 1), mat(c, { rough: .95 })); m.scale.set(s, s * sy, s * (.85 + (seed % 3) * .1)); m.rotation.y = seed * 1.7; m.position.y = s * sy * .2; return m;
}

/* ---------- palm ---------- */
/** One palm frond along +x: a drooping leaf with a raised mid-rib, pointed at the tip. */
function frondGeo(len = 1.8, wd = .34, droop = .9) {
  const n = faceted() ? 5 : 9, pos = [];
  const pt = (k, side) => { const x = len * k, y = -droop * k * k * len * .45 + Math.sin(k * Math.PI) * .1; const hw = wd * Math.pow(Math.sin(Math.min(1, k * 1.15) * Math.PI), .7) * (1 - k * .35);
    return side === 0 ? [x, y + .05, 0] : [x, y - .07 * Math.abs(side), side * hw]; };
  for (let i = 0; i < n; i++) { const a = i / n, b = (i + 1) / n;
    for (const s of [1, -1]) { const A = pt(a, 0), B = pt(b, 0), C = pt(b, s), D = pt(a, s);
      if (s > 0) pos.push(...A, ...C, ...B, ...A, ...D, ...C); else pos.push(...A, ...B, ...C, ...A, ...C, ...D); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
/** Date palm: ringed, slightly bent trunk + a crown of fronds (crown sways when sway is on). */
export function palm({ h = 4.6, lean = .22, dir = 0, seed = 1, fronds = 9, sway = false } = {}) {
  const g = new THREE.Group(); const r = rng('palm' + seed);
  const tA = mat('#8d6e4f'), tB = mat('#735638'), lA = mat('#5b9a3e', { side: THREE.DoubleSide }), lB = mat('#457f33', { side: THREE.DoubleSide });
  const n = faceted() ? 6 : 9, pts = [];
  for (let i = 0; i <= n; i++) { const k = i / n; pts.push(V(Math.sin(dir) * lean * h * k * k, h * k, Math.cos(dir) * lean * h * k * k)); }
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[i + 1]; const rb = .22 - .08 * i / n, rt = .22 - .08 * (i + 1) / n;
    const s = mesh(G.cyl(rt * .92, rb * 1.08, 1, 7), i % 2 ? tA : tB); s.scale.set(1, a.distanceTo(b) * 1.04, 1); s.position.copy(a).lerp(b, .5); s.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); g.add(s); }
  const crown = at(group(g), ...pts[n].toArray()); if (sway) dyn(crown);
  const fg = [frondGeo(1.9, .36, .95), frondGeo(1.6, .32, 1.15)];
  for (let i = 0; i < fronds; i++) { const a = i / fronds * Math.PI * 2 + r() * .45; const up = i % 3 === 0 ? .55 : .1 + r() * .25;
    const f = mesh(fg[i % 2], i % 2 ? lA : lB); f.rotation.set(0, a, up); crown.add(f); }
  const dm = mat('#9a5a2c'); for (let i = 0; i < 3; i++) { const a = i * 2.1 + r(); crown.add(at(scl(mesh(G.sphere(.16, 8, 6), dm), 1, 1.3, 1), Math.cos(a) * .2, -.28, Math.sin(a) * .2)); }
  crown.add(at(mesh(G.sphere(.2, 8, 6), tB), 0, -.05, 0));
  if (sway) { bake(crown); g.userData.crown = crown; g.userData.seed = seed; }
  return g;
}
export function swayPalm(p, t, k = 1) { const c = p.userData.crown; if (!c) return; const s = p.userData.seed || 1; c.rotation.set(Math.sin(t * .8 + s) * .025 * k, Math.sin(t * .35 + s * 2) * .05 * k, Math.sin(t * 1.1 + s * 3) * .03 * k); }

/* ---------- olive tree ---------- */
export function olive({ s = 1, seed = 1 } = {}) {
  const g = new THREE.Group(); const r = rng('olive' + seed);
  const bark = mat('#7c6a57'), leaves = [mat('#8e9c5f'), mat('#7a8a4e'), mat('#a2ad74')];
  // gnarled trunk: a few tilted pieces that split into branches
  const base = V(0, 0, 0), knee = V((r() - .5) * .3, .9, (r() - .5) * .3);
  g.add(beam(base, knee, .2, bark, 7)); g.add(at(scl(mesh(G.sphere(.26, 10, 8), bark), 1, .7, 1), 0, .1, 0));
  const tips = [];
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + r() * .8; const tip = V(knee.x + Math.cos(a) * (.7 + r() * .4), 1.9 + r() * .5, knee.z + Math.sin(a) * (.7 + r() * .4)); g.add(beam(knee, tip, .12, bark, 6)); g.add(at(mesh(G.sphere(.14, 8, 6), bark), ...knee.toArray())); tips.push(tip); }
  // canopy: flattened clumps
  for (let i = 0; i < 9; i++) { const t = tips[i % 3]; const a = r() * 6.28, d = r() * .8;
    const c = mesh(G.sphere(.75 + r() * .35, 12, 8), leaves[i % 3]); c.scale.set(1.15, .62, 1.05); c.rotation.y = r() * 3; c.position.set(t.x + Math.cos(a) * d, t.y + .25 + r() * .45, t.z + Math.sin(a) * d); g.add(c); }
  g.scale.setScalar(s); return g;
}

/* ---------- campfire (flames animated) ---------- */
export function campfire({ s = 1, seed = 1, big = true } = {}) {
  const g = new THREE.Group(); const r = rng('fire' + seed);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const st = mesh(rockGeo(i % 5, 0), mat(i % 2 ? '#8f877c' : '#a69d90', { rough: .95 })); st.scale.set(.15, .11, .13); st.position.set(Math.cos(a) * .48, .06, Math.sin(a) * .48); st.rotation.y = a; g.add(st); }
  const logM = wood('#6b4a30'), char = mat('#2b211c');
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; const lg = mesh(G.cyl(.055, .065, .62, 7), i % 2 ? logM : char); lg.position.set(Math.cos(a) * .13, .14, Math.sin(a) * .13); lg.rotation.set(0, -a, 0); lg.rotateZ(1.15); g.add(lg); }
  g.add(at(mesh(G.cyl(.3, .32, .04, 9), mat('#3a2a22'), { cast: false }), 0, .02, 0));
  const flames = dyn(group(g)); const fm = [basic('#ff8a2e'), basic('#ffb347'), basic('#ffe39a')];
  const parts = [[0, 0, .2, .62, 0], [.08, .05, .15, .5, 1], [-.07, -.04, .14, .46, 1], [.02, -.08, .1, .36, 2], [-.04, .07, .09, .3, 2], [.0, .0, .07, .26, 2]];
  const fl = parts.map(([x, z, rad, h, c]) => { const f = mesh(G.cone(rad, h, 6), fm[c], { cast: false, receive: false }); f.position.set(x, .12 + h / 2, z); flames.add(f); return { f, h, x, z }; });
  const glow = new THREE.Mesh(G.cap(.9, Math.PI / 2, 0, 16, 4), new THREE.MeshBasicMaterial({ color: '#ff9a40', transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(1, .5, 1); g.add(dyn(glow));
  const w = wobble('flame' + seed);
  g.scale.setScalar(s);
  return { group: g, flicker: t => .85 + .15 * w(t * 7), update(t, size = 1) {
    flames.scale.setScalar(size); glow.visible = size > .8;
    fl.forEach((o, i) => { const k = 1 + .28 * w(t * 6.5 + i * 1.7); o.f.scale.set(1 - .15 * w(t * 5 + i), k, 1 - .15 * w(t * 4.7 + i * 2)); o.f.position.y = .12 + o.h * k / 2; o.f.rotation.set(.12 * w(t * 3 + i * 4), t * (1 + i * .3), .12 * w(t * 3.3 + i)); });
  } };
}

/* ---------- camel (chews, swishes its tail) ---------- */
export function camel({ seated = false, seed = 1, blanket = '#b5452f' } = {}) {
  const g = new THREE.Group(); const r = rng('camel' + seed);
  const fur = mat('#c79a62'), dark = mat('#a87a48'), hoof = mat('#5b4535'), eye = mat('#1f1a17');
  const by = seated ? .55 : 1.35;
  g.add(at(scl(mesh(G.sphere(.5, 16, 12), fur), .95, .82, 1.55), 0, by, 0));                 // body
  g.add(at(scl(mesh(G.sphere(.38, 14, 10), dark), .9, 1.0, 1.15), 0, by + .42, -.05));         // hump
  // saddle blanket
  g.add(at(rot(scl(mesh(G.box(1.05, .06, .9, .02), mat(blanket)), 1, 1, 1), 0, 0, 0), 0, by + .5, -.02));
  g.add(at(mesh(G.box(1.07, .04, .92), mat('#e3b341')), 0, by + .46, -.02));
  // legs
  if (seated) {
    for (const [x, z] of [[.42, .45], [-.42, .45], [.42, -.5], [-.42, -.5]]) { const lg = mesh(G.capsule(.09, .55, 4, 8), fur); lg.rotation.set(Math.PI / 2, 0, 0); lg.position.set(x, .12, z + .1); g.add(lg); g.add(at(mesh(G.sphere(.1, 8, 6), hoof), x, .1, z + .48)); }
  } else {
    for (const [x, z] of [[.3, .55], [-.3, .55], [.3, -.6], [-.3, -.6]]) {
      g.add(beam(V(x, by - .1, z), V(x, .55, z + .02), .1, fur, 7)); g.add(at(mesh(G.sphere(.1, 8, 6), dark), x, .55, z + .02));
      g.add(beam(V(x, .55, z + .02), V(x, .06, z), .07, fur, 6)); g.add(at(scl(mesh(G.sphere(.1, 8, 6), hoof), 1.1, .5, 1.3), x, .04, z + .03));
    }
  }
  // neck + head (animated: chewing and looking around)
  const neckBase = V(0, by + .1, .65);
  const neck = dyn(at(group(g), ...neckBase.toArray()));
  const nTop = seated ? V(0, .95, .35) : V(0, .85, .55);
  neck.add(beam(V(0, 0, 0), nTop, .15, fur, 7)); neck.add(beam(V(0, -.15, -.1), V(0, .2, .1), .2, fur, 7));
  const head = at(group(neck), ...nTop.toArray());
  head.add(at(scl(mesh(G.sphere(.2, 12, 8), fur), .9, .85, 1.1), 0, .05, 0));
  head.add(at(rot(scl(mesh(G.sphere(.16, 10, 8), dark), .85, .75, 1.4), .25, 0, 0), 0, -.04, .26));     // muzzle
  const jaw = at(group(head), 0, -.1, .12); jaw.add(at(scl(mesh(G.sphere(.1, 8, 6), dark), .9, .5, 1.6), 0, 0, .14));
  for (const s of [1, -1]) { head.add(at(mesh(G.sphere(.035, 8, 6), eye), s * .15, .12, .1)); head.add(at(rot(mesh(G.cone(.05, .14, 5), fur), -.5, 0, s * .6), s * .14, .22, -.06)); }
  // tail
  const tail = dyn(at(group(g), 0, by + .15, -.75)); tail.add(at(mesh(G.cyl(.03, .04, .55, 5), fur), 0, -.27, -.04)); tail.add(at(scl(mesh(G.sphere(.07, 6, 5), dark), 1, 1.8, 1), 0, -.56, -.05));
  bake(neck); bake(tail);
  const w = wobble('camel' + seed), ph = r() * 10;
  return { group: g, update(t) {
    const look = w(t * .25 + ph);
    neck.rotation.set(.06 * w(t * .4 + ph + 3), look * .35, 0);
    head.rotation.set(-.05 + .04 * Math.sin(t * 1.3 + ph), look * .25, .05 * w(t * .5 + ph));
    jaw.rotation.set(.12 + .1 * Math.sin(t * 6.2 + ph), 0, .06 * Math.sin(t * 3.1 + ph));
    jaw.position.x = .015 * Math.sin(t * 3.1 + ph);
    tail.rotation.set(.15 + .05 * Math.sin(t * 1.7 + ph), 0, .35 * Math.sin(t * 2.3 + ph) * (.6 + .4 * w(t * .3 + ph)));
  } };
}

/* ---------- goat-hair tent ---------- */
export function tent({ w = 4.2, d = 3, h = 2.1, c = '#3f342d', c2 = '#5e4d3f', rug = '#a8432f' } = {}) {
  const g = new THREE.Group(); const strips = 6; const sw = w / strips;
  const roofY = (x, z) => { const zz = z / (d / 2); const sag = .17 * (1 - Math.cos(2 * Math.PI * x / (w / 3))) / 2; return h - .55 * zz * zz - sag - (z > 0 ? .1 * zz : 0); };
  const mA = mat(c, { side: THREE.DoubleSide, rough: .98 }), mB = mat(c2, { side: THREE.DoubleSide, rough: .98 });
  const nz = faceted() ? 4 : 8, nx = faceted() ? 2 : 4;
  for (let i = 0; i < strips; i++) {
    const geo = new THREE.PlaneGeometry(sw, d, nx, nz); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) { const x = p.getX(j) + (-w / 2 + sw * (i + .5)), z = p.getZ(j); p.setXYZ(j, x, roofY(x, z), z); }
    geo.computeVertexNormals(); g.add(mesh(geo, i % 2 ? mA : mB));
  }
  // back and side walls hanging from the roof edge
  const wall = (pts) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); geo.computeVertexNormals(); return mesh(geo, mA); };
  const back = [], n = 6;
  for (let i = 0; i < n; i++) { const x0 = -w / 2 + w * i / n, x1 = -w / 2 + w * (i + 1) / n, z = -d / 2;
    back.push([x0, 0, z - .15], [x1, 0, z - .15], [x1, roofY(x1, z), z], [x0, 0, z - .15], [x1, roofY(x1, z), z], [x0, roofY(x0, z), z]); }
  g.add(wall(back));
  for (const s of [-1, 1]) { const side = []; const x = s * w / 2;
    for (let i = 0; i < 4; i++) { const z0 = -d / 2 + d * i / 4 * .75, z1 = -d / 2 + d * (i + 1) / 4 * .75;
      side.push([x + s * .12, 0, z0], [x + s * .12, 0, z1], [x, roofY(x, z1), z1], [x + s * .12, 0, z0], [x, roofY(x, z1), z1], [x, roofY(x, z0), z0]); }
    g.add(wall(side)); }
  // poles, guy ropes, interior
  const pole = wood('#6e5136'), rope = mat('#c2a77c');
  for (const x of [-w / 3, 0, w / 3]) g.add(beam(V(x, 0, 0), V(x, roofY(x, 0) - .02, 0), .045, pole));
  for (const x of [-w / 2 + .15, w / 2 - .15]) { const top = V(x, roofY(x, d / 2) - .02, d / 2 - .05); g.add(beam(V(x, 0, d / 2 - .05), top, .04, pole)); g.add(beam(top, V(x + Math.sign(x) * .6, 0, d / 2 + 1.0), .012, rope, 4)); }
  for (const x of [-w / 2, w / 2]) g.add(beam(V(x, roofY(x, -d / 4), -d / 4), V(x + Math.sign(x) * 1.1, 0, -d / 4 - .2), .012, rope, 4));
  g.add(at(mesh(G.box(w * .7, .03, d * .6), mat(rug), { cast: false }), 0, .015, .05));
  g.add(at(mesh(G.box(w * .5, .035, d * .3), mat('#e3b341'), { cast: false }), 0, .02, .1));
  for (const [x, cc] of [[-1.1, '#7d3f5c'], [-.4, '#3f6e8f'], [.9, '#c9714b']]) g.add(at(scl(mesh(G.sphere(.28, 10, 8), mat(cc)), 1.2, .55, .8), x, .16, -d / 2 + .45));
  g.add(at(mesh(G.lathe([[.0, 0], [.16, .04], [.2, .25], [.12, .45], [.09, .52], [.11, .56]], 12), mat('#b9714a')), w / 2 - .6, 0, -.6));
  return g;
}

/* ---------- small cargo ---------- */
export function barrel({ c = '#a8743f', s = 1 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(G.lathe([[0, 0], [.27, 0], [.33, .2], [.35, .4], [.33, .6], [.27, .8], [0, .8]], 14), wood(c)));
  for (const y of [.1, .7]) g.add(at(rot(mesh(G.torus(.3, .022, Math.PI * 2, 4, 14), mat('#4e4038')), Math.PI / 2, 0, 0), 0, y, 0));
  g.scale.setScalar(s); return g;
}
export function crate({ s = .6, c = '#c49a63' } = {}) {
  const g = new THREE.Group(); const m = wood(c), m2 = wood('#9c7445');
  g.add(at(mesh(G.box(s, s, s, .02), m), 0, s / 2, 0));
  for (const z of [-1, 1]) for (const [w, h, x, y] of [[s * 1.02, .07, 0, .04], [s * 1.02, .07, 0, s - .04], [.07, s, -s / 2 + .04, s / 2], [.07, s, s / 2 - .04, s / 2]]) g.add(at(mesh(G.box(w, h, .03), m2), x, y, z * (s / 2 + .005)));
  return g;
}
export function sack({ c = '#d8c39a', s = 1 } = {}) { const g = new THREE.Group(); g.add(at(scl(mesh(G.sphere(.3, 10, 8), mat(c, { rough: 1 })), 1, .75, 1.25), 0, .2, 0)); g.add(at(mesh(G.cyl(.05, .09, .14, 6), mat(c, { rough: 1 })), 0, .4, -.18)); g.scale.setScalar(s); return g; }
export function coil({ c = '#c2a77c' } = {}) { const g = new THREE.Group(); for (let i = 0; i < 3; i++) g.add(at(rot(mesh(G.torus(.24 - i * .05, .035, Math.PI * 2, 4, 14), mat(c)), Math.PI / 2, 0, 0), 0, .035 + i * .06, 0)); return g; }
export function pot({ c = '#b9714a', s = 1, amphora = false } = {}) {
  const pts = amphora ? [[0, 0], [.08, .02], [.2, .25], [.22, .4], [.14, .62], [.07, .7], [.08, .78], [.1, .8]] : [[0, 0], [.14, .02], [.22, .16], [.2, .3], [.12, .38], [.13, .42]];
  const g = new THREE.Group(); g.add(mesh(G.lathe(pts, 12), mat(c))); g.scale.setScalar(s); return g;
}
/** Oil lantern: frame + glowing core (glow = emissive strength). */
export function lantern({ glow = 1 } = {}) {
  const g = new THREE.Group(); const fm = mat('#3a3029', { rough: .6 });
  g.add(at(mesh(G.cyl(.09, .11, .04, 8), fm), 0, 0, 0)); g.add(at(mesh(G.cone(.12, .12, 8), fm), 0, .27, 0)); g.add(at(rot(mesh(G.torus(.05, .012, Math.PI * 2, 4, 10), fm), 0, 0, 0), 0, .36, 0));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(at(mesh(G.cyl(.012, .012, .2, 4), fm), Math.cos(a) * .085, .12, Math.sin(a) * .085)); }
  g.add(at(mesh(G.cyl(.075, .075, .18, 8), glow ? mat('#ffd28a', { emissive: '#ffb04a', glow: 1.6 * glow }) : mat('#cdbfa0'), { cast: false }), 0, .12, 0));
  return g;
}

/* ---------- sheep flock: bodies baked, heads instanced and animated (grazing) ---------- */
export function flock(list, { seed = 1 } = {}) {
  const g = new THREE.Group(); const wool = mat('#f2ede2', { rough: 1 }), face = mat('#3a302b'), legM = mat('#3a302b');
  list.forEach((s, i) => {
    const b = at(group(g), s.x, s.y || 0, s.z); b.rotation.y = s.yaw || 0; const k = s.s || 1; b.scale.setScalar(k);
    b.add(at(scl(mesh(G.sphere(.36, 14, 10), wool), 1, .82, 1.3), 0, .6, 0));
    b.add(at(mesh(G.sphere(.2, 10, 8), wool), .1, .84, .15)); b.add(at(mesh(G.sphere(.18, 10, 8), wool), -.1, .82, -.2));
    for (const [x, z] of [[.15, .25], [-.15, .25], [.15, -.25], [-.15, -.25]]) b.add(at(mesh(G.cyl(.04, .035, .36, 5), legM), x, .18, z));
  });
  // head: face (dark) with ears + a wool cap, as instanced meshes
  const faceGeo = mergeParts([[G.sphere(.13, 10, 8), M4(0, 0, .06, .5, 0, 0, .85, .8, 1.35)], [G.cone(.05, .16, 5), M4(.14, .04, -.02, 0, 0, -1.9)], [G.cone(.05, .16, 5), M4(-.14, .04, -.02, 0, 0, 1.9)]]);
  const capGeo = mergeParts([[G.sphere(.11, 8, 6), M4(0, .09, -.04, 0, 0, 0, 1.1, .8, 1.1)]]);
  const faces = new THREE.InstancedMesh(faceGeo, face, list.length), caps = new THREE.InstancedMesh(capGeo, wool, list.length);
  for (const m of [faces, caps]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; g.add(dyn(m)); }
  const w = list.map((_, i) => wobble('sheep' + seed + i)); const tmp = new THREE.Object3D(); const body = new THREE.Matrix4(); const hm = new THREE.Matrix4();
  return { group: g, update(t) {
    list.forEach((s, i) => {
      const graze = clamp(.5 + 1.6 * w[i](t * .22 + i)) * (s.graze ?? 1);            // 1 = head down in the grass
      const nib = graze * .06 * Math.max(0, Math.sin(t * 7 + i * 2));
      tmp.position.set(0, .78 - graze * .42 + nib, .5 - graze * .02); tmp.rotation.set(-.15 + graze * 1.05 + nib * 2, .3 * w[i](t * .3 + 5) * (1 - graze), 0); tmp.scale.setScalar(1); tmp.updateMatrix();
      body.compose(V(s.x, s.y || 0, s.z), new THREE.Quaternion().setFromAxisAngle(UP, s.yaw || 0), V(s.s || 1, s.s || 1, s.s || 1));
      hm.multiplyMatrices(body, tmp.matrix); faces.setMatrixAt(i, hm); caps.setMatrixAt(i, hm);
    });
    faces.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
  } };
}

/* ---------- city: houses, stall, well ---------- */
/** Flat-roofed house. stairs: { side: 'x+'|'x-'|'z+', from, to } outside stairs up to the roof (along +z or -z). */
export function house({ w = 4, d = 4, h = 3.2, c = '#d9b98c', trim = '#b8946a', door = '#5f8aa0', seed = 1, windows = 2, upper = false, lit = 0 } = {}) {
  const g = new THREE.Group(); const r = rng('house' + seed); const wall = mat(c, { rough: .95 }), tr = mat(trim, { rough: .95 });
  g.add(at(mesh(G.box(w, h, d, .05), wall), 0, h / 2, 0));
  // parapet
  for (const [x, z, ww, dd] of [[0, d / 2 - .1, w, .2], [0, -d / 2 + .1, w, .2], [w / 2 - .1, 0, .2, d], [-w / 2 + .1, 0, .2, d]]) g.add(at(mesh(G.box(ww, .32, dd), tr), x, h + .16, z));
  // roof beams sticking out
  const bm = wood('#7a5636'); for (let i = 0; i < 4; i++) g.add(at(rot(mesh(G.cyl(.06, .06, .3, 6), bm), Math.PI / 2, 0, 0), -w / 2 + w * (i + .5) / 4, h - .22, d / 2 + .1));
  // door + windows (front = +z)
  const dx = (r() - .5) * (w - 1.6);
  g.add(at(mesh(G.box(.95, 1.85, .12), mat(door)), dx, .925, d / 2 + .01));
  g.add(at(mesh(G.box(1.15, .14, .16), tr), dx, 1.9, d / 2 + .03));
  const winM = lit ? mat('#ffcf7a', { emissive: '#ffb347', glow: lit }) : mat('#3b2a20');
  for (let i = 0; i < windows; i++) { const x = -w / 2 + w * (i + .5) / windows; if (Math.abs(x - dx) < .9) continue; g.add(at(mesh(G.box(.5, .55, .1), winM, { cast: false }), x, h * .6, d / 2 + .01)); g.add(at(mesh(G.box(.66, .08, .16), tr), x, h * .6 - .32, d / 2 + .04)); }
  if (upper) { const uw = w * .5, ud = d * .55, uh = 1.9; g.add(at(mesh(G.box(uw, uh, ud, .04), wall), -w / 2 + uw / 2 + .2, h + uh / 2, -d / 2 + ud / 2 + .2)); g.add(at(mesh(G.box(.45, .5, .1), winM, { cast: false }), -w / 2 + uw / 2 + .2, h + uh * .6, -d / 2 + ud + .25)); }
  // roof clutter
  if (r() < .7) g.add(at(pot({ c: '#b9714a', s: 1.1, amphora: r() < .5 }), w / 2 - .5, h, -d / 2 + .5));
  return g;
}
/** Outside stairs: n steps rising along +z from z0 (ground) up to height h. Returns { group, y(x,z) }. */
export function stairs({ n = 10, h = 3, run = .36, width = 1, c = '#cfae82' } = {}) {
  const g = new THREE.Group(); const m = mat(c, { rough: .95 }); const rise = h / n;
  for (let i = 0; i < n; i++) g.add(at(mesh(G.box(width, rise * (i + 1), run), m), 0, rise * (i + 1) / 2, i * run + run / 2));
  return { group: g, rise, run, n };
}
export function stall({ c = '#c0533b', c2 = '#f1e4c8' } = {}) {
  const g = new THREE.Group(); const pole = wood('#7a5636');
  for (const [x, z, hh] of [[-1, .55, 2.15], [1, .55, 2.15], [-1, -.55, 2.4], [1, -.55, 2.4]]) g.add(at(mesh(G.cyl(.05, .05, hh, 6), pole), x, hh / 2, z));
  g.add(at(mesh(G.box(2.1, .1, 1.05, .02), wood('#a87b52')), 0, .9, 0));
  g.add(at(mesh(G.box(2.0, .8, .06), wood('#8a6243')), 0, .45, .48));
  // striped awning
  for (let i = 0; i < 7; i++) { const s = mesh(G.box(2.3 / 7 + .002, .04, 1.45), mat(i % 2 ? c : c2, { rough: .95 })); s.position.set(-1.15 + 2.3 / 7 * (i + .5), 2.3, .05); s.rotation.x = .16; g.add(s); }
  for (let i = 0; i < 7; i++) g.add(at(mesh(G.cone(.09, .16, 4), mat(i % 2 ? c : c2)), -1.15 + 2.3 / 7 * (i + .5), 2.12, .76));
  // baskets with fruit, pots
  const fruit = [['#e8862a', '#f29c38'], ['#a3283a', '#c2364a'], ['#6f9a3a', '#86b04a'], ['#6b3a6e', '#80487f']];
  const r = rng('stall');
  [-.65, 0, .62].forEach((x, i) => {
    g.add(at(mesh(G.cyl(.28, .22, .2, 10), mat('#c9a46a')), x, 1.05, .1));
    const [f1, f2] = fruit[i % 4]; for (let j = 0; j < 7; j++) { const a = j * 2.4, rr = j ? .12 : 0; g.add(at(mesh(G.sphere(.075, 8, 6), mat(j % 2 ? f1 : f2)), x + Math.cos(a) * rr, 1.17 + (j ? 0 : .05), .1 + Math.sin(a) * rr)); }
  });
  g.add(at(pot({ c: '#b9714a', s: .9, amphora: true }), 1.35, 0, .2)); g.add(at(pot({ c: '#a35f3d', s: 1.1 }), 1.3, 0, -.35)); g.add(at(pot({ c: '#d08a5a', s: .8 }), -1.4, 0, .1));
  g.add(at(sack({ c: '#d8c39a', s: .8 }), -1.35, 0, -.4));
  return g;
}
export function well({ c = '#b7a48a' } = {}) {
  const g = new THREE.Group(); const m = mat(c, { rough: .95 });
  g.add(at(mesh(G.cyl(.75, .8, .75, 10), m), 0, .375, 0)); g.add(at(mesh(G.cyl(.55, .55, .02, 10), mat('#1d2a30')), 0, .72, 0));
  g.add(at(rot(mesh(G.torus(.67, .1, Math.PI * 2, 4, 10), mat('#c9b79c')), Math.PI / 2, 0, 0), 0, .76, 0));
  const pole = wood('#7a5636'); for (const x of [-.65, .65]) g.add(at(mesh(G.cyl(.05, .05, 1.6, 6), pole), x, 1.2, 0));
  g.add(at(rot(mesh(G.cyl(.06, .06, 1.45, 6), pole), 0, 0, Math.PI / 2), 0, 1.9, 0)); g.add(at(mesh(G.cyl(.01, .01, .7, 4), mat('#c2a77c')), 0, 1.5, 0));
  g.add(at(pot({ c: '#a35f3d', s: .6 }), 0, 1.0, 0));
  return g;
}

/* ---------- ship: wooden merchant ship (bow -z, stern +z, main deck at y = 0) ---------- */
export const SHIP = { L: 11.6, B: 1.8 };
const hullB = s => SHIP.B * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), s < 0 ? 2.0 : 2.8)), .5);
const hullTop = s => .72 + (s < 0 ? 1.05 : .85) * Math.pow(Math.abs(s), 2.6);
const hullBot = s => -1.85 + 1.25 * Math.pow(Math.abs(s), 2.2);
/** Point on the hull: s -1 (bow) .. 1 (stern), a -1 (port gunwale) .. 0 (keel) .. 1 (starboard gunwale). */
export function hullPoint(s, a) {
  const phi = Math.abs(a) * Math.PI / 2, b = hullB(s), top = hullTop(s), bot = hullBot(s);
  return V(Math.sign(a) * b * Math.sin(phi) * (1 + .05 * (1 - Math.cos(phi))), bot + (top - bot) * (1 - Math.cos(phi)), s * SHIP.L / 2);
}
/** Half width of the deck (y = 0) at z. */
export function deckHalf(z) {
  const s = clamp(z / (SHIP.L / 2), -1, 1), b = hullB(s), top = hullTop(s), bot = hullBot(s);
  const phi = Math.acos(clamp(1 - (0 - bot) / (top - bot), -1, 1)); return b * Math.sin(phi) * (1 + .05 * (1 - Math.cos(phi)));
}
function hullStrip(a0, a1, ns, na) {
  const pos = [], idx = [];
  for (let i = 0; i <= ns; i++) { const s = -1 + 2 * i / ns; for (let j = 0; j <= na; j++) pos.push(...hullPoint(s, a0 + (a1 - a0) * j / na).toArray()); }
  for (let i = 0; i < ns; i++) for (let j = 0; j < na; j++) { const A = i * (na + 1) + j, B = A + 1, C = A + na + 1, D = C + 1; idx.push(A, C, B, B, C, D); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
export function ship({ time = 'dag' } = {}) {
  const g = new THREE.Group(); const ns = faceted() ? 16 : 40, na = faceted() ? 2 : 5;
  const side = THREE.DoubleSide;
  const bottom = mat('#8e3b2e', { side }), plank = mat('#a8774c', { side }), band = mat('#2f6f8f', { side }), rail = wood('#6b4a32'), deckM = mat('#cf9f66', { rough: .9 });
  g.add(mesh(hullStrip(-.55, .55, ns, na * 2), bottom));
  for (const sg of [1, -1]) { g.add(mesh(hullStrip(sg * .55, sg * .86, ns, na), plank)); g.add(mesh(hullStrip(sg * .86, sg * 1, ns, 1), band)); }
  // cap rail and wale along both sides
  for (const sg of [1, -1]) for (const [a, r] of [[1, .07], [.86, .05]]) { const pts = []; for (let i = 0; i <= 14; i++) pts.push(hullPoint(-.97 + 1.94 * i / 14, sg * a).add(V(sg * r * .4, a === 1 ? .03 : 0, 0))); g.add(tube(pts, r, rail, 40, 6)); }
  // deck (with plank seams)
  const sh = new THREE.Shape(); const N = 40;
  for (let i = 0; i <= N; i++) { const z = -SHIP.L / 2 + SHIP.L * i / N; const x = deckHalf(z) - .02; i ? sh.lineTo(x, -z) : sh.moveTo(x, -z); }
  for (let i = N; i >= 0; i--) { const z = -SHIP.L / 2 + SHIP.L * i / N; sh.lineTo(-deckHalf(z) + .02, -z); }
  const dg = new THREE.ShapeGeometry(sh); dg.rotateX(-Math.PI / 2); g.add(mesh(dg, deckM, { cast: false }));
  const seam = mat('#b48653'); for (let i = -3; i <= 3; i++) { const x = i * .42; let z0 = -5, z1 = 5; while (deckHalf(z0) < Math.abs(x) + .12) z0 += .1; while (deckHalf(z1) < Math.abs(x) + .12) z1 -= .1; g.add(at(mesh(G.box(.03, .006, z1 - z0), seam, { cast: false }), x, .004, (z0 + z1) / 2)); }
  // bow and stern posts (stern curls forward like a swan's neck)
  const bow = hullPoint(-1, 1), stern = hullPoint(1, 1);
  g.add(tube([bow.clone().add(V(0, -.5, .1)), bow, bow.clone().add(V(0, .55, -.25)), bow.clone().add(V(0, 1.0, -.2)), bow.clone().add(V(0, 1.2, .05))], .11, rail, 20, 6));
  g.add(tube([stern.clone().add(V(0, -.6, -.1)), stern, stern.clone().add(V(0, .9, .35)), stern.clone().add(V(0, 1.75, .2)), stern.clone().add(V(0, 2.0, -.3)), stern.clone().add(V(0, 1.7, -.6))], .12, rail, 28, 6));
  // painted eyes on the bow
  for (const sg of [1, -1]) { const s = -.8, a = sg * .8; const p = hullPoint(s, a); const n = hullPoint(s, a * 1.02).sub(hullPoint(s, a * .98)).cross(hullPoint(s + .01, a).sub(hullPoint(s - .01, a))).normalize(); if (n.x * sg < 0) n.negate();
    const e = at(group(g), ...p.add(n.clone().multiplyScalar(.02)).toArray()); e.lookAt(e.position.clone().add(n));
    e.add(scl(mesh(G.sphere(.2, 10, 8), mat('#f4efe2')), 1.3, .85, .15)); e.add(at(scl(mesh(G.sphere(.1, 8, 6), mat('#1f2933')), 1, 1, .2), 0, 0, .03)); }
  // mast, yard, rigging
  const mz = -.95, mastH = 8.2, mastM = wood('#8a6243'), ropeM = mat('#c9b08a');
  g.add(at(mesh(G.cyl(.11, .16, mastH, 8), mastM), 0, mastH / 2, mz)); g.add(at(mesh(G.cyl(.22, .26, .3, 8), mastM), 0, .15, mz));
  g.add(at(rot(mesh(G.cyl(.07, .09, 5.6, 6), mastM), 0, 0, Math.PI / 2), 0, 6.75, mz + .18));
  g.add(at(mesh(G.cyl(.16, .14, .35, 8), mastM), 0, mastH - .1, mz));
  const top = V(0, mastH - .25, mz);
  for (const p of [bow.clone().add(V(0, .9, -.1)), stern.clone().add(V(0, 1.2, .1))]) g.add(beam(top, p, .022, ropeM, 4));
  for (const sg of [1, -1]) for (const dz of [-.6, .35, 1.1]) { const z = mz + dz; g.add(beam(V(0, mastH - .6, mz), V(sg * (deckHalf(z) + .05), hullTop(z / (SHIP.L / 2)) + .02, z), .018, ropeM, 4)); }
  for (const sg of [1, -1]) g.add(beam(V(sg * 2.75, 6.75, mz + .18), V(sg * deckHalf(1.6) * .95, .75, 1.6), .016, ropeM, 4));
  // sail (animated): vertical stripes, billowing forward (-z)
  const sail = sailMesh(5.2, 3.9, faceted() ? 7 : 14, faceted() ? 5 : 10);
  sail.mesh.position.set(0, 6.7, mz + .32); g.add(dyn(sail.mesh));
  // pennant at the mast top
  const pen = dyn(at(group(g), 0, mastH + .05, mz)); pen.add(at(rot(mesh(G.cone(.12, .9, 3), mat('#c0533b', { side })), 0, 0, -Math.PI / 2), .45, 0, 0)); bake(pen);
  // steering oar + tiller (starboard quarter)
  const oarTop = V(1.25, 1.15, 4.35), blade = V(1.95, -1.7, 5.75);
  g.add(beam(oarTop, blade, .07, mastM, 6)); g.add(at(mesh(G.box(.08, 1.1, .45), mastM), ...blade.clone().lerp(oarTop, .12).toArray()).rotateX(-.35));
  g.add(beam(oarTop, V(.55, 1.05, 3.95), .04, mastM, 6)); g.add(beam(V(1.45, 0, 4.2), V(1.45, 1.1, 4.3), .06, mastM, 6));
  // cargo: barrels, crates, sacks, rope coil, hatch
  const r = rng('ship');
  for (const [x, z] of [[-.85, -2.3], [-.4, -2.75], [-.95, -2.95]]) g.add(at(barrel({ s: .85 }), x, 0, z));
  g.add(at(rot(barrel({ s: .8, c: '#9a6b43' }), Math.PI / 2, 0, .3), .85, .28, -2.6));
  g.add(at(crate({ s: .62 }), .75, 0, -3.35)); g.add(at(rot(crate({ s: .5, c: '#b98d58' }), 0, .4, 0), .7, .62, -3.3));
  g.add(at(sack({}), -.9, 0, -1.6)); g.add(at(rot(sack({ c: '#cbb184' }), 0, .9, 0), -1.0, 0, .4));
  g.add(at(coil({}), -.85, 0, 3.4)); g.add(at(coil({ c: '#b89a6c' }), 1.0, 0, 2.6));
  const hatch = at(group(g), -.5, 0, 2.0); hatch.add(at(mesh(G.box(1.1, .16, 1.0), wood('#8a6243')), 0, .08, 0)); hatch.add(at(mesh(G.box(.9, .02, .8), mat('#2a1d16')), 0, .165, 0));
  for (let i = 0; i < 4; i++) hatch.add(at(mesh(G.box(.06, .05, .82), wood('#9a7048')), -.36 + i * .24, .19, 0));
  // stern lantern on a post
  g.add(beam(V(-.75, 0, 4.25), V(-.75, 1.95, 4.25), .045, mastM, 6)); g.add(beam(V(-.75, 1.9, 4.25), V(-.75, 1.9, 4.6), .03, mastM, 4));
  const lan = lantern({ glow: time === 'dag' ? 0 : 1 }); lan.position.set(-.75, 1.42, 4.6); g.add(lan);
  return { group: g, sail, pennant: pen, lantern: V(-.75, 1.55, 4.6) };
}
/** Square sail with vertical stripes; update(t, wind 0..1) billows and flutters it. */
function sailMesh(w, h, nx, ny) {
  const pos = new Float32Array((nx + 1) * (ny + 1) * 3), base = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) base.push([-w / 2 + w * i / nx, -h * j / ny]);
  const idx = [[], []]; const stripes = 7;
  for (let i = 0; i < nx; i++) { const sid = Math.floor((i + .5) / nx * stripes) % 2; for (let j = 0; j < ny; j++) { const A = j * (nx + 1) + i, B = A + 1, C = A + nx + 1, D = C + 1; idx[sid].push(A, C, B, B, C, D); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex([...idx[0], ...idx[1]]);
  geo.addGroup(0, idx[0].length, 0); geo.addGroup(idx[0].length, idx[1].length, 1);
  const m = new THREE.Mesh(geo, [mat('#efe3c8', { side: THREE.DoubleSide, rough: .95 }), mat('#c0533b', { side: THREE.DoubleSide, rough: .95 })]); m.castShadow = true; m.receiveShadow = true;
  const update = (t, wind = .4, storm = 0) => {
    base.forEach(([x, y], k) => { const u = x / (w / 2), v = -y / h;
      const bil = (1 - u * u) * Math.sin(Math.min(1, v * 1.1) * Math.PI * .5 + .25) * (.55 + .4 * wind);
      const fl = (.04 + .16 * storm) * Math.sin(t * (3 + 4 * storm) + u * 2.5 + v * 3) * v;
      pos[k * 3] = x * (1 - .04 * v); pos[k * 3 + 1] = y + Math.abs(u) * v * .15 * storm; pos[k * 3 + 2] = -(bil + fl); });
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
  };
  update(0); return { mesh: m, update };
}

/** The hold below deck (Jona sleeps here): plank shell, beams, ladder to a hatch, cargo, a swinging lantern. */
export function hold() {
  const g = new THREE.Group(); const side = THREE.DoubleSide;
  const plank = mat('#7d5a3c', { side, rough: .95 }), plank2 = mat('#6c4c32', { side, rough: .95 }), beamM = wood('#5a3f2a'), floorM = mat('#8d6643', { rough: .95 });
  const L = 7.4, H = 2.4; const sec = y => 1.85 + .45 * Math.sin(clamp(y / H) * Math.PI * .85);   // half width at height y
  const n = faceted() ? 6 : 12;
  for (const sg of [1, -1]) for (let k = 0; k < n; k++) {      // side walls in horizontal strakes
    const y0 = H * k / n, y1 = H * (k + 1) / n; const geo = new THREE.PlaneGeometry(L, 1, 6, 1); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getX(i), y = p.getY(i) > 0 ? y1 : y0; p.setXYZ(i, sg * sec(y), y, z); }
    geo.computeVertexNormals(); g.add(mesh(geo, k % 2 ? plank : plank2));
  }
  const fl = mesh(G.plane(4.4, L, 1, 1), floorM, { cast: false }); fl.rotation.x = -Math.PI / 2; g.add(fl);
  for (let i = -4; i <= 4; i++) g.add(at(mesh(G.box(.025, .006, L), mat('#6e4e33'), { cast: false }), i * .45, .003, 0));
  // ceiling (deck above) with a hatch opening at the back right (light falls in there)
  const hx = 1.0, hz = -1.75, hw = .55;
  for (const [x0, x1, z0, z1] of [[-2.4, 2.4, -L / 2, hz - hw], [-2.4, 2.4, hz + hw, L / 2], [-2.4, hx - hw, hz - hw, hz + hw], [hx + hw, 2.4, hz - hw, hz + hw]])
    g.add(at(mesh(G.box(x1 - x0, .12, z1 - z0), plank2), (x0 + x1) / 2, H + .06, (z0 + z1) / 2));
  for (let i = 0; i < 6; i++) { const z = -L / 2 + .5 + i * 1.3; if (Math.abs(z - hz) < hw + .1) continue; g.add(at(mesh(G.box(4.6, .16, .16), beamM), 0, H - .08, z)); }
  for (const sg of [1, -1]) for (let i = 0; i < 5; i++) { const z = -L / 2 + .8 + i * 1.5; const pts = []; for (let k = 0; k <= 6; k++) { const y = H * k / 6; pts.push(V(sg * (sec(y) - .06), y, z)); } g.add(tube(pts, .07, beamM, 12, 5)); }
  // end walls
  for (const z of [-L / 2, L / 2]) g.add(at(mesh(G.box(5, H + .2, .1), plank2), 0, H / 2, z));
  // hatch: sky patch above + ladder
  const sky = dyn(new THREE.Mesh(G.plane(hw * 2.2, hw * 2.2), new THREE.MeshBasicMaterial({ color: '#cfd8de', fog: false }))); sky.rotation.x = Math.PI / 2; sky.position.set(hx, H + .3, hz); g.add(sky);
  for (const dx of [-.28, .28]) g.add(beam(V(hx + dx, 0, hz + .55), V(hx + dx, H + .1, hz + .15), .04, beamM, 5));
  for (let i = 1; i < 8; i++) { const k = i / 8; g.add(at(rot(mesh(G.cyl(.03, .03, .6, 5), beamM), 0, 0, Math.PI / 2), hx, k * (H + .1), hz + .55 - .4 * k)); }
  // Jona's bed: sacks + straw + blanket along z (head at -z), at x -1.0
  const straw = mat('#d9bf7a', { rough: 1 }), blanket = mat('#5b7d6e', { rough: 1 });
  g.add(at(mesh(G.box(1.0, .1, 2.4, .04), straw, { cast: false }), -1.0, .05, -.3));
  g.add(at(scl(mesh(G.sphere(.28, 10, 8), mat('#e9dcc0', { rough: 1 })), 1.2, .45, .8), -1.0, .16, -1.25));
  g.add(at(rot(mesh(G.box(.95, .05, 1.2, .02), blanket), 0, 0, .05), -.95, .12, .45));
  // cargo
  const r = rng('hold');
  for (const [x, z, s] of [[-1.55, -2.6, .7], [-.9, -2.95, .6], [1.45, -2.95, .75], [1.6, -.55, .55], [1.5, 3.0, .7]]) g.add(at(rot(crate({ s }), 0, r() * .5, 0), x, 0, z));
  g.add(at(rot(crate({ s: .5, c: '#b98d58' }), 0, .3, 0), 1.45, .75, -2.95));
  for (const [x, z] of [[-1.55, 1.7], [-1.6, 2.45], [-1.0, 2.9]]) g.add(at(barrel({ s: .9 }), x, 0, z));
  for (const [x, z] of [[1.6, .35], [1.65, 1.1]]) g.add(at(rot(sack({ c: '#cbb184' }), 0, r() * 3, 0), x, 0, z));
  g.add(at(coil({}), .2, 0, -2.9));
  for (const [x, z] of [[1.55, 1.9], [1.75, 2.45]]) g.add(at(pot({ c: '#a35f3d', amphora: true }), x, 0, z));
  // lantern swinging from a beam
  const lamp = [-.3, H - .1, -.15];   // where the lantern hangs from (it swings around this point)
  const pivot = dyn(at(group(g), ...lamp)); pivot.add(at(mesh(G.cyl(.008, .008, .5, 3), mat('#c2a77c')), 0, -.25, 0));
  const lan = lantern({ glow: 1 }); lan.position.y = -.88; pivot.add(lan); bake(pivot);
  return { group: g, sky, pivot, lamp, H, L };
}
