// Test formats: kinetic text reel, quiz reel, list reel, carousel (posts).
// Every reel works silent (estimated pacing) and voiced (words land on the spoken beat).

/* Small pieces shared by these templates */
const words = s => String(s).split(/\s+/).filter(Boolean);
/** Spread word reveal times over [a, b] when there is no voice. */
const spreadWords = (text, a, b) => { const ws = words(text); const per = (b - a) / Math.max(1, ws.length); return ws.map((w, i) => ({ w, a: a + i * per, b: a + (i + 1) * per })); };
/** Hook block used by several reels: accent bar + Lora line. */
function hookBlock(text, L, top = 640) {
  const h = el('div', 'abs serif'); css(h, { left: '96px', width: '820px', top: top + 'px', fontWeight: 600, fontSize: fit(text, [[30, 100], [55, 86], [999, 72]], 820) + 'px', lineHeight: 1.08, letterSpacing: '-1px', color: L.ink });
  const bar = el('div', '', h); bar.style.cssText = 'width:124px;height:8px;border-radius:4px;background:var(--accent);margin-bottom:52px';
  el('div', '', h, esc(text));
  return { node: h, bar };
}
function verseCard(parent, vd, L, { left = 96, top = 0, width = 830, size } = {}) {
  const card = el('div', 'abs', parent); css(card, { left: left + 'px', top: top + 'px', width: width + 'px', background: L.card, borderRadius: '28px', padding: '44px 48px 48px', boxSizing: 'border-box' });
  el('div', '', card, vref(vd.ref)).style.cssText = `font-weight:700;font-size:26px;letter-spacing:3px;color:${L.accentText}`;
  el('div', 'serif', card, esc(vd.text)).style.cssText = `margin-top:22px;font-size:${size || fit(vd.text, [[90, 50], [180, 42], [300, 36], [999, 32]], width - 96)}px;line-height:1.4;color:${L.ink}`;
  return card;
}

/* ---------- reel-kinetic: big words, line by line ---------- */
T['reel-kinetic'] = (spec, timing) => {
  const W = 1080, H = 1920;
  const L = ground(spec.style || 'dark', spec);
  const silentDur = text => Math.max(1.9, words(text).length * .34 + 1.1);
  const units = [{ text: spec.hook, dur: 2.2 }, ...spec.lines.map(l => ({ text: l.text, dur: silentDur(l.text) }))];
  const segs = layout(units, timing);
  const talkEnd = endOf(segs) + .45;
  const duration = talkEnd + .3 + END;
  const hook = hookBlock(spec.hook, L, 660);
  const beats = spec.lines.map((l, i) => {
    const seg = segs[i + 1];
    const box = el('div', 'abs'); css(box, { left: '96px', width: '830px', top: '0px', color: L.ink });
    const size = fit(l.text, [[24, 116], [44, 100], [70, 86], [100, 74], [999, 64]], 830);
    const line = el('div', '', box); css(line, { fontWeight: 800, fontSize: size + 'px', lineHeight: 1.06, letterSpacing: '-2px' });
    const emph = (l.emphasis || '').toLowerCase().split(/\s+/).filter(Boolean);
    const times = seg.words ? wordTimes(seg) : spreadWords(l.text, seg.start, seg.start + Math.min(seg.dur * .7, words(l.text).length * .3));
    const spans = words(l.text).map((w, j) => {
      const s = el('span', '', line, esc(w) + ' '); s.style.display = 'inline-block'; s.style.whiteSpace = 'pre';
      const bare = w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '');
      if (emph.includes(bare)) s.style.color = L.dark ? 'var(--accent-soft)' : 'var(--accent-dark)';
      return { s, a: (times[j] || times[times.length - 1]).a };
    });
    let card = null;
    if (l.verseData) { card = verseCard(box, l.verseData, L, { left: 0, top: 0, width: 830 }); card.style.position = 'relative'; card.style.marginTop = '56px'; }
    return { box, spans, card, seg };
  });
  // vertically centre each beat in the safe area
  const place = () => beats.forEach(b => { const h = b.box.offsetHeight; b.box.style.top = Math.max(300, Math.round(1000 - h / 2)) + 'px'; });
  const end = endCard(spec);
  return { width: W, height: H, duration, starts: segs.map(s => s.start), render(t) {
    if (!beats[0].placed) { place(); beats[0].placed = true; }
    drift(L, t, duration);
    const h0 = out(prog(t, .1, .55)), hx = inout(prog(t, segs[1].start - .35, segs[1].start));
    hook.bar.style.width = 124 * out(prog(t, .05, .45)) + 'px';
    set(hook.node, h0 * (1 - hx), (1 - h0) * 40 - 90 * hx);
    beats.forEach((b, i) => {
      const next = beats[i + 1]; const leave = next ? next.seg.start : 1e9;
      const x = inout(prog(t, leave - .3, leave));
      const vis = t >= b.seg.start - .3 && t < leave + .05;
      b.box.style.opacity = vis ? 1 - x : 0; b.box.style.transform = `translateY(${-70 * x}px)`;
      if (!vis) return;
      b.spans.forEach(({ s, a }) => { const q = out(prog(t, a - .08, a + .22)); s.style.opacity = q; s.style.transform = `translateY(${(1 - q) * 26}px) scale(${1.12 - .12 * q})`; });
      if (b.card) { const a = b.spans[b.spans.length - 1].a + .3; const q = out(prog(t, a, a + .45)); set(b.card, q, (1 - q) * 30); }
    });
    end(t, duration - END);
  } };
};
T['reel-kinetic'].units = spec => [{ text: spec.hook }, ...spec.lines.map(l => ({ text: l.text }))];

