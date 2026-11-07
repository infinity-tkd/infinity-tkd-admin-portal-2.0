import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTs } from './load-ts.mjs';

// Validates admin learning-v1 / shop-v1 output with the student portal's own
// contract file when the sibling checkout is present (as the calendar tests do).
const siblingContract = path.resolve('..', 'infinitytkd student portal 2.0', 'lib', 'published-catalog-contract.ts');
const present = fs.existsSync(siblingContract);
const { studentLesson, studentProduct } = loadTs('lib/student-catalog-contract.ts');
const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');

const row = overrides => ({
  id: 7, target_belt: 'White', category: 'Recognized Poomsae', title: 'Taegeuk Il Jang', description: 'First form.',
  video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail_url: null, content_type: 'Taekwondo', content_category: 'Forms (Poomsae)',
  learning_content: { difficulty: 'Beginner', instructions: ['Step 1: Bow'], mistakes: [{ mistake: 'Leaning', correction: 'Stay upright' }], terminology: [{ korean: 'Kyeong-rye', english: 'Bow', khmer: '' }], studyGuide: [], muscleTargets: [{ muscleId: 3, role: 'Primary' }] },
  ...overrides,
});

test('every learning-v1 lesson shape the admin portal can emit passes the student portal contract', { skip: !present && 'student portal checkout not found' }, () => {
  const { publishedLessonSchema, learningCatalogSchema } = loadTs(siblingContract);
  const cases = {
    youtube: row({}),
    vimeoPrivate: row({ id: 8, video_url: 'https://vimeo.com/123456789/abcdef1234' }),
    driveWithKey: row({ id: 9, video_url: 'https://drive.google.com/file/d/1lBmAnT-53eMCmhIc0tjwv9Hb1V9gfvsG/view?resourcekey=0-abc_DEF' }),
    mp4Autoplay: row({ id: 10, video_url: 'https://cdn.example.test/lesson.mp4?autoplay=1' }),
    customPort: row({ id: 11, video_url: 'https://cdn.example.test:8443/lesson.mp4' }),
    externalPage: row({ id: 12, video_url: 'https://example.test/lesson-notes' }),
    noVideo: row({ id: 13, video_url: null, description: null, learning_content: {} }),
    longText: row({ id: 14, description: 'x'.repeat(25000) }),
  };
  const lessons = Object.entries(cases).map(([name, input]) => {
    const lesson = studentLesson(input);
    assert.ok(lesson, name + ' maps');
    const result = publishedLessonSchema.safeParse(lesson);
    assert.ok(result.success, name + ': ' + JSON.stringify(result.error?.issues?.slice(0, 2)));
    return lesson;
  });
  assert.equal(lessons.find(lesson => lesson.id === 10).media.src.includes('autoplay'), false, 'autoplay is removed from the playable source');
  assert.equal(lessons.find(lesson => lesson.id === 11).media.kind, 'unavailable', 'a custom port is never published');
  assert.ok(learningCatalogSchema.safeParse({ lessons, nextCursor: null }).success, 'a full page parses');
});

test('lesson publishing rejects what learning-v1 would reject', () => {
  const asset = { description: JSON.stringify({ text: 'Overview' }), video_url: 'https://cdn.example.test/lesson.mp4', library_type: 'Taekwondo', target_level: 'White', tkd_category: 'Poomsae', fitness_category: null };
  assert.ok(libraryPublicationProjection(asset));
  assert.throws(() => libraryPublicationProjection({ ...asset, description: JSON.stringify({ text: 'x'.repeat(20001) }) }), /20,000/);
  assert.throws(() => libraryPublicationProjection({ ...asset, video_url: 'https://cdn.example.test:8443/lesson.mp4' }), /HTTPS/);
});

test('shop-v1 products from the admin portal pass the student portal contract', { skip: !present && 'student portal checkout not found' }, () => {
  const { publishedProductSchema } = loadTs(siblingContract);
  const simple = studentProduct({ id: '91000000-0000-4000-8000-000000000101', sku: 'BELT-W', name: 'White belt', category_name: 'Belts', description: null, image_url: null, price_usd: 5, stock: 12, has_variants: false, product_variants: [] });
  const sized = studentProduct({ id: '91000000-0000-4000-8000-000000000102', sku: 'DOBOK', name: 'Dobok', category_name: 'Uniforms', description: 'Training uniform', image_url: null, price_usd: 30, stock: 0, has_variants: true, product_variants: [
    { id: '91000000-0000-4000-8000-000000000201', sku: 'DOBOK-S', size: 'S', color: null, price_override: null, stock: 3, is_active: true },
    { id: '91000000-0000-4000-8000-000000000202', sku: 'DOBOK-M', size: 'M', color: null, price_override: 32, stock: 4, is_active: true },
  ] });
  for (const product of [simple, sized]) {
    const result = publishedProductSchema.safeParse(product);
    assert.ok(result.success, product.sku + ': ' + JSON.stringify(result.error?.issues?.slice(0, 2)));
  }
});
