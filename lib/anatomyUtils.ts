import type { CurriculumVideo, Muscle, AssetMuscleRelation } from '@/lib/store';
import { TKD_KICK_PRESETS } from '@/lib/anatomyData';

/**
 * Normalizes a muscle name to match BodyParts3D concept taxonomy and 3D mesh nodes.
 */
export const normalizeMuscleNameFor3D = (name: string): string => {
  const n = name.toLowerCase().trim();
  if (n.includes('quadriceps') || /\bquads?\b/.test(n) || n.includes('rectus femoris') || n.includes('vastus')) return 'Quadriceps';
  if (n.includes('hamstring') || n.includes('biceps femoris') || n.includes('semitendinosus') || n.includes('semimembranosus')) return 'Hamstrings';
  if (n.includes('gluteus') || n.includes('glute')) return 'Glutes';
  if (n.includes('calf') || n.includes('calves') || n.includes('gastrocnemius') || n.includes('soleus') || n.includes('triceps surae')) return 'Calves';
  if (n.includes('oblique') && !n.includes('inferior oblique') && !n.includes('superior oblique')) return 'Obliques';
  if (n.includes('rectus abdominis') || n === 'abs' || n.startsWith('abs (')) return 'Abs (Rectus Abdominis)';
  if (n.includes('lower back') || n.includes('erector spinae')) return 'Lower Back';
  if (n.includes('hip flexor') || n.includes('psoas') || n.includes('iliacus')) return 'Hip Flexors';
  if (n.includes('shoulder') || n.includes('deltoid')) return 'Shoulders (Deltoids)';
  if (n.includes('chest') || n.includes('pectoral')) return 'Chest (Pectorals)';
  if (n.includes('lats') || n.includes('latissimus dorsi') || n.includes('back (lats)')) return 'Back (Lats)';
  if (n.includes('forearm') || n.includes('brachioradialis') || n.includes('carpi') || n.includes('palmaris') || n.includes('pronator') || n.includes('supinator')) return 'Forearms';
  if (n.includes('biceps') || n.includes('brachialis')) return 'Biceps';
  if (n.includes('triceps')) return 'Triceps';
  if (n.includes('trapezius')) return 'Trapezius';
  if (n.includes('rotator cuff') || n.includes('infraspinatus') || n.includes('supraspinatus') || n.includes('subscapularis') || n.includes('teres minor')) return 'Rotator Cuff Tendons';
  if ((n.includes('adductor') && !n.includes('pollicis')) || n.includes('gracilis')) return 'Adductors (Inner Thighs)';
  if (n.includes('serratus anterior')) return 'Serratus Anterior';
  if (n.includes('tibialis anterior')) return 'Tibialis Anterior';

  return name.trim();
};

export interface ResolvedMuscleLoadResult {
  muscleLoads: Record<string, number>;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  source: 'database' | 'preset' | 'focus-zones' | 'category' | 'none';
}

/**
 * Resolves active biomechanical muscle loads for any curriculum technique or library asset.
 * Checks relational DB -> Kick Presets -> Focus Zones -> Category biomechanics.
 */