/* ---------- reel-quiz: question, options, countdown, answer, explanation ---------- */
T['reel-quiz'] = (spec, timing) => {
  const W = 1080, H = 1920; const COUNT = 3;
  const L = ground(spec.style || 'light', spec);
  const letters = ['A', 'B', 'C', 'D'];
  const answerLine = `Het antwoord is ${letters[spec.answer]}: ${spec.options[spec.answer]}.`;
  const units = [{ text: spec.question }, { text: answerLine, pause: COUNT + .9 }, { text: spec.explain }];
  const segs = layout(units, timing);
  const [qSeg, aSeg, eSeg] = segs;
  const optStart = qSeg.start + Math.min(qSeg.dur, 2.2) + .1;                  // options show while the question is still read
  const countStart = aSeg.start - COUNT - .5;
  const reveal = aSeg.start - .1;
  const talkEnd = endOf(segs) + .9;
  const duration = talkEnd + END;
  // eyebrow + question
  const top = el('div', 'abs'); css(top, { left: '96px', width: '830px', top: '300px' });
  const chip = el('div', '', top, 'BIJBELQUIZ'); chip.style.cssText = `display:inline-block;font-weight:700;font-size:26px;letter-spacing:4px;color:${L.dark ? 'var(--panel)' : '#fff'};background:${L.dark ? 'var(--accent-soft)' : 'var(--accent-dark)'};padding:12px 22px;border-radius:12px`;
  const q = el('div', 'serif', top, esc(spec.question)); q.style.cssText = `margin-top:40px;font-weight:600;font-size:${fit(spec.question, [[50, 88], [85, 76], [999, 64]], 830)}px;line-height:1.12;letter-spacing:-.8px;color:${L.ink}`;
  // options
  const opts = spec.options.map((o, i) => {
    const b = el('div', 'abs'); css(b, { left: '96px', width: '830px', height: '150px', boxSizing: 'border-box', borderRadius: '26px', display: 'flex', alignItems: 'center', gap: '28px', padding: '0 34px',
      background: L.dark ? 'rgba(255,255,255,.08)' : 'var(--surface)', border: `3px solid ${L.dark ? 'rgba(255,255,255,.2)' : 'var(--line)'}`, boxShadow: L.dark ? 'none' : '0 10px 30px -18px rgba(17,24,39,.35)' });
    const badge = el('div', '', b, letters[i]); badge.style.cssText = `flex:none;width:86px;height:86px;border-radius:20px;display:grid;place-items:center;font-weight:800;font-size:44px;background:${L.dark ? 'rgba(255,255,255,.12)' : 'var(--background)'};color:${L.ink}`;
    const txt = el('div', '', b, esc(o)); txt.style.cssText = `font-weight:700;font-size:${fit(o, [[22, 56], [40, 48], [999, 40]], 620)}px;line-height:1.1;color:${L.ink}`;
    return { b, badge, txt };
  });
  // countdown ring
  const ring = el('div', 'abs'); css(ring, { left: '460px', width: '160px', height: '160px' });
  ring.innerHTML = `<svg viewBox="0 0 160 160" width="160" height="160"><circle cx="80" cy="80" r="68" fill="${L.dark ? 'rgba(255,255,255,.06)' : 'var(--surface)'}" stroke="${L.dark ? 'rgba(255,255,255,.18)' : 'var(--line)'}" stroke-width="10"/><circle class="arc" cx="80" cy="80" r="68" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" transform="rotate(-90 80 80)" stroke-dasharray="427.3" stroke-dashoffset="0"/></svg><div class="num" style="position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:72px;color:${L.ink}">3</div>`;
  const arc = ring.querySelector('.arc'), num = ring.querySelector('.num');
  // explanation (+ verse)
  const ex = el('div', 'abs'); css(ex, { left: '96px', width: '830px', top: '0px' });
  const exText = el('div', '', ex, esc(spec.explain)); exText.style.cssText = `font-size:${fit(spec.explain, [[90, 56], [150, 50], [999, 44]], 830)}px;line-height:1.35;color:${L.body};font-weight:500`;
  if (spec.verseData) { const c = verseCard(ex, spec.verseData, L, { left: 0, top: 0, width: 830 }); c.style.position = 'relative'; c.style.marginTop = '40px'; }
  const ask = el('div', 'abs', null, 'Wist jij het? Zet je antwoord in de reacties.'); css(ask, { left: '96px', width: '830px', top: '1300px', fontWeight: 700, fontSize: '44px', lineHeight: 1.25, color: L.accentText });
  let laid = false;
  const end = endCard(spec);
  return { width: W, height: H, duration, starts: segs.map(s => s.start), render(t) {
    if (!laid) {                                          // positions depend on the question's real height
      const blockH = top.offsetHeight + 64 + opts.length * 176 + 200;           // centre the quiz block in the safe area
      const y0 = Math.max(290, Math.round(940 - blockH / 2)); top.style.top = y0 + 'px';
      const qBottom = y0 + top.offsetHeight + 64;
      opts.forEach((o, i) => { o.y = qBottom + i * 176; o.b.style.top = o.y + 'px'; });
      ring.style.top = Math.min(1460, qBottom + opts.length * 176 + 24) + 'px';
      laid = true;
    }
    drift(L, t, duration);
    let k = out(prog(t, .1, .5)); set(top, k, (1 - k) * 30);
    const exIn = out(prog(t, eSeg.start - .3, eSeg.start + .3));
    opts.forEach((o, i) => {
      const a = optStart + i * .22; const q2 = out(prog(t, a, a + .35));
      const right = i === spec.answer; const r = out(prog(t, reveal, reveal + .35));
      const fadeWrong = right ? 1 : 1 - .72 * r;
      const leave = right ? 0 : exIn;                     // wrong options make room for the explanation
      set(o.b, q2 * fadeWrong * (1 - leave), (1 - q2) * 40 + (right ? (opts[0].y - o.y) * exIn : 0), 1 + (right ? .03 * Math.sin(Math.PI * prog(t, reveal, reveal + .6)) : 0));
      if (right && r > 0) { o.b.style.background = 'var(--accent)'; o.b.style.borderColor = 'var(--accent)'; o.txt.style.color = '#fff'; o.badge.style.background = 'rgba(255,255,255,.22)'; o.badge.style.color = '#fff'; o.badge.textContent = '✓'; }
      else if (right) { o.b.style.background = L.dark ? 'rgba(255,255,255,.08)' : 'var(--surface)'; o.b.style.borderColor = L.dark ? 'rgba(255,255,255,.2)' : 'var(--line)'; o.txt.style.color = L.ink; o.badge.style.background = L.dark ? 'rgba(255,255,255,.12)' : 'var(--background)'; o.badge.style.color = L.ink; o.badge.textContent = letters[i]; }
    });
    // countdown: 3 - 2 - 1 over COUNT seconds
    const c = prog(t, countStart, countStart + COUNT); const ringIn = out(prog(t, countStart - .4, countStart)) * (1 - out(prog(t, reveal - .1, reveal + .25)));
    set(ring, ringIn, 0, .8 + .2 * ringIn);
    arc.setAttribute('stroke-dashoffset', String(427.3 * c));
    num.textContent = String(Math.max(1, COUNT - Math.floor(c * COUNT)));
    // explanation under the right answer
    ex.style.top = (opts[0].y + 196) + 'px';
    set(ex, exIn, (1 - exIn) * 30);
    k = out(prog(t, eSeg.start + 1.2, eSeg.start + 1.7)); set(ask, k, (1 - k) * 20);
    ask.style.top = Math.min(1600, ex.offsetTop + ex.offsetHeight + 50) + 'px';
    end(t, duration - END);
  } };
};
T['reel-quiz'].units = spec => {
  const letters = ['A', 'B', 'C', 'D'];
  return [{ text: spec.question }, { text: `Het antwoord is ${letters[spec.answer]}: ${spec.options[spec.answer]}.`, pause: 3.9 }, { text: spec.explain }];
};

