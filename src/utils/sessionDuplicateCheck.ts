import type { Session } from '../types';
import { checkDuplicateSession } from './api';
import { fromLocalDateTimeString } from './helpers';

/**
 * Returns true if any selected student already has a non-missed session with the same start instant.
 */
export async function sessionSaveHasTimeDuplicate(options: {
  formDate: string;
  studentIds: string[];
  editingSession: Session | null;
  editingGroupSessionId: string | null;
  /** When editing a group, pass sessions that share `editingGroupSessionId` (from a recent getSessions() or props). */
  groupSessionsForEdit: Session[];
}): Promise<boolean> {
  const dateYmd = options.formDate.slice(0, 10);
  const startIso = fromLocalDateTimeString(options.formDate);

  for (const studentId of options.studentIds) {
    let excludeId: string | undefined;

    if (options.editingGroupSessionId) {
      const existing = options.groupSessionsForEdit.find(
        (s) => s.studentId === studentId && s.groupSessionId === options.editingGroupSessionId
      );
      excludeId = existing?.id;
    } else if (
      options.editingSession &&
      options.studentIds.includes(options.editingSession.studentId) &&
      studentId === options.editingSession.studentId
    ) {
      excludeId = options.editingSession.id;
    }

    const { duplicate } = await checkDuplicateSession({
      studentId,
      date: dateYmd,
      startTime: startIso,
      excludeId,
    });
    if (duplicate) return true;
  }
  return false;
}
