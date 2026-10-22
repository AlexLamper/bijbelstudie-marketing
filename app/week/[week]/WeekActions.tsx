'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WeekActions({ week, review }: { week: string; review: number }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  async function post(url: string, body: object) {
    setBusy(true); const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); setBusy(false); setMsg(j.message || ''); router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {msg && <span className="text-sm text-ink-muted">{msg}</span>}
      <button disabled={busy} onClick={() => post('/api/revise', {})} className="rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Aanpassingen naar Claude</button>
      <button disabled={busy || !review} onClick={() => confirm(`Alle ${review} items goedkeuren?`) && post('/api/items/approve-all', { week })} className="rounded-lg bg-cta px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Alles goedkeuren ({review})</button>
    </div>
  );
}
