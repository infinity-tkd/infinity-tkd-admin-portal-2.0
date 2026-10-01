import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const rawUrl = searchParams.get('url');

  let targetUrls: string[] = [];

  if (id && ALLOWED_ID_REGEX.test(id)) {
    targetUrls = [
      `https://lh3.googleusercontent.com/d/${id}`,
      `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
      `https://docs.google.com/uc?export=view&id=${id}`,
    ];
  } else if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        targetUrls = [parsed.toString()];
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL parameter' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'Missing id or url parameter' }, { status: 400 });
  }

  for (const url of targetUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const upstreamRes = await fetch(url, {
        method: 'GET',
        headers: {
          // Explicitly omit Referer header so Google Drive does not block with 429
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (upstreamRes.ok) {
        const contentType = upstreamRes.headers.get('content-type') || '';
        
        // Ensure upstream actually returned an image and not an HTML error page
        if (contentType.startsWith('image/') || contentType.includes('octet-stream')) {
          const arrayBuffer = await upstreamRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType.startsWith('image/') ? contentType : 'image/jpeg',
              'Content-Length': String(buffer.length),
              // Cache for 1 day in browser, 7 days in CDN
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
              'Access-Control-Allow-Origin': '*',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        }
      }
    } catch {
      // Try next fallback URL if available
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
      },
    }
  );
}
