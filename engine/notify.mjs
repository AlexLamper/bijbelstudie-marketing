// Tell Alex something needs him. Resend email when configured (RESEND_API_KEY, NOTIFY_TO);
// otherwise a GitHub issue in this repo - GitHub emails the repo owner about new issues,
// so this works with zero setup. Env from Actions: GITHUB_TOKEN, GITHUB_REPOSITORY.
const env = process.env;

async function viaResend(subject, lines, url) {
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#111827;max-width:520px">
    <h2 style="margin:0 0 12px">${subject}</h2>${lines.map(l => `<p style="margin:6px 0;color:#374151">${l}</p>`).join('')}
    ${url ? `<p style="margin-top:20px"><a href="${url}" style="background:#0d7a66;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Open de studio</a></p>` : ''}</div>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.NOTIFY_FROM || 'BijbelStudie Studio <studio@bijbelstudie.io>', to: env.NOTIFY_TO, subject, html, text: [...lines, url].filter(Boolean).join('\n') }) });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

async function viaGitHubIssue(subject, lines, url) {
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ title: subject, body: [...lines, url ? `\n**[Open de studio](${url})**` : ''].join('\n\n'), labels: ['studio'] }),
  });
  if (!r.ok) throw new Error(`GitHub issue ${r.status}: ${await r.text()}`);
}

export async function notify(subject, lines, link) {
  const url = link || env.DASHBOARD_URL || '';
  try {
    if (env.RESEND_API_KEY && env.NOTIFY_TO) return await viaResend(subject, lines, url);
    if (env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) return await viaGitHubIssue(subject, lines, url);
    console.log(`[notify skipped] ${subject}`);
  } catch (e) { console.error(`notify failed: ${e.message}`); }
}
