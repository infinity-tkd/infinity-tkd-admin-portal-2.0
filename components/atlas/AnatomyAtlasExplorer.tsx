'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Info, RotateCcw, Search, X } from 'lucide-react';
import AnatomyScene from './AnatomyScene';
import { SYSTEMS, type Atlas, type SceneState, type SystemId, type View } from '@/lib/atlas/anatomy';
import { ANATOMY_DATABASE } from '@/lib/anatomyData';
import { normalizeMuscleNameFor3D } from '@/lib/anatomyUtils';
import { atlasMuscleSelection, relatedMaterialsForMuscle, type AnatomyContext } from '@/lib/anatomy-integration';
import { useAppStore } from '@/lib/store';
import './atlas.css';

interface AnatomyAtlasExplorerProps {
  muscleLoads?: Record<string, number>;
  maxLoad?: number;
  initialSelectedMuscle?: string;
  onSelectMuscle?: (name: string | null) => void;
  className?: string;
  compact?: boolean;
  isDark?: boolean;
  onError?: (err: string) => void;
  onFallbackTo2D?: () => void;
  context?: AnatomyContext;
}

const catalogs = new Map<string, Atlas>();
const initialState = (): SceneState => ({ explode: 0, visible: ['muscular'], selected: [], isolate: false, view: 'three-quarter', rotate: false, reset: 0 });
const layers: SystemId[] = ['muscular', 'skeletal', 'connective'];
const buttonClass = 'min-h-11 rounded-lg border px-3 text-xs font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600';

