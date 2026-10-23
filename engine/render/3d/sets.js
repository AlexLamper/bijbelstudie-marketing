// 3D sets for the animated reels. A set is a little world the characters stand in, with named spots.
// Register with defineSet(name, def):
//   def.spots: { spot: { p: [x, z], yaw, seat?: height to sit on, base?: 'sit'|'kneel'|'lie' } }
//              yaw 0 = facing +z (toward the default camera); Math.PI/2 = facing +x.
//   def.build(o) -> { scene, wide: { pos: [x,y,z], target: [x,y,z], fov? }, bounds?: { x: [min,max], z: [min,max], y: [min,max] },
//                     update?(t, shot), groundY?(x, z), camera?(t, shot, k) -> { pos: Vector3, target: Vector3, fov },
//                     overlay?(t, shot, camera), ready?: Promise }
//     o = { time: 'dag'|'avond'|'nacht', weather: 'helder'|'storm', seed, places (kaart), ctx (stage context:
//           places, map), layer (a div over the canvas for this world's HTML labels), shot }
//   camera(): used for "wide" shots and shots without actors (e.g. the map flies along the route); k = 0..1 in the shot.
//   update(): animate the world (waves, fire, sheep) from t. overlay(): place HTML labels (project with camera).
//   fixedCamera: true in the def = always use camera().
// The catalogue the planner sees (names, spots, descriptions) is engine/render/3d/catalog.json; keep it in sync.
import { THREE, mat, mesh, at, rot, scl, group, G, sky, lights, canvasTexture, rng, V, bake } from './core.js';
import * as props from './props.js';

export const SETS = {};
export const defineSet = (name, def) => { SETS[name] = def; };

