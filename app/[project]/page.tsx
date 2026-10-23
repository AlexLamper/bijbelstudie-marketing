import Link from 'next/link';
import { getDb, isoWeek } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { STATUS } from '@/lib/labels';
import { Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ORDER = ['review', 'changes', 'queued', 'rendering', 'approved', 'published', 'partial', 'failed', 'rejected'];

export default async function Weeks({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params; const p = getProject(project)!;
  const db = await getDb(project);
  const weeks = await db.collection('items').aggregate([
    { $group: { _id: { week: '$week', status: '$status' }, n: { $sum: 1 } } },
    { $group: { _id: '$_id.week', statuses: { $push: { k: '$_id.status', v: '$n' } }, total: { $sum: '$n' } } },
    { $sort: { _id: -1 } }, { $limit: 12 },
  ]).toArray();
  const now = isoWeek();
  const waiting = weeks.reduce((n, w) => n + (w.statuses.find((s: any) => s.k === 'review')?.v || 0), 0);

  return (
    <div>
      <PageHeader title="Content" sub={waiting ? <><strong className="text-ink">{waiting} items</strong> wachten op je akkoord.</> : 'Niets om te keuren - alles loopt.'} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {weeks.map(w => {
          const s: Record<string, number> = Object.fromEntries(w.statuses.map((x: any) => [x.k, x.v]));
          const done = (s.approved || 0) + (s.published || 0) + (s.partial || 0) + (s.rejected || 0);
          const label = w._id === now ? 'Deze week' : w._id > now ? 'Komend' : '';
          return (
            <Link key={w._id} href={`/${project}/week/${w._id}`}
              className="group cursor-pointer rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lift)]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold tracking-tight">Week {w._id.split('-W')[1]}</span>
                {label && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${label === 'Deze week' ? 'bg-accent-soft text-accent-dark' : 'bg-bg text-ink-muted ring-1 ring-line'}`}>{label}</span>}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg" title={`${done} van ${w.total} beoordeeld`}>
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(100 * done / w.total)}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ORDER.filter(k => s[k]).map(k => (
                  <span key={k} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[k]?.tone ?? 'bg-bg'}`}>{s[k]} {STATUS[k]?.label.toLowerCase() ?? k}</span>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold text-accent-dark opacity-80 transition group-hover:opacity-100">{s.review ? 'Keuren' : 'Bekijken'} &rarr;</p>
            </Link>
          );
        })}
      </div>
      {!weeks.length && (
        <Empty>
          Nog geen content voor {p.name}. De planner draait elke vrijdag, of start hem in GitHub Actions bij <strong>Plan week</strong> (project: <code>{project}</code>).
        </Empty>
      )}
    </div>
  );
}
