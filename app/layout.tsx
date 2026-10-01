import type { Metadata, Viewport } from 'next';
import { Montserrat, Kantumruy_Pro } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/store';
import { RootWrapper } from '@/components/RootWrapper';
import { PwaUpdater } from '@/components/pwa/PwaUpdater';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
  display: 'swap',
});

const kantumruy = Kantumruy_Pro({
  subsets: ['khmer'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-khmer',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  referrer: 'no-referrer',
  manifest: '/manifest.webmanifest',
  title: {
    default: 'Infinity TKD Admin Portal',
    template: '%s | Infinity TKD',
  },
  description: 'High-Performance Admin Portal & Athletic Anatomy Management',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Infinity TKD',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${kantumruy.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('infinity_theme') || 'light';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-white text-neutral-900 dark:bg-[#0A0A0A] dark:text-[#E4E4E4] min-h-dvh" suppressHydrationWarning>
        <AppProvider>
          <RootWrapper>
            {children}
            <PwaUpdater />
          </RootWrapper>
        </AppProvider>
        <script
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === 'production' || process.env.ENABLE_PWA_DEV === 'true'
                ? `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
                    console.log('[PWA] Service Worker registered with scope:', reg.scope);
                  }).catch(function(err) {
                    console.warn('[PWA] Service Worker registration failed:', err);
                  });
                });
              }
            `
                : `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var reg of registrations) {
                    reg.unregister();
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