/* ---------- shared: room shell (floor + back and left wall), seen from the open front-right ---------- */
function planks(c1 = '#b98a5e', c2 = '#a77a50') {
  const t = canvasTexture(512, 512, (c, W, H) => {
    const r = rng(3); c.fillStyle = c1; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 32) { for (let x = -((y / 32) % 3) * 90; x < W; x += 260) { c.fillStyle = r() < .5 ? c1 : c2; c.fillRect(x, y, 258, 30); } c.fillStyle = 'rgba(60,35,20,.35)'; c.fillRect(0, y + 30, W, 2); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function room(scene, { w = 6, d = 6, h = 2.8, wall = '#e8dccb', wall2, floor = ['#b98a5e', '#a77a50'] } = {}) {
  const f = mesh(G.plane(w, d), new THREE.MeshStandardMaterial({ map: planks(...floor), roughness: .8 }), { cast: false });
  f.rotation.x = -Math.PI / 2; scene.add(f);
  const back = mesh(G.box(w, h, .1), mat(wall, { rough: .95 }), { cast: false }); back.position.set(0, h / 2, -d / 2); scene.add(back);
  const left = mesh(G.box(.1, h, d), mat(wall2 || wall, { rough: .95 }), { cast: false }); left.position.set(-w / 2, h / 2, 0); scene.add(left);
  for (const [x, z, ww, dd] of [[0, -d / 2 + .06, w, .03], [-w / 2 + .06, 0, .03, d]]) scene.add(at(mesh(G.box(ww, .1, dd), mat('#f6f1e7')), x, .05, z));
  return { back: -d / 2 + .05, left: -w / 2 + .05 };
}

/* ---------- slaapkamer: bedroom, someone reading the Bible at night (or day) ---------- */
defineSet('slaapkamer', {
  spots: {
    bed: { p: [-1.05, -.55], yaw: Math.PI / 2 - .35, seat: .5, base: 'sit' },
    'bed-liggen': { p: [-1.75, -.62], yaw: 0, base: 'lie', y: .52 },
    bureau: { p: [.75, -1.35], yaw: Math.PI - .5, seat: .48, base: 'sit' },
    midden: { p: [-.05, -1.05], yaw: -1.6 },
    deur: { p: [2.2, -1.1], yaw: -1.9 },
    raam: { p: [-.55, -1.75], yaw: -.3 },
  },
  build({ time = 'nacht' } = {}) {
    const scene = new THREE.Scene(); const night = time !== 'dag';
    scene.background = new THREE.Color(night ? '#141c26' : '#dfe8ee');
    const R = room(scene, { wall: night ? '#c9cfd8' : '#e9e1d3', wall2: night ? '#b9c3cf' : '#dcd4c4' });
    const bed = props.bed({ blanket: '#4f7cac' }); bed.position.set(-1.75, 0, -.9); scene.add(bed);
    const desk = props.desk(); desk.position.set(.95, 0, -2.6); scene.add(desk);
    const ch = props.chair(); ch.position.set(.8, 0, -1.55); ch.rotation.y = Math.PI - .5; scene.add(ch);
    const lamp = props.lamp({ on: true }); lamp.position.set(1.35, .775, -2.72); scene.add(lamp);
    scene.add(at(props.bibleOnTable(), .7, .78, -2.55));
    scene.add(at(props.mug('#d9776a'), 1.15, .775, -2.45));
    const win = props.windowPane({ time: night ? 'nacht' : 'dag' }); win.position.set(-.6, 1.55, R.back + .02); scene.add(win);
    const sh = props.shelf({ seed: 4 }); sh.position.set(2.2, 0, -2.78); scene.add(sh);
    scene.add(at(props.plant({ s: 1.1 }), -2.55, 0, -2.6));
    scene.add(at(props.rug({ w: 2.0, d: 1.4, c: '#7d9bb5', c2: '#e6dccb' }), .1, 0, .1));
    const fr = props.frame({ art: '#9cb7a4' }); fr.position.set(-2.92, 1.6, -.6); fr.rotation.y = Math.PI / 2; scene.add(fr);
    // light: warm desk lamp + cool moonlight, or daylight through the window
    if (night) {
      lights(scene, { key: '#ffd29a', keyI: 1.6, keyDir: [2.2, 3.2, 1.5], focus: [-.3, .9, -.6], box: 3.5, fillSky: '#5d7396', fillGround: '#2c241f', fillI: .55, rim: '#8fb3ff', rimI: .9, rimDir: [-2, 2.5, -4] });
      const pl = new THREE.PointLight('#ffc27a', 3.2, 6, 1.6); pl.position.set(1.35, 1.25, -2.6); scene.add(pl);
      const bl = new THREE.PointLight('#ffd7a0', 1.4, 5, 1.8); bl.position.set(-.6, 1.6, .4); scene.add(bl);
    } else lights(scene, { key: '#fff4e2', keyI: 2.4, keyDir: [-1.5, 3.5, 3], focus: [-.3, .9, -.6], box: 3.5, fillSky: '#dbe9f5', fillGround: '#8a7360', fillI: 1.1, rimI: .6 });
    bake(scene);
    return { scene, wide: { pos: [2.5, 1.75, 3.1], target: [-.5, .9, -.9] }, bounds: { x: [-2.6, 3.5], z: [-2.5, 4.5], y: [.4, 2.6] } };
  },
});

/* ---------- woonkamer: living room, friends talking on the sofa ---------- */
defineSet('woonkamer', {
  spots: {
    'bank-links': { p: [-.5, -1.42], yaw: .2, seat: .45, base: 'sit' },
    'bank-rechts': { p: [.42, -1.42], yaw: -.2, seat: .45, base: 'sit' },
    stoel: { p: [1.75, -.35], yaw: -1.35, seat: .46, base: 'sit' },
    midden: { p: [.1, .25], yaw: 0 },
    deur: { p: [2.4, -1.3], yaw: -1.9 },
    raam: { p: [-2.1, .2], yaw: Math.PI / 2 },
  },
  build({ time = 'dag' } = {}) {
    const scene = new THREE.Scene(); const night = time === 'nacht', eve = time === 'avond';
    scene.background = new THREE.Color(night ? '#141c26' : '#dfe8ee');
    const R = room(scene, { wall: '#efe6d6', wall2: '#d7e3e0', floor: ['#c79c6c', '#b88d5f'] });
    const so = props.sofa({ c: '#5d8a87' }); so.position.set(0, 0, -1.95); scene.add(so);
    scene.add(at(props.rug({ w: 2.6, d: 1.7, c: '#d9a066', c2: '#f3e7d3' }), 0, 0, -.55));
    const tb = props.table({ w: 1.1, d: .55, h: .4 }); tb.position.set(0, 0, -.75); scene.add(tb);
    scene.add(at(props.mug('#ffffff'), -.25, .425, -.7)); scene.add(at(props.mug('#e3b341'), .2, .425, -.82)); scene.add(at(props.bibleOnTable(), .02, .425, -.62));
    const arm = props.sofa({ w: .95, c: '#c96f4a' }); arm.position.set(2.1, 0, -.35); arm.rotation.y = -Math.PI / 2; scene.add(arm);
    const win = props.windowPane({ time: night ? 'nacht' : 'dag', w: 1.3, h: 1.3 }); win.position.set(R.left + .02, 1.5, -.2); win.rotation.y = Math.PI / 2; scene.add(win);
    const sh = props.shelf({ seed: 9, w: 1.2 }); sh.position.set(-2.1, 0, -2.78); scene.add(sh);
    scene.add(at(props.plant({ s: 1.3, seed: 5 }), 1.55, 0, -2.6)); scene.add(at(props.lamp({ on: night || eve }), -1.35, 0, -2.6)).children;
    const fr1 = props.frame({ w: .7, h: .5, art: '#e3b341' }); fr1.position.set(-.45, 1.7, -2.93); scene.add(fr1);
    const fr2 = props.frame({ w: .4, h: .55, art: '#7fa88f' }); fr2.position.set(.35, 1.72, -2.93); scene.add(fr2);
    if (night || eve) {
      lights(scene, { key: '#ffd8a8', keyI: 1.7, keyDir: [2.5, 3.5, 2.5], focus: [0, .9, -1], box: 3.5, fillSky: '#6d7f9c', fillGround: '#3a2f27', fillI: .6, rim: '#ffb26b', rimI: .6 });
      const pl = new THREE.PointLight('#ffc27a', 2.4, 6, 1.6); pl.position.set(-1.3, 1.3, -2.2); scene.add(pl);
    } else lights(scene, { key: '#fff4e2', keyI: 2.5, keyDir: [-3, 3.5, 2.2], focus: [0, .9, -1], box: 3.5, fillSky: '#dbe9f5', fillGround: '#8a7360', fillI: 1.15, rimI: .55 });
    bake(scene);
    return { scene, wide: { pos: [2.1, 1.6, 3.4], target: [-.2, .85, -1.2] }, bounds: { x: [-2.6, 3.5], z: [-2.4, 4.5], y: [.4, 2.6] } };
  },
});
