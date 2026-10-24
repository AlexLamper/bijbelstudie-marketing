import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { postPlatforms } from '@/lib/postingSlots';

const NEXT: Record<string, string> = { approve: 'approved', changes: 'changes', reject: 'rejected', reset: 'review' };
const LONG_DASH = /[–—]/;

// PATCH { action: approve | changes (+comment) | reject | reset }       review decisions; approve puts the item
//                                                                        on the pile (no date: the publish job
//                                                                        takes from it every day, lib/postingSlots.ts)
// PATCH { action: 'edit', caption, hashtags }                            fix the text yourself, no Claude round trip
// PATCH { action: 'now' }                                                post an approved item at the next run
// PATCH { action: 'retry' }                                              posting failed: try the failed platforms again at the next run
// PATCH { action: 'rerender' }                                           make the media again (e.g. after choosing voices)
export async function PATCH(req: Request, { params }: { params: Promise<{ project: string; id: string }> }) {
  const { project, id } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const { action } = body;
  const db = await getDb(project);
  const item = await db.collection('items').findOne({ _id: id as any });
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (body.action === 'retry') {   // only an item Alex approved whose posting failed (partial: the platforms that did not work)
    if (!['failed', 'partial'].includes(item.status) || !item.results || !(item.history || []).some((h: any) => ['approve', 'approve-all'].includes(h.event)))
      return NextResponse.json({ error: 'Er is niets opnieuw te proberen.' }, { status: 409 });
    const at = new Date(); const kept = Object.fromEntries(Object.entries(item.results).filter(([, r]: any) => r?.id));
    await getDb(project).then(db => db.collection('items').updateOne({ _id: id as any }, { $set: { status: 'approved', postAt: at, slot: at, 'spec.slot': at.toISOString(), results: kept, updatedAt: at },
      $unset: { error: '' }, $push: { history: { at, event: 'retry' } } as any }));
    return NextResponse.json({ ok: true, message: 'Wordt opnieuw geplaatst bij de volgende ronde (binnen een uur).' });
  }
  if (['published', 'partial'].includes(item.status)) return NextResponse.json({ error: 'Al gepubliceerd' }, { status: 409 });
  const at = new Date();

  if (action === 'edit') {
    const caption = String(body.caption ?? '').replace(/\r\n/g, '\n').trim();
    const hashtags = (Array.isArray(body.hashtags) ? body.hashtags : String(body.hashtags ?? '').split(/[\s,]+/))
      .map((h: string) => h.trim()).filter(Boolean).map((h: string) => (h.startsWith('#') ? h : `#${h}`));
    if (caption.length < 10 || caption.length > 2000) return NextResponse.json({ error: 'De caption moet tussen 10 en 2000 tekens zijn.' }, { status: 400 });
    if (LONG_DASH.test(caption)) return NextResponse.json({ error: 'Gebruik een gewoon streepje (-), geen lang streepje.' }, { status: 400 });
    if (hashtags.length > 8 || hashtags.some((h: string) => !/^#[\p{L}\p{N}_]+$/u.test(h))) return NextResponse.json({ error: 'Maximaal 8 hashtags, alleen letters, cijfers en _.' }, { status: 400 });
    await db.collection('items').updateOne({ _id: id as any }, { $set: { 'spec.caption': caption, 'spec.hashtags': hashtags, updatedAt: at },
      $push: { history: { at, event: 'edit-caption' } } as any });
    return NextResponse.json({ ok: true });
  }

  if (action === 'rerender') {
    await db.collection('items').updateOne({ _id: id as any }, { $set: { status: 'queued', renderAttempts: 0, updatedAt: at }, $unset: { error: '' },
      $push: { history: { at, event: 'rerender' } } as any });
    const { GITHUB_REPO, GITHUB_DISPATCH_TOKEN } = process.env;
    if (GITHUB_REPO && GITHUB_DISPATCH_TOKEN) {
      const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, { method: 'POST',
        headers: { Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json' }, body: JSON.stringify({ event_type: 'render', client_payload: { project } }) });
      if (r.ok) return NextResponse.json({ ok: true, message: 'Wordt nu opnieuw gemaakt (een paar minuten).' });
    }
    return NextResponse.json({ ok: true, message: 'Wordt binnen 30 minuten opnieuw gemaakt.' });
  }

  if (action === 'now') {
    if (item.status !== 'approved') return NextResponse.json({ error: 'Keur het eerst goed.' }, { status: 409 });
    await db.collection('items').updateOne({ _id: id as any }, { $set: { postAt: at, slot: at, 'spec.slot': at.toISOString(), updatedAt: at },
      $push: { history: { at, event: 'post-now' } } as any });
    return NextResponse.json({ ok: true, message: 'Gaat online bij de volgende ronde (binnen een uur).' });
  }

  const status = NEXT[action];
  if (!status) return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  const comment = body.comment;
  if (action === 'changes' && !String(comment || '').trim()) return NextResponse.json({ error: 'Schrijf wat er anders moet.' }, { status: 400 });
  const note = comment ? String(comment).slice(0, 2000) : undefined;
  const update: any = { $set: { status, updatedAt: at }, $push: { history: { at, event: action, note } } };
  if (note) update.$push.reviewComments = { text: note, at };

  // Approving puts the item on the pile: no date. Every day the publish job takes the next item of each
  // type from it (approved longest ago first). Leaving "approved" takes it off the pile again.
  if (action === 'approve') {
    if (item.status === 'approved') return NextResponse.json({ ok: true, status, message: 'Staat al op de stapel.' });
    if (['queued', 'rendering'].includes(item.status)) return NextResponse.json({ error: 'Wordt nog gemaakt - keur hem goed als hij klaar is.' }, { status: 409 });
    update.$set.approvedAt = at; update.$unset = { postAt: '' };
    update.$set['spec.platforms'] = postPlatforms(item.kind, getProject(project)!.platforms);
    await db.collection('items').updateOne({ _id: id as any }, update);
    return NextResponse.json({ ok: true, status, message: 'Goedgekeurd - hij staat op de stapel en gaat vanzelf online.' });
  }
  if (item.status === 'approved' && !item.results) update.$unset = { postAt: '' };

  await db.collection('items').updateOne({ _id: id as any }, update);
  return NextResponse.json({ ok: true, status });
}
