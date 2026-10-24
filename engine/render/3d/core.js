// Shared 3D plumbing for the animated reels (templates/scene3d.js): one WebGL renderer, seeded
// randomness, easing, materials, sky and light rigs.
// Rule for everything in engine/render/3d: the picture is a pure function of time. update(t) sets every
// transform from t (no state carried between frames), so frames can be rendered in any order.
// Speed matters: headless Chromium renders WebGL in software (SwiftShader). No environment maps, no
// post-processing, one shadow-casting light per set, modest polygon counts.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, RoundedBoxGeometry };

export const W = 1080, H = 1920;

let renderer = null;
/** The one renderer (canvas appended to `parent` the first time). */
export const SCALE = .8;   // drawing buffer at 80% (864x1536), shown at 1080x1920: a third fewer pixels to shade
export function getRenderer(parent) {
  if (renderer) return renderer;
  const o = globalThis.__3dopts || {};   // experiments only (render.mjs --stills with PERF3D)
  renderer = new THREE.WebGLRenderer({ antialias: o.aa ?? true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(o.scale ?? SCALE);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = o.shadows ?? true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const c = renderer.domElement; c.style.position = 'absolute'; c.style.left = '0'; c.style.top = '0';
  parent.appendChild(c);
  return renderer;
}

/* ---------- maths ---------- */
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const inout = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const out = x => 1 - Math.pow(1 - clamp(x), 3);
/** Deterministic random generator from a string or number seed (mulberry32). */
export function rng(seed) {
  let h = typeof seed === 'number' ? seed >>> 0 : [...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
  return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Smooth 1D noise in [-1, 1] (sum of sines with seeded phases), pure function of x. */
export function wobble(seed) {
  const r = rng(seed); const f = [0, 1, 2].map(i => ({ a: .55 / (i + 1), w: (0.7 + r() * .6) * (i + 1) * 1.7, p: r() * 6.28 }));
  return x => f.reduce((n, o) => n + o.a * Math.sin(x * o.w + o.p), 0);
}
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ---------- styles: one world, several looks (spec.style3d, an experiment trait) ----------
   lowpoly  faceted triangles, flat shading, few segments (default)
   rond     smooth, rounded toy look
   toon     cel-shaded cartoon: 3 light steps + dark outlines on the characters
   blok     blocky (everything boxes, like building blocks)
   klei     claymation: smooth shapes with a hand-made clay grain
   silhouet shadow play: everything a dark silhouette against a glowing dusk sky, depth from haze;
            fires, lamps and windows still glow (silhouette() in templates/scene3d.js does the pass)
   papier   storybook: paper-textured cartoon shading, soft outlines on the people
   Set once per reel before anything is built (templates/scene3d.js). G.* and mat() follow it, so sets
   and props built with them get every look. Custom geometry: use segs() and flatShading: faceted(). */
export const STYLES3D = ['lowpoly', 'rond', 'toon', 'blok', 'klei', 'silhouet', 'papier'];
export const STYLE = { name: 'lowpoly' };
export const setStyle = name => { STYLE.name = STYLES3D.includes(name) ? name : 'lowpoly'; };
export const lowpoly = () => STYLE.name === 'lowpoly';
export const blocky = () => STYLE.name === 'blok';
/** Flat-shaded facets in this style? */
export const faceted = () => STYLE.name === 'lowpoly' || STYLE.name === 'blok';
/** Segment count for the current style (low poly / blok: about a third, at least `min`). */
export const segs = (n, min = 5) => faceted() ? Math.max(min, Math.round(n / 3)) : n;

let ramp = null, grain = null, softRamp = null, paper = null;
const paperGrain = () => paper ||= (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = rng(23);
  g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(${150 + r() * 60},${140 + r() * 60},${120 + r() * 60},${.08 + r() * .14})`; g.lineWidth = .5 + r(); g.beginPath(); const x = r() * 256, y = r() * 256, a = r() * 6.28, l = 3 + r() * 14; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 1800; i++) { const v = 220 + Math.floor(r() * 35); g.fillStyle = `rgba(${v},${v - 4},${v - 10},.35)`; g.fillRect(r() * 256, r() * 256, 1.4, 1.4); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const paperRamp = () => softRamp ||= (() => { const d = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
/** The silhouette look's sky and haze. */
export const DUSK = { top: '#1d1640', horizon: '#ff9a52', bottom: '#ffcf8a', fog: '#f39a63' };
export const silhouette = () => STYLE.name === 'silhouet';
const toonRamp = () => ramp ||= (() => { const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const clayGrain = () => grain ||= (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = rng(11);
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = 205 + Math.floor(r() * 50); g.fillStyle = `rgba(${v},${v},${v},${.25 + r() * .35})`; g.beginPath(); g.ellipse(r() * 256, r() * 256, 1 + r() * 4, .6 + r() * 2.2, r() * 3.14, 0, 6.28); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

/* ---------- materials (cached per style + colour) ---------- */
const mats = new Map();
/** The style's surface: opts rough, metal, emissive + glow, side, flat, transparent, opacity. */
export function mat(color, o = {}) {
  const key = STYLE.name + color + JSON.stringify(o);
  if (mats.has(key)) return mats.get(key);
  const common = { color, emissive: o.emissive || '#000000', emissiveIntensity: o.glow ?? 1, side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 };
  let m;
  // Lambert (diffuse only) where a look is matte anyway: about a quarter faster in software WebGL.
  if (STYLE.name === 'toon') m = new THREE.MeshToonMaterial({ ...common, gradientMap: toonRamp() });
  else if (STYLE.name === 'papier') m = new THREE.MeshToonMaterial({ ...common, gradientMap: paperRamp(), map: o.metal ? null : paperGrain() });
  else if (STYLE.name === 'silhouet') m = o.emissive && o.emissive !== '#000000' ? new THREE.MeshBasicMaterial({ color: o.emissive, side: common.side, transparent: common.transparent, opacity: common.opacity })
    : new THREE.MeshBasicMaterial({ color: '#16101a', side: common.side, transparent: common.transparent, opacity: common.opacity });
  else if (STYLE.name === 'klei') m = new THREE.MeshLambertMaterial({ ...common, map: o.metal ? null : clayGrain(), flatShading: !!o.flat });
  else if (faceted() && !o.metal) m = new THREE.MeshLambertMaterial({ ...common, flatShading: o.flat ?? true });
  else m = new THREE.MeshStandardMaterial({ ...common, roughness: o.rough ?? (faceted() ? .9 : .78), metalness: o.metal ?? 0, flatShading: o.flat ?? faceted() });
  mats.set(key, m); return m;
}
/** Dark outlines (toon): a back-face shell pushed out along the normals. Add to a mesh with outline(mesh). */
let outlineMat = null;
export function outline(m, px = .012) {
  outlineMat ||= (() => { const om = new THREE.MeshBasicMaterial({ color: '#1b1410', side: THREE.BackSide });
    om.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * ' + px.toFixed(4) + ';'); }; return om; })();
  const o = new THREE.Mesh(m.geometry, outlineMat); o.castShadow = false; o.receiveShadow = false; o.userData.outline = true; m.add(o); return o;
}
export const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, fog: o.fog ?? true, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true });

/** A mesh that casts and receives shadows. */
export function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; return m;
}
export const at = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); return o; };
export const rot = (o, x = 0, y = 0, z = 0) => { o.rotation.set(x, y, z); return o; };
export const scl = (o, x = 1, y = x, z = x) => { o.scale.set(x, y, z); return o; };
export function group(parent, ...children) { const g = new THREE.Group(); children.forEach(c => c && g.add(c)); if (parent) parent.add(g); return g; }

/* ---------- geometry helpers (cached) ---------- */
const geos = new Map();
const cached = (key, make) => { key = STYLE.name + key; if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);   // blok style: everything is a block
export const G = {
  sphere: (r, w = 32, h = 22) => cached(`s${r},${w},${h}`, () => blocky() ? B(r * 1.7, r * 1.7, r * 1.7) : lowpoly() ? new THREE.IcosahedronGeometry(r, r > .035 ? 1 : 0) : new THREE.SphereGeometry(r, w, h)),
  capsule: (r, len, cap = 8, radial = 20) => cached(`c${r},${len},${cap},${radial}`, () => blocky() ? B(r * 1.8, len + r * 1.8, r * 1.8) : new THREE.CapsuleGeometry(r, len, lowpoly() ? 2 : cap, segs(radial, 6))),
  box: (w, h, d, r = 0) => cached(`b${w},${h},${d},${r}`, () => r && !faceted() ? new RoundedBoxGeometry(w, h, d, 3, r) : B(w, h, d)),
  cyl: (rt, rb, h, seg = 24, open = false) => cached(`y${rt},${rb},${h},${seg},${open}`, () => blocky() && !open ? B(Math.max(rt, rb) * 1.8, h, Math.max(rt, rb) * 1.8) : new THREE.CylinderGeometry(rt, rb, h, blocky() ? 4 : segs(seg, 6), 1, open)),
  cone: (r, h, seg = 20) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, blocky() ? 4 : segs(seg, 5))),
  torus: (r, tube, arc = Math.PI * 2, rs = 12, ts = 32) => cached(`t${r},${tube},${arc},${rs},${ts}`, () => new THREE.TorusGeometry(r, tube, blocky() ? 4 : segs(rs, 4), blocky() ? 8 : segs(ts, 8), arc)),
  plane: (w, h, sx = 1, sy = 1) => cached(`p${w},${h},${sx},${sy}`, () => new THREE.PlaneGeometry(w, h, sx, sy)),
  /** Part of a sphere: theta from the top (0) down to thetaLen. */
  cap: (r, thetaLen, thetaStart = 0, w = 32, h = 16, phiLen = Math.PI * 2) => cached(`a${r},${thetaLen},${thetaStart},${w},${h},${phiLen}`, () => new THREE.SphereGeometry(r, blocky() ? 4 : segs(w, 8), blocky() ? 2 : segs(h, 4), phiLen < 6 ? Math.PI / 2 - phiLen / 2 : Math.PI / 4, phiLen, thetaStart, thetaLen)),
  /** Lathe from [[radius, y], ...] bottom to top. */
  lathe: (pts, seg = 28) => cached(`l${JSON.stringify(pts)},${seg}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), blocky() ? 4 : segs(seg, 7), Math.PI / 4)),
};

/* ---------- sky + lights ---------- */
/** Gradient sky dome (no fog), colours top / horizon / bottom. */
export function sky(scene, { top = '#6fa8dc', horizon = '#f4dcc0', bottom = '#e8d2b4', radius = 400, sharp = 1.6 } = {}) {
  if (silhouette()) ({ top, horizon, bottom } = DUSK);
  const g = new THREE.SphereGeometry(radius, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) }, sharp: { value: sharp } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform float sharp; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 1.0 / sharp)) : mix(horizon, bottom, pow(-h, .6));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const s = new THREE.Mesh(g, m); s.renderOrder = -10; scene.add(s); return s;
}

