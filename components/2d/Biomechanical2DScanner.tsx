'use client';

import React, { useState, useEffect, useId } from 'react';
import { useAnatomyStore, AnatomicalGender } from '@/lib/useAnatomyStore';
import { ANATOMY_DATABASE } from '@/lib/anatomyData';
import { Activity, Flame, ShieldAlert, Sparkles, User, Zap, Crosshair, Eye, Compass, Layers, Check } from 'lucide-react';

interface Biomechanical2DScannerProps {
  muscleLoads?: Record<string, number>;
  maxLoad?: number;
  gender?: AnatomicalGender;
  scale?: number;
  interactive?: boolean;
  onSelectMuscle?: (name: string) => void;
  onHoverMuscle?: (muscle: { name: string; score: number } | null) => void;
  className?: string;
  showControls?: boolean;
}

// Taekwondo Biomechanical Movement Chains with Comprehensive Muscular Recruitment
const TKD_KINETIC_CHAINS: Record<string, { label: string; loads: Record<string, number> }> = {
  ap_chagi: {
    label: 'Ap Chagi (Front Snap)',
    loads: {
      'Quadriceps': 0.96,
      'Hip Flexors': 0.90,
      'Adductors (Inner Thighs)': 0.65,
      'Tibialis Anterior': 0.86,
      'Calves': 0.70,
      'Abs (Rectus Abdominis)': 0.62,
      'Patellar Tendon': 0.92,
      'Glutes': 0.40,
    },
  },
  dollyo_chagi: {
    label: 'Dollyo Chagi (Roundhouse)',
    loads: {
      'Quadriceps': 0.94,
      'Obliques': 0.90,
      'Glutes': 0.88,
      'Adductors (Inner Thighs)': 0.82,
      'Calves': 0.85,
      'Hip Flexors': 0.75,
      'Serratus Anterior': 0.65,
      'Rotator Cuff Tendons': 0.55,
      'Lower Back': 0.65,
      'Achilles Tendon': 0.90,
    },
  },
  yop_chagi: {
    label: 'Yop Chagi (Side Thrust)',
    loads: {
      'Glutes': 1.00,
      'Obliques': 0.88,
      'Hamstrings': 0.84,
      'Quadriceps': 0.78,
      'Adductors (Inner Thighs)': 0.72,
      'Calves': 0.75,
      'Lower Back': 0.72,
      'Achilles Tendon': 0.85,
    },
  },
  dwit_chagi: {
    label: 'Dwit Chagi (Back Kick)',
    loads: {
      'Hamstrings': 0.98,
      'Glutes': 0.96,
      'Lower Back': 0.88,
      'Calves': 0.76,
      'Achilles Tendon': 0.88,
      'Back (Lats)': 0.55,
    },
  },
  momtong_jireugi: {
    label: 'Momtong Jireugi (Torso Punch)',
    loads: {
      'Chest (Pectorals)': 0.92,
      'Serratus Anterior': 0.95,
      'Shoulders (Deltoids)': 0.88,
      'Triceps': 0.85,
      'Forearms': 0.82,
      'Back (Lats)': 0.78,
      'Rotator Cuff Tendons': 0.75,
      'Obliques': 0.70,
    },
  },
};

