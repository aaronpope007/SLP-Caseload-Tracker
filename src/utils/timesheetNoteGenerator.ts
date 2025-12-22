import type { Session, Student, School, Evaluation, Lunch } from '../types';

interface TimeTrackingItem {
  id: string;
  type: 'session' | 'evaluation' | 'lunch';
  date: string;
  data: Session | Evaluation | Lunch;
}

interface GenerateTimesheetNoteParams {
  filteredItems: TimeTrackingItem[];
  sessions: Session[];
  getStudent: (studentId: string) => Student | undefined;
  getStudentInitials: (studentId: string) => string;
  getGroupSessions: (groupSessionId: string) => Session[];
  isTeletherapy: boolean;
}

export const generateTimesheetNote = ({
  filteredItems,
  sessions,
  getStudent,
  getStudentInitials,
  getGroupSessions,
  isTeletherapy,
}: GenerateTimesheetNoteParams): string => {
  const noteParts: string[] = [];

  // Filter to only sessions (not evaluations or lunches)
  const sessionItems = filteredItems.filter(item => item.type === 'session');

  // Separate direct services, missed direct services, and indirect services
  const directServices: Session[] = [];
  const missedDirectServices: Session[] = [];
  const indirectServices: Session[] = [];
  const processedDirectGroupIds = new Set<string>();
  const processedMissedGroupIds = new Set<string>();
  const processedIndirectGroupIds = new Set<string>();
  const processedDirectStudents = new Set<string>();
  const processedMissedStudents = new Set<string>();
  const processedIndirectStudents = new Set<string>();

  sessionItems.forEach(item => {
    const session = item.data as Session;
    if (session.isDirectServices) {
      // For group sessions, collect all students from the group
      if (session.groupSessionId) {
        if (session.missedSession) {
          if (!processedMissedGroupIds.has(session.groupSessionId)) {
            processedMissedGroupIds.add(session.groupSessionId);
            const groupSessions = getGroupSessions(session.groupSessionId);
            groupSessions.forEach(s => {
              if (!processedMissedStudents.has(s.studentId)) {
                processedMissedStudents.add(s.studentId);
                missedDirectServices.push(s);
              }
            });
          }
        } else {
          if (!processedDirectGroupIds.has(session.groupSessionId)) {
            processedDirectGroupIds.add(session.groupSessionId);
            const groupSessions = getGroupSessions(session.groupSessionId);
            groupSessions.forEach(s => {
              if (!processedDirectStudents.has(s.studentId)) {
                processedDirectStudents.add(s.studentId);
                directServices.push(s);
              }
            });
          }
        }
      } else {
        if (session.missedSession) {
          if (!processedMissedStudents.has(session.studentId)) {
            processedMissedStudents.add(session.studentId);
            missedDirectServices.push(session);
          }
        } else {
          if (!processedDirectStudents.has(session.studentId)) {
            processedDirectStudents.add(session.studentId);
            directServices.push(session);
          }
        }
      }
    } else {
      // Indirect services
      if (session.groupSessionId) {
        if (!processedIndirectGroupIds.has(session.groupSessionId)) {
          processedIndirectGroupIds.add(session.groupSessionId);
          const groupSessions = getGroupSessions(session.groupSessionId);
          groupSessions.forEach(s => {
            if (!processedIndirectStudents.has(s.studentId)) {
              processedIndirectStudents.add(s.studentId);
              indirectServices.push(s);
            }
          });
        }
      } else {
        if (!processedIndirectStudents.has(session.studentId)) {
          processedIndirectStudents.add(session.studentId);
          indirectServices.push(session);
        }
      }
    }
  });

  // Build direct services entry
  if (directServices.length > 0) {
    const directStudentEntries = directServices.map(session => {
      const student = getStudent(session.studentId);
      const initials = getStudentInitials(session.studentId);
      const grade = student?.grade || '';
      return `${initials} (${grade})`;
    });

    // Sort by initials for consistency
    directStudentEntries.sort();

    const serviceLabel = isTeletherapy ? 'Offsite Direct services:' : 'Direct services:';
    noteParts.push(serviceLabel);
    noteParts.push(directStudentEntries.join(', '));
    noteParts.push(''); // Empty line after service
  }

  // Build missed direct services entry
  if (missedDirectServices.length > 0) {
    const missedStudentEntries = missedDirectServices.map(session => {
      const student = getStudent(session.studentId);
      const initials = getStudentInitials(session.studentId);
      const grade = student?.grade || '';
      return `${initials} (${grade})`;
    });

    // Sort by initials for consistency
    missedStudentEntries.sort();

    const serviceLabel = isTeletherapy ? 'Offsite Missed Direct services:' : 'Missed Direct services:';
    noteParts.push(serviceLabel);
    noteParts.push(missedStudentEntries.join(', '));
    noteParts.push(''); // Empty line after service
  }

  // Build indirect services entry - include ALL students from direct, missed, and indirect services
  // Collect all unique student IDs from all service types
  const allStudentIds = new Set<string>();
  directServices.forEach(session => {
    allStudentIds.add(session.studentId);
  });
  missedDirectServices.forEach(session => {
    allStudentIds.add(session.studentId);
  });
  indirectServices.forEach(session => {
    allStudentIds.add(session.studentId);
  });

  // Build student entries list from all students
  const studentEntries = Array.from(allStudentIds).map(studentId => {
    const student = getStudent(studentId);
    const initials = getStudentInitials(studentId);
    const grade = student?.grade || '';
    return `${initials} (${grade})`;
  });

  // Sort by initials for consistency
  studentEntries.sort();

  // Collect all unique activities from indirect services sessions
  const allActivities = new Set<string>();
  indirectServices.forEach(session => {
    session.activitiesUsed?.forEach(activity => {
      if (activity.trim()) {
        allActivities.add(activity.trim());
      }
    });
  });

  // Always include the default 3 activities
  allActivities.add('Email Correspondence');
  allActivities.add('Documentation');
  allActivities.add('Lesson Planning');

  // Convert to array and sort
  const activitiesArray = Array.from(allActivities).sort();

  const indirectServiceLabel = isTeletherapy ? 'Offsite Indirect services:' : 'Indirect services:';
  noteParts.push(indirectServiceLabel);
  noteParts.push(studentEntries.join(', '));
  activitiesArray.forEach(activity => {
    noteParts.push(activity);
  });
  noteParts.push(''); // Empty line after service

  // Remove trailing empty line if present
  if (noteParts.length > 0 && noteParts[noteParts.length - 1] === '') {
    noteParts.pop();
  }

  return noteParts.join('\n');
};

