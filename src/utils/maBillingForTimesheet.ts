import type { MaBillingLogDocStudent, MaBillingLogEvalStudent, MaBillingLogStudent } from '../types';
import type { MaBillingStudentForTimesheet } from './timesheetNoteGenerator';

export interface MaBillingDataForTimesheet {
  sessionStudents: MaBillingStudentForTimesheet[];
  evalStudents: MaBillingLogEvalStudent[];
  docStudents: MaBillingLogDocStudent[];
}

export function mapMaBillingStudentsForTimesheet(
  students: MaBillingLogStudent[]
): MaBillingStudentForTimesheet[] {
  return students.map((s) => ({
    initials: s.initials,
    grade: s.grade,
    sessionCount: s.sessionCount,
  }));
}

function maBillingInitialsGradeKey(initials: string, grade: string): string {
  return `${initials}\0${grade}`;
}

/** Merge session + eval + doc MA billing into one timesheet list (sum counts per initials+grade). */
export function mergeMaBillingForTimesheet(
  sessionStudents: MaBillingStudentForTimesheet[],
  evalStudents: MaBillingLogEvalStudent[],
  docStudents: MaBillingLogDocStudent[],
  options: { includeSession: boolean; includeEval: boolean }
): MaBillingStudentForTimesheet[] {
  const byKey = new Map<string, MaBillingStudentForTimesheet>();

  const addCount = (initials: string, grade: string, count: number) => {
    if (count <= 0) return;
    const key = maBillingInitialsGradeKey(initials, grade);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, { ...existing, sessionCount: existing.sessionCount + count });
    } else {
      byKey.set(key, { initials, grade, sessionCount: count });
    }
  };

  if (options.includeSession) {
    for (const s of sessionStudents) {
      addCount(s.initials, s.grade, s.sessionCount);
    }
  }

  if (options.includeEval) {
    for (const s of evalStudents) {
      addCount(s.initials, s.grade, s.evalCount);
    }
    for (const s of docStudents) {
      addCount(s.initials, s.grade, s.docCount);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.initials.localeCompare(b.initials));
}

export function hasMaBillingDataForTimesheet(
  data: MaBillingDataForTimesheet,
  options: { includeSession: boolean; includeEval: boolean }
): boolean {
  return (
    mergeMaBillingForTimesheet(
      data.sessionStudents,
      data.evalStudents,
      data.docStudents,
      options
    ).length > 0
  );
}
