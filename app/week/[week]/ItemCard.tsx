'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const KIND: Record<string, string> = {
  'verse-still': 'Vers van de dag', 'reel-verse': 'Reel - vers', 'reel-demo': 'Reel - app demo',
  'reel-explainer': 'Reel - uitleg', 'post-spotlight': 'Post - functie', 'post-statement': 'Post - statement',
};
const STATUS: Record<string, [string, string]> = {
  queued: ['In de wachtrij', 'bg-bg text-ink-body'], rendering: ['Wordt gemaakt', 'bg-bg text-ink-body'],
  review: ['Wacht op jou', 'bg-teal text-white'], changes: ['Wordt aangepast', 'bg-warn/10 text-warn'],
  approved: ['Goedgekeurd', 'bg-teal-soft text-teal-dark'], rejected: ['Afgewezen', 'bg-bg text-ink-muted line-through'],
  published: ['Gepubliceerd', 'bg-success/10 text-success'], partial: ['Deels gepubliceerd', 'bg-warn/10 text-warn'], failed: ['Mislukt', 'bg-danger/10 text-danger'],
};
const TIME = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

export default function ItemCard({ item }: { item: any }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const s = item.spec; const video = item.kind.startsWith('reel-');
  const [label, tone] = STATUS[item.status] || [item.status, 'bg-bg'];
  const canDecide = ['review', 'approved', 'changes', 'rejected'].includes(item.status);

  async function act(action: 'approve' | 'changes' | 'reject' | 'reset') {
    if (action === 'changes' && !note.trim()) { setOpen(true); return; }
    setBusy(true);
    await fetch(`/api/items/${item._id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, comment: note.trim() || undefined }) });
    setBusy(false); setOpen(false); setNote(''); router.refresh();
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className={`relative bg-panel ${video ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
        {item.media?.url ? (video
          ? <video src={item.media.url} poster={item.media.coverUrl} controls playsInline preload="none" className="h-full w-full object-contain" />
          : <img src={item.media.url} alt="" className="h-full w-full object-contain" />)
          : <div className="grid h-full place-items-center text-sm text-white/60">{item.status === 'failed' ? item.error : 'Nog niet gerenderd'}</div>}
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink-muted">
          <span>{KIND[item.kind] || item.kind}</span><span>{TIME.format(new Date(item.slot))}</span>
        </div>
        {s.verse && <p className="mt-2 font-serif text-[15px] leading-snug text-ink">"{s.verse.text}" <span className="text-xs font-bold text-teal-dark">{s.verse.ref} SV</span></p>}
        {(s.hook || s.headline || s.line) && <p className="mt-2 font-semibold leading-snug">{s.hook || s.headline || s.line}</p>}
        <details className="mt-2 text-sm text-ink-body">
          <summary className="cursor-pointer text-ink-muted">Caption en details</summary>
          <p className="mt-2 whitespace-pre-line">{s.caption}</p>
          <p className="mt-1 text-teal-dark">{(s.hashtags || []).join(' ')}</p>
          {s.lines && <ol className="mt-2 list-decimal pl-5">{s.lines.map((l: any, i: number) => <li key={i}>{l.say}</li>)}</ol>}
          <p className="mt-2 text-xs text-ink-muted">Platforms: {s.platforms.join(', ')}{item.aiLabel ? ' - krijgt AI-label' : ''}</p>
          <p className="text-xs text-ink-muted">Gebaseerd op: {s.basedOn}</p>
          {s.experiment && Object.keys(s.experiment).length > 0 && <p className="text-xs text-ink-muted">Test: {Object.entries(s.experiment).map(([k, v]) => `${k}=${v}`).join(', ')}</p>}
          {item.renderNotes?.length > 0 && <p className="text-xs text-warn">{item.renderNotes.join('; ')}</p>}
        </details>
        {item.reviewComments?.length > 0 && <div className="mt-2 rounded-lg bg-bg p-2 text-xs text-ink-body">{item.reviewComments.map((c: any, i: number) => <p key={i}>Jij: {c.text}</p>)}</div>}
        {item.results && <div className="mt-2 flex flex-wrap gap-2 text-xs">{Object.entries(item.results).map(([p, r]: any) =>
          <a key={p} href={r.url || undefined} target="_blank" className={`rounded-full px-2 py-0.5 ${r.id ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`} title={r.error || r.skipped || ''}>{p}{r.needsManual ? ' (privé)' : ''}</a>)}</div>}
        {item.status === 'published' && item.metrics?.instagram && <p className="mt-2 text-xs text-ink-muted">IG: {item.metrics.instagram.views ?? 0} views - {item.metrics.instagram.likes ?? 0} likes - {item.metrics.instagram.saved ?? 0} saves</p>}

        {open && <textarea value={note} onChange={e => setNote(e.target.value)} autoFocus rows={3} placeholder="Wat moet er anders? Claude past het aan."
          className="mt-3 w-full rounded-lg border border-line-strong p-2 text-sm outline-none focus:border-teal" />}
        {canDecide && (
          <div className="mt-auto flex gap-2 pt-4">
            {item.status !== 'approved'
              ? <button disabled={busy} onClick={() => act('approve')} className="flex-1 rounded-lg bg-cta py-2.5 text-sm font-bold text-white disabled:opacity-50">Goedkeuren</button>
              : <button disabled={busy} onClick={() => act('reset')} className="flex-1 rounded-lg border border-line-strong py-2.5 text-sm font-semibold">Terug naar keuren</button>}
            <button disabled={busy} onClick={() => act('changes')} className="rounded-lg border border-line-strong px-3 py-2.5 text-sm font-semibold">{open ? 'Verstuur' : 'Aanpassen'}</button>
            <button disabled={busy} onClick={() => act('reject')} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-danger">Weg</button>
          </div>
        )}
      </div>
    </article>
  );
}
