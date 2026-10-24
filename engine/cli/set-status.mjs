// Sets the status of items by id (run via maintenance.yml), e.g. to drop look tests Alex no longer wants
// or to render an item again:   node engine/cli/set-status.mjs rejected 2026-w44-film-a 2026-w44-film-b
// rejected: the stats job removes the media and the item a day later, as after a rejection in the studio.
// queued: rendered again by the next Render run. Published items are never touched.
import '../env.mjs';
import { db, close } from '../db.mjs';
import { project } from '../project.mjs';

const ALLOWED = ['rejected', 'queued', 'review'];
const [status, ...ids] = process.argv.slice(2);
if (!ALLOWED.includes(status) || !ids.length) { console.error(`usage: set-status.mjs <${ALLOWED.join('|')}> <id> [id ...]`); process.exit(2); }
const d = await db(); const at = new Date();
for (const id of ids) {
  const set = { status, updatedAt: at, ...(status === 'queued' ? { renderAttempts: 0 } : {}) };
  const r = await d.collection('items').updateOne({ _id: id, status: { $nin: ['published', 'partial'] } },
    { $set: set, ...(status === 'queued' ? { $unset: { error: '' } } : {}), $push: { history: { at, event: status === 'rejected' ? 'reject' : `set-${status}`, note: 'maintenance' } } });
  console.log(`[${project().id}] ${id}: ${r.modifiedCount ? status : 'not changed (unknown or already published)'}`);
}
await close();