/* ---------- reel-list: "5 dingen ..." ---------- */
T['reel-list'] = (spec, timing) => {
  const W = 1080, H = 1920;
  const L = ground(spec.style || 'light', spec);
  const spoken = it => it.say || [it.title, it.text].filter(Boolean).join('. ');
  const units = [{ text: spec.hook, dur: 2.4 }, ...spec.items.map(it => ({ text: spoken(it), dur: Math.max(2.8, est(spoken(it)) * .9) }))];
  const segs = layout(units, timing);
  segs[0].noCap = true;
  spec.items.forEach((it, i) => { if (!it.say) segs[i + 1].noCap = true; });      // title on screen = no subtitles needed
  const talkEnd = endOf(segs) + .45;
  const duration = talkEnd + .3 + END;
  const hook = hookBlock(spec.hook, L, 640);
  // progress pills
  const dots = el('div', 'abs'); css(dots, { left: '96px', top: '270px', display: 'flex', gap: '12px' });
  const pills = spec.items.map(() => { const p = el('div', '', dots); p.style.cssText = `width:${Math.min(110, Math.floor(780 / spec.items.length) - 12)}px;height:10px;border-radius:5px;background:${L.dark ? 'rgba(255,255,255,.18)' : 'var(--line)'};overflow:hidden`; const f = el('div', '', p); f.style.cssText = 'height:100%;width:0;background:var(--accent)'; return f; });
  const cards = spec.items.map((it, i) => {
    const box = el('div', 'abs'); css(box, { left: '96px', width: '830px', top: '360px' });
    const n = el('div', '', box, String(i + 1)); n.style.cssText = `font-weight:800;font-size:220px;line-height:.9;letter-spacing:-8px;color:${L.dark ? 'var(--accent-soft)' : 'var(--accent)'}`;
    const ti = el('div', '', box, esc(it.title)); ti.style.cssText = `margin-top:34px;font-weight:700;font-size:${fit(it.title, [[24, 82], [44, 70], [999, 60]], 830)}px;line-height:1.08;letter-spacing:-1.5px;color:${L.ink}`;
    let tx = null; if (it.text) { tx = el('div', '', box, esc(it.text)); tx.style.cssText = `margin-top:26px;font-size:42px;line-height:1.38;color:${L.body}`; }
    let media = null;
    if (it.verseData) { media = verseCard(box, it.verseData, L, { left: 0, top: 0, width: 830 }); media.style.position = 'relative'; media.style.marginTop = '40px'; }
    else if (it.screenshot) { const ph = phone(box, it.screenshot, 380); css(ph.node, { position: 'relative', left: '0px', top: '0px', marginTop: '40px', height: '520px', overflow: 'hidden', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }); media = ph.node; }
    return { box, n, ti, tx, media, seg: segs[i + 1] };
  });
  const subs = subtitles(segs, spec.captions || 'block');
  const end = endCard(spec);
  return { width: W, height: H, duration, starts: segs.map(s => s.start), render(t) {
    drift(L, t, duration);
    const first = cards[0].seg.start;
    const h0 = out(prog(t, .1, .55)), hx = inout(prog(t, first - .35, first));
    hook.bar.style.width = 124 * out(prog(t, .05, .45)) + 'px';
    set(hook.node, h0 * (1 - hx), (1 - h0) * 40 - 90 * hx);
    set(dots, out(prog(t, first - .3, first)) * (1 - out(prog(t, talkEnd, talkEnd + .3))), 0);
    cards.forEach((c, i) => {
      const a = c.seg.start, next = cards[i + 1]?.seg.start ?? talkEnd + .3;
      pills[i].style.width = (100 * prog(t, a, next)) + '%';
      const inP = out(prog(t, a - .3, a + .25)), outP = inout(prog(t, next - .3, next));
      c.box.style.opacity = inP * (1 - outP); c.box.style.transform = `translateX(${(1 - inP) * 120 - outP * 120}px)`;
      const ns = out(prog(t, a - .2, a + .35)); c.n.style.transform = `scale(${.6 + .4 * ns})`; c.n.style.transformOrigin = 'left bottom';
      const k = out(prog(t, a + .15, a + .55)); set(c.ti, k, (1 - k) * 24);
      if (c.tx) { const k2 = out(prog(t, a + .45, a + .85)); set(c.tx, k2, (1 - k2) * 20); }
      if (c.media) { const k3 = out(prog(t, a + .7, a + 1.1)); set(c.media, k3, (1 - k3) * 40); }
    });
    subs(t);
    end(t, duration - END);
  } };
};
T['reel-list'].units = spec => [{ text: spec.hook }, ...spec.items.map(it => ({ text: it.say || [it.title, it.text].filter(Boolean).join('. ') }))];