export function resolveAssetMuscleLoads(
  asset: CurriculumVideo | null | undefined,
  state?: {
    assetMuscleRelations?: AssetMuscleRelation[];
    muscles?: Muscle[];
  }
): ResolvedMuscleLoadResult {
  if (!asset) {
    return { muscleLoads: {}, primaryMuscles: [], secondaryMuscles: [], source: 'none' };
  }

  const muscleLoads: Record<string, number> = {};
  const primaryMuscles: string[] = [];
  const secondaryMuscles: string[] = [];

  // 1. Relational database linkage (library_asset_muscles table)
  if (state?.assetMuscleRelations && state?.muscles) {
    const relations = state.assetMuscleRelations.filter((r: AssetMuscleRelation) => r.assetId === asset.id);
    if (relations.length > 0) {
      relations.forEach((r: AssetMuscleRelation) => {
        const m = state.muscles?.find((x: Muscle) => x.id === r.muscleId);
        if (m) {
          const normalized = normalizeMuscleNameFor3D(m.name);
          const isPrimary = r.role === 'Primary';
          const score = isPrimary ? 1.0 : 0.55;
          muscleLoads[normalized] = Math.max(muscleLoads[normalized] || 0, score);
          if (isPrimary && !primaryMuscles.includes(normalized)) {
            primaryMuscles.push(normalized);
          } else if (!isPrimary && !secondaryMuscles.includes(normalized)) {
            secondaryMuscles.push(normalized);
          }
        }
      });

      return { muscleLoads, primaryMuscles, secondaryMuscles: secondaryMuscles.filter(name => !primaryMuscles.includes(name)), source: 'database' };
    }
  }

  // Saved legacy focus zones are authored teaching data, not inferred body activity.
  try {
    const details = JSON.parse(asset.description || '{}');
    if (Array.isArray(details?.focusZones)) {
      for (const zone of details.focusZones) {
        if (typeof zone !== 'string' || !zone.trim()) continue;
        const group = normalizeMuscleNameFor3D(zone);
        muscleLoads[group] = 1;
        if (!primaryMuscles.includes(group)) primaryMuscles.push(group);
      }
      if (primaryMuscles.length) return { muscleLoads, primaryMuscles, secondaryMuscles, source: 'focus-zones' };
    }
  } catch { /* Plain-text descriptions have no structured muscle mapping. */ }

  // 2. Named instructional kick references; saved relational data always wins.
  const titleLower = asset.title.toLowerCase();
  for (const [presetKey, presetData] of Object.entries(TKD_KICK_PRESETS)) {
    const keyLower = presetKey.toLowerCase();
    if (
      titleLower.includes(presetData.koreanName) ||
      titleLower.includes(presetData.name.toLowerCase()) ||
      titleLower.includes(keyLower) ||
      titleLower.includes(presetData.name.toLowerCase().split(' (')[0]) ||
      (keyLower.includes('front') && titleLower.includes('front kick')) ||
      (keyLower.includes('roundhouse') && (titleLower.includes('roundhouse') || titleLower.includes('dollyo'))) ||
      (keyLower.includes('side') && (titleLower.includes('side kick') || titleLower.includes('yop'))) ||
      (keyLower.includes('back') && (titleLower.includes('back kick') || titleLower.includes('dwit')))
    ) {
      Object.entries(presetData.activatedMuscles).forEach(([mName, load]) => {
        const normalized = normalizeMuscleNameFor3D(mName);
        muscleLoads[normalized] = load;
        if (load >= 0.75) {
          primaryMuscles.push(normalized);
        } else {
          secondaryMuscles.push(normalized);
        }
      });

      return { muscleLoads, primaryMuscles, secondaryMuscles, source: 'preset' };
    }
  }

  // 3. Fallback based on category & technique biomechanical profile
  const cat = (asset.category || '').toLowerCase();
  if (cat.includes('kick') || cat.includes('chagi') || cat.includes('sparring') || cat.includes('kyorugi')) {
    const defaultKicks = [
      { name: 'Quadriceps', load: 0.95, primary: true },
      { name: 'Glutes', load: 0.90, primary: true },
      { name: 'Hip Flexors', load: 0.85, primary: true },
      { name: 'Hamstrings', load: 0.75, primary: false },
      { name: 'Calves', load: 0.70, primary: false },
      { name: 'Abs (Rectus Abdominis)', load: 0.65, primary: false },
    ];
    defaultKicks.forEach(m => {
      muscleLoads[m.name] = m.load;
      if (m.primary) primaryMuscles.push(m.name);
      else secondaryMuscles.push(m.name);
    });
  } else if (cat.includes('strike') || cat.includes('punch') || cat.includes('jirugi') || cat.includes('chigi')) {
    const defaultStrikes = [
      { name: 'Shoulders (Deltoids)', load: 1.0, primary: true },
      { name: 'Chest (Pectorals)', load: 0.85, primary: true },
      { name: 'Triceps', load: 0.80, primary: true },
      { name: 'Abs (Rectus Abdominis)', load: 0.75, primary: false },
      { name: 'Back (Lats)', load: 0.70, primary: false },
      { name: 'Obliques', load: 0.75, primary: false },
    ];
    defaultStrikes.forEach(m => {
      muscleLoads[m.name] = m.load;
      if (m.primary) primaryMuscles.push(m.name);
      else secondaryMuscles.push(m.name);
    });
  } else if (cat.includes('block') || cat.includes('makki')) {
    const defaultBlocks = [
      { name: 'Shoulders (Deltoids)', load: 0.95, primary: true },
      { name: 'Biceps', load: 0.85, primary: true },
      { name: 'Triceps', load: 0.75, primary: false },
      { name: 'Abs (Rectus Abdominis)', load: 0.65, primary: false },
      { name: 'Trapezius', load: 0.60, primary: false },
    ];
    defaultBlocks.forEach(m => {
      muscleLoads[m.name] = m.load;
      if (m.primary) primaryMuscles.push(m.name);
      else secondaryMuscles.push(m.name);
    });
  } else if (cat.includes('stance') || cat.includes('seogi') || cat.includes('poomsae') || cat.includes('forms')) {
    const defaultForms = [
      { name: 'Quadriceps', load: 0.95, primary: true },
      { name: 'Glutes', load: 0.85, primary: true },
      { name: 'Calves', load: 0.80, primary: false },
      { name: 'Hamstrings', load: 0.65, primary: false },
      { name: 'Abs (Rectus Abdominis)', load: 0.70, primary: false },
      { name: 'Shoulders (Deltoids)', load: 0.75, primary: false },
    ];
    defaultForms.forEach(m => {
      muscleLoads[m.name] = m.load;
      if (m.primary) primaryMuscles.push(m.name);
      else secondaryMuscles.push(m.name);
    });
  } else if (cat.includes('conditioning') || cat.includes('fitness')) {
    // General full body conditioning
    const defaultGeneral = [
      { name: 'Quadriceps', load: 0.85, primary: true },
      { name: 'Glutes', load: 0.80, primary: true },
      { name: 'Abs (Rectus Abdominis)', load: 0.75, primary: true },
      { name: 'Calves', load: 0.65, primary: false },
      { name: 'Shoulders (Deltoids)', load: 0.60, primary: false },
    ];
    defaultGeneral.forEach(m => {
      muscleLoads[m.name] = m.load;
      if (m.primary) primaryMuscles.push(m.name);
      else secondaryMuscles.push(m.name);
    });
  }

  return { muscleLoads, primaryMuscles, secondaryMuscles, source: primaryMuscles.length ? 'category' : 'none' };
}
