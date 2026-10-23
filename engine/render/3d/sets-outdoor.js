// Outdoor sets in Bible times (registered with defineSet from sets.js). See sets.js for the set API.
//   zee       wooden ship on the sea (calm or storm) + the hold below deck
//   woestijn  dunes, goat-hair tents, palms, camels, campfire
//   stad      old near-eastern city: gate in the wall, flat-roofed houses, stairs, market stall, square
//   heuvels   green hills, olive trees, rocks, a grazing flock, a stream and a path
// Everything moves as a pure function of t. Ground that is not flat answers groundY(x, z) exactly (the
// height of the triangle under the point). Wide shots and shots without actors use the set's camera():
// a fixed, composed direction per set that fits the shot's actors (portrait frame: keep it a column).
import { THREE, mat, mesh, at, rot, scl, group, G, sky, lights, rng, wobble, V, clamp, lerp, smooth, inout, segs, faceted, bake, basic, W, H, STYLE } from './core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { defineSet } from './sets.js';
import * as P from './props-outdoor.js';

const UP = V(0, 1, 0);
const dyn = o => { o.userData.dynamic = true; return o; };

/* ---------- shared: atmosphere ---------- */
const TIMES = {
  dag:   { top: '#4f97d3', horizon: '#d6e9f0', bottom: '#d6e9f0', fog: '#d3e3ea', key: '#fff1d6', keyI: 2.7, keyDir: [5, 9, 3], fillSky: '#cfe3f2', fillGround: '#9a8460', fillI: 1.05, rim: '#ffe7c4', rimI: .45, near: 30, far: 260 },
  avond: { top: '#46598f', horizon: '#f7a465', bottom: '#eba071', fog: '#e9a47c', key: '#ffad62', keyI: 2.5, keyDir: [-7, 3, -8], fillSky: '#a48fbd', fillGround: '#6e4a3a', fillI: .85, rim: '#ffa060', rimI: .8, near: 30, far: 240 },
  nacht: { top: '#081230', horizon: '#243d68', bottom: '#1a2b4a', fog: '#1c2c4a', key: '#a9c0f0', keyI: 1.0, keyDir: [-4, 8, 3], fillSky: '#4a62a0', fillGround: '#1c1e2a', fillI: .85, rim: '#7fa0e0', rimI: .45, near: 25, far: 200 },
};
/** Sky dome, fog and the light rig for a time of day (o overrides any field). */
function atmosphere(scene, time, o = {}) {
  const A = { ...TIMES[time] || TIMES.dag, ...o };
  const dome = sky(scene, { top: A.top, horizon: A.horizon, bottom: A.bottom, sharp: A.sharp ?? (time === 'dag' ? 3 : 2) });
  scene.fog = new THREE.Fog(A.fog, A.near, A.far); scene.background = new THREE.Color(A.horizon);
  const L = lights(scene, { key: A.key, keyI: A.keyI, keyDir: A.keyDir, fillSky: A.fillSky, fillGround: A.fillGround, fillI: A.fillI, rim: A.rim, rimI: A.rimI, focus: A.focus || [0, 1, 0], box: A.box || 7, mapSize: A.mapSize || 2048 });
  return { A, dome, L };
}
function stars(parent, { n = 420, seed = 1, r = 330 } = {}) {
  const R = rng('stars' + seed); const p = [];
  for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, y = .08 + Math.pow(R(), .7) * .92, h = Math.sqrt(1 - y * y); p.push(Math.cos(a) * h * r, y * r, Math.sin(a) * h * r); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: '#fdf8e8', size: 2.4, sizeAttenuation: false, fog: false, transparent: true, opacity: .9, depthWrite: false }));
  s.renderOrder = -9; parent.add(s); return s;
}
function moon(parent, pos = [-90, 150, -230]) {
  const m = new THREE.Mesh(G.sphere(10, 20, 14), basic('#f6eed2', { fog: false })); m.position.set(...pos); parent.add(m);
  const halo = new THREE.Mesh(G.sphere(22, 16, 10), new THREE.MeshBasicMaterial({ color: '#8fa6d8', transparent: true, opacity: .14, fog: false, depthWrite: false })); halo.position.set(...pos); parent.add(halo);
  return m;
}
/** Low-poly clouds: clusters of flattened blobs, far away (no fog), lit by the key light. */
function clouds(parent, { n = 7, seed = 1, color = '#ffffff', dist = [140, 230], h = [35, 70], size = 1, az = [-2.4, -.7] } = {}) {
  const m = mat(color, { rough: 1, emissive: color, glow: .5 }).clone(); m.fog = false; const R = rng('clouds' + seed); const g = group(parent);
  for (let i = 0; i < n; i++) {
    const a = lerp(az[0], az[1], R()), d = lerp(dist[0], dist[1], R()), y = lerp(h[0], h[1], R()); const s = (10 + R() * 9) * size;
    const c = at(group(g), Math.cos(a) * d, y, Math.sin(a) * d);
    for (let j = 0; j < 5; j++) { const b = mesh(G.sphere(1, 12, 8), m, { cast: false, receive: false }); const k = s * (.55 + R() * .5) * (j === 2 ? 1.3 : 1); b.scale.set(k * 1.2, k * .7, k); b.position.set((j - 2) * s * .7 + R() * 3, (j === 2 ? s * .25 : 0) + R() * 2, R() * 4); c.add(b); }
  }
  return g;
}
/** Hazy low-poly mountains on the horizon. */
function mountains(parent, { n = 9, seed = 1, color = '#9aa7a6', dist = [180, 260], h = [25, 60], az = [-3.0, -.15], mesa = false } = {}) {
  const m = mat(color, { rough: 1 }); const R = rng('mtn' + seed);
  for (let i = 0; i < n; i++) { const a = lerp(az[0], az[1], (i + R() * .8) / n), d = lerp(dist[0], dist[1], R()), hh = lerp(h[0], h[1], R()) * (mesa ? .55 : 1);
    const rb = hh * (mesa ? 2.2 + R() * 1.5 : 1.3 + R() * .6); const geo = mesa ? G.cyl(rb * (.55 + R() * .2), rb, hh, 7) : G.cyl(rb * .08, rb, hh, 7);
    const c = mesh(geo, m, { cast: false, receive: false }); c.position.set(Math.cos(a) * d, hh / 2 - 3, Math.sin(a) * d); c.rotation.y = R() * 3; c.scale.z = .7 + R() * .5; parent.add(c); }
}

/* ---------- shared: faceted terrain with an exact height lookup ---------- */
/**
 * height(x, z) -> y; color(x, z, y, slope, r) -> '#hex' (per face in faceted looks, per vertex otherwise).
 * The grid is dense (about `core` m) in the middle and stretches out to R. jitter: random height per vertex
 * (scaled by quiet(x, z) 0..1, keep it 0 where people stand).
 */
