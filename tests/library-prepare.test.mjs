import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { legacyCategorySlug, parseTitleNames, suggestSlug, legacyLessonContent, preparationFor } = loadTs('lib/library-prepare.ts');
const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');
const { libraryV2QuerySchema, libraryV2DetailQuerySchema } = loadTs('lib/library-v2-contract.ts');

const description = (extra = {}) => JSON.stringify({ text: 'A sweeping kick.', actualCategory: 'Kicks (Chagi)', difficulty: 'Beginner', repsSets: '', focusZones: [],
  instructions: ['Chamber', 'Snap'], principles: ['Hips through'], mistakes: [{ mistake: 'Dropping hands', correction: 'Guard up' }], ...extra });
const asset = (title, extra = {}) => ({ id: 1, title, library_type: 'Taekwondo', tkd_category: 'Chagi', target_level: 'White', video_url: '', description: description(), category_id: null, slug: null, korean_name: null, romanized: null, summary: null, level_note: null, tags: [], content_kind: 'lesson', ...extra });

test('legacy categories: kicks split into basic and advanced, other legacy categories map to the website ones', () => {
  assert.equal(legacyCategorySlug(asset('Front Kick (Ap Chagi / 앞차기)')), 'kicking-fundamentals');
  for (const title of ['540 Hook Kick', 'Spinning Hook Kick (Dwi Huryeo Chagi / 뒤후려차기)', 'Jumping Front Kick', 'Pop Tornado Kick', 'Skip Hook Kick (Cut-Huryeo Chagi)'])
    assert.equal(legacyCategorySlug(asset(title)), 'kicking-advanced', title);
  assert.equal(legacyCategorySlug(asset('Back Kick (Dwit Chagi / 뒷차기)')), 'kicking-fundamentals', 'Dwit (back) is not Dwi (spinning)');
  assert.equal(legacyCategorySlug(asset('Low Block', { tkd_category: 'Poomsae', description: description({ actualCategory: 'Blocks (Makki)' }) })), 'hand-techniques');
  assert.equal(legacyCategorySlug(asset('Tiger Stance', { tkd_category: 'Poomsae', description: description({ actualCategory: 'Stances & Footwork (Seogi)' }) })), 'stances');
  assert.equal(legacyCategorySlug(asset('Pop Feilong', { tkd_category: 'Kyokpa', description: description({ actualCategory: 'Tricking & Acrobatics' }) })), 'tricking-acrobatics');
  assert.equal(legacyCategorySlug(asset('Squat', { library_type: 'Fitness' })), null, 'fitness lessons are not filed into Taekwondo categories');
});

test('titles: English, romanized and Korean names, and unique web names', () => {
  assert.deepEqual(parseTitleNames('Hook Kick (Huryeo Chagi / 후려차기)'), { english: 'Hook Kick', romanized: 'Huryeo Chagi', koreanName: '후려차기' });
  assert.deepEqual(parseTitleNames('Skip Hook Kick (Cut-Huryeo Chagi)'), { english: 'Skip Hook Kick', romanized: 'Cut-Huryeo Chagi', koreanName: null });
  assert.deepEqual(parseTitleNames('Pop 540 Kick'), { english: 'Pop 540 Kick', romanized: null, koreanName: null });
  assert.equal(parseTitleNames('Jumping Split Kick (Dwit Charae Chagi / 뛰어 가위차기 / 劈腿踢)').romanized, 'Dwit Charae Chagi', 'Chinese characters are not romanization');
  const used = new Set(['hook-kick']);
  assert.equal(suggestSlug('Hook Kick (Huryeo Chagi / 후려차기)', used), 'hook-kick-2');
  assert.equal(suggestSlug('360 Axe Kick (360 Naeryeo Chagi / 360 내려차기)', used), '360-axe-kick');
});

test('legacy content: guidance becomes sections, including old plain-text mistakes', () => {
  const content = legacyLessonContent(asset('Crescent Kick', { description: description({ mistakes: ['Leaning back too far'] }) }));
  assert.deepEqual(content.sections.map(section => section.id), ['glance', 'overview', 'steps', 'principles', 'mistakes']);
  assert.deepEqual(content.sections.find(section => section.id === 'mistakes').items, [{ term: 'Leaning back too far', detail: '' }]);
  // The same old format no longer blocks publishing.
  const projection = libraryPublicationProjection(asset('Crescent Kick', { description: description({ mistakes: ['Leaning back too far'] }) }));
  assert.deepEqual(projection.learning_content.mistakes, [{ mistake: 'Leaning back too far', correction: '' }]);
});

test('preparation: never replaces existing values; imported lessons keep their own details', () => {
  const categories = new Map([['kicking-advanced', 'c-adv'], ['kicking-fundamentals', 'c-basic']]);
  const legacy = preparationFor(asset('Spinning Hook Kick (Dwi Huryeo Chagi / 뒤후려차기)'), false, categories, new Set());
  assert.deepEqual([legacy.metadata.categoryId, legacy.metadata.koreanName, legacy.metadata.romanized, legacy.metadata.summary, legacy.metadata.slug], ['c-adv', '뒤후려차기', 'Dwi Huryeo Chagi', 'A sweeping kick.', 'spinning-hook-kick']);
  assert.ok(legacy.content.sections.length > 0);
  assert.deepEqual(legacy.changes, { category: 'kicking-advanced', content: true, names: true });

  const imported = preparationFor(asset('Scoring Targets (Article 11)', { category_id: 'c-rules', slug: 'scoring', content_kind: 'article', source_key: 'web:ref:x' }), true, categories, new Set());
  assert.deepEqual(imported.changes, { category: null, content: false, names: false }, 'nothing to do for imported items');
  assert.equal(imported.metadata.romanized, null, '"Article 11" is not read as a romanized name');
  assert.equal(imported.content, null);
});

test('library-v2 language: the student portal locale codes are accepted', () => {
  assert.equal(libraryV2QuerySchema.parse({ lang: 'kh' }).lang, 'km');
  assert.equal(libraryV2DetailQuerySchema.parse({ lang: 'zh-CN' }).lang, 'zh');
  assert.equal(libraryV2DetailQuerySchema.parse({}).lang, 'en');
  assert.ok(!libraryV2DetailQuerySchema.safeParse({ lang: 'fr' }).success);
});
