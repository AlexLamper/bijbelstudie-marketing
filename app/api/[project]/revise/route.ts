import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';

// "Aanpassingen naar Claude": with GITHUB_REPO + GITHUB_DISPATCH_TOKEN the Revise workflow starts at
// once for this project; without them the studio sets a flag in the project's database and the
// Publish workflow starts it within 30 minutes.
export async function POST(_req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const db = await getDb(project);
  const n = await db.collection('items').countDocuments({ status: 'changes' });
  if (!n) return NextResponse.json({ ok: true, message: 'Geen items met aanpassingen.' });
  const { GITHUB_REPO, GITHUB_DISPATCH_TOKEN } = process.env;
  if (GITHUB_REPO && GITHUB_DISPATCH_TOKEN) {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST', headers: { Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ event_type: 'revise', client_payload: { project } }),
    });
    if (r.ok) return NextResponse.json({ ok: true, message: `${n} items gaan nu naar Claude.` });
  }
  await db.collection('settings').updateOne({ _id: 'revise' as any }, { $set: { requested: true, requestedAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true, message: `${n} items gaan binnen 30 minuten naar Claude - je krijgt bericht als ze klaar zijn.` });
}
