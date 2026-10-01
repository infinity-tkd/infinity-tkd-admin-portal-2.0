import { CurriculumVideo, Muscle, AssetMuscleRelation } from '@/lib/store';
import { TKD_KICK_PRESETS } from '@/lib/anatomyData';

/**
 * Normalizes a muscle name to match BodyParts3D concept taxonomy and 3D mesh nodes.
 */
export const normalizeMuscleNameFor3D = (name: string): string => {
  const n = name.toLowerCase().trim();
  if (n.includes('quadriceps') || n.includes('quad')) return 'Quadriceps';
  if (n.includes('hamstring') || n.includes('biceps femoris') || n.includes('semitendinosus') || n.includes('semimembranosus')) return 'Hamstrings';
  if (n.includes('gluteus') || n.includes('glute')) return 'Glutes';
  if (n.includes('calf') || n.includes('calves') || n.includes('gastrocnemius') || n.includes('soleus')) return 'Calves';
  if (n.includes('rectus abdominis') || n.includes('abs') || n.includes('abdominis')) return 'Abs (Rectus Abdominis)';
  if (n.includes('oblique')) return 'Obliques';
  if (n.includes('lower back') || n.includes('erector spinae')) return 'Lower Back';
  if (n.includes('hip flexor') || n.includes('iliopsoas')) return 'Hip Flexors';
  if (n.includes('shoulder') || n.includes('deltoid')) return 'Shoulders (Deltoids)';
  if (n.includes('chest') || n.includes('pectoral')) return 'Chest (Pectorals)';
  if (n.includes('lats') || n.includes('latissimus dorsi') || n.includes('back (lats)')) return 'Back (Lats)';
  if (n.includes('forearm') || n.includes('brachioradialis')) return 'Forearms';
  if (n.includes('biceps') || n.includes('brachialis')) return 'Biceps';
  if (n.includes('triceps')) return 'Triceps';
  if (n.includes('trapezius')) return 'Trapezius';
  if (n.includes('rhomboid') || n.includes('teres major')) return 'Back (Lats)';
  if (n.includes('rotator cuff') || n.includes('infraspinatus') || n.includes('supraspinatus')) return 'Rotator Cuff Tendons';
  if (n.includes('adductor') || n.includes('gracilis')) return 'Adductors (Inner Thighs)';
  if (n.includes('serratus')) return 'Serratus Anterior';
  if (n.includes('tibialis')) return 'Tibialis Anterior';

  return name;
};

export interface ResolvedMuscleLoadResult {
  muscleLoads: Record<string, number>;
  primaryMuscles: string[];
  secondaryMuscles: string[];
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
    return { muscleLoads: {}, primaryMuscles: [], secondaryMuscles: [] };
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

      return { muscleLoads, primaryMuscles, secondaryMuscles };
    }
  }

  // 2. High-precision TKD Kick Presets matching
  const titleLower = asset.title.toLowerCase();
  for (const [presetKey, presetData] of Object.entries(TKD_KICK_PRESETS)) {
    const keyLower = presetKey.toLowerCase();
    if (
      titleLower.includes(presetData.koreanName) ||
      titleLower.includes(presetData.name.toLowerCase()) ||
      titleLower.includes(keyLower.split(' ')[0]) ||
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

      return { muscleLoads, primaryMuscles, secondaryMuscles };
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
  } else {
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

  return { muscleLoads, primaryMuscles, secondaryMuscles };
}
