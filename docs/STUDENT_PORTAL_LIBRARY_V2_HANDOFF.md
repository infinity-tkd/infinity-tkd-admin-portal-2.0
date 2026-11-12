# Student Portal: library-v2 (rich, translated library)

A paste-ready brief for the student portal team from the admin portal team. First written 2026-11-10; this version is dated 2026-11-12.

The academy library now holds the full website library plus the academy's own lessons: 172 lessons and articles in 9 categories. They cover poomsae, basic and advanced kicking, hand techniques, stances, self-defense, tricking, history and competition rules. Text comes in English, Khmer and Chinese.

Staff manage everything in the admin portal: categories, sections, translations, order and publishing. The **library-v2** feed delivers it to students.

- **learning-v1 is unchanged.** Your current lesson pages keep working. Both feeds read the same published lessons and the same lesson ids, so progress stays where it is.
- **Content appears when published.** A lesson reaches students only after staff publish it with a belt. Section 8 lists what is live today.
- **Section 5 is the integration guide.** It contains code written against your own gateway helpers: `academyData`, `academyPortalOrigin`, `publishedImage`, `verifyCaller` and `calendarErrorResponse`.

## 1. Endpoints

Both endpoints are on the admin portal origin (`ACADEMY_PORTAL_API_ORIGIN`) and use the same student bearer token as learning-v1. Your `academyFetch` sends the header `X-Portal-Contract: library-v2` once the contract version is `library-v2`; without that header the request is refused with `42501`.

### `GET /api/portal/library`: one page of lesson cards plus the categories

| Query | Type | Default | Notes |
|---|---|---|---|
| `lang` | `en`, `km`, `zh`, also `kh` and `zh-CN` | `en` | Your portal locales are accepted as they are. Text comes back translated, falling back to English field by field. |
| `limit` | 1–50 | 25 | |
| `cursor` | string | none | Pass `nextCursor` from the previous page, with the same filters. |
| `q` | string, up to 100 characters | none | Searches the English title, the Korean name and the title in `lang`. |
| `category` | category `slug` | none | For example `poomsae` or `kicking-fundamentals`. |
| `kind` | `lesson` or `article` | none | Lessons are techniques and forms to practise; articles are reading and reference (history, rules, theory). |

Use each parameter once; repeating one returns `422`. A page can hold fewer than `limit` lessons, even zero, while `nextCursor` is not null. The server skips lessons above the student's belt after reading a range of ids. Keep paging until `nextCursor` is null.

### `GET /api/portal/library/{id}?lang=km`: one lesson with all its sections

`{id}` is the lesson `id` from the list. These are the same ids as learning-v1 and as `student_portal_progress.curriculum_id`.

The endpoint answers `404`, which your gateway reports as `SOURCE_UNAVAILABLE`, in each of these cases:
- the lesson is unpublished;
- the lesson is above the student's belt;
- the lesson's category is hidden.

### Response envelope

This is the envelope your `parseAcademyEnvelope` already expects:

```jsonc
{ "success": true, "error": null, "data": { "contractVersion": "library-v2", "subjectStudentId": "STU-M-001",
  "lang": "km", "categories": [ … ], "lessons": [ … ], "nextCursor": "…" } }          // list
{ "success": true, "error": null, "data": { "contractVersion": "library-v2", "subjectStudentId": "STU-M-001",
  "lang": "km", "lesson": { … } } }                                                   // one lesson
```

**Size:** the largest single response today is 68 KB (the belt-by-belt self-defense curriculum), well inside your gateway's 1 MB limit and 8 second timeout. A list page is about 15 KB.

## 2. Data shapes

The paste-ready zod schemas are in **`docs/student-portal/library-v2-contract.example.ts.txt`**. Save that file as `lib/library-v2-contract.ts`. It is tested against every sample response in `tests/library-v2-handoff.test.mjs`.

It deliberately avoids `.strict()`, and it **drops unknown section types instead of failing the lesson**, so the admin portal can add fields and types later without breaking your pages. That is the lesson learned from learning-v1.

