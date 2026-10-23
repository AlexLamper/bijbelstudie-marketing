import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { KIND } from '@/lib/labels';
import { Card, Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cijfers' };
const sum = (it: any, k: string) => (it.metrics?.instagram?.[k] || 0) + (k === 'saved' ? 0 : it.metrics?.youtube?.[k] || 0);

export default async function Stats({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params; const p = getProject(project)!;
  const db = await getDb(project);
  const days = await db.collection('metrics').find().sort({ _id: -1 }).limit(30).toArray();
  const items = await db.collection('items').find({ status: { $in: ['published', 'partial'] } }).sort({ slot: -1 }).limit(60).toArray();
  const groups = new Map<string, { n: number; views: number; saves: number }>();
  for (const it of items) for (const key of [`Soort: ${KIND[it.kind] || it.kind}`, it.spec.experiment?.feedType && `Feed: ${it.spec.experiment.feedType}`, it.spec.experiment?.voice && `Stem: ${it.spec.experiment.voice}`, it.spec.experiment?.hook && `Hook: ${it.spec.experiment.hook}`].filter(Boolean) as string[]) {
    const g = groups.get(key) || { n: 0, views: 0, saves: 0 }; g.n++; g.views += sum(it, 'views'); g.saves += sum(it, 'saved'); groups.set(key, g);
  }
  const latest = days[0];
  const rows = [...groups.entries()].sort((a, b) => b[1].views / b[1].n - a[1].views / a[1].n);
  return (
    <div>
      <PageHeader title="Cijfers" sub="Wat het oplevert, en welke soorten content het best werken." />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[['Volgers Instagram', latest?.instagram?.followers_count], [`Gebruikers ${p.name}`, latest?.users?.total], ['Nieuwe gebruikers gisteren', latest?.users?.newYesterday]].map(([l, v]) => (
          <Card key={l as string} className="p-5"><p className="text-sm text-ink-muted">{l}</p><p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{v ?? '-'}</p></Card>
        ))}
      </div>
      <h2 className="mt-10 text-lg font-bold">Wat werkt <span className="font-normal text-ink-muted">- gemiddeld per item, laatste 60</span></h2>
      {rows.length ? (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-left text-ink-muted"><tr><th className="p-3 font-semibold">Groep</th><th className="p-3 text-right font-semibold">Items</th><th className="p-3 text-right font-semibold">Views</th><th className="p-3 text-right font-semibold">Saves</th></tr></thead>
            <tbody>{rows.map(([k, g]) => (
              <tr key={k} className="border-t border-line transition hover:bg-bg/60"><td className="p-3">{k}</td><td className="p-3 text-right tabular-nums">{g.n}</td><td className="p-3 text-right tabular-nums">{Math.round(g.views / g.n)}</td><td className="p-3 text-right tabular-nums">{Math.round(g.saves / g.n)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      ) : <div className="mt-3"><Empty>Cijfers verschijnen zodra er iets gepubliceerd is.</Empty></div>}
    </div>
  );
}