/* ---------- carousel: 1080x1350 slides + CTA slide ---------- */
T['carousel'] = spec => {
  const W = 1080, H = 1350;
  const look = spec.style || 'light';
  const total = spec.slides.length + 1;
  const pages = [];
  let pointNo = 0;
  const frame = (i, L) => {                               // slide chrome: logo, counter, progress
    const pg = el('div', 'abs full'); pg.style.display = 'none';
    pg.style.background = L.dark ? (look === 'photo' ? '#0b1215' : 'var(--panel)') : 'var(--surface)';
    const head = el('div', 'abs', pg); css(head, { left: '96px', top: '78px' }); lockup(head, L, 48);
    const cnt = el('div', 'abs', pg, `${i + 1}/${total}`); css(cnt, { right: '96px', top: '86px', fontWeight: 700, fontSize: '28px', color: L.muted, letterSpacing: '1px' });
    const bar = el('div', 'abs', pg); css(bar, { left: '96px', right: '96px', bottom: '72px', height: '8px', borderRadius: '4px', background: L.line });
    const fill = el('div', '', bar); fill.style.cssText = `height:100%;border-radius:4px;background:var(--accent);width:${100 * (i + 1) / total}%`;
    return pg;
  };
  const Ldark = LOOKS.dark, Llight = LOOKS.light;
  spec.slides.forEach((s, i) => {
    const L = (look === 'light') ? Llight : Ldark;
    if (s.type === 'cover') {
      const usePhoto = look === 'photo' || s.photo;
      const Lc = usePhoto ? LOOKS.photo : L;
      const pg = frame(i, Lc);
      if (usePhoto) { const p = img(photoSrc(s.photo || hashNo(spec.id, ctx.photoCount || 365)), 'abs full photo', pg); pg.insertBefore(p, pg.firstChild); const sc = el('div', 'abs full scrim', pg); pg.insertBefore(sc, p.nextSibling); }
      const box = el('div', 'abs', pg); css(box, { left: '96px', width: '860px', top: '0px', height: '1100px', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
      el('div', '', box).style.cssText = 'width:124px;height:8px;border-radius:4px;background:var(--accent);margin-bottom:48px';
      el('div', 'serif', box, esc(s.title)).style.cssText = `font-weight:600;font-size:${fit(s.title, [[30, 104], [55, 88], [999, 74]], 860)}px;line-height:1.06;letter-spacing:-1.2px;color:${Lc.ink}`;
      if (s.sub) el('div', '', box, esc(s.sub)).style.cssText = `margin-top:36px;font-size:40px;line-height:1.38;color:${Lc.body}`;
      const sw = el('div', 'abs', pg, 'Swipe &rarr;'); css(sw, { right: '96px', bottom: '110px', fontWeight: 700, fontSize: '32px', color: Lc.accentText });
      pages.push(pg); return;
    }
    const pg = frame(i, L);
    const box = el('div', 'abs', pg); css(box, s.type === 'screen' ? { left: '96px', width: '888px', top: '200px' } : { left: '96px', width: '888px', top: '200px', bottom: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
    if (s.type === 'text') {
      if (s.title) el('div', '', box, esc(s.title)).style.cssText = `font-weight:700;font-size:${fit(s.title, [[28, 66], [999, 56]], 888)}px;line-height:1.1;letter-spacing:-1.4px;color:${L.ink};margin-bottom:34px`;
      el('div', '', box, esc(s.text)).style.cssText = `font-size:${fit(s.text, [[120, 50], [200, 44], [999, 40]], 888)}px;line-height:1.42;color:${L.body}`;
    } else if (s.type === 'point') {
      pointNo++;
      el('div', '', box, String(pointNo)).style.cssText = `font-weight:800;font-size:150px;line-height:.9;letter-spacing:-6px;color:${L.dark ? 'var(--accent-soft)' : 'var(--accent)'}`;
      el('div', '', box, esc(s.title)).style.cssText = `margin-top:30px;font-weight:700;font-size:${fit(s.title, [[26, 76], [46, 66], [999, 56]], 888)}px;line-height:1.08;letter-spacing:-1.5px;color:${L.ink}`;
      if (s.text) el('div', '', box, esc(s.text)).style.cssText = `margin-top:28px;font-size:${fit(s.text, [[120, 44], [999, 40]], 888)}px;line-height:1.42;color:${L.body}`;
    } else if (s.type === 'verse') {
      const c = verseCard(box, s.verseData, L, { left: 0, top: 0, width: 888, size: fit(s.verseData.text, [[90, 58], [180, 50], [300, 44], [999, 38]], 790) }); c.style.position = 'relative';
      if (s.note) el('div', '', box, esc(s.note)).style.cssText = `margin-top:36px;font-size:38px;line-height:1.4;color:${L.body}`;
    } else if (s.type === 'screen') {
      el('div', '', box, esc(s.title)).style.cssText = `font-weight:700;font-size:${fit(s.title, [[28, 62], [999, 54]], 888)}px;line-height:1.08;letter-spacing:-1.4px;color:${L.ink}`;
      if (s.text) el('div', '', box, esc(s.text)).style.cssText = `margin-top:20px;font-size:36px;line-height:1.38;color:${L.body}`;
      const ph = phone(pg, s.screenshot, 520); css(ph.node, { left: '280px', top: '0px' }); ph.node.dataset.after = '1';
      if (L.dark) ph.node.style.boxShadow = '0 0 0 3px rgba(255,255,255,.16)';
      pg._phone = { node: ph.node, box };
    }
    pages.push(pg);
  });
  // CTA slide: the end card, static
  const ctaPage = el('div', 'abs full'); ctaPage.style.display = 'none'; pages.push(ctaPage);
  const endNode = (() => { const before = stage.children.length; const r = endCard(spec, 175); const node = stage.children[before]; ctaPage.appendChild(node); return { r }; })();
  return { width: W, height: H, duration: 0, slides: pages.length, showSlide(i) {
    pages.forEach((p, j) => { p.style.display = j === i ? 'block' : 'none'; });
    const p = pages[i];
    if (p._phone) { const y = p._phone.box.offsetTop + p._phone.box.offsetHeight + 56; p._phone.node.style.top = y + 'px'; p.style.overflow = 'hidden'; }
    if (p === ctaPage) endNode.r(99, 0);
  }, render() { this.showSlide(0); } };
};
