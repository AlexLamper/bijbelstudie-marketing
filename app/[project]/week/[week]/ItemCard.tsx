'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Pill } from '@/components/ui';
import { toast } from '@/components/Toast';
import { KIND, PLATFORM, STATUS, traitValue } from '@/lib/labels';
import { DEFAULT_TZ } from '@/lib/postingSlots';

// No dates on cards: approved items wait on the pile and go out by themselves (lib/postingSlots.ts).

export default function ItemCard({ project, item, tz = DEFAULT_TZ }: { project: string; item: any; tz?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(item.spec.caption || '');
  const [tags, setTags] = useState((item.spec.hashtags || []).join(' '));
  const [slide, setSlide] = useState(0);
  const s = item.spec; const video = item.kind.startsWith('reel-');
  const slides: string[] = item.media?.slides || [];
  const voiced = !!s.voice && s.voice !== 'none';
  // what this item tests (shown as chips): look, voice, music, subtitles, hook
  const chips = [video || item.kind === 'carousel' ? ['Look', traitValue('style', s.style || (item.kind === 'reel-verse' ? 'photo' : ['reel-kinetic', 'reel-story'].includes(item.kind) ? 'dark' : 'light'))] : null,
    video ? ['Stem', voiced ? `${traitValue('voice', s.voice)}${s.voiceStyle === 'levendig' ? ', levendig' : ''}` : 'geen'] : null,
    video ? ['Muziek', traitValue('music', s.music || 'none')] : null,
    voiced && ['reel-explainer', 'reel-list', 'reel-story'].includes(item.kind) ? ['Ondertitels', traitValue('captions', s.captions || 'block')] : null,
    s.experiment?.hook ? ['Hook', s.experiment.hook] : null].filter(Boolean) as [string, string][];
  const st = STATUS[item.status] ?? { label: item.status, tone: 'bg-bg' };
  const canDecide = ['review', 'approved', 'changes', 'rejected'].includes(item.status);

  async function patch(body: object) {
    setBusy(true); setError('');
    const r = await fetch(`/api/${project}/items/${item._id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error || 'Opslaan mislukt'); return false; }
    if (j.message) toast(j.message);
    router.refresh(); return true;
  }
  async function act(action: 'approve' | 'changes' | 'reject' | 'reset') {
    if (action === 'changes' && !note.trim()) { setOpen(true); return; }
    if (await patch({ action, comment: note.trim() || undefined })) { setOpen(false); setNote(''); }
  }
  async function saveText() {
    if (await patch({ action: 'edit', caption, hashtags: tags })) setEditing(false);
  }

  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-card)] transition ${item.status === 'review' ? 'border-line-strong' : 'border-line'} ${item.status === 'rejected' ? 'opacity-60 hover:opacity-100' : ''}`}>
      <div className={`relative bg-panel ${video ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
        {item.media?.url ? (video
          ? <video src={item.media.url} poster={item.media.coverUrl} controls playsInline preload="none" className="h-full w-full object-contain" />
          : slides.length > 1 ? (
            <div className="relative h-full">
              <a href={slides[slide]} target="_blank" rel="noreferrer" className="block h-full cursor-pointer" title="Open op volle grootte"><img src={slides[slide]} alt={`Slide ${slide + 1} van ${slides.length}`} className="h-full w-full object-contain" /></a>
              {(['prev', 'next'] as const).map(d => (
                <button key={d} type="button" aria-label={d === 'prev' ? 'Vorige slide' : 'Volgende slide'} disabled={d === 'prev' ? slide === 0 : slide === slides.length - 1}
                  onClick={() => setSlide(x => x + (d === 'prev' ? -1 : 1))}
                  className={`absolute top-1/2 -translate-y-1/2 ${d === 'prev' ? 'left-2' : 'right-2'} grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white/90 text-lg font-bold text-ink shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30`}>{d === 'prev' ? '‹' : '›'}</button>
              ))}
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">{slides.map((_, i) => <button key={i} type="button" aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)} className={`h-2 cursor-pointer rounded-full transition ${i === slide ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`} />)}</div>
            </div>)
          : <a href={item.media.url} target="_blank" rel="noreferrer" className="block h-full cursor-pointer" title="Open op volle grootte"><img src={item.media.url} alt="" className="h-full w-full object-contain" /></a>)
          : <div className="grid h-full place-items-center p-6 text-center text-sm text-white/60">{item.status === 'failed' ? item.error : 'Nog niet gerenderd'}</div>}
        <Pill tone={`${st.tone} absolute left-3 top-3 shadow-sm`}>{st.label}</Pill>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink-muted">
          <span>{KIND[item.kind] || item.kind}</span>
          {item.status === 'approved' && <span className="text-accent-dark">{item.postAt ? 'Aan de beurt' : 'Op de stapel'}</span>}
        </div>
        {s.verse && <p className="mt-2 font-serif text-[15px] leading-snug text-ink">&ldquo;{s.verse.text}&rdquo; <span className="whitespace-nowrap text-xs font-bold text-accent-dark">{s.verse.ref}</span></p>}
        {(s.hook || s.question || s.headline || s.line || s.slides?.[0]?.title) && <p className="mt-2 font-semibold leading-snug">{s.hook || s.question || s.headline || s.line || s.slides[0].title}</p>}
        {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{chips.map(([k, v]) => <span key={k} className="rounded-md bg-bg px-1.5 py-0.5 text-[11px] text-ink-muted ring-1 ring-line"><span className="font-semibold text-ink-body">{k}:</span> {v}</span>)}</div>}
        <details className="group mt-3 rounded-lg text-sm text-ink-body">
          <summary className="flex cursor-pointer items-center gap-1 rounded-md font-medium text-ink-muted transition hover:text-ink">
            <svg viewBox="0 0 20 20" className="h-4 w-4 transition group-open:rotate-90" fill="currentColor" aria-hidden><path d="M7.2 4.2a.75.75 0 0 1 1.06 0l5.27 5.27a.75.75 0 0 1 0 1.06L8.26 15.8a.75.75 0 1 1-1.06-1.06L11.94 10 7.2 5.26a.75.75 0 0 1 0-1.06Z" /></svg>
            Caption en details
          </summary>
          <div className="mt-2 space-y-2 border-l-2 border-line pl-3">
            {editing ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-ink-muted">Caption
                  <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={6}
                    className="mt-1 w-full rounded-lg border border-line-strong bg-surface p-2 text-sm text-ink outline-none transition hover:border-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </label>
                <label className="block text-xs font-semibold text-ink-muted">Hashtags
                  <input value={tags} onChange={e => setTags(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-ink outline-none transition hover:border-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" disabled={busy} onClick={saveText}>Opslaan</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setCaption(s.caption || ''); setTags((s.hashtags || []).join(' ')); }}>Annuleer</Button>
                </div>
              </div>
            ) : <>
              <p className="whitespace-pre-line">{s.caption}</p>
              {s.hashtags?.length > 0 && <p className="text-accent-dark">{s.hashtags.join(' ')}</p>}
              {canDecide && <button type="button" onClick={() => setEditing(true)} className="cursor-pointer rounded-md text-xs font-semibold text-accent-dark transition hover:text-accent hover:underline">Tekst zelf aanpassen</button>}
            </>}
            {s.lines && <ol className="list-decimal space-y-1 pl-5">{s.lines.map((l: any, i: number) => <li key={i}>{l.say || l.text}{l.verse ? <span className="text-xs text-ink-muted"> ({l.verse})</span> : null}</li>)}</ol>}
            {s.items && <ol className="list-decimal space-y-1 pl-5">{s.items.map((l: any, i: number) => <li key={i}><span className="font-semibold">{l.title}</span>{l.say ? ` - ${l.say}` : l.text ? ` - ${l.text}` : ''}</li>)}</ol>}
            {s.scenes && <ol className="list-decimal space-y-1 pl-5">{s.scenes.map((l: any, i: number) => <li key={i}><span className="text-xs font-semibold uppercase text-ink-muted">{({ map: 'kaart', timeline: 'tijdlijn', text: 'tekst', verse: 'vers', photo: 'foto' } as any)[l.show]}</span> {l.say}</li>)}</ol>}
            {s.options && <ul className="space-y-1">{s.options.map((o: string, i: number) => <li key={i} className={i === s.answer ? 'font-semibold text-success' : ''}>{'ABCD'[i]}. {o}{i === s.answer ? ' (goed)' : ''}</li>)}<li className="pt-1">{s.explain}</li></ul>}
            {s.slides && <ol className="list-decimal space-y-1 pl-5">{s.slides.map((l: any, i: number) => <li key={i}>{l.title || l.text || l.verse}</li>)}</ol>}
            <p className="text-xs text-ink-muted">Platforms: {s.platforms.map((x: string) => PLATFORM[x] || x).join(', ')}{item.aiLabel ? ' - krijgt AI-label' : ''}</p>
            {s.basedOn && <p className="text-xs text-ink-muted">Gebaseerd op: {s.basedOn}</p>}
            {s.experiment && Object.keys(s.experiment).length > 0 && <p className="text-xs text-ink-muted">Test: {Object.entries(s.experiment).map(([k, v]) => `${k}=${v}`).join(', ')}</p>}
            {['review', 'changes', 'failed', 'rejected', 'approved'].includes(item.status) && (
              <button type="button" disabled={busy} onClick={() => patch({ action: 'rerender' })} className="cursor-pointer rounded-md text-xs font-semibold text-accent-dark transition hover:text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50">Opnieuw renderen</button>
            )}
          </div>
        </details>
        {item.renderNotes?.length > 0 && item.status !== 'queued' && item.status !== 'rendering' && (
          <p className="mt-2 rounded-md bg-orange-50 px-2 py-1 text-xs text-warn">{item.renderNotes.join('; ').replace(/no TTS configured - silent render/, 'Nog zonder stem')}</p>
        )}
        {item.reviewComments?.length > 0 && (
          <div className="mt-3 space-y-1 rounded-lg bg-bg p-2.5 text-xs text-ink-body">
            {item.reviewComments.map((c: any, i: number) => <p key={i}><span className="font-semibold">Jij:</span> {c.text}</p>)}
          </div>
        )}
        {item.results && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {Object.entries(item.results).map(([pl, r]: any) => {
              const tone = r.id ? 'bg-emerald-50 text-success ring-1 ring-emerald-200' : r.skipped ? 'bg-bg text-ink-muted ring-1 ring-line' : 'bg-red-50 text-danger ring-1 ring-red-200';
              const label = `${PLATFORM[pl] || pl}${r.needsManual ? ' (privé)' : ''}`;
              return r.url
                ? <a key={pl} href={r.url} target="_blank" rel="noreferrer" title={r.error || r.skipped || 'Bekijk de post'} className={`cursor-pointer rounded-full px-2 py-0.5 font-semibold transition hover:brightness-95 ${tone}`}>{label} &#8599;</a>
                : <span key={pl} title={r.error || r.skipped || ''} className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>{label}</span>;
            })}
          </div>
        )}
        {item.status === 'published' && item.metrics?.instagram && <p className="mt-2 text-xs text-ink-muted">Instagram: {item.metrics.instagram.views ?? 0} views - {item.metrics.instagram.likes ?? 0} likes - {item.metrics.instagram.saved ?? 0} saves</p>}

        {open && (
          <div className="mt-3">
            <label htmlFor={`note-${item._id}`} className="text-xs font-semibold text-ink-muted">Wat moet er anders?</label>
            <textarea id={`note-${item._id}`} value={note} onChange={e => setNote(e.target.value)} autoFocus rows={3} placeholder="Bijv. kortere hook, ander vers, andere screenshot. Claude past het aan."
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) act('changes'); if (e.key === 'Escape') { setOpen(false); setNote(''); } }}
              className="mt-1 w-full rounded-lg border border-line-strong bg-surface p-2.5 text-sm outline-none transition placeholder:text-ink-muted/70 hover:border-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
        {item.status === 'approved' && item.postAt && new Date(item.postAt) <= new Date() && !item.results && <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-success">Gaat online bij de volgende ronde (binnen een uur).</p>}
        {item.status === 'rejected' && <p className="mt-2 rounded-md bg-bg px-2 py-1 text-xs text-ink-muted ring-1 ring-line">Wordt na ongeveer een dag verwijderd (video en item). Tot dan kun je het nog goedkeuren of laten aanpassen; de planner onthoudt wat je hebt afgewezen.</p>}
        {item.results && Object.values(item.results).some((r: any) => r.waiting) && <p className="mt-2 rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-warn">Wacht op koppeling: {Object.entries(item.results).filter(([, r]: any) => r.waiting).map(([p]) => PLATFORM[p] || p).join(', ')} - zie Instellingen.</p>}
        {canDecide && (
          <div className="mt-auto pt-4">
            <div className="flex flex-wrap gap-2">
              {open ? <>
                  <Button variant="primary" className="flex-1" disabled={busy || !note.trim()} onClick={() => act('changes')}>Verstuur opmerking</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setNote(''); }}>Annuleer</Button>
                </>
                : <>
                  {item.status !== 'approved'
                    ? <Button variant="primary" className="flex-1" disabled={busy} onClick={() => act('approve')}>Goedkeuren</Button>
                    : <>
                        <Button className="flex-1" disabled={busy} onClick={() => act('reset')}>Terug naar keuren</Button>
                        {!item.postAt && <Button variant="ghost" disabled={busy} onClick={() => patch({ action: 'now' })} title="Plaats bij de volgende ronde in plaats van te wachten op zijn beurt">Nu plaatsen</Button>}
                      </>}
                  <Button disabled={busy} onClick={() => act('changes')}>Aanpassen</Button>
                  {item.status !== 'rejected' && <Button variant="danger" disabled={busy} onClick={() => act('reject')}>Weg</Button>}
                </>}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
