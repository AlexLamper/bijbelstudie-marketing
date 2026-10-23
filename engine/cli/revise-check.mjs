// Runs inside the Publish workflow (every 30 min). If Alex pressed "Aanpassingen naar Claude"
// in the studio, the studio set a flag in Mongo; this script clears it and tells the workflow to
// start the Revise workflow. That way the studio needs no GitHub token.
import { appendFileSync } from 'node:fs';
import { db, close, STATUS } from '../db.mjs';

const d = await db();
const flag = await d.collection('settings').findOneAndUpdate({ _id: 'revise', requested: true }, { $set: { requested: false, startedAt: new Date() } });
const pending = await d.collection('items').countDocuments({ status: STATUS.CHANGES });
const go = !!(flag && (flag.value ?? flag)) && pending > 0;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `revise=${go}\n`);
console.log(go ? `revise requested for ${pending} items` : 'no revise requested');
await close();
