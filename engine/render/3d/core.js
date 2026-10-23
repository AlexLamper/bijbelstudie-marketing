// Shared 3D plumbing for the animated reels (templates/scene3d.js): one WebGL renderer, seeded
// randomness, easing, materials, sky and light rigs.
// Rule for everything in engine/render/3d: the picture is a pure function of time. update(t) sets every
// transform from t (no state carried between frames), so frames can be rendered in any order.
// Speed matters: headless Chromium renders WebGL in software (SwiftShader). No environment maps, no
// post-processing, one shadow-casting light per set, modest polygon counts.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE, RoundedBoxGeometry };

export const W = 1080, H = 1920;

let renderer = null;
/** The one renderer (canvas appended to `parent` the first time). */
export function getRenderer(parent) {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
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

/* ---------- materials (cached per colour) ---------- */
const mats = new Map();
/** Matte painted look: MeshStandardMaterial, no metal. opts: rough, emissive, side, flat, transparent, opacity. */
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? .78, metalness: o.metal ?? 0, flatShading: !!o.flat,
    emissive: o.emissive || '#000000', emissiveIntensity: o.glow ?? 1, side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 }));
  return mats.get(key);
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
const cached = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
export const G = {
  sphere: (r, w = 32, h = 22) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)),
  capsule: (r, len, cap = 8, radial = 20) => cached(`c${r},${len},${cap},${radial}`, () => new THREE.CapsuleGeometry(r, len, cap, radial)),
  box: (w, h, d, r = 0) => cached(`b${w},${h},${d},${r}`, () => r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d)),
  cyl: (rt, rb, h, seg = 24, open = false) => cached(`y${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)),
  cone: (r, h, seg = 20) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  torus: (r, tube, arc = Math.PI * 2, rs = 12, ts = 32) => cached(`t${r},${tube},${arc},${rs},${ts}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc)),
  plane: (w, h, sx = 1, sy = 1) => cached(`p${w},${h},${sx},${sy}`, () => new THREE.PlaneGeometry(w, h, sx, sy)),
  /** Part of a sphere: theta from the top (0) down to thetaLen. */
  cap: (r, thetaLen, thetaStart = 0, w = 32, h = 16) => cached(`a${r},${thetaLen},${thetaStart},${w},${h}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, thetaStart, thetaLen)),
  /** Lathe from [[radius, y], ...] bottom to top. */
  lathe: (pts, seg = 28) => cached(`l${JSON.stringify(pts)},${seg}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)),
};

/* ---------- sky + lights ---------- */
/** Gradient sky dome (no fog), colours top / horizon / bottom. */
export function sky(scene, { top = '#6fa8dc', horizon = '#f4dcc0', bottom = '#e8d2b4', radius = 400, sharp = 1.6 } = {}) {
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
