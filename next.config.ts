if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['motion'],
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://picsum.photos https://*.supabase.co https://*.supabase.com https://lh3.googleusercontent.com https://drive.google.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.com wss://*.supabase.com https: wss:; object-src 'none'; frame-ancestors 'none';",
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer, dev }) => {
    // Only attach Serwist service worker compiler on client build in production or when dev PWA enabled
    if (!isServer && (process.env.NODE_ENV === 'production' || process.env.ENABLE_PWA_DEV === 'true')) {
      try {
        const { InjectManifest } = require('@serwist/webpack-plugin');
        config.plugins.push(
          new InjectManifest({
            swSrc: path.resolve(__dirname, 'sw.ts'),
            swDest: path.resolve(__dirname, 'public/sw.js'),
            disablePrecacheManifest: dev,
            exclude: [
              /\.map$/,
              /^manifest.*\.js$/,
              ({ asset }: any) => {
                return (
                  asset.name.startsWith('server/') ||
                  /^[^/]*\.json$/.test(asset.name) ||
                  (dev && !asset.name.startsWith('static/runtime/'))
                );
              },
            ],
          })
        );
      } catch (err) {
        console.warn('[PWA] InjectManifest plugin error:', err);
      }
    }
    return config;
  },
};

export default nextConfig;
