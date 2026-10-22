import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Lora } from 'next/font/google';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const lora = Lora({ subsets: ['latin'], variable: '--font-lora' });

export const metadata: Metadata = { title: 'BijbelStudie Studio', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#152229', width: 'device-width', initialScale: 1 };

const NAV = [['/', 'Deze week'], ['/reports', 'Rapporten'], ['/comments', 'Reacties'], ['/stats', 'Cijfers']];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${inter.variable} ${lora.variable}`}>
      <body style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <header className="sticky top-0 z-20 bg-panel text-white">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo-icon-dark.svg" alt="" className="h-7 w-7" />
              <span className="font-bold tracking-tight">Bijbel<span className="text-teal">Studie</span> <span className="font-normal text-white/60">Studio</span></span>
            </Link>
            <nav className="ml-auto flex gap-1 overflow-x-auto text-sm">
              {NAV.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white">{label}</Link>)}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
