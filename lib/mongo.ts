import { MongoClient, Db } from 'mongodb';
import { getProject } from './projects';

// One client per server instance (survives hot reloads in dev); one database per project.
const g = globalThis as unknown as { _mongo?: Promise<MongoClient> };

async function client() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  g._mongo ??= new MongoClient(process.env.MONGODB_URI).connect().catch(e => { g._mongo = undefined; throw e; });
  return g._mongo;
}

export async function getDb(projectId: string): Promise<Db> {
  const p = getProject(projectId);
  if (!p) throw new Error(`Unknown project "${projectId}"`);
  return (await client()).db(p.db);
}

/** Settings shared by all projects (the developer apps used to link accounts). */
export async function getSharedDb(): Promise<Db> {
  return (await client()).db(process.env.STUDIO_DB || 'marketing_studio');
}

export type Item = {
  _id: string; kind: string; week: string; slot: Date; status: string; aiLabel?: boolean;
  spec: any; media?: { url: string; coverUrl?: string; duration?: number };
  results?: Record<string, any>; metrics?: Record<string, any>;
  reviewComments?: { text: string; at: Date }[]; error?: string; renderNotes?: string[];
};

/** ISO week like 2026-W45 for a date. */
export function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(); const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
