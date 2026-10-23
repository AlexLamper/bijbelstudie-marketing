// Runs inside the Publish workflow (every 30 min), per project. The studio has no GitHub token,
// so what it asks for is a flag or a status in Mongo; this script starts the matching workflow:
//   - "Aanpassingen naar Claude"  -> settings.revise.requested -> Revise workflow
//   - "Opnieuw renderen" / new or failed items waiting for a render -> Render workflow
// Uses the workflow's GITHUB_TOKEN (permission actions: write).
import '../env.mjs';
import { db, close, STATUS } from '../db.mjs';
import { project } from '../project.mjs';

const d = await db(); const P = project();
const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;

async function dispatch(workflow) {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) return 'no GitHub token (not in Actions)';
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST', headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ ref: process.env.GITHUB_REF_NAME || 'main', inputs: { project: P.id } }),
    });
    return r.ok ? '' : `${r.status} ${await r.text()}`;
  } catch (e) { return e.message; }
}
const problems = [];

// 1. revise
const flag = await d.collection('settings').findOneAndUpdate({ _id: 'revise', requested: true }, { $set: { requested: false, startedAt: new Date() } });
const changes = await d.collection('items').countDocuments({ status: STATUS.CHANGES });
if ((flag && (flag.value ?? flag)) && changes) {
  const err = await dispatch('revise.yml');
  if (err) { await d.collection('settings').updateOne({ _id: 'revise' }, { $set: { requested: true } }); problems.push(`revise: ${err}`); }
  else console.log(`[${P.id}] revise started for ${changes} items`);
}

// 2. render (at most once per 40 minutes, so a running render is not stacked)
const waiting = await d.collection('items').countDocuments({ $or: [{ status: STATUS.QUEUED }, { status: STATUS.FAILED, media: { $exists: false }, renderAttempts: { $not: { $gte: 3 } } }] });
if (waiting) {
  const last = await d.collection('settings').findOne({ _id: 'render-kick' });
  if (!last || Date.now() - new Date(last.at).getTime() > 40 * 60e3) {
    const err = await dispatch('render.yml');
    if (err) problems.push(`render: ${err}`);
    else { await d.collection('settings').updateOne({ _id: 'render-kick' }, { $set: { at: new Date(), items: waiting } }, { upsert: true }); console.log(`[${P.id}] render started for ${waiting} items`); }
  } else console.log(`[${P.id}] ${waiting} items wait for the render that was started ${Math.round((Date.now() - new Date(last.at)) / 60e3)} min ago`);
}
if (!waiting && !changes) console.log(`[${P.id}] nothing to start`);
await close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