/**
 * Light rig: key (directional, casts the one shadow), fill (hemisphere), rim (directional, no shadow).
 * box: half-size of the shadow camera around `focus` (keep it tight: sharper shadows).
 */
export function lights(scene, { key = '#fff1dc', keyI = 2.6, keyDir = [4, 7, 5], fillSky = '#cfe3f2', fillGround = '#7d6650', fillI = .9,
  rim = '#9fd6e8', rimI = .9, rimDir = [-5, 4, -6], focus = [0, 1, 0], box = 6, mapSize = 2048, ambient = 0 } = {}) {
  const f = V(...focus);
  const sun = new THREE.DirectionalLight(key, keyI); sun.position.copy(f).add(V(...keyDir)); sun.target.position.copy(f);
  sun.castShadow = true; sun.shadow.mapSize.set(mapSize, mapSize); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  const c = sun.shadow.camera; c.left = -box; c.right = box; c.top = box; c.bottom = -box; c.near = .5; c.far = 60;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(fillSky, fillGround, fillI); scene.add(hemi);
  let rimL = null; if (rimI) { rimL = new THREE.DirectionalLight(rim, rimI); rimL.position.copy(f).add(V(...rimDir)); rimL.target.position.copy(f); scene.add(rimL, rimL.target); }
  if (ambient) scene.add(new THREE.AmbientLight('#ffffff', ambient));
  return { sun, hemi, rim: rimL };
}

