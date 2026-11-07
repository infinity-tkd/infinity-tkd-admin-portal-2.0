import type { AssetMuscleRelation, CurriculumVideo, Muscle, StudentVideoProgress } from '@/lib/store';
import type { Atlas } from '@/lib/atlas/anatomy';
import { normalizeMuscleNameFor3D } from '@/lib/anatomyUtils';

export interface AnatomyContext {
  kind: 'student' | 'material' | 'library';
  title: string;
  subtitle?: string;
  sourceLabel?: string;
  studentId?: string;
  assetId?: number;
  completedAssetIds?: number[];
  onOpenMaterial?: (assetId: number) => void;
}

interface AnatomyData {
  muscles?: Muscle[];
  assetMuscleRelations?: AssetMuscleRelation[];
  curriculumVideos?: CurriculumVideo[];
  videoProgress?: StudentVideoProgress[];
}

/** Completed learning coverage, never a measurement of fatigue, strength or injury. */
export function resolveStudentMuscleLoads(studentId: string, data: AnatomyData) {
  const completedAssetIds = [...new Set((data.videoProgress ?? [])
    .filter(row => row.studentId === studentId && row.status === 'Completed')
    .map(row => row.videoId))];
  const completed = new Set(completedAssetIds);
  const muscles = new Map((data.muscles ?? []).map(row => [row.id, row]));
  const perMaterial = new Map<number, Map<string, number>>();
  for (const relation of data.assetMuscleRelations ?? []) {
    if (!completed.has(relation.assetId)) continue;
    const muscle = muscles.get(relation.muscleId);
    if (!muscle) continue;
    const group = normalizeMuscleNameFor3D(muscle.name);
    const scores = perMaterial.get(relation.assetId) ?? new Map<string, number>();
    scores.set(group, Math.max(scores.get(group) ?? 0, relation.role === 'Primary' ? 1 : 0.55));
    perMaterial.set(relation.assetId, scores);
  }
  const muscleLoads: Record<string, number> = {};
  for (const scores of perMaterial.values()) for (const [group, score] of scores) {
    muscleLoads[group] = (muscleLoads[group] ?? 0) + score;
  }
  return { muscleLoads, maxLoad: Math.max(1, ...Object.values(muscleLoads)), completedAssetIds };
}

export function relatedMaterialsForMuscle(name: string, data: AnatomyData, studentId?: string) {
  const group = normalizeMuscleNameFor3D(name).toLowerCase();
  const muscleIds = new Set((data.muscles ?? [])
    .filter(muscle => normalizeMuscleNameFor3D(muscle.name).toLowerCase() === group)
    .map(muscle => muscle.id));
  const roles = new Map<number, 'Primary' | 'Secondary'>();
  for (const relation of data.assetMuscleRelations ?? []) {
    if (!muscleIds.has(relation.muscleId)) continue;
    if (roles.get(relation.assetId) !== 'Primary') roles.set(relation.assetId, relation.role);
  }
  const completed = new Set((data.videoProgress ?? []).filter(row => row.studentId === studentId && row.status === 'Completed').map(row => row.videoId));
  return (data.curriculumVideos ?? []).filter(asset => roles.has(asset.id)).map(asset => ({
    asset, role: roles.get(asset.id)!, completed: completed.has(asset.id),
  })).sort((a, b) => Number(b.role === 'Primary') - Number(a.role === 'Primary') || a.asset.title.localeCompare(b.asset.title));
}

/** Preserve exact saved element links; use training groups only when no exact mapping is available. */
export function atlasMuscleSelection(atlas: Atlas, name: string, muscles: Muscle[] = []) {
  const group = normalizeMuscleNameFor3D(name).toLowerCase();
  const records = muscles.filter(muscle => muscle.name.toLowerCase() === name.toLowerCase());
  const explicit = new Set(records.flatMap(muscle => muscle.elementIds ?? []));
  const concepts = new Set(records.map(muscle => muscle.conceptId).filter(Boolean));
  const exact = atlas.parts.filter(part => explicit.has(part.id) || concepts.has(part.conceptId));
  if (exact.length) return exact.map(part => part.id);
  return atlas.parts.filter(part => normalizeMuscleNameFor3D(part.name).toLowerCase() === group).map(part => part.id);
}
