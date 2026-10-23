/* 3D animated reel (reel-3d): characters acting in 3D sets, shot by shot, with a narrator and/or dialog.
   Loaded as a module (it imports three.js); registers T['reel-3d'] like the other templates.
   Each shot is one spoken line (narrator "say", or a character's "line" with "by") or a silent "hold".
   The camera, the actors and the overlays are all set from t (pure function of time). */
import { THREE, getRenderer, V, clamp, lerp, prog, smooth, inout, out, wobble, texture, setStyle } from '../3d/core.js';
import { person, setPhoneScreen } from '../3d/people.js';
import { SETS } from '../3d/sets.js';
import '../3d/sets-outdoor.js';
import '../3d/map3d.js';

const FPS3D = 24;                       // animation-film frame rate (and a quarter less to render)
const HEAD = { stand: 1.6, walk: 1.6, sit: 1.22, row: 1.22, kneel: 1.18, lie: .3 };

T['reel-3d'] = (spec, timing) => {
  const W = 1080, H = 1920;
  setStyle(spec.style3d || 'lowpoly');   // before anything 3D is built
  const L = ground('dark', spec); stage.style.background = '#000';
  const r = getRenderer(stage);
  r.domElement.style.zIndex = '0';
  const cast = Object.fromEntries((spec.cast || []).map(c => [c.id, c]));

  /* ---- timeline: one shot per line (or hold) ---- */
  const shots = []; const segs = []; let at = 0, u = 0;
  spec.shots.forEach((s, i) => {
    const text = s.say || s.line; const lead = i === 0 ? .45 : .18;
    let end;
    if (text) {
      const tm = timing?.[u]; const dur = tm ? tm.dur : Math.max(1.4, text.length / 14);
      const seg = { text, start: at + lead, dur, words: tm?.words || null, by: s.by || null, shot: i };
      segs.push(seg); u++; end = seg.start + dur + .32;
    } else end = at + (s.hold || 2.2);
    shots.push({ ...s, i, start: at, end, seg: text ? segs[segs.length - 1] : null });
    at = end;
  });
  const endStart = at + .1; const duration = endStart + END;
  segs.forEach(sg => { sg.wordsAbs = wordTimes(sg); });

  /* ---- worlds: one per set + time + weather, actors created per world ---- */
  const worlds = new Map();
  const worldOf = s => {
    const key = `${s.set}|${s.time || ''}|${s.weather || ''}|${s.set === 'kaart' ? s.i : ''}`;
    if (!worlds.has(key)) {
      const def = SETS[s.set]; if (!def) throw new Error(`3D set "${s.set}" does not exist`);
      const layer = el('div', 'abs full'); css(layer, { zIndex: 3, pointerEvents: 'none', display: 'none' });   // a world's own HTML labels
      const w = def.build({ time: s.time, weather: s.weather, seed: spec.id + key, places: s.places, ctx, layer, shot: s });
      w.def = def; w.actors = {}; w.layer = layer; worlds.set(key, w);
      // a soft light from the camera, so faces always read (no shadow, cheap)
      w.camFill = new THREE.DirectionalLight('#fff4e6', def.camFill ?? .55); w.scene.add(w.camFill, w.camFill.target);
    }
    const w = worlds.get(key);
    for (const a of s.actors || []) if (!w.actors[a.id]) {
      const c = cast[a.id]; if (!c) throw new Error(`actor "${a.id}" is not in cast`);
      const p = person(c.look, { seed: spec.id + a.id }); p.root.visible = false; w.scene.add(p.root); w.actors[a.id] = p;
    }
    return w;
  };
  shots.forEach(s => { s.world = worldOf(s); });

  /* ---- overlays ---- */
  const vig = el('div', 'abs full'); css(vig, { background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.38))', zIndex: 2 });
  const hook = el('div', 'abs'); css(hook, { left: '80px', width: '920px', top: '230px', textAlign: 'center', color: '#fff', fontWeight: 800, fontSize: fit(spec.hook, [[22, 92], [36, 80], [60, 66]], 900) + 'px', lineHeight: 1.08, letterSpacing: '-1.5px', textWrap: 'balance', zIndex: 3,
    WebkitTextStroke: '10px rgba(8,14,18,.85)', paintOrder: 'stroke fill', textShadow: '0 10px 30px rgba(0,0,0,.4)' });
  hook.textContent = spec.hook;
  const label = el('div', 'abs'); css(label, { left: '64px', top: '1290px', padding: '14px 26px', borderRadius: '999px', background: 'rgba(10,16,20,.72)', color: '#fff', fontWeight: 600, fontSize: '34px', zIndex: 3, opacity: 0 });
  const cap = subtitles(segs, spec.captions || 'karaoke', { top: 1470 });
  document.querySelectorAll('.cap').forEach(c => { c.style.zIndex = 4; });
  // verse cards and app phones per shot
  shots.forEach(s => {
    if (s.verseData) {
      const card = el('div', 'abs'); css(card, { left: '90px', width: '900px', bottom: '520px', boxSizing: 'border-box', padding: '40px 46px', borderRadius: '30px', background: 'rgba(250,247,240,.95)', boxShadow: '0 24px 60px rgba(0,0,0,.35)', zIndex: 3, opacity: 0 });
      el('div', '', card, vref(s.verseData.ref)).style.cssText = 'font-weight:700;font-size:26px;letter-spacing:2px;color:var(--accent-dark);margin-bottom:18px';
      el('div', 'serif', card, esc(s.verseData.text)).style.cssText = `font-size:${s.verseData.text.length > 150 ? 36 : 42}px;line-height:1.38;color:#1f2933`;
      s.card = card;
    }
    if (s.app) { const ph = phone(stage, s.app, 560); css(ph.node, { left: '260px', top: '330px', zIndex: 3, opacity: 0, boxShadow: '0 40px 90px rgba(0,0,0,.55)' }); s.phone = ph; }
  });
  const fade = el('div', 'abs full'); css(fade, { background: '#000', opacity: 0, zIndex: 5 });
  const end = endCard(spec); document.querySelector('.end').style.zIndex = 6;

  /* ---- assets: app screenshots on the phones in the 3D world ---- */
  const ready = (async () => {
    const keys = [...new Set(shots.flatMap(s => [s.app, s.screen]).filter(Boolean).concat('01-start'))];
    const tex = Object.fromEntries(await Promise.all(keys.map(async k => [k, await texture(shotSrc(k))])));
    shots.forEach(s => { s.screenTex = tex[s.screen || s.app || '01-start']; });
    for (const w of worlds.values()) if (w.ready) await w.ready;
  })();

  const camera = new THREE.PerspectiveCamera(36, W / H, .05, 900);
  const shake = wobble(spec.id + 'cam');

  /* ---- actors per shot ---- */
  function actorsAt(s, t) {
    const def = s.world.def; const out = [];
    for (const a of s.actors || []) {
      const p = s.world.actors[a.id];
      const sp = def.spots[a.at]; if (!sp) throw new Error(`spot "${a.at}" is not in set ${s.set}`);
      let x = sp.p[0], z = sp.p[1], yaw = sp.yaw || 0, base = a.base || sp.base || 'stand', seat = sp.seat;
      let walk = null;
      if (a.to) {
        const to = def.spots[a.to]; if (!to) throw new Error(`spot "${a.to}" is not in set ${s.set}`);
        const dx = to.p[0] - x, dz = to.p[1] - z, dist = Math.hypot(dx, dz), dur = Math.max(.6, dist / 1.05);
        const k = prog(t, s.start + .1, s.start + .1 + dur);
        if (k < 1) { const e = smooth(k) * .15 + k * .85; x += dx * e; z += dz * e; yaw = Math.atan2(dx, dz); base = 'walk'; walk = { phase: (t - s.start) * 6.4, amount: Math.min(1, Math.min(k, 1 - k) * 8) }; }
        else { x = to.p[0]; z = to.p[1]; yaw = to.yaw || 0; base = a.base || to.base || 'stand'; seat = to.seat; }
      }
      const y = s.world.groundY ? s.world.groundY(x, z) : 0;
      out.push({ a, p, x, y, z, yaw, base, seat, walk });
    }
    return out;
  }
  const headOf = st => V(st.x, st.y + (HEAD[st.base] ?? 1.6), st.z);
  /** Where the face points: toward what the person looks at (the head turns), else the body's facing. */
  const faceDir = st => { if (st.look) { const d = st.look.clone().sub(headOf(st)); d.y = 0; if (d.lengthSq() > .01) { const f = fwd(st.yaw); return f.multiplyScalar(.35).add(d.normalize().multiplyScalar(.65)).normalize(); } } return fwd(st.yaw); };
  const GAZE_DOWN = ['read', 'scroll', 'phone', 'pray', 'sleep'];
  const fwd = yaw => V(Math.sin(yaw), 0, Math.cos(yaw));

  function mouth(sg, t) {
    if (!sg) return 0;
    const w = sg.wordsAbs.find(w => t >= w.a && t <= w.b + .02); if (!w) return 0;
    const syl = Math.max(1, Math.round(w.w.replace(/[^a-zA-Zà-ü]/g, '').length / 3)); const k = (t - w.a) / Math.max(.08, w.b - w.a);
    return .2 + .8 * Math.abs(Math.sin(k * Math.PI * syl));
  }

  /* ---- camera: a solver picks the angle and distance that frame the shot's people, per shot ---- */
  const VF = deg => Math.tan(deg * Math.PI / 360);
  /** Distance at which all points fit when looking at `focus` from direction `dir` (unit, xz), camera raised by `up`. */
  function fitDist(points, focus, dir, up, fov, mx = .8, my = .78) {
    const tv = VF(fov) * my, th = VF(fov) * (W / H) * mx;
    let lo = .4, hi = 40;
    const ok = d => {
      const cam = focus.clone().add(dir.clone().multiplyScalar(d)).add(V(0, up, 0));
      const fwdv = focus.clone().sub(cam).normalize(); const right = fwdv.clone().cross(V(0, 1, 0)).normalize(); const upv = right.clone().cross(fwdv);
      return points.every(p => { const v = p.clone().sub(cam); const z = v.dot(fwdv); if (z < .3) return false; return Math.abs(v.dot(right) / z) <= th && Math.abs(v.dot(upv) / z) <= tv; });
    };
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
    return hi;
  }
  const inBounds = (w, c) => !w.bounds || (c.x >= w.bounds.x[0] && c.x <= w.bounds.x[1] && c.z >= w.bounds.z[0] && c.z <= w.bounds.z[1]);
  /** Best camera for: points to fit, faces to see (states, weight), a preferred direction, a distance range. */
  function solve(w, { points, focus, faces = [], prefer = null, preferW = 1.6, up = .25, fov = 38, minD = .8, maxD = 12, others = [], fixedD = null }) {
    let best = null;
    for (let a = 0; a < 360; a += 7.5) {
      const r = a * Math.PI / 180, dir = V(Math.sin(r), 0, Math.cos(r));
      const d = fixedD ?? Math.min(maxD, Math.max(minD, fitDist(points, focus, dir, up, fov)));
      const cam = focus.clone().add(dir.clone().multiplyScalar(d)).add(V(0, up, 0));
      if (!inBounds(w, cam)) continue;
      let score = d * .35;
      for (const [st, wt] of faces) { const f = faceDir(st), to = cam.clone().sub(headOf(st)); to.y = 0; to.normalize(); const dot = f.dot(to); score += wt * (dot < .25 ? (.25 - dot) * 6 : 0) + wt * (1 - dot) * .8; }
      if (prefer) score += (1 - dir.dot(prefer)) * preferW;
      for (const o of others) { const h = headOf(o); const seg = focus.clone().sub(cam); const tt = clamp(h.clone().sub(cam).dot(seg) / seg.lengthSq()); const near = cam.clone().add(seg.multiplyScalar(tt)); if (h.distanceTo(near) < .3 && tt > .05 && tt < .95) score += 3; if (h.distanceTo(cam) < .85 || o.x != null && Math.hypot(o.x - cam.x, o.z - cam.z) < .7) score += 6; }
      if (!best || score < best.score) best = { score, dir, d, cam };
    }
    if (!best) {   // nothing fits inside the set: go as far back as the set allows, toward the preferred side
      const dir = prefer || V(0, 0, 1); let d = 1; while (d < 12 && inBounds(w, focus.clone().add(dir.clone().multiplyScalar(d + .1)))) d += .1;
      best = { dir, d, cam: focus.clone().add(dir.clone().multiplyScalar(d)).add(V(0, up, 0)) };
    }
    return best;
  }
  const plans = new Map();   // per shot: the solved framing (deterministic, from the shot's own data)
  function plan(s, states, type, on, other) {
    const key = s.i; if (plans.has(key)) return plans.get(key);
    const w = s.world; const wide = w.wide; const prefer = V(...wide.pos).sub(V(...wide.target)).setY(0).normalize();
    // positions at the start and end of the shot (walkers move): frame both
    const sA = actorsAt(s, s.start + .01), sB = actorsAt(s, s.end - .01); facing(s, sA); facing(s, sB);
    const pick = (list, id) => list.find(x => x.a.id === id);
    // frame where people end up (a walker may enter the frame; that reads naturally)
    const pts = (ids, from = .25, to = .9, wd = 0) => ids.flatMap(id => [sB].map(l => pick(l, id)).filter(Boolean).flatMap(st => { const h = headOf(st); const o = [h.clone().add(V(0, from, 0)), h.clone().add(V(0, -to, 0))]; if (wd) o.push(h.clone().add(V(wd, -.4, 0)), h.clone().add(V(-wd, -.4, 0)), h.clone().add(V(0, -.4, wd)), h.clone().add(V(0, -.4, -wd))); return o; }));
    let P = null;
    const ids = states.map(x => x.a.id);
    if (type === 'wide' || !on) {
      const points = ids.length ? pts(ids, .3, 1.65, .35) : [V(...wide.target)];
      const focus = ids.length ? points.reduce((a, b) => a.add(b), V()).multiplyScalar(1 / points.length) : V(...wide.target);
      const sol = solve(w, { points, focus, prefer, up: .55, fov: 44, minD: 3.2, faces: states.map(st => [st, .9]) });
      P = { focus, cam: sol.cam, fov: 44 };
    } else if (type === 'two-shot' && other) {
      const points = pts([on.a.id, other.a.id], .28, .75, .3); const focus = points.reduce((a, b) => a.add(b), V()).multiplyScalar(1 / points.length);
      const sol = solve(w, { points, focus, prefer, up: .22, fov: 40, minD: 1.8, faces: [[on, 1], [other, .8]] });
      P = { focus, cam: sol.cam, fov: 40 };
    } else if (type === 'over-shoulder' && other) {
      const hA = headOf(pick(sA, on.a.id)), hB = headOf(pick(sA, other.a.id)); const back = hB.clone().sub(hA).setY(0).normalize(); const sideV = V(-back.z, 0, back.x);
      const cands = [1, -1].map(sg => hB.clone().add(back.clone().multiplyScalar(.85)).add(sideV.clone().multiplyScalar(.5 * sg)).setY((hA.y + hB.y) / 2 + .18));
      const cam = cands.filter(c => inBounds(w, c)).sort((x, y) => x.distanceTo(V(...wide.pos)) - y.distanceTo(V(...wide.pos)))[0] || cands[0];
      P = { focus: hA.clone().add(V(0, -.12, 0)).lerp(hB, .18), cam, fov: 40 };
    } else {
      const st = pick(sA, on.a.id); const close = type === 'close' || type === 'phone';
      const points = pts([on.a.id], close ? .24 : .28, close ? .3 : .8);
      const focus = points.reduce((a, b) => a.add(b), V()).multiplyScalar(1 / points.length);
      const fov = close ? 34 : type === 'low' ? 42 : 36;
      const sol = solve(w, { points, focus, faces: [[st, 1.6]], prefer, preferW: .3, up: type === 'low' ? -.6 : type === 'top' ? 2.6 : close ? .02 : .15, fov, minD: close ? 1.95 : 2.1, others: states.filter(x => x.a.id !== on.a.id) });
      P = { focus, cam: sol.cam, fov, dir: sol.dir, d: sol.d };
    }
    if (window.__debug3d) console.log('plan', s.i, type, on?.a.id, JSON.stringify({ cam: P.cam.toArray().map(x => +x.toFixed(2)), focus: P.focus.toArray().map(x => +x.toFixed(2)), yaws: sA.map(x => [x.a.id, +x.yaw.toFixed(2), +x.x.toFixed(2), +x.z.toFixed(2)]) }));
    plans.set(key, P); return P;
  }

  function shoot(s, t, states) {
    const k = prog(t, s.start, s.end); const w = s.world;
    const byId = Object.fromEntries(states.map(st => [st.a.id, st]));
    const speaker = s.by && byId[s.by] ? byId[s.by] : null;
    const on = (s.on && byId[s.on]) || speaker || states[0] || null;
    const other = on && (states.find(st => st !== on && st.a.id === s.by) || states.find(st => st !== on));
    const type = s.camera || (states.length ? 'medium' : 'wide');
    const planType = type === 'push-in' ? 'medium' : type;
    let pos, target, fov;
    if (w.camera && (type === 'wide' || !on)) ({ pos, target, fov } = w.camera(t, s, k));
    else if (type === 'phone' && on) {
      on.p.root.updateMatrixWorld(true);
      const ph = on.p.props.phone; const pp = ph.getWorldPosition(V()); const q = ph.getWorldQuaternion(new THREE.Quaternion());
      const nrm = V(0, 0, 1).applyQuaternion(q); pos = pp.clone().add(nrm.multiplyScalar(.34 - .08 * inout(k))).add(V(0, .02, 0)); target = pp; fov = 34;
    } else if (type === 'follow' && on) {
      const head = headOf(on), f = fwd(on.yaw); pos = head.clone().add(f.clone().multiplyScalar(-2.4)).add(V(.8, .3, 0)); target = head.clone().add(f.clone().multiplyScalar(1.2)); fov = 40;
    } else {
      const P = plan(s, states, planType, on, other);
      pos = P.cam.clone(); target = P.focus.clone(); fov = P.fov;
      // motion inside the shot
      const toward = target.clone().sub(pos);
      if (type === 'push-in') { const e = inout(k), d0 = toward.length(); target.lerp(headOf(on).add(V(0, -.05, 0)), e * .8); pos = target.clone().add(pos.clone().sub(target).normalize().multiplyScalar(lerp(d0, 1.65, e))); fov = lerp(fov, 31, e); }
      else if (type === 'orbit') { const rel = pos.clone().sub(target); rel.applyAxisAngle(V(0, 1, 0), (.5 - inout(k)) * .9); pos = target.clone().add(rel); }
      else if (type === 'wide') pos.add(toward.clone().multiplyScalar(.08 * inout(k)));
      else pos.add(toward.clone().multiplyScalar(.05 * k));
    }
    if (w.bounds) { pos.x = clamp(pos.x, ...w.bounds.x); pos.z = clamp(pos.z, ...w.bounds.z); pos.y = clamp(pos.y, ...(w.bounds.y || [.3, 50])); }
    const hs = type === 'phone' ? .0015 : .01;
    pos.add(V(shake(t * .6) * hs, shake(t * .5 + 4) * hs, 0)); target.add(V(shake(t * .4 + 9) * hs * .6, shake(t * .45 + 2) * hs * .6, 0));
    camera.fov = fov; camera.updateProjectionMatrix(); camera.position.copy(pos); camera.lookAt(target);
  }

  /** Where each actor looks and which way they face (standing people turn to whom they look at). */
  function facing(s, states, t = null) {
    const sg = s.seg; const talkingNow = t == null ? true : sg && t >= sg.start - .05 && t <= sg.start + sg.dur + .05;
    for (const st of states) {
      const a = st.a; const speaking = !!(talkingNow && sg && sg.by === a.id);
      let look = null; const find = id => states.find(o => o.a.id === id);
      if (a.face === 'camera') look = t == null ? null : camera.position.clone();
      else if (!a.face && GAZE_DOWN.includes(a.do)) look = null;   // eyes on the book or phone
      else if (a.face && find(a.face)) look = headOf(find(a.face));
      else if (a.face && s.world.def.spots[a.face]) { const sp = s.world.def.spots[a.face]; look = V(sp.p[0], 1.4, sp.p[1]); }
      else if (sg?.by && sg.by !== a.id && find(sg.by)) look = headOf(find(sg.by));
      else if (sg?.by === a.id) { const o = states.find(o => o !== st); look = o ? headOf(o) : null; }
      st.look = look; st.speaking = speaking;
      if (look && st.base === 'stand' && !st.walk) { const d = look.clone().sub(V(st.x, 0, st.z)); st.yaw = Math.atan2(d.x, d.z); }
    }
    return states;
  }

  function render(t) {
    const i = Math.max(0, shots.findIndex(s => t >= s.start && t < s.end)); const s = t >= at ? shots[shots.length - 1] : shots[i];
    const w = s.world;
    for (const x of worlds.values()) x.layer.style.display = x === w ? 'block' : 'none';
    // actors: hide all in this world, show and pose the ones in the shot
    Object.values(w.actors).forEach(p => { p.root.visible = false; });
    const states = facing(s, actorsAt(s, Math.min(t, s.end)), t);
    const sg = s.seg;
    const poseAll = () => { for (const st of states) {
      const { p, a } = st; p.root.visible = true; p.root.position.set(st.x, st.y, st.z);
      p.root.rotation.y = st.yaw; p.root.updateMatrixWorld(true);
      if (s.screenTex && (a.do === 'phone' || a.do === 'show-phone')) setPhoneScreen(p, s.screenTex);
      p.pose(t, { base: st.base, action: st.walk ? 'idle' : (a.do || 'idle'), mood: a.mood, talking: st.speaking, talk: st.speaking ? mouth(sg, t) : 0, walk: st.walk, look: st.look, seat: st.seat });
      p.root.updateMatrixWorld(true);
    } };
    poseAll();
    if (w.update) w.update(t, s);
    shoot(s, t, states);
    // people who look into the camera: now that it is placed
    const atCam = states.filter(st => st.a.face === 'camera');
    if (atCam.length) { for (const st of atCam) { st.look = camera.position.clone(); if (st.base === 'stand' && !st.walk) { const d = st.look.clone().sub(V(st.x, 0, st.z)); st.yaw = Math.atan2(d.x, d.z); } } poseAll(); }
    w.camFill.position.copy(camera.position); w.camFill.target.position.copy(camera.position).add(camera.getWorldDirection(V()));
    if (w.overlay) w.overlay(t, s, camera);
    r.render(w.scene, camera);
    // overlays
    const hk = out(prog(t, .15, .5)) * (1 - prog(t, Math.min(3.0, shots[0].end - .2), Math.min(3.3, shots[0].end + .1)));
    set(hook, hk, (1 - hk) * 30, .94 + .06 * hk);
    const lk = s.text ? out(prog(t, s.start + .2, s.start + .55)) * (1 - prog(t, s.start + 2.8, s.start + 3.2)) : 0;
    if (s.text && label.textContent !== s.text) label.textContent = s.text;
    set(label, lk, (1 - lk) * 16);
    shots.forEach(x => {
      if (x.card) { const c0 = x.i === 0 ? Math.min(x.end - 1.2, 3.1) : x.start + .3; const v = x === s ? out(prog(t, c0, c0 + .4)) * (1 - prog(t, x.end - .3, x.end)) : 0; set(x.card, v, (1 - v) * 24); }
      if (x.phone) { const v = x === s ? out(prog(t, x.start + .25, x.start + .75)) * (1 - prog(t, x.end - .25, x.end)) : 0; set(x.phone.node, v, (1 - v) * 260); const img = x.phone.node.querySelector('img'); img.style.transform = `translateY(${-140 * smooth(prog(t, x.start + 1.2, x.end - .3))}px)`; }
    });
    // cut fades when the world changes
    let fd = 0; shots.forEach((x, j) => { if (j && x.world !== shots[j - 1].world) fd = Math.max(fd, 1 - Math.abs(t - x.start) / .18); });
    fade.style.opacity = clamp(fd);
    cap(t);
    end(t, endStart);
  }

  return { width: W, height: H, duration, fps: FPS3D, starts: segs.map(s => s.start), ready, render };
};
T['reel-3d'].units = spec => spec.shots.filter(s => s.say || s.line).map(s => ({ text: s.say || s.line, voice: s.by ? (spec.cast || []).find(c => c.id === s.by)?.voice : spec.voice }));
T['reel-3d'].voiced = spec => spec.shots.some(s => s.say || s.line);
