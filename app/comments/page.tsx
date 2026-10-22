import { getDb } from '@/lib/mongo';
import CommentRow from './CommentRow';

export const dynamic = 'force-dynamic';

export default async function Comments() {
  const list = await (await getDb()).collection('comments').find({ status: 'new' }).sort({ timestamp: -1 }).limit(100).toArray();
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Reacties</h1>
      <p className="mt-1 text-ink-muted">Nieuwe reacties met een conceptantwoord. Kopieer het, plaats het zelf, en vink af.</p>
      <div className="mt-6 space-y-3">
        {list.map(c => <CommentRow key={String(c._id)} c={JSON.parse(JSON.stringify(c))} />)}
        {!list.length && <p className="text-ink-muted">Geen nieuwe reacties.</p>}
      </div>
    </div>
  );
}
