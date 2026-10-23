import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';

// PUT { instagram: ["username", ...] }: accounts the planner learns from (read weekly via Business Discovery).
export async function PUT(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { instagram } = await req.json().catch(() => ({}));
  const list = [...new Set((Array.isArray(instagram) ? instagram : String(instagram || '').split(/[\s,]+/))
    .map((u: string) => u.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase()).filter(Boolean))];
  if (list.length > 30 || list.some(u => !/^[a-z0-9._]{1,30}$/.test(u))) return NextResponse.json({ error: 'Maximaal 30 geldige Instagram-gebruikersnamen.' }, { status: 400 });
  await (await getDb(project)).collection('settings').updateOne({ _id: 'competitors' as any }, { $set: { instagram: list, updatedAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true, instagram: list });
}
