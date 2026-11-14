import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import './globals.css';
import { AppProviders } from '@/components/client/providers';

const poppins = localFont({
  src: [
    { path: '../fonts/poppins-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

const SITE_URL = (process.env.APP_URL || 'https://svtc-tutoring.onrender.com').replace(/\/$/, '');
const DESCRIPTION =
  "Cours de répétitions en informatique de la 6ème en Terminale (dont PTI et TTI) à Yaoundé, Biyem-Assi Lac : préparation au BEPC, Probatoire et Baccalauréat, suivi des présences et des notes en ligne pour les parents.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'SVTC Répétitions — Cours de répétitions en informatique à Yaoundé', template: '%s · SVTC Répétitions' },
  description: DESCRIPTION,
  applicationName: 'SVTC Répétitions',
  keywords: ['répétitions informatique Yaoundé', 'cours informatique Biyem-Assi', 'préparation BEPC Probatoire Baccalauréat informatique', 'PTI', 'TTI', 'Silicon Valley Training Center', 'SVTC'],
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/brand/favicon-64.png', type: 'image/png' }], apple: '/brand/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'SVTC', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'fr_CM',
    siteName: 'SVTC Répétitions',
    title: 'Cours de répétitions en informatique — Silicon Valley Training Center',
    description: DESCRIPTION,
    url: '/',
    images: [{ url: '/brand/og-image.jpg', width: 1200, height: 630, alt: 'Silicon Valley Training Center — Comprendre. Pratiquer. Maîtriser.' }],
  },
  twitter: { card: 'summary_large_image', title: 'SVTC Répétitions', description: DESCRIPTION, images: ['/brand/og-image.jpg'] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a163a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lecture des en-têtes : rendu dynamique obligatoire pour appliquer le nonce CSP à chaque requête.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="fr" className={poppins.variable}>
      <body className="min-h-dvh">
        {children}
        <AppProviders nonce={nonce} />
      </body>
    </html>
  );
}
