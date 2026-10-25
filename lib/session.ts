// Cookie value for the studio password gate (Web Crypto, works in middleware and routes).
export async function sessionValue(password: string) {
  const data = new TextEncoder().encode(`bijbelstudie-studio:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// One studio for every project lives at al-marketing-studio.vercel.app (25 Oct 2026). The account links
// (Meta, Google, TikTok) stay registered on the old address, so the linking step runs there: the studio
// hands it over with a signed pass that is valid for 5 minutes (only to start that one link).
export const STUDIO_HOST = 'al-marketing-studio.vercel.app';
export const OLD_HOSTS = ['bijbelstudie-studio.vercel.app'];
const enc = (s: string) => new TextEncoder().encode(s);
const b64u = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
async function sign(password: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc(`studio-pass:${password}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(data)))).map(b => b.toString(16).padStart(2, '0')).join('');
}
export type Handoff = { project: string; provider: string; exp: number };
export async function handoffToken(password: string, h: Omit<Handoff, 'exp'>) {
  const data = b64u(JSON.stringify({ ...h, exp: Date.now() + 5 * 60e3 }));
  return `${data}.${await sign(password, data)}`;
}
export async function checkHandoff(password: string, token: string | null): Promise<Handoff | null> {
  if (!token || !password) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig || (await sign(password, data)) !== sig) return null;
  try { const h = JSON.parse(unb64u(data)) as Handoff; return h.exp > Date.now() ? h : null; } catch { return null; }
}
