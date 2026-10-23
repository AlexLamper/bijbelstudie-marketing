// Animated characters for the 3D reels: rounded, friendly figures (big head, simple face) built from
// primitives, with a small skeleton of groups. Looks (presets below) cover modern people and people in
// Bible times. pose(t, state) sets every joint from t: base (stand/sit/kneel/lie/walk), an action layer
// (read, phone, point, pray, ...), talking (mouth + gestures from the word times), mood (brows, mouth),
// blinking and looking at a point. The figure faces +z; its right hand is at -x.
import { THREE, mat, mesh, at, rot, scl, group, G, rng, wobble, clamp, lerp, smooth, V, bake, segs, STYLE, outline } from './core.js';

/* ---------- looks ---------- */
const SKIN = { licht: '#f1c7a5', medium: '#d9a37c', olijf: '#c58e62', bruin: '#9c6644', donker: '#6e4529' };
// hair: kort | lang | knot | krul | kaal | kaal-rand ; beard: null | kort | lang ; head: null | doek | sluier | kroon | helm
// top: trui | hoodie | shirt | jas | gewaad ; bottom: broek | rok | gewaad
export const LOOKS = {
  // modern (today, the app's audience)
  'vrouw-modern':    { skin: 'licht', hair: ['lang', '#5b3a26'], top: ['trui', '#d9776a'], bottom: ['broek', '#36465c'], shoes: '#eeeeee', female: true },
  'vrouw-modern-2':  { skin: 'bruin', hair: ['krul', '#2a1c14'], top: ['jas', '#e5b94e', '#f6f1e7'], bottom: ['broek', '#2e3440'], shoes: '#c9c1b6', female: true },
  'vrouw-modern-3':  { skin: 'medium', hair: ['knot', '#3a2418'], top: ['hoodie', '#7fa88f'], bottom: ['broek', '#d8cbb4'], shoes: '#ffffff', female: true },
  'man-modern':      { skin: 'licht', hair: ['kort', '#6b4a2f'], top: ['hoodie', '#3f6e8f'], bottom: ['broek', '#2f3640'], shoes: '#f2f2f2' },
  'man-modern-2':    { skin: 'medium', hair: ['kort', '#1e1712'], beard: ['kort', '#1e1712'], top: ['trui', '#2f6b5e'], bottom: ['broek', '#c7b89c'], shoes: '#5a4636' },
  'man-modern-3':    { skin: 'donker', hair: ['krul', '#16100c'], top: ['shirt', '#e6e1d6'], bottom: ['broek', '#3b4a5e'], shoes: '#efefef' },
  'oudere-man':      { skin: 'licht', hair: ['kaal-rand', '#c9c6c0'], beard: ['kort', '#d4d1cb'], top: ['jas', '#6d5a48', '#e8e2d6'], bottom: ['broek', '#4a4a4a'], shoes: '#3b2e25', glasses: true, old: true },
  'oudere-vrouw':    { skin: 'licht', hair: ['knot', '#d8d5d0'], top: ['trui', '#8c6b9e'], bottom: ['rok', '#4b5563'], shoes: '#5b4636', glasses: true, female: true, old: true },
  // Bible times (robes, headcloths, sandals)
  'man-bijbels':     { skin: 'olijf', hair: ['kort', '#2b1d14'], beard: ['kort', '#2b1d14'], head: ['doek', '#e9dcc3', '#8a5a3c'], top: ['gewaad', '#b98b5e', '#6f4e37'], bottom: ['gewaad'], shoes: '#7a5537' },
  'man-bijbels-2':   { skin: 'bruin', hair: ['kort', '#1c130d'], beard: ['kort', '#1c130d'], top: ['gewaad', '#8a9a7b', '#5e4630'], bottom: ['gewaad'], shoes: '#6b4a32' },
  'oude-man-bijbels': { skin: 'olijf', hair: ['kaal-rand', '#e4e0d8'], beard: ['lang', '#ebe7df'], head: ['doek', '#f1ece2', '#7d6a55'], top: ['gewaad', '#7a5f8a', '#d9c8a6'], bottom: ['gewaad'], shoes: '#6b4a32', old: true, staff: true },
  'vrouw-bijbels':   { skin: 'olijf', hair: ['lang', '#2a1a10'], head: ['sluier', '#3f6f8a'], top: ['gewaad', '#c96f4a', '#e8d9bd'], bottom: ['gewaad'], shoes: '#7a5537', female: true },
  'vrouw-bijbels-2': { skin: 'medium', hair: ['lang', '#3a2414'], head: ['sluier', '#efe6d4'], top: ['gewaad', '#6d7fa8', '#c9a46a'], bottom: ['gewaad'], shoes: '#7a5537', female: true },
  'herder':          { skin: 'olijf', hair: ['krul', '#24180f'], top: ['gewaad', '#d8c39a', '#7b5a3c'], bottom: ['gewaad'], shoes: '#6b4a32', staff: true },
  'visser':          { skin: 'bruin', hair: ['krul', '#1f150e'], beard: ['kort', '#1f150e'], top: ['gewaad', '#9aa6ad', '#5b4a3a'], bottom: ['gewaad'], shoes: '#5e4430' },
  'zeeman':          { skin: 'bruin', hair: ['kaal'], beard: ['kort', '#2b2018'], head: ['doek', '#b44b3a', '#e7d4b4'], top: ['gewaad', '#d9cfb8', '#8a3b2e'], bottom: ['gewaad'], shoes: '#5e4430' },
  'koning':          { skin: 'olijf', hair: ['kort', '#2a1b10'], beard: ['kort', '#2a1b10'], head: ['kroon', '#e3b341'], top: ['gewaad', '#7d2e46', '#e3b341'], bottom: ['gewaad'], shoes: '#5b3a24' },
  'soldaat':         { skin: 'medium', hair: ['kort', '#2a1b10'], head: ['helm', '#b8a06a'], top: ['gewaad', '#a8402f', '#8b7a5a'], bottom: ['gewaad'], shoes: '#5b3a24' },
};
export const LOOK_KEYS = Object.keys(LOOKS);
// Never show Jesus or God as a figure (many in the audience object to images of them).

