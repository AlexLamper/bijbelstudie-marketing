import Link from 'next/link';
import type { ReactNode } from 'react';
import { getDb, isoWeek, type Item } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { STATUS } from '@/lib/labels';
import { DEFAULT_TZ, daysFromToday } from '@/lib/postingSlots';
import { Empty, PageHeader } from '@/components/ui';
import ItemCard from './week/[week]/ItemCard';
import WeekActions from './week/[week]/WeekActions';

export const dynamic = 'force-dynamic';

const ORDER = ['review', 'changes', 'queued', 'rendering', 'approved', 'published', 'partial', 'failed', 'rejected'];
const ONLINE_SHOWN = 12;

// The project overview, by decision instead of by date: what waits for Alex, what is approved and
// when it goes out (approving gives the next free posting time), and what is already online.
// The week pages stay reachable at the bottom.
export default async function Overview({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params; const p = getProject(project)!;
  const tz = p.timezone || DEFAULT_TZ;
  const db = await getDb(project); const items = db.collection<Item>('items');
  const [open, scheduled, online, onlineTotal, making, weeks] = await Promise.all([
    items.find({ status: { $in: ['review', 'changes', 'failed'] } }).limit(100).toArray(),
    items.find({ status: 'approved' }).sort({ slot: 1 }).limit(100).toArray(),
    items.find({ status: { $in: ['published', 'partial'] } }).sort({ publishedAt: -1, slot: -1 }).limit(ONLINE_SHOWN).toArray(),
    items.countDocuments({ status: { $in: ['published', 'partial'] } }),
    items.countDocuments({ status: { $in: ['queued', 'rendering'] } }),
    items.aggregate([
      { $group: { _id: { week: '$week', status: '$status' }, n: { $sum: 1 } } },
      { $group: { _id: '$_id.week', statuses: { $push: { k: '$_id.status', v: '$n' } }, total: { $sum: '$n' } } },
      { $sort: { _id: -1 } }, { $limit: 16 },
    ]).toArray(),
  ]);
  // newest planning batch first; within a batch in the planner's order
  const batch = (it: Item) => Math.floor(new Date(it.createdAt || it.updatedAt || it.slot).getTime() / 3600e3);
  const toReview = (open as Item[]).sort((a, b) => batch(b) - batch(a) || +new Date(a.slot) - +new Date(b.slot));
  const review = toReview.filter(i => i.status === 'review').length;
  const changes = toReview.filter(i => i.status === 'changes').length;

  // approved items by the day they go out
  const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
  const now = new Date();
  const days = new Map<string, Item[]>();
  for (const it of scheduled as Item[]) {
    const k = daysFromToday(it.slot, { now, tz });
    const label = new Date(it.slot) <= now ? 'Nu aan de beurt' : k === 0 ? 'Vandaag' : k === 1 ? 'Morgen' : DAY.format(new Date(it.slot));
    days.set(label, [...(days.get(label) || []), it]);
  }
  const card = (it: Item) => <ItemCard key={it._id} project={project} tz={tz} item={JSON.parse(JSON.stringify(it))} />;
  const thisWeek = isoWeek();

  return (
    <div>
      <PageHeader title="Content"
        sub={review ? <><strong className="text-ink">{review} {review === 1 ? 'item wacht' : 'items wachten'}</strong> op je akkoord. Wat je goedkeurt, gaat de eerstvolgende vrije tijd online.</> : 'Niets om te keuren - alles loopt.'}>
        {changes > 0 && <WeekActions project={project} changes={changes} />}
      </PageHeader>

      <Section title="Te beoordelen" count={toReview.length}
        sub={making ? `${making} ${making === 1 ? 'item wordt' : 'items worden'} nog gemaakt en ${making === 1 ? 'komt' : 'komen'} hier zodra ze klaar zijn.` : undefined}>
        {toReview.length ? <Grid>{toReview.map(card)}</Grid>
          : <Empty>Niets te beoordelen.{!weeks.length && <> De planner maakt elke ochtend nieuwe content, of start hem in GitHub Actions bij <strong>Plan day</strong> (project: <code>{project}</code>).</>}</Empty>}
      </Section>

      <Section title="Ingepland" count={scheduled.length} sub="Goedgekeurd en op volgorde van de tijd dat ze online gaan.">
        {scheduled.length ? [...days.entries()].map(([label, list]) => (
          <div key={label} className="mt-5 first:mt-0">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-ink-muted">{label}</h3>
            <Grid>{list.map(card)}</Grid>
          </div>
        )) : <Empty>Nog niets ingepland. Keur iets goed, dan gaat het de eerstvolgende vrije tijd online.</Empty>}
      </Section>

      <Section title="Online" count={onlineTotal} sub={onlineTotal > ONLINE_SHOWN ? `De laatste ${ONLINE_SHOWN}; oudere staan per week hieronder.` : 'Klik op een platform om de post te openen.'}>
        {online.length ? <Grid>{(online as Item[]).map(card)}</Grid> : <Empty>Nog niets online.</Empty>}
      </Section>

      {weeks.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-bold">Per week</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {weeks.map(w => {
              const s: Record<string, number> = Object.fromEntries(w.statuses.map((x: any) => [x.k, x.v]));
              const counts = ORDER.filter(k => s[k]).map(k => `${s[k]} ${STATUS[k]?.label.toLowerCase() ?? k}`).join(', ');
              return (
                <Link key={w._id} href={`/${project}/week/${w._id}`} title={counts}
                  className="cursor-pointer rounded-xl border border-line bg-surface px-3.5 py-2 text-sm shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lift)]">
                  <span className="font-semibold">Week {String(w._id).split('-W')[1]}</span>
                  <span className="ml-2 text-ink-muted">{w._id === thisWeek ? 'deze week - ' : ''}{w.total} items{s.review ? `, ${s.review} te keuren` : ''}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Section({ title, count, sub, children }: { title: string; count: number; sub?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-bold tracking-tight">{title} <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-sm font-semibold text-ink-muted ring-1 ring-line">{count}</span></h2>
        {sub && <p className="text-sm text-ink-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
