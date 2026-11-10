/**
 * Converts the public website's library data (Infinity TKD Web/data/library) into
 * library-v2 lessons and reference articles for scripts/import-website-library.mjs.
 *
 * `web` is the merged export object of the website data files. English is the base
 * text; Khmer and Chinese are stored as sparse per-section translations (only text
 * that differs from English). Belts are never linked here: staff choose them.
 */
import { libraryContentSchema, pruneTranslation, type LibraryContent, type LibrarySection } from './library-content';
import { libraryPublicationProjection } from './library-publication';

type Lang = 'en' | 'km' | 'zh';
type Any = Record<string, any>;
const LANGS: Lang[] = ['en', 'km', 'zh'];

export interface ImportCategory { slug: string; title: string; koreanTitle: string | null; subtitle: string | null; description: string | null; icon: string; accentColor: string; libraryType: 'Taekwondo'; sortOrder: number; translations: Record<string, Any> }
export interface ImportItem {
  sourceKey: string; title: string; slug: string; kind: 'lesson' | 'article'; categorySlug: string; tkdCategory: string;
  koreanName: string | null; romanized: string | null; summary: string | null; levelNote: string | null; tags: string[];
  description: string; projectionText: string; guidance: Any; videoUrl: string; mergeTitle?: string; fixedTitle?: string;
  content: LibraryContent;
}

// --- Category mapping -------------------------------------------------------
const CATEGORY_ICON: Record<string, string> = { poomsae: 'BookOpen', 'kicking-fundamentals': 'Lightning', 'kicking-advanced': 'Fire', 'hand-techniques': 'Hand', stances: 'Footprints', hosinsul: 'Shield', 'tricking-acrobatics': 'Sparkle', history: 'Scroll', 'competition-rules': 'Medal' };
/** Legacy admin display category and database enum, so imported lessons also work in learning-v1. */
const LEGACY_CATEGORY: Record<string, [string, string]> = {
  poomsae: ['Forms (Poomsae)', 'Poomsae'], 'kicking-fundamentals': ['Kicks (Chagi)', 'Chagi'], 'kicking-advanced': ['Kicks (Chagi)', 'Chagi'],
  'hand-techniques': ['Blocks (Makki)', 'Poomsae'], stances: ['Stances & Footwork (Seogi)', 'Poomsae'], hosinsul: ['Self-Defense (Hosinsul)', 'Hosinsul'],
  'tricking-acrobatics': ['Tricking & Acrobatics', 'Kyokpa'], history: ['Theory & Terminology', 'Theory'], 'competition-rules': ['Theory & Terminology', 'Theory'],
};

/**
 * Website lessons that already exist in the admin library (matched by exact title).
 * They keep their id and belt; three titles with corrupted Korean are corrected.
 */
export const WEBSITE_MERGES: Record<string, { title: string; fixedTitle?: string }> = {
  'front-kick-ap-chagi': { title: 'Front Kick (Ap Chagi / 앞차기)' },
  'roundhouse-kick-dollyo-chagi': { title: 'Roundhouse Kick (Dollyeo Chagi / 돌려차기)' },
  'push-kick-mil-chagi': { title: 'Push Kick (Mil Chagi / 밀차기)' },
  'axe-kick-naeryo-chagi': { title: 'Axe Kick (Naeryeo Chagi / 내려차기)' },
  'crescent-kick-bandal-chagi': { title: 'Crescent Kick (Bandal Chagi / An-Chagi / Bakat-Chagi)' },
  'hook-kick-huryeo-chagi': { title: 'Hook Kick (Huryeo Chagi / 후려 can기)', fixedTitle: 'Hook Kick (Huryeo Chagi / 후려차기)' },
  'side-kick-yop-chagi': { title: 'Side Kick (Yeop Chagi / 옆차기)' },
  'back-kick-dwit-chagi': { title: 'Back Kick (Dwit Chagi / 뒷차기)' },
  'twist-kick-bituro-chagi': { title: 'Twist Kick (Bituro Chagi / 비틀어차기)' },
  'downward-roundhouse-kick-naeryo-dollyo-chagi': { title: 'Downward Roundhouse Kick / Brazilian Kick (Naeryeo Dollyeo Chagi / 내려 돌려차기)' },
  'jumping-front-kick': { title: 'Jumping Front Kick (Twio Ap Chagi / 뛰어 앞차기)' },
  'jumping-roundhouse-kick': { title: 'Jumping Roundhouse Kick (Eedan Dollyeo Chagi / 이단 돌려차기)' },
  'jumping-side-kick': { title: 'Jumping Side Kick (Twio Yeop Chagi / 뛰어 옆차기)' },
  'jumping-spin-hook': { title: 'Jumping Spinning Hook Kick (Ttwie Dwi Huryeo Chagi / 뛰어 뒤후려차기)' },
  'jumping-double-front-kick': { title: 'Jumping Double Front Kick (Eedan Ap Chagi / 이단 앞차기)' },
  'jumping-triple-front-kicks': { title: 'Jumping Triple Front Kick (Eedan Sahm Ap Chagi / 뛰어 삼단 앞차기)' },
  'jumping-double-round-kicks': { title: 'Jumping Double Roundhouse Kick (Narae Chagi / 나래 can기)', fixedTitle: 'Jumping Double Roundhouse Kick (Narae Chagi / 나래차기)' },
  'jumping-back-kick': { title: 'Jumping Back Kick (Ttwie Dwi Chagi / 뛰어 뒤차기)' },
  'jumping-split-kick': { title: 'Jumping Split Kick (Dwit Charae Chagi / 뛰어 가위차기 / 劈腿踢)' },
  'scissor-kick': { title: 'Scissor Kick (Gawi Chagi / 가위차기)' },
  'dwit-koobi': { title: 'Back Stance (Dwi Kubi/ 뒤굽យី)', fixedTitle: 'Back Stance (Dwit Kubi / 뒷굽이)' },
  'beom-seogi': { title: 'Tiger Stance (Beom Seogi / 범서기)' },
  'ap-koobi': { title: 'Front Long Stance (Ap Kubi / 앞굽이)' },
  'arae-makki': { title: 'Low Block (Arae Makgi / 아래막기)' },
};

// --- Small helpers ------------------------------------------------------------
const s = (value: unknown) => typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
const clip = (value: unknown, max: number) => s(value).slice(0, max);
const strings = (value: unknown, max = 2000) => Array.isArray(value) ? value.map(item => clip(item, max)).filter(Boolean) : [];
const nonEmpty = <T>(value: T | null | undefined | false): value is T => !!value;
const stripNumber = (value: string) => value.replace(/^\s*\d+\.\s*/, '');
const join = (...parts: unknown[]) => parts.map(s).filter(Boolean).join(' · ');
type Card = { title: string; subtitle?: string; body?: string; bullets?: unknown[]; facts?: [string, unknown][] };

