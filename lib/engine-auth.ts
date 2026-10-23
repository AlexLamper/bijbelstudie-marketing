import { timingSafeEqual } from 'node:crypto';

/** The engine (GitHub Actions) calls /api/engine/* with header x-engine-key = ENGINE_KEY. */
export function engineAuthorized(req: Request): boolean {
  const key = process.env.ENGINE_KEY; const got = req.headers.get('x-engine-key') || '';
  if (!key || got.length !== key.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(key));
}