const HIP = .86, TH = .4, SH = .38;   // hip height, thigh and shin length

/* ---------- building ---------- */
export function person(lookKey, { seed = lookKey } = {}) {
  const L = typeof lookKey === 'string' ? LOOKS[lookKey] : lookKey;
  if (!L) throw new Error('Unknown look ' + lookKey);
  const r = rng(seed);
  const skinC = SKIN[L.skin] || L.skin;
  const skin = mat(skinC, { rough: .62 });
  const [topType, topC, topC2] = L.top; const robe = topType === 'gewaad';
  const top = mat(topC), top2 = mat(topC2 || topC);
  const legC = robe ? topC : (L.bottom?.[1] || '#333');
  const legs = mat(robe ? shade(topC, -.12) : legC);
  const shoe = mat(L.shoes || '#444', { rough: .6 });
  const hairC = L.hair?.[1] || '#222'; const hair = mat(hairC, { rough: .9 });
  const P = {};   // joints

  const root = new THREE.Group();
  const hips = P.hips = at(group(root), 0, HIP, 0);
  hips.add(scl(at(mesh(G.sphere(.18, 24, 16), legs), 0, -.02, 0), 1.12, .72, .9));
  const spine = P.spine = group(hips);
  // torso: a rounded capsule, a bit wider than deep
  const torso = scl(at(mesh(G.capsule(.19, .2, 8, 24), top), 0, .27, 0), 1.1, 1, .78); spine.add(torso);
  const chest = P.chest = at(group(spine), 0, .47, 0);
  // clothes details
  if (topType === 'hoodie') { chest.add(rot(scl(at(mesh(G.torus(.1, .045, Math.PI * 2, 10, 24), top2), 0, .0, -.04), 1.15, 1, .9), Math.PI / 2 - .35, 0, 0)); spine.add(scl(at(mesh(G.box(.2, .09, .04, .02), mat(shade(topC, -.08))), 0, .14, .118), 1, 1, 1)); }
  if (topType === 'jas') { spine.add(scl(at(mesh(G.box(.07, .44, .03, .012), mat(topC2)), 0, .3, .115), 1, 1, 1)); }
  if (topType === 'shirt') { chest.add(rot(at(mesh(G.torus(.07, .018, Math.PI * 2, 8, 20), mat(shade(topC, -.1))), 0, .01, .0), Math.PI / 2, 0, 0)); }
  if (robe) {
    spine.add(rot(scl(at(mesh(G.torus(.19, .03, Math.PI * 2, 8, 28), top2), 0, .08, 0), 1.06, 1, .74), Math.PI / 2, 0, 0));   // sash
    spine.add(rot(at(mesh(G.box(.06, .6, .03, .012), top2), -.02, .29, .112), 0, 0, .62));                                     // shoulder band
  }
  // neck + head
  const neck = P.neck = at(group(chest), 0, .03, 0);
  neck.add(at(mesh(G.cyl(.055, .06, .1, 16), skin), 0, .04, 0));
  const head = P.head = at(group(neck), 0, .25, .01);
  const headR = .205;
  head.add(scl(mesh(G.sphere(headR, 40, 28), skin), 1, 1.04, .98));
  head.add(scl(at(mesh(G.sphere(.05, 16, 12), skin), headR * .97, -.01, -.01), .45, 1, .8));      // ears
  head.add(scl(at(mesh(G.sphere(.05, 16, 12), skin), -headR * .97, -.01, -.01), .45, 1, .8));
  head.add(scl(at(mesh(G.sphere(.032, 16, 12), mat(shade(skinC, -.04), { rough: .55 })), 0, -.025, headR * .98), 1, .85, 1));   // nose
  // face
  const F = P.face = {};
  const eyeW = mat('#fbfaf6', { rough: .3 }), iris = mat(L.eyes || '#2d1f16', { rough: .25 }), shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  F.eyes = [1, -1].map(s => {
    const e = at(group(head), s * .074, .028, headR * .9);
    e.add(scl(mesh(G.sphere(.043, 20, 14), eyeW, { cast: false }), 1, 1.12, .55));
    const pupil = at(group(e), 0, -.002, .017); pupil.add(scl(mesh(G.sphere(.027, 16, 12), iris, { cast: false }), 1, 1.1, .5));
    pupil.add(at(new THREE.Mesh(G.sphere(.008, 8, 6), shine), .009 * s + .004, .011, .014));
    return { g: e, pupil };
  });
  const browM = mat(shade(hairC === '#c9c6c0' || hairC === '#d8d5d0' || hairC === '#e4e0d8' || hairC === '#ebe7df' ? '#b9b4ab' : hairC, -.05), { rough: .9 });
  F.brows = [1, -1].map(s => { const b = at(group(head), s * .078, .1, headR * .93); b.add(rot(mesh(G.capsule(.011, .045, 4, 8), browM, { cast: false }), 0, 0, Math.PI / 2)); return b; });
  const lips = mat('#7a3a36', { rough: .5 });
  F.mouth = at(group(head), 0, -.088, headR * .91);
  F.smile = rot(mesh(G.torus(.04, .0085, Math.PI, 8, 20), lips, { cast: false }), 0, 0, Math.PI); F.mouth.add(F.smile);
  F.open = scl(mesh(G.sphere(.036, 18, 12), mat('#4a1c1f', { rough: .6 }), { cast: false }), 1.1, .5, .4); F.mouth.add(F.open);
  [1, -1].forEach(s => head.add(scl(at(mesh(G.sphere(.03, 12, 8), mat(shade(skinC, .02, '#ff8a80'), { rough: .7, transparent: true, opacity: .35 }), { cast: false }), s * .12, -.045, headR * .82), 1, .7, .4)));
  if (L.glasses) { const gm = mat('#2b2b2b', { rough: .4 }); [1, -1].forEach(s => head.add(at(rot(mesh(G.torus(.042, .006, Math.PI * 2, 6, 24), gm, { cast: false }), 0, 0, 0), s * .074, .028, headR * 1.0))); head.add(at(mesh(G.box(.05, .008, .008), gm, { cast: false }), 0, .035, headR * 1.0)); }
  // hair
  const [hs] = L.hair || ['kaal'];
  const capG = (k = 1.07, len = .52) => rot(scl(mesh(G.cap(headR, Math.PI * len, 0, 36, 18), hair), k, k * 1.04, k), -.38, 0, 0);
  if (hs === 'kort') head.add(at(capG(1.07, .5), 0, .006, -.012));
  if (hs === 'lang') { head.add(at(capG(1.08, .52), 0, .006, -.01)); head.add(scl(at(mesh(G.capsule(.17, .24, 8, 20), hair), 0, -.17, -.06), 1.2, 1, .62)); }
  if (hs === 'knot') { head.add(at(capG(1.06, .5), 0, .006, -.012)); head.add(at(mesh(G.sphere(.085, 20, 14), hair), 0, .17, -.12)); }
  if (hs === 'krul') { head.add(at(capG(1.08, .5), 0, .006, -.012)); const rr = rng(seed + 'krul'); for (let i = 0; i < 22; i++) { const a = rr() * Math.PI * 2, b = rr() * Math.PI * .42; const d = headR * 1.08; head.add(at(mesh(G.sphere(.045 + rr() * .02, 12, 8), hair), Math.sin(b) * Math.cos(a) * d, Math.cos(b) * d * .98 + .01, Math.sin(b) * Math.sin(a) * d - .04 - (Math.sin(a) > 0 ? .0 : .02))); } }
  if (hs === 'kaal-rand') { head.add(rot(scl(at(mesh(G.torus(.17, .045, Math.PI * 1.25, 8, 24), hair), 0, -.0, -.05), 1.08, 1, 1), Math.PI / 2 + .25, 0, Math.PI * -.125 + Math.PI)); }
  // beard
  if (L.beard) {
    const bm = mat(L.beard[1], { rough: .95 });
    head.add(scl(at(mesh(G.cap(headR * 1.02, Math.PI * .36, Math.PI * .6, 32, 12), bm), 0, -.0, .012), 1.03, 1.05, 1.02));
    head.add(rot(scl(at(mesh(G.capsule(.014, .075, 4, 8), bm, { cast: false }), 0, -.064, headR * .97), 1.3, 1, 1), 0, 0, Math.PI / 2));   // moustache
    if (L.beard[0] === 'lang') head.add(rot(scl(at(mesh(G.cone(.12, .26, 20), bm), 0, -.25, .06), 1, 1, .7), Math.PI, 0, 0));
    F.mouth.position.z = headR * 1.02;
  }
  // head coverings
  if (L.head) {
    const [hk, c1, c2] = L.head; const hm = mat(c1, { rough: .95 }), hm2 = mat(c2 || c1);
    if (hk === 'doek' || hk === 'sluier') {
      head.add(at(rot(scl(mesh(G.cap(headR, Math.PI * .56, 0, 36, 16), hm), 1.13, 1.13, 1.13), -.32, 0, 0), 0, .01, -.01));
      const drape = mesh(new THREE.CylinderGeometry(headR * 1.06, hk === 'sluier' ? .27 : .25, hk === 'sluier' ? .52 : .4, segs(28, 8), 1, true, Math.PI * .62, Math.PI * 1.76), mat(c1, { rough: .95, side: THREE.DoubleSide }));
      head.add(at(drape, 0, hk === 'sluier' ? -.2 : -.15, -.035));
      if (hk === 'doek') head.add(rot(scl(at(mesh(G.torus(headR * 1.1, .018, Math.PI * 2, 8, 32), hm2), 0, .085, -.02), 1, 1, 1), Math.PI / 2 - .2, 0, 0));
    }
    if (hk === 'kroon') { const cm = mat(c1, { rough: .3, metal: .6 }); head.add(at(mesh(G.cyl(.15, .15, .07, 24, true), cm), 0, .2, -.01)); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; head.add(at(mesh(G.cone(.025, .06, 8), cm), Math.sin(a) * .15, .26, Math.cos(a) * .15 - .01)); } }
    if (hk === 'helm') { const cm = mat(c1, { rough: .35, metal: .55 }); head.add(at(rot(scl(mesh(G.cap(headR, Math.PI * .55, 0, 32, 14), cm), 1.13), -.25, 0, 0), 0, .015, -.01)); head.add(at(rot(mesh(G.box(.03, .14, .26, .01), mat('#a33a2a')), 0, 0, 0), 0, .28, -.03)); }
  }
  // arms
  const sleeve = robe || topType === 'trui' || topType === 'hoodie' || topType === 'jas';
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const sh = P['shoulder' + side] = at(group(chest), s * .225, -.03, 0);
    sh.add(mesh(G.sphere(.078, 18, 14), top));
    sh.add(at(mesh(G.capsule(.068, .14, 6, 16), top), 0, -.12, 0));
    const el = P['elbow' + side] = at(group(sh), 0, -.25, 0);
    el.add(mesh(G.sphere(.064, 14, 10), sleeve ? top : skin));
    el.add(at(mesh(G.capsule(robe ? .07 : .06, .13, 6, 16), sleeve ? top : skin), 0, -.1, 0));
    if (robe) el.add(at(mesh(G.cyl(.08, .092, .07, 16), top), 0, -.19, 0));
    const hand = P['hand' + side] = at(group(el), 0, -.25, 0);
    hand.add(scl(at(mesh(G.sphere(.07, 18, 12), skin), 0, -.02, 0), .85, 1.05, .74));
    hand.add(rot(at(scl(mesh(G.sphere(.03, 10, 8), skin), 1, 1.4, 1), s * .055, -.0, .025), 0, 0, s * .5));   // thumb
  }
  // legs
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const hp = P['hip' + side] = at(group(hips), s * .1, -.03, 0);
    hp.add(at(mesh(G.capsule(.092, .24, 6, 16), legs), 0, -.19, 0));
    const kn = P['knee' + side] = at(group(hp), 0, -TH, 0);
    kn.add(mesh(G.sphere(.085, 16, 12), legs));
    kn.add(at(mesh(G.cyl(.084, .074, .3, 16), legs), 0, -.17, 0));
    const an = P['ankle' + side] = at(group(kn), 0, -SH, 0);
    an.add(scl(at(mesh(G.box(.135, .085, .25, .04), shoe), 0, -.012, .05), 1, 1, 1));
  }
  // robe / skirt (hangs from the hips, legs move inside)
  let skirt = null;
  if (robe || L.bottom?.[0] === 'rok') {
    const len = robe ? .8 : .52; const c = robe ? topC : L.bottom[1];
    skirt = mesh(G.lathe([[robe ? .35 : .3, -len], [robe ? .29 : .26, -len * .55], [.22, -.05], [.19, .06]], 32), mat(c, { side: THREE.DoubleSide }));
    hips.add(skirt);
    if (robe) skirt.add(at(rot(mesh(G.torus(.335, .02, Math.PI * 2, 6, 32), top2), Math.PI / 2, 0, 0), 0, -len + .03, 0));   // hem
  }
  // props
  const props = {};
  props.book = book(); props.book.visible = false; chest.add(props.book);
  props.phone = phone(); props.phone.visible = false; P.handR.add(props.phone);
  if (L.staff) { props.staff = at(group(P.handL), 0, -.04, .02); props.staff.add(at(mesh(G.cyl(.022, .026, 1.75, 10), mat('#7a5634', { rough: .9 })), 0, .35, 0)); props.staff.add(at(rot(mesh(G.torus(.07, .022, Math.PI * 1.2, 8, 16), mat('#7a5634', { rough: .9 })), 0, 0, -.3), -.06, 1.22, 0)); }
  props.scroll = scroll(); props.scroll.visible = false; chest.add(props.scroll);

  // fewer draw calls: each joint's own static meshes become one mesh per material (face parts stay separate)
  const keepFace = new Set([F.smile, F.open, skirt].filter(Boolean));
  for (const k of Object.keys(P)) if (P[k]?.isObject3D) bake(P[k], { deep: false, keep: keepFace });
  if (STYLE.name === 'toon') {   // cartoon outlines on the body, not on the small face parts or props
    const skip = new Set([...F.eyes.map(e => e.g), ...F.brows, F.mouth, ...Object.values(props)].filter(Boolean));
    const list = []; root.traverse(m => {
      if (!m.isMesh || m.userData.outline || m.material.transparent) return;
      for (let p = m; p; p = p.parent) if (skip.has(p)) return;
      m.geometry.computeBoundingSphere(); if (m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < .055) return;   // nose, ears, thumbs
      list.push(m);
    });
    list.forEach(m => outline(m));
  }
  const blinkAt = Array.from({ length: 40 }, (_, i) => i * 3.6 + r() * 2.4);
  const idle = wobble(seed + 'idle'), gest = wobble(seed + 'gest');
  return { root, P, look: L, skirt, props, female: !!L.female, height: 1.9,
    headWorld: () => P.head.getWorldPosition(V()),
    pose: (t, s) => pose({ P, F, L, skirt, props, blinkAt, idle, gest, root }, t, s) };
}

