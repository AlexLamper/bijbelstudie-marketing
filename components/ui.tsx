import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

// Shared building blocks so every button and card in the studio looks and behaves the same:
// pointer cursor, hover and active states, keyboard focus ring, disabled state.

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base = 'inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition '
  + 'duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';
const variants: Record<Variant, string> = {
  primary: 'bg-cta text-white shadow-sm hover:brightness-110 hover:shadow-md disabled:hover:brightness-100 disabled:hover:shadow-sm',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink-muted hover:bg-bg disabled:hover:border-line-strong disabled:hover:bg-surface',
  ghost: 'text-ink-muted hover:bg-bg hover:text-ink disabled:hover:bg-transparent',
  danger: 'text-danger hover:bg-red-50 disabled:hover:bg-transparent',
};
const sizes: Record<Size, string> = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-sm' };

export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md', extra = '') => `${base} ${variants[variant]} ${sizes[size]} ${extra}`;

export function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ variant = 'secondary', size = 'md', className = '', ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({ className = '', children, ...rest }: ComponentProps<'div'>) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] ${className}`} {...rest}>{children}</div>;
}

export function Pill({ tone, children, className = '' }: { tone: string; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${tone} ${className}`}>{children}</span>;
}

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 text-ink-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center text-ink-muted">{children}</div>;
}

/** Project logo mark, or a coloured initial when the project has no logo yet. */
export function ProjectMark({ name, src, className = 'h-8 w-8' }: { name: string; src: string | null; className?: string }) {
  return src
    ? <img src={src} alt="" className={`${className} shrink-0 rounded-lg object-contain`} />
    : <span className={`${className} grid shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-white`}>{name[0]}</span>;
}

/** The studio's own neutral mark (the overview and login are not one project's). */
export function StudioMark({ onLight = false }: { onLight?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg ${onLight ? 'h-10 w-10 bg-ink' : 'h-8 w-8 bg-white/10 ring-1 ring-white/15'}`} aria-hidden>
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="currentColor"><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h3A1.5 1.5 0 0 1 9 4.5v3A1.5 1.5 0 0 1 7.5 9h-3A1.5 1.5 0 0 1 3 7.5v-3Zm8 0A1.5 1.5 0 0 1 12.5 3h3A1.5 1.5 0 0 1 17 4.5v3A1.5 1.5 0 0 1 15.5 9h-3A1.5 1.5 0 0 1 11 7.5v-3Zm-8 8A1.5 1.5 0 0 1 4.5 11h3A1.5 1.5 0 0 1 9 12.5v3A1.5 1.5 0 0 1 7.5 17h-3A1.5 1.5 0 0 1 3 15.5v-3Zm8 0a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3Z" /></svg>
    </span>
  );
}
