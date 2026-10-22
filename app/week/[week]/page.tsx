import { getDb, type Item } from '@/lib/mongo';
import ItemCard from './ItemCard';
import WeekActions from './WeekActions';

export const dynamic = 'force-dynamic';

const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });

export default async function Week({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const db = await getDb();
  const items = (await db.collection<Item>('items').find({ week }).sort({ slot: 1 }).toArray()) as Item[];
  const byDay = new Map<string, Item[]>();
  for (const it of items) { const d = DAY.format(new Date(it.slot)); byDay.set(d, [...(byDay.get(d) || []), it]); }
  const review = items.filter(i => i.status === 'review').length;
  const changes = items.filter(i => i.status === 'changes').length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Week {week.split('-W')[1]}</h1>
          <p className="mt-1 text-ink-muted">{items.length} items - {review} wachten op je akkoord{changes ? `, ${changes} worden aangepast` : ''}</p>
        </div>
        <WeekActions week={week} review={review} />
      </div>
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-muted">{day}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(it => <ItemCard key={it._id} item={JSON.parse(JSON.stringify(it))} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
