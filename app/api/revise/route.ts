import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

// "Aanpassingen naar Claude": with GITHUB_REPO + GITHUB_DISPATCH_TOKEN the Revise workflow starts at
// once; without them the studio sets a flag and the Publish workflow starts it within 30 minutes.
export async function POST() {
  const db = await getDb();
  const n = await db.collection('items').countDocuments({ status: 'changes' });
  if (!n) return NextResponse.json({ ok: true, message: 'Geen items met aanpassingen.' });
  const { GITHUB_REPO, GITHUB_DISPATCH_TOKEN } = process.env;
  if (GITHUB_REPO && GITHUB_DISPATCH_TOKEN) {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST', headers: { Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ event_type: 'revise' }),
    });
    if (r.ok) return NextResponse.json({ ok: true, message: `${n} items gaan nu naar Claude.` });
  }
  await db.collection('settings').updateOne({ _id: 'revise' as any }, { $set: { requested: true, requestedAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true, message: `${n} items gaan binnen 30 minuten naar Claude - je krijgt bericht als ze klaar zijn.` });
}
