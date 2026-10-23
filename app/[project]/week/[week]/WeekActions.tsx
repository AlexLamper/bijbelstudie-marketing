'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export default function WeekActions({ project, week, review, changes }: { project: string; week: string; review: number; changes: number }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  async function post(path: string, body: object) {
    setBusy(true); setMsg('');
    const r = await fetch(`/api/${project}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setMsg(j.message || j.error || (r.ok ? '' : 'Er ging iets mis.')); router.refresh();
  }
  return (
    <>
      {msg && <span role="status" className="text-sm text-ink-muted">{msg}</span>}
      <Button disabled={busy || !changes} onClick={() => post('revise', {})} title={changes ? undefined : 'Zet eerst een opmerking bij een item'}>
        Aanpassingen naar Claude{changes ? ` (${changes})` : ''}
      </Button>
      <Button variant="primary" disabled={busy || !review} onClick={() => confirm(`Alle ${review} items goedkeuren?`) && post('items/approve-all', { week })}>
        Alles goedkeuren ({review})
      </Button>
    </>
  );
}
