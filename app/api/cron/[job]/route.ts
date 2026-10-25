import { NextResponse } from 'next/server';
import { readSecret } from '@/lib/secrets';
import { getSharedDb } from '@/lib/mongo';
import { PROJECTS } from '@/lib/projects';
import { safeEqual } from '@/lib/engine-auth';

export const dynamic = 'force-dynamic';

// Timer for the engine. GitHub's own schedules are unreliable (they can stay silent for hours), so
// Vercel Cron (vercel.json) calls this route and we start the GitHub workflow ourselves. Vercel sends
// Authorization: Bearer CRON_SECRET. The GitHub token (Actions: read and write on this repository) is
// pasted in the studio (Instellingen > Sleutels > GITHUB_DISPATCH_TOKEN).
const REPO = process.env.GITHUB_REPO || 'AlexLamper/marketing-engine';
const WORKFLOWS: Record<string, string> = { publish: 'publish.yml', stats: 'stats.yml', plan: 'plan-week.yml' };

export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const secret = process.env.CRON_SECRET;
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !got || !safeEqual(got, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const workflow = WORKFLOWS[job];
  if (!workflow) return NextResponse.json({ error: 'unknown job' }, { status: 404 });
  const token = await readSecret(PROJECTS[0]?.id || 'bijbelstudie', 'GITHUB_DISPATCH_TOKEN');
  const ticks = (await getSharedDb()).collection('ticks');
  if (!token) { await ticks.updateOne({ _id: job as any }, { $set: { at: new Date(), ok: false, note: 'GITHUB_DISPATCH_TOKEN ontbreekt' } }, { upsert: true }); return NextResponse.json({ error: 'GITHUB_DISPATCH_TOKEN is not set' }, { status: 503 }); }
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'marketing-studio' },
    body: JSON.stringify({ ref: 'main' }),
  });
  const ok = r.status === 204;
  const note = ok ? 'gestart' : `GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`;
  await ticks.updateOne({ _id: job as any }, { $set: { at: new Date(), ok, note } }, { upsert: true });
  return NextResponse.json({ ok, job, note }, { status: ok ? 200 : 502 });
}
