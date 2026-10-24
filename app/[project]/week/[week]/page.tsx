import Link from 'next/link';
import { getDb, type Item } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { DEFAULT_TZ } from '@/lib/postingSlots';
import { Empty, PageHeader } from '@/components/ui';
import ItemCard from './ItemCard';
import WeekActions from './WeekActions';

export const dynamic = 'force-dynamic';

const SCHEDULED = ['approved', 'published', 'partial'];

// One week of items. What is approved or online is grouped by the day it goes out; what still waits
// for a decision has no date yet (approving gives it the next free posting time), so it is listed first.
export default async function Week({ params }: { params: Promise<{ project: string; week: string }> }) {
  const { project, week } = await params;
  const tz = getProject(project)?.timezone || DEFAULT_TZ;
  const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
  const db = await getDb(project);
  const items = (await db.collection<Item>('items').find({ week }).sort({ slot: 1 }).toArray()) as Item[];
  const groups = new Map<string, Item[]>();
  const add = (k: string, it: Item) => groups.set(k, [...(groups.get(k) || []), it]);
  const open = items.filter(i => !SCHEDULED.includes(i.status) && i.status !== 'rejected');
  if (open.length) groups.set('Te beoordelen', open);
  for (const it of items.filter(i => SCHEDULED.includes(i.status))) add(DAY.format(new Date(it.slot)), it);
  const rejected = items.filter(i => i.status === 'rejected');
  if (rejected.length) groups.set('Afgewezen', rejected);
  const review = items.filter(i => i.status === 'review').length;
  const changes = items.filter(i => i.status === 'changes').length;

  return (
    <div>
      <Link href={`/${project}`} className="mb-3 inline-flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-ink-muted transition hover:text-ink">&larr; Overzicht</Link>
      <PageHeader title={`Week ${week.split('-W')[1]}`}
        sub={`${items.length} items - ${review} wachten op je akkoord${changes ? `, ${changes} worden aangepast` : ''}`}>
        <WeekActions project={project} week={week} review={review} changes={changes} />
      </PageHeader>
      {[...groups.entries()].map(([label, list]) => (
        <section key={label} className="mt-10">
          <h2 className="sticky top-16 z-10 -mx-4 bg-bg/90 px-4 py-2 text-sm font-bold uppercase tracking-widest text-ink-muted backdrop-blur">{label}</h2>
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(it => <ItemCard key={it._id} project={project} tz={tz} item={JSON.parse(JSON.stringify(it))} />)}
          </div>
        </section>
      ))}
      {!items.length && <div className="mt-6"><Empty>Deze week heeft nog geen items.</Empty></div>}
    </div>
  );
}
