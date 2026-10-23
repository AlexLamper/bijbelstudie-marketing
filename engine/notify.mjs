// Tell Alex something needs him. Resend email when configured (RESEND_API_KEY, NOTIFY_TO);
// otherwise a GitHub issue in this repo - GitHub emails the repo owner about new issues,
// so this works with zero setup. Env from Actions: GITHUB_TOKEN, GITHUB_REPOSITORY.
// Every message is prefixed with the project name; links go to that project in the studio.
import { project } from './project.mjs';

const env = process.env;
const studioBase = () => (env.STUDIO_URL || env.DASHBOARD_URL || '').replace(/\/$/, '');

/** Link into the studio for this project, e.g. studioLink(`/week/2026-W45`). */
export const studioLink = (path = '') => studioBase() && `${studioBase()}/${project().id}${path}`;

async function viaResend(subject, lines, url) {
  const p = project();
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#111827;max-width:520px">
    <h2 style="margin:0 0 12px">${subject}</h2>${lines.map(l => `<p style="margin:6px 0;color:#374151">${l}</p>`).join('')}
    ${url ? `<p style="margin-top:20px"><a href="${url}" style="background:${p.theme.cta};color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Open de studio</a></p>` : ''}</div>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.NOTIFY_FROM || p.notify?.from || `${p.name} Studio <studio@${p.web || 'example.com'}>`, to: env.NOTIFY_TO, subject, html, text: [...lines, url].filter(Boolean).join('\n') }) });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

const gh = (path, init = {}) => fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
  ...init, headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', ...(init.headers || {}) } });

/** Close open studio issues whose title starts with prefix (e.g. an older "week ready" message). */
async function closeIssues(prefix) {
  try {
    const open = await (await gh('/issues?state=open&labels=studio&per_page=50')).json();
    for (const i of Array.isArray(open) ? open : []) if (i.title.startsWith(prefix) && !i.pull_request)
      await gh(`/issues/${i.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
  } catch (e) { console.error(`close issues: ${e.message}`); }
}

async function viaGitHubIssue(subject, lines, url, replaces) {
  if (replaces) await closeIssues(replaces);
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ title: subject, body: [...lines, url ? `\n**[Open de studio](${url})**` : ''].join('\n\n'), labels: ['studio'] }),
  });
  if (!r.ok) throw new Error(`GitHub issue ${r.status}: ${await r.text()}`);
}

/** replaces: a subject prefix (without the project name) whose older GitHub issues this one supersedes. */
export async function notify(subject, lines, link, { replaces } = {}) {
  subject = `${project().name}: ${subject}`;
  const url = link || studioLink();
  try {
    if (env.RESEND_API_KEY && env.NOTIFY_TO) return await viaResend(subject, lines, url);
    if (env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) return await viaGitHubIssue(subject, lines, url, replaces && `${project().name}: ${replaces}`);
    console.log(`[notify skipped] ${subject}`);
  } catch (e) { console.error(`notify failed: ${e.message}`); }
}
