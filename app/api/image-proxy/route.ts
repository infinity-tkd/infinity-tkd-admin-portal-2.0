import { NextRequest, NextResponse } from 'next/server';
import { checkApiRateLimit } from '@/lib/backend-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB payload ceiling

/**
 * Strict hostname allowlist for image proxying to mitigate SSRF
 */
function isAllowedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  // Explicit allowed hostnames
  if (
    normalized === 'lh3.googleusercontent.com' ||
    normalized === 'drive.google.com' ||
    normalized === 'docs.google.com' ||
    normalized === 'picsum.photos'
  ) {
    return true;
  }

  // Approved Supabase storage domains
  if (normalized.endsWith('.supabase.co') || normalized.endsWith('.supabase.com')) {
    return true;
  }

  return false;
}

/**
 * Checks for private, loopback, or cloud metadata IP ranges to prevent SSRF
 */
function isDisallowedIp(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Localhost, link-local, or IPv6 loopback
  if (h === 'localhost' || h === '::1' || h.startsWith('fe80:') || h.startsWith('fc00:')) {
    return true;
  }

  // IPv4 regex checks for private / loopback / link-local / metadata
  // 127.0.0.0/8 (Loopback)
  // 10.0.0.0/8 (Private)
  // 172.16.0.0/12 (Private)
  // 192.168.0.0/16 (Private)
  // 169.254.0.0/16 (Link-local & AWS/Cloud Metadata)
  // 0.0.0.0/8 (Current network)
  const isPrivateIpv4 =
    /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/.test(h);

  return isPrivateIpv4;
}

export async function GET(request: NextRequest) {
  // 1. Sliding Window Rate Limiting (60 requests/minute per IP)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimit = checkApiRateLimit(`image-proxy:${ip}`, 60, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Too many image requests.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rateLimit.resetMs / 1000)) },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const rawUrl = searchParams.get('url');

  let targetUrls: string[] = [];

  if (id) {
    if (!ALLOWED_ID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid Google Drive ID format' }, { status: 400 });
    }
    targetUrls = [
      `https://lh3.googleusercontent.com/d/${id}`,
      `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
      `https://docs.google.com/uc?export=view&id=${id}`,
    ];
  } else if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);

      // Strictly enforce HTTPS
      if (parsed.protocol !== 'https:') {
        return NextResponse.json(
          { error: 'Insecure protocol rejected. Only HTTPS URLs are permitted.' },
          { status: 400 }
        );
      }

      // Block SSRF to internal/private IPs and require allowlisted host
      if (isDisallowedIp(parsed.hostname) || !isAllowedHost(parsed.hostname)) {
        return NextResponse.json(
          { error: 'Forbidden: Target hostname is not on the approved asset allowlist.' },
          { status: 403 }
        );
      }

      targetUrls = [parsed.toString()];
    } catch {
      return NextResponse.json({ error: 'Invalid URL parameter' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'Missing id or url parameter' }, { status: 400 });
  }

  for (const url of targetUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const upstreamRes = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/jpeg,image/png;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (upstreamRes.ok) {
        const contentType = upstreamRes.headers.get('content-type') || '';
        const contentLength = parseInt(upstreamRes.headers.get('content-length') || '0', 10);

        // Ceiling payload to prevent memory exhaustion DoS
        if (contentLength > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Upstream image exceeds maximum size limit' }, { status: 413 });
        }

        // Strictly allow raster image formats (prevent HTML/JS or malicious polyglot file injection)
        const isAllowedImage = /^(?:image\/(?:jpeg|png|webp|avif|gif|vnd\.microsoft\.icon))$/i.test(contentType);
        if (isAllowedImage) {
          const arrayBuffer = await upstreamRes.arrayBuffer();
          if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: 'Upstream image payload too large' }, { status: 413 });
          }

          const buffer = Buffer.from(arrayBuffer);

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(buffer.length),
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
              'X-Content-Type-Options': 'nosniff',
              'Content-Security-Policy': "default-src 'none'",
            },
          });
        }
      }
    } catch {
      // Continue to next fallback URL if available
      continue;
    }
  }

  // Fallback: return 1x1 transparent PNG
  return new NextResponse(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
