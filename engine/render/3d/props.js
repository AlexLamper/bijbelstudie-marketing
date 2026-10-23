// Furniture and objects for the 3D sets. Each returns a THREE.Group standing on y = 0, front facing +z.
import { THREE, mat, mesh, at, rot, scl, group, G, rng, canvasTexture, basic } from './core.js';

const wood = (c = '#a87b52') => mat(c, { rough: .72 });

export function bed({ w = 1.3, l = 2.05, sheet = '#e9eef2', blanket = '#5b7fa6', frame = '#8a6243' } = {}) {
  const g = new THREE.Group();
  g.add(at(mesh(G.box(w + .08, .28, l + .06, .03), wood(frame)), 0, .2, 0));
  g.add(at(mesh(G.box(w, .2, l, .06), mat(sheet)), 0, .43, 0));
  g.add(at(mesh(G.box(w + .04, .12, l * .62, .05), mat(blanket)), 0, .5, l * .17));
  g.add(at(mesh(G.box(w + .08, .7, .07, .03), wood(frame)), 0, .5, -l / 2 - .02));
  g.add(at(rot(mesh(G.box(w * .7, .14, .36, .07), mat('#ffffff')), -.12, 0, 0), 0, .58, -l / 2 + .28));
  return g;
}
export function desk({ w = 1.25, d = .62, h = .75, c = '#c19a6b' } = {}) {
  const g = new THREE.Group();
  g.add(at(mesh(G.box(w, .05, d, .015), wood(c)), 0, h, 0));
  for (const x of [-1, 1]) g.add(at(mesh(G.box(.05, h, d - .06, .01), wood(c)), x * (w / 2 - .05), h / 2, 0));
  g.add(at(mesh(G.box(w * .45, .18, d - .08, .01), wood(c)), w * .2, h - .12, 0));
  return g;
}
export function chair({ c = '#7a5a3e', seat = .48, back = true } = {}) {
  const g = new THREE.Group();
  g.add(at(mesh(G.box(.46, .05, .44, .02), wood(c)), 0, seat - .03, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(mesh(G.cyl(.022, .022, seat - .05, 8), wood(c)), x * .19, (seat - .05) / 2, z * .18));
  if (back) g.add(at(mesh(G.box(.44, .42, .04, .02), wood(c)), 0, seat + .22, -.2));
  return g;
}
export function lamp({ shade = '#f3e3c4', on = true } = {}) {
  const g = new THREE.Group();
  g.add(at(mesh(G.cyl(.08, .1, .03, 20), mat('#3b3b3b')), 0, .015, 0));
  g.add(at(mesh(G.cyl(.012, .012, .34, 8), mat('#3b3b3b')), 0, .19, 0));
  g.add(at(mesh(G.cyl(.09, .15, .17, 24, true), on ? mat(shade, { emissive: '#ffcf8a', glow: .9, side: THREE.DoubleSide }) : mat(shade, { side: THREE.DoubleSide }), { cast: false }), 0, .4, 0));
  if (on) g.add(at(new THREE.Mesh(G.sphere(.04, 12, 8), basic('#fff3d6')), 0, .37, 0));
  return g;
}
export function shelf({ w = 1.0, h = 1.7, c = '#9b7350', seed = 1 } = {}) {
  const g = new THREE.Group(); const r = rng(seed);
  g.add(at(mesh(G.box(w, h, .3, .01), wood(c)), 0, h / 2, -.0));
  const cols = ['#b5523b', '#3f6e8f', '#e3b341', '#2f6b5e', '#8c6b9e', '#d9776a', '#f1ece2', '#4b5563'];
  for (let s = 0; s < 4; s++) {
    const y = .12 + s * (h - .2) / 4; g.add(at(mesh(G.box(w - .04, .025, .28), wood(c)), 0, y, .02));
    let x = -w / 2 + .06;
    while (x < w / 2 - .12) { const bw = .03 + r() * .05, bh = .2 + r() * .14; if (r() < .85) g.add(at(rot(mesh(G.box(bw, bh, .2), mat(cols[Math.floor(r() * cols.length)])), 0, 0, r() < .1 ? .25 : 0), x + bw / 2, y + .012 + bh / 2, .04)); x += bw + .006; }
  }
  return g;
}
export function plant({ s = 1, pot = '#c9714b', leaf = '#4f8a5b', seed = 2 } = {}) {
  const g = new THREE.Group(); const r = rng(seed);
  g.add(at(mesh(G.cyl(.16, .12, .3, 20), mat(pot)), 0, .15, 0));
  for (let i = 0; i < 9; i++) { const a = r() * 6.28, h = .45 + r() * .5; g.add(at(rot(scl(mesh(G.sphere(.09, 12, 8), mat(leaf)), .55, 1.6, .25), Math.cos(a) * .5, a, Math.sin(a) * .5), Math.cos(a) * .12, .3 + h * .5, Math.sin(a) * .12)); }
  g.scale.setScalar(s); return g;
}
export function rug({ w = 2.2, d = 1.5, c = '#c98b5e', c2 = '#efe0c8' } = {}) {
  const g = new THREE.Group();
  g.add(at(mesh(G.box(w, .012, d, .005), mat(c), { cast: false }), 0, .006, 0));
  g.add(at(mesh(G.box(w * .8, .014, d * .74, .005), mat(c2), { cast: false }), 0, .007, 0));
  return g;
}
/** A window in a wall (x-y plane), outside picture drawn on a canvas: night (moon + stars) or day. */
export function windowPane({ w = 1.1, h = 1.2, time = 'nacht', frame = '#f4f1ea' } = {}) {
  const g = new THREE.Group();
  const tex = canvasTexture(256, 280, (c, W, H) => {
    const grad = c.createLinearGradient(0, 0, 0, H);
    if (time === 'nacht') { grad.addColorStop(0, '#0d1b33'); grad.addColorStop(1, '#2a3f66'); } else { grad.addColorStop(0, '#8ec5ea'); grad.addColorStop(1, '#d9eef7'); }
    c.fillStyle = grad; c.fillRect(0, 0, W, H);
    if (time === 'nacht') { const r = rng(7); c.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { c.globalAlpha = .4 + r() * .6; c.fillRect(r() * W, r() * H * .7, 1.6, 1.6); } c.globalAlpha = 1; c.fillStyle = '#f6efd2'; c.beginPath(); c.arc(W * .7, H * .25, 22, 0, 6.28); c.fill(); }
    c.fillStyle = time === 'nacht' ? '#13223a' : '#7fae7a'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 16) c.lineTo(x, H * .78 - Math.sin(x * .03) * 14 - (x % 48 < 20 ? 18 : 0)); c.lineTo(W, H); c.fill();
  });
  g.add(new THREE.Mesh(G.plane(w, h), new THREE.MeshBasicMaterial({ map: tex })));
  const fm = mat(frame, { rough: .5 });
  for (const [x, y, fw, fh] of [[0, h / 2, w + .1, .06], [0, -h / 2, w + .14, .08], [-w / 2, 0, .06, h], [w / 2, 0, .06, h], [0, 0, .04, h], [0, 0, w, .04]]) g.add(at(mesh(G.box(fw, fh, .06), fm), x, y, .02));
  g.add(at(mesh(G.box(w + .2, .04, .16), fm), 0, -h / 2 - .04, .07));
  return g;
}
export function sofa({ w = 2.0, c = '#5d8a87', c2 = '#e9dcc3' } = {}) {
  const g = new THREE.Group(); const m = mat(c, { rough: .9 });
  g.add(at(mesh(G.box(w, .26, .85, .08), m), 0, .26, 0));
  g.add(at(mesh(G.box(w, .5, .22, .08), m), 0, .55, -.33));
  for (const x of [-1, 1]) g.add(at(mesh(G.box(.2, .38, .85, .08), m), x * (w / 2 - .06), .42, 0));
  for (const x of [-1, 1]) g.add(at(mesh(G.box(w / 2 - .18, .12, .62, .06), mat(c, { rough: .95 })), x * (w / 4 - .02), .44, .06));
  g.add(at(rot(mesh(G.box(.36, .32, .1, .05), mat(c2)), -.2, .2, .1), -w / 2 + .38, .62, -.18));
  g.add(at(rot(mesh(G.box(.32, .3, .1, .05), mat('#e3b341')), -.2, -.25, -.1), w / 2 - .36, .62, -.18));
  return g;
}
export function table({ w = 1.1, d = .6, h = .42, c = '#b88a5a', round = false } = {}) {
  const g = new THREE.Group();
  if (round) g.add(at(mesh(G.cyl(w / 2, w / 2, .05, 32), wood(c)), 0, h, 0)); else g.add(at(mesh(G.box(w, .05, d, .02), wood(c)), 0, h, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(mesh(G.cyl(.025, .02, h, 8), wood(c)), x * (w / 2 - .08) * (round ? .6 : 1), h / 2, z * (d / 2 - .07) * (round ? 1 : 1)));
  return g;
}
export function mug(c = '#ffffff') { const g = new THREE.Group(); g.add(at(mesh(G.cyl(.045, .04, .1, 16), mat(c, { rough: .4 })), 0, .05, 0)); g.add(at(rot(mesh(G.torus(.03, .009, Math.PI * 2, 6, 12), mat(c, { rough: .4 })), 0, 0, 0), .05, .05, 0)); return g; }
export function frame({ w = .5, h = .4, c = '#3b3b3b', art = '#c9b28f' } = {}) {
  const g = new THREE.Group(); g.add(mesh(G.box(w, h, .03), mat(c))); g.add(at(mesh(G.box(w - .08, h - .08, .01), mat(art, { rough: .9 })), 0, 0, .017)); return g;
}
export function bibleOnTable() { const g = new THREE.Group(); g.add(at(mesh(G.box(.17, .045, .24, .01), mat('#5b2a2a')), 0, .022, 0)); g.add(at(mesh(G.box(.155, .035, .225), mat('#f4ecd8')), .006, .024, 0)); return g; }
