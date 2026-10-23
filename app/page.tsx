import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PROJECTS } from '@/lib/projects';
import { getDb, isoWeek } from '@/lib/mongo';
import { ProjectMark, StudioMark } from '@/components/ui';

export const dynamic = 'force-dynamic';

// All projects at a glance. With a single project the studio opens it straight away.
export default async function Overview() {
  if (PROJECTS.length === 1) redirect(`/${PROJECTS[0].id}`);
  const week = isoWeek();
  const rows = await Promise.all(PROJECTS.map(async p => {
    try {
      const items = (await getDb(p.id)).collection('items');
      const [review, approved, thisWeek] = await Promise.all([
        items.countDocuments({ status: 'review' }), items.countDocuments({ status: 'approved' }), items.countDocuments({ week })]);
      return { p, review, approved, thisWeek, error: '' };
    } catch (e: any) { return { p, review: 0, approved: 0, thisWeek: 0, error: e.message as string }; }
  }));

  return (
    <div className="min-h-dvh bg-bg">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <StudioMark />
          <span className="text-[15px] font-bold tracking-tight">Studio</span>
          <span className="text-sm text-white/50">alle projecten</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">Projecten</h1>
        <p className="mt-1 text-ink-muted">Eén studio voor al je merken. Kies een project om te keuren.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ p, review, approved, thisWeek, error }) => (
            <Link key={p.id} href={`/${p.id}`}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] transition duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lift)]">
              <div className="flex items-center gap-3 p-5" style={{ background: p.theme.panel }}>
                <ProjectMark name={p.name} src={p.logo.mark} className="h-11 w-11" />
                <div className="min-w-0 flex-1 text-white">
                  <p className="truncate text-lg font-bold tracking-tight">{p.name}</p>
                  <p className="truncate text-sm text-white/60">{p.web || p.tagline}</p>
                </div>
                <svg viewBox="0 0 20 20" className="h-5 w-5 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" fill="currentColor" aria-hidden><path d="M7.2 4.2a.75.75 0 0 1 1.06 0l5.27 5.27a.75.75 0 0 1 0 1.06L8.26 15.8a.75.75 0 1 1-1.06-1.06L11.94 10 7.2 5.26a.75.75 0 0 1 0-1.06Z" /></svg>
              </div>
              <div className="flex flex-wrap items-center gap-2 p-5 text-sm">
                {!p.enabled ? <span className="rounded-full bg-bg px-2.5 py-1 font-semibold text-ink-muted ring-1 ring-line">Staat nog uit</span>
                  : error ? <span className="text-danger">Database niet bereikbaar</span>
                  : <>
                      <span className="rounded-full px-2.5 py-1 font-bold text-white" style={{ background: review ? p.theme.accent : '#9ca3af' }}>{review} te keuren</span>
                      <span className="rounded-full bg-bg px-2.5 py-1 font-semibold text-ink-body ring-1 ring-line">{approved} ingepland</span>
                      <span className="text-ink-muted">{thisWeek} deze week</span>
                    </>}
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-sm text-ink-muted">Nieuw project? <code className="rounded bg-surface px-1.5 py-0.5 ring-1 ring-line">npm run new-project -- &lt;id&gt; --name &quot;Naam&quot;</code> - zie README.</p>
      </main>
    </div>
  );
}

