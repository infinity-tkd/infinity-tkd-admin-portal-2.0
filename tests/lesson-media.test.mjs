import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server.js';
import { loadTs } from './load-ts.mjs';
const { resolveLessonMedia, lessonYouTubeId } = loadTs('lib/lesson-media.ts');
const { getEmbedVideoUrl } = loadTs('lib/utils.ts');
const { LessonMediaPlayer } = loadTs('components/library/LessonMediaPlayer.tsx');
const render = url => renderToStaticMarkup(React.createElement(LessonMediaPlayer, { url, title: 'Fixture lesson media' }));

test('exact HTTPS providers resolve to approved privacy-conscious frames', () => {
  for (const url of ['https://youtu.be/abcdefghijk?t=30', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://m.youtube.com/shorts/abcdefghijk', 'https://www.youtube-nocookie.com/embed/abcdefghijk']) {
    assert.equal(lessonYouTubeId(url), 'abcdefghijk');
    assert.equal(resolveLessonMedia(url).src, 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  }
  assert.equal(resolveLessonMedia('https://vimeo.com/123456789').src, 'https://player.vimeo.com/video/123456789');
  assert.equal(resolveLessonMedia('https://vimeo.com/123456789/abcdef1234').src, 'https://player.vimeo.com/video/123456789?h=abcdef1234');
  assert.equal(resolveLessonMedia('https://drive.google.com/file/d/fixture_drive_id_123/view?resourcekey=key_123').src, 'https://drive.google.com/file/d/fixture_drive_id_123/preview?resourcekey=key_123');
});

test('provider-like hosts, credentials and active schemes never produce a frame', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'http://youtube.com/watch?v=abcdefghijk', 'https://owner:secret@youtube.com/watch?v=abcdefghijk', '//youtu.be/abcdefghijk', 'fixture_drive_id_123', 'not a link']) assert.equal(resolveLessonMedia(url).kind, 'unavailable', url);
  for (const url of ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://evil.test/watch?v=abcdefghijk', 'https://vimeo.com.evil.test/123456789', 'https://www.youtube.com/playlist?list=fixture']) {
    assert.equal(resolveLessonMedia(url).kind, 'external'); assert.equal(getEmbedVideoUrl(url), '');
  }
});

test('direct media uses native video and never an iframe while other HTTPS links remain external', () => {
  for (const extension of ['mp4', 'webm', 'ogg']) {
    const url = 'https://media.example.test/lesson.' + extension + '?version=2';
    const media = resolveLessonMedia(url); assert.equal(media.kind, 'video'); assert.equal(media.mimeType, 'video/' + extension); assert.equal(getEmbedVideoUrl(url), '');
    const html = render(url);
    assert.match(html, /<video/); assert.match(html, /controls=""/); assert.match(html, /playsInline=""/); assert.match(html, /preload="none"/); assert.match(html, /aria-label="Fixture lesson media"/); assert.doesNotMatch(html, /<iframe/);
  }
  const external = render('https://academy-resources.example.test/watch/lesson');
  assert.doesNotMatch(external, /<iframe|<video/); assert.match(external, /Open original resource/); assert.match(external, /rel="noopener noreferrer"/);
  assert.doesNotMatch(render('javascript:alert(1)'), /href=|<iframe|<video/);
});

test('the shared player gives approved iframes an accessible title and guarded resource origin', () => {
  const html = render('https://vimeo.com/123456789');
  assert.match(html, /<iframe/); assert.match(html, /src="https:\/\/player.vimeo.com\/video\/123456789"/); assert.match(html, /title="Fixture lesson media"/); assert.match(html, /referrerPolicy="strict-origin-when-cross-origin"/);
});

test('native media policy permits HTTPS playback without widening frame origins', () => {
  const { middleware } = loadTs('middleware.ts');
  const response = middleware(new NextRequest('https://portal.example/library'));
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /media-src 'self' https: blob:/);
  const frame = csp.split(';').find(part => part.trim().startsWith('frame-src'));
  assert.ok(frame.includes('https://player.vimeo.com'));
  assert.equal(frame.trim().split(/\s+/).includes('https:'), false, 'frames do not gain a wildcard HTTPS origin');
});
