import Link from 'next/link';
import { getDb, type Item } from '@/lib/mongo';
import { Empty, PageHeader } from '@/components/ui';
import ItemCard from './ItemCard';
import WeekActions from './WeekActions';

export const dynamic = 'force-dynamic';

const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });

export default async function Week({ params }: { params: Promise<{ project: string; week: string }> }) {
  const { project, week } = await params;
  const db = await getDb(project);
  const items = (await db.collection<Item>('items').find({ week }).sort({ slot: 1 }).toArray()) as Item[];
  const byDay = new Map<string, Item[]>();
  for (const it of items) { const d = DAY.format(new Date(it.slot)); byDay.set(d, [...(byDay.get(d) || []), it]); }
  const review = items.filter(i => i.status === 'review').length;
  const changes = items.filter(i => i.status === 'changes').length;

  return (
    <div>
      <Link href={`/${project}`} className="mb-3 inline-flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-ink-muted transition hover:text-ink">&larr; Alle weken</Link>
      <PageHeader title={`Week ${week.split('-W')[1]}`}
        sub={`${items.length} items - ${review} wachten op je akkoord${changes ? `, ${changes} worden aangepast` : ''}`}>
        <WeekActions project={project} week={week} review={review} changes={changes} />
      </PageHeader>
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="mt-10">
          <h2 className="sticky top-16 z-10 -mx-4 bg-bg/90 px-4 py-2 text-sm font-bold uppercase tracking-widest text-ink-muted backdrop-blur">{day}</h2>
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(it => <ItemCard key={it._id} project={project} item={JSON.parse(JSON.stringify(it))} />)}
          </div>
        </section>
      ))}
      {!items.length && <div className="mt-6"><Empty>Deze week heeft nog geen items.</Empty></div>}
    </div>
  );
}
