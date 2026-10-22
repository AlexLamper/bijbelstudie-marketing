// Email to Alex via Resend (already used by the website). Env: RESEND_API_KEY, NOTIFY_TO,
// NOTIFY_FROM (default "BijbelStudie Studio <studio@bijbelstudie.io>"), DASHBOARD_URL.
const env = process.env;
export async function notify(subject, lines, link) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_TO) { console.log(`[notify skipped] ${subject}`); return; }
  const url = link || env.DASHBOARD_URL || '';
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#111827;max-width:520px">
    <h2 style="margin:0 0 12px">${subject}</h2>${lines.map(l => `<p style="margin:6px 0;color:#374151">${l}</p>`).join('')}
    ${url ? `<p style="margin-top:20px"><a href="${url}" style="background:#0d7a66;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Open de studio</a></p>` : ''}</div>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.NOTIFY_FROM || 'BijbelStudie Studio <studio@bijbelstudie.io>', to: env.NOTIFY_TO, subject, html, text: [...lines, url].join('\n') }) });
  if (!r.ok) console.error(`notify failed ${r.status}: ${await r.text()}`);
}
