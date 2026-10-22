import { getDb } from '@/lib/mongo';

export const dynamic = 'force-dynamic';
const sum = (it: any, k: string) => (it.metrics?.instagram?.[k] || 0) + (it.metrics?.youtube?.[k === 'saved' ? '_' : k] || 0);

export default async function Stats() {
  const db = await getDb();
  const days = await db.collection('metrics').find().sort({ _id: -1 }).limit(30).toArray();
  const items = await db.collection('items').find({ status: { $in: ['published', 'partial'] } }).sort({ slot: -1 }).limit(60).toArray();
  const groups = new Map<string, { n: number; views: number; saves: number }>();
  for (const it of items) for (const key of [`soort: ${it.kind}`, it.spec.experiment?.feedType && `feed: ${it.spec.experiment.feedType}`, it.spec.experiment?.voice && `stem: ${it.spec.experiment.voice}`, it.spec.experiment?.hook && `hook: ${it.spec.experiment.hook}`].filter(Boolean) as string[]) {
    const g = groups.get(key) || { n: 0, views: 0, saves: 0 }; g.n++; g.views += sum(it, 'views'); g.saves += sum(it, 'saved'); groups.set(key, g);
  }
  const latest = days[0];
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Cijfers</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[['Volgers Instagram', latest?.instagram?.followers_count], ['Gebruikers BijbelStudie', latest?.users?.total], ['Nieuwe gebruikers gisteren', latest?.users?.newYesterday]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl border border-line bg-surface p-5"><p className="text-sm text-ink-muted">{l}</p><p className="mt-1 text-3xl font-bold">{v ?? '-'}</p></div>
        ))}
      </div>
      <h2 className="mt-8 text-lg font-bold">Wat werkt (gemiddeld per item, laatste 60)</h2>
      <table className="mt-3 w-full overflow-hidden rounded-2xl border border-line bg-surface text-sm">
        <thead className="bg-bg text-left text-ink-muted"><tr><th className="p-3">Groep</th><th className="p-3">Items</th><th className="p-3">Views</th><th className="p-3">Saves</th></tr></thead>
        <tbody>{[...groups.entries()].sort((a, b) => b[1].views / b[1].n - a[1].views / a[1].n).map(([k, g]) => (
          <tr key={k} className="border-t border-line"><td className="p-3">{k}</td><td className="p-3">{g.n}</td><td className="p-3">{Math.round(g.views / g.n)}</td><td className="p-3">{Math.round(g.saves / g.n)}</td></tr>
        ))}</tbody>
      </table>
      {!items.length && <p className="mt-3 text-ink-muted">Cijfers verschijnen zodra er iets gepubliceerd is.</p>}
    </div>
  );
}
