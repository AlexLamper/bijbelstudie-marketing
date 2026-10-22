import Link from 'next/link';
import { getDb, isoWeek, STATUS_LABEL } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const db = await getDb();
  const weeks = await db.collection('items').aggregate([
    { $group: { _id: { week: '$week', status: '$status' }, n: { $sum: 1 } } },
    { $group: { _id: '$_id.week', statuses: { $push: { k: '$_id.status', v: '$n' } }, total: { $sum: '$n' } } },
    { $sort: { _id: -1 } }, { $limit: 12 },
  ]).toArray();
  const now = isoWeek();
  const waiting = weeks.reduce((n, w) => n + (w.statuses.find((s: any) => s.k === 'review')?.v || 0), 0);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Studio</h1>
      <p className="mt-1 text-ink-muted">{waiting ? `${waiting} items wachten op je akkoord.` : 'Niets om te keuren - alles loopt.'}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {weeks.map(w => {
          const s = Object.fromEntries(w.statuses.map((x: any) => [x.k, x.v]));
          return (
            <Link key={w._id} href={`/week/${w._id}`} className="rounded-2xl border border-line bg-surface p-5 hover:border-teal">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold">Week {w._id.split('-W')[1]}</span>
                <span className="text-sm text-ink-muted">{w._id === now ? 'deze week' : w._id > now ? 'komend' : ''}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {Object.entries(s).map(([k, v]) => (
                  <span key={k} className={`rounded-full px-2.5 py-1 font-semibold ${k === 'review' ? 'bg-teal text-white' : 'bg-bg text-ink-body'}`}>{v as number} {STATUS_LABEL[k] || k}</span>
                ))}
              </div>
            </Link>
          );
        })}
        {!weeks.length && <p className="text-ink-muted">Nog geen content. De planner draait elke vrijdag, of start hem handmatig in GitHub Actions ("Plan week").</p>}
      </div>
    </div>
  );
}