/** Deterministic particles (rain, dust, stars, sparks): positions are a function of t. */
export function particles(scene, { count = 400, area = [10, 8, 10], center = [0, 4, 0], color = '#ffffff', size = .05, opacity = .7, fall = 0, drift = [0, 0, 0], seed = 1, streak = 0 } = {}) {
  const r = rng(seed); const base = Array.from({ length: count }, () => [r() - .5, r(), r() - .5, r()]);
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(count * (streak ? 6 : 3));
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const material = streak ? new THREE.LineBasicMaterial({ color, transparent: true, opacity }) : new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true, depthWrite: false });
  const obj = streak ? new THREE.LineSegments(geo, material) : new THREE.Points(geo, material); obj.frustumCulled = false; scene.add(obj);
  const [ax, ay, az] = area, [cx, cy, cz] = center;
  return { obj, update(t) {
    base.forEach(([x, y, z, p], i) => {
      let yy = ((y - (fall * t + p * 3) / ay) % 1 + 1) % 1;            // wraps from top to bottom
      const X = cx + x * ax + drift[0] * t % ax, Y = cy - ay / 2 + yy * ay, Z = cz + z * az + drift[2] * t % az;
      if (streak) { pos.set([X, Y, Z, X - drift[0] * streak * .05, Y + fall * streak * .05, Z], i * 6); } else pos.set([X, Y, Z], i * 3);
    });
    geo.attributes.position.needsUpdate = true;
  } };
}

