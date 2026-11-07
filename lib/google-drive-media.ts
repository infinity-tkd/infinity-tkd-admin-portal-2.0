const fileIdPattern = /^[A-Za-z0-9_-]{10,64}$/;
export const driveResourceKeyPattern = /^[A-Za-z0-9_-]{1,150}$/;
const hosts = new Set(['drive.google.com', 'docs.google.com', 'lh3.googleusercontent.com']);

export function parseGoogleDriveFile(input: string): { fileId: string; resourceKey: string | null } | null {
  const value = input.trim();
  if (fileIdPattern.test(value)) return { fileId: value, resourceKey: null };
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password || url.port || /\/folders?(?:\/|$)/i.test(url.pathname)) return null;
    const fileId = url.pathname.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1] ?? url.searchParams.get('id');
    const resourceKey = url.searchParams.get('resourcekey');
    if (!fileId || !fileIdPattern.test(fileId) || (resourceKey !== null && !driveResourceKeyPattern.test(resourceKey))) return null;
    return { fileId, resourceKey };
  } catch { return null; }
}

export function directImageSource(input: string | null | undefined): string {
  const value = String(input ?? '').trim();
  if (!value) return '';
  const file = parseGoogleDriveFile(value);
  if (file) {
    const params = new URLSearchParams({ id: file.fileId });
    if (file.resourceKey) params.set('resourcekey', file.resourceKey);
    return '/api/image-proxy?' + params;
  }
  try { if (['drive.google.com', 'docs.google.com'].includes(new URL(value).hostname)) return ''; } catch { /* Ordinary non-Drive sources retain their existing handling. */ }
  return value;
}
