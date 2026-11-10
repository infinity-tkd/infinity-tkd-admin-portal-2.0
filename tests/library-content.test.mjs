import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTs } from './load-ts.mjs';

const content = loadTs('lib/library-content.ts');
const v2 = loadTs('lib/library-v2-contract.ts');
const { libraryPublicationProjection } = loadTs('lib/library-publication.ts');
const { libraryContentSchema, localizeSection, localizeDocument, translatableTexts, readPath, writePath, pruneTranslation, legacySections, emptySection, nextSectionId, SECTION_TYPES } = content;

const sections = [
  { id: 'overview', type: 'text', title: 'Overview', paragraphs: ['First paragraph.', 'Second paragraph.'] },
  { id: 'steps', type: 'steps', title: 'Steps', items: [{ title: 'Chamber', body: 'Lift the knee.', details: ['Keep the guard up'] }, { title: '', body: 'Snap the kick.', details: [] }] },
  { id: 'terms', type: 'glossary', title: 'Terms', items: [{ korean: '앞차기', romanized: 'Ap-chagi', english: 'Front kick', category: 'Kick' }] },
  { id: 'scores', type: 'table', title: 'Scores', columns: ['Target', 'Points'], rows: [['Body', '2'], ['Head', '3']], caption: '' },
  { id: 'source-links', type: 'links', title: 'Links', items: [{ label: 'Kukkiwon', url: 'https://www.kukkiwon.or.kr' }] },
];

test('content schema: every section type, unique ids, matching table rows and https links', () => {
  const parsed = libraryContentSchema.parse({ sections, translations: { km: { title: 'ទាត់មុខ', sections: { steps: { title: 'ជំហាន' } } } }, sources: [] });
  assert.equal(parsed.sections.length, 5);
  for (const type of SECTION_TYPES.filter(type => type !== 'diagram' && type !== 'links')) assert.ok(libraryContentSchema.safeParse({ sections: [emptySection(type, type)] }).success, `${type} starts valid`);
  assert.match(libraryContentSchema.safeParse({ sections: [emptySection('links', 'links')] }).error.issues[0].message, /https/, 'a new link must be filled in before saving');
  assert.throws(() => emptySection('diagram', 'diagram'), /imported/);
  assert.match(libraryContentSchema.safeParse({ sections: [sections[0], { ...sections[0] }] }).error.issues[0].message, /share the id/);
  assert.match(libraryContentSchema.safeParse({ sections: [{ ...sections[3], rows: [['Body']] }] }).error.issues[0].message, /2 cells/);
  assert.ok(!libraryContentSchema.safeParse({ sections: [{ ...sections[4], items: [{ label: 'Plain', url: 'http://example.com' }] }] }).success, 'links must be https');
  assert.ok(!libraryContentSchema.safeParse({ sections: [{ id: 'Bad Id', type: 'text', title: '', paragraphs: [] }] }).success);
  assert.equal(nextSectionId(sections, 'steps'), 'steps-2');
  assert.equal(nextSectionId(sections, 'cards'), 'cards');
});

