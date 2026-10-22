import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export async function POST(req: Request) {
  const { week } = await req.json();
  const db = await getDb();
  const r = await db.collection('items').updateMany({ week, status: 'review' },
    { $set: { status: 'approved', updatedAt: new Date() }, $push: { history: { at: new Date(), event: 'approve-all' } } as any });
  return NextResponse.json({ ok: true, message: `${r.modifiedCount} goedgekeurd` });
}
