import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import {
  Serwist,
  CacheFirst,
  NetworkOnly,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
  runtimeCaching: [
    // 1. Dynamic API & Authentication Exclusion (NetworkOnly)
    // Strictly bypass cache for all API routes, Supabase REST/Auth, and mutating requests
    // RATIONALE: Protect user privacy, prevent stale financial or auth tokens from persisting
    {
      matcher({ url, request }) {
        return (
          url.hostname.includes('supabase.co') ||
          url.hostname.includes('supabase.com') ||
          url.pathname.startsWith('/api/') ||
          url.pathname.startsWith('/auth/') ||
          request.method !== 'GET'
        );
      },
      handler: new NetworkOnly(),
    },

    // 2. Protected navigation bypasses stored pages; use the offline fallback without cached account data.
    {
      matcher({ request }) {
        return request.mode === 'navigate';
      },
      handler: new NetworkOnly(),
    },

    // 3. 3D Model & Large Asset Caching (CacheFirst)
    // Dedicated cache pool for Three.js 3D assets (.glb, .gltf, .bin, textures, HDRIs)
    // RATIONALE: High bandwidth assets that rarely change benefit from instant local availability
    {
      matcher({ url }) {
        return /\.(?:glb|gltf|bin|hdr|ktx2)$/i.test(url.pathname);
      },
      handler: new CacheFirst({
        cacheName: 'three-assets-cache-v2',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },

    // 4. Static Page Assets (StaleWhileRevalidate)
    // Cache fonts, static chunks, stylesheets, and images
    // RATIONALE: Instant UI rendering on repeat visits with background refresh for any updates
    {
      matcher({ url, request }) {
        return (
          url.pathname.startsWith('/_next/static/') ||
          url.pathname.startsWith('/icons/') ||
          url.pathname.startsWith('/screenshots/') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.webp') ||
          request.destination === 'font' ||
          request.destination === 'image' ||
          request.destination === 'style' ||
          request.destination === 'script'
        );
      },
      handler: new StaleWhileRevalidate({
        cacheName: 'static-assets-cache-v2',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 120,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },

    ...defaultCache,
  ],
});

serwist.addEventListeners();

// Notification payloads never contain student details or authentication tokens.
(self as any).addEventListener('push', (event: any) => {
  let payload: { title?: string; body?: string; tag?: string; url?: string } = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a safe generic update. */ }
  const url = typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//') && !payload.url.includes('\\') ? payload.url : '/profile?notifications=open';
  event.waitUntil(Promise.resolve().then(() => (self as any).registration.showNotification('Infinity TKD', {
    body: 'You have an academy update. Open the portal to review it.',
    icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png',
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0,100) : 'infinity-update',
    data: { url },
  })).catch(() => { /* Permission may have been revoked while the app was closed. */ }));
});
(self as any).addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const target = new URL('/profile?notifications=open', (self as any).location.origin);
  event.waitUntil((async () => {
    const windows = await (self as any).clients.matchAll({type:'window',includeUncontrolled:true});
    const existing = windows.find((client: any) => new URL(client.url).origin === target.origin);
    if (existing) {
      // navigate() rejects for windows this worker does not control (for
      // example a tab opened before installation). Open a fresh window then.
      try { await existing.navigate(target.href); }
      catch { return (self as any).clients.openWindow(target.href); }
      return existing.focus();
    }
    return (self as any).clients.openWindow(target.href);
  })());
});

// Diagnostic & Lifecycle Message Listener
(self as any).addEventListener('message', (event: any) => {
  if (event.data?.type === 'GET_SW_DIAGNOSTICS') {
    event.ports?.[0]?.postMessage({
      status: 'active',
      version: '2.0.0',
      scope: (self as any).registration?.scope || '/',
      timestamp: Date.now(),
    });
  }
});