/** Load an image URL into a texture (sRGB). */
export function texture(url) {
  return new Promise((ok, bad) => new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, () => bad(new Error('Texture failed: ' + url))));
}
/** A canvas-drawn texture (draw(ctx2d, w, h)). */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/**
 * Fewer draw calls (the main cost in software WebGL): merge every static mesh under `root` into one mesh
 * per material (+ shadow flags). Skips anything with userData.dynamic (or inside it), and `keep` objects.
 * Call at the end of a set's build(), before people are added. deep: false = only the direct children
 * (a character's joint: its own meshes, not the joints below it). Returns the number of meshes merged.
 */
export function bake(root, { keep = new Set(), deep = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(); const done = [];
  const visit = fn => deep ? root.traverse(fn) : root.children.slice().forEach(fn);
  visit(o => {
    if (!o.isMesh || keep.has(o)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic || keep.has(p)) return;
    if (Array.isArray(o.material) || o.material.isShaderMaterial || o.isInstancedMesh || o.isSkinnedMesh) return;
    const g = o.geometry; if (!g.attributes.position || !g.attributes.normal) return;
    const key = o.material.uuid + '|' + o.castShadow + '|' + o.receiveShadow + '|' + (g.index ? 'i' : 'n') + '|' + Object.keys(g.attributes).sort().join(',');
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const c = g.clone(); c.applyMatrix4(m); for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
    buckets.get(key).geos.push(c); done.push(o);
  });
  let n = 0;
  for (const b of buckets.values()) {
    if (b.geos.length < 2) { b.geos.forEach(g => g.dispose()); continue; }
    const merged = mergeGeometries(b.geos, false); if (!merged) continue;
    const m = new THREE.Mesh(merged, b.material); m.castShadow = b.cast; m.receiveShadow = b.receive; root.add(m); n += b.geos.length;
    b.geos.forEach(g => g.dispose());
    b.merged = true;
  }
  // remove the originals that went into a merged mesh
  const mergedKeys = new Set([...buckets].filter(([, b]) => b.merged).map(([k]) => k));
  for (const o of done) {
    const g = o.geometry; const key = o.material.uuid + '|' + o.castShadow + '|' + o.receiveShadow + '|' + (g.index ? 'i' : 'n') + '|' + Object.keys(g.attributes).sort().join(',');
    if (mergedKeys.has(key)) o.parent.remove(o);
  }
  return n;
}
