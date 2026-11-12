/**
 * Prepares library lessons made before library-v2 (scripts/prepare-library-content.mjs):
 * files each into a library category, and turns its learning-v1 guidance into
 * editable sections with Korean and romanized names taken from its title.
 */
import { legacySections, libraryContentSchema, SLUG, type LibraryContent, type LibrarySection } from './library-content';

type Row = Record<string, any>;
const ADVANCED_KICK = /\b(jump(ing)?|spin(ning)?|360|540|720|900|pop|swing|skip|tornado|cheat|twio|ttwie|eedan|dwi)\b/i;
/** Legacy display categories (description.actualCategory) → website category slugs. */
const LEGACY_TO_SLUG: Record<string, string> = {
  'Forms (Poomsae)': 'poomsae', 'Blocks (Makki)': 'hand-techniques', 'Strikes (Jirugi/Chigi)': 'hand-techniques', 'Stances & Footwork (Seogi)': 'stances',
  'Self-Defense (Hosinsul)': 'hosinsul', 'Tricking & Acrobatics': 'tricking-acrobatics', 'Breaking (Kyokpa)': 'tricking-acrobatics', 'Theory & Terminology': 'history', 'Sparring (Kyorugi)': 'competition-rules',
};
const ENUM_TO_SLUG: Record<string, string> = { Poomsae: 'poomsae', Hosinsul: 'hosinsul', Kyokpa: 'tricking-acrobatics', Theory: 'history', Kyorugi: 'competition-rules' };

export function parseDescription(description: unknown): Row {
  if (typeof description !== 'string' || !description.trim().startsWith('{')) return { text: typeof description === 'string' ? description : '' };
  try { const value = JSON.parse(description); return value && typeof value === 'object' && !Array.isArray(value) ? value : { text: '' }; } catch { return { text: '' }; }
}

/** The library category a legacy lesson belongs in, or null when its category is not a Taekwondo one. */
export function legacyCategorySlug(asset: Row): string | null {
  if (asset.library_type === 'Fitness') return null;
  const actual = String(parseDescription(asset.description).actualCategory ?? '');
  if (actual === 'Kicks (Chagi)' || asset.tkd_category === 'Chagi') return ADVANCED_KICK.test(String(asset.title)) ? 'kicking-advanced' : 'kicking-fundamentals';
  return LEGACY_TO_SLUG[actual] ?? ENUM_TO_SLUG[String(asset.tkd_category)] ?? null;
}

/** "Hook Kick (Huryeo Chagi / 후려차기)" → Korean "후려차기", romanized "Huryeo Chagi", English "Hook Kick". */
export function parseTitleNames(title: string): { english: string; romanized: string | null; koreanName: string | null } {
  const match = title.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match) return { english: title.trim(), romanized: null, koreanName: null };
  const parts = match[2].split('/').map(part => part.trim()).filter(Boolean);
  const korean = parts.filter(part => /[가-힣]/.test(part));
  const latin = parts.filter(part => !/[가-힣一-鿿]/.test(part));
  return { english: match[1].trim(), romanized: latin.length ? latin.join(' / ').slice(0, 200) : null, koreanName: korean.length ? korean.join(' / ').slice(0, 200) : null };
}

/** A web name from the English title, unique among `used` (adds -2, -3, … when taken). */
export function suggestSlug(title: string, used: Set<string>): string | null {
  const base = parseTitleNames(title).english.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110);
  if (!base || !SLUG.test(base)) return null;
  for (let n = 1; n < 1000; n++) { const slug = n === 1 ? base : `${base}-${n}`; if (!used.has(slug)) return slug; }
  return null;
}

/** Sections for a legacy lesson: an "At a glance" fact list, then its learning-v1 guidance. */
export function legacyLessonContent(asset: Row): LibraryContent {
  const guidance = parseDescription(asset.description);
  const glance = [['Difficulty', guidance.difficulty], ['Reps and sets', guidance.repsSets], ['Focus', Array.isArray(guidance.focusZones) ? guidance.focusZones.join(', ') : '']]
    .map(([label, value]) => ({ label: String(label), value: typeof value === 'string' ? value.trim().slice(0, 2000) : '' })).filter(row => row.value);
  const sections: LibrarySection[] = [
    ...(glance.length ? [{ id: 'glance', type: 'facts' as const, title: 'At a glance', items: glance }] : []),
    ...legacySections(guidance, typeof guidance.text === 'string' ? guidance.text : ''),
  ];
  return libraryContentSchema.parse({ sections, translations: {}, sources: [] });
}

/**
 * What the preparation changes for one lesson: its category when it has none, and
 * sections plus names when it has no content yet. Existing values are never replaced.
 */
export function preparationFor(asset: Row, hasContent: boolean, categoryIdBySlug: Map<string, string>, usedSlugs: Set<string>) {
  const slug = asset.category_id ? null : legacyCategorySlug(asset);
  const categoryId = asset.category_id ?? (slug ? categoryIdBySlug.get(slug) ?? null : null);
  // Names, summary and web name are only derived for lessons getting sections now;
  // imported lessons and articles already carry the website's own details.
  const derive = !hasContent;
  const names = derive ? parseTitleNames(String(asset.title)) : { english: String(asset.title), romanized: null, koreanName: null };
  const webName = asset.slug ?? (derive ? suggestSlug(String(asset.title), usedSlugs) : null);
  if (webName) usedSlugs.add(webName);
  const guidance = parseDescription(asset.description);
  const text = typeof guidance.text === 'string' ? guidance.text.trim() : '';
  const summary = asset.summary ?? (derive && text && text !== String(asset.title).trim() ? text.slice(0, 4000) : null);
  const metadata = {
    categoryId, kind: asset.content_kind === 'article' ? 'article' as const : 'lesson' as const, slug: webName,
    koreanName: asset.korean_name ?? names.koreanName, romanized: asset.romanized ?? names.romanized, summary, levelNote: asset.level_note ?? null, tags: Array.isArray(asset.tags) ? asset.tags : [],
  };
  const changes = {
    category: !asset.category_id && !!categoryId ? slug : null,
    content: !hasContent,
    names: (!asset.korean_name && !!names.koreanName) || (!asset.romanized && !!names.romanized) || (!asset.summary && !!summary) || (!asset.slug && !!webName),
  };
  return { metadata, content: hasContent ? null : legacyLessonContent(asset), changes };
}