```ts
interface LibraryCategory {
  slug: string; title: string; koreanTitle: string | null; subtitle: string | null; description: string | null;
  icon: string;          // Phosphor icon name: BookOpen, Lightning, Fire, Shield, Stack, Sparkle, Medal, Scroll, Target, Barbell, MusicNotes, Hand, Footprints, Brain, Users, Star
  accentColor: string;   // "#RRGGBB"
  type: 'Taekwondo' | 'Fitness' | 'Dance';
}
interface LibraryLessonSummary {
  id: number; slug: string | null; kind: 'lesson' | 'article'; category: string | null;   // category slug
  title: string; koreanName: string | null; romanized: string | null; summary: string | null;
  levelNote: string | null;   // descriptive, e.g. "Green belt and above"; not an access rule
  targetBelt: string;         // the belt staff chose ("All", "White", …); the server already filtered by it
  type: 'Taekwondo' | 'Fitness' | 'Dance'; thumbnailUrl: string | null; media: LessonMedia;
  position: number | null;    // order within its belt (staff set it in Library → Lesson order)
  durationSeconds: number | null; tags: string[]; sectionCount: number;
  translated: boolean;        // some text in `lang` differs from English
}
interface LibraryLesson extends LibraryLessonSummary {
  sections: LibrarySection[]; sources: { label: string; url: string }[];
  languages: ('en' | 'km' | 'zh')[];   // languages with real text, always including 'en'
}
```

`LessonMedia` is the same union learning-v1 uses (`iframe` for YouTube, Google Drive or Vimeo; `video`; `external`; `unavailable`). Your `lessonMedia` checks apply unchanged.

### Section types

Each section has an `id` (stable and unique within the lesson), a `type` and a `title`. The title may be empty; show no heading then. Render sections in array order.

| `type` | Fields | Suggested rendering |
|---|---|---|
| `text` | `paragraphs: string[]` | Paragraphs. |
| `list` | `style: 'bullet' \| 'number' \| 'check'`, `items: string[]` | Bulleted, numbered or checklist. |
| `steps` | `items: { title, body, details: string[] }[]` | Numbered steps. `title` may be empty; `details` are sub-bullets. |
| `pairs` | `leftLabel`, `rightLabel`, `items: { term, detail }[]` | Two columns, or term over detail on phones. Labels such as "Mistake" and "Correction" may be empty. |
| `glossary` | `items: { korean, romanized, english, category }[]` | Korean terms; put `lang="ko"` on the Korean text. |
| `facts` | `items: { label, value }[]` | A key facts grid ("At a glance"). |
| `table` | `columns: string[]`, `rows: string[][]`, `caption` | A table; every row has `columns.length` cells. Scroll sideways inside the table on phones, not the page. |
| `timeline` | `items: { date, title, subtitle, body, details: string[], tag }[]` | A vertical timeline. `tag` is an era label. |
| `cards` | `items: { title, subtitle, body, bullets: string[], facts: {label,value}[] }[]` | A card grid. Used for the 9 Kwans, organizations, virtues, vital points and self-defense techniques. |
| `links` | `items: { label, url }[]` | External links (https only). |
| `callout` | `tone: 'info' \| 'tip' \| 'warning'`, `body` | A highlighted note. `warning` is used for legal and safety notes. |
| `diagram` | `kind: 'poomsae-walkthrough'`, `data` | A poomsae floor plan; see below. |

**Poomsae diagrams:** `data` is `{ start: {x,y}, startFacing: 'N'|'E'|'S'|'W', startStance: { type, lead? }, guides: { from, to }[], verified, steps: { to: {x,y}, facing, stance: { type, lead? }, techniques: string[] }[] }`. Coordinates are in a 340×260 box. Step *n* matches the item at index *n* of the lesson's `steps` section.

All 8 Taegeuk forms have one. The website's `components/library/PoomsaeWalkthrough.tsx` (Infinity TKD Web repo) renders exactly this data, so you can reuse it.

## 3. Languages

- **Translation is already done on the server.** Pass `lang` and render what comes back. Do not merge translations yourself.
- **Mixed text is expected.** A field without a translation arrives in English, so a page may mix Khmer and English while staff finish translating.
- **Korean language:** Korean text in `koreanName`, glossary `korean` and card subtitles stays Korean in every language. Mark it with `lang="ko"`.
- **Language codes:** `kh` and `zh-CN` are accepted, so you can pass your portal locale as it is.

## 4. Belts, visibility and existing lessons