test('translations: sparse text over English, blanks and missing items fall back, structure never translated', () => {
  const steps = sections[1];
  const localized = localizeSection(steps, { title: 'ជំហាន', items: [{ body: 'លើកជង្គង់' }, { body: '' }] });
  assert.equal(localized.title, 'ជំហាន');
  assert.equal(localized.items[0].body, 'លើកជង្គង់');
  assert.equal(localized.items[0].title, 'Chamber', 'untranslated text stays English');
  assert.equal(localized.items[1].body, 'Snap the kick.', 'blank translations fall back');
  assert.deepEqual(localizeSection(sections[4], { items: [{ url: 'https://evil.example' }] }).items[0].url, 'https://www.kukkiwon.or.kr', 'links are never replaced');

  const fields = translatableTexts(steps);
  assert.deepEqual(fields.map(field => field.path.join('.')), ['title', 'items.0.title', 'items.0.body', 'items.0.details.0', 'items.1.body']);
  let translation = writePath(undefined, ['items', 1, 'body'], 'ទាត់');
  translation = writePath(translation, ['title'], '');
  assert.equal(readPath(translation, ['items', 1, 'body']), 'ទាត់');
  assert.deepEqual(pruneTranslation(translation), { items: ['', { body: 'ទាត់' }] });
  assert.equal(pruneTranslation({ title: ' ', items: [] }), undefined);

  const doc = localizeDocument({ title: 'Front kick', summary: 'Basic kick', koreanName: '앞차기', levelNote: 'White', sections, translations: { zh: { title: '前踢', sections: { overview: { paragraphs: ['第一段'] } } } } }, 'zh');
  assert.deepEqual([doc.title, doc.summary, doc.translated, doc.sections[0].paragraphs], ['前踢', 'Basic kick', true, ['第一段', 'Second paragraph.']]);
  assert.equal(localizeDocument({ title: 'Front kick', summary: null, koreanName: null, levelNote: null, sections, translations: {} }, 'km').translated, false);
});

test('legacy lessons: learning-v1 guidance becomes sections for the v2 feed', () => {
  const legacy = legacySections({ instructions: ['Chamber', 'Snap'], principles: ['Hips forward'], mistakes: [{ mistake: 'Dropping hands', correction: 'Guard up' }], terminology: [{ korean: '앞차기', english: 'Front kick', khmer: '' }] }, 'Overview text');
  assert.deepEqual(legacy.map(section => section.type), ['text', 'steps', 'list', 'pairs', 'glossary']);
  assert.ok(libraryContentSchema.safeParse({ sections: legacy }).success);
  assert.deepEqual(legacySections(null, ''), []);
});

test('library-v2 feed: summaries and lessons match the published contract, localized', () => {
  const summary = v2.libraryV2Summary({ id: 12, targetBelt: 'White', title: 'Front Kick', description: 'Legacy text', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', thumbnailUrl: null, type: 'Taekwondo', position: 2, durationSeconds: 245,
    published: { category: 'kicking', kind: 'lesson', slug: 'front-kick', summary: 'Basic kick', koreanName: '앞차기', romanized: 'Ap Chagi', levelNote: 'White Belt', tags: ['kick'], sectionCount: 5, translation: { title: 'ទាត់មុខ' } } });
  assert.deepEqual([summary.title, summary.summary, summary.translated, summary.media.kind, summary.position], ['ទាត់មុខ', 'Basic kick', true, 'iframe', 2]);
  const legacySummary = v2.libraryV2Summary({ id: 13, targetBelt: 'All', title: 'Old lesson', description: 'Old text', videoUrl: '', type: 'Taekwondo', published: null });
  assert.deepEqual([legacySummary.kind, legacySummary.category, legacySummary.summary, legacySummary.sectionCount], ['lesson', null, 'Old text', 0]);

  const page = { contractVersion: 'library-v2', subjectStudentId: 'STU-M-001', lang: 'km', nextCursor: null, lessons: [summary, legacySummary],
    categories: [v2.libraryV2Category({ slug: 'kicking', title: 'Kicking', korean_title: '발차기', subtitle: null, description: null, icon: 'Lightning', accent_color: '#FFD505', library_type: 'Taekwondo', translations: { km: { title: 'ក្បាច់ទាត់' } } }, 'km')] };
  assert.ok(v2.libraryV2PageSchema.safeParse(page).success, JSON.stringify(v2.libraryV2PageSchema.safeParse(page).error?.issues?.slice(0, 2)));
  assert.equal(page.categories[0].title, 'ក្បាច់ទាត់');

  const curriculum = { id: 12, target_belt: 'White', title: 'Front Kick', description: 'Legacy', video_url: '', thumbnail_url: null, content_type: 'Taekwondo', learning_content: {}, sort_order: null, duration_seconds: null };
  const published = { content_kind: 'lesson', document: { slug: 'front-kick', summary: 'Basic kick', koreanName: '앞차기', tags: [], sections, sources: [{ label: 'Kukkiwon', url: 'https://www.kukkiwon.or.kr' }], translations: { km: { sections: { steps: { title: 'ជំហាន' } } } } } };
  const lesson = v2.libraryV2Lesson(curriculum, published, 'kicking', 'km');
  assert.deepEqual([lesson.sections[1].title, lesson.languages, lesson.sources.length, lesson.category], ['ជំហាន', ['en', 'km'], 1, 'kicking']);
  assert.ok(v2.libraryV2DetailSchema.safeParse({ contractVersion: 'library-v2', subjectStudentId: 'STU-M-001', lang: 'km', lesson }).success);
  const legacyLesson = v2.libraryV2Lesson({ ...curriculum, learning_content: { instructions: ['Chamber'] } }, null, null, 'en');
  assert.deepEqual(legacyLesson.sections.map(section => section.type), ['text', 'steps']);
  assert.ok(v2.libraryV2QuerySchema.safeParse({ lang: 'zh', category: 'kicking', kind: 'article' }).success);
  assert.ok(!v2.libraryV2QuerySchema.safeParse({ lang: 'ko' }).success, 'only English, Khmer and Chinese');
});

