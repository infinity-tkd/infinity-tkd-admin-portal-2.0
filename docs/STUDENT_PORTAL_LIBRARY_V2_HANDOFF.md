# Student Portal: library-v2 (rich, translated library)

A paste-ready brief for the student portal team from the admin portal team, dated 2026-11-10.

The academy library now holds the full website library: 84 lessons and 31 reference articles in 9 categories. These cover poomsae, kicking, hand techniques, stances, self-defense, tricking, history and competition rules, in English, Khmer and Chinese. Staff edit everything in the admin portal: categories, sections, translations and order. A new feed, **library-v2**, delivers it to students.

- **learning-v1 is unchanged.** Your current lesson pages keep working. Move to library-v2 when you are ready; both feeds read the same published lessons.
- **When students see content:** imported lessons are private drafts with no belt yet. Students see a lesson only after staff choose its belt and publish it, so the feed fills up gradually.
- **Availability:** the database side (migration `20261110100715_library_content_structure`) and the content import are live on the shared database since 2026-11-10. The two endpoints answer once the matching admin portal update is deployed.

## 1. Endpoints

Both endpoints are on the admin portal origin (your `ACADEMY_PORTAL_API_ORIGIN`). They use the same student bearer token as learning-v1.

Send this header on every call, or the request is refused with `42501`:

```
X-Portal-Contract: library-v2
```

### `GET /api/portal/library`: one page of lesson cards

| Query | Type | Default | Notes |
|---|---|---|---|
| `lang` | `en`, `km` or `zh` | `en` | Text comes back already translated. A missing translation falls back to English, field by field. |
| `limit` | 1–50 | 25 | |
| `cursor` | string | none | Pass `nextCursor` from the previous page. |
| `q` | string, up to 100 characters | none | Searches the English title, the Korean name and the title in `lang`. |
| `category` | category `slug` | none | For example `poomsae` or `kicking-fundamentals`. |
| `kind` | `lesson` or `article` | none | Lessons are techniques and forms to practise; articles are reading and reference. |

Use each query parameter once. Repeating one returns `22023`.

```jsonc
{
  "success": true,
  "data": {
    "contractVersion": "library-v2",
    "subjectStudentId": "STU-M-001",
    "lang": "km",
    "categories": [ /* LibraryV2Category, in the order staff set */ ],
    "lessons":    [ /* LibraryV2LessonSummary */ ],
    "nextCursor": "…" // or null
  }
}
```

A page can hold fewer than `limit` lessons, even zero, while `nextCursor` is not null. The server skips lessons above the student's belt after reading a range of ids. Keep paging until `nextCursor` is null.

### `GET /api/portal/library/{id}?lang=km`: one lesson with all its sections

`{id}` is the lesson `id` from the list. These are the same ids as learning-v1 and `student_portal_progress.curriculum_id`.

```jsonc
{ "success": true, "data": { "contractVersion": "library-v2", "subjectStudentId": "STU-M-001", "lang": "km", "lesson": { /* LibraryV2Lesson */ } } }
```

The endpoint answers `404` (`P0002`, "This lesson is not available.") in each of these cases:
- the lesson is unpublished;
- the lesson is above the student's belt;
- the lesson's category is hidden.

## 2. Types

You can paste these. We recommend **non-strict** parsing, without `.strict()`, so additive fields never break your pages. That was the problem with learning-v1.

```ts
type Lang = 'en' | 'km' | 'zh';
type LessonMedia =
  | { kind: 'iframe'; provider: 'youtube' | 'google-drive' | 'vimeo'; src: string; href: string }
  | { kind: 'video'; src: string; href: string; mimeType: 'video/mp4' | 'video/webm' | 'video/ogg' }
  | { kind: 'external'; href: string }
  | { kind: 'unavailable' };

interface LibraryV2Category {
  slug: string; title: string; koreanTitle: string | null; subtitle: string | null; description: string | null;
  icon: string;          // Phosphor icon name: BookOpen, Lightning, Fire, Shield, Stack, Sparkle, Medal, Scroll, Target, Barbell, MusicNotes, Hand, Footprints, Brain, Users, Star
  accentColor: string;   // "#RRGGBB"
  type: 'Taekwondo' | 'Fitness' | 'Dance';
}

interface LibraryV2LessonSummary {
  id: number; slug: string | null; kind: 'lesson' | 'article'; category: string | null; // category slug
  title: string; koreanName: string | null; romanized: string | null; summary: string | null;
  levelNote: string | null;   // text such as "Green belt and above"; not a belt rule
  targetBelt: string;         // the belt staff chose ("All", "White", …); the server already filtered by it
  type: 'Taekwondo' | 'Fitness' | 'Dance';
  thumbnailUrl: string | null; media: LessonMedia;
  position: number | null;    // order within its belt (Library → Lesson order)
  durationSeconds: number | null;
  tags: string[]; sectionCount: number;
  translated: boolean;        // true when any text in `lang` differs from English
}

interface LibraryV2Lesson extends LibraryV2LessonSummary {
  sections: LibrarySection[];
  sources: { label: string; url: string }[];  // https links
  languages: Lang[];                          // languages this lesson has text in, always including 'en'
}
```

