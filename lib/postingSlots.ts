// Posting from the pile. Alex approves items without dates; every day each posting time takes the next
// approved item of its type, the one approved longest ago first (engine/slots.mjs and
// engine/cli/publish-due.mjs do this). The studio only shows the pile in that order.

export const DEFAULT_TZ = 'Europe/Amsterdam';

/** When an item was approved (latest approval; older items from their history). Same as engine/slots.mjs approvedAt. */
export function approvedAt(it: { approvedAt?: any; history?: { event: string; at: any }[]; updatedAt?: any; createdAt?: any }): number {
  if (it.approvedAt) return +new Date(it.approvedAt);
  const ev = (it.history || []).filter(h => h.event === 'approve' || h.event === 'approve-all').map(h => +new Date(h.at));
  return ev.length ? Math.max(...ev) : +new Date(it.updatedAt || it.createdAt || 0);
}

/** The pile in posting order: items already picked for today first, then by approval. */
export const pileOrder = (a: any, b: any) => (a.postAt ? 0 : 1) - (b.postAt ? 0 : 1) || approvedAt(a) - approvedAt(b);
