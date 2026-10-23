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
  'reel-explainer': 'Reel - uitleg', 'reel-kinetic': 'Reel - bewegende tekst', 'reel-quiz': 'Reel - quiz',
  'reel-list': 'Reel - lijstje', 'reel-story': 'Reel - verhaal met kaart', 'reel-3d': 'Reel - 3D-film', 'post-spotlight': 'Post - functie',
  'post-statement': 'Post - statement', carousel: 'Carrousel',
};

// Experiment traits (engine/experiments.mjs) and their values, in Dutch.
export const TRAIT: Record<string, string> = {
  format: 'Formaat', postFormat: 'Feedpost', style: 'Look', style3d: 'Look 3D', voice: 'Stem', voiceStyle: 'Stemstijl', music: 'Muziek',
  captions: 'Ondertitels', hook: 'Hook', topic: 'Onderwerp', length: 'Lengte', time: 'Tijdstip',
};
const VALUE: Record<string, string> = {
  light: 'licht', dark: 'donker', photo: 'foto', none: 'geen', geen: 'geen stem', male: 'man (standaard)', female: 'vrouw (standaard)',
  calm: 'rustig', hopeful: 'hoopvol', reflective: 'bezinnend', cinematic: 'filmisch', warm: 'warm', upbeat: 'vrolijk',
  karaoke: 'woord voor woord', block: 'blokjes', rustig: 'rustig', levendig: 'levendig', dialoog: 'dialoog (meer stemmen)',
  lowpoly: 'low poly', rond: 'rond', toon: 'cartoon', blok: 'blokken', klei: 'klei',
};
export const traitValue = (trait: string, v: string) => (trait === 'format' || trait === 'postFormat') ? (KIND[v] || v) : (VALUE[v] || v);

export const PLATFORM: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube' };
