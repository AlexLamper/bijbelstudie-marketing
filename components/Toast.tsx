'use client';
import { useEffect, useState } from 'react';

// A short message at the bottom of the screen, e.g. "Gaat vandaag om 19:30 online" after approving.
// Lives in the project layout, so it stays visible when the card that sent it moves to another section.

const EVENT = 'studio:toast';

/** Show a message from any client component. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export default function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(timer); timer = setTimeout(() => setMsg(''), 6000);
    };
    window.addEventListener(EVENT, show);
    return () => { window.removeEventListener(EVENT, show); clearTimeout(timer); };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {msg && (
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-ink py-2.5 pl-4 pr-2 text-sm font-semibold text-white shadow-[var(--shadow-lift)]">
          <span>{msg}</span>
          <button type="button" onClick={() => setMsg('')} aria-label="Sluiten"
            className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
