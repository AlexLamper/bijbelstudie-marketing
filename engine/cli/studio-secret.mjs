// For a workflow step that needs one key as an input (the planner's CLAUDE_CODE_OAUTH_TOKEN):
// prints nothing secret; masks the value in the logs and hands it to the next steps as an output.
//   - id: token
//     run: node engine/cli/studio-secret.mjs CLAUDE_CODE_OAUTH_TOKEN
//   ... with: claude_code_oauth_token: ${{ steps.token.outputs.value }}
// A GitHub secret with the same name (in SECRETS) wins over the studio's copy.
import '../env.mjs';
import { appendFileSync } from 'node:fs';
import { db, close } from '../db.mjs';

const name = process.argv[2];
if (!/^[A-Z][A-Z0-9_]*$/.test(name || '')) { console.error('usage: studio-secret.mjs NAME'); process.exit(2); }
await db();                                   // loads the studio's keys into env
const value = process.env[name] || '';
await close();
if (!value) { console.log(`${name} is not set (Instellingen > Sleutels in the studio, or a GitHub secret)`); process.exit(1); }
console.log(`::add-mask::${value}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `value=${value}\n`);
console.log(`${name} found`);