- **Belt rule:** a student sees a lesson when its `targetBelt` is `All` or a belt at or below their own. This is the same rule as learning-v1, applied on the server, so do not filter again.
- **Level note:** `levelNote` is descriptive text (for example "Black Belt & Demo Team"). Show it as a label; it does not restrict access.
- **Hidden categories:** staff can hide a category. Its lessons then disappear from both endpoints, and the category disappears from `categories`.
- **Lessons published before library-v2** have no snapshot until staff republish them. library-v2 still returns them, with `category`, `slug` and `koreanName` as `null` and sections built from their learning-v1 guidance. One renderer therefore works for every lesson.

## 5. Integration guide (your repository)

These steps follow your existing learning-v1 gateway (`lib/student-published-catalog.ts` and `app/api/student/learning/library/route.ts`).

**1. Contract version.** In `lib/academy-integration-contract.ts`:

```ts
export type AcademyContractVersion = "calendar-v1" | "shop-v1" | "learning-v1" | "library-v2";
```

`academyPortalOrigin("library-v2")` then uses the same switches as learning-v1: `ACADEMY_PORTAL_INTEGRATION_ENABLED=true`, `ACADEMY_CATALOG_INTEGRATION_ENABLED=true` and `ACADEMY_PORTAL_API_ORIGIN`. No new environment variable is needed.

**2. Schemas.** Copy `docs/student-portal/library-v2-contract.example.ts.txt` to `lib/library-v2-contract.ts`.

**3. Gateway:** `lib/student-library-v2.ts`

```ts
import { z } from "zod";
import { academyData, academyPortalOrigin, AcademyGatewayError } from "./academy-portal-backend";
import { publishedImage } from "./student-published-catalog";
import { LIBRARY_V2, libraryPageSchema, libraryLessonResponseSchema } from "./library-v2-contract";

const LANG: Record<string, "en" | "km" | "zh"> = { en: "en", kh: "km", km: "km", zh: "zh", "zh-CN": "zh" };
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  cursor: z.string().min(1).max(4000).optional(),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
  kind: z.enum(["lesson", "article"]).optional(),
  lang: z.string().max(10).optional(),
}).strict();
const invalid = () => new AcademyGatewayError(400, "INVALID_LIBRARY_FILTER", "Choose supported library filters and try again.");

function libraryQuery(req: Request) {
  const params = new URL(req.url).searchParams;
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) throw invalid();
  const parsed = pageQuery.safeParse(Object.fromEntries(params));
  if (!parsed.success) throw invalid();
  const { lang, ...rest } = parsed.data;
  const entries = Object.entries({ ...rest, lang: LANG[lang ?? "en"] ?? "en" }).filter(([, value]) => value !== undefined);
  return new URLSearchParams(entries.map(([key, value]) => [key, String(value)]));
}

export async function readLibraryPage(req: Request, studentId: string) {
  if (!academyPortalOrigin(LIBRARY_V2)) return { available: false as const };
  const data = await academyData(req, `/api/portal/library?${libraryQuery(req)}`, studentId, libraryPageSchema, undefined, LIBRARY_V2);
  return { available: true as const, ...data, lessons: data.lessons.map((lesson) => ({ ...lesson, thumbnailUrl: publishedImage(lesson.thumbnailUrl) })) };
}

export async function readLibraryLesson(req: Request, studentId: string, id: string) {
  if (!/^[1-9]\d{0,9}$/.test(id)) throw invalid();
  if (!academyPortalOrigin(LIBRARY_V2)) return { available: false as const };
  const lang = LANG[new URL(req.url).searchParams.get("lang") ?? "en"] ?? "en";
  const data = await academyData(req, `/api/portal/library/${id}?lang=${lang}`, studentId, libraryLessonResponseSchema, undefined, LIBRARY_V2);
  return { available: true as const, ...data, lesson: { ...data.lesson, thumbnailUrl: publishedImage(data.lesson.thumbnailUrl) } };
}
```

**4. Routes:** the same pattern as `app/api/student/learning/library/route.ts`.

