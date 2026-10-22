import { MongoClient, Db } from 'mongodb';

// One client per server instance (survives hot reloads in dev).
const g = globalThis as unknown as { _mongo?: Promise<MongoClient> };

export async function getDb(): Promise<Db> {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  g._mongo ??= new MongoClient(process.env.MONGODB_URI).connect();
  return (await g._mongo).db(process.env.MONGODB_DB || 'bijbelstudie_marketing');
}

export type Item = {
  _id: string; kind: string; week: string; slot: Date; status: string; aiLabel?: boolean;
  spec: any; media?: { url: string; coverUrl?: string; duration?: number };
  results?: Record<string, any>; metrics?: Record<string, any>;
  reviewComments?: { text: string; at: Date }[]; error?: string; renderNotes?: string[];
};

export const STATUS_LABEL: Record<string, string> = {
  queued: 'In de wachtrij', rendering: 'Wordt gemaakt', review: 'Wacht op jou', changes: 'Wordt aangepast',
  approved: 'Goedgekeurd', rejected: 'Afgewezen', published: 'Gepubliceerd', partial: 'Deels gepubliceerd', failed: 'Mislukt',
};

export const KIND_LABEL: Record<string, string> = {
  'verse-still': 'Vers van de dag', 'reel-verse': 'Reel - vers', 'reel-demo': 'Reel - app demo',
  'reel-explainer': 'Reel - uitleg', 'post-spotlight': 'Post - functie', 'post-statement': 'Post - statement',
};

/** ISO week like 2026-W45 for a date. */
export function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(); const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
