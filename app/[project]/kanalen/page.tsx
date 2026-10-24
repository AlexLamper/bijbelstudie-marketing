import Link from 'next/link';
import type { ReactNode } from 'react';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import type { ProviderId } from '@/lib/connections';
import { Button, Card, PageHeader, buttonClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kanalen' };

// Every public page of the project in one place: the social accounts (from the accounts linked on
// Instellingen, else the names in project.json "links"), the website and the app stores.
// Only names and ids are read from the connections - never the sealed tokens.

type Channel = {
  key: string; title: string; url: string | null; account?: string | null; detail?: string | null;
  followers?: { n: number; on: string } | null; provider?: ProviderId; linked?: boolean; icon: ReactNode; tile: string;
};

const bare = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const at = (name?: string | null) => (name ? name.replace(/^@/, '') : '');
const onDay = (id: string) => new Date(`${id}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default async function Kanalen({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params; const p = getProject(project)!; const links = p.links || {};
  const db = await getDb(project);
  const [conns, igDay, ttDay] = await Promise.all([
    db.collection('connections').aggregate([{ $project: { account: 1, linked: { $ne: [{ $type: '$secret' }, 'missing'] } } }]).toArray(),
    db.collection('metrics').find({ 'instagram.followers_count': { $exists: true } }, { projection: { 'instagram.followers_count': 1 } }).sort({ _id: -1 }).limit(1).next(),
    db.collection('metrics').find({ 'tiktok.followers': { $exists: true } }, { projection: { 'tiktok.followers': 1 } }).sort({ _id: -1 }).limit(1).next(),
  ]);
  const conn = Object.fromEntries(conns.map(c => [String(c._id), c])) as Record<string, { account?: Record<string, any>; linked?: boolean } | undefined>;
  const meta = conn.meta?.account || {}, google = conn.google?.account || {}, tiktok = conn.tiktok?.account || {};

  const igUser = at(meta.igUsername) || at(links.instagram);
  const ttUser = at(tiktok.username) || at(links.tiktok);
  const fbUrl = meta.pageId ? `https://www.facebook.com/${meta.pageId}` : links.facebook ? (links.facebook.startsWith('http') ? links.facebook : `https://www.facebook.com/${links.facebook}`) : null;
  const ytUrl = google.channelId ? `https://www.youtube.com/channel/${google.channelId}` : links.youtube ? `https://www.youtube.com/@${at(links.youtube)}` : null;

  const social = ([
    { key: 'instagram', title: 'Instagram', provider: 'meta', linked: !!conn.meta?.linked && !!meta.igUserId, tile: 'bg-[#d62976]', icon: <IconInstagram />,
      url: igUser ? `https://www.instagram.com/${igUser}/` : null, account: igUser ? `@${igUser}` : null,
      followers: igDay ? { n: igDay.instagram.followers_count, on: String(igDay._id) } : null },
    { key: 'facebook', title: 'Facebook', provider: 'meta', linked: !!conn.meta?.linked, tile: 'bg-[#1877f2]', icon: <IconFacebook />,
      url: fbUrl, account: meta.pageName || null },
    { key: 'youtube', title: 'YouTube', provider: 'google', linked: !!conn.google?.linked, tile: 'bg-[#e62117]', icon: <IconYouTube />,
      url: ytUrl, account: google.name || (links.youtube ? `@${at(links.youtube)}` : null), detail: google.name && google.handle ? google.handle : null },
    { key: 'tiktok', title: 'TikTok', provider: 'tiktok', linked: !!conn.tiktok?.linked, tile: 'bg-[#111111]', icon: <IconTikTok />,
      url: ttUser ? `https://www.tiktok.com/@${ttUser}` : null, account: ttUser ? `@${ttUser}` : null,
      detail: tiktok.name && at(tiktok.name) !== ttUser ? tiktok.name : null,
      followers: ttDay?.tiktok?.followers != null ? { n: ttDay.tiktok.followers, on: String(ttDay._id) } : null },
  ] satisfies Channel[] as Channel[]).filter(c => p.platforms.includes(c.key));

  const web = p.web ? (p.web.startsWith('http') ? p.web : `https://${p.web}`) : null;
  const own: Channel[] = [
    { key: 'web', title: 'Website', url: web, account: p.web ? bare(p.web) : null, tile: 'bg-accent', icon: <IconGlobe /> },
    links.appStore ? { key: 'appstore', title: 'App Store', url: links.appStore, account: 'iPhone en iPad', tile: 'bg-ink', icon: <IconPhone /> } : null,
    links.playStore ? { key: 'playstore', title: 'Google Play', url: links.playStore, account: 'Android', tile: 'bg-ink', icon: <IconPhone /> } : null,
  ].filter(Boolean) as Channel[];

  return (
    <div>
      <PageHeader title="Kanalen" sub={`Alle pagina's van ${p.name} op één plek. Links openen in een nieuw tabblad.`} />
      <h2 className="mt-8 text-lg font-bold">Social media</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{social.map(c => <ChannelCard key={c.key} c={c} project={project} />)}</div>
      <h2 className="mt-10 text-lg font-bold">Website en apps</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{own.map(c => <ChannelCard key={c.key} c={c} project={project} />)}</div>
    </div>
  );
}

function ChannelCard({ c, project }: { c: Channel; project: string }) {
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${c.tile}`} aria-hidden>{c.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{c.title}</h3>
          {c.provider && (c.linked
            ? <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-success ring-1 ring-emerald-200">Gekoppeld</span>
            : <span className="mt-1 inline-flex rounded-full bg-bg px-2 py-0.5 text-xs font-bold text-ink-muted ring-1 ring-line">Niet gekoppeld</span>)}
        </div>
      </div>
      <div className="mt-4 min-h-[3.5rem] text-sm">
        {c.account && <p className="truncate font-semibold text-ink" title={c.account}>{c.account}</p>}
        {c.detail && <p className="truncate text-ink-muted">{c.detail}</p>}
        {c.followers && <p className="text-ink-muted"><span className="font-semibold tabular-nums text-ink-body">{c.followers.n.toLocaleString('nl-NL')}</span> volgers <span className="text-xs">({onDay(c.followers.on)})</span></p>}
        {c.url && bare(c.url) !== c.account && <a href={c.url} target="_blank" rel="noopener noreferrer" className="block cursor-pointer truncate rounded text-xs text-ink-muted transition hover:text-accent-dark hover:underline">{bare(c.url)}</a>}
        {!c.url && <p className="text-ink-muted">Nog geen link bekend.</p>}
      </div>
      <div className="mt-auto space-y-2 pt-4">
        {c.url
          ? <a href={c.url} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'md', 'w-full')}>Open {c.title} <span aria-hidden>&#8599;</span></a>
          : <Button disabled className="w-full">Open {c.title}</Button>}
        {c.provider && !c.linked && (
          <Link href={`/${project}/settings#${c.provider}`} className={buttonClass('ghost', 'sm', 'w-full')}>Koppelen in Instellingen</Link>
        )}
      </div>
    </Card>
  );
}

// Simple glyphs (24x24, white on the coloured tile)
const svg = (children: ReactNode) => <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
const IconInstagram = () => svg(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></>);
const IconFacebook = () => svg(<path d="M15.5 4.5H14a3.5 3.5 0 0 0-3.5 3.5v13M8 11h7" />);
const IconYouTube = () => svg(<><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor" /></>);
const IconTikTok = () => svg(<><path d="M14.5 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14.5 3c.4 2.6 2.2 4.3 4.8 4.5" /></>);
const IconGlobe = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></>);
const IconPhone = () => svg(<><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" /></>);