```ts
// app/api/student/library/route.ts
import { NextResponse } from "next/server";
import { verifyCaller } from "@/lib/backend-security";
import { privateCatalogResponse } from "@/lib/student-published-catalog";
import { calendarErrorResponse, privateHeaders } from "@/lib/calendar-api-response";
import { readLibraryPage } from "@/lib/student-library-v2";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { errorResponse, context } = await verifyCaller(req, ["Student"]);
    if (errorResponse || !context) return privateCatalogResponse(errorResponse!);
    const data = await readLibraryPage(req, context.studentId!);
    return NextResponse.json({ success: true, data, error: null }, { headers: { ...privateHeaders, Vary: "Authorization, Cookie" } });
  } catch (error) {
    return privateCatalogResponse(calendarErrorResponse(error));
  }
}

// app/api/student/library/[id]/route.ts
import { NextResponse } from "next/server";
import { verifyCaller } from "@/lib/backend-security";
import { privateCatalogResponse } from "@/lib/student-published-catalog";
import { calendarErrorResponse, privateHeaders } from "@/lib/calendar-api-response";
import { readLibraryLesson } from "@/lib/student-library-v2";
export const dynamic = "force-dynamic";
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse, context: caller } = await verifyCaller(req, ["Student"]);
    if (errorResponse || !caller) return privateCatalogResponse(errorResponse!);
    const data = await readLibraryLesson(req, caller.studentId!, (await context.params).id);
    return NextResponse.json({ success: true, data, error: null }, { headers: { ...privateHeaders, Vary: "Authorization, Cookie" } });
  } catch (error) {
    return privateCatalogResponse(calendarErrorResponse(error));
  }
}
```

**5. Screens**
1. **Library home:** category tiles in `categories` order, using `icon`, `accentColor`, `title` and `koreanTitle`.
2. **Category page:** lesson cards with `title`, `koreanName`, `summary` and a `kind` badge (Article). Order by `position` (nulls last), then title.
3. **Lesson page:** media first when `media.kind !== 'unavailable'`, then `levelNote`, the sections in order, and sources last.
4. **Language:** the student's portal language; `translated` and `languages` let you show a "Translated" badge.
5. **Practice and progress:** unchanged. Keep recording against the lesson `id`.

**6. Tests.** Your contract tests can parse the sample responses below with your copy of the schemas, the way `tests/library-v2-handoff.test.mjs` does here.

## 6. Sample responses

These are in `docs/student-portal/library-v2-samples/`, built from the real imported content as if published:

| File | What it shows |
|---|---|
| `page-poomsae-en.json` | A list page: 9 categories and 10 poomsae cards. |
| `lesson-taegeuk-1-il-jang-en.json` / `-km.json` | A form with every common section type and the floor diagram, in English and in Khmer. |
| `lesson-front-kick-ap-chagi-en.json` / `-km.json` | A kick with training process, drills, corrections and recovery. |
| `lesson-history-timeline-en.json` / `-km.json` | An article with a 16-entry timeline. |

`targetBelt` shows `All` in the samples because these lessons have no belt yet. In real responses it is whatever belt staff chose.

## 7. Checklist

- [ ] Add `library-v2` to `AcademyContractVersion`.
- [ ] Add `lib/library-v2-contract.ts` (from the example file), `lib/student-library-v2.ts` and the two routes.
- [ ] Render the 12 section types, including the poomsae diagram; skip unknown types (the schema already does).
- [ ] Pass the portal locale as `lang`.
- [ ] Page with `nextCursor` until it is null; expect short or empty pages.
- [ ] Keep learning-v1 until the library-v2 screens ship, then switch the library page over.

## 8. Status on the shared database

- **Structure:** migration `20261110100715_library_content_structure` has been live since 2026-11-10. The two endpoints answer once the matching admin portal update is deployed.
- **Content (2026-11-12):**
  - 9 categories and 172 lessons and articles, every one in a category and with sections.
  - **81 lessons are published now.** They were republished with their full content, so both library-v2 and your current learning-v1 pages show their text, steps, mistakes and guidance; before this they showed titles only. 24 of them also carry the website's sections and Khmer and Chinese text.
  - The other 91 (website lessons and articles) are private drafts until staff choose a belt and publish each one, so the feed grows over time.
- **What students see:** by belt, a White belt sees 13 lessons today, Green 32, Blue 47, Red 79, and black belts all 81.
- **Data health:** `node scripts/check-library-v2-data.mjs` in the admin repo builds every lesson's library-v2 response in all three languages and checks it against this contract and your 1 MB limit. It also runs the feed's live queries for every belt, and checks live lessons against your own learning-v1 schema. The run after publishing on 2026-11-12 found 0 issues.

Questions go to the admin portal team. The admin side of the contract is `lib/library-v2-contract.ts`.
