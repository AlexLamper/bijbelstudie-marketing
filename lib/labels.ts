// Dutch labels and colours for statuses and kinds, shared by every studio page.

export const STATUS: Record<string, { label: string; tone: string }> = {
  queued: { label: 'In de wachtrij', tone: 'bg-bg text-ink-body ring-1 ring-line-strong' },
  rendering: { label: 'Wordt gemaakt', tone: 'bg-bg text-ink-body ring-1 ring-line-strong' },
  review: { label: 'Wacht op jou', tone: 'bg-accent text-white' },
  changes: { label: 'Wordt aangepast', tone: 'bg-orange-50 text-warn ring-1 ring-orange-200' },
  approved: { label: 'Goedgekeurd', tone: 'bg-accent-soft text-accent-dark' },
  rejected: { label: 'Afgewezen', tone: 'bg-bg text-ink-muted ring-1 ring-line' },
  published: { label: 'Gepubliceerd', tone: 'bg-emerald-50 text-success ring-1 ring-emerald-200' },
  partial: { label: 'Deels gepubliceerd', tone: 'bg-orange-50 text-warn ring-1 ring-orange-200' },
  failed: { label: 'Mislukt', tone: 'bg-red-50 text-danger ring-1 ring-red-200' },
};
export const statusLabel = (s: string) => STATUS[s]?.label ?? s;

export const KIND: Record<string, string> = {
  'verse-still': 'Vers van de dag', 'reel-verse': 'Reel - vers', 'reel-demo': 'Reel - app demo',
  'reel-explainer': 'Reel - uitleg', 'post-spotlight': 'Post - functie', 'post-statement': 'Post - statement',
};

export const PLATFORM: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube' };
