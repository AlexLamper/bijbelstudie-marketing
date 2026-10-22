import { getDb } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

// Tiny markdown: headings, bullets, bold. Reports are written by the planner in a fixed shape.
function md(text: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return text.split('\n').map(l => {
    if (/^#{1,3} /.test(l)) return `<h3 class="mt-5 text-lg font-bold">${esc(l.replace(/^#+ /, ''))}</h3>`;
    if (/^\s*[-*] /.test(l)) return `<li class="ml-5 list-disc">${esc(l.replace(/^\s*[-*] /, ''))}</li>`;
    return l.trim() ? `<p class="mt-2">${esc(l)}</p>` : '';
  }).join('');
}

export default async function Reports() {
  const reports = await (await getDb()).collection('reports').find().sort({ _id: -1 }).limit(12).toArray();
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Weekrapporten</h1>
      <p className="mt-1 text-ink-muted">Elke vrijdag schrijft de planner wat werkte, wat niet, en wat hij daarom verandert.</p>
      {reports.map(r => (
        <article key={String(r._id)} className="mt-6 rounded-2xl border border-line bg-surface p-6 text-ink-body">
          <h2 className="text-xl font-bold text-ink">Week {String(r._id).split('-W')[1]}</h2>
          <div dangerouslySetInnerHTML={{ __html: md(r.markdown) }} />
        </article>
      ))}
      {!reports.length && <p className="mt-6 text-ink-muted">Het eerste rapport komt na de eerste gepubliceerde week.</p>}
    </div>
  );
}