### Section types

Each section has an `id` (stable, unique within the lesson), a `type` and a `title`. The title may be empty; show no heading then. Render sections in array order.

| `type` | Fields | Suggested rendering |
|---|---|---|
| `text` | `paragraphs: string[]` | Paragraphs. |
| `list` | `style: 'bullet' \| 'number' \| 'check'`, `items: string[]` | Bulleted, numbered or checklist. |
| `steps` | `items: { title, body, details: string[] }[]` | Numbered steps. `title` may be empty; `details` are sub-bullets. |
| `pairs` | `leftLabel`, `rightLabel`, `items: { term, detail }[]` | Two columns, or term over detail on phones. Labels such as "Mistake" and "Correction" may be empty. |
| `glossary` | `items: { korean, romanized, english, category }[]` | Korean terms with `lang="ko"` on the Korean text. |
| `facts` | `items: { label, value }[]` | A key facts grid ("At a glance"). |
| `table` | `columns: string[]`, `rows: string[][]`, `caption` | A table; every row has `columns.length` cells. Scroll sideways inside the table on phones, not the page. |
| `timeline` | `items: { date, title, subtitle, body, details: string[], tag }[]` | A vertical timeline. `tag` is an era label. |
| `cards` | `items: { title, subtitle, body, bullets: string[], facts: {label,value}[] }[]` | A card grid. Used for the 9 Kwans, organizations, virtues, vital points and self-defense techniques. |
| `links` | `items: { label, url }[]` | External links (https only). |
| `callout` | `tone: 'info' \| 'tip' \| 'warning'`, `body` | A highlighted note. `warning` is used for legal and safety notes. |
| `diagram` | `kind: 'poomsae-walkthrough'`, `data` | A poomsae floor plan; see below. |

**Unknown types:** if a new `type` ever appears, skip that section rather than failing the page.

**Poomsae diagrams:** `data` is the website's walkthrough geometry, `{ start: {x,y}, startFacing: 'N'|'E'|'S'|'W', startStance: { type, lead? }, guides: { from:{x,y}, to:{x,y} }[], verified: boolean, steps: { to:{x,y}, facing, stance: { type, lead? }, techniques: string[] }[] }`. Coordinates are in a 340×260 box. Each step matches, in order, the item at the same index in the lesson's `steps` section. All 8 Taegeuk forms have one. The website's `components/library/PoomsaeWalkthrough.tsx` (Infinity TKD Web repo) renders this data as it is, so you can reuse it.

## 3. Languages

- **Translation is already done on the server.** Pass `lang` and render what comes back. Do not merge translations yourself.
- **Mixed text is expected.** A field without a translation arrives in English, so a page can mix Khmer and English while staff finish translating.
- **Korean language:** Korean text in `koreanName` and in glossary `korean` stays Korean in every language. Mark it with `lang="ko"`.
- **Language codes:** the portal locales `kh` and `zh-CN` map to `km` and `zh`.

## 4. Belts and visibility

- **Belt rule:** a student sees a lesson when its `targetBelt` is `All` or a belt at or below their own. This is the same rule as learning-v1, and the server applies it, so do not filter again.
- **Level note:** `levelNote` is descriptive text from the website (for example "Black Belt & Demo Team"). Show it as a label; it does not restrict access.
- **Hidden categories:** staff can hide a category. Its lessons then disappear from both endpoints, and the category disappears from `categories`.

## 5. Lessons published before library-v2

The 81 lessons that were already live have no sections yet. For those, library-v2 returns:
- `category`, `slug`, `koreanName` and `summary` as `null` until staff edit them;
- `summary` falling back to the lesson text;
- sections built from their learning-v1 guidance (text, steps, principles, mistakes, terminology).

Every published lesson therefore renders with one component.

## 6. Progress and practice

Nothing changes. Keep recording progress against the lesson `id` (`curriculum_id`) exactly as with learning-v1.

## 7. Suggested screens

1. **Library home:** category tiles in `categories` order, using `icon`, `accentColor`, `title` and `koreanTitle`.
2. **Category page:** lesson cards with `title`, `koreanName`, `summary` and a `kind` badge (Article). Order by `position` (nulls last), then title.
3. **Lesson page:** media at the top when `media.kind !== 'unavailable'`, then `levelNote` and the sections in order, with sources at the bottom.
4. **Language switch:** use the student's portal language. `languages` tells you which languages have real text, if you want a "Translated" badge.

## 8. Checklist

- [ ] Add a library-v2 client that sends `X-Portal-Contract: library-v2` and the bearer token.
- [ ] Parse with non-strict schemas; skip unknown section types.
- [ ] Map portal locales to `en`, `km` or `zh` for `lang`.
- [ ] Render the 12 section types, including the poomsae diagram.
- [ ] Page with `nextCursor` until it is null; expect short or empty pages.
- [ ] Keep learning-v1 until library-v2 screens ship, then switch.

Questions go to the admin portal team. The contract lives in the admin repo at `lib/library-v2-contract.ts`, and its tests are in `tests/library-content.test.mjs`.
