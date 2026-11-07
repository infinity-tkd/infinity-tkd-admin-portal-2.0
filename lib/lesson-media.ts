import { parseGoogleDriveFile } from './google-drive-media';

export type LessonMedia =
  | { kind: 'iframe'; provider: 'youtube' | 'google-drive' | 'vimeo'; src: string; href: string }
  | { kind: 'video'; src: string; href: string; mimeType: 'video/mp4' | 'video/webm' | 'video/ogg' }
  | { kind: 'external'; href: string }
  | { kind: 'unavailable' };

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be']);
function httpsUrl(input: string | null | undefined): URL | null {
  if (!input || input.length > 2000) return null;
  try {
    const url = new URL(input.trim());
    // The student portal rejects credentials and non-default ports, so neither is ever published.
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}

export function lessonYouTubeId(input: string | null | undefined): string | null {
  const url = httpsUrl(input);
  if (!url || url.port || !youtubeHosts.has(url.hostname)) return null;
  const id = ['youtu.be', 'www.youtu.be'].includes(url.hostname)
    ? url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
    : url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/**
 * Card artwork for a lesson: the authored HTTPS thumbnail, else the YouTube
 * poster for a YouTube video, else none. Never a third-party stock image.
 */
export function lessonThumbnailUrl(thumbnail: unknown, videoUrl: string | null | undefined): string | null {
  const authored = typeof thumbnail === 'string' ? httpsUrl(thumbnail) : null;
  if (authored) return authored.href;
  const youtube = lessonYouTubeId(videoUrl);
  return youtube ? 'https://i.ytimg.com/vi/' + youtube + '/hqdefault.jpg' : null;
}

/** Only known embed origins become frames; other HTTPS resources remain explicit links. */
export function resolveLessonMedia(input: string | null | undefined): LessonMedia {
  const url = httpsUrl(input);
  if (!url) return { kind: 'unavailable' };
  const href = url.href;
  const youtube = lessonYouTubeId(href);
  if (youtube) return { kind: 'iframe', provider: 'youtube', src: 'https://www.youtube-nocookie.com/embed/' + youtube, href };
  if (['drive.google.com', 'docs.google.com'].includes(url.hostname)) {
    const file = parseGoogleDriveFile(href);
    if (file) {
      const preview = new URL('https://drive.google.com/file/d/' + file.fileId + '/preview');
      if (file.resourceKey) preview.searchParams.set('resourcekey', file.resourceKey);
      return { kind: 'iframe', provider: 'google-drive', src: preview.href, href };
    }
  }
  if (!url.port && ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
    const match = url.pathname.match(/^\/(?:video\/)?([0-9]{1,12})(?:\/([A-Za-z0-9]{6,64}))?\/?$/);
    const hash = match?.[2] || url.searchParams.get('h');
    if (match && (!hash || /^[A-Za-z0-9]{6,64}$/.test(hash))) {
      const player = new URL('https://player.vimeo.com/video/' + match[1]);
      if (hash) player.searchParams.set('h', hash);
      return { kind: 'iframe', provider: 'vimeo', src: player.href, href };
    }
  }
  const extension = url.pathname.match(/\.(mp4|webm|ogg)$/i)?.[1].toLowerCase();
  if (extension) {
    // Lessons never autoplay; the student portal also rejects an autoplay source.
    const source = new URL(href);
    source.searchParams.delete('autoplay');
    return { kind: 'video', src: source.href, href, mimeType: ('video/' + extension) as 'video/mp4' | 'video/webm' | 'video/ogg' };
  }
  return { kind: 'external', href };
}
