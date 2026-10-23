'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

type Voice = { id: string; name: string; gender?: string; accent?: string; age?: string; description?: string; useCase?: string; preview?: string; ownerId?: string; mine: boolean };

/** Browse Dutch ElevenLabs voices, hear them, and pick one man + one woman for the explainer reels. */
export default function VoicePicker({ project, male, female }: { project: string; male?: string; female?: string }) {
  const router = useRouter();
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [data, setData] = useState<{ mine: Voice[]; library: Voice[]; account: { tier?: string; used?: number; limit?: number } } | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(''); const [playing, setPlaying] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setData(null); setErr('');
    fetch(`/api/${project}/voices?gender=${gender}`).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j); }).catch(e => setErr(e.message));
  }, [project, gender]);

  function play(id: string, src: string) {
    audio.current?.pause();
    if (playing === id) { setPlaying(''); return; }
    const a = new Audio(src); audio.current = a; setPlaying(id);
    a.onended = () => setPlaying(''); a.play().catch(() => setPlaying(''));
  }
  async function dutch(v: Voice) {
    setBusy(`nl:${v.id}`); setErr('');
    const r = await fetch(`/api/${project}/voices/sample`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ voiceId: v.id }) });
    setBusy('');
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Voorbeeld mislukt'); return; }
    play(`nl:${v.id}`, URL.createObjectURL(await r.blob()));
  }
  async function choose(v: Voice, role: 'male' | 'female') {
    setBusy(`${role}:${v.id}`); setErr('');
    const r = await fetch(`/api/${project}/voices`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role, voiceId: v.id, ownerId: v.mine ? undefined : v.ownerId, name: v.name }) });
    setBusy('');
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Kiezen mislukt'); return; }
    router.refresh();
  }

  const voices = data ? [...data.mine.filter(v => !v.gender || v.gender === gender), ...data.library] : [];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {(['female', 'male'] as const).map(g => (
          <button key={g} type="button" onClick={() => setGender(g)} aria-pressed={gender === g}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition ${gender === g ? 'bg-ink text-white' : 'bg-surface text-ink-body ring-1 ring-line-strong hover:bg-bg'}`}>
            {g === 'female' ? 'Vrouwenstemmen' : 'Mannenstemmen'}
          </button>
        ))}
        {data?.account?.limit ? <span className="ml-auto text-xs text-ink-muted">Abonnement {data.account.tier}: {data.account.used?.toLocaleString('nl-NL')} van {data.account.limit.toLocaleString('nl-NL')} tekens gebruikt deze maand</span> : null}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      {!data && !err && <p className="mt-4 text-sm text-ink-muted">Stemmen laden...</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {voices.map(v => {
          const isMale = v.id === male, isFemale = v.id === female;
          return (
            <div key={`${v.mine}-${v.id}`} className={`rounded-xl border p-3 transition ${isMale || isFemale ? 'border-accent bg-accent-faint' : 'border-line bg-surface hover:border-line-strong'}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{v.name} {v.mine && <span className="text-xs font-normal text-ink-muted">(jouw stem)</span>}</p>
                  <p className="truncate text-xs text-ink-muted">{[v.accent, v.age, v.useCase].filter(Boolean).join(' - ')}</p>
                </div>
                {(isMale || isFemale) && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{isMale ? 'Man' : 'Vrouw'}</span>}
              </div>
              {v.description && <p className="mt-1 line-clamp-2 text-xs text-ink-body">{v.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {v.preview && <Button size="sm" variant="ghost" onClick={() => play(v.id, v.preview!)}>{playing === v.id ? 'Stop' : 'Luister'}</Button>}
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => (playing === `nl:${v.id}` ? play(`nl:${v.id}`, '') : dutch(v))}>{busy === `nl:${v.id}` ? 'Maken...' : playing === `nl:${v.id}` ? 'Stop' : 'Test in het Nederlands'}</Button>
                <Button size="sm" variant={gender === 'male' ? 'primary' : 'secondary'} className="ml-auto" disabled={!!busy || (gender === 'male' ? isMale : isFemale)} onClick={() => choose(v, gender)}>
                  {busy === `${gender}:${v.id}` ? 'Bezig...' : gender === 'male' ? (isMale ? 'Gekozen' : 'Kies als man') : (isFemale ? 'Gekozen' : 'Kies als vrouw')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {data && !voices.length && <p className="mt-3 text-sm text-ink-muted">Geen Nederlandse stemmen gevonden voor dit filter.</p>}
    </div>
  );
}
