'use client';

import React, { useState } from 'react';
import { resolveLessonMedia } from '@/lib/lesson-media';

/** Shared lesson player: no autoplay, unsupported frames or eager media downloads. */
export function LessonMediaPlayer({ url, title, className = '' }: { url?: string | null; title: string; className?: string }) {
  const media = resolveLessonMedia(url);
  const [failedSource, setFailedSource] = useState('');
  const failed = media.kind === 'video' && failedSource === media.src;
  if (media.kind === 'iframe') return <iframe src={media.src} title={title} className={'h-full w-full border-0 ' + className} allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
  if (media.kind === 'video' && !failed) return <video key={media.src} aria-label={title} className={'h-full w-full bg-black object-contain ' + className} controls playsInline preload="none" onError={() => setFailedSource(media.src)}><source src={media.src} type={media.mimeType} onError={() => setFailedSource(media.src)} /><a href={media.href} target="_blank" rel="noopener noreferrer">Open video resource</a></video>;
  return <div className={'flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center ' + className} role="group" aria-label={title}>
    <p className="max-w-sm text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{failed ? 'Video playback is unavailable. Open the original resource to continue.' : media.kind === 'external' ? 'This resource opens on its original website.' : 'No playable video is attached to this lesson.'}</p>
    {media.kind !== 'unavailable' && <a href={media.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">Open original resource<span className="sr-only"> for {title} in a new tab</span></a>}
  </div>;
}
