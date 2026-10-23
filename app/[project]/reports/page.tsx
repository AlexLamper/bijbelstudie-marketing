import { getDb } from '@/lib/mongo';
import { Card, Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapporten' };

// Tiny markdown: headings, bullets, bold. Reports are written by the planner in a fixed shape.
function md(text: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/\*\*(.+?)\*\*/g, '<strong class="text-ink">$1</strong>');
  return text.split('\n').map(l => {
    if (/^#{1,3} /.test(l)) return `<h3 class="mt-6 text-lg font-bold text-ink">${esc(l.replace(/^#+ /, ''))}</h3>`;
    if (/^\s*[-*] /.test(l)) return `<li class="ml-5 mt-1 list-disc">${esc(l.replace(/^\s*[-*] /, ''))}</li>`;
    return l.trim() ? `<p class="mt-2">${esc(l)}</p>` : '';
  }).join('');
}

export default async function Reports({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  const reports = await (await getDb(project)).collection('reports').find().sort({ _id: -1 }).limit(12).toArray();
  return (
    <div>
      <PageHeader title="Weekrapporten" sub="Elke vrijdag schrijft de planner wat werkte, wat niet, en wat hij daarom verandert." />
      <div className="mt-6 space-y-5">
        {reports.map(r => (
          <Card key={String(r._id)} className="p-6 leading-relaxed text-ink-body">
            <h2 className="text-xl font-bold tracking-tight text-ink">Week {String(r._id).split('-W')[1]}</h2>
            <div dangerouslySetInnerHTML={{ __html: md(r.markdown) }} />
          </Card>
        ))}
        {!reports.length && <Empty>Het eerste rapport komt na de eerste gepubliceerde week.</Empty>}
      </div>
    </div>
  );
}
