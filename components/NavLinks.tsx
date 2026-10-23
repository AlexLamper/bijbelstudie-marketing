'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: [string, string][] = [['', 'Content'], ['/reports', 'Rapporten'], ['/comments', 'Reacties'], ['/stats', 'Cijfers']];

export default function NavLinks({ project }: { project: string }) {
  const path = usePathname();
  return (
    <nav className="ml-auto flex gap-0.5 overflow-x-auto text-[13px] [scrollbar-width:none] sm:gap-1 sm:text-sm">
      {NAV.map(([href, label]) => {
        const to = `/${project}${href}`;
        const active = href ? path.startsWith(to) : path === to || path.startsWith(`${to}/week`);
        return (
          <Link key={href} href={to} aria-current={active ? 'page' : undefined}
            className={`cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-2 font-medium transition sm:px-3 ${active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
