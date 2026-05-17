/** Mirrors api/src/utils/studentInitials.ts — keep collision logic in sync. */

export interface StudentForInitials {
  studentId: string;
  name: string;
  grade: string;
}

function splitStudentName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function initialsForName(firstName: string, lastName: string, firstNameLetterCount: number): string {
  const n = Math.max(1, firstNameLetterCount);
  const first = firstName.slice(0, n).toUpperCase();
  if (!lastName) {
    return first;
  }
  return first + lastName[0].toUpperCase();
}

/**
 * Assign unique initials per student; expand first-name prefix on initials+grade collisions.
 */
export function generateInitialsListFrontend(students: StudentForInitials[]): Map<string, string> {
  const parsed = students.map((s) => {
    const { firstName, lastName } = splitStudentName(s.name);
    return {
      studentId: s.studentId,
      firstName,
      lastName,
      grade: (s.grade ?? '').trim(),
    };
  });

  const firstNameLen = new Map<string, number>();
  for (const s of parsed) {
    firstNameLen.set(s.studentId, 1);
  }

  let hasCollision = true;
  while (hasCollision) {
    hasCollision = false;
    const byKey = new Map<string, string[]>();

    for (const s of parsed) {
      const len = firstNameLen.get(s.studentId) ?? 1;
      const initials = initialsForName(s.firstName, s.lastName, len);
      const key = `${initials}\0${s.grade}`;
      if (!byKey.has(key)) {
        byKey.set(key, []);
      }
      byKey.get(key)!.push(s.studentId);
    }

    for (const ids of byKey.values()) {
      if (ids.length > 1) {
        hasCollision = true;
        for (const id of ids) {
          firstNameLen.set(id, (firstNameLen.get(id) ?? 1) + 1);
        }
      }
    }
  }

  const result = new Map<string, string>();
  for (const s of parsed) {
    const len = firstNameLen.get(s.studentId) ?? 1;
    result.set(s.studentId, initialsForName(s.firstName, s.lastName, len));
  }
  return result;
}
