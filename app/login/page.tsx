export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = '/', error } = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center bg-panel px-4">
      <form action="/api/login" method="post" className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-xl">
        <img src="/logo-full.svg" alt="BijbelStudie" className="h-9" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">Studio</h1>
        <p className="mt-1 text-sm text-ink-muted">Alles wat de engine maakt, wacht hier op je akkoord.</p>
        <input type="hidden" name="next" value={next} />
        <input name="password" type="password" autoFocus placeholder="Wachtwoord"
          className="mt-6 w-full rounded-lg border border-line-strong px-4 py-3 text-ink outline-none focus:border-teal" />
        {error && <p className="mt-2 text-sm text-danger">Verkeerd wachtwoord.</p>}
        <button className="mt-4 w-full rounded-lg bg-cta py-3 font-bold text-white">Open de studio</button>
      </form>
    </main>
  );
}