function terrain({ R = 200, n = 64, core = .8, height, color, jitter = .1, quiet = () => 1, seed = 1 }) {
  const half = n / 2, c = core * half;
  const warp = u => Math.sign(u) * (c * Math.abs(u) + (R - c) * Math.pow(Math.abs(u), 4));
  const xs = [], zs = []; for (let i = 0; i <= n; i++) { xs.push(warp(-1 + 2 * i / n)); zs.push(warp(-1 + 2 * i / n)); }
  const r = rng('terrain' + seed); const Hh = [];
  for (let i = 0; i <= n; i++) { Hh.push([]); for (let j = 0; j <= n; j++) Hh[i].push(height(xs[i], zs[j]) + (r() - .5) * 2 * jitter * quiet(xs[i], zs[j])); }
  const diag = (i, j) => (i + j) & 1;   // 1: diagonal p00-p11, 0: diagonal p01-p10
  const tris = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p00 = [i, j], p10 = [i + 1, j], p01 = [i, j + 1], p11 = [i + 1, j + 1];
    if (diag(i, j)) tris.push([p00, p01, p11], [p00, p11, p10]); else tris.push([p00, p01, p10], [p01, p11, p10]);
  }
  const vtx = ([i, j]) => [xs[i], Hh[i][j], zs[j]];
  const geo = new THREE.BufferGeometry(); const col = new THREE.Color(); const rc = rng('tcol' + seed);
  if (faceted()) {
    const pos = new Float32Array(tris.length * 9), cols = new Float32Array(tris.length * 9); const a = V(), b = V(), e = V(), nn = V();
    tris.forEach((t, k) => { const v = t.map(vtx); v.forEach((p, q) => pos.set(p, k * 9 + q * 3));
      a.set(...v[1]).sub(e.set(...v[0])); b.set(...v[2]).sub(e); nn.crossVectors(a, b).normalize();
      const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cy = (v[0][1] + v[1][1] + v[2][1]) / 3, cz = (v[0][2] + v[1][2] + v[2][2]) / 3;
      col.set(color(cx, cz, cy, 1 - nn.y, rc())); for (let q = 0; q < 3; q++) cols.set([col.r, col.g, col.b], k * 9 + q * 3); });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  } else {
    const pos = [], cols = [], idx = []; const id = (i, j) => i * (n + 1) + j;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { pos.push(...vtx([i, j])); col.set(color(xs[i], zs[j], Hh[i][j], 0, rc())); cols.push(col.r, col.g, col.b); }
    tris.forEach(t => idx.push(...t.map(([i, j]) => id(i, j))));
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.setIndex(idx);
  }
  geo.computeVertexNormals();
  const m = mat('#ffffff', { rough: 1 }).clone(); m.vertexColors = true;
  const ground = dyn(mesh(geo, m, { cast: false }));
  const find = (arr, v) => { let lo = 0, hi = arr.length - 2; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid - 1; } return lo; };
  ground.userData.heightAt = (x, z) => {
    const i = find(xs, x), j = find(zs, z); const fx = clamp((x - xs[i]) / (xs[i + 1] - xs[i])), fz = clamp((z - zs[j]) / (zs[j + 1] - zs[j]));
    const h00 = Hh[i][j], h10 = Hh[i + 1][j], h01 = Hh[i][j + 1], h11 = Hh[i + 1][j + 1];
    if (diag(i, j)) return fz >= fx ? h00 + fz * (h01 - h00) + fx * (h11 - h01) : h00 + fx * (h10 - h00) + fz * (h11 - h10);
    return fx + fz <= 1 ? h00 + fx * (h10 - h00) + fz * (h01 - h00) : h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
  };
  return ground;
}
const mix = (c1, c2, k) => '#' + new THREE.Color(c1).lerp(new THREE.Color(c2), clamp(k)).getHexString();
const shadeHex = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
/** Distance from (x, z) to a polyline [[x, z], ...]. */
function distLine(pts, x, z) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const dx = bx - ax, dz = bz - az; const k = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)); best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k)); }
  return best;
}

/* ---------- shared: the wide camera (fits the shot's people along the set's chosen direction) ---------- */
const HEADH = { stand: 1.6, sit: 1.22, kneel: 1.18, lie: .3 };
function shotPoints(def, shot, groundY) {
  const pts = [];
  for (const a of shot.actors || []) for (const k of [a.at, a.to]) {
    const sp = k && def.spots[k]; if (!sp) continue; const [x, z] = sp.p; const base = a.base || sp.base || 'stand'; const y = groundY ? groundY(x, z) : 0;
    if (base === 'lie') pts.push(V(x, y - .1, z + .8), V(x, y + .45, z - 1.35), V(x + .4, y + .3, z - .3), V(x - .4, y + .3, z - .3));
    else { const top = y + (HEADH[base] ?? 1.6) + .32; pts.push(V(x, y, z), V(x, top, z), V(x + .38, y + .9, z), V(x - .38, y + .9, z), V(x, y + .9, z + .38), V(x, y + .9, z - .38)); }
  }
  return pts;
}
/** Distance along `dir` (unit, focus -> camera) at which all points fit the portrait frame. */
function fitDist(points, focus, dir, fov, mx = .8, my = .76) {
  const tv = Math.tan(fov * Math.PI / 360) * my, th = Math.tan(fov * Math.PI / 360) * (W / H) * mx;
  const f = dir.clone().negate(), right = f.clone().cross(UP).normalize(), up = right.clone().cross(f);
  const ok = d => { const cam = focus.clone().addScaledVector(dir, d); return points.every(p => { const v = p.clone().sub(cam), z = v.dot(f); return z > .3 && Math.abs(v.dot(right)) / z <= th && Math.abs(v.dot(up)) / z <= tv; }); };
  let lo = .5, hi = 120; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } return hi;
}
/**
 * camera() for a set. views: [{ when(shot) -> bool, pos, target, fov, minD, maxD, lift }] (first match wins;
 * the last one is the default). Without actors: the view's own pos/target. With actors: the view's direction,
 * pulled back until everyone fits (at least minD), aimed a little above their middle. Slow dolly over the shot.
 */
function wideCamera(def, getGround, views) {
  return (t, shot, k) => {
    const v = views.find(v => !v.when || v.when(shot)) || views[views.length - 1];
    const pos = V(...v.pos), target = V(...v.target); const dir = pos.clone().sub(target).normalize();
    const pts = shotPoints(def, shot, getGround());
    let cam, aim;
    if (!pts.length) { aim = target; cam = pos; }
    else {
      const box = new THREE.Box3().setFromPoints(pts); aim = box.getCenter(V()); aim.y += v.lift ?? .3;
      const d = clamp(fitDist(pts, aim, dir, v.fov), v.minD ?? 6, v.maxD ?? 40); cam = aim.clone().addScaledVector(dir, d);
    }
    const e = inout(k); const rel = cam.clone().sub(aim); rel.applyAxisAngle(UP, (e - .5) * (v.orbit ?? .07)); rel.multiplyScalar(1.03 - .06 * e);
    return { pos: aim.clone().add(rel), target: aim.clone(), fov: v.fov };
  };
}
const spotsOf = shot => (shot.actors || []).flatMap(a => [a.at, a.to]).filter(Boolean);

/**
 * Last step of build(): merge static meshes (bake), then give the set's own surfaces Lambert materials
 * (same matte look as MeshStandardMaterial at this roughness, a quarter cheaper per pixel in SwiftShader).
 * Characters are added later and keep their materials. Toon materials stay as they are.
 */
const lamberts = new Map();
function lambert(m) {
  if (!m?.isMeshStandardMaterial) return m;
  if (!lamberts.has(m.uuid)) lamberts.set(m.uuid, new THREE.MeshLambertMaterial({ color: m.color, map: m.map, vertexColors: m.vertexColors, flatShading: m.flatShading, side: m.side,
    emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, transparent: m.transparent, opacity: m.opacity, fog: m.fog }));
  return lamberts.get(m.uuid);
}
/**
 * Fewer draw calls than bake(): every opaque static mesh under root, whatever its colour, goes into one mesh
 * per (side, shadow flags, fog) with the colour as a vertex attribute. Emissive, transparent, textured
 * (except the clay grain), instanced and dynamic meshes are left for bake().
 */
function bakeColors(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const buckets = new Map(); const done = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const m = o.material; if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshToonMaterial) || m.transparent || m.vertexColors || (m.map && STYLE.name !== 'klei')) return;
    if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) * m.emissiveIntensity > .01) return;
    const g0 = o.geometry; if (!g0.attributes.position || !g0.attributes.normal) return;
    const key = `${m.side}|${o.castShadow}|${o.receiveShadow}|${m.fog}`;
    if (!buckets.has(key)) buckets.set(key, { side: m.side, fog: m.fog, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([m.color.r, m.color.g, m.color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); buckets.get(key).geos.push(g); done.push(o);
  });
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false); b.geos.forEach(g => g.dispose()); if (!merged) continue;
    const m = mat('#ffffff', { side: b.side }).clone(); m.vertexColors = true; m.fog = b.fog;
    const mesh2 = new THREE.Mesh(merged, m); mesh2.castShadow = b.cast; mesh2.receiveShadow = b.receive; root.add(mesh2);
  }
  done.forEach(o => o.parent.remove(o));
}
function finish(scene, roots = [scene]) {
  roots.forEach(r => { bakeColors(r); bake(r); });
  scene.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(lambert) : lambert(o.material); });
}

/* =====================================================================================================
   zee: the ship stays put (people stand on a fixed deck); the sea, sky, rain and horizon rock around it,
   which reads as the ship pitching and rolling. The hold (ruim) is its own room, shown when a shot's
   actors are there.
   ===================================================================================================== */
