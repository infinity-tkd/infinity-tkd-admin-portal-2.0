import { en } from './i18n-en';

export type TranslationKey = keyof typeof en;
export type Language = 'en' | 'kh' | 'zh';
type Dictionary = Partial<Record<TranslationKey, string>>;

// English ships with the app. Khmer and Chinese are separate modules fetched on demand: together they are about 100 KB of script
// (60 KB gzipped) that a person reading the portal in English never needs on first load.
const loaded: Record<Language, Dictionary | undefined> = { en, kh: undefined, zh: undefined };
const pending: Partial<Record<Language, Promise<void>>> = {};
const listeners = new Set<() => void>();
let version = 0;

/** The dictionary for a language; English until the requested one has arrived (useT then re-renders). */
export function dictionary(language: Language): Dictionary {
  return loaded[language] ?? en;
}

export function loadDictionary(language: Language): Promise<void> {
  if (loaded[language]) return Promise.resolve();
  pending[language] ??= (language === 'kh' ? import('./i18n-kh').then(module => module.kh) : import('./i18n-zh').then(module => module.zh))
    .then(entries => {
      loaded[language] = entries;
      version += 1;
      listeners.forEach(listener => listener());
    })
    // A failed download leaves English on screen; the next language change (or reload) tries again.
    .catch(() => { delete pending[language]; });
  return pending[language] as Promise<void>;
}

export function subscribeToDictionaries(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function dictionaryVersion() {
  return version;
}

// Start fetching the saved language immediately, in parallel with the rest of the app, so it is usually there before the first page renders.
if (typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem('infinity_lang');
    if (saved === 'kh' || saved === 'zh') void loadDictionary(saved);
  } catch { /* Storage may be disabled; the portal then starts in English. */ }
}