/** Darker (k<0) / lighter (k>0) / tinted version of a hex colour. */
export function shade(hex, k, toward) {
  const c = new THREE.Color(hex); const o = new THREE.Color(toward || (k < 0 ? '#000000' : '#ffffff'));
  return '#' + c.lerp(o, Math.abs(k)).getHexString();
}

/* ---------- props ---------- */
function book() {
  const g = new THREE.Group(); const cover = mat('#5b2a2a', { rough: .7 }), page = mat('#f4ecd8', { rough: .9 });
  for (const s of [1, -1]) {
    const half = at(group(g), 0, 0, 0); half.rotation.y = s * .22;
    half.add(at(mesh(G.box(.15, .2, .012, .004), cover), s * .078, 0, -.004));
    half.add(at(mesh(G.box(.14, .19, .016, .002), page), s * .074, 0, .008));
  }
  g.position.set(0, -.27, .27); g.rotation.x = -.75;
  return g;
}
function scroll() {
  const g = new THREE.Group(); const p = mat('#efe2c2', { rough: .9 }), w = mat('#7a5634');
  g.add(at(mesh(G.box(.3, .2, .005), p), 0, 0, 0));
  for (const s of [1, -1]) { g.add(at(mesh(G.cyl(.022, .022, .23, 12), w), s * .16, 0, 0)); }
  g.position.set(0, -.24, .3); g.rotation.x = -.6;
  return g;
}
function phone() {
  const g = new THREE.Group();
  g.add(mesh(G.box(.085, .17, .011, .008), mat('#1b1f24', { rough: .35 })));
  const screen = new THREE.Mesh(G.plane(.077, .158), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  screen.position.z = .0062; g.add(screen); g.userData.screen = screen;
  g.position.set(0, -.07, .05); g.rotation.set(-1.2, 0, 0);
  return g;
}
/** Put an app screenshot (texture) on a person's phone. */
export function setPhoneScreen(p, tex) { const s = p.props.phone.userData.screen; s.material.map = tex; s.material.needsUpdate = true; }

/* ---------- posing ---------- */
const SET = (o, x = 0, y = 0, z = 0) => o.rotation.set(x, y, z);
/**
 * state: { base: stand|sit|kneel|lie|walk, action: idle|talk|read|phone|show-phone|point|wave|think|pray|shrug|look-up|row|carry|cheer|sleep,
 *   mood: neutraal|blij|verward|nadenkend|verrast|bang|verdrietig, talk: 0..1 (mouth), talking: bool, walk: { phase, speed },
 *   look: Vector3 (world) | null, seat: height, t0: shot start }
 */
function pose(A, t, s) {
  const { P, F } = A; const base = s.base || 'stand', act = s.action || 'idle', mood = s.mood || 'neutraal';
  const breathe = Math.sin(t * 2.1) * .012, sway = A.idle(t * .35) * .03;
  // reset
  for (const k of Object.keys(P)) if (P[k]?.isObject3D) P[k].rotation.set(0, 0, 0);
  P.hips.position.set(0, HIP, 0); A.root.rotation.x = 0; A.root.rotation.z = 0;
  P.spine.scale.set(1, 1 + breathe, 1);
  if (A.skirt) A.skirt.scale.set(1, 1, 1);
  A.props.book.visible = act === 'read'; A.props.phone.visible = act === 'phone' || act === 'show-phone'; A.props.scroll.visible = act === 'scroll';

  // ---- base ----
  let armL = [-.08, 0, .1], armR = [-.08, 0, -.1], elL = -.18, elR = -.18;   // shoulder x,y,z ; elbow x
  if (base === 'stand') { P.spine.rotation.z = sway * .5; P.hips.rotation.z = -sway * .3; P.hipL.rotation.z = .02; P.hipR.rotation.z = -.02; }
  if (base === 'walk') {
    const ph = s.walk?.phase || 0, k = s.walk?.amount ?? 1;
    const sw = Math.sin(ph);
    P.hipL.rotation.x = -sw * .5 * k; P.hipR.rotation.x = sw * .5 * k;
    P.kneeL.rotation.x = Math.max(0, Math.sin(ph + 1.9)) * .75 * k; P.kneeR.rotation.x = Math.max(0, Math.sin(ph + 1.9 + Math.PI)) * .75 * k;
    P.ankleL.rotation.x = -Math.max(0, -Math.sin(ph + .6)) * .25 * k; P.ankleR.rotation.x = -Math.max(0, Math.sin(ph + .6)) * .25 * k;
    P.hips.position.y = HIP - .02 + Math.abs(Math.cos(ph)) * .035 * k;
    P.hips.rotation.y = sw * .08 * k; P.spine.rotation.y = -sw * .12 * k; P.spine.rotation.x = .05 * k;
    armL = [sw * .45 * k, 0, .1]; armR = [-sw * .45 * k, 0, -.1]; elL = elR = -.35;
    if (A.skirt) A.skirt.rotation.x = Math.sin(ph * 2) * .03 * k;
  }
  if (base === 'sit' || base === 'row') {
    const seat = s.seat ?? .48;
    P.hips.position.y = seat + .08;
    P.hipL.rotation.x = P.hipR.rotation.x = -1.5; P.kneeL.rotation.x = P.kneeR.rotation.x = 1.42;
    P.hipL.rotation.z = .08; P.hipR.rotation.z = -.08; P.spine.rotation.x = -.04;
    if (A.skirt) A.skirt.scale.set(1.05, .42, 1.2);
  }
  if (base === 'kneel') {
    P.hips.position.y = .5; P.hipL.rotation.x = P.hipR.rotation.x = -.05; P.kneeL.rotation.x = P.kneeR.rotation.x = 1.55; P.ankleL.rotation.x = P.ankleR.rotation.x = .5;
    if (A.skirt) A.skirt.scale.set(1.05, .55, 1.15);
  }
  if (base === 'lie') {   // on the back, head toward -z
    A.root.rotation.x = -Math.PI / 2; P.hips.position.set(0, .14, 0);
    if (A.skirt) A.skirt.scale.set(1, 1, 1);
  }

  // ---- action ----
  const tk = s.talking ? 1 : 0;
  let headX = 0, headY = 0, headZ = 0;
  switch (act) {
    case 'read': armL = [-.62, 0, -.22]; armR = [-.62, 0, .22]; elL = elR = -1.2; headX = .38; break;
    case 'scroll': armL = [-.6, 0, -.1]; armR = [-.6, 0, .1]; elL = elR = -1.15; headX = .32; break;
    case 'phone': armR = [-.35, -.2, -.05]; elR = -1.9; headX = .3; A.props.phone.rotation.set(-1.35, .0, 0); A.props.phone.position.set(0, -.08, .03); break;
    case 'show-phone': armR = [-1.25, .15, -.1]; elR = -.35; A.props.phone.rotation.set(-1.6, Math.PI, 0); A.props.phone.position.set(0, -.08, .04); break;
    case 'point': armR = [-1.45, -.15, -.05]; elR = -.08; break;
    case 'wave': armR = [0, 0, -2.5]; elR = -.5 - .45 * (.5 + .5 * Math.sin(t * 9)); break;
    case 'think': armR = [-.35, -.3, .25]; elR = -2.45; armL = [-.25, .1, .2]; elL = -1.5; headZ = .12; headX = .05; break;
    case 'pray': armL = [-.45, 0, -.32]; armR = [-.45, 0, .32]; elL = elR = -1.75; headX = .32; break;
    case 'shrug': armL = [-.15, 0, .55]; armR = [-.15, 0, -.55]; elL = elR = -1.45; P.chest.position.y = .49; headZ = .1; break;
    case 'look-up': headX = -.45; armL = [-.1, 0, .25]; armR = [-.1, 0, -.25]; break;
    case 'cheer': armL = [0, 0, 2.6]; armR = [0, 0, -2.6]; elL = elR = -.3; headX = -.15; break;
    case 'row': { const c = Math.sin(t * 3.2); armL = [-1.0 - c * .45, 0, .25]; armR = [-1.0 - c * .45, 0, -.25]; elL = elR = -.6 + c * .35; P.spine.rotation.x = .1 + c * .18; break; }
    case 'carry': armL = [-.9, 0, .25]; armR = [-.9, 0, -.25]; elL = elR = -1.2; break;
    case 'sleep': headZ = .25; F.eyes.forEach(e => e.g.scale.y = .08); break;
    case 'fear': armL = [-.6, .3, .5]; armR = [-.6, -.3, -.5]; elL = elR = -1.9; headX = .1; break;
    case 'talk': default: break;
  }
  if (s.talking && ['idle', 'talk', 'shrug', 'think'].includes(act) && act !== 'think') {
    const g1 = A.gest(t * 1.3), g2 = A.gest(t * 1.1 + 7);
    armR = [armR[0] - .35 - .25 * Math.max(0, g1), armR[1], armR[2] - .05]; elR = elR - .75 - .3 * g2;
    if (g2 > .1) { armL = [armL[0] - .2 - .2 * g2, armL[1], armL[2]]; elL = elL - .5 * g2; }
  }
  SET(P.shoulderL, ...armL); SET(P.shoulderR, ...armR); P.elbowL.rotation.x = elL; P.elbowR.rotation.x = elR;
  P.handL.rotation.x = -.15; P.handR.rotation.x = -.15;

  // ---- head: look at a point, nods while talking ----
  let yaw = 0, pitch = 0;
  if (s.look) {
    const local = A.root.worldToLocal(s.look.clone()); const hp = V(0, P.hips.position.y + .47 + .28, 0);
    const d = local.sub(hp); yaw = clamp(Math.atan2(d.x, d.z), -1.1, 1.1); pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -.6, .6);
  }
  const nod = tk * (A.idle(t * 2.3) * .07 + Math.sin(t * 5.1) * .025);
  P.neck.rotation.set((pitch * .4 + headX * .4), yaw * .35, headZ * .4);
  P.head.rotation.set(pitch * .6 + headX * .6 + nod + A.idle(t * .5 + 3) * .03, yaw * .55 + A.idle(t * .4 + 9) * .04, headZ * .6 + sway * .4);
  if (Math.abs(yaw) > .7) P.spine.rotation.y += (yaw - Math.sign(yaw) * .7) * .6;

  // ---- face ----
  const blink = A.blinkAt.some(b => t >= b && t < b + .13);
  if (act !== 'sleep') F.eyes.forEach(e => e.g.scale.y = blink ? .1 : 1);
  const look2 = clamp(yaw * .02, -.012, .012); F.eyes.forEach(e => { e.pupil.position.x = look2; });
  const B = { neutraal: [0, 0, 0], blij: [.012, .1, .1], verward: [.018, -.25, .3], nadenkend: [-.006, -.25, -.25], verrast: [.03, .15, .15], bang: [.016, .45, .45], verdrietig: [.006, .4, .4] }[mood] || [0, 0, 0];
  F.brows.forEach((b, i) => { b.position.y = .1 + B[0] * (mood === 'verward' && i ? -.6 : 1); b.rotation.z = (i ? -1 : 1) * (mood === 'verward' && i ? -B[2] * .6 : B[1]); });
  const open = clamp(s.talk || 0);
  F.open.visible = open > .04 || mood === 'verrast' || mood === 'bang'; F.smile.visible = !F.open.visible || open < .2;
  F.open.scale.set(mood === 'verrast' ? .8 : 1.1 - open * .2, .25 + open * .85 + (mood === 'verrast' && open < .05 ? .55 : 0), .4);
  const smile = { blij: 1.25, neutraal: .7, verward: .35, nadenkend: .4, verrast: .5, bang: .3, verdrietig: -.8 }[mood] ?? .7;
  F.smile.scale.set(1, Math.abs(smile) * (1 - open * .7) + .05, 1); F.smile.rotation.z = smile < 0 ? 0 : Math.PI; F.smile.position.y = smile < 0 ? -.012 : 0;
}
