'use client';
import { useCallback, useEffect, useState } from 'react';
import { Article } from '@phosphor-icons/react/dist/csr/Article';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/Dialog';
import { buttonClass, fieldClass, labelClass } from '@/components/ui/styles';
import { portalRequest } from '@/lib/portal-api';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { libraryContentSchema, libraryMetadataSchema, pruneTranslation, SLUG, UNASSIGNED_BELT, type LibraryContent, type LibraryMetadata, type LibraryTranslation } from '@/lib/library-content';
import { useLibraryCategories } from './library-categories';
import { SectionEditor } from './SectionEditor';
import { TranslationEditor } from './TranslationEditor';

type Tab = 'details' | 'sections' | 'km' | 'zh' | 'sources';
interface Loaded {
  asset: { id: number; title: string; revision: number; targetLevel: string; sourceKey: string | null };
  metadata: LibraryMetadata; content: LibraryContent; contentIssue: string | null;
}
const TABS: { id: Tab; label: string }[] = [{ id: 'details', label: 'Details' }, { id: 'sections', label: 'Sections' }, { id: 'km', label: 'Khmer' }, { id: 'zh', label: 'Chinese' }, { id: 'sources', label: 'Sources' }];
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

/**
 * Library → Content & languages: the lesson's category, names and summary, its
 * ordered sections, Khmer and Chinese translations and sources. Saved as a draft;
 * students see it after the lesson is published.
 */
