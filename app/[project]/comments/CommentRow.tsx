'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';

export default function CommentRow({ project, c }: { project: string; c: any }) {
  const router = useRouter(); const [copied, setCopied] = useState(false); const [busy, setBusy] = useState(false);
  const mark = async (status: string) => {
    setBusy(true);
    await fetch(`/api/${project}/comments/${c._id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    setBusy(false); router.refresh();
  };
  const copy = async () => { await navigator.clipboard.writeText(c.draft); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <Card className="p-4">
      <p className="text-sm"><span className="font-bold">@{c.username}</span> <span className="text-ink-muted">op {c.itemId}</span></p>
      <p className="mt-1 text-ink-body">{c.text}</p>
      {c.draft
        ? <p className="mt-3 rounded-lg border-l-4 border-accent bg-accent-faint p-3 text-sm text-ink">{c.draft}</p>
        : <p className="mt-3 text-sm text-ink-muted">Concept volgt bij de volgende planner-run.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {c.draft && <Button variant="primary" size="sm" onClick={copy}>{copied ? 'Gekopieerd' : 'Kopieer antwoord'}</Button>}
        <Button size="sm" disabled={busy} onClick={() => mark('done')}>Beantwoord</Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => mark('skip')}>Overslaan</Button>
      </div>
    </Card>
  );
}
