'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonClass } from '@/components/ui';

const input = 'mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition hover:border-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/20';

/** Developer-app ID + secret, stored encrypted in the studio (shared by all projects). */
export function AppForm({ provider, idLabel, secretLabel, meta, replace }: { provider: string; idLabel: string; secretLabel: string; meta?: boolean; replace?: boolean }) {
  const router = useRouter();
  const [clientId, setId] = useState(''); const [clientSecret, setSecret] = useState(''); const [configId, setConfig] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await fetch(`/api/apps/${provider}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId, clientSecret, configId }) });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Opslaan mislukt'); return; }
    setSecret(''); router.refresh();
  }
  return (
    <form onSubmit={save} className="mt-3 space-y-2">
      <label className="block text-xs font-semibold text-ink-muted">{idLabel}<input value={clientId} onChange={e => setId(e.target.value)} required autoComplete="off" className={input} /></label>
      <label className="block text-xs font-semibold text-ink-muted">{secretLabel}<input value={clientSecret} onChange={e => setSecret(e.target.value)} required type="password" autoComplete="off" className={input} /></label>
      {meta && <label className="block text-xs font-semibold text-ink-muted">Configuration ID <span className="font-normal">(alleen bij Facebook Login for Business)</span><input value={configId} onChange={e => setConfig(e.target.value)} inputMode="numeric" autoComplete="off" className={input} /></label>}
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      <Button type="submit" variant={replace ? 'secondary' : 'primary'} size="sm" disabled={busy || !clientId || !clientSecret} className="w-full">{replace ? 'App-gegevens vervangen' : 'Opslaan'}</Button>
    </form>
  );
}

export function ConnectActions({ project, provider, linked, appSource, clientId }: { project: string; provider: string; linked: boolean; appSource: string; clientId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(''); const [ask, setAsk] = useState(false);
  async function unlink() {
    setBusy('unlink'); await fetch(`/api/${project}/connections/${provider}`, { method: 'DELETE' }); setBusy(''); setAsk(false); router.refresh();
  }
  async function test() {
    setBusy('test');
    await fetch(`/api/${project}/connections/${provider}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ test: true }) });
    setBusy(''); router.refresh();
  }
  if (ask) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <p className="text-danger">Ontkoppelen? Er wordt dan niet meer op dit account gepost.</p>
      <div className="mt-2 flex gap-2">
        <Button variant="danger" size="sm" className="bg-surface ring-1 ring-red-200" disabled={!!busy} onClick={unlink}>{busy === 'unlink' ? 'Bezig...' : 'Ja, ontkoppel'}</Button>
        <Button variant="ghost" size="sm" onClick={() => setAsk(false)}>Annuleer</Button>
      </div>
    </div>
  );
  return (
    <div className="flex flex-wrap gap-2" data-app={appSource} data-client={clientId}>
      {linked && <Button variant="primary" className="flex-1" disabled={!!busy} onClick={test}>{busy === 'test' ? 'Testen...' : 'Test koppeling'}</Button>}
      <a href={`/api/oauth/${provider}/start?project=${project}`} className={buttonClass(linked ? 'secondary' : 'primary', 'md', linked ? '' : 'flex-1')}>{linked ? 'Opnieuw' : 'Koppel'}</a>
      {linked && <Button variant="danger" disabled={!!busy} onClick={() => setAsk(true)}>Ontkoppelen</Button>}
    </div>
  );
}

/** Several Facebook Pages came back: pick the one this project posts to. */
export function PagePicker({ project, choices }: { project: string; choices: { pageId: string; pageName: string; igUsername: string | null }[] }) {
  const router = useRouter(); const [busy, setBusy] = useState('');
  async function pick(pageId: string) {
    setBusy(pageId);
    await fetch(`/api/${project}/connections/meta`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pageId }) });
    setBusy(''); router.refresh();
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-semibold">Welke pagina hoort bij dit project?</p>
      {choices.map(c => (
        <button key={c.pageId} type="button" disabled={!!busy} onClick={() => pick(c.pageId)}
          className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-line-strong px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-accent-faint disabled:cursor-not-allowed disabled:opacity-50">
          <span><span className="font-semibold">{c.pageName}</span>{c.igUsername ? <span className="text-ink-muted"> - @{c.igUsername}</span> : <span className="text-ink-muted"> - geen Instagram</span>}</span>
          <span className="text-accent-dark">{busy === c.pageId ? '...' : 'Kies'}</span>
        </button>
      ))}
    </div>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <button type="button" title="Kopieer" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="mt-1 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-left font-mono text-xs text-ink-body transition hover:border-line-strong hover:bg-surface">
        <span className="break-all">{value}</span><span className="shrink-0 font-sans font-semibold text-accent-dark">{copied ? 'Gekopieerd' : 'Kopieer'}</span>
      </button>
    </div>
  );
}
