'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CommentRow({ c }: { c: any }) {
  const router = useRouter(); const [copied, setCopied] = useState(false);
  const mark = async (status: string) => { await fetch(`/api/comments/${c._id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) }); router.refresh(); };
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm"><span className="font-bold">@{c.username}</span> <span className="text-ink-muted">op {c.itemId}</span></p>
      <p className="mt-1 text-ink-body">{c.text}</p>
      {c.draft ? <p className="mt-3 rounded-lg bg-teal-faint p-3 text-sm text-ink">{c.draft}</p> : <p className="mt-3 text-sm text-ink-muted">Concept volgt bij de volgende planner-run.</p>}
      <div className="mt-3 flex gap-2 text-sm">
        {c.draft && <button onClick={async () => { await navigator.clipboard.writeText(c.draft); setCopied(true); }} className="rounded-lg bg-cta px-3 py-2 font-bold text-white">{copied ? 'Gekopieerd' : 'Kopieer antwoord'}</button>}
        <button onClick={() => mark('done')} className="rounded-lg border border-line-strong px-3 py-2 font-semibold">Beantwoord</button>
        <button onClick={() => mark('skip')} className="rounded-lg px-3 py-2 font-semibold text-ink-muted">Overslaan</button>
      </div>
    </div>
  );
}