const text = (id: string, title: unknown, paragraphs: unknown[]): LibrarySection | null => { const p = paragraphs.map(item => clip(item, 20000)).filter(Boolean); return p.length ? { id, type: 'text', title: clip(title, 200), paragraphs: p.slice(0, 60) } : null; };
const list = (id: string, title: unknown, items: unknown, style: 'bullet' | 'number' | 'check' = 'bullet'): LibrarySection | null => { const i = strings(items); return i.length ? { id, type: 'list', title: clip(title, 200), style, items: i.slice(0, 200) } : null; };
const steps = (id: string, title: unknown, items: { title?: unknown; body?: unknown; details?: unknown }[]): LibrarySection | null => {
  const rows = items.map(row => ({ title: clip(row.title, 300), body: clip(row.body, 20000), details: strings(row.details).slice(0, 50) })).filter(row => row.title || row.body);
  return rows.length ? { id, type: 'steps', title: clip(title, 200), items: rows.slice(0, 200) } : null;
};
const pairs = (id: string, title: unknown, items: [unknown, unknown][], leftLabel: unknown = '', rightLabel: unknown = ''): LibrarySection | null => {
  const rows = items.map(([term, detail]) => ({ term: clip(term, 2000), detail: clip(detail, 20000) })).filter(row => row.term || row.detail);
  return rows.length ? { id, type: 'pairs', title: clip(title, 200), leftLabel: clip(leftLabel, 80), rightLabel: clip(rightLabel, 80), items: rows.slice(0, 200) } : null;
};
const facts = (id: string, title: unknown, items: [unknown, unknown][]): LibrarySection | null => {
  const rows = items.map(([label, value]) => ({ label: clip(label, 120), value: clip(value, 2000) })).filter(row => row.label && row.value);
  return rows.length ? { id, type: 'facts', title: clip(title, 200), items: rows.slice(0, 60) } : null;
};
const table = (id: string, title: unknown, columns: unknown[], rows: unknown[][], caption: unknown = ''): LibrarySection | null => {
  const cols = columns.map(column => clip(column, 120) || '—').slice(0, 12);
  const body = rows.map(row => cols.map((_, index) => clip(row[index], 2000))).filter(row => row.some(Boolean));
  return body.length ? { id, type: 'table', title: clip(title, 200), columns: cols, rows: body.slice(0, 300), caption: clip(caption, 500) } : null;
};
const cards = (id: string, title: unknown, items: Card[]): LibrarySection | null => {
  const rows = items.map(card => ({ title: clip(card.title, 300), subtitle: clip(card.subtitle, 300), body: clip(card.body, 20000), bullets: strings(card.bullets ?? []).slice(0, 40),
    facts: (card.facts ?? []).map(([label, value]) => ({ label: clip(label, 120), value: clip(value, 2000) })).filter(row => row.label && row.value).slice(0, 20) })).filter(card => card.title);
  return rows.length ? { id, type: 'cards', title: clip(title, 200), items: rows.slice(0, 200) } : null;
};
const callout = (id: string, title: unknown, body: unknown, tone: 'info' | 'tip' | 'warning' = 'info'): LibrarySection | null => s(body) ? { id, type: 'callout', title: clip(title, 200), tone, body: clip(body, 20000) } : null;
const arr = (value: unknown): Any[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
/** A card from an unknown object: first title-like field, Korean subtitle, longest prose as body, the rest as facts. */
function objectCard(o: Any): Card {
  const title = s(o.title ?? o.name ?? o.pairName ?? o.dimension ?? o.range ?? o.factor ?? o.command ?? o.domain ?? o.label);
  const subtitle = join(o.koreanTitle ?? o.koreanName ?? o.korean ?? o.koreanRange, o.hanja);
  const bodyKey = ['desc', 'description', 'explanation', 'summary', 'definition', 'concept', 'rule', 'strategy', 'meaning'].find(key => s(o[key]));
  const skip = new Set(['id', 'title', 'name', 'pairName', 'dimension', 'range', 'factor', 'command', 'domain', 'label', 'koreanTitle', 'koreanName', 'korean', 'koreanRange', 'hanja', 'color', 'badgeColor', 'iconType', 'textColor', 'borderColor', 'beltColor', 'tagColor', bodyKey ?? '']);
  const facts: [string, unknown][] = Object.entries(o).filter(([key, value]) => !skip.has(key) && (typeof value === 'string' || typeof value === 'number')).map(([key, value]) => [labelFromKey(key), value]);
  const bullets = Object.entries(o).filter(([key, value]) => !skip.has(key) && Array.isArray(value) && value.every(item => typeof item === 'string')).flatMap(([, value]) => value as string[]);
  return { title, subtitle, body: bodyKey ? s(o[bodyKey]) : '', facts, bullets };
}
const labelFromKey = (key: string) => key.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

// --- Section titles and labels, translated from the website's own dictionaries ----
const EN_LABELS: Record<string, string> = {
  glance: 'At a glance', meaning: 'Meaning', philosophy: 'Philosophy', trigram: 'Trigram and philosophy', directive: 'Philosophical directive', introduced: 'Key techniques introduced',
  floorPlan: 'Floor plan lines', principles8: 'Execution principles', major: 'Major deductions (−0.3)', minor: 'Minor deductions (−0.1)', dan: 'Dan mastery', danDoctrine: 'Master doctrine',
  junbi: 'Ready stance', movement: 'Movement characteristics', lineage: 'Historical lineage', newPoomsae: 'New poomsae specification', officialMeaning: 'Official meaning', rationale: 'Why this form exists',
  signatureKicks: 'Signature kicks', signatureHands: 'Signature hand techniques', terminology: 'Korean terminology', steps: 'Movement sequence', training: 'Step-by-step training process',
  keyDetails: 'Key details', mistakes: 'Common mistakes', corrections: 'Common mistakes and corrections', mistake: 'Mistake', correction: 'Correction', tips: 'Coaching tips', corePrinciples: 'Core principles',
  prerequisites: 'Skill prerequisites', physical: 'Physical', technical: 'Technical', mental: 'Mental', drills: 'Drilling methods', isolation: 'Isolation and chamber drills', speed: 'Speed and timing drills',
  power: 'Power and heavy bag drills', freestyle: 'Freestyle and tricking adaptations', safety: 'Spotting and safety', application: 'Performance and application', competition: 'Competition',
  poomsae: 'Poomsae', tricking: 'Freestyle and tricking', demonstration: 'Demonstration', combos: 'Signature combinations', recovery: 'Recovery and conditioning', flexibility: 'Flexibility',
  strength: 'Strengthening', mobility: 'Mobility', balance: 'Balance and posture', article: 'Article', diagram: 'Floor diagram', sources: 'Sources',
  level: 'Belt level', difficulty: 'Difficulty', movements: 'Movements', duration: 'Performance time', pattern: 'Floor pattern', trigramFact: 'Trigram', hanja: 'Hanja', element: 'Element',
  division: 'Age division', surface: 'Striking surface', target: 'Target area', weight: 'Weight distribution', trajectory: 'Trajectory', airborne: 'Airborne phase', targets: 'Targets',
  author: 'Author', published: 'Published', readTime: 'Read time', clock: 'Direction sequence', kihap: 'Kihap on step', targetDuration: 'Target duration', prerequisiteText: 'Before you start',
};
/** Website dictionary keys for each label, in preference order. */
const LABEL_SOURCES: Record<string, [string, string][]> = {
  terminology: [['poomsae', 'terminologyTitle'], ['hosinsul', 'koreanTerminology']], tips: [['poomsae', 'coachingTipsTitle'], ['hosinsul', 'coachingTips']],
  steps: [['poomsae', 'movementSequenceTitle'], ['hosinsul', 'stepSequence']], major: [['poomsae', 'majorDeductionsTitle']], minor: [['poomsae', 'minorDeductionsTitle']],
  directive: [['poomsae', 'philosophicalDirectiveTitle']], introduced: [['poomsae', 'introducedKeyTechTitle']], floorPlan: [['poomsae', 'wangFloorDynamicsTitle']],
  principles8: [['poomsae', 'eightPillarsCuesTitle']], dan: [['poomsae', 'danMasteryOfficialTitle']], danDoctrine: [['poomsae', 'danMasteryDoctrineTitle']], junbi: [['poomsae', 'junbiSeogiTitle']],
  movement: [['poomsae', 'dynamicMovementCharsTitle']], lineage: [['poomsae', 'classicalLineageTitle']], signatureKicks: [['poomsae', 'signatureKicksTitle']], signatureHands: [['poomsae', 'signatureHandsTitle']],
  officialMeaning: [['poomsae', 'officialKukkiwonMeaningTitle']], rationale: [['poomsae', 'targetAgeRationaleTitle']], meaning: [['poomsae', 'philosophicalMeaningTitle']],
  trigramFact: [['poomsae', 'trigramLabel']], hanja: [['poomsae', 'hanjaElementLabel']], movements: [['poomsae', 'movementCountLabel']], division: [['poomsae', 'targetDivisionLabel']],
  keyDetails: [['hosinsul', 'keyDetails']], mistakes: [['hosinsul', 'commonMistakes']], surface: [['kicking', 'strikingSurface']], target: [['kicking', 'targetArea']],
  difficulty: [['kicking', 'difficulty']], level: [['kicking', 'beltLevel']], balance: [['kicking', 'balanceAndPosture']], corePrinciples: [['kicking', 'corePrinciples']],
  prerequisites: [['kicking', 'prerequisites']], physical: [['kicking', 'prereqPhysical']], technical: [['kicking', 'prereqTechnical']], mental: [['kicking', 'prereqMental']],
  training: [['kicking', 'stepSequence']], drills: [['kicking', 'drillingMethods']], isolation: [['kicking', 'isolationDrills']], speed: [['kicking', 'speedDrills']], power: [['kicking', 'powerDrills']],
  freestyle: [['kicking', 'freestyleTricking']], safety: [['kicking', 'spottingSafety']], corrections: [['kicking', 'commonMistakes']], mistake: [['kicking', 'mistakeLabel']], correction: [['kicking', 'correctionLabel']],
  application: [['kicking', 'performanceTitle']], competition: [['kicking', 'kyorugiApplication']], tricking: [['kicking', 'trickingApplication']], combos: [['kicking', 'kickCombos']],
  recovery: [['kicking', 'recoveryTitle']], flexibility: [['kicking', 'flexibilityMaint']], strength: [['kicking', 'strengthExercises']], mobility: [['kicking', 'mobilityRoll']],
  airborne: [['advanced', 'airbornePhase']], targets: [['advanced', 'targetCount']],
};
// Headings the website has no dictionary entry for (short, standard terms).
const OWN_LABELS: Record<Lang, Record<string, string>> = {
  en: { stepsPlain: 'Steps', keyPoints: 'Key points', misconceptions: 'Common misconceptions' },
  km: { stepsPlain: 'ជំហាន', keyPoints: 'ចំណុចសំខាន់', misconceptions: 'ការយល់ច្រឡំទូទៅ' },
  zh: { stepsPlain: '步骤', keyPoints: '要点', misconceptions: '常见误解' },
};
function labelsFor(web: Any, lang: Lang, category: string): Record<string, string> {
  const dicts: Record<string, Any | undefined> = { poomsae: web.poomsaeI18n?.[lang], hosinsul: web.hosinsulI18n?.[lang], kicking: web.kickingI18n?.[lang], advanced: web.kickingAdvancedI18n?.[lang] };
  const out = { ...EN_LABELS };
  if (lang !== 'en') for (const [key, sources] of Object.entries(LABEL_SOURCES)) for (const [dict, field] of sources) { const value = s(dicts[dict]?.[field]); if (value) { out[key] = value; break; } }
  const own = OWN_LABELS[lang];
  // Each discipline names its sections the way its website page does.
  if (category === 'hosinsul') for (const [key, field] of [['steps', 'stepSequence'], ['keyDetails', 'keyDetails'], ['mistakes', 'commonMistakes'], ['tips', 'coachingTips'], ['terminology', 'koreanTerminology']] as const) {
    out[key] = s(dicts.hosinsul?.[field]) || s(web.hosinsulI18n?.en?.[field]) || out[key];
  } else if (category === 'history' || category === 'competition-rules') { out.steps = own.keyPoints; out.mistakes = own.misconceptions; }
  else if (category !== 'poomsae') out.steps = own.stepsPlain;
  return out;
}

// --- Lessons --------------------------------------------------------------------
function lessonSections(item: Any, L: Record<string, string>, walkthrough: Any | undefined): LibrarySection[] {
  const tp = item.taegeukPhilosophy as Any | undefined, dm = item.danMastery as Any | undefined, np = item.newPoomsaeSpec as Any | undefined;
  const out: (LibrarySection | null)[] = [
    facts('glance', L.glance, [[L.level, item.beltLevel], [L.difficulty, item.difficulty], [L.movements, item.totalMovements], [L.duration, item.performanceDuration], [L.pattern, item.poomsaeLineShape ?? item.diagramSymbol],
      [L.trigramFact, item.trigramSymbol], [L.hanja, item.trigramHanja], [L.element, item.yinyangElement], [L.division, item.targetAgeDivision], [L.surface, item.strikingSurface], [L.target, item.targetArea],
      [L.weight, item.weightDistribution], [L.trajectory, item.kickTrajectory], [L.airborne, item.airbornePhase], [L.targets, item.targetCount], [L.author, item.author], [L.published, item.publishDate], [L.readTime, item.readTime]]),
    text('meaning', L.meaning, [item.meaning]),
    text('philosophy', L.philosophy, [item.philosophy]),
    text('prerequisite-note', L.prerequisiteText, [item.prerequisites]),
    text('article', L.article, item.blogContent ?? []),
    text('balance', L.balance, [item.balanceAndPosture]),
    tp && facts('trigram', L.trigram, [[L.trigramFact, join(tp.trigramSymbol, tp.trigramName, tp.koreanTrigramName)], [L.element, tp.naturalElement], ['Core concept', tp.coreConcept], [L.level, tp.practitionerRank],
      ['Dialectic', tp.dialecticRole], [L.clock, tp.clockTrajectory], [L.kihap, (tp.kihapSteps ?? []).join(', ')], [L.targetDuration, tp.wtCompetitionScoring?.targetDuration]]),
    tp && text('directive', L.directive, [tp.philosophicalDirective]),
    tp && list('introduced', L.introduced, tp.introducedKeyTechniques),
    tp?.wangFloorPlanLines && cards('floor-plan', L.floorPlan, ['line1Top', 'line2Middle', 'line3Bottom'].map(key => tp.wangFloorPlanLines[key]).filter(Boolean)
      .map((line: Any) => ({ title: s(line.name), subtitle: s(line.meaning), body: s(line.explanation), facts: [['Steps', line.stepsRange], ['Line', line.isYang ? 'Yang (solid)' : 'Um (broken)']] as [string, unknown][] }))),
    tp && list('principles', L.principles8, tp.executionPrinciples),
    tp && list('major-deductions', L.major, tp.wtCompetitionScoring?.majorDeductions),
    tp && list('minor-deductions', L.minor, tp.wtCompetitionScoring?.minorDeductions),
    dm && facts('dan', L.dan, [['Rank', join(dm.danRank, dm.koreanDanRank)], ['Belt stripes', join(dm.beltStripes, dm.beltStripeRoman)], ['Form', join(dm.formName, dm.koreanFormName)], [L.meaning, dm.meaningOfName],
      ['Note', dm.nameFootnote], [L.pattern, dm.floorPatternName], ['Symbol', join(dm.symbol, dm.meaningOfSymbol)], ['Master characteristic', dm.masterCharacteristic]]),
    dm && text('dan-doctrine', L.danDoctrine, [dm.philosophicalMandate]),
    dm && text('junbi', L.junbi, [dm.junbiSeogi]),
    dm && list('dan-techniques', L.introduced, dm.introducedKeyTechniques),
    dm && text('lineage', L.lineage, [dm.historicalEtymology]),
    dm && text('movement', L.movement, [dm.movementCharacteristics]),
    np && facts('new-poomsae', L.newPoomsae, [['Form', join(np.formNumber, np.koreanName)], ['Concept', np.englishConcept], [L.division, np.targetAge], [L.duration, np.officialDuration], [L.pattern, np.lineSymbolMeaning]]),
    np && text('official-meaning', L.officialMeaning, [np.officialMeaning, np.etymologyOrigin]),
    np && text('rationale', L.rationale, [np.developmentRationale, np.technicalCharacteristics?.specialtyFocus]),
    np && list('signature-kicks', L.signatureKicks, np.technicalCharacteristics?.signatureKicks),
    np && list('signature-hands', L.signatureHands, np.technicalCharacteristics?.signatureHands),
    pairs('core-principles', L.corePrinciples, arr(item.corePrinciples).map(row => [row.title, row.desc])),
    item.skillPrerequisites && cards('prerequisites', L.prerequisites, [[L.physical, item.skillPrerequisites.physical], [L.technical, item.skillPrerequisites.technical], [L.mental, item.skillPrerequisites.mental]]
      .filter(([, bullets]) => Array.isArray(bullets) && bullets.length).map(([title, bullets]) => ({ title: title as string, bullets: bullets as unknown[] }))),
    steps('steps', L.steps, strings(item.steps).map(body => ({ body }))),
    steps('training', L.training, arr(item.trainingProcess).map(row => ({ title: row.title, details: row.details }))),
    list('key-details', L.keyDetails, item.keyDetails),
    item.commonMistakesAndCorrections?.length
      ? pairs('mistakes', L.corrections, arr(item.commonMistakesAndCorrections).map(row => [row.mistake, row.correction]), L.mistake, L.correction)
      : list('mistakes', L.mistakes, item.commonMistakes),
    item.commonMistakesAndCorrections?.length ? list('mistakes-quick', L.mistakes, item.commonMistakes) : null,
    list('tips', L.tips, item.coachingTips),
    item.drillingMethods && cards('drills', L.drills, [[L.isolation, item.drillingMethods.isolation], [L.speed, item.drillingMethods.speedAndTiming], [L.power, item.drillingMethods.power],
      [L.freestyle, item.drillingMethods.freestyleTricking], [L.safety, item.drillingMethods.safety]].filter(([, bullets]) => Array.isArray(bullets) && bullets.length).map(([title, bullets]) => ({ title: title as string, bullets: bullets as unknown[] }))),
    item.performanceAndApplication && pairs('application', L.application, [[L.competition, item.performanceAndApplication.competition], [L.poomsae, item.performanceAndApplication.poomsae],
      [L.tricking, item.performanceAndApplication.freestyleTricking], [L.demonstration, item.performanceAndApplication.demonstration]]),
    item.performanceAndApplication && list('combos', L.combos, item.performanceAndApplication.combinations),
    item.recoveryAndConditioning && cards('recovery', L.recovery, [[L.flexibility, item.recoveryAndConditioning.flexibility], [L.strength, item.recoveryAndConditioning.strengthening], [L.mobility, item.recoveryAndConditioning.mobility]]
      .filter(([, bullets]) => Array.isArray(bullets) && bullets.length).map(([title, bullets]) => ({ title: title as string, bullets: bullets as unknown[] }))),
    item.terminology?.length ? { id: 'terminology', type: 'glossary', title: clip(L.terminology, 200), items: arr(item.terminology).map(row => ({ korean: clip(row.korean, 200), romanized: clip(row.romanized, 200), english: clip(row.english, 2000), category: clip(row.category, 80) })).slice(0, 200) } : null,
    walkthrough && Array.isArray(walkthrough.steps) && walkthrough.steps.length === strings(item.steps).length
      ? { id: 'diagram', type: 'diagram', title: clip(L.diagram, 200), kind: 'poomsae-walkthrough', data: { start: walkthrough.start, startFacing: walkthrough.startFacing, startStance: walkthrough.startStance, guides: walkthrough.guides ?? [], verified: walkthrough.verified === true, steps: walkthrough.steps } }
      : null,
  ];
  return out.filter(nonEmpty) as LibrarySection[];
}

function localizeLesson(web: Any, item: Any, lang: Lang): Any {
  if (lang === 'en') return item;
  if (item.category === 'poomsae' && web.decoratePoomsaeItem) return web.decoratePoomsaeItem(item, lang);
  if (item.category === 'kicking-fundamentals' && web.getLocalizedKickingItem) return web.getLocalizedKickingItem(item, lang);
  if (item.category === 'kicking-advanced' && web.getLocalizedAdvancedKickingItem) return web.getLocalizedAdvancedKickingItem(item, lang);
  return { ...item, ...(item.translations?.[lang] ?? {}) };
}

/** Only the text that differs from English, laid out like the English section. */
function textDiff(en: unknown, tr: unknown): unknown {
  if (typeof en === 'string') return typeof tr === 'string' && tr.trim() && tr.trim() !== en.trim() ? tr : '';
  if (Array.isArray(en)) return en.map((item, index) => textDiff(item, Array.isArray(tr) ? tr[index] : undefined));
  if (en && typeof en === 'object') return Object.fromEntries(Object.entries(en as Any).filter(([key]) => !['id', 'type', 'style', 'tone', 'url', 'kind', 'data'].includes(key)).map(([key, value]) => [key, textDiff(value, tr && typeof tr === 'object' ? (tr as Any)[key] : undefined)]));
  return '';
}
interface Draft { title: string; summary: string | null; koreanName: string | null; levelNote: string | null; sections: LibrarySection[] }
function translations(base: Draft, localized: Partial<Record<Lang, Draft>>): LibraryContent['translations'] {
  const out: Any = {};
  for (const lang of ['km', 'zh'] as const) {
    const doc = localized[lang];
    if (!doc) continue;
    const t: Any = {};
    if (doc.title && doc.title !== base.title) t.title = clip(doc.title, 150);
    if (doc.summary && doc.summary !== base.summary) t.summary = clip(doc.summary, 4000);
    if (doc.levelNote && doc.levelNote !== base.levelNote) t.levelNote = clip(doc.levelNote, 120);
    const sections: Any = {};
    for (const section of base.sections) {
      const match = doc.sections.find(row => row.id === section.id && row.type === section.type);
      const diff = match ? pruneTranslation(textDiff(section, match)) : undefined;
      if (diff) sections[section.id] = diff;
    }
    if (Object.keys(sections).length) t.sections = sections;
    if (Object.keys(t).length) out[lang] = t;
  }
  return out;
}

const DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced', 'Elite']);
/** learning-v1 guidance (legacy description JSON) so the lesson also reads well in the current portal. */
function legacyGuidance(item: Any): Any {
  const line = (value: unknown) => clip(value, 2000);
  const prerequisites = item.skillPrerequisites ? [...strings(item.skillPrerequisites.physical), ...strings(item.skillPrerequisites.technical), ...strings(item.skillPrerequisites.mental)] : strings([item.prerequisites]);
  const principles = arr(item.corePrinciples).length ? arr(item.corePrinciples).map(row => line(`${s(row.title)}: ${s(row.desc)}`)) : strings(item.keyDetails);
  const drilling = item.drillingMethods ? Object.values(item.drillingMethods as Any).flatMap(value => strings(value)) : [];
  const performance = item.performanceAndApplication ? [item.performanceAndApplication.competition, item.performanceAndApplication.poomsae, item.performanceAndApplication.freestyleTricking, item.performanceAndApplication.demonstration, ...(item.performanceAndApplication.combinations ?? [])].map(line).filter(Boolean) : [];
  const mistakes = arr(item.commonMistakesAndCorrections).length ? arr(item.commonMistakesAndCorrections).map(row => ({ mistake: line(row.mistake), correction: line(row.correction) })) : strings(item.commonMistakes).map(mistake => ({ mistake, correction: '' }));
  const out: Any = {
    ...(DIFFICULTIES.has(item.difficulty) ? { difficulty: item.difficulty } : {}),
    instructions: strings(item.steps).slice(0, 100), prerequisites: prerequisites.slice(0, 100), principles: principles.filter(Boolean).slice(0, 100),
    drillingMethods: drilling.slice(0, 100), performance: performance.slice(0, 100), mistakes: mistakes.filter(row => row.mistake).slice(0, 100),
    terminology: arr(item.terminology).map(row => ({ korean: line(row.korean), english: line(join(row.romanized, row.english)), khmer: '' })).slice(0, 100),
  };
  return Object.fromEntries(Object.entries(out).filter(([, value]) => !(Array.isArray(value) && value.length === 0)));
}

function sourcesOf(item: Any) {
  const url = s(item.sourceUrl).replace(/^http:\/\//, 'https://');
  return url && /^https:\/\//.test(url) ? [{ label: clip(item.sourceName || new URL(url).host, 200), url }] : [];
}
function finish(content: Any): LibraryContent {
  const parsed = libraryContentSchema.safeParse(content);
  if (!parsed.success) throw new Error('Invalid converted content: ' + parsed.error.issues.slice(0, 3).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  return parsed.data;
}
function legacyDescription(text: string, category: string, guidance: Any) {
  const description = JSON.stringify({ text: clip(text, 20000), actualCategory: LEGACY_CATEGORY[category]?.[0] ?? 'Theory & Terminology', ...guidance });
  // Same check the admin portal runs before saving and publishing.
  libraryPublicationProjection({ description, video_url: '', library_type: 'Taekwondo', target_level: 'Unassigned', tkd_category: LEGACY_CATEGORY[category]?.[1] ?? 'Theory' });
  return description;
}

export function websiteLessons(web: Any): ImportItem[] {
  return (web.libraryItems as Any[]).map(item => {
    const drafts = Object.fromEntries(LANGS.map(lang => {
      const local = localizeLesson(web, item, lang);
      return [lang, { title: clip(local.name || item.name, 150), summary: clip(local.summary, 4000) || null, koreanName: clip(item.koreanName, 200) || null, levelNote: clip(local.beltLevel, 120) || null,
        sections: lessonSections(local, labelsFor(web, lang, item.category), web.POOMSAE_WALKTHROUGHS?.[item.id]) } as Draft];
    })) as Record<Lang, Draft>;
    const base = drafts.en;
    const guidance = legacyGuidance(item);
    const merge = WEBSITE_MERGES[item.id];
    const video = s(item.videoUrl || item.mediaUrl);
    return {
      sourceKey: `web:${item.id}`, title: base.title, slug: clip(item.slug, 120).toLowerCase(), kind: 'lesson', categorySlug: item.category, tkdCategory: LEGACY_CATEGORY[item.category]?.[1] ?? 'Theory',
      koreanName: base.koreanName, romanized: clip(item.romanized, 200) || null, summary: base.summary, levelNote: base.levelNote,
      tags: [item.category, item.poomsaeSeries, typeof item.kickTrajectory === 'string' ? item.kickTrajectory : null].filter(nonEmpty).map(tag => clip(tag, 40)),
      description: legacyDescription(item.summary, item.category, guidance), projectionText: clip(item.summary, 20000), guidance, videoUrl: /^https:\/\//.test(video) ? video : '',
      ...(merge ? { mergeTitle: merge.title, ...(merge.fixedTitle ? { fixedTitle: merge.fixedTitle } : {}) } : {}),
      content: finish({ sections: base.sections, translations: translations(base, drafts), sources: sourcesOf(item) }),
    };
  });
}

export function websiteCategories(web: Any): ImportCategory[] {
  return (web.libraryCategoriesMeta as Any[]).map((meta, index) => ({
    slug: meta.id, title: clip(meta.title, 120), koreanTitle: clip(meta.koreanTitle, 120) || null, subtitle: clip(meta.subtitle, 240) || null, description: clip(meta.description, 2000) || null,
    icon: CATEGORY_ICON[meta.id] ?? 'BookOpen', accentColor: /^#[0-9A-Fa-f]{6}$/.test(meta.accentColor) ? meta.accentColor : '#EF2F38', libraryType: 'Taekwondo', sortOrder: (index + 1) * 10,
    translations: Object.fromEntries((['km', 'zh'] as const).filter(lang => meta.translations?.[lang]).map(lang => [lang, Object.fromEntries(Object.entries({ title: clip(meta.translations[lang].title, 120), subtitle: clip(meta.translations[lang].subtitle, 240), description: clip(meta.translations[lang].description, 2000) }).filter(([, value]) => value))])),
  }));
}

// --- Reference articles ---------------------------------------------------------------
interface ArticleSpec { key: string; category: string; build: (web: Any, lang: Lang) => Draft | null }
const article = (title: unknown, sections: (LibrarySection | null)[], extra: { summary?: unknown; koreanName?: unknown } = {}): Draft => {
  const heading = clip(stripNumber(s(title)), 150);
  // A section titled like the article itself would only repeat the page heading.
  const kept = (sections.filter(nonEmpty) as LibrarySection[]).map(section => stripNumber(section.title) === heading ? { ...section, title: '' } : section);
  return { title: heading, summary: clip(extra.summary, 4000) || null, koreanName: clip(extra.koreanName, 200) || null, levelNote: null, sections: kept };
};
const ri = (web: Any, lang: Lang): Any => web.competitionRulesI18n?.[lang] ?? web.competitionRulesI18n?.en ?? {};
const pillar = (web: Any, lang: Lang, key: string): Any => (web.getLocalizedHistoryPillars?.(lang) ?? []).find((row: Any) => row.key === key) ?? {};
const subtab = (web: Any, lang: Lang, id: string): string => s((web.getLocalizedPhilosophySubTabs?.(lang) ?? []).find((row: Any) => row.id === id)?.label);

const ARTICLES: ArticleSpec[] = [
  // History -------------------------------------------------------------------------
  { key: 'history-timeline', category: 'history', build: (web, lang) => { const p = pillar(web, lang, 'timeline'); const figures = s(web.historyI18n?.[lang]?.colFigures) || 'Key figures';
    return article(p.title || 'History & Timeline', [timelineSection(web.getLocalizedTimelineMilestones?.(lang), figures)], { summary: p.subtitle, koreanName: p.korean }); } },
  { key: 'nine-kwans', category: 'history', build: (web, lang) => { const p = pillar(web, lang, 'heritage'); const u = web.getLocalizedKwanUnification?.(lang) ?? {};
    return article(p.title || 'Heritage & 9 Kwans', [
      cards('kwans', p.title, arr(web.getLocalizedKwans?.(lang)).map(k => ({ title: k.name, subtitle: join(k.koreanName, k.hanja), body: [k.characteristics, k.historicalLegacy].map(s).filter(Boolean).join('\n\n'), bullets: k.prominentMasters,
        facts: [['Kwan', k.kwanNumber], ['Meaning', k.meaning], ['Founded', k.foundingYear], ['Founder', k.founder], ['Location', k.location], ['Lineage', k.lineageRoot]] }))),
      text('unification', join(u.title, u.koreanTitle), [u.proclamationDate, u.summary, u.background, u.legacyImpact]),
      list('proclamations', u.title, u.theTenProclamations, 'number'),
    ], { summary: p.subtitle, koreanName: p.korean }); } },
  { key: 'organizations', category: 'history', build: (web, lang) => { const p = pillar(web, lang, 'organizations');
    return article(p.title || 'Global Organizations', [
      cards('organizations', p.title, arr(web.getLocalizedOrganizations?.(lang)).map(o => ({ title: o.name, subtitle: join(o.acronym, o.koreanName), body: [o.summary, o.governanceRole, o.formsSystem?.philosophy].map(s).filter(Boolean).join('\n\n'),
        bullets: [...strings(o.keyMilestones), ...strings(o.strengths)], facts: [['Founded', o.foundingYear], ['Founder', o.founder], ['Headquarters', o.headquarters], ['Leadership', o.leadership], ['Scope', o.scope],
          ['Sparring', join(o.sparringRules?.format, o.sparringRules?.contactLevel)], ['Scoring', o.sparringRules?.scoringSystem], ['Protective gear', o.sparringRules?.protectiveGear], ['Forms', join(o.formsSystem?.name, o.formsSystem?.count)], ['Forms examples', strings(o.formsSystem?.examples).join(', ')]] }))),
      table('comparison', p.subtitle, ['Feature', 'WT', 'Kukkiwon', 'ITF', 'ATA'], arr(web.getLocalizedOrganizationComparisonTable?.(lang)).map(r => [r.feature, r.wt, r.kukkiwon, r.itf, r.ata])),
    ], { summary: p.subtitle, koreanName: p.korean }); } },
  { key: 'spirit-and-virtues', category: 'history', build: (web, lang) => { const d = web.getLocalizedDualSpirit?.(lang) ?? {};
    return article(subtab(web, lang, 'spirit-virtues') || 'Dual Spirit & 5 Virtues', [
      text('dual-spirit', join(d.title, d.koreanTitle), [d.summary]),
      cards('ideologies', d.title, arr(d.ideologies).map(i => ({ title: i.name, subtitle: join(i.koreanName, i.hanja), body: i.explanation, bullets: [i.quote], facts: [['Direction', i.direction], ['Core value', i.coreValue]] }))),
      cards('virtues', subtab(web, lang, 'spirit-virtues'), arr(web.getLocalizedFiveVirtues?.(lang)).map(v => ({ title: v.name, subtitle: join(v.koreanName, v.hanja, v.romanized), body: v.definition, bullets: [v.guidelineForAction, v.youthCharacterFocus], facts: [['Meaning', v.englishMeaning]] }))),
    ], { koreanName: d.koreanTitle }); } },
  { key: 'five-tenets', category: 'history', build: (web, lang) => article(subtab(web, lang, 'tenets') || '5 Traditional Tenets', [
      cards('tenets', subtab(web, lang, 'tenets'), arr(web.getLocalizedFiveTenets?.(lang)).map(t => ({ title: t.name, subtitle: join(t.koreanName, t.hanja, t.romanized), body: [t.shortDefinition, t.deepExplanation].map(s).filter(Boolean).join('\n\n'), bullets: [t.dojangApplication, t.lifeApplication], facts: [['Meaning', t.englishMeaning]] }))),
    ]) },
  { key: 'nature-and-sport', category: 'history', build: (web, lang) => { const n = web.getLocalizedTaekwondoNature?.(lang) ?? {};
    return article(subtab(web, lang, 'nature-sport') || 'Meaning & Mudo Sport', [
      text('definition', '', [n.definition, n.koreanDefinition]),
      pairs('purposes', '', arr(n.dualPurposes).map(p => [p.title, p.description])),
      pairs('techniques', '', arr(n.fiveTechniqueCharacteristics).map(t => [join(t.title, t.korean), t.explanation])),
      text('suryeon', n.suryeonMeaning?.title, [n.suryeonMeaning?.explanation]),
      list('mudo-sport', subtab(web, lang, 'nature-sport'), n.mudoSportCharacteristics),
    ]); } },
  { key: 'dobok-and-belts', category: 'history', build: (web, lang) => { const d = web.getLocalizedDobokPhilosophy?.(lang) ?? {};
    return article(subtab(web, lang, 'dobok') || 'Dobok & Belt Cosmology', [
      cards('aspects', '', arr(d.aspects).map(a => ({ title: a.title, subtitle: join(a.hanja, a.sound, a.meaning), body: a.description }))),
      cards('belts', d.cycleTitle, arr(d.belts).map(b => ({ title: b.name, subtitle: b.sub, body: b.meaning }))),
    ]); } },
  { key: 'power-and-hwarang', category: 'history', build: (web, lang) => article(subtab(web, lang, 'power-hwarang') || 'Power Theory & Hwarang', [
      pairs('theory-of-power', '', arr(web.getLocalizedTheoryOfPower?.(lang)).map(f => [join(f.factor, f.korean), [f.principle, f.explanation].map(s).filter(Boolean).join(' — ')])),
      pairs('sesok-ogye', '', arr(web.getLocalizedSesokOgye?.(lang)).map(c => [join(c.commandment, c.romanized), [c.english, c.description].map(s).filter(Boolean).join(' — ')])),
    ]) },
  // Self-defense -------------------------------------------------------------------
  { key: 'hosinsul-foundations', category: 'hosinsul', build: (web, lang) => { const f = web.getHosinsulFoundations?.(lang); if (!f) return null;
    return article(f.title, [
      text('etymology', f.etymology?.title, [f.etymology?.summary]),
      cards('characters', '', arr(f.etymology?.characters).map(c => ({ title: join(c.hanja, c.hangul), subtitle: c.meaning, body: c.description }))),
      text('ilgyeok-pilsal', join(f.ilgyeokPilsal?.title), [join(f.ilgyeokPilsal?.koreanTerm, f.ilgyeokPilsal?.hanja), f.ilgyeokPilsal?.concept, f.ilgyeokPilsal?.description]),
      pairs('ilgyeok-pillars', '', arr(f.ilgyeokPilsal?.pillars).map(p => [p.title, p.desc])),
      text('four-pillars-intro', f.fourPillars?.title, [f.fourPillars?.summary]),
      cards('four-pillars', '', arr(f.fourPillars?.pillars).map(p => ({ title: p.name, subtitle: p.koreanName, body: p.desc, bullets: p.techniques }))),
      text('hapkido', join(f.hapkidoConnection?.title, f.hapkidoConnection?.koreanTitle), [f.hapkidoConnection?.summary]),
      pairs('hapkido-points', '', arr(f.hapkidoConnection?.points).map(p => [p.title, p.desc])),
    ], { koreanName: f.koreanTitle }); } },
  { key: 'hosinsul-hard-and-soft', category: 'hosinsul', build: (web, lang) => { const h = web.getHardVsSoftData?.(lang); if (!h) return null; const hard = h.linearHard ?? {}, soft = h.circularSoft ?? {};
    return article(h.title, [
      text('summary', '', [h.summary]),
      text('linear', join(hard.title, hard.koreanTerm), [hard.concept, hard.description]),
      cards('distance', '', arr(hard.distancePyramid).map(d => ({ title: d.range, subtitle: d.koreanRange, body: d.strategy, facts: [['Weapons', d.weapons], ['Warning', d.dangerWarning]] }))),
      callout('multiple-attackers-rule', hard.multipleAttackerDoctrine?.title, hard.multipleAttackerDoctrine?.rule, 'warning'),
      list('multiple-attackers', hard.multipleAttackerDoctrine?.title, hard.multipleAttackerDoctrine?.tactics),
      text('circular', join(soft.title, soft.koreanTerm), [soft.concept, soft.description, soft.subdualBenefit]),
      list('circular-techniques', '', soft.techniques),
      pairs('circular-principles', '', arr(soft.principles).map(p => [p.name, p.desc])),
      table('comparison', '', ['', s(hard.title), s(soft.title)], arr(h.comparisonMatrix).map(r => [r.dimension, r.linearHard, r.circularSoft])),
    ], { koreanName: h.koreanTitle }); } },
  { key: 'vital-points', category: 'hosinsul', build: (web, lang) => { const v = web.getVitalPointsGuide?.(lang); if (!v) return null;
    return article(v.title, [
      text('summary', '', [v.summary]),
      callout('legal-warning', '', v.legalWarning, 'warning'),
      cards('vital-points', '', arr(v.vitalPoints).map(p => ({ title: p.name, subtitle: join(p.koreanName, p.romanized), body: p.impactEffect, facts: [['Location', p.location], ['Anatomy', p.anatomicalStructure], ['Recommended strike', p.recommendedStrike], ['Danger level', p.dangerLevel]] }))),
      steps('legal-framework', v.legalFramework?.title, arr(v.legalFramework?.stages).map(st => ({ title: st.title, body: st.desc }))),
    ], { koreanName: v.koreanTitle }); } },
  { key: 'hosinsul-belt-curriculum', category: 'hosinsul', build: (web, lang) => lang !== 'en' ? null : article('Self-Defense Curriculum by Rank', arr(web.hosinsulCurriculum).flatMap(rank => [
      text(`${rank.id}-objective`, join(rank.rank, rank.koreanRank), [rank.defensiveObjective]),
      cards(`${rank.id}-techniques`, rank.rank, arr(rank.categories).flatMap(category => arr(category.techniques).map(t => ({ title: t.name, subtitle: join(t.romanized, t.koreanName), body: t.mechanics, facts: [['Group', category.title], ['Category', t.category], ['Target', t.targetArea]] })))),
    ]), { summary: 'Hand strikes, releases, locks, takedowns and scenarios, organised by rank. Belts here describe the website syllabus; staff choose which belts see this lesson.' }) },
  { key: 'hosinsul-safety', category: 'hosinsul', build: (web, lang) => { const f = web.hosinsulSafetyFramework; if (lang !== 'en' || !f) return null;
    return article('Self-Defense Safety & Progression', [
      cards('universal-rules', 'Universal safety rules', arr(f.universalRules).map(r => ({ title: r.title, subtitle: join(r.koreanTitle, r.badgeText), body: r.rule, facts: [['Severity', r.severity]] }))),
      table('progression', 'Progression matrix', ['Tier', 'Level', 'Speed', 'Resistance', 'Gear', 'Focus'], arr(f.progressionMatrix).map(r => [r.tier, r.levelName, join(`${r.speedPercent}%`, r.speedLabel), join(`${r.resistancePercent}%`, r.resistanceLabel, r.resistanceDesc), strings(r.gearRequired).join(', '), r.primaryFocus])),
      cards('parameters', 'Safety parameters', arr(f.safetyParameters).map(p => ({ title: p.domain, subtitle: p.subtitle, bullets: p.guidelines }))),
      table('floor-protocols', 'Floor commands', ['Command', 'Korean', 'Action', 'Rationale'], arr(f.floorProtocols).map(p => [p.command, p.koreanCommand, p.action, p.rationale])),
    ]); } },
  // Kicking ------------------------------------------------------------------------
  { key: 'kicking-fundamentals-overview', category: 'kicking-fundamentals', build: (web, lang) => overview(web.getKickingOverview?.(lang)) },
  { key: 'kicking-advanced-overview', category: 'kicking-advanced', build: (web, lang) => overview(web.getAdvancedKickingOverview?.(lang)) },
  // Poomsae ------------------------------------------------------------------------
  { key: 'poomsae-foundations', category: 'poomsae', build: (web, lang) => { const f = web.getPoomsaeFoundations?.(lang); if (!f) return null; const w = f.whatIsPoomsae ?? {};
    return article(f.title, [
      text('what-is-poomsae', w.title, [w.definition, w.origins, w.combatSimulation, w.mindBodyIntegration]),
      text('why-important', f.whyImportant?.title, [f.whyImportant?.summary]),
      pairs('why-pillars', '', arr(f.whyImportant?.pillars).map(p => [p.title, p.desc])),
      text('mistakes-intro', f.commonMistakes?.title, [f.commonMistakes?.summary]),
      cards('mistakes', '', arr(f.commonMistakes?.list).map(m => ({ title: m.title, subtitle: m.koreanTitle, body: m.problem, bullets: [m.correction] }))),
      text('beginner-bridge', f.beginnerBridge?.title, [f.beginnerBridge?.targetRank, f.beginnerBridge?.summary]),
      cards('beginner-components', '', arr(f.beginnerBridge?.components).map(c => ({ title: c.name, subtitle: c.koreanName, body: c.description, facts: [['Focus', c.focus]] }))),
    ], { koreanName: f.koreanTitle }); } },
  { key: 'what-is-taegeuk', category: 'poomsae', build: (web, lang) => { const t = web.getLocalizedWhatIsTaegeuk?.(lang); if (!t) return null; const j = t.jooyeokPhilosophy ?? {}, p = t.pre1971PalgwaeHistory ?? {};
    return article(t.title, [
      text('definition', '', [t.definition, t.flagSymbolism]),
      cards('ideals', '', arr(t.idealsOfTaekwondo).map(i => ({ title: i.title, subtitle: i.koreanTitle, body: i.description }))),
      text('jooyeok', join(j.title), [j.subtitle, j.summary, j.bookOfChangesOrigin, j.umYangMetaphysics, j.eightConceptsCircle, j.keonGonDialectic, j.koreanFlagSynthesis, j.trigramManifestation]),
      text('palgwae-history', p.title, [p.summary, p.whyReplaced]),
      list('palgwae-differences', '', p.keyDifferences),
      cards('duality-pairs', '', arr(t.theFourDualityPairs).map(d => ({ title: d.pairName, body: d.philosophicalBalance, facts: [['Yang', join(d.yangForm?.name, d.yangForm?.trigramSymbol, d.yangForm?.element)], ['Yin', join(d.yinForm?.name, d.yinForm?.trigramSymbol, d.yinForm?.element)]] }))),
    ], { koreanName: t.koreanTitle }); } },
  { key: 'four-execution-elements', category: 'poomsae', build: (web, lang) => { const e = web.getLocalizedWhatIsTaegeuk?.(lang)?.fourExecutionElements ?? (lang === 'en' ? web.EN_FOUR_EXECUTION_ELEMENTS : null); if (!e) return null; const w = e.wangFloorRule ?? {}, c = e.clockSystem ?? {};
    return article(e.title, [
      text('summary', e.subtitle, [e.summary]),
      cards('elements', '', arr(e.elements).map(el => ({ title: el.title, subtitle: el.koreanTitle, body: el.concept, bullets: el.details, facts: [['Practical application', el.practicalApplication]] }))),
      text('wang-rule', join(w.title, w.chineseCharacter), [w.definition, w.yangRule, w.umRule, w.philosophicalSignificance]),
      table('clock-system', c.title, ['Hour', 'Direction', 'Korean', 'Role'], arr(c.directions).map(d => [d.hour, d.direction, d.koreanName, d.tacticalRole]), c.description),
    ]); } },
  { key: 'eight-performance-pillars', category: 'poomsae', build: (web, lang) => { const e = web.getLocalizedWhatIsTaegeuk?.(lang)?.eightPerformancePillars ?? (lang === 'en' ? web.EN_EIGHT_PERFORMANCE_PILLARS : null); if (!e) return null;
    return article(e.title, [
      text('summary', e.subtitle, [e.summary]),
      cards('pillars', '', arr(e.pillars).map(p => ({ title: p.title, subtitle: p.koreanTitle, body: p.summary, bullets: [p.executionGuide], facts: [['Master cue', p.masterCue]] }))),
    ]); } },
  { key: 'palgwe-and-taegeuk', category: 'poomsae', build: (web, lang) => { const e = web.getLocalizedWhatIsTaegeuk?.(lang)?.palgweComparison ?? (lang === 'en' ? web.EN_PALGWE_COMPARISON : null); if (!e) return null;
    return article(e.title, [
      text('summary', e.subtitle, [e.historicalTimeline, e.summary]),
      table('forms', '', ['#', 'Palgwe form', 'Trigram', 'Floor pattern', 'Meaning', 'Element', 'Taegeuk counterpart', 'Key difference'], arr(e.forms).map(f => [f.number, f.name, f.trigram, f.floorPattern, f.patternDefinition, f.element, f.taegeukCounterpart, f.keyDivergence])),
    ]); } },
  { key: 'yudanja-guide', category: 'poomsae', build: (web, lang) => { const y = web.getYudanjaGuide?.(lang); if (!y) return null; const g = y.gradingsAndCompetition ?? {};
    return article(y.title, [
      text('definition', '', [y.definition]),
      text('contrast', y.contrastWithTaegeuk?.title, [y.contrastWithTaegeuk?.summary]),
      cards('contrast-points', '', arr(y.contrastWithTaegeuk?.points).map(objectCard)),
      table('floor-patterns', '', ['Dan', 'Stripes', 'Form', 'Korean', 'Meaning', 'Floor pattern', 'Hanja', 'Symbol', 'Master trait', 'Virtue', 'Moves'],
        arr(y.floorPatterns).map(f => [f.danRank, join(f.beltStripes, f.beltStripeRoman), f.name, f.koreanName, f.meaningOfName, f.floorPatternShape, f.hanjaCharacter, join(f.meaningOfSymbol, f.characterMeaning), f.masterCharacteristic, f.masterVirtue, f.totalMoves])),
      text('gradings', g.title, [g.nonLinearProgression, g.competitionDynamics, g.selfDefenseBunkai]),
      text('clarifications', '', [y.authoritativeClarifications?.hansooNote, y.authoritativeClarifications?.ilyoNote]),
    ], { koreanName: y.koreanTitle }); } },
  { key: 'black-belt-forms', category: 'poomsae', build: (web, lang) => { const rows = arr(web.getLocalizedBlackBeltDossier?.(lang)); if (!rows.length) return null;
    return article(s(web.poomsaeI18n?.[lang]?.danMasteryMatrixTitle) || 'Black Belt (Yudanja) Forms', [
      cards('forms', '', rows.map(r => ({ title: r.name, subtitle: join(r.danRank, r.koreanName, r.hanja), body: r.philosophicalEssence, facts: [['Symbolism', r.symbolism], ['Key techniques', r.keyTechniques]] }))),
    ]); } },
  { key: 'poomsae-series', category: 'poomsae', build: (web, lang) => { const config = web.getLocalizedSeriesConfig?.(lang); if (!config) return null;
    return article('Poomsae Series', [
      cards('series', '', Object.values(config as Any).map((c: Any) => ({ title: c.title, subtitle: join(c.koreanTitle, c.subtitle), body: c.description, facts: [['Forms', c.count], [s(web.poomsaeI18n?.[lang]?.targetDivisionLabel) || 'Division', c.targetDivision]] }))),
    ]); } },
  // Competition rules -----------------------------------------------------------------
  { key: 'kyorugi-rules-and-officials', category: 'competition-rules', build: (web, lang) => { const r = ri(web, lang), o = r.overview ?? {}, ring = web.getLocalizedRingDynamics?.(lang) ?? {}, gear = web.getLocalizedEligibilityAndGear?.(lang) ?? {};
    return article(join(stripNumber(s(r.masterCategories?.kyorugi?.label)), r.masterCategories?.kyorugi?.sub) || 'WT Kyorugi Rules', [
      text('governance', o.govTitle, [o.govBadge, o.govDesc]),
      pairs('governance-points', '', [[o.standardTitle, o.standardDesc], [o.modTitle, o.modDesc], [o.codeTitle, o.codeDesc]]),
      text('field-of-play', o.fopTitle, [o.fopSub, join(o.contestArea, o.contestSub), o.alertBand, o.safetyOuter, o.noTapeNote, o.platformNote]),
      text('officials-intro', o.officialsTitle, [o.officialsDesc]),
      pairs('officials-roles', '', [[o.refereeTitle, o.refereeDesc], [o.judgesTitle, o.judgesDesc], [o.taTitle, o.taDesc], [o.csTitle, o.csDesc]]),
      cards('officials', '', arr(web.getLocalizedOfficials?.(lang)).map(x => ({ title: x.title, subtitle: x.role, body: x.description }))),
      cards('ring', '', [{ title: ring.octagonTitle, subtitle: ring.octagonSubtitle, body: ring.octagonDescription, bullets: ring.octagonPoints }, { title: ring.squareTitle, subtitle: ring.squareSubtitle, body: ring.squareDescription, bullets: ring.squarePoints }]),
      cards('eligibility-gear', '', [{ title: gear.eligibilityTitle, subtitle: gear.eligibilityBadge, bullets: gear.eligibilityItems }, { title: gear.gearTitle, subtitle: gear.gearBadge, bullets: gear.gearItems }]),
      table('cadet-weights', r.divisions?.cadetTitle, ['', s(r.divisions?.colHeight) || 'Height', s(r.divisions?.colMinWeight) || 'Min weight', s(r.divisions?.colMaxWeight) || 'Max weight'],
        arr(web.cadetHeightWeightLimits).map(c => [c.gender, c.heightClass, c.minWeight, c.maxWeight]), r.divisions?.cadetSub),
      table('referee-signals', o.signalsTitle, ['Command', 'Korean', 'Meaning', 'Signal'], arr(web.getLocalizedRefereeSignals?.(lang)).map(x => [x.command, x.korean, x.meaning, x.signal]), o.signalsSub),
    ]); } },
  { key: 'kyorugi-scoring-and-penalties', category: 'competition-rules', build: (web, lang) => { const r = ri(web, lang), sc = r.scoring ?? {}, sa = r.safety ?? {};
    return article(sc.pointsTitle || 'Kyorugi Scoring & Penalties', [
      table('points', sc.pointsTitle, [sc.colTarget || 'Target', sc.colTechnique || 'Technique', sc.colPoints || 'Points', sc.colBonus || 'Bonus', sc.colDesc || 'Rule'], arr(web.getLocalizedKyorugiPointValues?.(lang)).map(p => [p.target, p.technique, p.points, p.bonus, p.description]), sc.pointsSub),
      text('best-of-3', join(sc.bestOf3Title, sc.bestOf3Badge), [sc.bestOf3Desc]),
      list('tie-break', sc.tieBreakTitle, [sc.tieBreak1, sc.tieBreak2, sc.tieBreak3, sc.tieBreak4], 'number'),
      table('gamjeom', sc.gamjeomTitle, [sc.colCode || 'Code', sc.colInfraction || 'Infraction', sc.colPenalty || 'Penalty', sc.colExplanation || 'Rule'], arr(web.getLocalizedGamjeomRules?.(lang)).map(g => [g.code, g.infraction, g.penalty, g.explanation]), sc.gamjeomSub),
      text('yellow-card', sc.yellowCardTitle, [sc.yellowCardDesc]),
      text('point-gap', sc.pointGapTitle, [sc.pointGapDesc]),
      text('equipment', sa.equipmentTitle, [sa.equipmentSub]),
      text('ivr', join(sa.ivrTitle, sa.ivrBadge), [sa.ivrDesc]),
      list('ivr-allowed', sa.ivrAllowedTitle, sa.ivrAllowedItems, 'check'),
      list('ivr-forbidden', sa.ivrForbiddenTitle, sa.ivrForbiddenItems),
      table('health-bar', sa.simTitle, ['Action', 'Deduction', 'Description'], arr(web.kyorugiHealthBarActions).map(h => [h.action, h.deduction, h.description]), sa.simSub),
      text('doctor', sa.doctorTitle, [sa.doctorDesc]),
    ]); } },
  { key: 'kyorugi-guide-and-cases', category: 'competition-rules', build: (web, lang) => { const g = ri(web, lang).guide ?? {};
    return article(g.title || 'Tournament Guide & Case Studies', [
      text('intro', '', [g.sub]),
      steps('stages', '', [1, 2, 3, 4, 5].map(n => ({ title: g[`stage${n}Title`], body: g[`stage${n}Desc`] }))),
      list('golden-rules', g.goldenRulesTitle, g.goldenRules, 'number'),
      cards('scenarios', '', arr(web.getLocalizedKyorugiScenarios?.(lang)).map(c => ({ title: c.title, subtitle: `#${c.caseNum}`, body: c.scenario, facts: [['Decision', c.decision], ['Points', c.points]] }))),
      pairs('beginner-mistakes', '', arr(web.getLocalizedBeginnerMistakes?.(lang)).map(m => [join(m.title, m.mistake), m.correction])),
      pairs('mindset', '', arr(web.getLocalizedMindset?.(lang)).map(m => [m.title, m.description])),
      cards('prohibited', '', arr(web.getLocalizedProhibitedCategories?.(lang)).map(p => ({ title: p.title, body: p.description }))),
    ]); } },
  { key: 'poomsae-competition-format', category: 'competition-rules', build: (web, lang) => { const c = ri(web, lang).poomsaeCommon ?? {};
    return article(c.title || 'Poomsae Competition Format', [
      text('intro', '', [c.sub, c.fopDesc]),
      table('divisions', c.divisionsTitle, ['Division', 'Age', 'Individual', 'Pair', 'Team'], arr(web.poomsaeAgeDivisions).map(d => [d.division, d.ageCriteria, d.individual, d.pair, d.team]), c.divisionsSub),
      table('pools', c.poolsTitle, ['Division', 'Pool', 'Forms'], arr(web.compulsoryPoomsaePools).map(p => [p.division, p.pool, strings(p.forms).join(', ')]), c.poolsSub),
      table('commands', c.commandsTitle, [c.colStep || 'Phase', c.colFirst || '1st Poomsae', c.colSecond || '2nd Poomsae', c.colProtocol || 'Court action'], arr(web.singleEliminationCommands).map(x => [x.step, x.firstPoomsae, x.secondPoomsae, x.protocol]), c.commandsSub),
      table('basic-movements', '', ['#', 'Movement', 'Korean', 'Description'], arr(web.getLocalizedFourteenBasicMovements?.(lang)).map(m => [m.num, m.name, m.korean, m.desc])),
    ]); } },
  { key: 'recognized-poomsae-scoring', category: 'competition-rules', build: (web, lang) => { const r = ri(web, lang).poomsaeRecognized ?? {};
    return article(r.title || 'Recognized Poomsae Scoring', [
      text('intro', '', [r.sub]),
      text('accuracy', r.accuracyTitle, [r.accuracySub]),
      cards('accuracy-deductions', '', arr(web.recognizedAccuracyDeductions).map(d => ({ title: d.title, subtitle: join(d.type, d.deduction), body: d.description, bullets: d.examples }))),
      text('presentation', r.presentationTitle, [r.presentationSub]),
      list('presentation-criteria', '', [r.speedPower, r.rhythmTempo, r.energyExpression]),
      table('slow-5-8', r.slowTitle, [r.colPoomsae || 'Poomsae', r.colStance || 'Stance', r.colTechnique || 'Technique', r.colDuration || 'Timing', 'Note'], arr(web.slowMovements5to8s).map(m => [m.poomsae, m.stance, m.technique, m.duration, m.note]), r.slowSub),
      table('slow-8', '', [r.colPoomsae || 'Poomsae', r.colStance || 'Stance', r.colTechnique || 'Technique', r.colDuration || 'Timing', 'Note'], arr(web.slowMovements8s).map(m => [m.poomsae, m.stance, m.technique, m.duration, m.note])),
      cards('cases', '', arr(web.getLocalizedPoomsaeCases?.(lang)).map(c => ({ title: c.title, subtitle: join(`#${c.caseNum}`, c.penalty), body: c.scenario, bullets: c.deductions, facts: [['Total', c.total]] }))),
    ]); } },
  { key: 'freestyle-poomsae-scoring', category: 'competition-rules', build: (web, lang) => { const r = ri(web, lang).poomsaeFreestyle ?? {}, f = web.freestyleScoringI18n?.[lang] ?? web.freestyleScoringI18n?.en ?? {};
    return article(r.title || f.title || 'Freestyle Poomsae Scoring', [
      text('intro', f.officialVersion, [r.sub, f.subtitle]),
      text('mandatory-stances', f.mandatoryStancesTitle, [f.mandatoryStancesDesc]),
      list('mandatory-stance-list', '', [f.hakdariSeogi, f.beomSeogi, f.dwitkubi]),
      pairs('score-structure', '', [[join(f.technicalSkillsTitle, f.technicalSkillsMax), ''], [join(f.difficultyFootTitle, f.difficultyFootMax), [f.basicScoreDesc, f.difficultyBonusDesc].map(s).filter(Boolean).join(' ')],
        [f.basicMovementsTitle, f.basicMovementsDesc], [join(f.presentationTitle, f.presentationMax), '']]),
      pairs('presentation', f.presentationTitle, [[f.creativityTitle, f.creativityDesc], [f.harmonyTitle, f.harmonyDesc], [f.energyTitle, f.energyDesc], [f.musicChoreoTitle, f.musicChoreoDesc]]),
      list('technical-deductions', f.technicalDeductionsTitle, [f.mandatoryStancesDeduction, f.fallingDeduction, f.excessiveAcrobaticsDeduction]),
      list('referee-deductions', f.refereeDeductionsTitle, [f.timePenalty, f.boundaryPenalty, f.restartPenalty]),
      cards('skills', r.skillsTitle, arr(web.freestyleTechnicalSkills).map(k => ({ title: join(k.number, k.name), subtitle: join(k.koreanName, k.baseScoreRange), body: k.measurementCriteria, bullets: k.keyPoints,
        facts: [...arr(k.bonusTiers).map(b => [b.label, b.points] as [string, unknown]), ['Zero score', k.zeroScoreConditions]] }))),
      cards('foot-skills', '', arr(web.compulsoryFootSkillRules).map(k => ({ title: k.name, subtitle: k.koreanName, body: k.description, facts: [['Zero threshold', k.zeroThreshold], ['+0.1', k.bonus01Label], ['+0.2', k.bonus02Label], ['+0.3', k.bonus03Label]] }))),
      table('board-breaking', r.breakingTitle, ['Skill', 'Min boards', 'Max boards', 'Total rule'], arr(web.boardBreakingRequirements).map(b => [b.skill, b.minBoards, b.maxBoards, b.totalRule]), r.breakingSub),
      table('assistance', r.assistanceTitle, ['Action', 'Individual / pair', 'Mixed team'], arr(web.assistanceAuthorizationMatrix).map(a => [a.action, a.individualPair, a.mixedTeam]), r.assistanceSub),
      table('deductions', r.deductionsTitle, ['Violation', 'Deduction', 'Category', 'Notes'], arr(web.freestyleDeductions).map(d => [d.violation, d.deduction, d.category, d.notes]), r.deductionsSub),
      cards('presentation-bands', '', arr(web.presentationScoringDetails).map(p => ({ title: p.category, subtitle: p.scoreBand, body: p.description, bullets: p.subElements }))),
    ]); } },
  { key: 'hanmadang', category: 'competition-rules', build: (web, lang) => { const h = ri(web, lang).hanmadang ?? {};
    return article(h.title || 'Hanmadang', [
      text('intro', '', [h.sub]),
      ...arr(web.hanmadangEventsData).map((group, index) => table(`events-${index + 1}`, join(group.eventGroup, group.koreanName), ['Event', 'Criteria', 'Apparatus'], arr(group.events).map(e => [e.name, e.criteria, e.apparatus]))),
    ]); } },
  { key: 'official-rulebooks', category: 'competition-rules', build: (web, lang) => lang !== 'en' ? null : article('Official WT Rulebooks', [
      table('rulebooks', '', ['Rulebook', 'Korean title', 'Edition', 'In force', 'Pages'], Object.values((web.ruleDocuments ?? {}) as Any).map((d: Any) => [d.title, d.koreanTitle, d.edition, d.inForceDate, d.pages])),
    ]) },
];
function overview(o: Any | undefined): Draft | null {
  if (!o) return null;
  return article(o.title, [text('philosophy', o.subtitle, [o.philosophy]), pairs('tenets', '', arr(o.coreTenets).map(t => [t.title, t.desc]))], { koreanName: o.koreanTitle });
}
function timelineSection(rows: Any[] | undefined, figuresLabel: string): LibrarySection | null {
  const items = arr(rows).map(r => ({ date: clip(r.year, 80), title: clip(r.title, 300), subtitle: clip(r.koreanTitle, 300), body: clip(r.summary, 20000),
    details: [...strings(r.details), r.keyFigures ? clip(`${figuresLabel}: ${s(r.keyFigures)}`, 2000) : ''].filter(Boolean).slice(0, 30), tag: clip(r.era, 80) })).filter(r => r.title);
  return items.length ? { id: 'timeline', type: 'timeline', title: '', items } : null;
}

export function websiteArticles(web: Any): ImportItem[] {
  const out: ImportItem[] = [];
  for (const spec of ARTICLES) {
    const drafts = Object.fromEntries(LANGS.map(lang => [lang, spec.build(web, lang)])) as Record<Lang, Draft | null>;
    const base = drafts.en;
    if (!base || !base.sections.length) continue;
    const slug = spec.key;
    const summary = base.summary ?? (base.sections.find(section => section.type === 'text') as Any)?.paragraphs?.[0]?.slice(0, 600) ?? null;
    const guidance = {};
    out.push({
      sourceKey: `web:ref:${spec.key}`, title: base.title || labelFromKey(spec.key), slug, kind: 'article', categorySlug: spec.category, tkdCategory: LEGACY_CATEGORY[spec.category]?.[1] ?? 'Theory',
      koreanName: base.koreanName, romanized: null, summary, levelNote: null, tags: ['reference', spec.category],
      description: legacyDescription(summary ?? base.title, spec.category, guidance), projectionText: clip(summary ?? base.title, 20000), guidance, videoUrl: '',
      content: finish({ sections: base.sections, translations: translations({ ...base, summary }, { km: drafts.km ?? undefined, zh: drafts.zh ?? undefined }), sources: [] }),
    });
  }
  return out;
}

/** Everything the import sends, plus a short report for the dry run. */
export function websiteImport(web: Any) {
  const categories = websiteCategories(web);
  const lessons = websiteLessons(web);
  const articles = websiteArticles(web);
  const items = [...lessons, ...articles];
  const slugs = new Set<string>();
  for (const item of items) { if (slugs.has(item.slug)) throw new Error(`Duplicate slug ${item.slug}`); slugs.add(item.slug); }
  const translated = (lang: 'km' | 'zh') => items.filter(item => item.content.translations[lang]).length;
  return {
    categories, items,
    report: {
      categories: categories.length, lessons: lessons.length, articles: articles.length, merges: items.filter(item => item.mergeTitle).length,
      titleFixes: items.filter(item => item.fixedTitle).length, translatedKm: translated('km'), translatedZh: translated('zh'),
      sections: items.reduce((sum, item) => sum + item.content.sections.length, 0), diagrams: items.filter(item => item.content.sections.some(section => section.type === 'diagram')).length,
      bytes: JSON.stringify(items).length,
    },
  };
}
