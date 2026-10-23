import { headers } from 'next/headers';
import { getDb, getSharedDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { open } from '@/lib/crypto';
import { PROVIDERS, PLATFORM_PROVIDER, type ProviderId } from '@/lib/connections';
import { Card, PageHeader } from '@/components/ui';
import { AppForm, ConnectActions, PagePicker, CopyField, SecretRow, CompetitorsForm } from './SettingsClient';
import { listSecrets, readSecret } from '@/lib/secrets';
import VoicePicker from './VoicePicker';
import { testSet } from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Instellingen' };

const ago = (d?: Date | string) => {
  if (!d) return 'nog nooit';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? 'zojuist' : m < 60 ? `${m} min geleden` : m < 48 * 60 ? `${Math.round(m / 60)} uur geleden` : `${Math.round(m / 1440)} dagen geleden`;
};
const JOBS: [string, string, number][] = [   // job, label, expected interval in hours (for "late")
  ['publish', 'Publiceren (elke 30 min)', 2], ['stats', 'Cijfers (dagelijks)', 30], ['render', 'Renderen (na planning)', 0],
  ['import', 'Importeren', 0], ['plan', 'Weekplanner (vrijdag)', 8 * 24],
];

type Status = 'ok' | 'todo' | 'warn' | 'optional';

export default async function Settings({ params, searchParams }: { params: Promise<{ project: string }>; searchParams: Promise<{ ok?: string; error?: string; p?: string }> }) {
  const { project } = await params; const { ok, error, p: errorFor } = await searchParams;
  const p = getProject(project)!;
  const db = await getDb(project);
  const [conns, runsList, apps, keys] = await Promise.all([
    db.collection('connections').find().toArray(),
    db.collection('runs').find().toArray(),
    (await getSharedDb()).collection('apps').find().toArray(),
    listSecrets(project),
  ]);
  const conn = Object.fromEntries(conns.map(c => [c._id, c])) as Record<string, any>;
  const runs = Object.fromEntries(runsList.map(r => [r._id, r])) as Record<string, any>;
  const latest = [...runsList].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
  const cfg = runs.publish?.configured || latest?.configured || {};
  const secrets: string[] = latest?.secrets || [];
  const key = (name: string) => keys.find(k => k.name === name);
  const hasEleven = !!(await readSecret(project, 'ELEVENLABS_API_KEY'));
  const competitors: string[] = (await db.collection('settings').findOne({ _id: 'competitors' as any }))?.instagram || [];
  const [maleVoice, femaleVoice] = hasEleven ? await Promise.all([readSecret(project, 'ELEVENLABS_VOICE_MALE'), readSecret(project, 'ELEVENLABS_VOICE_FEMALE')]) : [null, null];
  const voiceTestSet = hasEleven ? (await testSet(project)).map(({ key, id, name, gender }) => ({ key, id, name, gender })) : [];
  const hasKey = (name: string) => !!key(name)?.inStudio || secrets.includes(name);
  const h = await headers();
  const origin = process.env.STUDIO_URL || `${h.get('x-forwarded-proto') || 'https'}://${h.get('host')}`;

  const providers = (['meta', 'google', 'tiktok'] as ProviderId[]).filter(id => p.platforms.some(pl => PLATFORM_PROVIDER[pl] === id));
  const appInfo = (id: ProviderId) => {
    const [idVar, secretVar] = PROVIDERS[id].env;
    if (process.env[idVar] && process.env[secretVar]) return { clientId: process.env[idVar]!, source: 'env' as const };
    const a = apps.find(x => String(x._id) === id);
    return a ? { clientId: a.clientId as string, configId: a.configId as string | undefined, source: 'studio' as const } : null;
  };
  const linked = (id: ProviderId) => !!conn[id]?.secret;
  const ticks = Object.fromEntries((await (await getSharedDb()).collection('ticks').find().toArray()).map(t => [String(t._id), t])) as Record<string, any>;
  const publishLate = runs.publish ? Date.now() - +new Date(runs.publish.at) > 2 * 3600e3 : true;

  const checks: { title: string; detail: string; status: Status; href?: string }[] = [
    { title: 'Studio en database', detail: 'De studio draait en bereikt de database.', status: 'ok' },
    { title: 'Media-opslag', detail: process.env.BLOB_READ_WRITE_TOKEN ? 'Vercel Blob is gekoppeld.' : 'Koppel een Vercel Blob-store aan het studio-project.', status: process.env.BLOB_READ_WRITE_TOKEN ? 'ok' : 'todo' },
    { title: 'Engine in GitHub Actions', detail: runs.publish ? `Publiceren draaide ${ago(runs.publish.at)}.` : 'Nog geen run gezien. De secrets MONGODB_URI en ENGINE_KEY moeten in GitHub staan.', status: runs.publish ? (publishLate ? 'warn' : 'ok') : 'todo' },
    { title: 'Tijdschema', detail: hasKey('GITHUB_DISPATCH_TOKEN') ? (ticks.publish ? `De studio start de engine elk uur (laatst ${ago(ticks.publish.at)}: ${ticks.publish.note}).` : 'Token staat klaar - de eerste tik komt binnen het uur.') : 'Plak een GitHub-token onder Sleutels, zodat posts ook op tijd gaan als GitHub zijn eigen schema overslaat.',
      status: hasKey('GITHUB_DISPATCH_TOKEN') ? (ticks.publish && !ticks.publish.ok ? 'warn' : 'ok') : 'todo', href: '#sleutels' },
    { title: 'Weekplanner (Claude)', detail: hasKey('CLAUDE_CODE_OAUTH_TOKEN') ? 'Draait elke vrijdag.' : 'Plak je Claude-token onder Sleutels (op je computer: claude setup-token).', status: hasKey('CLAUDE_CODE_OAUTH_TOKEN') ? 'ok' : 'todo', href: '#sleutels' },
    ...providers.map(id => ({ title: PROVIDERS[id].name, detail: linked(id) ? `Gekoppeld: ${conn[id].account?.name}${id === 'tiktok' ? ' (privé tot TikTok de app goedkeurt)' : ''}` : (cfg[id === 'google' ? 'youtube' : id] ? 'Via GitHub-secrets ingesteld.' : conn[id]?.pending ? 'Kies hieronder de pagina.' : 'Nog niet gekoppeld.'),
      status: (linked(id) ? (conn[id].lastCheck?.ok === false ? 'warn' : 'ok') : cfg[id === 'google' ? 'youtube' : id] ? 'ok' : 'todo') as Status, href: `#${id}` })),
    { title: 'Stem voor uitleg-reels', detail: hasEleven ? (maleVoice && femaleVoice ? 'ElevenLabs met een mannen- en vrouwenstem.' : 'ElevenLabs staat klaar - kies hieronder bij Stemmen een man en een vrouw.') : cfg.tts ? `Stem via ${cfg.tts === 'elevenlabs' ? 'ElevenLabs' : 'Google'}.` : 'Nog geen stem: zet je ElevenLabs API key onder Sleutels.',
      status: hasEleven ? (maleVoice && femaleVoice ? 'ok' : 'todo') : cfg.tts ? 'ok' : 'optional', href: hasEleven ? '#stemmen' : '#sleutels' },
    { title: 'Nieuwe gebruikers meten', detail: cfg.platformDb ? 'Aanmeldingen worden dagelijks geteld.' : `Optioneel: een alleen-lezen databasegebruiker voor ${p.name} (PLATFORM_MONGODB_URI).`, status: cfg.platformDb ? 'ok' : 'optional' },
  ];
  const open_ = checks.filter(c => c.status === 'todo').length;

  return (
    <div>
      <PageHeader title="Instellingen" sub={open_ ? `Nog ${open_} ${open_ === 1 ? 'stap' : 'stappen'} voordat ${p.name} volledig vanzelf loopt.` : `${p.name} is volledig ingesteld.`} />
      {ok && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-success">{PROVIDERS[ok as ProviderId]?.name || ok} is gekoppeld.</p>}
      {error && !errorFor && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}

      <Card className="mt-6 divide-y divide-line">
        {checks.map(c => (
          <div key={c.title} className="flex items-start gap-3 px-5 py-3.5">
            <StatusIcon status={c.status} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.title}{c.status === 'optional' && <span className="ml-2 text-xs font-medium text-ink-muted">optioneel</span>}</p>
              <p className="text-sm text-ink-muted">{c.detail}</p>
            </div>
            {c.href && c.status !== 'ok' && <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent-dark transition hover:bg-accent-faint">Regelen &rarr;</a>}
          </div>
        ))}
      </Card>

      <h2 className="mt-10 text-lg font-bold">Koppelingen</h2>
      <p className="mt-1 text-sm text-ink-muted">Per platform eenmalig een ontwikkelaars-app (geldt voor alle projecten), daarna per project &eacute;&eacute;n keer inloggen en toestaan. Tokens worden versleuteld opgeslagen.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {providers.map(id => {
          const P = PROVIDERS[id]; const app = appInfo(id); const c = conn[id];
          let choices: any[] = [];
          if (c?.pending) { try { choices = open<any[]>(c.pending).map(({ pageId, pageName, igUsername }) => ({ pageId, pageName, igUsername })); } catch {} }
          return (
            <Card key={id} id={id} className="scroll-mt-20 flex flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">{P.name}</h3>
                {linked(id) ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-success ring-1 ring-emerald-200">Gekoppeld</span>
                  : <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-ink-muted ring-1 ring-line">Niet gekoppeld</span>}
              </div>
              {error && errorFor === id && !linked(id) && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-danger">{error}</p>}
              {linked(id) && (
                <div className="mt-3 rounded-lg bg-bg p-3 text-sm">
                  <p className="font-semibold">{c.account?.name}</p>
                  {id === 'meta' && <p className="text-ink-muted">Pagina: {c.account?.pageName}{c.account?.igUsername ? '' : ' - geen Instagram aan deze pagina'}</p>}
                  <p className="text-xs text-ink-muted">Sinds {new Date(c.connectedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</p>
                  {c.lastCheck && (
                    <p className={`mt-2 border-t border-line pt-2 text-xs ${c.lastCheck.ok ? 'text-success' : 'text-danger'}`}>
                      {c.lastCheck.ok ? 'Werkt' : 'Probleem'} ({ago(c.lastCheck.at)}): {c.lastCheck.detail}
                    </p>
                  )}
                </div>
              )}
              {choices.length > 0 && <PagePicker project={project} choices={choices} />}
              {!app && !linked(id) ? (
                <div className="mt-3 flex flex-1 flex-col">
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-body">
                    <li>Open <a href={P.console} target="_blank" rel="noreferrer" className="cursor-pointer font-semibold text-accent-dark underline-offset-2 hover:underline">{P.consoleName}</a>.</li>
                    {P.steps.map(s => <li key={s}>{s}</li>)}
                  </ol>
                  <CopyField label="Redirect-URL" value={`${origin}/api/oauth/${id}/callback`} />
                  <AppForm provider={id} idLabel={P.idLabel} secretLabel={P.secretLabel} meta={id === 'meta'} />
                </div>
              ) : (
                <div className="mt-auto pt-4">
                  <ConnectActions project={project} provider={id} linked={linked(id)} appSource={app?.source || 'none'} clientId={app?.clientId || ''} />
                  <details className="group mt-3 text-sm">
                    <summary className="cursor-pointer rounded text-ink-muted transition hover:text-ink">App-gegevens ({!app ? 'ontbreken' : app.source === 'env' ? 'uit Vercel' : 'opgeslagen'})</summary>
                    <div className="mt-2 space-y-2">
                      {app && <p className="text-xs text-ink-muted">{P.idLabel}: <code>{app.clientId}</code></p>}
                      <CopyField label="Redirect-URL" value={`${origin}/api/oauth/${id}/callback`} />
                      {app?.source !== 'env' && <AppForm provider={id} idLabel={P.idLabel} secretLabel={P.secretLabel} meta={id === 'meta'} replace={!!app} />}
                    </div>
                  </details>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <h2 id="sleutels" className="mt-10 scroll-mt-20 text-lg font-bold">Sleutels</h2>
      <p className="mt-1 text-sm text-ink-muted">Plak sleutels hier in plaats van in GitHub. Ze worden versleuteld opgeslagen en daarna nooit meer getoond; de engine leest ze bij elke run. Een GitHub-secret met dezelfde naam gaat voor.</p>
      <Card className="mt-4 divide-y divide-line">
        {keys.map(k => <SecretRow key={k.name} project={project} s={{ name: k.name, label: k.label, help: k.help, secret: k.secret, optional: k.optional, scope: k.scope, inStudio: k.inStudio, inGitHub: secrets.includes(k.name) && !k.inStudio, hint: k.hint }} />)}
      </Card>

      {hasEleven && (<>
        <h2 id="stemmen" className="mt-10 scroll-mt-20 text-lg font-bold">Stemmen</h2>
        <p className="mt-1 text-sm text-ink-muted">Kies een mannen- en een vrouwenstem voor de uitleg-reels (de planner wisselt ze af en meet welke beter werkt). Nederlandse stemmen uit de ElevenLabs-bibliotheek; &quot;Test in het Nederlands&quot; kost ongeveer 120 tekens van je tegoed.</p>
        <Card className="mt-4 p-5"><VoicePicker project={project} male={maleVoice || undefined} female={femaleVoice || undefined} testSet={voiceTestSet} /></Card>
      </>)}

      <h2 className="mt-10 text-lg font-bold">Leren van anderen</h2>
      <p className="mt-1 text-sm text-ink-muted">Instagram-accounts (zakelijk of creator) waarvan de planner elke maandag de best scorende posts bekijkt - alleen patronen, nooit tekst overnemen. Werkt zodra Instagram gekoppeld is.</p>
      <Card className="mt-4 p-5"><CompetitorsForm project={project} initial={competitors} /></Card>

      <h2 className="mt-10 text-lg font-bold">Laatste runs</h2>
      <Card className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-ink-muted"><tr><th className="p-3 font-semibold">Taak</th><th className="p-3 font-semibold">Laatst</th><th className="p-3 font-semibold">Resultaat</th><th className="p-3" /></tr></thead>
          <tbody>
            {JOBS.map(([job, label, hours]) => {
              const r = runs[job]; const late = r && hours && Date.now() - +new Date(r.at) > hours * 3600e3;
              return (
                <tr key={job} className="border-t border-line transition hover:bg-bg/60">
                  <td className="p-3 font-medium">{label}</td>
                  <td className={`p-3 ${late ? 'font-semibold text-warn' : 'text-ink-body'}`}>{ago(r?.at)}</td>
                  <td className="p-3 text-ink-muted">{r ? Object.entries(r.summary || {}).map(([k, v]) => `${k}: ${v}`).join(', ') : '-'}</td>
                  <td className="p-3 text-right">{r?.run && r.run !== 'local' && <a href={r.run} target="_blank" rel="noreferrer" className="cursor-pointer rounded-md px-2 py-1 font-semibold text-accent-dark transition hover:bg-accent-faint">Log &#8599;</a>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  const tone = { ok: 'bg-emerald-500 text-white', todo: 'bg-surface ring-2 ring-line-strong text-transparent', warn: 'bg-orange-500 text-white', optional: 'bg-surface ring-2 ring-dashed ring-line text-transparent' }[status];
  return (
    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${tone}`} aria-label={status}>
      {status === 'ok' && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" /></svg>}
      {status === 'warn' && <span className="text-xs font-bold">!</span>}
    </span>
  );
}
