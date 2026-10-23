'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ProjectMark } from './ui';

type Entry = { id: string; name: string; enabled: boolean; mark: string | null; panel: string };

/** Current project in the header; opens a menu to jump to the same page of another project. */
export default function ProjectSwitcher({ current, projects }: { current: string; projects: Entry[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const me = projects.find(p => p.id === current)!;
  // keep the section (reports, comments, ...) when switching; a week page goes to the overview
  const section = path.split('/')[2];
  const target = (id: string) => `/${id}${section && section !== 'week' ? `/${section}` : ''}`;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  useEffect(() => setOpen(false), [path]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex cursor-pointer items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/10 active:bg-white/15">
        <ProjectMark name={me.name} src={me.mark} className="h-8 w-8" />
        <span className="hidden text-[15px] font-bold tracking-tight min-[480px]:inline">{me.name}</span>
        <span className="hidden text-sm text-white/50 sm:inline">Studio</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 text-white/60 transition ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden><path d="M5.2 7.6a.75.75 0 0 1 1.06 0L10 11.34l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.66a.75.75 0 0 1 0-1.06Z" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface p-1.5 text-ink shadow-[var(--shadow-lift)]">
          <p className="px-2.5 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">Projecten</p>
          {projects.map(p => (
            <Link key={p.id} href={target(p.id)} role="menuitem"
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-bg ${p.id === current ? 'bg-bg' : ''}`}>
              <span className="rounded-[10px] p-0.5" style={{ background: p.panel }}><ProjectMark name={p.name} src={p.mark} className="h-7 w-7" /></span>
              <span className="flex-1 font-semibold">{p.name}</span>
              {!p.enabled && <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-ink-muted ring-1 ring-line">uit</span>}
              {p.id === current && <svg viewBox="0 0 20 20" className="h-4 w-4 text-accent" fill="currentColor" aria-hidden><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" /></svg>}
            </Link>
          ))}
          <div className="my-1.5 border-t border-line" />
          <Link href="/" role="menuitem" className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-body transition hover:bg-bg hover:text-ink">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h3A1.5 1.5 0 0 1 9 4.5v3A1.5 1.5 0 0 1 7.5 9h-3A1.5 1.5 0 0 1 3 7.5v-3Zm8 0A1.5 1.5 0 0 1 12.5 3h3A1.5 1.5 0 0 1 17 4.5v3A1.5 1.5 0 0 1 15.5 9h-3A1.5 1.5 0 0 1 11 7.5v-3Zm-8 8A1.5 1.5 0 0 1 4.5 11h3A1.5 1.5 0 0 1 9 12.5v3A1.5 1.5 0 0 1 7.5 17h-3A1.5 1.5 0 0 1 3 15.5v-3Zm8 0a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3Z" /></svg>
            Alle projecten
          </Link>
        </div>
      )}
    </div>
  );
}