const website = path.resolve('..', 'Infinity TKD Web', 'data', 'library');
test('website import: every lesson and article converts and validates', { skip: !fs.existsSync(path.join(website, 'index.ts')) && 'website checkout not present' }, () => {
  const files = ['index.ts', 'categories.ts', 'poomsae/poomsaeTranslations.ts', 'poomsae/poomsaeWalkthroughs.ts', 'kicking/kickingTranslations.ts', 'kicking/kickingTranslationsDetailed.ts', 'kicking/kickingAdvancedTranslations.ts',
    'hosinsul/hosinsulTranslations.ts', 'hosinsul/hosinsulCurriculum.ts', 'history/historyTranslations.ts', 'history/historyTimelineTranslations.ts', 'history/historyKwansTranslations.ts', 'history/historyOrganizationsTranslations.ts',
    'history/historyPhilosophyTranslations.ts', 'rules/competitionRulesData.ts', 'rules/competitionRulesTranslations.ts', 'rules/competitionRulesDetailedTranslations.ts', 'rules/freestyleScoringTranslations.ts', 'rules/ruleDocuments.ts'];
  const web = Object.assign({}, ...files.map(file => loadTs(path.join(website, file))));
  const { websiteImport, WEBSITE_MERGES } = loadTs('lib/library-website-import.ts');
  const { categories, items, report } = websiteImport(web);
  assert.equal(categories.length, 9);
  assert.equal(report.lessons, web.libraryItems.length);
  assert.ok(report.articles >= 30);
  assert.equal(report.merges, Object.keys(WEBSITE_MERGES).length);
  assert.equal(report.titleFixes, 3);
  assert.equal(report.diagrams, 8, 'every Taegeuk form keeps its floor diagram');
  assert.equal(new Set(items.map(item => item.sourceKey)).size, items.length);
  assert.equal(new Set(items.map(item => item.slug)).size, items.length);
  for (const item of items) {
    assert.ok(libraryContentSchema.safeParse(item.content).success, item.sourceKey);
    assert.doesNotThrow(() => libraryPublicationProjection({ description: item.description, video_url: item.videoUrl, library_type: 'Taekwondo', target_level: 'Unassigned', tkd_category: item.tkdCategory }), item.sourceKey);
    assert.ok(categories.some(category => category.slug === item.categorySlug), item.sourceKey);
    for (const lang of ['km', 'zh']) for (const id of Object.keys(item.content.translations[lang]?.sections ?? {})) assert.ok(item.content.sections.some(section => section.id === id), `${item.sourceKey} ${lang} ${id}`);
  }
  assert.ok(report.translatedKm > 100 && report.translatedZh > 100, 'most items carry Khmer and Chinese');
  assert.ok(!items.some(item => /[ក-៹]/.test(item.title) || /[一-鿿]/.test(item.title)), 'English is the base language');
});
