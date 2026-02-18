import type { Session, Student, Evaluation, Communication, ScheduledSession, ArticulationScreener, Meeting } from '../types';
import { parse, format, isSameDay, isBefore, isAfter, setHours, setMinutes } from 'date-fns';
import {
  isLegacyDirectAssessment,
  LEGACY_ASSESSMENT_CATEGORY,
} from './meetingCategories';

interface TimeTrackingItem {
  id: string;
  type: 'session' | 'evaluation' | 'screener';
  date: string;
  data: Session | Evaluation | ArticulationScreener;
}

interface GenerateTimesheetNoteParams {
  filteredItems: TimeTrackingItem[];
  sessions: Session[];
  communications: Communication[];
  meetings?: Meeting[];
  getStudent: (studentId: string) => Student | undefined;
  getStudentInitials: (studentId: string) => string;
  getGroupSessions: (groupSessionId: string) => Session[];
  isTeletherapy: boolean;
  useSpecificTimes: boolean;
  formatTime12Hour: (dateString: string) => string;
  formatTimeRange: (startDate: string, endDate?: string) => string;
}

export const generateTimesheetNote = ({
  filteredItems,
  sessions,
  communications,
  meetings = [],
  getStudent,
  getStudentInitials,
  getGroupSessions,
  isTeletherapy,
  useSpecificTimes,
  formatTime12Hour,
  formatTimeRange,
}: GenerateTimesheetNoteParams): string => {
  const noteParts: string[] = [];

  // Filter to sessions and screeners (evaluations are separate)
  const sessionItems = filteredItems.filter(item => item.type === 'session');
  const screenerItems = filteredItems.filter(item => item.type === 'screener');

  // Separate direct services, missed direct services, and indirect services
  // Note: Per SSG SLP-SLPA billing rules, missed sessions are NOT billed or added as notes.
  // Instead, students from missed sessions are included in indirect services (lesson planning/documentation).
  const directServices: Session[] = [];
  const missedDirectServices: Session[] = []; // Track for indirect services only, not billed separately
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
          // Missed sessions: track for indirect services only, not billed separately
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
          // Missed sessions: track for indirect services only, not billed separately
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

  // Speech screening: meetings + screeners (for direct "Speech screening:" and indirect "Speech Screening Write-Up and Staff Collaboration")
  const speechScreeningMeetings = meetings.filter(
    m => m.category === 'Speech screening' && m.studentId
  );
  const speechScreeningDocStudentIds = new Set<string>();
  screenerItems.forEach(item => {
    speechScreeningDocStudentIds.add((item.data as ArticulationScreener).studentId);
  });
  speechScreeningMeetings.forEach(m => m.studentId && speechScreeningDocStudentIds.add(m.studentId));
  const speechScreeningDocEntries = Array.from(speechScreeningDocStudentIds)
    .map(studentId => {
      const initials = getStudentInitials(studentId);
      const student = getStudent(studentId);
      const grade = student?.grade || '';
      return `${initials} (${grade})`;
    })
    .sort();

  // Direct contact assessments: Initial Assessment, 3 Year Reassessment (and legacy Assessment + activitySubtype 'assessment')
  const initialAssessmentMeetings = meetings.filter(
    m => m.category === 'Initial Assessment' && m.studentId
  );
  const threeYearReassessmentDirectMeetings = meetings.filter(
    m => (m.category === '3 Year Reassessment' || isLegacyDirectAssessment(m)) && m.studentId
  );

  const shouldUseSpecificTimes = useSpecificTimes || isTeletherapy;
  const hasDirectSessions = directServices.length > 0;
  const hasScreeners = screenerItems.length > 0;
  const hasSpeechScreeningMeetings = speechScreeningMeetings.length > 0;
  const hasInitialAssessments = initialAssessmentMeetings.length > 0;
  const hasThreeYearReassessmentDirect = threeYearReassessmentDirectMeetings.length > 0;
  const hasDirectAssessments = hasInitialAssessments || hasThreeYearReassessmentDirect;

  if (hasDirectSessions || hasScreeners || hasSpeechScreeningMeetings || hasDirectAssessments) {
    const serviceLabel = isTeletherapy ? 'Offsite Direct Services:' : 'Direct services:';
    noteParts.push(serviceLabel);
    noteParts.push('');

    // Direct Therapy: treatment sessions only, with times, comma-separated on one line
    if (hasDirectSessions) {
      noteParts.push('Direct Therapy:');
      if (shouldUseSpecificTimes) {
        const timeRangeMap = new Map<string, Array<{ session: Session; timeRange: string }>>();
        directServices.forEach(session => {
          const timeRange = formatTimeRange(session.date, session.endTime);
          if (!timeRangeMap.has(timeRange)) timeRangeMap.set(timeRange, []);
          timeRangeMap.get(timeRange)!.push({ session, timeRange });
        });
        const sortedTimeRanges = Array.from(timeRangeMap.entries()).sort((a, b) => {
          const timeA = new Date(a[1][0].session.date).getTime();
          const timeB = new Date(b[1][0].session.date).getTime();
          return timeA - timeB;
        });
        const therapyEntries: string[] = [];
        sortedTimeRanges.forEach(([, sessionData]) => {
          sessionData.forEach(({ session, timeRange }) => {
            const student = getStudent(session.studentId);
            const initials = getStudentInitials(session.studentId);
            const grade = student?.grade || '';
            therapyEntries.push(`${initials} (${grade}) ${timeRange}`);
          });
        });
        noteParts.push(therapyEntries.join(', '));
      } else {
        const therapyEntries = directServices.map(session => {
          const student = getStudent(session.studentId);
          const initials = getStudentInitials(session.studentId);
          const grade = student?.grade || '';
          return `${initials} (${grade})`;
        });
        therapyEntries.sort();
        noteParts.push(therapyEntries.join(', '));
      }
    }

    // Initial Assessment: direct contact with times
    if (hasInitialAssessments) {
      if (hasDirectSessions) noteParts.push('');
      noteParts.push('Initial Assessment:');
      if (shouldUseSpecificTimes) {
        const entries: Array<{ sortTime: number; initials: string; grade: string; timeRange: string }> = [];
        initialAssessmentMeetings.forEach(meeting => {
          if (meeting.studentId) {
            entries.push({
              sortTime: new Date(meeting.date).getTime(),
              initials: getStudentInitials(meeting.studentId),
              grade: getStudent(meeting.studentId)?.grade || '',
              timeRange: formatTimeRange(meeting.date, meeting.endTime),
            });
          }
        });
        entries.sort((a, b) => a.sortTime - b.sortTime);
        noteParts.push(entries.map(e => `${e.initials} (${e.grade}) ${e.timeRange}`).join(', '));
      } else {
        const entries = initialAssessmentMeetings
          .filter(m => m.studentId)
          .map(m => `${getStudentInitials(m.studentId!)} (${getStudent(m.studentId!)?.grade || ''})`);
        entries.sort();
        noteParts.push(entries.join(', '));
      }
    }
    // 3 Year Reassessment: direct contact with times
    if (hasThreeYearReassessmentDirect) {
      if (hasDirectSessions || hasInitialAssessments) noteParts.push('');
      noteParts.push('3 Year Reassessment:');
      if (shouldUseSpecificTimes) {
        const entries: Array<{ sortTime: number; initials: string; grade: string; timeRange: string }> = [];
        threeYearReassessmentDirectMeetings.forEach(meeting => {
          if (meeting.studentId) {
            entries.push({
              sortTime: new Date(meeting.date).getTime(),
              initials: getStudentInitials(meeting.studentId),
              grade: getStudent(meeting.studentId)?.grade || '',
              timeRange: formatTimeRange(meeting.date, meeting.endTime),
            });
          }
        });
        entries.sort((a, b) => a.sortTime - b.sortTime);
        noteParts.push(entries.map(e => `${e.initials} (${e.grade}) ${e.timeRange}`).join(', '));
      } else {
        const entries = threeYearReassessmentDirectMeetings
          .filter(m => m.studentId)
          .map(m => `${getStudentInitials(m.studentId!)} (${getStudent(m.studentId!)?.grade || ''})`);
        entries.sort();
        noteParts.push(entries.join(', '));
      }
    }

    // Speech screening: screeners + speech screening meetings, comma-separated on one line with times
    if (hasScreeners || hasSpeechScreeningMeetings) {
      noteParts.push('Speech screening:');
      type SpeechScreeningEntry = { sortTime: number; initials: string; grade: string; timeRange: string };
      const screeningEntries: SpeechScreeningEntry[] = [];
      screenerItems.forEach(item => {
        const screener = item.data as ArticulationScreener;
        const timeRange = formatTimeRange(screener.date, undefined);
        screeningEntries.push({
          sortTime: new Date(screener.date).getTime(),
          initials: getStudentInitials(screener.studentId),
          grade: getStudent(screener.studentId)?.grade || '',
          timeRange,
        });
      });
      speechScreeningMeetings.forEach(meeting => {
        const timeRange = formatTimeRange(meeting.date, meeting.endTime);
        screeningEntries.push({
          sortTime: new Date(meeting.date).getTime(),
          initials: getStudentInitials(meeting.studentId!),
          grade: getStudent(meeting.studentId!)?.grade || '',
          timeRange,
        });
      });
      screeningEntries.sort((a, b) => a.sortTime - b.sortTime);
      const screeningLine = shouldUseSpecificTimes
        ? screeningEntries.map(e => `${e.initials} (${e.grade}) ${e.timeRange}`).join(', ')
        : screeningEntries.map(e => `${e.initials} (${e.grade})`).join(', ');
      noteParts.push(screeningLine);
    }

    noteParts.push(''); // Empty line after direct services
  }

  // Per SSG SLP-SLPA billing rules: Missed sessions are NOT billed or added as notes.
  // Students from missed sessions are included in indirect services instead.

  // Build indirect services entry with sub-sections
  // Collect students for each sub-section
  
  // Documentation: Students who completed a session or screener today (including preparation for missed sessions)
  // Per SSG rules: Missed sessions are replaced with indirect work (documentation/lesson planning)
  const documentationStudentIds = new Set<string>();
  directServices.forEach(session => {
    documentationStudentIds.add(session.studentId);
  });
  // Include missed session students in documentation (replacing missed work with indirect work)
  missedDirectServices.forEach(session => {
    documentationStudentIds.add(session.studentId);
  });
  // Include screener students in documentation (screener documentation notes)
  screenerItems.forEach(item => {
    const screener = item.data as ArticulationScreener;
    documentationStudentIds.add(screener.studentId);
  });
  
  // Email Correspondence: Students from communications
  // Per SSG rules: Filter out IEP/Evaluation emails (they're coded separately as IEP/Evaluation, not indirect services)
  // Only include emails for scheduling, collaboration, or intervention-based communication
  const emailCorrespondenceStudentIds = new Set<string>();
  communications.forEach(comm => {
    if (comm.studentId && comm.relatedTo) {
      const relatedToLower = comm.relatedTo.toLowerCase();
      // Exclude IEP and Evaluation emails (they're coded separately)
      if (!relatedToLower.includes('iep') && !relatedToLower.includes('evaluation') && !relatedToLower.includes('eval')) {
        emailCorrespondenceStudentIds.add(comm.studentId);
      }
    } else if (comm.studentId && !comm.relatedTo) {
      // If no relatedTo specified, assume it's indirect services (scheduling/collaboration)
      emailCorrespondenceStudentIds.add(comm.studentId);
    }
  });

  // IEP activity: split by meeting vs updates vs assessment (from meeting activitySubtype; comms → updates)
  const iepMeetings = meetings.filter(m => m.category === 'IEP');
  const iepMeetingStudentIds = new Set<string>();
  const iepUpdatesStudentIds = new Set<string>();
  const iepAssessmentStudentIds = new Set<string>();
  let iepMeetingWithoutStudent = false;
  let iepUpdatesWithoutStudent = false;
  let iepAssessmentWithoutStudent = false;
  iepMeetings.forEach(m => {
    const subtype = m.activitySubtype ?? 'meeting'; // backward compat: missing → meeting
    if (m.studentId) {
      if (subtype === 'updates') iepUpdatesStudentIds.add(m.studentId);
      else if (subtype === 'assessment') iepAssessmentStudentIds.add(m.studentId);
      else iepMeetingStudentIds.add(m.studentId);
    } else {
      if (subtype === 'updates') iepUpdatesWithoutStudent = true;
      else if (subtype === 'assessment') iepAssessmentWithoutStudent = true;
      else iepMeetingWithoutStudent = true;
    }
  });
  communications.forEach(comm => {
    if (comm.studentId && comm.relatedTo) {
      const relatedToLower = comm.relatedTo.toLowerCase();
      if (relatedToLower.includes('iep')) iepUpdatesStudentIds.add(comm.studentId);
    }
  });

  // 3 year reassessment planning (category '3 year reassessment planning' or legacy 'Assessment' with meeting/updates only; assessment subtype is direct)
  const threeYearPlanningMeetings = meetings.filter(m =>
    m.category === '3 year reassessment planning' || (m.category === LEGACY_ASSESSMENT_CATEGORY && m.activitySubtype !== 'assessment')
  );
  const threeYearPlanningMeetingStudentIds = new Set<string>();
  const threeYearPlanningUpdatesStudentIds = new Set<string>();
  let threeYearPlanningMeetingWithoutStudent = false;
  let threeYearPlanningUpdatesWithoutStudent = false;
  threeYearPlanningMeetings.forEach(m => {
    const subtype = m.activitySubtype ?? 'meeting';
    if (m.studentId) {
      if (subtype === 'updates') threeYearPlanningUpdatesStudentIds.add(m.studentId);
      else threeYearPlanningMeetingStudentIds.add(m.studentId);
    } else {
      if (subtype === 'updates') threeYearPlanningUpdatesWithoutStudent = true;
      else threeYearPlanningMeetingWithoutStudent = true;
    }
  });

  // IEP planning: meeting / updates
  const iepPlanningMeetings = meetings.filter(m => m.category === 'IEP planning');
  const iepPlanningMeetingStudentIds = new Set<string>();
  const iepPlanningUpdatesStudentIds = new Set<string>();
  let iepPlanningMeetingWithoutStudent = false;
  let iepPlanningUpdatesWithoutStudent = false;
  iepPlanningMeetings.forEach(m => {
    const subtype = m.activitySubtype ?? 'meeting';
    if (m.studentId) {
      if (subtype === 'updates') iepPlanningUpdatesStudentIds.add(m.studentId);
      else iepPlanningMeetingStudentIds.add(m.studentId);
    } else {
      if (subtype === 'updates') iepPlanningUpdatesWithoutStudent = true;
      else iepPlanningMeetingWithoutStudent = true;
    }
  });

  // Assessment planning: meeting / updates
  const assessmentPlanningMeetings = meetings.filter(m => m.category === 'Assessment planning');
  const assessmentPlanningMeetingStudentIds = new Set<string>();
  const assessmentPlanningUpdatesStudentIds = new Set<string>();
  let assessmentPlanningMeetingWithoutStudent = false;
  let assessmentPlanningUpdatesWithoutStudent = false;
  assessmentPlanningMeetings.forEach(m => {
    const subtype = m.activitySubtype ?? 'meeting';
    if (m.studentId) {
      if (subtype === 'updates') assessmentPlanningUpdatesStudentIds.add(m.studentId);
      else assessmentPlanningMeetingStudentIds.add(m.studentId);
    } else {
      if (subtype === 'updates') assessmentPlanningUpdatesWithoutStudent = true;
      else assessmentPlanningMeetingWithoutStudent = true;
    }
  });

  // Assessment documentation (indirect): single type, no meeting/updates/assessment subtype
  const assessmentDocumentationMeetings = meetings.filter(m => m.category === 'Assessment documentation');
  const assessmentDocumentationStudentIds = new Set<string>();
  let assessmentDocumentationWithoutStudent = false;
  assessmentDocumentationMeetings.forEach(m => {
    if (m.studentId) assessmentDocumentationStudentIds.add(m.studentId);
    else assessmentDocumentationWithoutStudent = true;
  });

  // Lesson Planning: All students from all sessions (missed and attended)
  // Per SSG rules: Lesson planning includes all students, including those with missed sessions
  const lessonPlanningStudentIds = new Set<string>();
  directServices.forEach(session => {
    lessonPlanningStudentIds.add(session.studentId);
  });
  missedDirectServices.forEach(session => {
    lessonPlanningStudentIds.add(session.studentId);
  });
  indirectServices.forEach(session => {
    lessonPlanningStudentIds.add(session.studentId);
  });

  // Build student entries for each sub-section
  const buildStudentEntries = (studentIds: Set<string>): string[] => {
    return Array.from(studentIds).map(studentId => {
      const student = getStudent(studentId);
      const initials = getStudentInitials(studentId);
      const grade = student?.grade || '';
      return `${initials} (${grade})`;
    }).sort();
  };

  const documentationEntries = buildStudentEntries(documentationStudentIds);
  const emailCorrespondenceEntries = buildStudentEntries(emailCorrespondenceStudentIds);
  const lessonPlanningEntries = buildStudentEntries(lessonPlanningStudentIds);
  const iepMeetingEntries = buildStudentEntries(iepMeetingStudentIds);
  const iepUpdatesEntries = buildStudentEntries(iepUpdatesStudentIds);
  const iepAssessmentEntries = buildStudentEntries(iepAssessmentStudentIds);
  const hasIEPMeeting = iepMeetingEntries.length > 0 || iepMeetingWithoutStudent;
  const hasIEPUpdates = iepUpdatesEntries.length > 0 || iepUpdatesWithoutStudent;
  const hasIEPAssessment = iepAssessmentEntries.length > 0 || iepAssessmentWithoutStudent;
  const threeYearPlanningMeetingEntries = buildStudentEntries(threeYearPlanningMeetingStudentIds);
  const threeYearPlanningUpdatesEntries = buildStudentEntries(threeYearPlanningUpdatesStudentIds);
  const hasThreeYearPlanningMeeting = threeYearPlanningMeetingEntries.length > 0 || threeYearPlanningMeetingWithoutStudent;
  const hasThreeYearPlanningUpdates = threeYearPlanningUpdatesEntries.length > 0 || threeYearPlanningUpdatesWithoutStudent;
  const iepPlanningMeetingEntries = buildStudentEntries(iepPlanningMeetingStudentIds);
  const iepPlanningUpdatesEntries = buildStudentEntries(iepPlanningUpdatesStudentIds);
  const hasIEPPlanningMeeting = iepPlanningMeetingEntries.length > 0 || iepPlanningMeetingWithoutStudent;
  const hasIEPPlanningUpdates = iepPlanningUpdatesEntries.length > 0 || iepPlanningUpdatesWithoutStudent;
  const assessmentPlanningMeetingEntries = buildStudentEntries(assessmentPlanningMeetingStudentIds);
  const assessmentPlanningUpdatesEntries = buildStudentEntries(assessmentPlanningUpdatesStudentIds);
  const hasAssessmentPlanningMeeting = assessmentPlanningMeetingEntries.length > 0 || assessmentPlanningMeetingWithoutStudent;
  const hasAssessmentPlanningUpdates = assessmentPlanningUpdatesEntries.length > 0 || assessmentPlanningUpdatesWithoutStudent;
  const assessmentDocumentationEntries = buildStudentEntries(assessmentDocumentationStudentIds);
  const hasAssessmentDocumentation = assessmentDocumentationEntries.length > 0 || assessmentDocumentationWithoutStudent;

  // Build indirect services section with sub-sections
  const indirectServiceLabel = isTeletherapy ? 'Offsite Indirect Services Including:' : 'Indirect services including:';
  noteParts.push(indirectServiceLabel);
  noteParts.push('');

  // Documentation sub-section
  if (documentationEntries.length > 0) {
    noteParts.push('Session Documentation:');
    noteParts.push(documentationEntries.join(', '));
  }

  // Email Correspondence sub-section
  if (emailCorrespondenceEntries.length > 0) {
    noteParts.push('Email Correspondence:');
    noteParts.push(emailCorrespondenceEntries.join(', '));
  }
  
  // Lesson Planning sub-section
  if (lessonPlanningEntries.length > 0) {
    noteParts.push('Lesson Planning:');
    noteParts.push(lessonPlanningEntries.join(', '));
  }

  // Speech Screening Write-Up and Staff Collaboration (indirect) - screeners + speech screening meetings
  if (speechScreeningDocEntries.length > 0) {
    noteParts.push('Speech Screening Write-Up and Staff Collaboration:');
    noteParts.push(speechScreeningDocEntries.join(', '));
  }

  // IEP meeting: / IEP updates: / IEP assessment:
  if (hasIEPMeeting) {
    noteParts.push('IEP meeting:');
    const lineParts: string[] = [...iepMeetingEntries];
    if (iepMeetingWithoutStudent) lineParts.push('IEP meeting');
    noteParts.push(lineParts.join(', '));
  }
  if (hasIEPUpdates) {
    noteParts.push('IEP updates:');
    const lineParts: string[] = [...iepUpdatesEntries];
    if (iepUpdatesWithoutStudent) lineParts.push('IEP updates');
    noteParts.push(lineParts.join(', '));
  }
  if (hasIEPAssessment) {
    noteParts.push('IEP assessment:');
    const lineParts: string[] = [...iepAssessmentEntries];
    if (iepAssessmentWithoutStudent) lineParts.push('IEP assessment');
    noteParts.push(lineParts.join(', '));
  }

  // IEP planning meeting: / IEP planning updates:
  if (hasIEPPlanningMeeting) {
    noteParts.push('IEP planning meeting:');
    const lineParts: string[] = [...iepPlanningMeetingEntries];
    if (iepPlanningMeetingWithoutStudent) lineParts.push('IEP planning meeting');
    noteParts.push(lineParts.join(', '));
  }
  if (hasIEPPlanningUpdates) {
    noteParts.push('IEP planning updates:');
    const lineParts: string[] = [...iepPlanningUpdatesEntries];
    if (iepPlanningUpdatesWithoutStudent) lineParts.push('IEP planning updates');
    noteParts.push(lineParts.join(', '));
  }
  // Assessment planning meeting: / Assessment planning updates:
  if (hasAssessmentPlanningMeeting) {
    noteParts.push('Assessment planning meeting:');
    const lineParts: string[] = [...assessmentPlanningMeetingEntries];
    if (assessmentPlanningMeetingWithoutStudent) lineParts.push('Assessment planning meeting');
    noteParts.push(lineParts.join(', '));
  }
  if (hasAssessmentPlanningUpdates) {
    noteParts.push('Assessment planning updates:');
    const lineParts: string[] = [...assessmentPlanningUpdatesEntries];
    if (assessmentPlanningUpdatesWithoutStudent) lineParts.push('Assessment planning updates');
    noteParts.push(lineParts.join(', '));
  }
  // 3 year reassessment planning meeting: / 3 year reassessment planning updates:
  if (hasThreeYearPlanningMeeting) {
    noteParts.push('3 year reassessment planning meeting:');
    const lineParts: string[] = [...threeYearPlanningMeetingEntries];
    if (threeYearPlanningMeetingWithoutStudent) lineParts.push('3 year reassessment planning meeting');
    noteParts.push(lineParts.join(', '));
  }
  if (hasThreeYearPlanningUpdates) {
    noteParts.push('3 year reassessment planning updates:');
    const lineParts: string[] = [...threeYearPlanningUpdatesEntries];
    if (threeYearPlanningUpdatesWithoutStudent) lineParts.push('3 year reassessment planning updates');
    noteParts.push(lineParts.join(', '));
  }
  // Assessment documentation (indirect activity)
  if (hasAssessmentDocumentation) {
    noteParts.push('Assessment documentation:');
    const lineParts: string[] = [...assessmentDocumentationEntries];
    if (assessmentDocumentationWithoutStudent) lineParts.push('Assessment documentation');
    noteParts.push(lineParts.join(', '));
  }

  noteParts.push(''); // Empty line after service

  // Remove trailing empty line if present
  if (noteParts.length > 0 && noteParts[noteParts.length - 1] === '') {
    noteParts.pop();
  }

  return noteParts.join('\n');
};

