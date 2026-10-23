// Runs inside the Publish workflow (every 30 min), per project. If Alex pressed "Aanpassingen
// naar Claude" in the studio and the studio could not start the Revise workflow itself, it set a
// flag in Mongo; this script clears it and starts the Revise workflow for this project.
import '../env.mjs';
import { db, close, STATUS } from '../db.mjs';
import { project } from '../project.mjs';

const d = await db(); const P = project();
const flag = await d.collection('settings').findOneAndUpdate({ _id: 'revise', requested: true }, { $set: { requested: false, startedAt: new Date() } });
const pending = await d.collection('items').countDocuments({ status: STATUS.CHANGES });
const go = !!(flag && (flag.value ?? flag)) && pending > 0;
if (go) {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
  let problem = '';
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/revise.yml/dispatches`, {
      method: 'POST', headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ ref: process.env.GITHUB_REF_NAME || 'main', inputs: { project: P.id } }),
    });
    if (!r.ok) problem = `${r.status} ${await r.text()}`;
  } catch (e) { problem = e.message; }
  if (problem) {   // keep the request, so the next run tries again
    await d.collection('settings').updateOne({ _id: 'revise' }, { $set: { requested: true } });
    await close(); throw new Error(`could not start Revise: ${problem}`);
  }
}
console.log(`[${P.id}] ${go ? `revise started for ${pending} items` : 'no revise requested'}`);
await close();
