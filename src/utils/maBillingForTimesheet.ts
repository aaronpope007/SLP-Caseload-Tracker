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

export function hasMaBillingDataForTimesheet(
  data: MaBillingDataForTimesheet,
  options: { includeSession: boolean; includeEval: boolean }
): boolean {
  return (
    (options.includeSession && data.sessionStudents.length > 0) ||
    (options.includeEval &&
      (data.evalStudents.length > 0 || data.docStudents.length > 0))
  );
}
