'use client';
import { useState } from 'react';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/Dialog';
import { buttonClass, fieldClass, labelClass, sectionLabelClass } from '@/components/ui/styles';
import { portalRequest } from '@/lib/portal-api';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { LIBRARY_CATEGORY_ICONS, LIBRARY_CATEGORY_TYPES, libraryCategorySchema, SLUG, type LibraryCategory, type LibraryCategoryInput } from '@/lib/library-content';
import { CategoryIcon, useLibraryCategories } from './library-categories';

type Form = LibraryCategoryInput & { id?: string; revision?: number };
const blank = (): Form => ({ slug: '', title: '', koreanTitle: null, subtitle: null, description: null, icon: 'BookOpen', accentColor: '#EF2F38', libraryType: 'Taekwondo', isActive: true, translations: {} });
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/**
 * Library → Categories: staff add, rename, colour, reorder, hide and translate the
 * categories students browse. A category in use is hidden instead of deleted.
 */
export function LibraryCategoryManager({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const { showNotification, showConfirm } = useAppStore();
  const { categories, error: loadError, reload } = useLibraryCategories();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const run = async (body: Record<string, unknown>, success: string) => {
    if (saving) return false;
    setSaving(true); setError('');
    try { await portalRequest('/api/admin/library-categories', body); showNotification(success, 'success'); await reload(); onChanged?.(); return true; }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'The category could not be saved.'); return false; }
    finally { setSaving(false); }
  };
  const save = async () => {
    if (!form) return;
    const { id, revision, ...input } = form;
    const parsed = libraryCategorySchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Review the category.'); return; }
    if (await run(id ? { action: 'UPDATE', id, expectedRevision: revision, category: parsed.data } : { action: 'CREATE', category: parsed.data }, id ? 'Category saved.' : 'Category added.')) setForm(null);
  };
  const move = (index: number, to: number) => {
    if (!categories) return;
    const order = categories.map(row => row.id);
    const [id] = order.splice(index, 1); order.splice(to, 0, id);
    void run({ action: 'REORDER', order }, 'Category order saved.');
  };
  const remove = (category: LibraryCategory) => showConfirm(`Delete the category "${category.title}"? This cannot be undone.`, () => { void run({ action: 'DELETE', id: category.id, expectedRevision: category.revision }, 'Category deleted.').then(done => { if (done) setForm(null); }); }, 'Delete category');
  const edit = (category: LibraryCategory) => { setError(''); setForm({ ...category }); };
  const set = (change: Partial<Form>) => setForm(current => current ? { ...current, ...change } : current);
  const setTranslation = (lang: 'km' | 'zh', key: 'title' | 'subtitle' | 'description', value: string) =>
    setForm(current => current ? { ...current, translations: { ...current.translations, [lang]: { ...current.translations?.[lang], [key]: value } } } : current);

  return (
    <Dialog onClose={onClose} size="xl" locked={saving}>
      <DialogHeader icon={<SquaresFour weight="bold" />} title="Library categories" description="What students browse by, in the order they see it" onClose={saving ? undefined : onClose}
        actions={!form ? <button type="button" className={buttonClass({ size: 'sm' })} onClick={() => { setError(''); setForm(blank()); }}><Plus className="size-4" weight="bold" /> New category</button> : undefined} />
      <DialogBody className="space-y-4">
        {(error || loadError) && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error || loadError}</p>}
        {!categories && !loadError && <p role="status" className="text-sm text-ink-muted">Loading categories…</p>}
        {form ? (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void save(); }}>
            <div><label htmlFor="cat-title" className={labelClass}>Name</label>
              <input id="cat-title" required maxLength={120} className={fieldClass} value={form.title} onChange={event => set({ title: event.target.value, ...(!form.id && (!form.slug || form.slug === slugify(form.title)) ? { slug: slugify(event.target.value) } : {}) })} /></div>
            <div><label htmlFor="cat-slug" className={labelClass}>Web name (used in links)</label>
              <input id="cat-slug" required maxLength={60} pattern={SLUG.source} className={cn(fieldClass, 'font-mono')} value={form.slug} onChange={event => set({ slug: event.target.value.toLowerCase() })} /></div>
            <div><label htmlFor="cat-korean" className={labelClass}>Korean name</label>
              <input id="cat-korean" maxLength={120} className={fieldClass} value={form.koreanTitle ?? ''} onChange={event => set({ koreanTitle: event.target.value || null })} /></div>
            <div><label htmlFor="cat-subtitle" className={labelClass}>Subtitle</label>
              <input id="cat-subtitle" maxLength={240} className={fieldClass} value={form.subtitle ?? ''} onChange={event => set({ subtitle: event.target.value || null })} /></div>
            <div className="sm:col-span-2"><label htmlFor="cat-description" className={labelClass}>Description</label>
              <textarea id="cat-description" rows={2} maxLength={2000} className={cn(fieldClass, 'py-2')} value={form.description ?? ''} onChange={event => set({ description: event.target.value || null })} /></div>
            <div><label htmlFor="cat-icon" className={labelClass}>Icon</label>
              <div className="flex items-center gap-2"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line" style={{ color: form.accentColor }}><CategoryIcon name={form.icon} className="size-5" /></span>
                <select id="cat-icon" className={fieldClass} value={form.icon} onChange={event => set({ icon: event.target.value as Form['icon'] })}>{LIBRARY_CATEGORY_ICONS.map(icon => <option key={icon} value={icon}>{icon.replace(/([a-z])([A-Z])/g, '$1 $2')}</option>)}</select></div></div>
            <div><label htmlFor="cat-color" className={labelClass}>Colour</label>
              <div className="flex items-center gap-2"><input id="cat-color" type="color" className="size-11 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-1" value={form.accentColor} onChange={event => set({ accentColor: event.target.value.toUpperCase() })} />
                <input aria-label="Colour code" maxLength={7} className={cn(fieldClass, 'font-mono')} value={form.accentColor} onChange={event => set({ accentColor: event.target.value })} /></div></div>
            <div><label htmlFor="cat-type" className={labelClass}>Library</label>
              <select id="cat-type" className={fieldClass} value={form.libraryType} onChange={event => set({ libraryType: event.target.value as Form['libraryType'] })}>{LIBRARY_CATEGORY_TYPES.map(type => <option key={type}>{type}</option>)}</select></div>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" checked={form.isActive} onChange={event => set({ isActive: event.target.checked })} /> Shown to students</label>
            {(['km', 'zh'] as const).map(lang => (
              <fieldset key={lang} className="grid gap-2 rounded-lg border border-line p-3 sm:col-span-2 sm:grid-cols-2">
                <legend className={sectionLabelClass}>{lang === 'km' ? 'Khmer' : 'Chinese'} (optional; English shows when blank)</legend>
                <input aria-label={`${lang === 'km' ? 'Khmer' : 'Chinese'} name`} placeholder={form.title || 'Name'} maxLength={120} className={fieldClass} value={form.translations?.[lang]?.title ?? ''} onChange={event => setTranslation(lang, 'title', event.target.value)} />
                <input aria-label={`${lang === 'km' ? 'Khmer' : 'Chinese'} subtitle`} placeholder={form.subtitle || 'Subtitle'} maxLength={240} className={fieldClass} value={form.translations?.[lang]?.subtitle ?? ''} onChange={event => setTranslation(lang, 'subtitle', event.target.value)} />
                <textarea aria-label={`${lang === 'km' ? 'Khmer' : 'Chinese'} description`} placeholder={form.description || 'Description'} rows={2} maxLength={2000} className={cn(fieldClass, 'py-2 sm:col-span-2')} value={form.translations?.[lang]?.description ?? ''} onChange={event => setTranslation(lang, 'description', event.target.value)} />
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className={buttonClass({ variant: 'primary' })} disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save category' : 'Add category'}</button>
              <button type="button" className={buttonClass()} disabled={saving} onClick={() => setForm(null)}>Cancel</button>
              {form.id && <button type="button" className={buttonClass({ variant: 'danger' })} disabled={saving || (categories?.find(row => row.id === form.id)?.lessonCount ?? 0) > 0}
                title={(categories?.find(row => row.id === form.id)?.lessonCount ?? 0) > 0 ? 'Move its lessons first, or hide the category instead.' : undefined}
                onClick={() => { const current = categories?.find(row => row.id === form.id); if (current) remove(current); }}>Delete</button>}
            </div>
          </form>
        ) : categories && (
          categories.length === 0 ? <p className="text-sm text-ink-muted">No categories yet. Add one to start organising the library.</p> : (
            <ol className="space-y-2">
              {categories.map((category, index) => (
                <li key={category.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-muted p-2.5 sm:flex-nowrap">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ color: category.accentColor, backgroundColor: category.accentColor + '1A' }}><CategoryIcon name={category.icon} className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{category.title}{category.koreanTitle ? <span className="font-normal text-ink-subtle"> · {category.koreanTitle}</span> : null}</span>
                    <span className="text-micro text-ink-subtle">{category.lessonCount ?? 0} lesson{category.lessonCount === 1 ? '' : 's'} · {category.libraryType}{category.isActive ? '' : ' · Hidden from students'}{category.translations?.km?.title || category.translations?.zh?.title ? ' · Translated' : ''}</span>
                  </span>
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Move ${category.title} up`} disabled={saving || index === 0} onClick={() => move(index, index - 1)} className={buttonClass({ size: 'icon' })}><ArrowUp className="size-4" /></button>
                    <button type="button" aria-label={`Move ${category.title} down`} disabled={saving || index === categories.length - 1} onClick={() => move(index, index + 1)} className={buttonClass({ size: 'icon' })}><ArrowDown className="size-4" /></button>
                    <button type="button" className={buttonClass({ size: 'sm' })} disabled={saving} onClick={() => edit(category)}>Edit</button>
                  </span>
                </li>
              ))}
            </ol>
          )
        )}
      </DialogBody>
      <DialogFooter><button type="button" className={buttonClass()} onClick={onClose} disabled={saving}>Close</button></DialogFooter>
    </Dialog>
  );
}