export function LessonContentEditor({ assetId, onClose }: { assetId: number; onClose: () => void }) {
  const { showNotification, showConfirm, applyLibraryAssetRow } = useAppStore();
  const { categories } = useLibraryCategories();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [metadata, setMetadata] = useState<LibraryMetadata | null>(null);
  const [content, setContent] = useState<LibraryContent | null>(null);
  const [tags, setTags] = useState('');
  const [tab, setTab] = useState<Tab>('details');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await portalRequest<Loaded>(`/api/admin/library-assets/content?id=${assetId}`);
      setLoaded(data); setMetadata(data.metadata); setContent(data.content); setTags(data.metadata.tags.join(', ')); setDirty(false);
      if (data.contentIssue) setError(data.contentIssue);
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'The lesson content could not load.'); }
  }, [assetId]);
  useEffect(() => { void load(); }, [load]);

  const editMeta = (change: Partial<LibraryMetadata>) => { setMetadata(current => current ? { ...current, ...change } : current); setDirty(true); };
  const editContent = (change: Partial<LibraryContent>) => { setContent(current => current ? { ...current, ...change } : current); setDirty(true); };
  const setTranslation = (lang: 'km' | 'zh', next: LibraryTranslation) => editContent({ translations: { ...content!.translations, [lang]: next } });

  const save = async () => {
    if (!loaded || !metadata || !content || saving) return;
    const meta = libraryMetadataSchema.safeParse({ ...metadata, tags: tags.split(',').map(tag => tag.trim()).filter(Boolean) });
    const translations = Object.fromEntries((['km', 'zh'] as const).map(lang => [lang, pruneTranslation(content.translations[lang])]).filter(([, value]) => value));
    const body = libraryContentSchema.safeParse({ ...content, translations });
    const issue = !meta.success ? meta.error.issues[0] : !body.success ? body.error.issues[0] : null;
    if (issue) { setError(`${issue.path.length ? issue.path.join(' › ') + ': ' : ''}${issue.message}`); return; }
    setSaving(true); setError('');
    try {
      const result = await portalRequest<{ asset: Record<string, any> }>('/api/admin/library-assets/content', { id: loaded.asset.id, expectedRevision: loaded.asset.revision, metadata: meta.data, content: body.data });
      applyLibraryAssetRow(result.asset);
      setLoaded({ ...loaded, asset: { ...loaded.asset, revision: result.asset.revision } });
      setDirty(false);
      showNotification('Lesson content saved as a draft. Publish the lesson to show students.', 'success');
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'The lesson content could not be saved.'); }
    finally { setSaving(false); }
  };
  const close = () => { if (!dirty) onClose(); else showConfirm('Close without saving your changes to this lesson?', onClose, 'Unsaved changes'); };

  return (
    <Dialog onClose={close} size="full" locked={saving}>
      <DialogHeader icon={<Article weight="bold" />} title={loaded ? `Content & languages · ${loaded.asset.title}` : 'Content & languages'} description="Sections, translations and details students see in the library" onClose={saving ? undefined : close} />
      <DialogBody className="space-y-4">
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        {!loaded && !error && <p role="status" className="text-sm text-ink-muted">Loading lesson content…</p>}
        {loaded && metadata && content && <>
          {loaded.asset.targetLevel === UNASSIGNED_BELT && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">No belt yet. Choose a belt (or All) in Edit details before publishing this lesson.</p>}
          <div role="tablist" aria-label="Lesson content" className="flex flex-wrap gap-1 border-b border-line">
            {TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
              className={cn('min-h-11 rounded-t-lg px-3 text-xs font-bold uppercase tracking-wider', tab === item.id ? 'border-b-2 border-brand text-ink' : 'text-ink-muted hover:text-ink')}>
              {item.label}{item.id === 'sections' ? ` (${content.sections.length})` : ''}</button>)}
          </div>
          <div role="tabpanel">
            {tab === 'details' && <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="content-category" className={labelClass}>Category</label>
                <select id="content-category" className={fieldClass} value={metadata.categoryId ?? ''} onChange={event => editMeta({ categoryId: event.target.value || null })}>
                  <option value="">No category</option>
                  {(categories ?? []).map(category => <option key={category.id} value={category.id}>{category.title}{category.isActive ? '' : ' (hidden)'}</option>)}
                </select></div>
              <div><label htmlFor="content-kind" className={labelClass}>Type</label>
                <select id="content-kind" className={fieldClass} value={metadata.kind} onChange={event => editMeta({ kind: event.target.value as LibraryMetadata['kind'] })}>
                  <option value="lesson">Lesson (a technique or form to practise)</option><option value="article">Article (reading and reference)</option>
                </select></div>
              <div><label htmlFor="content-korean" className={labelClass}>Korean name</label>
                <input id="content-korean" maxLength={200} className={fieldClass} value={metadata.koreanName ?? ''} onChange={event => editMeta({ koreanName: event.target.value || null })} /></div>
              <div><label htmlFor="content-romanized" className={labelClass}>Romanized name</label>
                <input id="content-romanized" maxLength={200} className={fieldClass} value={metadata.romanized ?? ''} onChange={event => editMeta({ romanized: event.target.value || null })} /></div>
              <div className="sm:col-span-2"><label htmlFor="content-summary" className={labelClass}>Summary (shown on the lesson card)</label>
                <textarea id="content-summary" rows={3} maxLength={4000} className={cn(fieldClass, 'py-2')} value={metadata.summary ?? ''} onChange={event => editMeta({ summary: event.target.value || null })} /></div>
              <div><label htmlFor="content-level" className={labelClass}>Level note (text only, e.g. &ldquo;Green belt and above&rdquo;)</label>
                <input id="content-level" maxLength={120} className={fieldClass} value={metadata.levelNote ?? ''} onChange={event => editMeta({ levelNote: event.target.value || null })} /></div>
              <div><label htmlFor="content-slug" className={labelClass}>Web name (used in student links)</label>
                <div className="flex gap-2"><input id="content-slug" maxLength={120} pattern={SLUG.source} className={cn(fieldClass, 'font-mono')} value={metadata.slug ?? ''} onChange={event => editMeta({ slug: event.target.value.toLowerCase() || null })} />
                  <button type="button" className={buttonClass({ size: 'sm' })} onClick={() => editMeta({ slug: slugify(loaded.asset.title) || null })}>Suggest</button></div></div>
              <div className="sm:col-span-2"><label htmlFor="content-tags" className={labelClass}>Tags (comma separated, up to 20)</label>
                <input id="content-tags" className={fieldClass} value={tags} onChange={event => { setTags(event.target.value); setDirty(true); }} /></div>
              {loaded.asset.sourceKey && <p className="text-[11px] text-ink-subtle sm:col-span-2">Imported from the website ({loaded.asset.sourceKey}). Your edits here are kept if the website library is imported again.</p>}
            </div>}
            {tab === 'sections' && <SectionEditor sections={content.sections} onChange={sections => editContent({ sections })} />}
            {(tab === 'km' || tab === 'zh') && <TranslationEditor lang={tab} english={{ title: loaded.asset.title, summary: metadata.summary, levelNote: metadata.levelNote }} sections={content.sections} value={content.translations[tab]} onChange={next => setTranslation(tab, next)} />}
            {tab === 'sources' && <div className="space-y-2">
              <p className="text-xs text-ink-muted">Books, rulebooks or websites this lesson is based on. Students see them as links.</p>
              {content.sources.map((source, index) => <div key={index} className="flex flex-wrap gap-2 sm:flex-nowrap">
                <input aria-label={`Source ${index + 1} name`} placeholder="Name" maxLength={200} className={fieldClass} value={source.label} onChange={event => editContent({ sources: content.sources.map((row, at) => at === index ? { ...row, label: event.target.value } : row) })} />
                <input aria-label={`Source ${index + 1} link`} placeholder="https://" className={fieldClass} value={source.url} onChange={event => editContent({ sources: content.sources.map((row, at) => at === index ? { ...row, url: event.target.value } : row) })} />
                <button type="button" aria-label={`Remove source ${index + 1}`} className={buttonClass({ size: 'icon', variant: 'ghost' })} onClick={() => editContent({ sources: content.sources.filter((_, at) => at !== index) })}><Trash className="size-4" /></button>
              </div>)}
              <button type="button" className={buttonClass({ size: 'sm' })} disabled={content.sources.length >= 20} onClick={() => editContent({ sources: [...content.sources, { label: '', url: 'https://' }] })}><Plus className="size-3.5" /> Add source</button>
            </div>}
          </div>
        </>}
      </DialogBody>
      <DialogFooter>
        <span className="mr-auto text-[11px] text-ink-subtle">{dirty ? 'Unsaved changes' : loaded ? 'All changes saved' : ''}</span>
        <button type="button" className={buttonClass()} onClick={close} disabled={saving}>Close</button>
        <button type="button" className={buttonClass({ variant: 'primary' })} onClick={() => void save()} disabled={saving || !loaded || !dirty}>{saving ? 'Saving…' : 'Save draft'}</button>
      </DialogFooter>
    </Dialog>
  );
}
