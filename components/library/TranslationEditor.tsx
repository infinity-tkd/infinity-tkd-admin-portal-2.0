'use client';
import { useMemo } from 'react';
import { fieldClass, labelClass, sectionLabelClass } from '@/components/ui/styles';
import { cn } from '@/lib/utils';
import { LIBRARY_LANG_LABEL, readPath, translatableTexts, writePath, SECTION_TYPE_LABEL, type LibraryLocale, type LibrarySection, type LibraryTranslation } from '@/lib/library-content';

/**
 * One language's translation of a lesson, beside the English text. Blank fields
 * fall back to English for students, so a lesson can be translated a little at a time.
 */
export function TranslationEditor({ lang, english, sections, value, onChange }: {
  lang: LibraryLocale;
  english: { title: string; summary: string | null; levelNote: string | null };
  sections: LibrarySection[];
  value: LibraryTranslation | undefined;
  onChange: (next: LibraryTranslation) => void;
}) {
  const t = value ?? {};
  const texts = useMemo(() => sections.map(section => ({ section, fields: translatableTexts(section) })), [sections]);
  const total = 2 + texts.reduce((sum, row) => sum + row.fields.length, 0);
  const done = (t.title?.trim() ? 1 : 0) + (t.summary?.trim() ? 1 : 0) + texts.reduce((sum, row) => sum + row.fields.filter(field => readPath(t.sections?.[row.section.id], field.path).trim()).length, 0);
  const setSection = (id: string, path: (string | number)[], text: string) => onChange({ ...t, sections: { ...t.sections, [id]: writePath(t.sections?.[id], path, text) } });
  const language = LIBRARY_LANG_LABEL[lang];
  return <div className="space-y-4">
    <p className="text-xs text-ink-muted">{done} of {total} texts translated into {language}. Students see English wherever a field is left blank.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor={`${lang}-title`} className={labelClass}>Title</label>
        <input id={`${lang}-title`} maxLength={150} placeholder={english.title} className={fieldClass} value={t.title ?? ''} onChange={event => onChange({ ...t, title: event.target.value })} /></div>
      <div><label htmlFor={`${lang}-level`} className={labelClass}>Level note</label>
        <input id={`${lang}-level`} maxLength={120} placeholder={english.levelNote ?? ''} className={fieldClass} value={t.levelNote ?? ''} onChange={event => onChange({ ...t, levelNote: event.target.value })} /></div>
      <div className="sm:col-span-2"><label htmlFor={`${lang}-summary`} className={labelClass}>Summary</label>
        <textarea id={`${lang}-summary`} rows={2} maxLength={4000} placeholder={english.summary ?? ''} className={cn(fieldClass, 'py-2')} value={t.summary ?? ''} onChange={event => onChange({ ...t, summary: event.target.value })} /></div>
    </div>
    {texts.map(({ section, fields }) => fields.length > 0 && (
      <fieldset key={section.id} className="space-y-2 rounded-lg border border-line p-3">
        <legend className={sectionLabelClass}>{section.title || SECTION_TYPE_LABEL[section.type]}</legend>
        {fields.map(field => {
          const id = `${lang}-${section.id}-${field.path.join('-')}`;
          const current = readPath(t.sections?.[section.id], field.path);
          return <div key={id}>
            <label htmlFor={id} className="mb-1 block text-[11px] text-ink-subtle"><span className="font-semibold text-ink-muted">English:</span> {field.english.length > 240 ? field.english.slice(0, 240) + '…' : field.english}</label>
            {field.multiline
              ? <textarea id={id} rows={2} className={cn(fieldClass, 'py-2')} value={current} placeholder={`${language} (optional)`} onChange={event => setSection(section.id, field.path, event.target.value)} />
              : <input id={id} className={fieldClass} value={current} placeholder={`${language} (optional)`} onChange={event => setSection(section.id, field.path, event.target.value)} />}
          </div>;
        })}
      </fieldset>
    ))}
  </div>;
}
