'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Focus,
  Info,
  Layers,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  X,
  Flame,
  Zap,
} from 'lucide-react';
import AnatomyScene from './AnatomyScene';
import {
  DEFAULT_VISIBLE,
  SYSTEMS,
  explanation,
  type Atlas,
  type Concept,
  type SceneState,
  type SystemId,
  type View,
} from '@/lib/atlas/anatomy';
import { registerAtlasTools } from '@/lib/atlas/agent-tools';
import '@/components/atlas/atlas.css';

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
}

const initialSceneState: SceneState = {
  explode: 0,
  visible: DEFAULT_VISIBLE,
  selected: [],
  isolate: false,
  view: 'three-quarter',
  rotate: false,
  reset: 0,
};

export function AnatomyAtlasExplorer({
  muscleLoads = {},
  maxLoad = 1.0,
  initialSelectedMuscle,
  onSelectMuscle,
  className = '',
  compact = false,
  isDark,
  onError,
  onFallbackTo2D,
}: AnatomyAtlasExplorerProps) {
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [state, setState] = useState<SceneState>(initialSceneState);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'layers' | 'search' | null>(null);
  const [details, setDetails] = useState(false);
  const [about, setAbout] = useState(false);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Concept | null>(null);

  // Load atlas catalogue
  useEffect(() => {
    const abort = new AbortController();
    setProgress(0);
    setError('');
    setAtlas(null);
    setChosen(null);
    setDetails(false);
    setState({ ...initialSceneState, visible: DEFAULT_VISIBLE });

    fetch('/models/atlas.json', { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error('The anatomy catalogue could not be loaded.');
        return r.json();
      })
      .then((data: Atlas) => {
        setAtlas(data);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });

    return () => abort.abort();
  }, []);

  // Keyboard shortcut '/' to open search
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setPanel('search');
        setDetails(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const parts = useMemo(() => new Map(atlas?.parts.map((p) => [p.id, p])), [atlas]);
  const counts = useMemo(
    () => Object.fromEntries(SYSTEMS.map((s) => [s.id, atlas?.parts.filter((p) => p.system === s.id).length ?? 0])),
    [atlas]
  );
  const activeSystems = SYSTEMS.filter((s) => counts[s.id] > 0);

  const selectedParts = useMemo(
    () => state.selected.map((id) => parts.get(id)).filter((p): p is NonNullable<typeof p> => !!p),
    [state.selected, parts]
  );
  const selected = selectedParts[0];
  const system = SYSTEMS.find((s) => s.id === selected?.system);

  const visibleCount = useMemo(
    () =>
      atlas?.parts.filter((p) =>
        state.isolate ? state.selected.includes(p.id) : state.visible.includes(p.system) || state.selected.includes(p.id)
      ).length ?? 0,
    [atlas, state.isolate, state.selected, state.visible]
  );

  // Search results
  const results = useMemo(() => {
    if (!atlas) return [];
    const term = query.toLowerCase().trim();
    if (!term) {
      return ['heart', 'brain', 'liver', 'stomach', 'spleen', 'pancreas', 'biceps', 'quadriceps']
        .map((name) => atlas.concepts.find((c) => c.name.toLowerCase().includes(name)))
        .filter((x): x is Concept => !!x);
    }
    return atlas.concepts
      .filter((c) => c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(term))
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, 60);
  }, [atlas, query]);

  const choose = (c: Concept) => {
    setChosen(c);
    setState((s) => ({ ...s, selected: c.elements, isolate: false, rotate: false }));
    setDetails(true);
    setPanel(null);
    if (onSelectMuscle) onSelectMuscle(c.name);
  };

  useEffect(() => {
    if (!atlas) return;
    return registerAtlasTools(atlas, (c) => flushSync(() => choose(c)));
  }, [atlas]);

  const choosePart = (id: string) => {
    const p = parts.get(id);
    if (!p) return;
    setChosen({ id: p.conceptId, name: p.name, elements: [id] });
    setState((s) => ({ ...s, selected: [id], isolate: false, rotate: false }));
    setDetails(true);
    setPanel(null);
    if (onSelectMuscle) onSelectMuscle(p.name);
  };

  const toggleSystem = (id: SystemId) => {
    setDetails(false);
    setState((s) => ({
      ...s,
      selected: [],
      isolate: false,
      visible: s.visible.includes(id) ? s.visible.filter((x) => x !== id) : [...s.visible, id],
    }));
  };

  const reset = () => {
    setState((s) => ({ ...initialSceneState, visible: DEFAULT_VISIBLE, reset: s.reset + 1 }));
    setChosen(null);
    setDetails(false);
    setPanel(null);
    if (onSelectMuscle) onSelectMuscle(null);
  };

  const openPanel = (next: 'layers' | 'search') => {
    setDetails(false);
    setPanel((p) => (p === next ? null : next));
  };

  // If initialSelectedMuscle is provided, auto-search and highlight
  useEffect(() => {
    if (!atlas || !initialSelectedMuscle) return;
    const clean = initialSelectedMuscle.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
    const hit = atlas.concepts.find(
      (c) => c.name.toLowerCase() === clean || c.name.toLowerCase().includes(clean) || clean.includes(c.name.toLowerCase())
    );
    if (hit) {
      choose(hit);
    }
  }, [atlas, initialSelectedMuscle]);

  // Compute active muscle load for the chosen structure
  const activeLoadScore = useMemo(() => {
    if (!chosen) return 0;
    const nameLower = chosen.name.toLowerCase();
    for (const [mName, score] of Object.entries(muscleLoads)) {
      if (nameLower.includes(mName.toLowerCase()) || mName.toLowerCase().includes(nameLower)) {
        return score;
      }
    }
    return 0;
  }, [chosen, muscleLoads]);

  return (
    <main className={`studio ${className}`}>
      {atlas && (
        <AnatomyScene
          atlas={atlas}
          state={{ ...state, inspectorOpen: details && selectedParts.length > 0 }}
          onSelect={choosePart}
          onProgress={(n) => {
            setProgress(n);
            if (n === 100) setError('');
          }}
          onError={(msg) => {
            setError(msg);
            if (onError) onError(msg);
          }}
          isDark={isDark}
        />
      )}

      <div className="vignette" />

      {/* Identity watermark */}
      <header className="identity">
        <div className="eyebrow">
          <span className="status-dot" /> INFINITY TKD 2.0 ANATOMY ATLAS
        </div>
        <h1>
          Human Atlas <span className="edition">3D</span>
        </h1>
        <div className="identity-meta">
          {atlas ? atlas.parts.length.toLocaleString() : '2,234'} modeled anatomical pieces <span>·</span> BodyParts3D
        </div>
      </header>

      {/* Top search and about buttons */}
      <nav className="top-actions" aria-label="Explorer controls">
        <button
          type="button"
          onClick={() => openPanel('search')}
          aria-label="Search named anatomical structures"
          title="Search named structures (/)"
        >
          <Search size={14} />
          <span>Find structure</span>
          <kbd>/</kbd>
        </button>
        <button
          type="button"
          onClick={() => {
            setDetails(false);
            setPanel(null);
            setAbout(true);
          }}
          aria-label="About this 3D atlas"
          title="Atlas Source & Attribution"
        >
          <Info size={14} />
        </button>
      </nav>

      {/* 15 Systems Layer Panel */}
      <section
        className={`layers-panel glass ${panel === 'layers' ? 'mobile-open' : ''}`}
        aria-label="Anatomical Systems"
        style={{ display: panel === 'layers' || !compact ? undefined : 'none' }}
      >
        <div className="panel-heading">
          <span>Systems ({activeSystems.length})</span>
          {compact && (
            <button type="button" onClick={() => setPanel(null)} className="text-xs text-neutral-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Layer Presets */}
        <div className="layer-presets">
          <button
            type="button"
            aria-pressed={activeSystems.every((x) => state.visible.includes(x.id))}
            onClick={() => setState((s) => ({ ...s, selected: [], isolate: false, visible: activeSystems.map((x) => x.id) }))}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={state.visible.length === 1 && state.visible[0] === 'muscular'}
            onClick={() => setState((s) => ({ ...s, selected: [], isolate: false, visible: ['muscular'] }))}
          >
            Muscles
          </button>
          <button
            type="button"
            aria-pressed={state.visible.length === 1 && state.visible[0] === 'skeletal'}
            onClick={() => setState((s) => ({ ...s, selected: [], isolate: false, visible: ['skeletal'] }))}
          >
            Bones
          </button>
          <button
            type="button"
            aria-pressed={
              state.visible.length === 6 &&
              ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'].every((id) =>
                state.visible.includes(id as SystemId)
              )
            }
            onClick={() =>
              setState((s) => ({
                ...s,
                selected: [],
                isolate: false,
                visible: ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'],
              }))
            }
          >
            Organs
          </button>
        </div>

        {/* System rows */}
        <div className="system-list">
          {activeSystems.map((s) => {
            const isVisible = state.visible.includes(s.id);
            return (
              <div className={`system-row ${isVisible ? 'enabled' : ''}`} key={s.id}>
                <button
                  type="button"
                  className="system-name"
                  title={`Isolate ${s.name}`}
                  onClick={() => setState((v) => ({ ...v, visible: [s.id], isolate: false, selected: [] }))}
                >
                  <span className="system-dot" style={{ background: s.color }} />
                  {s.name}
                  <span className="system-count">{counts[s.id]}</span>
                </button>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggleSystem(s.id)}
                  aria-label={`Toggle ${s.name}`}
                  className="accent-[#EF2F38] cursor-pointer"
                />
              </div>
            );
          })}
        </div>

        <div className="panel-foot">
          <span>{visibleCount.toLocaleString()} pieces visible</span>
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, visible: [], selected: [], isolate: false }))}
          >
            Hide all
          </button>
        </div>
      </section>

      {/* Search Panel */}
      {panel === 'search' && (
        <section className="search-panel glass" aria-label="Search anatomical concepts">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Find a structure
            </span>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <input
            type="text"
            autoFocus
            placeholder="Search Biceps, Femur, Pectoralis, FMA..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input-box"
          />
          <div className="search-results-list">
            {results.length === 0 ? (
              <div className="p-4 text-xs text-neutral-400 text-center">No structures match your search.</div>
            ) : (
              results.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="search-item"
                  onClick={() => choose(c)}
                >
                  <span className="capitalize font-medium">{c.name}</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {c.elements.length} {c.elements.length === 1 ? 'part' : 'parts'}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {/* Camera angle & Reset Controls */}
      <nav className="view-controls glass" aria-label="Camera controls">
        {(['three-quarter', 'front', 'side', 'back'] as View[]).map((v, i) => (
          <button
            type="button"
            key={v}
            className={state.view === v ? 'active' : ''}
            disabled={state.explode > 0.8 && v !== 'front'}
            onClick={() => setState((s) => ({ ...s, view: v, reset: s.reset + 1, rotate: false }))}
            title={`${v} camera angle`}
          >
            {['¾', 'F', 'S', 'B'][i]}
          </button>
        ))}
        <i />
        <button
          type="button"
          disabled={state.explode >= 0.4}
          className={state.rotate ? 'active' : ''}
          onClick={() => setState((s) => ({ ...s, rotate: !s.rotate }))}
          title={state.rotate ? 'Pause rotation' : 'Auto-rotate'}
        >
          {state.rotate ? <Pause size={14} /> : <RotateCw size={14} />}
        </button>
        <button type="button" onClick={reset} title="Reset view and systems">
          <RotateCcw size={14} />
        </button>
      </nav>

      {/* Center scene caption */}
      <div className="scene-caption">
        <span className="caption-line" />
        <span>
          {state.isolate
            ? chosen?.name ?? 'SELECTED STRUCTURE'
            : state.explode > 0.95
            ? 'EXPLODED INVENTORY'
            : state.explode > 0.05
            ? 'SEPARATED ANATOMY'
            : 'ADULT MALE · BODYPARTS3D'}
        </span>
        <span className="caption-line" />
      </div>

      {/* Bottom Explode Dock */}
      <div className="bottom-dock glass">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 font-semibold"
          onClick={() => openPanel('layers')}
          title="Toggle Layers Panel"
        >
          <Layers size={16} />
          <span>Layers</span>
        </button>

        <div className="explode-control">
          <div className="explode-label">
            <span>Explode Anatomy</span>
            <output>{Math.round(state.explode * 100)}%</output>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(state.explode * 100)}
            onChange={(e) => {
              const val = parseFloat(e.target.value) / 100;
              setState((s) => ({
                ...s,
                explode: val,
                view: val > 0.8 ? 'front' : s.view,
                rotate: false,
              }));
            }}
            className="w-full accent-[#EF2F38] cursor-pointer"
          />
          <div className="slider-endpoints">
            <span>Assembled</span>
            <span>Every Piece</span>
          </div>
        </div>

        <button type="button" className="dock-reset" onClick={reset}>
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>

      {/* Detail Slide-Over Sheet */}
      {details && selectedParts.length > 0 && (
        <section className={`detail-sheet glass ${state.isolate ? 'is-isolated' : ''}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="detail-accent" style={{ background: system?.color ?? '#EF2F38' }} />
              <span className="eyebrow mt-1">{system?.name ?? 'ANATOMY'}</span>
              <h2 ref={detailTitle} className="structure-title mt-1">
                {chosen?.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setDetails(false)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Active Muscular Load Badge if tagged in Curriculum/Student */}
          {activeLoadScore > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-mono">
              <span className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
                <Flame size={14} /> ACTIVE LOAD
              </span>
              <span className="font-bold text-red-600 dark:text-red-400">
                {activeLoadScore.toFixed(1)} / {maxLoad.toFixed(1)}
              </span>
            </div>
          )}

          <p className="structure-description">
            {chosen && selected ? explanation(chosen.name, selected.system) : ''}
          </p>

          <div className="structure-meta">
            <div>
              <span>Atlas Concept</span>
              <strong>{chosen?.id}</strong>
            </div>
            <div>
              <span>Modeled Meshes</span>
              <strong>{state.selected.length.toLocaleString()}</strong>
            </div>
          </div>

          {selectedParts.length > 1 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Included Meshes ({selectedParts.length})
              </span>
              {selectedParts.slice(0, 30).map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => choosePart(p.id)}
                  className="w-full flex items-center justify-between text-left text-xs py-1 px-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className="truncate">{p.name}</span>
                  <ChevronRight size={12} className="text-neutral-400" />
                </button>
              ))}
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              className={`primary-action ${state.isolate ? 'active' : ''}`}
              onClick={() => setState((s) => ({ ...s, isolate: !s.isolate, explode: 0 }))}
            >
              <Focus size={15} />
              <span>{state.isolate ? 'Show Surrounding Anatomy' : 'Isolate Structure'}</span>
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setState((s) => ({ ...s, selected: [], isolate: false }));
                setDetails(false);
                if (onSelectMuscle) onSelectMuscle(null);
              }}
            >
              Clear Selection
            </button>
          </div>
        </section>
      )}

      {/* About Modal */}
      {about && (
        <section className="detail-sheet glass" style={{ right: 20, zIndex: 60, width: 340, maxWidth: 340 }}>
          <div className="flex items-start justify-between">
            <div>
              <span className="eyebrow">SOURCE & SCOPE</span>
              <h2 className="structure-title mt-1">BodyParts3D Atlas</h2>
            </div>
            <button
              type="button"
              onClick={() => setAbout(false)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <p className="structure-description">
            Adult male reference anatomy featuring <strong>2,234 individually selectable meshes</strong>, 15
            anatomical systems, and <strong>3,432 named concepts</strong>.
          </p>
          <div className="text-xs text-neutral-500 space-y-2 leading-relaxed">
            <p>
              Geometry is merged into batches with per-structure GPU data textures controlling translation and
              selection highlights.
            </p>
            <p className="font-semibold text-neutral-700 dark:text-neutral-300">
              Licensed under CC Attribution 4.0 International © The Database Center for Life Science.
            </p>
          </div>
          <a
            href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#EF2F38] hover:underline flex items-center gap-1 mt-2 font-medium"
          >
            <span>View Dataset License</span>
            <ArrowUpRight size={12} />
          </a>
        </section>
      )}

      {/* Loading overlay */}
      {progress < 100 && !error && (
        <div className="loading-overlay glass">
          <Activity size={20} className="text-[#EF2F38] animate-pulse" />
          <div>
            <strong className="text-xs font-bold uppercase tracking-wider">Loading 3D Anatomy Atlas</strong>
            <span className="block text-[11px] text-neutral-500 font-mono mt-0.5">
              {progress}% · {atlas?.parts.length.toLocaleString() ?? '2,234'} pieces
            </span>
            <div className="loading-track">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="loading-overlay glass border-red-500/40">
          <div className="text-xs text-red-500 text-center space-y-2 p-4 max-w-sm">
            <p className="font-bold">{error}</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              {onFallbackTo2D && (
                <button
                  type="button"
                  onClick={onFallbackTo2D}
                  className="px-3 py-1.5 bg-[#EF2F38] text-white rounded-[6px] font-bold text-xs cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
                >
                  Switch to 2D Scanner
                </button>
              )}
              <button
                type="button"
                onClick={() => location.reload()}
                className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-[6px] font-bold text-xs cursor-pointer shadow-sm hover:opacity-90"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
