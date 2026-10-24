import { getDb } from '@/lib/mongo';
import { TRAIT, traitValue } from '@/lib/labels';
import { Card, Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Experimenten' };

type Row = { value: string; n: number; mean: number; avgViews: number | null; pBest: number; prior?: [number, number] };
const ORDER = ['format', 'postFormat', 'voice', 'voiceStyle', 'music', 'style', 'captions', 'hook', 'topic', 'length', 'time'];
const ago = (d: Date) => { const h = Math.round((Date.now() - new Date(d).getTime()) / 3600e3); return h < 1 ? 'zojuist' : h < 48 ? `${h} uur geleden` : `${Math.round(h / 24)} dagen geleden`; };

// The latest allocation is for one day (alloc.date); older ones were for a week (alloc.week only).
const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const allocLabel = (a: any) => a.date ? DAY.format(new Date(`${a.date}T12:00:00Z`)) : String(a.week).replace(/^\d{4}-W/, 'week ');

function nextPlan(alloc: any, trait: string): Record<string, number> {
  if (!alloc) return {};
  if (trait === 'format') { const o: Record<string, number> = {}; for (const g of [alloc.mainReels?.format, alloc.extraReels?.format]) for (const [k, v] of Object.entries(g || {})) o[k] = (o[k] || 0) + (v as number); return o; }
  if (trait === 'postFormat') return alloc.feedPosts?.format || {};
  return alloc.targets?.[trait] || {};
}

export default async function Experiments({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  const db = await getDb(project);
  const doc: any = await db.collection('experiments').findOne({ _id: 'board' as any });
  const alloc: any = (await db.collection('experiments').find({ _id: { $regex: '^allocation-' } as any }).sort({ at: -1 }).limit(1).toArray())[0];
  const board: Record<string, Row[]> = doc?.board || {};
  const traits = ORDER.filter(t => board[t]?.length);

  return (
    <div>
      <PageHeader title="Experimenten" sub="Wat het best werkt, eerlijk vergeleken. Winnaars krijgen de volgende dagen meer plekken; een deel blijft altijd nieuwe dingen proberen." />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[['Gemeten resultaten', doc ? `${doc.trials}` : '-', doc ? `van ${doc.items} posts, per platform` : 'nog niets gemeten'],
          ['Bijgewerkt', doc ? ago(doc.at) : '-', 'elke ochtend opnieuw berekend'],
          ['Volgende verdeling', alloc ? allocLabel(alloc) : '-', alloc ? `${(alloc.mainReels?.slots || 0) + (alloc.extraReels?.slots || 0)} reels, ${alloc.feedPosts?.slots || 0} ${alloc.feedPosts?.slots === 1 ? 'feedpost' : 'feedposts'}` : 'maakt de planner elke ochtend']].map(([l, v, s]) => (
          <Card key={l} className="p-5"><p className="text-sm text-ink-muted">{l}</p><p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{v}</p><p className="mt-1 text-xs text-ink-muted">{s}</p></Card>
        ))}
      </div>

      {!doc?.trials && <div className="mt-6"><Empty>Nog geen resultaten. Een post telt mee zodra hij 48 uur online staat. Tot die tijd verdeelt de planner de plekken gelijk, zodat alles een eerlijke kans krijgt.</Empty></div>}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {traits.map(t => {
          const next = nextPlan(alloc, t);
          return (
            <Card key={t} className="overflow-hidden">
              <h2 className="border-b border-line px-4 py-3 font-bold">{TRAIT[t] || t}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-ink-muted">
                    <tr><th className="px-4 py-2 font-semibold">Variant</th><th className="px-2 py-2 text-right font-semibold" title="Gemeten resultaten (post x platform)">n</th>
                      <th className="px-2 py-2 font-semibold" title="Gemiddelde score: 50 = de mediaan van dat platform">Score</th><th className="px-2 py-2 text-right font-semibold">Views</th>
                      <th className="px-2 py-2 font-semibold" title="Kans dat dit de beste variant is">Kans beste</th>{alloc && <th className="px-4 py-2 text-right font-semibold" title={alloc.date ? 'Plekken op de volgende geplande dag' : 'Plekken in de volgende geplande week'}>{alloc.date ? 'Volgende dag' : 'Volgende week'}</th>}</tr>
                  </thead>
                  <tbody>
                    {board[t].map(r => {
                      const score = Math.round(r.mean * 100);
                      return (
                        <tr key={r.value} className="border-t border-line transition hover:bg-bg/60">
                          <td className="px-4 py-2 font-medium">{traitValue(t, r.value)}{r.prior && <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent" title="Krijgt een voorsprong omdat jij dit verwacht te werken (project.json experimentPriors). Echte resultaten wegen snel zwaarder.">voorkeur</span>}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{r.n}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2"><div className="relative h-2 w-20 overflow-hidden rounded-full bg-bg ring-1 ring-line">
                              <div className={`absolute inset-y-0 left-0 rounded-full ${score >= 55 ? 'bg-success' : score <= 45 ? 'bg-warn' : 'bg-ink-muted'}`} style={{ width: `${score}%` }} />
                              <div className="absolute inset-y-0 left-1/2 w-px bg-ink-muted/50" /></div>
                              <span className="tabular-nums text-xs">{r.n ? score : '-'}</span></div>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{r.avgViews ?? '-'}</td>
                          <td className="px-2 py-2"><div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded-full bg-bg ring-1 ring-line"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(r.pBest * 100)}%` }} /></div><span className="tabular-nums text-xs">{Math.round(r.pBest * 100)}%</span></div></td>
                          {alloc && <td className="px-4 py-2 text-right font-semibold tabular-nums">{next[r.value] || '-'}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8 p-5 text-sm text-ink-body">
        <h2 className="font-bold text-ink">Hoe dit werkt</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Elke post wordt per platform vergeleken met de mediaan van dat platform (reels met reels, posts met posts), 48 uur nadat hij online staat. Score 50 = precies gemiddeld; dubbel zoveel views is ongeveer 75.</li>
          <li>De score telt views (60%) en reacties, delen en bewaren per view (40%).</li>
          <li>&quot;Kans beste&quot; is de kans dat een variant echt de beste is, gegeven wat we tot nu toe zagen. Met weinig metingen ligt die dicht bij elkaar.</li>
          <li>Per geplande dag: een vast deel van de plekken wordt gelijk verdeeld (blijven proberen), de rest naar kans. Een dag heeft maar een paar plekken, dus er wordt met die kansen geloot: over de dagen krijgt elke variant zijn deel. Instagram en Facebook krijgen vooral wat werkt; TikTok en YouTube proberen meer nieuwe dingen.</li>
        </ul>
      </Card>
    </div>
  );
}
