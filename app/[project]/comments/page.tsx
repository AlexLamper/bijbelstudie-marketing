import { getDb } from '@/lib/mongo';
import { Empty, PageHeader } from '@/components/ui';
import CommentRow from './CommentRow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reacties' };

export default async function Comments({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  const list = await (await getDb(project)).collection('comments').find({ status: 'new' }).sort({ timestamp: -1 }).limit(100).toArray();
  return (
    <div>
      <PageHeader title="Reacties" sub="Nieuwe reacties met een conceptantwoord. Kopieer het, plaats het zelf, en vink af." />
      <div className="mt-6 space-y-3">
        {list.map(c => <CommentRow key={String(c._id)} project={project} c={JSON.parse(JSON.stringify(c))} />)}
        {!list.length && <Empty>Geen nieuwe reacties.</Empty>}
      </div>
    </div>
  );
}
