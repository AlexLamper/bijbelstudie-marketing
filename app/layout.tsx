import './globals.css';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

const inter = localFont({
  variable: '--font-inter', display: 'swap',
  src: [
    { path: '../assets/fonts/Inter-Regular.ttf', weight: '400' },
    { path: '../assets/fonts/Inter-SemiBold.ttf', weight: '600' },
    { path: '../assets/fonts/Inter-Bold.ttf', weight: '700' },
  ],
});
const lora = localFont({ variable: '--font-lora', display: 'swap', src: [{ path: '../assets/fonts/Lora-Variable.ttf', weight: '400 700' }] });

export const metadata: Metadata = { title: { default: 'Studio', template: '%s - Studio' }, robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#111827', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${inter.variable} ${lora.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