const HX = 40;   // the hold sits here, away from the ship
const HOLD = new Set(['ruim', 'ruim-staan']);
const inHold = shot => spotsOf(shot).some(s => HOLD.has(s));
defineSet('zee', {
  spots: {
    boeg: { p: [.15, -3.85], yaw: 2.35 },
    mast: { p: [.6, -.4], yaw: .55 },
    achtersteven: { p: [.3, 3.95], yaw: 2.45 },
    reling: { p: [1.15, .3], yaw: Math.PI / 2 },
    dek: { p: [-.2, .9], yaw: .3 },
    ruim: { p: [HX - 1.0, -.25], yaw: 0, base: 'lie' },
    'ruim-staan': { p: [HX - .3, -1.95], yaw: -.75 },
  },
  build({ time = 'dag', weather = 'helder', seed: reelSeed = '' } = {}) {
    const seed = 'zee';   // the layout is the same in every reel and at every time; only lightning timing follows the reel
    const def = this; const storm = weather === 'storm'; const scene = new THREE.Scene();
    const T = {
      dag:   storm ? { top: '#3b4652', horizon: '#7f8c93', bottom: '#56656c', fog: '#6f7d84', key: '#d5dde3', keyI: 1.5, keyDir: [4, 8, 2], fillSky: '#93a3b0', fillGround: '#3e4c52', fillI: 1.2, rim: '#c9d6e0', rimI: .5, near: 12, far: 110 }
                   : { keyDir: [4, 8, 1.5], keyI: 2.4, near: 40, far: 300, horizon: '#d4e8f0', bottom: '#1f6f8c', fog: '#c9e0ea' },
      avond: storm ? { top: '#2a2c3c', horizon: '#73606a', bottom: '#3d3f4c', fog: '#5b5260', key: '#e8aa82', keyI: 1.7, keyDir: [-6, 4, 2], fillSky: '#7d7896', fillGround: '#3a343a', fillI: 1.25, rim: '#ff9a6a', rimI: .6, near: 12, far: 100 }
                   : { near: 40, far: 280, bottom: '#8a6a70', keyDir: [-7, 3.5, 1] },
      nacht: storm ? { top: '#060a12', horizon: '#1b2633', bottom: '#0e161f', fog: '#151f2a', key: '#a9bce0', keyI: 1.2, keyDir: [3, 8, 3], fillSky: '#4f6292', fillGround: '#1a1f2a', fillI: 1.2, rim: '#7f95c0', rimI: .4, near: 10, far: 90 }
                   : { near: 30, far: 220, bottom: '#14223a', keyI: 1.4, keyDir: [3, 8, 3], fillI: 1.2 },
    }[time] || {};
    const at0 = atmosphere(scene, time, { ...T, focus: [0, 1, 0], box: 7.2 });
    const { L } = at0; const A = at0.A;
    // rocking world: sea, sky, clouds, rain, lightning (pivot under the ship at the waterline)
    const rock = dyn(group(scene)); rock.add(at0.dome);
    const WL = -1.0;
    // sea: grid dense near the ship, vertex colours for troughs and foam
    const n = faceted() ? 56 : 96, R = 260, pw = 1.9;
    const sea = new THREE.PlaneGeometry(2, 2, n, n); sea.rotateX(-Math.PI / 2);
    const sp = sea.attributes.position; const bx = [], bz = [];
    for (let i = 0; i < sp.count; i++) { const u = sp.getX(i), v = sp.getZ(i); bx.push(Math.sign(u) * R * Math.pow(Math.abs(u), pw) + u * 6); bz.push(Math.sign(v) * R * Math.pow(Math.abs(v), pw) + v * 6); }
    const seaCol = new Float32Array(sp.count * 3); sea.setAttribute('color', new THREE.BufferAttribute(seaCol, 3));
    const seaM = mat('#ffffff', { rough: storm ? .6 : .38 }).clone(); seaM.vertexColors = true;
    const seaMesh = dyn(mesh(sea, seaM, { cast: false, receive: !storm })); seaMesh.frustumCulled = false; seaMesh.position.y = 0; rock.add(seaMesh);
    const pal = {
      dag: storm ? ['#2b4a52', '#3d636b', '#d9e2e2'] : ['#0f5673', '#1f7d9c', '#d9eef0'],
      avond: storm ? ['#2c3540', '#45505a', '#c9c2c0'] : ['#1d3550', '#4b5878', '#f5c89c'],
      nacht: storm ? ['#0d1820', '#1d2d38', '#9fb0b8'] : ['#0b1a30', '#1b3354', '#8fb0d8'],
    }[time] || ['#0f5673', '#1f7d9c', '#d9eef0'];
    const cDeep = new THREE.Color(pal[0]), cMid = new THREE.Color(pal[1]), cFoam = new THREE.Color(pal[2]); const cTmp = new THREE.Color();
    const waves = (storm ? [[1.15, 17, 1.05], [.55, 11, .55], [1.9, 7.5, .32], [.2, 4.2, .14]] : [[1.2, 10, .2], [.4, 6.5, .1], [2.0, 3.6, .05]])
      .map(([a, l, amp], i) => ({ dx: Math.cos(a), dz: Math.sin(a), k: 2 * Math.PI / l, w: Math.sqrt(9.81 * 2 * Math.PI / l) * .75, amp, ph: i * 1.7 }));
    const ampSum = waves.reduce((s, w) => s + w.amp, 0);
    const updateSea = t => {
      for (let i = 0; i < sp.count; i++) {
        const x = bx[i], z = bz[i]; let h = 0; for (const w of waves) h += w.amp * Math.sin(w.k * (x * w.dx + z * w.dz) - w.w * t + w.ph);
        const d = Math.hypot(x / 2.25, z / 6.6); const damp = lerp(.12, 1, smooth((d - 1.05) / 2.6)); h *= damp;
        sp.setXYZ(i, x, h, z);
        const k = h / ampSum; cTmp.copy(cDeep).lerp(cMid, clamp(.5 + k * 1.2));
        const foam = smooth((k - .42) / .3) * (storm ? 1 : .3) + (d < 1.35 ? (1.35 - d) * 1.6 * (storm ? .9 : .35) * (.6 + .4 * Math.sin(t * 2 + x * 3 + z)) : 0);
        cTmp.lerp(cFoam, clamp(foam)); seaCol[i * 3] = cTmp.r; seaCol[i * 3 + 1] = cTmp.g; seaCol[i * 3 + 2] = cTmp.b;
      }
      sp.needsUpdate = true; sea.attributes.color.needsUpdate = true; if (!faceted()) sea.computeVertexNormals();
    };
    // sky dressing
    if (time === 'nacht' && !storm) { stars(rock, { seed }); moon(rock, [-110, 120, -230]); }
    if (storm) clouds(rock, { n: 14, seed, color: time === 'nacht' ? '#1c2530' : '#4c565e', dist: [70, 150], h: [14, 30], size: 1.6, az: [-3.1, 0] });
    else clouds(rock, { n: 6, seed, color: time === 'avond' ? '#f2b48a' : time === 'nacht' ? '#2b3a5a' : '#ffffff', az: [-2.6, -.6] });
    if (time === 'avond' && !storm) { const sun = new THREE.Mesh(G.sphere(16, 20, 14), basic('#ffd08a', { fog: false })); sun.position.set(-120, 22, -250); rock.add(sun); }
    // rain (storm): slanted streaks, each wraps on its own
    let rain = null;
    if (storm) {
      const N = 1500, r = rng('rain' + seed), base = Array.from({ length: N }, () => [r(), r(), r()]);
      const pos = new Float32Array(N * 6); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: time === 'nacht' ? '#7d8fa3' : '#c3ced8', transparent: true, opacity: time === 'nacht' ? .45 : .55 }));
      obj.frustumCulled = false; rock.add(obj);
      const AX = 26, AY = 13, AZ = 34, fall = 15, slant = .32, len = .65;
      rain = { obj, update(t) { for (let i = 0; i < N; i++) { const [x0, y0, z0] = base[i]; const ph = ((y0 + t * fall / AY) % 1 + 1) % 1;
        const y = 11 - ph * AY - WL, x = ((x0 * AX + slant * ph * AY) % AX) - AX / 2 + 1, z = z0 * AZ - AZ / 2 + 2;
        pos.set([x, y, z, x - slant * len, y + len, z], i * 6); } geo.attributes.position.needsUpdate = true; } };
    }
    // lightning (storm): deterministic flashes, a bolt far ahead
    const flashes = []; const bolts = [];
    if (storm) {
      const r = rng('flash' + reelSeed); let tt = 1.4 + r() * 1.5; while (tt < 300) { flashes.push({ t: tt, az: (r() - .5) * .9, v: Math.floor(r() * 3) }); tt += 3.6 + r() * 5.2; }
      const bm = new THREE.MeshBasicMaterial({ color: '#f2f5ff', fog: false, side: THREE.DoubleSide });
      for (let b = 0; b < 3; b++) { const rr = rng('bolt' + b + seed); const pts = []; let x = 0; for (let i = 0; i <= 9; i++) { pts.push([x, 70 - i * 8]); x += (rr() - .5) * 9; }
        const p = []; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const w0 = 1.1 - i * .08, w1 = 1.1 - (i + 1) * .08; p.push(x0 - w0, y0, 0, x1 - w1, y1, 0, x1 + w1, y1, 0, x0 - w0, y0, 0, x1 + w1, y1, 0, x0 + w0, y0, 0); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); const o = dyn(new THREE.Mesh(g, bm)); o.visible = false; rock.add(o); bolts.push(o); }
    }
    const flashAt = t => { let f = null; for (const x of flashes) { if (x.t > t) break; f = x; } if (!f) return [0, null]; const dt = t - f.t;
      const k = dt < .09 ? 1 : dt < .16 ? .2 : dt < .3 ? .85 : .85 * Math.exp(-(dt - .3) * 10); return [k < .02 ? 0 : k, f]; };
    // the ship
    const S = P.ship({ time }); const shipG = dyn(S.group); scene.add(shipG);
    // the hold
    const Hd = P.hold(); const holdG = dyn(Hd.group); holdG.position.x = HX; scene.add(holdG);
    // one point light: the stern lantern on deck (evening/night), the hold lantern below
    const lamp = new THREE.PointLight('#ffb866', 3, 8, 1.5); scene.add(lamp);
    finish(scene, [shipG, holdG, rock]);
    const baseHemi = L.hemi.intensity, skyU = at0.dome.material.uniforms, skyTop = skyU.top.value.clone(), skyHor = skyU.horizon.value.clone(), fogC = scene.fog.color.clone(), flashC = new THREE.Color('#b8c6e8');
    const fogDeck = [scene.fog.near, scene.fog.far], bgDeck = scene.background.clone();
    const sunDeck = { c: L.sun.color.clone(), i: L.sun.intensity, pos: L.sun.position.clone(), tgt: L.sun.target.position.clone() };
    const holdSun = { dag: storm ? ['#c3cfd8', 2.2] : ['#fff1d6', 3.4], avond: storm ? ['#c7a48e', 1.5] : ['#ffb46e', 2.6], nacht: storm ? ['#8295b8', .9] : ['#8fa8d8', 1.1] }[time] || ['#fff1d6', 3];
    const hatchSky = new THREE.Color(storm ? (time === 'nacht' ? '#2a3442' : '#9aa6ae') : time === 'nacht' ? '#24365a' : time === 'avond' ? '#f2b78a' : '#d9ecf5');
    const roll = wobble(seed + 'roll'), pitch = wobble(seed + 'pitch');
    const bDeck = { x: [-11, 12], z: [-14, 19], y: [.4, 10] }, bHold = { x: [HX - 1.6, HX + 1.75], z: [-3.2, 3.3], y: [.45, 2.05] };
    const wideDeck = { pos: [3.9, 4.7, 10.2], target: [0, 1.7, -.8] }, wideHold = { pos: [HX + 1.55, 2.05, 1.55], target: [HX - .95, .3, -.75] };
    const world = {
      scene, wide: wideDeck, bounds: bDeck,
      groundY(x, z) { if (x > HX - 5) return (x > HX - 1.55 && x < HX - .45 && z > -1.55 && z < .95) ? .28 : 0; return 0; },
      update(t, shot) {
        const below = !!shot && inHold(shot);
        world.bounds = below ? bHold : bDeck; world.wide = below ? wideHold : wideDeck;
        shipG.visible = rock.visible = !below; holdG.visible = below;
        const [fl, f] = flashAt(t);
        if (below) {
          scene.background.set('#120d0a'); scene.fog.color.set('#1a120d'); scene.fog.near = 6; scene.fog.far = 22;
          L.sun.color.set(holdSun[0]); L.sun.intensity = holdSun[1] * (1 + fl * 1.5); L.sun.target.position.set(HX, 0, 0); L.sun.position.set(HX - 1.05, 7, -1.4);
          L.hemi.intensity = .32 + fl * .5; if (L.rim) L.rim.intensity = 0;
          const sw = (storm ? .32 : .1) * Math.sin(t * (storm ? 1.9 : 1.2)) + (storm ? .06 * Math.sin(t * 4.3) : 0);
          Hd.pivot.rotation.set(sw * .4, 0, sw);
          const [px, py, pz] = Hd.lamp; const lx = HX + px + Math.sin(sw) * .76, ly = py - Math.cos(sw) * .76, lz = pz - Math.sin(sw * .4) * .76;
          lamp.visible = true; lamp.position.set(lx, ly, lz); lamp.intensity = 5.5; lamp.distance = 7.5; lamp.color.set('#ffb35c');
          Hd.sky.material.color.copy(hatchSky).lerp(flashC, fl * .8);
        } else {
          scene.background.copy(bgDeck); scene.fog.near = fogDeck[0]; scene.fog.far = fogDeck[1];
          L.sun.color.copy(sunDeck.c); L.sun.intensity = sunDeck.i; L.sun.position.copy(sunDeck.pos); L.sun.target.position.copy(sunDeck.tgt);
          L.hemi.intensity = baseHemi + fl * 2.2; if (L.rim) L.rim.intensity = A.rimI;
          skyU.top.value.copy(skyTop).lerp(flashC, fl * .55); skyU.horizon.value.copy(skyHor).lerp(flashC, fl * .45); scene.fog.color.copy(fogC).lerp(flashC, fl * .35);
          lamp.visible = time !== 'dag'; lamp.position.copy(S.lantern); lamp.intensity = storm ? 3.5 : 3; lamp.distance = 9; lamp.color.set('#ffb866');
          // rocking: roll, pitch and heave of the whole world around the ship
          const R1 = storm ? .075 : .012, P1 = storm ? .04 : .006, Hv = storm ? .28 : .05;
          rock.rotation.set(P1 * pitch(t * .55), 0, R1 * roll(t * .5)); rock.position.set(0, WL + Hv * Math.sin(t * .8 + .6), 0);
          updateSea(t); if (rain) rain.update(t);
          bolts.forEach((b, i) => { b.visible = !!f && fl > .3 && f.v === i; if (b.visible) { b.position.set(Math.sin(f.az) * 150, -2, -Math.cos(f.az) * 150); b.rotation.y = -f.az; } });
          S.sail.update(t, storm ? .9 : .45, storm ? 1 : 0);
          S.pennant.rotation.set(0, (storm ? .6 : .25) * Math.sin(t * (storm ? 5 : 2)) + .4, (storm ? .15 : .05) * Math.sin(t * 7));
        }
        L.sun.shadow.camera.updateProjectionMatrix();
      },
      camera: null,
    };
    world.camera = wideCamera(def, () => world.groundY, [
      { when: inHold, pos: wideHold.pos, target: wideHold.target, fov: 50, minD: 3.2, maxD: 4.2, lift: .1, orbit: .04 },
      { when: s => !(s.actors || []).length, pos: [9.5, 5.6, 15.5], target: [0, 2.8, -.6], fov: 46 },
      { pos: wideDeck.pos, target: wideDeck.target, fov: 46, minD: 9, maxD: 16, lift: 1.1 },
    ]);
    world.update(0, null);
    return world;
  },
});

