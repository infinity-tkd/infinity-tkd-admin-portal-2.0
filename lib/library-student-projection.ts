export const LESSON_TEXT_LIMIT = 20000;

export interface LibraryStudentProjection {
  description: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

function mediaLink(value: unknown, label: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) throw new Error(`${label} must be an HTTPS link.`);
  try {
    const url = new URL(value);
    // Same rule as the student portal: HTTPS, no credentials, default port only.
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error();
    return url.href;
  } catch { throw new Error(`${label} must be an HTTPS link.`); }
}

/** Publish only the authored public text and media, never arbitrary rich/staff metadata. */
export function libraryStudentProjection(asset: { description: string; video_url: string }): LibraryStudentProjection {
  let description = asset.description;
  let thumbnail: unknown = null;
  if (description.trim().startsWith('{')) {
    let metadata: Record<string, unknown>;
    try { metadata = JSON.parse(description); }
    catch { throw new Error('Review the lesson description before saving; its structured content is invalid.'); }
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('Invalid lesson description.');
    if (metadata.text !== undefined && typeof metadata.text !== 'string') throw new Error('Lesson text must be text.');
    description = typeof metadata.text === 'string' ? metadata.text : '';
    thumbnail = metadata.thumbnailUrl;
  }
  // learning-v1 accepts at most 20,000 characters of lesson text; a longer one would block the student's whole lesson page.
  if (description.length > LESSON_TEXT_LIMIT) throw new Error('Lesson text must be 20,000 characters or fewer.');
  return { description, video_url: mediaLink(asset.video_url, 'Video'), thumbnail_url: mediaLink(thumbnail, 'Thumbnail') };
}