interface ProspectiveSessionData {
  studentId: string;
  date: Date; // Full date with time
  endDate?: Date;
  isDirectServices: boolean;
  scheduledSessionId: string;
}

interface GenerateProspectiveTimesheetNoteParams {
  scheduledSessions: ScheduledSession[];
  targetDate: string; // YYYY-MM-DD format
  meetings?: Meeting[];
  getStudent: (studentId: string) => Student | undefined;
  getStudentInitials: (studentId: string) => string;
  isTeletherapy: boolean;
  useSpecificTimes: boolean;
  formatTimeRange: (startDate: string, endDate?: string) => string;
}

export const generateProspectiveTimesheetNote = ({
  scheduledSessions,
  targetDate,
  meetings = [],
  getStudent,
  getStudentInitials,
  isTeletherapy,
  useSpecificTimes,
  formatTimeRange,
}: GenerateProspectiveTimesheetNoteParams): string => {
  const noteParts: string[] = [];

  // Parse target date
  const targetDateObj = parse(targetDate, 'yyyy-MM-dd', new Date());
  const targetDateStr = format(targetDateObj, 'yyyy-MM-dd');

  // Helper to parse date strings
  const parseDateString = (dateStr: string): Date => {
    if (dateStr.includes('T')) {
      const datePart = dateStr.split('T')[0];
      return parse(datePart, 'yyyy-MM-dd', new Date());
    }
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  };

  // Expand scheduled sessions into specific date instances for the target date
  const prospectiveSessions: ProspectiveSessionData[] = [];

  scheduledSessions.forEach(scheduled => {
    // Check active status
    if (scheduled.active === false) {
      return;
    }

    // Skip cancelled dates
    if (scheduled.cancelledDates && scheduled.cancelledDates.includes(targetDateStr)) {
      return;
    }

    const start = parseDateString(scheduled.startDate);
    const end = scheduled.endDate ? parseDateString(scheduled.endDate) : null;

    // Check if the target date falls within the scheduled session's date range
    if (isBefore(targetDateObj, start) && !isSameDay(targetDateObj, start)) {
      return;
    }
    if (end && isAfter(targetDateObj, end) && !isSameDay(targetDateObj, end)) {
      return;
    }

    let matchesPattern = false;

    // Check if the scheduled session applies to the target date
    if (scheduled.recurrencePattern === 'weekly' && scheduled.dayOfWeek) {
      const dayOfWeek = targetDateObj.getDay();
      matchesPattern = scheduled.dayOfWeek.includes(dayOfWeek);
    } else if (scheduled.recurrencePattern === 'specific-dates' && scheduled.specificDates) {
      matchesPattern = scheduled.specificDates.some(date => {
        const datePart = date.includes('T') ? date.split('T')[0] : date;
        return datePart === targetDateStr;
      });
    } else if (scheduled.recurrencePattern === 'daily') {
      matchesPattern = true;
    } else if (scheduled.recurrencePattern === 'none') {
      matchesPattern = isSameDay(targetDateObj, start);
    }

    if (!matchesPattern) {
      return;
    }

    // Calculate end time
    const [startHour, startMinute] = scheduled.startTime.split(':').map(Number);
    let endTimeStr: string;
    if (scheduled.endTime) {
      endTimeStr = scheduled.endTime;
    } else if (scheduled.duration) {
      const totalMinutes = startHour * 60 + startMinute + scheduled.duration;
      const endHour = Math.floor(totalMinutes / 60);
      const endMinute = totalMinutes % 60;
      endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    } else {
      const endMinute = startMinute + 30;
      const finalEndHour = startHour + Math.floor(endMinute / 60);
      const finalEndMinute = endMinute % 60;
      endTimeStr = `${String(finalEndHour).padStart(2, '0')}:${String(finalEndMinute).padStart(2, '0')}`;
    }

    // Create date objects with time
    const sessionStart = setMinutes(setHours(targetDateObj, startHour), startMinute);
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);
    const sessionEnd = setMinutes(setHours(targetDateObj, endHour), endMinute);

    const isDirectServices = scheduled.isDirectServices !== false; // Default to true

    // Create a session data entry for each student
    scheduled.studentIds.forEach(studentId => {
      prospectiveSessions.push({
        studentId,
        date: sessionStart,
        endDate: sessionEnd,
        isDirectServices,
        scheduledSessionId: scheduled.id,
      });
    });
  });

  // Separate direct and indirect services
  const directServices = prospectiveSessions.filter(s => s.isDirectServices);
  const indirectServices = prospectiveSessions.filter(s => !s.isDirectServices);
  const processedDirectStudents = new Set<string>();
  const processedIndirectStudents = new Set<string>();

  // Deduplicate by student (for group sessions)
  const uniqueDirectServices: ProspectiveSessionData[] = [];
  const uniqueIndirectServices: ProspectiveSessionData[] = [];

  directServices.forEach(session => {
    if (!processedDirectStudents.has(session.studentId)) {
      processedDirectStudents.add(session.studentId);
      uniqueDirectServices.push(session);
    }
  });

  indirectServices.forEach(session => {
    if (!processedIndirectStudents.has(session.studentId)) {
      processedIndirectStudents.add(session.studentId);
      uniqueIndirectServices.push(session);
    }
  });

  // Build direct services: Direct Therapy (one per line with times), Student Assessments (with times), and Speech screening (comma-separated)
  const speechScreeningMeetingsProspective = meetings.filter(
    m => m.category === 'Speech screening' && m.studentId
  );
  const initialAssessmentMeetingsProspective = meetings.filter(
    m => m.category === 'Initial Assessment' && m.studentId
  );
  const threeYearReassessmentDirectProspective = meetings.filter(
    m => (m.category === '3 Year Reassessment' || isLegacyDirectAssessment(m)) && m.studentId
  );
  const hasDirectSessionsProspective = uniqueDirectServices.length > 0;
  const hasSpeechScreeningProspective = speechScreeningMeetingsProspective.length > 0;
  const hasDirectAssessmentsProspective = initialAssessmentMeetingsProspective.length > 0 || threeYearReassessmentDirectProspective.length > 0;

  if (hasDirectSessionsProspective || hasSpeechScreeningProspective || hasDirectAssessmentsProspective) {
    const serviceLabel = isTeletherapy ? 'Offsite Direct Services:' : 'Direct services:';
    noteParts.push(serviceLabel);
    noteParts.push('');

    if (hasDirectSessionsProspective) {
      noteParts.push('Direct Therapy:');
      const shouldUseSpecificTimesProspective = useSpecificTimes || isTeletherapy;
      if (shouldUseSpecificTimesProspective) {
        const timeRangeMap = new Map<string, Array<{ session: ProspectiveSessionData; timeRange: string }>>();
        uniqueDirectServices.forEach(session => {
          const timeRange = formatTimeRange(session.date.toISOString(), session.endDate?.toISOString());
          if (!timeRangeMap.has(timeRange)) timeRangeMap.set(timeRange, []);
          timeRangeMap.get(timeRange)!.push({ session, timeRange });
        });
        const sortedTimeRanges = Array.from(timeRangeMap.entries()).sort((a, b) => {
          const timeA = a[1][0].session.date.getTime();
          const timeB = b[1][0].session.date.getTime();
          return timeA - timeB;
        });
        const therapyEntries: string[] = [];
        sortedTimeRanges.forEach(([, sessionData]) => {
          sessionData.forEach(({ session, timeRange }) => {
            const initials = getStudentInitials(session.studentId);
            const student = getStudent(session.studentId);
            const grade = student?.grade || '';
            therapyEntries.push(`${initials} (${grade}) ${timeRange}`);
          });
        });
        noteParts.push(therapyEntries.join(', '));
      } else {
        const therapyEntries = uniqueDirectServices.map(session => {
          const initials = getStudentInitials(session.studentId);
          const student = getStudent(session.studentId);
          const grade = student?.grade || '';
          return `${initials} (${grade})`;
        });
        therapyEntries.sort();
        noteParts.push(therapyEntries.join(', '));
      }
    }

    if (initialAssessmentMeetingsProspective.length > 0) {
      if (hasDirectSessionsProspective) noteParts.push('');
      noteParts.push('Initial Assessment:');
      const shouldUseSpecificTimesProspective = useSpecificTimes || isTeletherapy;
      if (shouldUseSpecificTimesProspective) {
        const entries = initialAssessmentMeetingsProspective
          .filter(m => m.studentId)
          .map(m => ({
            sortTime: new Date(m.date).getTime(),
            initials: getStudentInitials(m.studentId!),
            grade: getStudent(m.studentId!)?.grade || '',
            timeRange: formatTimeRange(m.date, m.endTime),
          }))
          .sort((a, b) => a.sortTime - b.sortTime);
        noteParts.push(entries.map(e => `${e.initials} (${e.grade}) ${e.timeRange}`).join(', '));
      } else {
        const entries = initialAssessmentMeetingsProspective
          .filter(m => m.studentId)
          .map(m => `${getStudentInitials(m.studentId!)} (${getStudent(m.studentId!)?.grade || ''})`);
        entries.sort();
        noteParts.push(entries.join(', '));
      }
    }
    if (threeYearReassessmentDirectProspective.length > 0) {
      if (hasDirectSessionsProspective || initialAssessmentMeetingsProspective.length > 0) noteParts.push('');
      noteParts.push('3 Year Reassessment:');
      const shouldUseSpecificTimesProspective = useSpecificTimes || isTeletherapy;
      if (shouldUseSpecificTimesProspective) {
        const entries = threeYearReassessmentDirectProspective
          .filter(m => m.studentId)
          .map(m => ({
            sortTime: new Date(m.date).getTime(),
            initials: getStudentInitials(m.studentId!),
            grade: getStudent(m.studentId!)?.grade || '',
            timeRange: formatTimeRange(m.date, m.endTime),
          }))
          .sort((a, b) => a.sortTime - b.sortTime);
        noteParts.push(entries.map(e => `${e.initials} (${e.grade}) ${e.timeRange}`).join(', '));
      } else {
        const entries = threeYearReassessmentDirectProspective
          .filter(m => m.studentId)
          .map(m => `${getStudentInitials(m.studentId!)} (${getStudent(m.studentId!)?.grade || ''})`);
        entries.sort();
        noteParts.push(entries.join(', '));
      }
    }

    if (hasSpeechScreeningProspective) {
      noteParts.push('Speech screening:');
      const screeningWithTimes = speechScreeningMeetingsProspective
        .map(meeting => ({
          sortTime: new Date(meeting.date).getTime(),
          initials: getStudentInitials(meeting.studentId!),
          grade: getStudent(meeting.studentId!)?.grade || '',
          timeRange: formatTimeRange(meeting.date, meeting.endTime),
        }))
        .sort((a, b) => a.sortTime - b.sortTime);
      const useTimesProspective = useSpecificTimes || isTeletherapy;
      const screeningLine = useTimesProspective
        ? screeningWithTimes.map(e => `${e.initials} (${e.grade}) ${e.timeRange}`).join(', ')
        : screeningWithTimes.map(e => `${e.initials} (${e.grade})`).join(', ');
      noteParts.push(screeningLine);
    }

    noteParts.push(''); // Empty line after direct services
  }

  // Build indirect services entry
  // For prospective notes, include all scheduled students in documentation and lesson planning
  const documentationStudentIds = new Set<string>();
  const lessonPlanningStudentIds = new Set<string>();

  uniqueDirectServices.forEach(session => {
    documentationStudentIds.add(session.studentId);
    lessonPlanningStudentIds.add(session.studentId);
  });

  uniqueIndirectServices.forEach(session => {
    lessonPlanningStudentIds.add(session.studentId);
  });

  // Build student entries for each sub-section
  const buildStudentEntries = (studentIds: Set<string>): string[] => {
    return Array.from(studentIds).map(studentId => {
      const student = getStudent(studentId);
      const initials = getStudentInitials(studentId);
      const grade = student?.grade || '';
      return `${initials} (${grade})`;
    }).sort();
  };

  const documentationEntries = buildStudentEntries(documentationStudentIds);
  const lessonPlanningEntries = buildStudentEntries(lessonPlanningStudentIds);

  // Speech screening: meetings with category "Speech screening" on target date
  const speechScreeningMeetings = meetings.filter(
    m => m.category === 'Speech screening' && m.studentId
  );
  const speechScreeningStudentEntries = speechScreeningMeetings
    .map(meeting => {
      const initials = getStudentInitials(meeting.studentId!);
      const student = getStudent(meeting.studentId!);
      const grade = student?.grade || '';
      return `${initials} (${grade})`;
    })
    .sort();

  // Assessment documentation: meetings with category "Assessment documentation" on target date
  const assessmentDocumentationMeetingsProspective = meetings.filter(
    m => m.category === 'Assessment documentation'
  );
  const assessmentDocumentationStudentEntriesProspective = assessmentDocumentationMeetingsProspective
    .filter(m => m.studentId)
    .map(meeting => {
      const initials = getStudentInitials(meeting.studentId!);
      const student = getStudent(meeting.studentId!);
      const grade = student?.grade || '';
      return `${initials} (${grade})`;
    })
    .sort();
  const hasAssessmentDocumentationProspective =
    assessmentDocumentationStudentEntriesProspective.length > 0 ||
    assessmentDocumentationMeetingsProspective.some(m => !m.studentId);

  // Build indirect services section
  const indirectServiceLabel = isTeletherapy ? 'Offsite Indirect Services Including:' : 'Indirect services including:';
  noteParts.push(indirectServiceLabel);
  noteParts.push('');

  // Documentation sub-section
  if (documentationEntries.length > 0) {
    noteParts.push('Session Documentation:');
    noteParts.push(documentationEntries.join(', '));
  }

  // Email Correspondence sub-section - skip for prospective notes (can't predict emails)
  
  // Lesson Planning sub-section
  if (lessonPlanningEntries.length > 0) {
    noteParts.push('Lesson Planning:');
    noteParts.push(lessonPlanningEntries.join(', '));
  }

  // Speech Screening Write-Up and Staff Collaboration (indirect only)
  if (speechScreeningStudentEntries.length > 0) {
    noteParts.push('Speech Screening Write-Up and Staff Collaboration:');
    noteParts.push(speechScreeningStudentEntries.join(', '));
  }

  // Assessment documentation (indirect activity)
  if (hasAssessmentDocumentationProspective) {
    noteParts.push('Assessment documentation:');
    const lineParts: string[] = [...assessmentDocumentationStudentEntriesProspective];
    if (assessmentDocumentationMeetingsProspective.some(m => !m.studentId)) lineParts.push('Assessment documentation');
    noteParts.push(lineParts.join(', '));
  }

  noteParts.push(''); // Empty line after service

  // Remove trailing empty line if present
  if (noteParts.length > 0 && noteParts[noteParts.length - 1] === '') {
    noteParts.pop();
  }

  return noteParts.join('\n');
};

