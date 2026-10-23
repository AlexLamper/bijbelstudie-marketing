// Original templates: daily verse still, verse reel, app demo reel, explainer reel, spotlight and statement posts.
// Loaded by stage.html after the helpers; every template registers itself on T[kind].

/* Daily verse still, 1080x1350 */
T['verse-still'] = spec => {
  const W = 1080, H = 1350;
  img(photoSrc(spec.photo), 'abs full photo'); el('div', 'abs full scrim');
  const box = el('div', 'abs'); css(box, { left: '110px', width: '860px', top: '0', height: H + 'px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: '#fff' });
  const text = spec.verse.text;
  el('div', '', box, esc(ctx.verse.eyebrow)).style.cssText = 'font-weight:700;font-size:26px;letter-spacing:4px;opacity:.82';
  el('div', 'serif', box, esc(text)).style.cssText = `margin-top:44px;font-size:${fit(text, [[80, 72], [140, 62], [220, 54], [320, 46], [999, 40]])}px;line-height:1.36`;
  el('div', '', box, vref(spec.verse.ref)).style.cssText = 'margin-top:44px;font-weight:700;font-size:28px;letter-spacing:3px;opacity:.9';
  const lock = el('div', 'abs'); css(lock, { left: 0, width: '100%', top: '1190px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '18px' });
  img(ctx.logos.iconOnDark, '', lock).style.height = '60px';
  img(ctx.logos.wordmarkOnDark, '', lock).style.height = '36px';
  return { width: W, height: H, duration: 0, render() {} };
};

/* Animated daily verse reel, 1080x1920. With a voice the phrases light up as they are read. */
T['reel-verse'] = (spec, timing) => {
  const W = 1080, H = 1920;
  const bg = img(photoSrc(spec.photo), 'abs full photo'); el('div', 'abs full scrim');
  const box = el('div', 'abs'); css(box, { left: '120px', width: '780px', top: '330px', height: '1260px', display: 'flex', flexDirection: 'column', justifyContent: 'center', color: '#fff' });
  const eyebrow = el('div', '', box, esc(ctx.verse.eyebrow)); eyebrow.style.cssText = 'font-weight:700;font-size:30px;letter-spacing:4px;opacity:.85';
  const text = spec.verse.text;
  const size = fit(text, [[80, 84], [140, 72], [220, 62], [320, 54], [999, 46]]);
  const vbox = el('div', 'serif', box); vbox.style.cssText = `margin-top:48px;font-size:${size}px;line-height:1.34`;
  const phrases = text.match(/[^,;:.!?]+[,;:.!?]*\s*/g) || [text];
  const spans = phrases.map(p => el('span', '', vbox, esc(p)));
  const refEl = el('div', '', box, vref(spec.verse.ref)); refEl.style.cssText = 'margin-top:48px;font-weight:700;font-size:32px;letter-spacing:3px';
  let starts, textEnd, voiceStarts = null;
  if (timing) {                                   // read aloud: each phrase lights up on its first spoken word
    const seg = layout([{ text, pause: .6 }], timing)[0]; const words = wordTimes(seg);
    let wi = 0; starts = phrases.map(p => { const n = p.trim().split(/\s+/).filter(Boolean).length; const a = (words[wi] || words[words.length - 1]).a - .15; wi += n; return a; });
    textEnd = seg.start + seg.dur; voiceStarts = [seg.start];
  } else {
    const per = Math.min(1.1, 4.2 / spans.length); starts = spans.map((_, i) => .9 + i * per); textEnd = .9 + spans.length * per;
  }
  const duration = Math.max(8, textEnd + 2.6) + END;
  const end = endCard(spec);
  return { width: W, height: H, duration, starts: voiceStarts, render(t) {
    bg.style.transform = `scale(${1 + .07 * (t / duration)})`;
    let q = out(prog(t, .2, .8)); set(eyebrow, q * .85, (1 - q) * 24);
    spans.forEach((s, i) => { const a = starts[i]; s.style.opacity = .12 + .88 * out(prog(t, a, a + .7)); });
    q = out(prog(t, textEnd, textEnd + .6)); set(refEl, q, (1 - q) * 20);
    end(t, duration - END);
  } };
};
T['reel-verse'].units = spec => [{ text: spec.verse.text, pause: .6 }];

/* App demo reel: hook, 2-5 phone scenes, end card. Looks: light (default) or dark. */
T['reel-demo'] = spec => {
  const W = 1080, H = 1920; const HOOK = 2.0, SCENE = 2.7;
  const L = ground(spec.style === 'dark' ? 'dark' : 'light', spec);
  const hook = el('div', 'abs serif'); css(hook, { left: '96px', width: '800px', top: '700px', fontWeight: 600, fontSize: fit(spec.hook, [[30, 96], [50, 84], [999, 72]]) + 'px', lineHeight: 1.08, letterSpacing: '-1px', color: L.ink });
  el('div', '', hook).style.cssText = 'width:124px;height:8px;border-radius:4px;background:var(--accent);margin-bottom:52px';
  el('div', '', hook, esc(spec.hook));
  const scenes = spec.scenes.map((s, i) => {
    const cap = el('div', 'abs'); css(cap, { left: '96px', width: '820px', top: '290px', fontWeight: 700, fontSize: fit(s.caption, [[28, 66], [48, 58], [999, 50]]) + 'px', lineHeight: 1.1, letterSpacing: '-1.2px', color: L.ink });
    cap.innerHTML = esc(s.caption);
    const ph = phone(stage, s.screenshot, 600); css(ph.node, { left: '240px', top: '560px' });
    if (L.dark) ph.node.style.boxShadow = '0 0 0 3px rgba(255,255,255,.16), 0 40px 80px -20px rgba(0,0,0,.6)';
    return { cap, ph: ph.node };
  });
  const duration = HOOK + scenes.length * SCENE + END;
  const end = endCard(spec);
  return { width: W, height: H, duration, render(t) {
    const r = out(prog(t, .05, .4)); hook.firstChild.style.width = 124 * r + 'px';
    const q = out(prog(t, .1, .55)); const x = inout(prog(t, HOOK - .35, HOOK));
    set(hook, q * (1 - x), (1 - q) * 40 - 80 * x);
    scenes.forEach((s, i) => {
      const a = HOOK + i * SCENE, b = a + SCENE;
      const inP = out(prog(t, a - .3, a + .35)), outP = inout(prog(t, b - .3, b));
      const last = i === scenes.length - 1;
      const o = inP * (last ? 1 : 1 - outP);
      set(s.cap, o, (1 - inP) * 30);
      set(s.ph, inP > 0 ? (last ? 1 : 1 - outP) : 0, (1 - inP) * (i === 0 ? 1100 : 60), .97 + .03 * inP + .02 * inout(prog(t, a, b)), last ? 0 : -60 * outP);
    });
    end(t, duration - END);
  } };
};

/* Voiceover explainer: spoken hook + lines with verse/screen/text visuals and burned-in subtitles.
   Looks: light (default), dark, photo. Subtitles: block (default), karaoke, none. */
T['reel-explainer'] = (spec, timing) => {
  const W = 1080, H = 1920;
  const L = ground(spec.style || 'light', spec);
  const segs = layout(T['reel-explainer'].units(spec), timing).map((s, i) => ({ ...s, ...(i ? spec.lines[i - 1] : { hook: true }) }));
  const talkEnd = endOf(segs) + .25;
  const duration = talkEnd + .4 + END;
  const visuals = segs.map(s => {
    const v = el('div', 'abs full'); v.style.opacity = 0;
    if (s.hook) {
      const h = el('div', 'serif', v, esc(s.text)); h.style.cssText = `position:absolute;left:96px;width:830px;top:560px;font-weight:600;font-size:${fit(s.text, [[30, 96], [55, 84], [999, 70]])}px;line-height:1.08;letter-spacing:-1px;color:${L.ink}`;
      s.noCap = true;
    } else if (s.verseData) {
      const card = el('div', '', v); card.style.cssText = `position:absolute;left:96px;width:830px;top:430px;background:${L.card};border-radius:28px;padding:56px 56px 60px;box-sizing:border-box`;
      el('div', '', card, vref(s.verseData.ref)).style.cssText = `font-weight:700;font-size:28px;letter-spacing:3px;color:${L.accentText}`;
      el('div', 'serif', card, esc(s.verseData.text)).style.cssText = `margin-top:28px;font-size:${fit(s.verseData.text, [[90, 60], [180, 50], [300, 42], [999, 36]], 718)}px;line-height:1.4;color:${L.ink}`;
    } else if (s.screenshot) {
      const ph = phone(v, s.screenshot, 500); css(ph.node, { left: '290px', top: '260px' }); // ends ~1345px, clear of the subtitles at 1430px
      if (L.dark) ph.node.style.boxShadow = '0 0 0 3px rgba(255,255,255,.16)';
    } else {
      const h = el('div', '', v, esc(s.text)); h.style.cssText = `position:absolute;left:96px;width:830px;top:640px;font-weight:700;font-size:${fit(s.text, [[60, 76], [110, 64], [999, 54]])}px;line-height:1.12;letter-spacing:-1.2px;color:${L.ink}`;
      s.noCap = true;
    }
    return v;
  });
  const subs = subtitles(segs, spec.captions || 'block');
  const end = endCard(spec);
  return { width: W, height: H, duration, starts: segs.map(s => s.start), render(t) {
    drift(L, t, duration);
    segs.forEach((s, i) => {
      const next = segs[i + 1]; const until = next ? next.start : talkEnd + .4;
      const q = out(prog(t, s.start - .25, s.start + .2)) * (1 - inout(prog(t, until - .25, until)));
      set(visuals[i], i === segs.length - 1 ? out(prog(t, s.start - .25, s.start + .2)) : q, (1 - out(prog(t, s.start - .25, s.start + .2))) * 30, 1 + .02 * prog(t, s.start, until));
    });
    subs(t);
    end(t, duration - END);
  } };
};
T['reel-explainer'].units = spec => [{ text: spec.hook }, ...spec.lines.map(l => ({ text: l.say }))];

/* Feature spotlight post, 1080x1350 */
T['post-spotlight'] = spec => {
  const W = 1080, H = 1350;
  const lock = el('div', 'abs'); css(lock, { left: '96px', top: '86px', display: 'flex', alignItems: 'center', gap: '16px' });
  img(ctx.logos.full, '', lock).style.height = '50px';
  const h = el('div', 'abs', null, esc(spec.headline)); css(h, { left: '96px', width: '888px', top: '196px', fontWeight: 700, fontSize: fit(spec.headline, [[28, 76], [48, 66], [999, 58]]) + 'px', lineHeight: 1.08, letterSpacing: '-1.5px', color: 'var(--ink)' });
  const s = el('div', 'abs', null, esc(spec.sub)); css(s, { left: '96px', width: '860px', top: '0', fontSize: '36px', lineHeight: 1.4, color: 'var(--ink-body)' });
  const ph = phone(stage, spec.screenshot, 560); css(ph.node, { left: '260px', top: '560px' });
  return { width: W, height: H, duration: 0, render() { s.style.top = (h.offsetTop + h.offsetHeight + 24) + 'px'; } };
};

/* One-line statement post, 1080x1350 */
T['post-statement'] = spec => {
  const W = 1080, H = 1350;
  stage.style.background = 'var(--surface)';
  const box = el('div', 'abs'); css(box, { left: '96px', width: '860px', top: '0', height: '1150px', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
  el('div', '', box).style.cssText = 'width:124px;height:8px;border-radius:4px;background:var(--accent);margin-bottom:56px';
  el('div', 'serif', box, esc(spec.line)).style.cssText = `font-weight:600;font-size:${fit(spec.line, [[40, 96], [70, 82], [999, 68]])}px;line-height:1.1;letter-spacing:-1px;color:var(--ink)`;
  if (spec.sub) el('div', '', box, esc(spec.sub)).style.cssText = 'margin-top:44px;font-size:38px;line-height:1.4;color:var(--accent-dark);font-weight:600';
  const lock = el('div', 'abs'); css(lock, { left: '96px', top: '1176px' });
  img(ctx.logos.full, '', lock).style.height = '56px';
  return { width: W, height: H, duration: 0, render() {} };
};

