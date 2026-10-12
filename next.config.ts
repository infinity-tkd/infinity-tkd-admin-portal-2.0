if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
import type { NextConfig } from 'next';
import path from 'path';
import { InjectManifest } from '@serwist/webpack-plugin';

const nextConfig: NextConfig = {
  // Keep development output separate from production release verification.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingRoot: path.resolve(__dirname),
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
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
  compress: true,
  transpilePackages: ['motion'],
  experimental: {
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
    optimizePackageImports: ['@phosphor-icons/react', 'lucide-react', '@react-three/drei'],
  },
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
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
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
    // Generate a release-matched service worker for every production build.
    if (!isServer && !dev) {
      try {
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
        throw err;
      }
    }
    return config;
  },
};

export default nextConfig;
