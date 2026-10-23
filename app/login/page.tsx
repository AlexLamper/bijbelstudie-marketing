import { PROJECTS } from '@/lib/projects';
import { ProjectMark, StudioMark } from '@/components/ui';

export const metadata = { title: 'Inloggen' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = '/', error } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4">
      <form action="/api/login" method="post" className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <StudioMark onLight />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink">Studio</h1>
            <p className="text-sm text-ink-muted">Alles wat de engine maakt, wacht hier op je akkoord.</p>
          </div>
        </div>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="password" className="mt-7 block text-sm font-semibold text-ink">Wachtwoord</label>
        <input id="password" name="password" type="password" autoFocus required autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-line-strong px-4 py-3 text-ink outline-none transition hover:border-ink-muted focus:border-ink focus:ring-2 focus:ring-ink/10" />
        {error && <p role="alert" className="mt-2 text-sm text-danger">Verkeerd wachtwoord.</p>}
        <button className="mt-4 h-12 w-full cursor-pointer rounded-lg bg-ink font-bold text-white transition hover:bg-black active:scale-[.99]">Open de studio</button>
        {PROJECTS.length > 0 && (
          <div className="mt-7 flex items-center justify-center gap-4 border-t border-line pt-5">
            {PROJECTS.map(p => (
              <span key={p.id} className="flex items-center gap-2 text-sm font-semibold text-ink-body">
                <span className="rounded-lg p-0.5" style={{ background: p.theme.panel }}><ProjectMark name={p.name} src={p.logo.mark} className="h-6 w-6" /></span>{p.name}
              </span>
            ))}
          </div>
        )}
      </form>
    </main>
  );
}