export function AnatomyAtlasExplorer({ muscleLoads = {}, maxLoad = 1, initialSelectedMuscle, onSelectMuscle, className = '', compact = false, isDark, onError, onFallbackTo2D, context }: AnatomyAtlasExplorerProps) {
  const { state: data } = useAppStore();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [scene, setScene] = useState<SceneState>(initialState);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [detailed, setDetailed] = useState(false);
  const [query, setQuery] = useState('');
  const [about, setAbout] = useState(false);
  const selectCallback = useRef(onSelectMuscle);
  selectCallback.current = onSelectMuscle;
  const errorCallback = useRef(onError);
  errorCallback.current = onError;
  const url = detailed ? '/models/training/atlas.json' : '/models/training/compact/atlas.json';

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let active = true;
    setAtlas(null); setError(''); setProgress(0);
    const cached = catalogs.get(url);
    const request = cached ? Promise.resolve(cached) : fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('The muscle catalogue could not be loaded.');
      const result = await response.json() as Atlas;
      if (!Array.isArray(result.parts) || !result.parts.length || !Array.isArray(result.concepts) || !Array.isArray(result.chunks)) throw new Error('The muscle catalogue is invalid.');
      catalogs.set(url, result);
      return result;
    });
    request.then(result => { if (active) setAtlas(result); }).catch(() => {
      if (active) setError('The muscle view could not be loaded. Retry or continue in 2D.');
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [url, retry]);

  const select = (name: string, notify = true) => {
    if (!atlas) return;
    const ids = atlasMuscleSelection(atlas, name, data.muscles);
    setSelectedName(name);
    setScene(previous => ({ ...previous, selected: ids, isolate: false, rotate: false }));
    if (notify) selectCallback.current?.(name);
  };
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => {
    if (atlas && initialSelectedMuscle) selectRef.current(initialSelectedMuscle, false);
  }, [atlas, initialSelectedMuscle]);

  const normalizedLoads = useMemo(() => Object.fromEntries(Object.entries(muscleLoads).map(([name, score]) => [normalizeMuscleNameFor3D(name), Number.isFinite(score) ? Math.min(1, Math.max(0, score / Math.max(1, maxLoad))) : 0])), [muscleLoads, maxLoad]);
  const group = selectedName ? normalizeMuscleNameFor3D(selectedName) : null;
  const knowledge = group ? ANATOMY_DATABASE[group] : null;
  const record = data.muscles.find(muscle => muscle.name.toLowerCase() === selectedName?.toLowerCase());
  const related = useMemo(() => selectedName ? relatedMaterialsForMuscle(selectedName, data, context?.studentId) : [], [selectedName, data, context?.studentId]);
  const choices = useMemo(() => {
    const names = new Set([...Object.keys(normalizedLoads), ...Object.keys(ANATOMY_DATABASE), ...(atlas?.concepts.map(concept => concept.name) ?? [])]);
    const term = query.trim().toLowerCase();
    return [...names].filter(name => !term || name.toLowerCase().includes(term)).slice(0, term ? 20 : 8);
  }, [atlas, query, normalizedLoads]);
  const reset = () => {
    setScene(previous => ({ ...initialState(), reset: previous.reset + 1 }));
    setSelectedName(null); setQuery(''); selectCallback.current?.(null);
  };
  const picked = (id: string) => {
    const part = atlas?.parts.find(item => item.id === id);
    if (part) selectRef.current(part.name);
  };
  const fail = (message: string) => { setError(message); errorCallback.current?.(message); };
  const dark = isDark ?? data.theme === 'dark';

  return <section className={`tkd-muscle-viewer flex h-full min-h-0 flex-col bg-white text-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 ${className}`} aria-label="Infinity muscle explorer" data-quality={detailed ? 'detailed' : 'compact'}>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 p-2 dark:border-neutral-800">
      {layers.map(id => <button key={id} type="button" aria-pressed={scene.visible.includes(id)} className={`${buttonClass} ${scene.visible.includes(id) ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'border-neutral-200 dark:border-neutral-700'}`} onClick={() => setScene(previous => ({ ...previous, isolate: false, visible: previous.visible.includes(id) ? previous.visible.filter(layer => layer !== id) : [...previous.visible, id] }))}>{SYSTEMS.find(system => system.id === id)?.name}</button>)}
      <button type="button" className={`${buttonClass} ml-auto border-neutral-200 dark:border-neutral-700`} title="Reset muscle view" aria-label="Reset muscle view" onClick={reset}><RotateCcw size={16} /></button>
      <button type="button" className={`${buttonClass} border-neutral-200 dark:border-neutral-700`} aria-label="About the anatomy reference" aria-expanded={about} onClick={() => setAbout(value => !value)}><Info size={16} /></button>
    </div>
    {about && <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed dark:border-neutral-800 dark:bg-neutral-900">
      Adult male anatomy reference. Highlights represent {context?.kind === 'student' ? 'completed learning coverage' : 'teaching emphasis'}, rather than a personal body scan or measured muscle activity. Compact geometry is simplified for interactive use; Detailed preserves the reference geometry.
      <p className="mt-2">BodyParts3D, © The Database Center for Life Science licensed under <a className="underline" href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noopener noreferrer">CC Attribution 4.0 International</a>. Adapted atlas renderer: © 2026 ashemag, MIT licence. Training bundles retain source structure identifiers.</p>
    </div>}
    <div className={`grid min-h-0 flex-1 ${compact && !selectedName ? '' : 'lg:grid-cols-[minmax(0,1fr)_280px]'}`}>
      <div className="flex min-h-[320px] flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-900">
        <div className="relative min-h-[260px] flex-1" data-testid="muscle-scene">
        {atlas && !error && <AnatomyScene key={`${url}:${retry}`} atlas={atlas} state={scene} onSelect={picked} onProgress={setProgress} onError={fail} isDark={dark} muscleLoads={normalizedLoads} />}
        {!error && progress < 100 && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/90 text-sm dark:bg-neutral-950/90"><span>{atlas ? `Preparing muscle view · ${progress}%` : 'Loading muscle catalogue…'}</span></div>}
        {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white p-5 text-center dark:bg-neutral-950"><p className="max-w-sm text-sm">{error}</p><div className="flex gap-2"><button type="button" className={`${buttonClass} border-red-600 text-red-700 dark:text-red-300`} onClick={() => { setError(''); setRetry(value => value + 1); }}>Retry 3D</button>{onFallbackTo2D && <button type="button" className={`${buttonClass} border-neutral-300 dark:border-neutral-700`} onClick={onFallbackTo2D}>Use 2D view</button>}</div></div>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 border-t border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950" aria-label="Camera controls">
          {(['front', 'back', 'side'] as View[]).map(view => <button key={view} type="button" aria-pressed={scene.view === view} className={`${buttonClass} ${scene.view === view ? 'border-red-600 text-red-700 dark:text-red-300' : 'border-transparent'}`} onClick={() => setScene(previous => ({ ...previous, view, rotate: false }))}>{view[0].toUpperCase() + view.slice(1)}</button>)}
          <button type="button" disabled={!scene.selected.length} aria-pressed={scene.isolate} className={`${buttonClass} border-transparent disabled:opacity-40`} onClick={() => setScene(previous => ({ ...previous, isolate: !previous.isolate }))}>Isolate</button>
          <select aria-label="Anatomy detail quality" className="min-h-11 max-w-[106px] rounded-lg bg-transparent px-1 text-xs" value={detailed ? 'detailed' : 'compact'} onChange={event => setDetailed(event.target.value === 'detailed')}><option value="compact">Compact</option><option value="detailed">Detailed</option></select>
        </div>
      </div>
      {(!compact || selectedName) && <aside className="min-h-0 overflow-y-auto border-t border-neutral-200 p-3 lg:border-l lg:border-t-0 dark:border-neutral-800" aria-label="Muscle and learning details">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 px-3 dark:border-neutral-700"><Search size={16} aria-hidden="true" /><input aria-label="Find a muscle" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Find a muscle" value={query} onChange={event => setQuery(event.target.value)} /></label>
        {(query || !selectedName) && <div className="my-2 flex flex-wrap gap-1">{choices.map(name => <button type="button" key={name} className="min-h-11 rounded-lg bg-neutral-100 px-2 text-left text-xs hover:bg-red-50 hover:text-red-700 dark:bg-neutral-800 dark:hover:bg-red-950 dark:hover:text-red-300" onClick={() => { select(name); setQuery(''); }}>{name}</button>)}</div>}
        {selectedName ? <div className="mt-3 space-y-3">
          <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{group}</h3><button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg" aria-label="Clear muscle selection" onClick={reset}><X size={16} /></button></div>
          {selectedName !== group && <p className="text-xs text-neutral-500 dark:text-neutral-400">{selectedName}</p>}
          <p className="text-xs leading-relaxed">{record?.targetFunction || knowledge?.primaryAction || 'Select a linked learning material to explore its training focus.'}</p>
          {(record?.tkdRelevance || knowledge?.tkdRelevance) && <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{record?.tkdRelevance || knowledge?.tkdRelevance}</p>}
          {!!normalizedLoads[group ?? ''] && <p className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{context?.kind === 'student' ? 'Included in completed learning materials' : 'Included in this material’s teaching focus'}</p>}
          <h4 className="border-t border-neutral-200 pt-3 text-xs font-semibold dark:border-neutral-800">Related learning materials · {related.length}</h4>
          {related.slice(0, 8).map(({ asset, role, completed }) => <button key={asset.id} type="button" disabled={!context?.onOpenMaterial} onClick={() => context?.onOpenMaterial?.(asset.id)} className="block min-h-11 w-full rounded-lg border border-neutral-200 p-2 text-left disabled:cursor-default dark:border-neutral-800"><span className="block text-xs font-medium">{asset.title}</span><span className="text-[11px] text-neutral-500 dark:text-neutral-400">{role}{context?.studentId ? completed ? ' · Completed' : ' · Not completed' : ''}</span></button>)}
          {!related.length && <p className="text-xs text-neutral-500 dark:text-neutral-400">No saved material links for this muscle.</p>}
        </div> : <div className="mt-3 space-y-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400"><p>Tap a muscle to see its role in Taekwondo and linked learning materials.</p><p>Drag to rotate. Pinch or scroll over the model to zoom.</p></div>}
        <p className="mt-4 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">{context?.sourceLabel || 'Saved material mappings and anatomy reference'}{!Object.values(normalizedLoads).some(value => value > 0) ? ' · No mapped training highlights.' : ''}</p>
      </aside>}
    </div>
  </section>;
}

export default AnatomyAtlasExplorer;
