import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Sliding window rate limit map for middleware with memory leak protection
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_MIDDLEWARE_RATE_LIMIT_STORE = 5000;

function pruneExpiredMiddlewareLimits() {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // --- 1. Hardened Enterprise HTTP Security Headers ---
  // Note: Wildcard 'https: wss:' removed from connect-src to eliminate exfiltration channels
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://picsum.photos https://*.supabase.co https://*.supabase.com https://lh3.googleusercontent.com https://drive.google.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.com wss://*.supabase.com https://lh3.googleusercontent.com https://drive.google.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // --- 2. API Security, CSRF & Edge Rate Limiting ---
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // A. CSRF & State Integrity: Origin and Sec-Fetch-Site verification on mutating requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const secFetchSite = request.headers.get('sec-fetch-site');
      if (secFetchSite === 'cross-site') {
        return new NextResponse(
          JSON.stringify({ error: 'Forbidden: Cross-site request rejected by Sec-Fetch-Site policy.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const origin = request.headers.get('origin');
      const host = request.headers.get('host');

      if (origin && host) {
        try {
          const originUrl = new URL(origin);
          const isLocalhost = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
          const hostHostname = host.split(':')[0];

          if (!isLocalhost && originUrl.hostname !== hostHostname) {
            return new NextResponse(
              JSON.stringify({ error: 'Forbidden: Cross-site request rejected.' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
          }
        } catch {
          return new NextResponse(
            JSON.stringify({ error: 'Forbidden: Invalid request origin.' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // B. Edge Sliding Window Rate Limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth/');
    const maxRequests = isAuthRoute ? 15 : 60; // 15 req/min for auth routes, 60 for general API
    const limitWindow = 60000; // 1 minute window

    if (rateLimitMap.size > MAX_MIDDLEWARE_RATE_LIMIT_STORE) {
      pruneExpiredMiddlewareLimits();
    }

    const key = `${ip}:${isAuthRoute ? 'auth' : request.nextUrl.pathname}`;
    const now = Date.now();
    const currentRecord = rateLimitMap.get(key);

    if (!currentRecord || now > currentRecord.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + limitWindow });
    } else {
      if (currentRecord.count >= maxRequests) {
        return new NextResponse(
          JSON.stringify({ error: 'Too Many Requests. Rate limit exceeded.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((currentRecord.resetTime - now) / 1000)),
            },
          }
        );
      }
      currentRecord.count += 1;
      rateLimitMap.set(key, currentRecord);
    }

    // C. Validate Content-Type for state-mutating requests with payload
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers.get('content-type') || '';
      const contentLength = request.headers.get('content-length');
      if (
        contentLength &&
        contentLength !== '0' &&
        contentType &&
        !contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('application/x-www-form-urlencoded')
      ) {
        return new NextResponse(
          JSON.stringify({
            error: 'Unsupported Media Type: Request must be application/json or multipart/form-data',
          }),
          { status: 415, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // D. Edge Gatekeeper: Block unauthorized requests to /api/admin/* early
    if (request.nextUrl.pathname.startsWith('/api/admin/')) {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            data: null,
            error: {
              code: 'AUTH_UNAUTHORIZED',
              message: 'Unauthorized: Missing or malformed Bearer authorization token.',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|logo.svg|apple-touch-icon.png|favicon.svg|manifest.webmanifest|sw.js).*)'],
};
