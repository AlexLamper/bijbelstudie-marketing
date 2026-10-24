import type { ReactNode } from 'react';
import { getDb, type Item } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { DEFAULT_TZ, pileOrder } from '@/lib/postingSlots';
import { Empty, PageHeader } from '@/components/ui';
import ItemCard from './week/[week]/ItemCard';
import WeekActions from './week/[week]/WeekActions';

export const dynamic = 'force-dynamic';

const ONLINE_SHOWN = 12;

// The project overview, by decision and without dates: what waits for Alex, the pile of approved items
// (every day the next ones go online by themselves, lib/postingSlots.ts) and what is already online.
export default async function Overview({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params; const p = getProject(project)!;
  const tz = p.timezone || DEFAULT_TZ;
  const db = await getDb(project); const items = db.collection<Item>('items');
  const [open, pile, online, onlineTotal, making] = await Promise.all([
    items.find({ status: { $in: ['review', 'changes', 'failed'] } }).limit(100).toArray(),
    items.find({ status: 'approved' }).limit(200).toArray(),
    items.find({ status: { $in: ['published', 'partial'] } }).sort({ publishedAt: -1, slot: -1 }).limit(ONLINE_SHOWN).toArray(),
    items.countDocuments({ status: { $in: ['published', 'partial'] } }),
    items.countDocuments({ status: { $in: ['queued', 'rendering'] } }),
  ]);
  // newest planning batch first; within a batch in the planner's order
  const batch = (it: Item) => Math.floor(new Date(it.createdAt || it.updatedAt || it.slot).getTime() / 3600e3);
  const toReview = (open as Item[]).sort((a, b) => batch(b) - batch(a) || +new Date(a.slot) - +new Date(b.slot));
  const review = toReview.filter(i => i.status === 'review').length;
  const changes = toReview.filter(i => i.status === 'changes').length;

  const stack = (pile as Item[]).sort(pileOrder);
  const card = (it: Item) => <ItemCard key={it._id} project={project} tz={tz} item={JSON.parse(JSON.stringify(it))} />;

  return (
    <div>
      <PageHeader title="Content"
        sub={review ? <><strong className="text-ink">{review} {review === 1 ? 'item wacht' : 'items wachten'}</strong> op je akkoord. Wat je goedkeurt, gaat op de stapel en vanzelf online.</> : 'Niets om te keuren - alles loopt.'}>
        {changes > 0 && <WeekActions project={project} changes={changes} />}
      </PageHeader>

      <Section title="Te beoordelen" count={toReview.length}
        sub={making ? `${making} ${making === 1 ? 'item wordt' : 'items worden'} nog gemaakt en ${making === 1 ? 'komt' : 'komen'} hier zodra ze klaar zijn.` : undefined}>
        {toReview.length ? <Grid>{toReview.map(card)}</Grid>
          : <Empty>Niets te beoordelen.{!stack.length && !online.length && <> De planner maakt elke ochtend nieuwe content, of start hem in GitHub Actions bij <strong>Plan day</strong> (project: <code>{project}</code>).</>}</Empty>}
      </Section>

      <Section title="Goedgekeurd" count={stack.length} sub="De stapel. Elke dag gaat er vanzelf iets van online: een vers, een post en een paar reels, steeds wat het langst ligt.">
        {stack.length ? <Grid>{stack.map(card)}</Grid> : <Empty>De stapel is leeg - keur iets goed, dan gaat het vanzelf online.</Empty>}
      </Section>

      <Section title="Online" count={onlineTotal} sub={onlineTotal > ONLINE_SHOWN ? `De laatste ${ONLINE_SHOWN}. Klik op een platform om de post te openen.` : 'Klik op een platform om de post te openen.'}>
        {online.length ? <Grid>{(online as Item[]).map(card)}</Grid> : <Empty>Nog niets online.</Empty>}
      </Section>

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