/* =====================================================================================================
   woestijn: a camp of goat-hair tents in a hollow between dunes, palms by a small pool, camels, campfire.
   ===================================================================================================== */
defineSet('woestijn', {
  spots: {
    tent: { p: [-1.45, -1.45], yaw: .35 },
    midden: { p: [.2, -.4], yaw: 0 },
    links: { p: [-2.2, .6], yaw: .6 },
    rechts: { p: [2.1, .2], yaw: -.55 },
    kampvuur: { p: [-.15, 1.85], yaw: .2, seat: .44, base: 'sit' },
    verte: { p: [-1.2, -14.5], yaw: .1 },
  },
  build({ time = 'dag' } = {}) {
    const seed = 'woestijn';
    const def = this; const scene = new THREE.Scene(); const night = time === 'nacht', eve = time === 'avond';
    const T = {
      dag: { top: '#2a6fc0', horizon: '#e4dccb', bottom: '#eedcc0', fog: '#ecd7b4', key: '#fff0d2', keyI: 2.6, keyDir: [6, 9, 3.5], fillGround: '#c9a26c', near: 40, far: 330 },
      avond: { top: '#3f4f8a', horizon: '#f59a58', bottom: '#e99a66', fog: '#e9a070', keyDir: [-8, 3, -1.5], fillGround: '#8a5a3c', near: 35, far: 300 },
      nacht: { horizon: '#2a3f6a', fog: '#1f2f50', fillGround: '#2a2622', near: 30, far: 240 },
    }[time] || {};
    const { L, A } = atmosphere(scene, time, { ...T, focus: [0, 1, -1.5], box: 8.5 });
    // dunes around a flat camp; one dune crest far behind for "verte"; a pool among the palms
    const ridge = u => Math.pow(1 - Math.abs(Math.sin(u)), 1.7); const pond = [5.2, -10.4];
    const campR = (x, z) => Math.hypot(x * .85, z + 1.5);
    const height = (x, z) => {
      const r = campR(x, z), camp = smooth((r - 7) / 9);
      let h = camp * (2.1 * ridge(.12 * x + .05 * z + .8 * Math.sin(.045 * z)) * (.7 + .3 * Math.sin(.04 * x + 1)) + 1.0 * ridge(.2 * z - .08 * x + 2.2));
      h += smooth((r - 28) / 70) * 10 * (.6 + .4 * Math.sin(.02 * x + .03 * z + 1));
      h += 2.3 * Math.exp(-(((z + 14.5) / 3.2) ** 2)) * Math.exp(-(((x + 1.2) / 8) ** 2));
      h += .05 * Math.sin(x * .9 + z * .4);
      const dp = Math.hypot(x - pond[0], (z - pond[1]) * 1.3); return lerp(h, -.12, smooth((3.2 - dp) / 1.6));
    };
    const ground = terrain({ R: 260, n: faceted() ? 64 : 110, core: .85, height, seed, jitter: .14,
      quiet: (x, z) => smooth((campR(x, z) - 6) / 4) * smooth((Math.hypot(x + 1.2, z + 14.5) - 1.2) / 2.5) * smooth((Math.hypot(x - pond[0], z - pond[1]) - 3) / 1.5),
      color: (x, z, y, slope, r) => { const dp = Math.hypot(x - pond[0], (z - pond[1]) * 1.3);
        let c = mix('#eab97a', '#cf9358', slope * 3.2); if (dp < 4.2) c = mix(c, '#9aa35a', smooth((4.2 - dp) / 1.2) * .8); return shadeHex(c, .94 + r * .12); } });
    scene.add(ground); const gy = (x, z) => ground.userData.heightAt(x, z);
    const water = mesh(G.cyl(2.45, 2.45, .04, 14), mat('#4f9fb5', { rough: .3 }), { cast: false }); water.scale.z = 1 / 1.3; water.position.set(pond[0], -.05, pond[1]); scene.add(water);
    // tents, palms, camels
    const tent = P.tent({}); tent.position.set(-2.4, gy(-2.4, -3.3), -3.3); scene.add(tent);
    const tent2 = P.tent({ w: 3.4, d: 2.6, h: 1.8, c: '#4a3b31', c2: '#6b5847', rug: '#3f6e8f' }); tent2.position.set(3.4, gy(3.4, -5.4), -5.4); tent2.rotation.y = -.55; scene.add(tent2);
    const palms = [[3.9, -3.4, 4.8, 1, true], [-4.9, -.9, 4.3, 2, true], [6.2, -8.8, 5.3, 3], [4.0, -9.9, 4.5, 4], [6.9, -11.4, 4.2, 5], [-6.6, -8.4, 4.9, 6], [-9, -13, 5.2, 7]]
      .map(([x, z, h, s, sway]) => { const p = P.palm({ h, seed: s, dir: s * 1.3, sway: !!sway }); p.position.set(x, gy(x, z), z); scene.add(p); return p; });
    const camels = [[3.0, -1.95, -1.1, true, '#b5452f'], [-5.4, -3.8, .9, false, '#3f6e8f'], [5.6, -7.2, -2.6, true, '#7d3f5c']].map(([x, z, yaw, seated, blanket], i) => {
      const c = P.camel({ seated, seed: i + 1, blanket }); c.group.position.set(x, gy(x, z), z); c.group.rotation.y = yaw; scene.add(c.group); return c; });
    // campfire with seat logs
    const fire = P.campfire({ seed: 2 }); fire.group.position.set(1.0, gy(1, 2.3), 2.3); scene.add(fire.group);
    const logM = mat('#7a5634', { rough: .9 });
    scene.add(at(rot(mesh(G.cyl(.2, .2, 1.3, 7), logM), 0, .2, Math.PI / 2), -.2, .2, 1.72));
    scene.add(at(rot(mesh(G.cyl(.19, .19, 1.1, 7), logM), 0, .35, Math.PI / 2), 1.0, .19, 3.4));
    for (let i = 0; i < 4; i++) scene.add(at(rot(mesh(G.cyl(.07, .07, .9, 6), logM), 0, i * .5, Math.PI / 2), -.4 + i * .05, .07 + (i > 1 ? .12 : 0), -2.2 + i * .05));
    // camp dressing: rug, pots, lantern pole, shrubs, rocks
    scene.add(at(mesh(G.box(2.0, .02, 1.1), mat('#a8432f'), { cast: false }), -2.3, .03, -1.15));
    scene.add(at(mesh(G.box(1.7, .025, .8), mat('#e3b341'), { cast: false }), -2.3, .035, -1.15));
    for (const [x, z, s, a] of [[-3.7, -1.6, 1, true], [-3.35, -1.4, .8, false], [-.55, -1.95, 1.1, true]]) scene.add(at(P.pot({ c: '#b9714a', s, amphora: a }), x, gy(x, z), z));
    scene.add(at(P.sack({ c: '#d8c39a' }), -.6, 0, -1.4));
    const pole = mat('#6e5136'); scene.add(at(mesh(G.cyl(.04, .04, 2.1, 6), pole), -.1, 1.05, -1.75)); scene.add(at(mesh(G.cyl(.025, .025, .45, 5), pole), -.1, 2.0, -1.55).rotateX(Math.PI / 2));
    const lan = P.lantern({ glow: time === 'dag' ? 0 : 1 }); lan.position.set(-.1, 1.4, -1.35); scene.add(lan);
    const R = rng('desert' + seed);
    for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, d = 6 + R() * 16; const x = Math.cos(a) * d, z = Math.sin(a) * d - 3; if (Math.hypot(x + 1.2, z + 14.5) < 2.5 || (z > 0 && Math.abs(x) < 7)) continue;
      const b = mesh(G.sphere(.3 + R() * .25, 8, 6), mat(R() < .5 ? '#8a8a4a' : '#9b8452')); b.scale.y = .6; b.position.set(x, gy(x, z) + .08, z); scene.add(b); }
    for (let i = 0; i < 8; i++) { const a = R() * Math.PI * 2, d = 5 + R() * 9; const x = Math.cos(a) * d, z = Math.sin(a) * d - 2; if (z > 0 && Math.abs(x) < 6) continue; scene.add(at(P.rock({ s: .25 + R() * .35, seed: i + 3, c: '#c49a6a' }), x, gy(x, z), z)); }
    for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2, d = 2.6 + R() * 1.2; const x = pond[0] + Math.cos(a) * d, z = pond[1] + Math.sin(a) * d / 1.3;
      const tuft = at(group(scene), x, gy(x, z), z); for (let k = 0; k < 3; k++) tuft.add(at(rot(mesh(G.cone(.06, .5 + R() * .3, 4), mat('#6f9a3a')), (R() - .5) * .5, 0, (R() - .5) * .5), (R() - .5) * .2, .25, (R() - .5) * .2)); }
    // far away: mesas and mountains, clouds, night sky
    mountains(scene, { n: 9, seed, color: '#c78d6c', az: [-3.1, -.05], dist: [190, 260], h: [22, 40], mesa: true });
    const sky2 = group(scene);
    if (night) { stars(sky2, { seed }); moon(sky2, [90, 130, -230]); }
    else clouds(sky2, { n: eve ? 5 : 3, seed, color: eve ? '#f6b98e' : '#ffffff', h: [45, 80], size: .8 });
    // light: the fire at dusk and at night
    const fl = night || eve ? new THREE.PointLight('#ff9c4a', night ? 7 : 3.5, 14, 1.3) : null; if (fl) { fl.position.set(1.0, .75, 2.3); scene.add(fl); }
    finish(scene);
    const world = {
      scene, wide: { pos: [1.8, 2.6, 11], target: [-.4, 1.3, -1.5] }, bounds: { x: [-12, 12], z: [-19, 16], y: [.4, 10] },
      groundY: (x, z) => gy(x, z),
      update(t) {
        fire.update(t, night ? 1 : eve ? .9 : .6); if (fl) fl.intensity = (night ? 7 : 3.5) * fire.flicker(t);
        camels.forEach(c => c.update(t)); palms.forEach(p => P.swayPalm(p, t)); sky2.rotation.y = t * .002;
      },
    };
    world.camera = wideCamera(def, () => world.groundY, [
      { when: s => !(s.actors || []).length, pos: [1.8, 2.7, 11.5], target: [-.4, 1.6, -2], fov: 46 },
      { pos: [1.8, 2.6, 11], target: [-.4, 1.3, -1.5], fov: 46, minD: 8, maxD: 34, lift: .45 },
    ]);
    return world;
  },
});

