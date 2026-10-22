import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

// Starts the "Revise" GitHub Action: Claude rewrites every item marked "Aanpassen", then it re-renders.
// Env: GITHUB_REPO (e.g. AlexLamper/bijbelstudie-marketing), GITHUB_DISPATCH_TOKEN (fine-grained PAT, Contents: read/write on that repo).
export async function POST() {
  const db = await getDb();
  const n = await db.collection('items').countDocuments({ status: 'changes' });
  if (!n) return NextResponse.json({ ok: true, message: 'Geen items met aanpassingen.' });
  const { GITHUB_REPO, GITHUB_DISPATCH_TOKEN } = process.env;
  if (!GITHUB_REPO || !GITHUB_DISPATCH_TOKEN) return NextResponse.json({ ok: false, message: 'GITHUB_REPO / GITHUB_DISPATCH_TOKEN ontbreken' }, { status: 500 });
  const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST', headers: { Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ event_type: 'revise' }),
  });
  if (!r.ok) return NextResponse.json({ ok: false, message: `GitHub ${r.status}` }, { status: 502 });
  return NextResponse.json({ ok: true, message: `${n} items gaan naar Claude - je krijgt een mail als ze klaar zijn.` });
}
