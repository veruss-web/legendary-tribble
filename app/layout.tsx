import './globals.css';
import './dark-theme.generated.css';
import './dark-overrides.css';
import './analisa.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import type { Metadata } from 'next';

function resolveSiteUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: { default: 'MIEFLOW POS — Kasir & manajemen toko', template: '%s · MIEFLOW' },
  description:
    'Aplikasi kasir (POS) dan manajemen toko: produk, stok, pelanggan, transaksi, struk, dan analitik penjualan.',
  applicationName: 'MIEFLOW POS',
  manifest: '/manifest.webmanifest',
  // Back-office app behind a login: keep it out of search results.
  robots: { index: false, follow: false },
};

// Fonts are loaded with <link> (not CSS @import) so the browser can fetch them in parallel with the stylesheet.
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
}
