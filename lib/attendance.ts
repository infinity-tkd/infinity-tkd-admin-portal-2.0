type Record = { id: number; studentId: string; date: string; classId?: number; status: 'Present' | 'Late' | 'Absent' };

/** A selected class never inherits another class's mark. Daily marks take precedence in the combined roster. */
export function rosterAttendance<T extends Record>(records: T[], date: string, classId?: number): Map<string, T> {
  const result = new Map<string, T>();
  const weight = { Present: 3, Late: 2, Absent: 1 };
  for (const record of records) {
    if (record.date !== date || (classId !== undefined && record.classId !== classId)) continue;
    const existing = result.get(record.studentId);
    if (!existing) { result.set(record.studentId, record); continue; }
    const daily = record.classId == null;
    const existingDaily = existing.classId == null;
    if ((daily && !existingDaily) || (daily === existingDaily &&
      (weight[record.status] > weight[existing.status] || (weight[record.status] === weight[existing.status] && record.id > existing.id)))) {
      result.set(record.studentId, record);
    }
  }
  return result;
}