/* =====================================================================================================
   stad: looking from a small square down a street to the city gate (two towers in the wall), flat-roofed
   houses on both sides, outside stairs up to a roof, a market stall, a well and palms.
   ===================================================================================================== */
const STAIRS = { x0: .95, x1: 1.95, z0: -3.5, run: .3, rise: .375, n: 8 };
const TOWER = { x0: 1.3, x1: 3.7, z0: -11.5, z1: -8.8, h: 5.6 };
const ZONES = {   // camera bounds by where the shot's people are (houses line the street)
  plein: { x: [-3.2, 3.2], z: [-3, 16], y: [.4, 9] },
  straat: { x: [-1.7, .85], z: [-13, 16], y: [.4, 9] },
  muur: { x: [-1.5, 6.5], z: [-17, -3], y: [5.2, 11] },
};
const SPOT_ZONE = { poort: 'straat', straat: 'straat', trap: 'straat', muur: 'muur', plein: 'plein', markt: 'plein' };
defineSet('stad', {
  spots: {
    poort: { p: [0, -10.2], yaw: 0 },
    plein: { p: [-.4, -.5], yaw: .1 },
    markt: { p: [1.5, 1.55], yaw: -.7 },
    straat: { p: [-.5, -5.4], yaw: .1 },
    muur: { p: [2.5, -10.15], yaw: -.2 },
    trap: { p: [1.45, -4.55], yaw: -.6 },
  },
  build({ time = 'dag' } = {}) {
    const seed = 'stad';
    const def = this; const scene = new THREE.Scene(); const night = time === 'nacht', eve = time === 'avond';
    const T = { dag: { keyDir: [5, 9, 2.5] }, avond: { keyDir: [-7, 3.6, 3.5], fillI: 1.0 }, nacht: { keyI: 1.25, fillI: 1.05 } }[time] || {};
    const { L } = atmosphere(scene, time, { ...T, focus: [0, 1, -3.5], box: 9.5 });
    // ground: paving inside the walls, fields and hills outside
    const height = (x, z) => { if (z > -11.6) return 0; const r = Math.hypot(x, z + 2);
      return smooth((-z - 13) / 25) * (2.5 + 2 * Math.sin(.07 * x + .5)) + smooth((r - 60) / 90) * 16 * (.6 + .4 * Math.sin(.03 * x + 1)); };
    const paving = ['#d9c6a3', '#d1bc97', '#dfcdab', '#cdb792'];
    const ground = terrain({ R: 240, n: faceted() ? 64 : 100, core: .8, height, seed, jitter: .2, quiet: (x, z) => smooth((-z - 13) / 3),
      color: (x, z, y, slope, r) => z > -11.5 ? shadeHex(paving[Math.floor(r * 4)], .97 + r * .06) : shadeHex(mix('#c4a46c', '#a3a05c', .5 + .5 * Math.sin(x * .2 + z * .13)), .92 + r * .14) });
    scene.add(ground);
    // the wall with the gate and two towers
    const stone = mat('#cdb48c', { rough: .95 }), stone2 = mat('#c2a77f', { rough: .95 }), base = mat('#a89070', { rough: .95 }), dark = mat('#2b221c');
    for (const s of [-1, 1]) {
      const x0 = TOWER.x1, x1 = 22; scene.add(at(mesh(G.box(x1 - x0, 4.2, 1.5), stone), s * (x0 + x1) / 2, 2.1, -10.25));
      scene.add(at(mesh(G.box(x1 - x0, .5, 1.56), base), s * (x0 + x1) / 2, .25, -10.25));
      for (let x = x0 + .4; x < x1; x += 1.1) scene.add(at(mesh(G.box(.6, .55, .4), stone), s * x, 4.47, -10.8));
      const tx = s * (TOWER.x0 + TOWER.x1) / 2, tz = (TOWER.z0 + TOWER.z1) / 2, tw = TOWER.x1 - TOWER.x0, td = TOWER.z1 - TOWER.z0;
      scene.add(at(mesh(G.box(tw, TOWER.h, td), stone2), tx, TOWER.h / 2, tz)); scene.add(at(mesh(G.box(tw + .06, .6, td + .06), base), tx, .3, tz));
      scene.add(at(mesh(G.box(tw + .2, .16, td + .2), stone), tx, TOWER.h - .05, tz));
      for (let i = 0; i < 4; i++) for (const [dx, dz, w, d] of [[-tw / 2 + .25 + i * (tw - .5) / 3, -td / 2 + .1, .45, .25], [-tw / 2 + .25 + i * (tw - .5) / 3, td / 2 - .1, .45, .25], [-tw / 2 + .1, -td / 2 + .3 + i * (td - .6) / 3, .25, .45], [tw / 2 - .1, -td / 2 + .3 + i * (td - .6) / 3, .25, .45]])
        scene.add(at(mesh(G.box(w, .5, d), stone2), tx + dx, TOWER.h + .3, tz + dz));
      scene.add(at(mesh(G.box(.22, .7, .1), dark, { cast: false }), tx, 3.7, TOWER.z1 + .02));
      // open gate door
      const door = at(mesh(G.box(.1, 3.0, 1.25), mat('#6b4a32')), s * 1.22, 1.5, -9.5 + .65); scene.add(door);
      for (const y of [.6, 2.4]) scene.add(at(mesh(G.box(.13, .1, 1.2), mat('#3d3029')), s * 1.22, y, -9.5 + .65));
    }
    scene.add(at(mesh(G.box(2.6, .9, 1.5), stone), 0, 3.75, -10.25));
    const sp = new THREE.Shape(); sp.moveTo(-1.3, 3.3); sp.lineTo(1.3, 3.3); sp.lineTo(1.3, 2.1); sp.absarc(0, 2.1, 1.3, 0, Math.PI, false); sp.lineTo(-1.3, 3.3);
    const arch = new THREE.ExtrudeGeometry(sp, { depth: 1.5, bevelEnabled: false, curveSegments: segs(18, 6) }); arch.translate(0, 0, -11); scene.add(mesh(arch, stone));
    scene.add(at(mesh(G.torus(1.36, .13, Math.PI, 4, 14), stone2), 0, 2.1, -9.45));
    for (let x = -1.0; x <= 1.01; x += 1.0) scene.add(at(mesh(G.box(.6, .55, .4), stone), x, 4.47, -10.8));
    // houses (fronts face the street)
    const lit = night ? 1.2 : eve ? .5 : 0;
    const houses = [
      { at: [-5.4, 0], rot: Math.PI / 2, w: 5, d: 4, h: 3.2, c: '#e8d7b6', door: '#4f7f9a', seed: 1 },
      { at: [-4.0, -4.45], rot: Math.PI / 2, w: 3.7, d: 4.2, h: 3.6, c: '#d8b78a', door: '#7a9a5a', seed: 2 },
      { at: [-3.8, -7.95], rot: Math.PI / 2, w: 2.8, d: 3.8, h: 4.2, c: '#cfa878', door: '#9a5a4a', seed: 3, upper: true },
      { at: [5.4, .2], rot: -Math.PI / 2, w: 5, d: 4, h: 3.0, c: '#dcc29a', door: '#5f8aa0', seed: 4 },
      { at: [4.0, -4.4], rot: -Math.PI / 2, w: 3.3, d: 4.2, h: 3.0, c: '#ead9bc', door: '#4f7f9a', seed: 5 },
      { at: [3.8, -7.9], rot: -Math.PI / 2, w: 2.9, d: 3.8, h: 4.0, c: '#d2b083', door: '#7a9a5a', seed: 6 },
      { at: [-9.5, -3], rot: Math.PI / 2, w: 6, d: 4, h: 5.5, c: '#d9c19a', seed: 7 }, { at: [9.5, -3.5], rot: -Math.PI / 2, w: 6, d: 4, h: 5.0, c: '#e2cfae', seed: 8 },
      { at: [-7.5, -8.5], rot: Math.PI / 2, w: 3.5, d: 3.5, h: 6.0, c: '#cdb08a', seed: 9 }, { at: [7.6, -8.2], rot: -Math.PI / 2, w: 3.5, d: 3.5, h: 6.2, c: '#d6bd94', seed: 10 },
    ];
    for (const o of houses) { const hh = P.house({ ...o, lit }); hh.position.set(o.at[0], 0, o.at[1]); hh.rotation.y = o.rot; scene.add(hh); }
    const st = P.stairs({ n: STAIRS.n, h: STAIRS.n * STAIRS.rise, run: STAIRS.run, width: STAIRS.x1 - STAIRS.x0, c: '#dcc59e' }); st.group.position.set((STAIRS.x0 + STAIRS.x1) / 2, 0, STAIRS.z0); st.group.rotation.y = Math.PI; scene.add(st.group);
    // square: well, palm, market stall, laundry over the street, pots
    scene.add(at(P.well({}), -2.15, 0, -1.4));
    const palm = P.palm({ h: 5.2, seed: 11, dir: 2.4, lean: .18, sway: true }); palm.position.set(-2.75, 0, -2.4); scene.add(palm);
    const outside = [[3.9, -15.5, 6.5], [-5.2, -17, 6.0], [8.2, -16, 5.5], [-1.6, -21, 6.2]].map(([x, z, h], i) => { const p = P.palm({ h, seed: 20 + i, dir: i * 2 }); p.position.set(x, height(x, z), z); scene.add(p); return p; });
    const stall = P.stall({}); stall.position.set(2.6, 0, 1.4); stall.rotation.y = -1.0; scene.add(stall);
    const rope = mat('#c2a77c'); scene.add(P.beam(V(-1.9, 3.25, -5.0), V(1.9, 3.25, -5.2), .012, rope, 4));
    [['#c0533b', -1.2], ['#3f6e8f', -.4], ['#e3b341', .5], ['#f1e4c8', 1.2]].forEach(([c, x]) => scene.add(at(mesh(G.box(.5, .7, .02), mat(c, { side: THREE.DoubleSide })), x, 2.88, -5.08 - x * .05)));
    for (const [x, z, s, a, c] of [[-3.0, .9, 1, true, '#b9714a'], [-3.05, 1.4, .8, false, '#a35f3d'], [2.9, -2.4, 1.1, true, '#c47b52'], [-1.65, -6.9, .9, false, '#b9714a'], [1.55, -6.6, 1, true, '#a35f3d']])
      scene.add(at(P.pot({ c, s, amphora: a }), x, 0, z));
    scene.add(at(mesh(G.box(.4, .45, 2.2), mat('#a87b52')), -3.15, .225, -.2));
    mountains(scene, { n: 8, seed, color: '#a7a99a', az: [-2.7, -.45], dist: [170, 240], h: [20, 45] });
    const sky2 = group(scene);
    if (night) { stars(sky2, { seed }); moon(sky2, [-80, 140, -220]); } else clouds(sky2, { n: 5, seed, color: eve ? '#f4b48c' : '#ffffff', az: [-2.4, -.7] });
    // torches at the gate (dusk, night) + one lamp by the stall
    if (night || eve) for (const s of [-1, 1]) { scene.add(at(mesh(G.cyl(.05, .04, .5, 5), mat('#4a3a2e')), s * 1.55, 2.55, -8.75)); scene.add(at(mesh(G.cone(.09, .3, 5), basic('#ffb347')), s * 1.55, 2.95, -8.75)); }
    const fl = night || eve ? new THREE.PointLight('#ffb15c', night ? 5 : 2.5, 11, 1.4) : null;
    if (fl) { fl.position.set(1.7, 2.2, 1.55); scene.add(fl); scene.add(at(P.lantern({ glow: 1 }), 1.7, 1.95, 1.55)); }
    finish(scene);
    const flick = wobble('stadlamp');
    const world = {
      scene, wide: { pos: [1.3, 3.8, 11.5], target: [0, 2.3, -4] }, bounds: ZONES.plein,
      groundY(x, z) {
        if (x > STAIRS.x0 && x < STAIRS.x1 && z < STAIRS.z0 && z > STAIRS.z0 - STAIRS.n * STAIRS.run) return (Math.floor((STAIRS.z0 - z) / STAIRS.run) + 1) * STAIRS.rise;
        if (x > TOWER.x0 && x < TOWER.x1 && z > TOWER.z0 && z < TOWER.z1) return TOWER.h;
        return ground.userData.heightAt(x, z);
      },
      update(t, shot) {
        const zones = [...new Set((shot ? spotsOf(shot) : []).map(s => SPOT_ZONE[s]).filter(Boolean))];
        world.bounds = zones.length ? { x: [Math.min(...zones.map(z => ZONES[z].x[0])), Math.max(...zones.map(z => ZONES[z].x[1]))], z: [Math.min(...zones.map(z => ZONES[z].z[0])), Math.max(...zones.map(z => ZONES[z].z[1]))], y: [Math.min(...zones.map(z => ZONES[z].y[0])), Math.max(...zones.map(z => ZONES[z].y[1]))] } : ZONES.plein;
        P.swayPalm(palm, t); if (fl) fl.intensity = (night ? 5 : 2.5) * (.9 + .1 * flick(t * 6)); sky2.rotation.y = t * .002;
      },
    };
    world.camera = wideCamera(def, () => world.groundY, [
      { when: s => !(s.actors || []).length, pos: [-.6, 3.4, 12], target: [.2, 2.5, -4], fov: 46 },
      { pos: [1.3, 3.8, 11.5], target: [0, 2.3, -4], fov: 46, minD: 9, maxD: 30, lift: .5 },
    ]);
    return world;
  },
});

