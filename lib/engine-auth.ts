import { timingSafeEqual, createHash } from 'node:crypto';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time string comparison (hashing first makes the lengths equal). */
export const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** The engine (GitHub Actions) calls /api/engine/* with header x-engine-key = ENGINE_KEY (or ?key= for GET status). */
export function engineAuthorized(req: Request): boolean {
  const key = process.env.ENGINE_KEY;
  const got = req.headers.get('x-engine-key') || new URL(req.url).searchParams.get('key') || '';
  return !!key && !!got && safeEqual(got, key);
}
