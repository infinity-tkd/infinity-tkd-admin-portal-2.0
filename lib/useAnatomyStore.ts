import { create } from 'zustand';
import { ANATOMY_DATABASE } from './anatomyData';

export type AnatomicalGender = 'Male' | 'Female';
export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'upper' | 'lower' | 'core';
export type HeatmapMode = 'loads' | 'status' | 'anatomy';
export type TelemetryStatus = 'optimal' | 'fatigued' | 'injured' | 'target';

export interface TelemetryData {
  status: TelemetryStatus;
  load: number; // 0.0 - 1.0
  notes?: string;
}

export interface AnatomyLayersState {
  skin: boolean;
  muscles: boolean;
  tendons: boolean;
  bones: boolean;
}

export interface AnatomyStoreState {
  // Rig & Model
  gender: AnatomicalGender;
  layers: AnatomyLayersState;
  skinOpacity: number;
  ghostMode: boolean;
  autoRotate: boolean;

  // Selection & Hover
  selectedMuscle: string | null;
  hoveredMuscle: string | null;
  hoverCoords: { x: number; y: number } | null;

  // Viewport & Camera
  viewPreset: ViewPreset;
  cameraFocusTarget: [number, number, number] | null;
  cameraFocusDistance: number | null;
  isExpanded: boolean;

  // Telemetry & Diagnostic Data
  heatmapMode: HeatmapMode;
  muscleLoads: Record<string, number>;
  maxLoad: number;
  studentTelemetry: Record<string, TelemetryData>;
  selectedKick: string | null;

  // Action methods
  setGender: (gender: AnatomicalGender) => void;
  toggleLayer: (layer: keyof AnatomyLayersState) => void;
  setLayer: (layer: keyof AnatomyLayersState, visible: boolean) => void;
  setSkinOpacity: (opacity: number) => void;
  setGhostMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setAutoRotate: (rotate: boolean | ((prev: boolean) => boolean)) => void;
  
  setSelectedMuscle: (id: string | null) => void;
  setHoveredMuscle: (id: string | null, coords?: { x: number; y: number } | null) => void;
  
  setViewPreset: (preset: ViewPreset) => void;
  setCameraFocus: (target: [number, number, number] | null, distance?: number | null) => void;
  setIsExpanded: (expanded: boolean) => void;
  
  setHeatmapMode: (mode: HeatmapMode) => void;
  setMuscleLoads: (loads: Record<string, number>, max?: number) => void;
  setStudentTelemetry: (telemetry: Record<string, TelemetryData>) => void;
  setSelectedKick: (kick: string | null) => void;
  
  resetView: () => void;
}

export const useAnatomyStore = create<AnatomyStoreState>((set) => ({
  // Defaults
  gender: 'Male',
  layers: {
    skin: true,
    muscles: true,
    tendons: true,
    bones: true,
  },
  skinOpacity: 0.35,
  ghostMode: false,
  autoRotate: false,

  selectedMuscle: null,
  hoveredMuscle: null,
  hoverCoords: null,

  viewPreset: 'front',
  cameraFocusTarget: null,
  cameraFocusDistance: null,
  isExpanded: false,

  heatmapMode: 'loads',
  muscleLoads: {},
  maxLoad: 1.0,
  studentTelemetry: {
    'Quadriceps': { status: 'optimal', load: 0.2, notes: 'Full range of motion, recovered' },
    'Hamstrings': { status: 'fatigued', load: 0.65, notes: 'Mild soreness from yesterday\'s sprint intervals' },
    'Glutes': { status: 'optimal', load: 0.3 },
    'Calves': { status: 'injured', load: 0.85, notes: 'Achilles tendon strain warning - restricted high kicks' },
    'Abs (Rectus Abdominis)': { status: 'target', load: 0.9, notes: 'Focus target for today\'s core power session' },
  },
  selectedKick: null,

  // Setters
  setGender: (gender) => set({ gender }),
  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),
  setLayer: (layer, visible) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: visible },
    })),
  setSkinOpacity: (opacity) => set({ skinOpacity: Math.max(0, Math.min(1, opacity)) }),
  setGhostMode: (val) =>
    set((state) => ({
      ghostMode: typeof val === 'function' ? val(state.ghostMode) : val,
    })),
  setAutoRotate: (val) =>
    set((state) => ({
      autoRotate: typeof val === 'function' ? val(state.autoRotate) : val,
    })),

  setSelectedMuscle: (id) => {
    if (!id) {
      set({ selectedMuscle: null, cameraFocusTarget: null, cameraFocusDistance: null });
      return;
    }
    const structure = ANATOMY_DATABASE[id];
    if (structure && structure.cameraFocus) {
      set({
        selectedMuscle: id,
        cameraFocusTarget: structure.cameraFocus.target,
        cameraFocusDistance: structure.cameraFocus.distance,
      });
    } else {
      set({ selectedMuscle: id });
    }
  },

  setHoveredMuscle: (id, coords = null) =>
    set({ hoveredMuscle: id, hoverCoords: coords }),

  setViewPreset: (preset) => {
    let target: [number, number, number] = [0, 0, 0];
    let distance = 3.6;

    if (preset === 'upper') {
      target = [0, 0.4, 0];
      distance = 2.4;
    } else if (preset === 'lower') {
      target = [0, -0.5, 0];
      distance = 2.4;
    } else if (preset === 'core') {
      target = [0, 0.05, 0];
      distance = 2.1;
    }

    set({
      viewPreset: preset,
      cameraFocusTarget: target,
      cameraFocusDistance: distance,
    });
  },

  setCameraFocus: (target, distance = null) =>
    set({ cameraFocusTarget: target, cameraFocusDistance: distance }),

  setIsExpanded: (expanded) => set({ isExpanded: expanded }),

  setHeatmapMode: (mode) => set({ heatmapMode: mode }),
  setMuscleLoads: (loads, max = 1.0) => set({ muscleLoads: loads, maxLoad: max }),
  setStudentTelemetry: (telemetry) => set({ studentTelemetry: telemetry }),
  setSelectedKick: (kick) => set({ selectedKick: kick }),

  resetView: () =>
    set({
      viewPreset: 'front',
      cameraFocusTarget: [0, 0, 0],
      cameraFocusDistance: 3.6,
      selectedMuscle: null,
      selectedKick: null,
      autoRotate: false,
    }),
}));