/* =====================================================================================================
   heuvels: green rolling hills, a knoll with a path up, a stream in front, olive trees, rocks and a flock.
   ===================================================================================================== */
const STREAM = x => 4.2 + .7 * Math.sin(.3 * x + .8);
const PATH = [[2.6, 14], [1.6, 8], [.55, 4.8], [.15, .9], [-.35, -2.6], [-.55, -5.2], [-.6, -6.6], [-.3, -9], [.8, -13]];
defineSet('heuvels', {
  spots: {
    heuvel: { p: [-.6, -6.6], yaw: .1 },
    boom: { p: [2.2, -2.1], yaw: -.35, seat: .44, base: 'sit' },
    pad: { p: [.15, .9], yaw: .1 },
    kudde: { p: [-1.7, -1.3], yaw: .35 },
    rots: { p: [-2.0, 2.1], yaw: .5, seat: .44, base: 'sit' },
    beek: { p: [1.25, 3.7], yaw: .2 },
  },
  build({ time = 'dag' } = {}) {
    const seed = 'heuvels';
    const def = this; const scene = new THREE.Scene(); const night = time === 'nacht', eve = time === 'avond';
    const T = { dag: { horizon: '#dcecef', fog: '#d6e7ea', keyDir: [5, 9, 2.5], fillGround: '#6f8a4a' }, avond: { keyDir: [-7, 3.2, 3.5], fillGround: '#6a5a3a', fillI: 1.0 }, nacht: { fillGround: '#1c2420', keyI: 1.2 } }[time] || {};
    const { L } = atmosphere(scene, time, { ...T, focus: [0, 1, -2], box: 9 });
    const height = (x, z) => {
      let h = .35 * Math.sin(.21 * x + .4) * Math.cos(.17 * z - .3) + .25 * Math.sin(.13 * z + .09 * x + 1.1);
      h += 1.7 * Math.exp(-(((x + .6) ** 2 + (z + 6.6) ** 2) / (2 * 2.8 * 2.8))) + .06 * Math.max(0, -z - 2);
      const r = Math.hypot(x, z + 2); h += smooth((r - 16) / 45) * (7 + 5 * Math.sin(.05 * x + 1) * Math.cos(.04 * z));
      return h - .5 * Math.exp(-(((z - STREAM(x)) / .9) ** 2));
    };
    const greens = ['#7fae4a', '#6fa043', '#8dba54', '#78a647'];
    const ground = terrain({ R: 240, n: faceted() ? 64 : 110, core: .8, height, seed, jitter: .12,
      quiet: (x, z) => Math.min(smooth((distLine(PATH, x, z) - .4) / 1.5), smooth((Math.abs(z - STREAM(x)) - 1.2) / 1), Math.min(...Object.values(def.spots).map(s => smooth((Math.hypot(x - s.p[0], z - s.p[1]) - .6) / 1.2)))),
      color: (x, z, y, slope, r) => {
        const ds = Math.abs(z - STREAM(x)), dp = distLine(PATH, x, z); const far = smooth((Math.hypot(x, z + 2) - 20) / 60);
        let c = mix(greens[Math.floor(r * 4)], '#a9b866', far * .7); c = mix(c, '#5f8c3c', slope * 2.2);
        if (ds < 1.0) c = mix(c, '#7b7350', smooth((1.0 - ds) / .4)); if (dp < .55) c = mix(c, '#d2b886', .85);
        return shadeHex(c, .94 + r * .12); } });
    scene.add(ground); const gy = (x, z) => ground.userData.heightAt(x, z);
    // the stream: a ribbon just under the banks, rippling
    const nx = faceted() ? 90 : 180, X0 = -70, X1 = 70; const wpos = new Float32Array((nx + 1) * 3 * 3); const wbase = [];
    for (let i = 0; i <= nx; i++) { const x = X0 + (X1 - X0) * i / nx, zc = STREAM(x), y = gy(x, zc) + .17; for (const k of [-.68, 0, .68]) wbase.push([x, y, zc + k, k === 0]); }
    const widx = []; for (let i = 0; i < nx; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 1, c = a + 3, d = c + 1; widx.push(a, b, c, b, d, c); }
    const wgeo = new THREE.BufferGeometry(); wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3)); wgeo.setIndex(widx);
    const stream = dyn(mesh(wgeo, mat('#5aa7c9', { rough: .3 }), { cast: false })); stream.frustumCulled = false; scene.add(stream);
    const updateStream = t => { wbase.forEach(([x, y, z, mid], i) => wpos.set([x, y + (mid ? .03 * Math.sin(t * 2.2 - x * 1.7) + .015 * Math.sin(t * 3.1 + x * 3.3) : 0), z], i * 3)); wgeo.attributes.position.needsUpdate = true; wgeo.computeVertexNormals(); };
    for (const [x, dz] of [[.42, -.42], [.55, 0], [.68, .42]]) { const z = STREAM(x) + dz; scene.add(at(P.rock({ s: .22, seed: 4, c: '#9c958a', sy: .5 }), x, gy(x, STREAM(x)) + .07, z)); }
    // olive trees, rocks (two to sit on), grass and flowers
    const olives = [[2.45, -2.85, 1.15, 3], [-5.6, -4.6, 1.0, 4], [5.2, -7.8, 1.1, 5], [-7.4, 1.8, .95, 6], [6.6, .9, .9, 7], [-3.6, -10.5, 1.0, 8], [3.6, -12, .9, 9], [-11, -6, 1.1, 10], [10, -4, 1.0, 11]];
    for (const [x, z, s, sd] of olives) { const o = P.olive({ s, seed: sd }); o.position.set(x, gy(x, z) - .05, z); o.rotation.y = sd; scene.add(o); }
    const stoneM = mat('#a39a8c', { rough: .95 });
    const seat = (x, z, sx, sy, sz, sd) => { const m = mesh(P.rockGeo(sd, 1), stoneM); m.scale.set(sx, sy, sz); m.position.set(x, gy(x, z) + .07, z); m.rotation.y = sd; scene.add(m); };
    seat(-2.05, 1.9, .55, .32, .5, 3); seat(2.24, -2.3, .4, .32, .36, 5);
    const R = rng('hills' + seed);
    for (const [x, z, s] of [[-1.6, -7.8, .6], [.5, -7.6, .45], [-2.6, -5.9, .35], [3.4, 2.4, .5], [-3.8, 3.4, .4], [4.6, -3.6, .7], [-4.6, -2.2, .45], [2.8, 6.5, .6], [-1.6, 6.8, .5]])
      scene.add(at(P.rock({ s, seed: Math.floor(R() * 7), c: R() < .5 ? '#a39a8c' : '#b3aa9b' }), x, gy(x, z), z));
    const flowerC = ['#f4f1e8', '#f2c94c', '#e07a8a', '#9b7fd1'];
    for (let i = 0; i < 70; i++) { const x = (R() - .5) * 22, z = (R() - .5) * 22 - 2; if (distLine(PATH, x, z) < .7 || Math.abs(z - STREAM(x)) < 1 || Object.values(def.spots).some(s => Math.hypot(x - s.p[0], z - s.p[1]) < .7)) continue;
      const y = gy(x, z); if (i % 2) { const tuft = at(group(scene), x, y, z); for (let k = 0; k < 3; k++) tuft.add(at(rot(mesh(G.cone(.05, .32 + R() * .2, 4), mat(R() < .5 ? '#5f9a3a' : '#6fa843')), (R() - .5) * .6, 0, (R() - .5) * .6), (R() - .5) * .15, .15, (R() - .5) * .15)); }
      else scene.add(at(mesh(G.sphere(.05, 6, 4), mat(flowerC[i % 4]), { cast: false }), x, y + .1, z)); }
    // the flock
    const sheepAt = [[-2.8, -.6, .4], [-.9, -2.2, 2.5], [-2.5, -2.6, -.8], [-1.1, -.3, 1.2], [-3.6, -1.9, .2], [-.2, -3.4, 3.0], [-3.1, .8, -1.4], [-4.4, -.2, .9], [-1.8, -3.9, -2.2], [-4.0, -3.4, 1.8], [.9, -4.6, -1.0], [-2.9, -5.0, .5]];
    const fk = P.flock(sheepAt.map(([x, z, yaw], i) => ({ x, z, yaw, y: gy(x, z), s: .9 + (i % 3) * .07, graze: i % 4 === 1 ? .3 : 1 })), { seed: 1 }); scene.add(fk.group);
    // far away: hills, a little town on a hill
    mountains(scene, { n: 9, seed, color: '#8fa38a', az: [-3.0, -.15], dist: [170, 250], h: [22, 50] });
    const town = at(group(scene), -38, gy(-38, -62) - .4, -62); const Rt = rng('town');
    for (let i = 0; i < 9; i++) town.add(at(mesh(G.box(1.6 + Rt() * 1.5, 1.4 + Rt() * 1.6, 1.6 + Rt() * 1.4), mat(Rt() < .5 ? '#e9dcc3' : '#d8c3a0'), { cast: false }), (Rt() - .5) * 9, .7, (Rt() - .5) * 5));
    const sky2 = group(scene);
    if (night) { stars(sky2, { seed }); moon(sky2, [-100, 130, -210]); } else clouds(sky2, { n: 6, seed, color: eve ? '#f6b98e' : '#ffffff', az: [-2.6, -.5] });
    // the shepherds' fire at night
    let fire = null, fl = null;
    if (night) { fire = P.campfire({ seed: 5, s: .8 }); fire.group.position.set(-1.1, gy(-1.1, 3.05), 3.05); scene.add(fire.group); fl = new THREE.PointLight('#ff9c4a', 6, 12, 1.3); fl.position.set(-1.1, gy(-1.1, 3.05) + .7, 3.05); scene.add(fl); }
    finish(scene);
    const world = {
      scene, wide: { pos: [2.0, 3.1, 12.5], target: [-.4, 1.1, -2.5] }, bounds: { x: [-11, 11], z: [-15, 16], y: [.4, 10] },
      groundY: (x, z) => gy(x, z),
      update(t) { fk.update(t); updateStream(t); sky2.rotation.y = t * .002; if (fire) { fire.update(t, 1); fl.intensity = 6 * fire.flicker(t); } },
    };
    world.camera = wideCamera(def, () => world.groundY, [
      { when: s => !(s.actors || []).length, pos: [2.0, 3.3, 12.5], target: [-.4, 1.6, -3], fov: 46 },
      { pos: [2.0, 3.1, 12.5], target: [-.4, 1.1, -2.5], fov: 46, minD: 8.5, maxD: 30, lift: .45 },
    ]);
    return world;
  },
});
