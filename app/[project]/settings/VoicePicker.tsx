'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

type Voice = { id: string; name: string; gender?: string; accent?: string; age?: string; description?: string; useCase?: string; preview?: string; ownerId?: string; mine: boolean };

type TestVoice = { key: string; id: string; name: string; gender?: string };

/** Browse Dutch ElevenLabs voices, hear them, pick the default man + woman, and build the test set
 *  (extra voices the planner rotates through so the experiments can compare them). */
export default function VoicePicker({ project, male, female, testSet = [] }: { project: string; male?: string; female?: string; testSet?: TestVoice[] }) {
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
  async function toggleTest(v: Voice, inSet?: TestVoice) {
    setBusy(`t:${v.id}`); setErr('');
    const r = inSet
      ? await fetch(`/api/${project}/voices/testset?key=${inSet.key}`, { method: 'DELETE' })
      : await fetch(`/api/${project}/voices/testset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ voiceId: v.id, ownerId: v.mine ? undefined : v.ownerId, name: v.name, gender }) });
    setBusy('');
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Opslaan mislukt'); return; }
    router.refresh();
  }
  async function removeKey(k: string) {
    setBusy(`k:${k}`); setErr('');
    const r = await fetch(`/api/${project}/voices/testset?key=${k}`, { method: 'DELETE' });
    setBusy(''); if (!r.ok) { setErr('Verwijderen mislukt'); return; } router.refresh();
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
      <div className="mt-3 rounded-xl bg-bg p-3 text-sm">
        <p className="font-semibold">Testset <span className="font-normal text-ink-muted">- de planner wisselt deze stemmen af en meet welke het best werkt (naast je standaard man en vrouw)</span></p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {testSet.length ? testSet.map(v => (
            <span key={v.key} className="inline-flex items-center gap-1 rounded-full bg-surface py-0.5 pl-2.5 pr-1 text-xs font-semibold ring-1 ring-line-strong">
              {v.name} <span className="font-normal text-ink-muted">{v.gender === 'male' ? 'man' : v.gender === 'female' ? 'vrouw' : ''}</span>
              <button type="button" aria-label={`${v.name} uit de testset halen`} disabled={!!busy} onClick={() => removeKey(v.key)}
                className="cursor-pointer rounded-full px-1.5 text-ink-muted transition hover:bg-bg hover:text-danger disabled:cursor-not-allowed disabled:opacity-50">&times;</button>
            </span>
          )) : <span className="text-xs text-ink-muted">Nog leeg. Kies hieronder stemmen met "Testen".</span>}
        </div>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      {!data && !err && <p className="mt-4 text-sm text-ink-muted">Stemmen laden...</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {voices.map(v => {
          const isMale = v.id === male, isFemale = v.id === female;
          const inSet = testSet.find(t => t.id === v.id);
          return (
            <div key={`${v.mine}-${v.id}`} className={`rounded-xl border p-3 transition ${isMale || isFemale ? 'border-accent bg-accent-faint' : 'border-line bg-surface hover:border-line-strong'}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{v.name} {v.mine && <span className="text-xs font-normal text-ink-muted">(jouw stem)</span>}</p>
                  <p className="truncate text-xs text-ink-muted">{[v.accent, v.age, v.useCase].filter(Boolean).join(' - ')}</p>
                </div>
                {(isMale || isFemale) && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{isMale ? 'Man' : 'Vrouw'}</span>}
                {inSet && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-dark">In testset</span>}
              </div>
              {v.description && <p className="mt-1 line-clamp-2 text-xs text-ink-body">{v.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {v.preview && <Button size="sm" variant="ghost" onClick={() => play(v.id, v.preview!)}>{playing === v.id ? 'Stop' : 'Luister'}</Button>}
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => (playing === `nl:${v.id}` ? play(`nl:${v.id}`, '') : dutch(v))}>{busy === `nl:${v.id}` ? 'Maken...' : playing === `nl:${v.id}` ? 'Stop' : 'Test in het Nederlands'}</Button>
                {!isMale && !isFemale && <Button size="sm" variant="ghost" className="ml-auto" disabled={!!busy} onClick={() => toggleTest(v, inSet)}>{busy === `t:${v.id}` ? 'Bezig...' : inSet ? 'Uit testset' : 'Testen'}</Button>}
                <Button size="sm" variant={gender === 'male' ? 'primary' : 'secondary'} className={isMale || isFemale ? 'ml-auto' : ''} disabled={!!busy || (gender === 'male' ? isMale : isFemale)} onClick={() => choose(v, gender)}>
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