export function Biomechanical2DScanner({
  muscleLoads: propLoads,
  maxLoad = 1.0,
  gender: propGender,
  scale = 1.0,
  interactive = true,
  onSelectMuscle,
  onHoverMuscle,
  className = '',
  showControls = false,
}: Biomechanical2DScannerProps) {
  const store = useAnatomyStore();
  const uid = useId().replace(/:/g, '_');

  // Reactive Dark Mode Detection for guaranteed color contrast
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const currentGender = propGender || store.gender;
  const isFemale = currentGender === 'Female';

  // Active view angle toggle: 'both' | 'anterior' | 'posterior'
  const [viewAngle, setViewAngle] = useState<'both' | 'anterior' | 'posterior'>('both');
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Active load computation (merging manual propLoads with active preset if selected)
  const currentPresetLoads = activePreset ? TKD_KINETIC_CHAINS[activePreset]?.loads : null;
  const effectiveLoads = currentPresetLoads || propLoads || store.muscleLoads;

  const [hoveredPart, setHoveredPart] = useState<{
    name: string;
    load: number;
    x: number;
    y: number;
  } | null>(null);

  const [showHudOverlay, setShowHudOverlay] = useState(true);

  const selectedMuscle = store.selectedMuscle;
  const heatmapMode = store.heatmapMode;
  const telemetry = store.studentTelemetry;

  // Resolve dynamic colors and gradients based on theme and muscle load
  const getStyleForMuscle = (muscleName: string) => {
    const isSelected = selectedMuscle === muscleName;
    const isHovered = hoveredPart?.name === muscleName;
    const hasSelection = selectedMuscle !== null;

    let fill = isDarkMode ? `url(#${uid}-muscle-resting-dark)` : `url(#${uid}-muscle-resting-light)`;
    let stroke = isDarkMode ? '#475569' : '#64748b';
    let strokeWidth = 1.2;
    let opacity = 0.94;
    let filter = undefined;

    if (hasSelection && !isSelected) {
      opacity = isDarkMode ? 0.35 : 0.3;
    }

    if (heatmapMode === 'status') {
      const telem = telemetry[muscleName];
      if (telem) {
        if (telem.status === 'optimal') {
          fill = `url(#${uid}-status-optimal)`;
          stroke = '#10b981';
          opacity = 0.98;
        } else if (telem.status === 'fatigued') {
          fill = `url(#${uid}-status-fatigued)`;
          stroke = '#f59e0b';
          opacity = 0.98;
        } else if (telem.status === 'injured') {
          fill = `url(#${uid}-status-injured)`;
          stroke = '#ef4444';
          opacity = 1.0;
          filter = `url(#${uid}-kinetic-glow)`;
        } else if (telem.status === 'target') {
          fill = `url(#${uid}-status-target)`;
          stroke = '#06b6d4';
          opacity = 0.98;
        }
      }
    } else {
      // Kinetic Load Heatmap Mode
      const load = effectiveLoads[muscleName] || 0;
      const ratio = maxLoad > 0 ? Math.min(1.0, load / maxLoad) : 0;

      if (ratio >= 0.7) {
        fill = `url(#${uid}-kinetic-high)`;
        stroke = isDarkMode ? '#EF2F38' : '#b91c1c';
        opacity = 1.0;
        filter = `url(#${uid}-kinetic-glow)`;
      } else if (ratio >= 0.35) {
        fill = `url(#${uid}-kinetic-mid)`;
        stroke = isDarkMode ? '#ea580c' : '#c2410c';
        opacity = 0.96;
      } else if (ratio > 0.05) {
        fill = `url(#${uid}-kinetic-low)`;
        stroke = isDarkMode ? '#d97706' : '#b45309';
        opacity = 0.94;
      } else {
        fill = isDarkMode ? `url(#${uid}-muscle-resting-dark)` : `url(#${uid}-muscle-resting-light)`;
        stroke = isDarkMode ? '#475569' : '#64748b';
      }
    }

    if (isSelected) {
      stroke = '#EF2F38';
      strokeWidth = 2.4;
      opacity = 1.0;
      filter = `url(#${uid}-selection-glow)`;
    } else if (isHovered) {
      stroke = isDarkMode ? '#f87171' : '#dc2626';
      strokeWidth = 2.0;
      opacity = 1.0;
      filter = `url(#${uid}-hover-glow)`;
    }

    return {
      fill,
      stroke,
      strokeWidth,
      opacity,
      filter,
      cursor: interactive ? 'pointer' : 'default',
      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
    };
  };

  const handlePointerEnter = (name: string, e: React.MouseEvent) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const load = effectiveLoads[name] || 0;
    setHoveredPart({
      name,
      load,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    store.setHoveredMuscle(name);
    if (onHoverMuscle) onHoverMuscle({ name, score: load });
  };

  const handlePointerLeave = () => {
    if (!interactive) return;
    setHoveredPart(null);
    store.setHoveredMuscle(null);
    if (onHoverMuscle) onHoverMuscle(null);
  };

  const handleClick = (name: string) => {
    if (!interactive) return;
    store.setSelectedMuscle(name);
    if (onSelectMuscle) onSelectMuscle(name);
  };

  // Base dimension scaling
  const effectiveScale = viewAngle === 'both' ? scale : scale * 1.25;
  const width = 180 * effectiveScale;
  const height = 330 * effectiveScale;

  // Active muscle database telemetry lookup
  const hoveredDb = hoveredPart ? ANATOMY_DATABASE[hoveredPart.name] : null;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* SVG Defs for High-Contrast Shading, Striations, and Glow */}
      <svg width="0" height="0" className="absolute w-0 h-0 pointer-events-none">
        <defs>
          {/* Subtle Anatomical Muscle Striation Pattern */}
          <pattern id={`${uid}-striation`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke={isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'}
              strokeWidth="1"
            />
          </pattern>

          {/* Biomechanical Precision HUD Grid Pattern */}
          <pattern id={`${uid}-hud-grid`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path
              d="M 16 0 L 0 0 0 16"
              fill="none"
              stroke={isDarkMode ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.18)'}
              strokeWidth="0.6"
            />
          </pattern>

          {/* 1. RESTING MUSCLE GRADIENTS */}
          {/* Dark Mode: Volumetric Deep Metallic Slate */}
          <radialGradient id={`${uid}-muscle-resting-dark`} cx="50%" cy="38%" r="68%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="55%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>

          {/* Light Mode: Volumetric Crisp Medical Slate with 4.5:1+ contrast against white chassis */}
          <radialGradient id={`${uid}-muscle-resting-light`} cx="50%" cy="38%" r="68%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="55%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>

          {/* 2. KINETIC LOAD GRADIENTS (CALIBRATED FOR DUAL CONTRAST) */}
          {/* Low Kinetic Load (Amber Flare) */}
          <radialGradient id={`${uid}-kinetic-low`} cx="45%" cy="35%" r="70%">
            <stop offset="0%" stopColor={isDarkMode ? '#fef08a' : '#fde047'} />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor={isDarkMode ? '#b45309' : '#92400e'} />
          </radialGradient>

          {/* Mid Kinetic Load (Combustion Orange) */}
          <radialGradient id={`${uid}-kinetic-mid`} cx="45%" cy="35%" r="70%">
            <stop offset="0%" stopColor={isDarkMode ? '#ffedd5' : '#fed7aa'} />
            <stop offset="40%" stopColor="#fb923c" />
            <stop offset="80%" stopColor="#ea580c" />
            <stop offset="100%" stopColor={isDarkMode ? '#9a3412' : '#7c2d12'} />
          </radialGradient>

          {/* High Kinetic Load (Infinity Supercharged Red) */}
          <radialGradient id={`${uid}-kinetic-high`} cx="45%" cy="30%" r="75%">
            <stop offset="0%" stopColor={isDarkMode ? '#fee2e2' : '#fca5a5'} />
            <stop offset="25%" stopColor="#f87171" />
            <stop offset="65%" stopColor="#EF2F38" />
            <stop offset="100%" stopColor={isDarkMode ? '#7f1d1d' : '#991b1b'} />
          </radialGradient>

          {/* 3. TELEMETRY STATUS GRADIENTS */}
          <radialGradient id={`${uid}-status-optimal`} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor={isDarkMode ? '#a7f3d0' : '#6ee7b7'} />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor={isDarkMode ? '#065f46' : '#047857'} />
          </radialGradient>
          <radialGradient id={`${uid}-status-fatigued`} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#78350f" />
          </radialGradient>
          <radialGradient id={`${uid}-status-injured`} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fecaca" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>
          <radialGradient id={`${uid}-status-target`} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#155e75" />
          </radialGradient>

          {/* 4. SKELETAL & BONE GRADIENTS */}
          <radialGradient id={`${uid}-bone`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor={isDarkMode ? '#f1f5f9' : '#e2e8f0'} />
            <stop offset="100%" stopColor={isDarkMode ? '#cbd5e1' : '#94a3b8'} />
          </radialGradient>

          {/* 5. VOLUMETRIC GLOW FILTERS */}
          <filter id={`${uid}-kinetic-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values={isDarkMode ? '1 0 0 0 0.93  0 0.2 0 0 0.18  0 0 0.2 0 0.22  0 0 0 1.4 0' : '1 0 0 0 0.8  0 0.1 0 0 0.1  0 0 0.1 0 0.1  0 0 0 1.2 0'}
              result="coloredBlur"
            />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={`${uid}-selection-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={`${uid}-hover-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Ambient Floor Shadow */}
          <radialGradient id={`${uid}-pedestal-shadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.18)'} />
            <stop offset="60%" stopColor={isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.06)'} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
      </svg>

      {/* Control Toolbar: Gender, Angle Switcher, and Taekwondo Kinetic Presets */}
      {showControls && (
        <div className="flex flex-col gap-2 w-full mb-3 px-3 py-2 bg-neutral-100 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 rounded-[8px]">
          {/* Top Bar: Athlete Gender & View Angle Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Gender Toggle */}
            <div className="flex items-center gap-1 bg-white dark:bg-neutral-800 p-0.5 rounded-[8px] text-[10px] font-mono font-bold border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => store.setGender('Male')}
                className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                  !isFemale
                    ? 'bg-[#EF2F38] text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                MALE ATHLETE
              </button>
              <button
                type="button"
                onClick={() => store.setGender('Female')}
                className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                  isFemale
                    ? 'bg-[#EF2F38] text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                FEMALE ATHLETE
              </button>
            </div>

            {/* View Angle Switcher (Both / Anterior / Posterior) */}
            <div className="flex items-center gap-1 bg-white dark:bg-neutral-800 p-0.5 rounded-[8px] text-[10px] font-mono font-bold border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setViewAngle('both')}
                className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                  viewAngle === 'both'
                    ? 'bg-neutral-900 dark:bg-neutral-700 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                DUAL
              </button>
              <button
                type="button"
                onClick={() => setViewAngle('anterior')}
                className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                  viewAngle === 'anterior'
                    ? 'bg-neutral-900 dark:bg-neutral-700 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                FRONT
              </button>
              <button
                type="button"
                onClick={() => setViewAngle('posterior')}
                className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                  viewAngle === 'posterior'
                    ? 'bg-neutral-900 dark:bg-neutral-700 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                BACK
              </button>
            </div>

            {/* HUD Reticle Toggle */}
            <button
              type="button"
              onClick={() => setShowHudOverlay(!showHudOverlay)}
              className={`flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-1 rounded-[6px] border transition-all cursor-pointer ${
                showHudOverlay
                  ? 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
              title="Toggle Biomechanical HUD Overlays"
            >
              <Crosshair size={11} className={showHudOverlay ? 'text-[#EF2F38]' : ''} />
              <span>HUD RETICLE</span>
            </button>
          </div>

          {/* Bottom Bar: Taekwondo Kinetic Chain Simulations */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-neutral-200 dark:border-neutral-800 text-[9px] font-mono">
            <span className="text-neutral-500 dark:text-neutral-400 font-bold flex items-center gap-1">
              <Zap size={10} className="text-[#EF2F38]" /> KINETIC RECRUITMENT:
            </span>
            <button
              type="button"
              onClick={() => setActivePreset(null)}
              className={`px-2 py-0.5 rounded-[6px] border transition-all cursor-pointer ${
                activePreset === null
                  ? 'border-[#EF2F38] bg-[#EF2F38]/10 text-[#EF2F38] font-bold'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Live Heatmap
            </button>
            {Object.entries(TKD_KINETIC_CHAINS).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivePreset(key)}
                className={`px-2 py-0.5 rounded-[6px] border transition-all cursor-pointer ${
                  activePreset === key
                    ? 'border-[#EF2F38] bg-[#EF2F38] text-white font-bold shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dual Scanner Viewport (Anterior & Posterior) */}
      <div className="flex flex-wrap justify-around items-center w-full gap-4 sm:gap-6">
        {/* ============================================================ */}
        {/* 1. ANTERIOR VIEW (DETAILED FRONTAL ANATOMY)                  */}
        {/* ============================================================ */}
        {(viewAngle === 'both' || viewAngle === 'anterior') && (
          <div className="flex flex-col items-center relative group">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#EF2F38] shadow-[0_0_8px_#EF2F38] animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-widest">
                ANTERIOR · FRONTAL CHAIN
              </span>
            </div>

            {/* High-Contrast Anatomical Display Plate */}
            <div className="relative rounded-[8px] bg-white dark:bg-[#0B0D11]/95 border border-slate-200 dark:border-neutral-800 shadow-sm dark:shadow-2xl p-2 transition-colors">
              <svg
                width={width}
                height={height}
                viewBox="0 0 180 330"
                className="overflow-visible drop-shadow-xs transition-transform duration-200"
              >
                {/* Biomechanical HUD Grid Backdrop */}
                {showHudOverlay && (
                  <rect x="0" y="0" width="180" height="330" fill={`url(#${uid}-hud-grid)`} opacity="0.75" pointerEvents="none" />
                )}

                {/* Pedestal Volumetric Ambient Shadow */}
                <ellipse cx="90" cy="322" rx="55" ry="7" fill={`url(#${uid}-pedestal-shadow)`} />

                {/* ======================================================== */}
                {/* ANATOMICAL BASE SILHOUETTE (ATHLETIC CHASSIS)            */}
                {/* ======================================================== */}
                <path
                  d={
                    isFemale
                      ? "M 90,14 C 103,14 105,25 104,36 C 103,45 98,49 95,53 C 101,56 112,59 124,63 C 133,66 137,74 133,90 C 130,103 128,118 129,130 C 131,142 139,158 136,174 C 134,185 128,189 123,187 C 120,185 122,172 121,163 C 120,150 113,132 113,121 C 111,104 110,95 106,93 C 105,106 106,122 105,135 C 104,148 116,163 118,183 C 120,203 118,216 115,225 C 113,231 116,245 119,259 C 122,274 118,290 116,301 C 114,309 117,314 121,316 C 123,317 123,319 119,319 C 109,319 104,318 102,312 C 100,305 102,293 103,281 C 104,266 100,247 98,235 C 96,225 96,220 96,214 C 96,200 94,180 90,169 C 86,180 84,200 84,214 C 84,220 84,225 82,235 C 80,247 76,266 77,281 C 78,293 80,305 78,312 C 76,318 71,319 61,319 C 57,319 57,317 59,316 C 63,314 66,309 64,301 C 62,290 58,274 61,259 C 64,245 67,231 65,225 C 62,216 60,203 62,183 C 64,163 76,148 75,135 C 74,122 75,106 74,93 C 70,95 69,104 67,121 C 67,132 60,150 59,163 C 58,172 60,185 57,187 C 52,189 46,185 44,174 C 41,158 49,142 51,130 C 52,118 50,103 47,90 C 43,74 47,66 56,63 C 68,59 79,56 85,53 C 82,49 77,45 76,36 C 75,25 77,14 90,14 Z"
                      : "M 90,12 C 104,12 107,24 106,36 C 105,46 100,50 96,54 C 103,57 115,60 128,64 C 138,67 142,75 137,92 C 134,106 132,121 133,134 C 135,147 144,163 140,180 C 138,191 132,195 127,193 C 123,191 125,178 124,168 C 123,155 115,135 115,123 C 113,105 112,96 108,94 C 107,107 108,124 107,138 C 105,150 115,164 117,184 C 119,204 117,217 114,226 C 112,232 115,246 118,260 C 121,275 117,291 115,302 C 113,310 117,315 121,317 C 123,318 123,320 119,320 C 109,320 104,319 102,313 C 100,306 102,294 103,282 C 104,267 100,248 98,236 C 96,226 96,221 96,215 C 96,201 94,180 90,168 C 86,180 84,201 84,215 C 84,221 84,226 82,236 C 80,248 76,267 77,282 C 78,294 80,306 78,313 C 76,319 71,320 61,320 C 57,320 57,318 59,317 C 63,315 67,310 65,302 C 63,291 59,275 62,260 C 65,246 68,232 66,226 C 63,217 61,204 63,184 C 65,164 75,150 73,138 C 72,124 73,107 72,94 C 68,96 67,105 65,123 C 65,135 57,155 56,168 C 55,178 57,191 53,193 C 48,195 42,191 40,180 C 36,163 45,147 47,134 C 48,121 46,106 43,92 C 38,75 42,67 52,64 C 65,60 77,57 84,54 C 80,50 75,46 74,36 C 73,24 76,12 90,12 Z"
                  }
                  fill={isDarkMode ? '#0d1527' : '#f1f5f9'}
                  stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                  strokeWidth="1.2"
                  opacity={isDarkMode ? 0.95 : 1.0}
                />

                {/* Cranium / Head with Facial Proportions */}
                <g
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  onClick={() => handleClick('Skeletal System')}
                >
                  <path
                    d="M 90,14 C 98,14 105,19 105,28 C 105,38 100,45 96,50 C 93,53 91,54 90,54 C 89,54 87,53 84,50 C 80,45 75,38 75,28 C 75,19 82,14 90,14 Z"
                    fill={`url(#${uid}-bone)`}
                    stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                    strokeWidth="1"
                  />
                  {/* Facial T-Zone Indicator lines */}
                  <line
                    x1="90"
                    y1="24"
                    x2="90"
                    y2="44"
                    stroke={isDarkMode ? '#cbd5e1' : '#94a3b8'}
                    strokeWidth="0.8"
                    opacity="0.6"
                  />
                  <line
                    x1="83"
                    y1="32"
                    x2="97"
                    y2="32"
                    stroke={isDarkMode ? '#cbd5e1' : '#94a3b8'}
                    strokeWidth="0.8"
                    opacity="0.6"
                  />
                </g>

                {/* 1. Anterior Trapezius / Sternocleidomastoid (Neck Columns) */}
                <g
                  {...getStyleForMuscle('Trapezius')}
                  onMouseEnter={(e) => handlePointerEnter('Trapezius', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Trapezius')}
                >
                  {/* Sternocleidomastoid & Superior Trapezius */}
                  <path d="M 83,48 C 82,54 77,58 71,62 L 79,62 C 83,60 85,55 86,48 Z" />
                  <path d="M 97,48 C 98,54 103,58 109,62 L 101,62 C 97,60 95,55 94,48 Z" />
                </g>

                {/* Clavicles (Bony Struts) */}
                <path
                  d="M 90,62 C 82,60 74,62 65,63 M 90,62 C 98,60 106,62 115,63"
                  stroke={isDarkMode ? '#f8fafc' : '#475569'}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                  opacity={isDarkMode ? 0.95 : 0.85}
                />

                {/* 2. Deltoids (Shoulders: Anterior Head & Lateral Acromial Head) */}
                <g
                  {...getStyleForMuscle('Shoulders (Deltoids)')}
                  onMouseEnter={(e) => handlePointerEnter('Shoulders (Deltoids)', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Shoulders (Deltoids)')}
                >
                  {/* Left Anterior Deltoid (Front rounded head) */}
                  <path d="M 71,63 C 64,63 56,66 53,74 C 51,80 54,88 58,93 C 60,86 63,77 70,64 Z" />
                  {/* Left Lateral Deltoid (Shoulder width sweep) */}
                  <path d="M 53,74 C 47,76 45,82 48,88 C 51,93 54,94 58,93 C 54,88 51,80 53,74 Z" />

                  {/* Right Anterior Deltoid */}
                  <path d="M 109,63 C 116,63 124,66 127,74 C 129,80 126,88 122,93 C 120,86 117,77 110,64 Z" />
                  {/* Right Lateral Deltoid */}
                  <path d="M 127,74 C 133,76 135,82 132,88 C 129,93 126,94 122,93 C 126,88 129,80 127,74 Z" />
                </g>

                {/* Specular Highlight Ridges on Deltoids */}
                <path
                  d="M 66,66 C 58,68 53,74 52,82 M 114,66 C 122,68 127,74 128,82"
                  fill="none"
                  stroke={isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.6)'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  pointerEvents="none"
                />

                {/* 3. Pectoralis Major (Chest: Clavicular Head & Sternocostal Head) */}
                <g
                  {...getStyleForMuscle('Chest (Pectorals)')}
                  onMouseEnter={(e) => handlePointerEnter('Chest (Pectorals)', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Chest (Pectorals)')}
                >
                  {/* Left Clavicular Head (Upper Incline Chest) */}
                  <path d="M 88,64 L 72,64 C 66,65 62,69 60,75 C 65,76 78,76 88,77 Z" />
                  {/* Left Sternocostal Head (Lower Mid Chest) */}
                  <path d="M 88,77 C 78,76 65,76 60,75 C 58,82 61,89 69,93 C 78,96 86,94 88,91 Z" />

                  {/* Right Clavicular Head (Upper Incline Chest) */}
                  <path d="M 92,64 L 108,64 C 114,65 118,69 120,75 C 115,76 102,76 92,77 Z" />
                  {/* Right Sternocostal Head (Lower Mid Chest) */}
                  <path d="M 92,77 C 102,76 115,76 120,75 C 122,82 119,89 111,93 C 102,96 94,94 92,91 Z" />
                </g>

                {/* Specular Curves on Pectorals */}
                <path
                  d="M 84,68 C 76,68 66,74 65,80 M 96,68 C 104,68 114,74 115,80"
                  fill="none"
                  stroke={isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.55)'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  pointerEvents="none"
                />

                {/* Sternal Midline Groove (Linea Medianus) */}
                <line
                  x1="90"
                  y1="64"
                  x2="90"
                  y2="92"
                  stroke={isDarkMode ? '#0f172a' : '#64748b'}
                  strokeWidth="1.2"
                  opacity={isDarkMode ? 0.7 : 0.8}
                />

                {/* 4. Serratus Anterior ("The Boxer's Muscle" - Interlocking Rib Digitations) */}
                <g
                  {...getStyleForMuscle('Serratus Anterior')}
                  onMouseEnter={(e) => handlePointerEnter('Serratus Anterior', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Serratus Anterior')}
                >
                  {/* Left Serratus Digitations (Ribs 5, 6, 7) */}
                  <path d="M 64,88 L 68,90 L 64,93 Z M 62,94 L 67,96 L 62,99 Z M 61,100 L 66,102 L 61,105 Z" />
                  {/* Right Serratus Digitations */}
                  <path d="M 116,88 L 112,90 L 116,93 Z M 118,94 L 113,96 L 118,99 Z M 119,100 L 114,102 L 119,105 Z" />
                </g>

                {/* 5. Biceps Brachii (Long & Short Heads) and Brachialis */}
                <g
                  {...getStyleForMuscle('Biceps')}
                  onMouseEnter={(e) => handlePointerEnter('Biceps', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Biceps')}
                >
                  {/* Left Biceps Long Head & Short Head */}
                  <path d="M 54,95 C 50,100 49,110 51,122 C 54,124 57,123 58,119 C 60,110 60,101 56,95 Z" />
                  {/* Left Brachialis (Lateral arm flexor) */}
                  <path d="M 48,105 C 46,112 47,120 50,124 C 49,118 48,111 48,105 Z" />

                  {/* Right Biceps Long Head & Short Head */}
                  <path d="M 126,95 C 130,100 131,110 129,122 C 126,124 123,123 122,119 C 120,110 120,101 124,95 Z" />
                  {/* Right Brachialis */}
                  <path d="M 132,105 C 134,112 133,120 130,124 C 131,118 132,111 132,105 Z" />
                </g>

                {/* 6. Forearms (Brachioradialis & Wrist Flexor Complex) */}
                <g
                  {...getStyleForMuscle('Forearms')}
                  onMouseEnter={(e) => handlePointerEnter('Forearms', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Forearms')}
                >
                  {/* Left Forearm: Brachioradialis Lateral Bulge */}
                  <path d="M 49,126 C 43,132 42,142 45,154 C 47,166 49,173 52,174 C 55,174 57,165 57,152 C 58,138 57,128 54,126 Z" />
                  {/* Right Forearm */}
                  <path d="M 131,126 C 137,132 138,142 135,154 C 133,166 131,173 128,174 C 125,174 123,165 123,152 C 122,138 123,128 126,126 Z" />
                </g>

                {/* Athletic Hands / Guard Position */}
                <ellipse
                  cx="49"
                  cy="184"
                  rx="5"
                  ry="9"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="0.8"
                />
                <ellipse
                  cx="131"
                  cy="184"
                  rx="5"
                  ry="9"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="0.8"
                />

                {/* 7. Rectus Abdominis (6-Pack with Inscriptions & Linea Alba) */}
                <g
                  {...getStyleForMuscle('Abs (Rectus Abdominis)')}
                  onMouseEnter={(e) => handlePointerEnter('Abs (Rectus Abdominis)', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Abs (Rectus Abdominis)')}
                >
                  {/* Upper Abs Pair */}
                  <path d="M 76,94 C 82,93 86,93 88,94 C 88,103 88,105 88,106 C 84,107 79,107 75,106 C 75,102 75,98 76,94 Z" />
                  <path d="M 104,94 C 98,93 94,93 92,94 C 92,103 92,105 92,106 C 96,107 101,107 105,106 C 105,102 105,98 104,94 Z" />

                  {/* Mid Abs Pair (Umbilicus Level) */}
                  <path d="M 75,109 C 80,109 85,109 88,109 C 88,118 88,121 88,122 C 83,123 78,123 74,122 C 74,117 74,113 75,109 Z" />
                  <path d="M 105,109 C 100,109 95,109 92,109 C 92,118 92,121 92,122 C 97,123 102,123 106,122 C 106,117 106,113 105,109 Z" />

                  {/* Lower Abs Pair */}
                  <path d="M 74,125 C 80,125 85,125 88,125 C 88,137 87,143 85,145 C 80,144 76,141 73,138 C 73,133 73,129 74,125 Z" />
                  <path d="M 106,125 C 100,125 95,125 92,125 C 92,137 93,143 95,145 C 100,144 104,141 107,138 C 107,133 107,129 106,125 Z" />
                </g>

                {/* Linea Alba & Umbilicus Landmark */}
                <line
                  x1="90"
                  y1="94"
                  x2="90"
                  y2="148"
                  stroke={isDarkMode ? '#0f172a' : '#64748b'}
                  strokeWidth="1.2"
                  opacity={isDarkMode ? 0.75 : 0.85}
                />
                <circle cx="90" cy="122" r="1.5" fill={isDarkMode ? '#0f172a' : '#475569'} opacity="0.85" />

                {/* 8. External Obliques (Lateral Flank Muscle Armor) */}
                <g
                  {...getStyleForMuscle('Obliques')}
                  onMouseEnter={(e) => handlePointerEnter('Obliques', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Obliques')}
                >
                  {/* Left Obliques */}
                  <path d="M 69,94 C 64,101 62,112 63,124 C 64,134 67,142 71,146 C 73,144 74,136 74,126 C 74,115 75,103 75,95 Z" />
                  {/* Right Obliques */}
                  <path d="M 111,94 C 116,101 118,112 117,124 C 116,134 113,142 109,146 C 107,144 106,136 106,126 C 106,115 105,103 105,95 Z" />
                </g>

                {/* 9. Hip Flexors (Iliopsoas, Pectineus, Inguinal Crease) */}
                <g
                  {...getStyleForMuscle('Hip Flexors')}
                  onMouseEnter={(e) => handlePointerEnter('Hip Flexors', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Hip Flexors')}
                >
                  {/* Left Hip Flexor */}
                  <path d="M 73,147 C 77,147 84,147 86,149 C 84,157 79,166 75,170 C 71,167 69,158 73,147 Z" />
                  {/* Right Hip Flexor */}
                  <path d="M 107,147 C 103,147 96,147 94,149 C 96,157 101,166 105,170 C 109,167 111,158 107,147 Z" />
                </g>

                {/* 10. Adductors & Gracilis (Inner Thighs - Juchum Seogi & Chamber Retraction) */}
                <g
                  {...getStyleForMuscle('Adductors (Inner Thighs)')}
                  onMouseEnter={(e) => handlePointerEnter('Adductors (Inner Thighs)', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Adductors (Inner Thighs)')}
                >
                  {/* Left Inner Thigh Adductors */}
                  <path d="M 85,152 C 86,164 86,182 82,204 C 80,210 78,214 77,216 C 81,200 83,180 84,166 Z" />
                  {/* Right Inner Thigh Adductors */}
                  <path d="M 95,152 C 94,164 94,182 98,204 C 100,210 102,214 103,216 C 99,200 97,180 96,166 Z" />
                </g>

                {/* 11. Quadriceps Femoris (Rectus Femoris, Vastus Lateralis, Vastus Medialis Teardrop) */}
                <g
                  {...getStyleForMuscle('Quadriceps')}
                  onMouseEnter={(e) => handlePointerEnter('Quadriceps', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Quadriceps')}
                >
                  {/* Left Quad Outer Lateral Flare (Vastus Lateralis) */}
                  <path d="M 69,158 C 61,168 59,185 62,204 C 64,215 67,222 71,222 C 72,217 73,205 73,195 C 73,178 72,168 69,158 Z" />
                  {/* Left Quad Central Column (Rectus Femoris) */}
                  <path d="M 72,164 C 76,164 78,172 78,188 C 78,200 76,214 74,220 C 73,208 72,192 72,164 Z" />
                  {/* Left Quad Medial Teardrop (Vastus Medialis / VMO) */}
                  <path d="M 77,188 C 82,192 84,204 80,222 C 76,224 73,223 74,218 C 76,210 76,198 77,188 Z" />

                  {/* Right Quad Outer Lateral Flare (Vastus Lateralis) */}
                  <path d="M 111,158 C 119,168 121,185 118,204 C 116,215 113,222 109,222 C 108,217 107,205 107,195 C 107,178 108,168 111,158 Z" />
                  {/* Right Quad Central Column (Rectus Femoris) */}
                  <path d="M 108,164 C 104,164 102,172 102,188 C 102,200 104,214 106,220 C 107,208 108,192 108,164 Z" />
                  {/* Right Quad Medial Teardrop (Vastus Medialis / VMO) */}
                  <path d="M 103,188 C 98,192 96,204 100,222 C 104,224 107,223 106,218 C 104,210 104,198 103,188 Z" />
                </g>

                {/* Specular Teardrop Arc on VMO (Vastus Medialis) */}
                <path
                  d="M 78,198 C 82,208 81,218 76,220 M 102,198 C 98,208 99,218 104,220"
                  fill="none"
                  stroke={isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  pointerEvents="none"
                />

                {/* Patellae (Knee Caps) */}
                <circle
                  cx="74"
                  cy="227"
                  r="4.2"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="1"
                />
                <circle
                  cx="106"
                  cy="227"
                  r="4.2"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="1"
                />

                {/* Patellar Tendons */}
                <g
                  {...getStyleForMuscle('Patellar Tendon')}
                  onMouseEnter={(e) => handlePointerEnter('Patellar Tendon', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Patellar Tendon')}
                >
                  <path d="M 73,231 L 76,231 L 75,243 L 72,243 Z" />
                  <path d="M 104,231 L 107,231 L 108,243 L 105,243 Z" />
                </g>

                {/* 12. Tibialis Anterior & Peroneal Lower Leg Lateral Group */}
                <g
                  {...getStyleForMuscle('Tibialis Anterior')}
                  onMouseEnter={(e) => handlePointerEnter('Tibialis Anterior', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Tibialis Anterior')}
                >
                  {/* Left Tibialis Anterior (Shin crest sweep) */}
                  <path d="M 72,244 C 67,250 66,262 68,278 C 70,290 72,298 74,302 C 75,296 75,282 74,268 C 73,256 73,248 72,244 Z" />
                  {/* Left Peroneus / Fibularis Longus (Lateral lower leg) */}
                  <path d="M 66,252 C 63,260 63,272 66,285 C 68,280 68,268 67,258 Z" />

                  {/* Right Tibialis Anterior */}
                  <path d="M 108,244 C 113,250 114,262 112,278 C 110,290 108,298 106,302 C 105,296 105,282 106,268 C 107,256 107,248 108,244 Z" />
                  {/* Right Peroneus / Fibularis Longus */}
                  <path d="M 114,252 C 117,260 117,272 114,285 C 112,280 112,268 113,258 Z" />
                </g>

                {/* Feet (Rooted Ground Contact Bases) */}
                <path
                  d="M 62,312 C 60,312 60,317 64,319 C 70,321 76,321 78,316 C 79,313 77,311 75,311 C 72,311 68,312 62,312 Z"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="1"
                />
                <path
                  d="M 118,312 C 120,312 120,317 116,319 C 110,321 104,321 102,316 C 101,313 103,311 105,311 C 108,311 112,312 118,312 Z"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="1"
                />

                {/* Biomechanical HUD Joint Coordinates Overlays (High-Contrast) */}
                {showHudOverlay && (
                  <g
                    opacity={isDarkMode ? 0.7 : 0.85}
                    className={`font-mono text-[6px] select-none pointer-events-none ${
                      isDarkMode ? 'fill-neutral-400' : 'fill-slate-700 font-bold'
                    }`}
                  >
                    {/* Shoulder Joint Reticles */}
                    <circle cx="48" cy="72" r="2.5" fill="none" stroke="#ef4444" strokeWidth="0.7" strokeDasharray="1 1" />
                    <circle cx="132" cy="72" r="2.5" fill="none" stroke="#ef4444" strokeWidth="0.7" strokeDasharray="1 1" />
                    {/* Knee Hinge Reticles */}
                    <circle cx="74" cy="227" r="2.5" fill="none" stroke="#06b6d4" strokeWidth="0.7" strokeDasharray="1 1" />
                    <circle cx="106" cy="227" r="2.5" fill="none" stroke="#06b6d4" strokeWidth="0.7" strokeDasharray="1 1" />
                    {/* Coordinate Axis Labels */}
                    <text x="6" y="74">C7-T1</text>
                    <text x="6" y="104">SERRATUS</text>
                    <text x="6" y="146">L4-L5</text>
                    <text x="6" y="180">ADDUCTOR</text>
                    <text x="6" y="228">KNEE-AXIS</text>
                    <line
                      x1="28"
                      y1="72"
                      x2="44"
                      y2="72"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="38"
                      y1="102"
                      x2="60"
                      y2="102"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="28"
                      y1="144"
                      x2="68"
                      y2="144"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="40"
                      y1="178"
                      x2="80"
                      y2="178"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="38"
                      y1="227"
                      x2="68"
                      y2="227"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. POSTERIOR VIEW (DETAILED POSTERIOR KINETIC CHAIN)         */}
        {/* ============================================================ */}
        {(viewAngle === 'both' || viewAngle === 'posterior') && (
          <div className="flex flex-col items-center relative group">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#EF2F38] shadow-[0_0_8px_#EF2F38] animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-widest">
                POSTERIOR · POSTERIOR CHAIN
              </span>
            </div>

            {/* High-Contrast Anatomical Display Plate */}
            <div className="relative rounded-[8px] bg-white dark:bg-[#0B0D11]/95 border border-slate-200 dark:border-neutral-800 shadow-sm dark:shadow-2xl p-2 transition-colors">
              <svg
                width={width}
                height={height}
                viewBox="0 0 180 330"
                className="overflow-visible drop-shadow-xs transition-transform duration-200"
              >
                {/* Biomechanical HUD Grid Backdrop */}
                {showHudOverlay && (
                  <rect x="0" y="0" width="180" height="330" fill={`url(#${uid}-hud-grid)`} opacity="0.75" pointerEvents="none" />
                )}

                {/* Pedestal Volumetric Ambient Shadow */}
                <ellipse cx="90" cy="322" rx="55" ry="7" fill={`url(#${uid}-pedestal-shadow)`} />

                {/* Anatomical Base Silhouette (Athletic Chassis - Posterior) */}
                <path
                  d={
                    isFemale
                      ? "M 90,14 C 103,14 105,25 104,36 C 103,45 98,49 95,53 C 101,56 112,59 124,63 C 133,66 137,74 133,90 C 130,103 128,118 129,130 C 131,142 139,158 136,174 C 134,185 128,189 123,187 C 120,185 122,172 121,163 C 120,150 113,132 113,121 C 111,104 110,95 106,93 C 105,106 106,122 105,135 C 104,148 116,163 118,183 C 120,203 118,216 115,225 C 113,231 116,245 119,259 C 122,274 118,290 116,301 C 114,309 117,314 121,316 C 123,317 123,319 119,319 C 109,319 104,318 102,312 C 100,305 102,293 103,281 C 104,266 100,247 98,235 C 96,225 96,220 96,214 C 96,200 94,180 90,169 C 86,180 84,200 84,214 C 84,220 84,225 82,235 C 80,247 76,266 77,281 C 78,293 80,305 78,312 C 76,318 71,319 61,319 C 57,319 57,317 59,316 C 63,314 66,309 64,301 C 62,290 58,274 61,259 C 64,245 67,231 65,225 C 62,216 60,203 62,183 C 64,163 76,148 75,135 C 74,122 75,106 74,93 C 70,95 69,104 67,121 C 67,132 60,150 59,163 C 58,172 60,185 57,187 C 52,189 46,185 44,174 C 41,158 49,142 51,130 C 52,118 50,103 47,90 C 43,74 47,66 56,63 C 68,59 79,56 85,53 C 82,49 77,45 76,36 C 75,25 77,14 90,14 Z"
                      : "M 90,12 C 104,12 107,24 106,36 C 105,46 100,50 96,54 C 103,57 115,60 128,64 C 138,67 142,75 137,92 C 134,106 132,121 133,134 C 135,147 144,163 140,180 C 138,191 132,195 127,193 C 123,191 125,178 124,168 C 123,155 115,135 115,123 C 113,105 112,96 108,94 C 107,107 108,124 107,138 C 105,150 115,164 117,184 C 119,204 117,217 114,226 C 112,232 115,246 118,260 C 121,275 117,291 115,302 C 113,310 117,315 121,317 C 123,318 123,320 119,320 C 109,320 104,319 102,313 C 100,306 102,294 103,282 C 104,267 100,248 98,236 C 96,226 96,221 96,215 C 96,201 94,180 90,168 C 86,180 84,201 84,215 C 84,221 84,226 82,236 C 80,248 76,267 77,282 C 78,294 80,306 78,313 C 76,319 71,320 61,320 C 57,320 57,318 59,317 C 63,315 67,310 65,302 C 63,291 59,275 62,260 C 65,246 68,232 66,226 C 63,217 61,204 63,184 C 65,164 75,150 73,138 C 72,124 73,107 72,94 C 68,96 67,105 65,123 C 65,135 57,155 56,168 C 55,178 57,191 53,193 C 48,195 42,191 40,180 C 36,163 45,147 47,134 C 48,121 46,106 43,92 C 38,75 42,67 52,64 C 65,60 77,57 84,54 C 80,50 75,46 74,36 C 73,24 76,12 90,12 Z"
                  }
                  fill={isDarkMode ? '#0d1527' : '#f1f5f9'}
                  stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                  strokeWidth="1.2"
                  opacity={isDarkMode ? 0.95 : 1.0}
                />

                {/* Cranium / Occipital Back of Head */}
                <g
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  onClick={() => handleClick('Skeletal System')}
                >
                  <path
                    d="M 90,14 C 98,14 105,19 105,28 C 105,38 100,45 96,50 C 93,53 91,54 90,54 C 89,54 87,53 84,50 C 80,45 75,38 75,28 C 75,19 82,14 90,14 Z"
                    fill={`url(#${uid}-bone)`}
                    stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                    strokeWidth="1"
                  />
                </g>

                {/* 1. Trapezius (Upper Back Diamond: Superior, Middle, and Inferior Fibers) */}
                <g
                  {...getStyleForMuscle('Trapezius')}
                  onMouseEnter={(e) => handlePointerEnter('Trapezius', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Trapezius')}
                >
                  {/* Superior / Descending Trapezius */}
                  <path d="M 90,48 C 84,48 76,55 68,64 L 90,64 Z M 90,48 C 96,48 104,55 112,64 L 90,64 Z" />
                  {/* Middle / Transverse Trapezius */}
                  <path d="M 68,64 L 64,66 C 70,74 78,82 90,86 C 102,82 110,74 116,66 L 112,64 Z" />
                  {/* Inferior / Ascending Trapezius (Down to T12 apex) */}
                  <path d="M 90,86 C 80,94 82,106 90,116 C 98,106 100,94 90,86 Z" />
                </g>

                {/* Specular Fiber Ridge on Trapezius */}
                <path
                  d="M 88,52 C 82,60 74,68 68,70 M 92,52 C 98,60 106,68 112,70"
                  fill="none"
                  stroke={isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  pointerEvents="none"
                />

                {/* 2. Posterior Deltoids (Rear Shoulders) */}
                <g
                  {...getStyleForMuscle('Shoulders (Deltoids)')}
                  onMouseEnter={(e) => handlePointerEnter('Shoulders (Deltoids)', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Shoulders (Deltoids)')}
                >
                  {/* Left Rear Deltoid */}
                  <path d="M 63,67 C 54,69 46,75 46,84 C 47,91 52,94 56,93 C 58,86 59,78 63,67 Z" />
                  {/* Right Rear Deltoid */}
                  <path d="M 117,67 C 126,69 134,75 134,84 C 133,91 128,94 124,93 C 122,86 121,78 117,67 Z" />
                </g>

                {/* 3. Rotator Cuff & Infraspinatus / Teres Complex (Scapular Stabilization) */}
                <g
                  {...getStyleForMuscle('Rotator Cuff Tendons')}
                  onMouseEnter={(e) => handlePointerEnter('Rotator Cuff Tendons', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Rotator Cuff Tendons')}
                >
                  {/* Left Infraspinatus & Teres Minor/Major */}
                  <path d="M 62,70 C 58,78 57,86 62,90 C 66,90 70,82 68,72 Z" />
                  {/* Right Infraspinatus & Teres Minor/Major */}
                  <path d="M 118,70 C 122,78 123,86 118,90 C 114,90 110,82 112,72 Z" />
                </g>

                {/* 4. Triceps Brachii (Lateral Head, Long Head, and Medial Head + Tendon) */}
                <g
                  {...getStyleForMuscle('Triceps')}
                  onMouseEnter={(e) => handlePointerEnter('Triceps', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Triceps')}
                >
                  {/* Left Triceps Long Head (Medial Bulk) */}
                  <path d="M 54,95 C 50,102 51,112 53,122 C 55,122 57,118 57,112 C 58,105 57,98 54,95 Z" />
                  {/* Left Triceps Lateral Head (Outer Horseshoe Curve) */}
                  <path d="M 48,100 C 46,108 47,118 51,124 C 50,116 48,108 48,100 Z" />

                  {/* Right Triceps Long Head */}
                  <path d="M 126,95 C 130,102 129,112 127,122 C 125,122 123,118 123,112 C 122,105 123,98 126,95 Z" />
                  {/* Right Triceps Lateral Head */}
                  <path d="M 132,100 C 134,108 133,118 129,124 C 130,116 132,108 132,100 Z" />
                </g>

                {/* Olecranon Elbow Landmark */}
                <circle
                  cx="51"
                  cy="125"
                  r="2.2"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="0.8"
                />
                <circle
                  cx="129"
                  cy="125"
                  r="2.2"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="0.8"
                />

                {/* 5. Forearm Extensors (Posterior) */}
                <g
                  {...getStyleForMuscle('Forearms')}
                  onMouseEnter={(e) => handlePointerEnter('Forearms', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Forearms')}
                >
                  <path d="M 49,126 C 43,133 42,143 45,156 C 47,166 49,173 52,174 C 55,174 57,165 57,152 C 58,138 57,128 54,126 Z" />
                  <path d="M 131,126 C 137,133 138,143 135,156 C 133,166 131,173 128,174 C 125,174 123,165 123,152 C 122,138 123,128 126,126 Z" />
                </g>

                {/* Posterior Hand/Knuckle Pose */}
                <ellipse
                  cx="49"
                  cy="184"
                  rx="5"
                  ry="9"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="0.8"
                />
                <ellipse
                  cx="131"
                  cy="184"
                  rx="5"
                  ry="9"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="0.8"
                />

                {/* 6. Latissimus Dorsi (Athletic V-Taper Wings) */}
                <g
                  {...getStyleForMuscle('Back (Lats)')}
                  onMouseEnter={(e) => handlePointerEnter('Back (Lats)', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Back (Lats)')}
                >
                  {/* Left Lat Wing */}
                  <path d="M 88,90 C 82,84 72,75 62,75 C 60,86 61,102 67,118 C 72,130 78,138 88,140 C 88,126 88,108 88,90 Z" />
                  {/* Right Lat Wing */}
                  <path d="M 92,90 C 98,84 108,75 118,75 C 120,86 119,102 113,118 C 108,130 102,138 92,140 C 92,126 92,108 92,90 Z" />
                </g>

                {/* Specular Ridge on Lats */}
                <path
                  d="M 67,82 C 65,96 70,114 78,128 M 113,82 C 115,96 110,114 102,128"
                  fill="none"
                  stroke={isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  pointerEvents="none"
                />

                {/* 7. Lower Back (Erector Spinae Twin Columns & Thoracolumbar Mass) */}
                <g
                  {...getStyleForMuscle('Lower Back')}
                  onMouseEnter={(e) => handlePointerEnter('Lower Back', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Lower Back')}
                >
                  {/* Left Erector Spinae (Spinalis & Longissimus) */}
                  <path d="M 82,118 C 85,118 88,118 88,120 L 88,142 C 84,142 81,140 81,138 C 80,132 80,124 82,118 Z" />
                  {/* Right Erector Spinae */}
                  <path d="M 98,118 C 95,118 92,118 92,120 L 92,142 C 96,142 99,140 99,138 C 100,132 100,124 98,118 Z" />
                </g>

                {/* Posterior Vertebral Spine Centerline */}
                <line
                  x1="90"
                  y1="50"
                  x2="90"
                  y2="144"
                  stroke={isDarkMode ? '#0f172a' : '#64748b'}
                  strokeWidth="1.2"
                  opacity={isDarkMode ? 0.65 : 0.8}
                  strokeDasharray="3 2"
                />

                {/* 8. Gluteal Complex (Gluteus Medius & Gluteus Maximus) */}
                <g
                  {...getStyleForMuscle('Glutes')}
                  onMouseEnter={(e) => handlePointerEnter('Glutes', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Glutes')}
                >
                  {/* Left Gluteus Medius (Upper Lateral Hip Shelf for Pivot Stance) */}
                  <path d="M 65,142 C 61,145 59,152 61,158 C 65,156 72,154 78,154 C 74,146 70,143 65,142 Z" />
                  {/* Left Gluteus Maximus (Lower Power Contours) */}
                  <path d="M 61,158 C 61,166 65,178 74,183 C 82,183 88,181 88,172 C 88,158 80,154 61,158 Z" />

                  {/* Right Gluteus Medius */}
                  <path d="M 115,142 C 119,145 121,152 119,158 C 115,156 108,154 102,154 C 106,146 110,143 115,142 Z" />
                  {/* Right Gluteus Maximus */}
                  <path d="M 119,158 C 119,166 115,178 106,183 C 98,183 92,181 92,172 C 92,158 100,154 119,158 Z" />
                </g>

                {/* Specular Curve along Gluteal Crest */}
                <path
                  d="M 66,156 C 72,170 80,174 86,174 M 114,156 C 108,170 100,174 94,174"
                  fill="none"
                  stroke={isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.6)'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  pointerEvents="none"
                />

                {/* Intergluteal Cleft Line */}
                <line
                  x1="90"
                  y1="144"
                  x2="90"
                  y2="182"
                  stroke={isDarkMode ? '#0f172a' : '#64748b'}
                  strokeWidth="1.4"
                  opacity={isDarkMode ? 0.75 : 0.85}
                />

                {/* 9. Hamstrings (Biceps Femoris Lateral & Semitendinosus / Semimembranosus Medial) */}
                <g
                  {...getStyleForMuscle('Hamstrings')}
                  onMouseEnter={(e) => handlePointerEnter('Hamstrings', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Hamstrings')}
                >
                  {/* Left Hamstring: Biceps Femoris (Lateral Head) */}
                  <path d="M 66,183 C 62,194 62,206 65,221 C 69,222 72,220 73,212 C 73,198 72,188 66,183 Z" />
                  {/* Left Hamstring: Semitendinosus / Semimembranosus (Medial Head) */}
                  <path d="M 74,183 C 74,198 75,210 75,221 C 78,222 81,220 83,210 C 85,198 84,188 74,183 Z" />

                  {/* Right Hamstring: Biceps Femoris (Lateral Head) */}
                  <path d="M 114,183 C 118,194 118,206 115,221 C 111,222 108,220 107,212 C 107,198 108,188 114,183 Z" />
                  {/* Right Hamstring: Semitendinosus (Medial Head) */}
                  <path d="M 106,183 C 106,198 105,210 105,221 C 102,222 99,220 97,210 C 95,198 96,188 106,183 Z" />
                </g>

                {/* Popliteal Fossa Diamond (Behind the Knees) */}
                <polygon points="73,222 76,225 73,228 70,225" fill={isDarkMode ? '#0f172a' : '#cbd5e1'} opacity="0.6" />
                <polygon points="107,222 110,225 107,228 104,225" fill={isDarkMode ? '#0f172a' : '#cbd5e1'} opacity="0.6" />

                {/* 10. Calves (Gastrocnemius Medial/Lateral Heads and Soleus Wings) */}
                <g
                  {...getStyleForMuscle('Calves')}
                  onMouseEnter={(e) => handlePointerEnter('Calves', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Calves')}
                >
                  {/* Left Gastrocnemius Lateral Head */}
                  <path d="M 65,226 C 58,235 56,246 59,260 C 62,260 66,252 68,242 C 68,234 67,228 65,226 Z" />
                  {/* Left Gastrocnemius Medial Head (Longer teardrop) */}
                  <path d="M 68,226 C 68,238 68,252 71,268 C 74,272 78,266 78,252 C 77,236 74,226 68,226 Z" />
                  {/* Left Soleus (Deep muscle flanking lower calf) */}
                  <path d="M 59,260 C 60,268 64,275 68,277 C 67,272 65,266 64,260 Z" />

                  {/* Right Gastrocnemius Lateral Head */}
                  <path d="M 115,226 C 122,235 124,246 121,260 C 118,260 114,252 112,242 C 112,234 113,228 115,226 Z" />
                  {/* Right Gastrocnemius Medial Head */}
                  <path d="M 112,226 C 112,238 112,252 109,268 C 106,272 102,266 102,252 C 103,236 106,226 112,226 Z" />
                  {/* Right Soleus */}
                  <path d="M 121,260 C 120,268 116,275 112,277 C 113,272 115,266 116,260 Z" />
                </g>

                {/* Specular Curves on Calf Bellies */}
                <path
                  d="M 63,242 C 61,254 66,266 71,270 M 117,242 C 119,254 114,266 109,270"
                  fill="none"
                  stroke={isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.6)'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  pointerEvents="none"
                />

                {/* 11. Achilles Tendons (Calcaneal Tendons) */}
                <g
                  {...getStyleForMuscle('Achilles Tendon')}
                  onMouseEnter={(e) => handlePointerEnter('Achilles Tendon', e)}
                  onMouseLeave={handlePointerLeave}
                  onClick={() => handleClick('Achilles Tendon')}
                >
                  {/* Left Achilles Tendon Cord */}
                  <path d="M 70,279 L 74,279 L 74,312 L 70,312 Z" />
                  {/* Right Achilles Tendon Cord */}
                  <path d="M 106,279 L 110,279 L 110,312 L 106,312 Z" />
                </g>

                {/* Calcaneus (Heel Bones) */}
                <ellipse
                  cx="72"
                  cy="315"
                  rx="5"
                  ry="5.5"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="1"
                />
                <ellipse
                  cx="108"
                  cy="315"
                  rx="5"
                  ry="5.5"
                  fill={`url(#${uid}-bone)`}
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                  strokeWidth="1"
                />

                {/* Biomechanical Posterior Reticles (High Contrast) */}
                {showHudOverlay && (
                  <g
                    opacity={isDarkMode ? 0.7 : 0.85}
                    className={`font-mono text-[6px] select-none pointer-events-none ${
                      isDarkMode ? 'fill-neutral-400' : 'fill-slate-700 font-bold'
                    }`}
                  >
                    <circle cx="90" cy="116" r="2.5" fill="none" stroke="#f59e0b" strokeWidth="0.7" strokeDasharray="1 1" />
                    <circle cx="72" cy="296" r="2.5" fill="none" stroke="#10b981" strokeWidth="0.7" strokeDasharray="1 1" />
                    <circle cx="108" cy="296" r="2.5" fill="none" stroke="#10b981" strokeWidth="0.7" strokeDasharray="1 1" />
                    <text x="144" y="80">ROTATOR-CUFF</text>
                    <text x="144" y="118">T12-L1</text>
                    <text x="136" y="156">GLUT-MED</text>
                    <text x="136" y="184">GLUTE-CREASE</text>
                    <text x="136" y="262">SOLEUS-AXIS</text>
                    <text x="136" y="296">ACHILLES-CORD</text>
                    <line
                      x1="120"
                      y1="78"
                      x2="140"
                      y2="78"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="94"
                      y1="116"
                      x2="140"
                      y2="116"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="118"
                      y1="154"
                      x2="132"
                      y2="154"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="88"
                      y1="182"
                      x2="132"
                      y2="182"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="114"
                      y1="260"
                      x2="132"
                      y2="260"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="112"
                      y1="296"
                      x2="132"
                      y2="296"
                      stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Floating High-Contrast Bio-Diagnostic HUD Tooltip */}
      {hoveredPart && (
        <div
          className="fixed z-50 bg-white/95 dark:bg-neutral-950/95 text-neutral-900 dark:text-white p-3 rounded-[8px] pointer-events-none shadow-2xl flex flex-col gap-1.5 text-left transform -translate-x-1/2 -translate-y-16 backdrop-blur-xl border border-neutral-300 dark:border-neutral-700/80 font-mono w-64 animate-in fade-in zoom-in-95 duration-150"
          style={{ left: hoveredPart.x, top: hoveredPart.y }}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EF2F38] shadow-[0_0_8px_#EF2F38] animate-pulse" />
              <span className="text-[11px] font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                {hoveredPart.name}
              </span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase font-semibold">
              {hoveredDb?.category ? hoveredDb.category.replace('_', ' ') : 'Skeletal Muscle'}
            </span>
          </div>

          {/* Latin Nomenclature */}
          {hoveredDb?.latinName && (
            <div className="text-[9px] text-neutral-600 dark:text-neutral-400 italic line-clamp-1">
              {hoveredDb.latinName}
            </div>
          )}

          {/* Kinetic Load Progress Bar */}
          <div className="flex flex-col gap-1 mt-0.5">
            <div className="flex items-center justify-between text-[9px] font-bold">
              <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Zap size={10} className="text-[#EF2F38]" /> KINETIC LOAD:
              </span>
              <span
                className={
                  hoveredPart.load >= 0.7
                    ? 'text-[#EF2F38]'
                    : hoveredPart.load >= 0.35
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-neutral-700 dark:text-neutral-300'
                }
              >
                {Math.round(hoveredPart.load * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  hoveredPart.load >= 0.7
                    ? 'bg-gradient-to-r from-red-600 to-[#EF2F38] shadow-[0_0_8px_#EF2F38]'
                    : hoveredPart.load >= 0.35
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-gradient-to-r from-slate-400 to-slate-600'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, Math.round(hoveredPart.load * 100)))}%` }}
              />
            </div>
          </div>

          {/* Taekwondo Biomechanical Relevance */}
          {hoveredDb?.tkdRelevance && (
            <div className="text-[8.5px] text-neutral-700 dark:text-neutral-300 leading-tight border-t border-neutral-200 dark:border-neutral-800/80 pt-1 line-clamp-2">
              <span className="text-[#EF2F38] font-bold">TKD BIOMECHANICS: </span>
              {hoveredDb.tkdRelevance}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
