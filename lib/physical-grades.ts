/** A coach assessment score for the student radar chart: 0–10 with at most one decimal (never 0–100). */
export function isCoachScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

/** Reads a score field: blank clears the score (null); anything else must be a valid 0–10 score. */
export function parseCoachScore(input: string): number | null | 'invalid' {
  const text = input.trim();
  if (!text) return null;
  const value = Number(text);
  return isCoachScore(value) ? value : 'invalid';
}

/** Binary legacy labels have no approved conversion to the academy's 1–4 scale. */
export function physicalGradeScore(grade: unknown): number | null {
  const values: Record<string, number> = { 'Needs Work': 1, F: 1, Developing: 2, C: 2, Proficient: 3, B: 3, Outstanding: 4, A: 4 };
  return typeof grade === 'string' && Object.hasOwn(values, grade) ? values[grade] : null;
}
