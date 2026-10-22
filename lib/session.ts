// Cookie value for the studio password gate (Web Crypto, works in middleware and routes).
export async function sessionValue(password: string) {
  const data = new TextEncoder().encode(`bijbelstudie-studio:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
