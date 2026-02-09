import type { Session, Student, Evaluation, Communication, ScheduledSession, ArticulationScreener, Meeting } from '../types';
import { parse, format, isSameDay, isBefore, isAfter, setHours, setMinutes } from 'date-fns';

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

  // Student Assessments: 3 year assessment meetings with activitySubtype === 'assessment'
  const studentAssessmentMeetings = meetings.filter(
    m => m.category === '3 year assessment' && m.activitySubtype === 'assessment' && m.studentId
  );

  // Build direct services: "Direct Therapy:" (sessions with times, one per line), "Student Assessments:" (with times), and "Speech screening:" (comma-separated)
  const shouldUseSpecificTimes = useSpecificTimes || isTeletherapy;
  const hasDirectSessions = directServices.length > 0;
  const hasScreeners = screenerItems.length > 0;
  const hasSpeechScreeningMeetings = speechScreeningMeetings.length > 0;
  const hasStudentAssessments = studentAssessmentMeetings.length > 0;

  if (hasDirectSessions || hasScreeners || hasSpeechScreeningMeetings || hasStudentAssessments) {
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

    // Student Assessments: 3 year assessment meetings with activitySubtype === 'assessment', with times
    if (hasStudentAssessments) {
      // Add blank line for visual separation if Direct Therapy section exists above
      if (hasDirectSessions) {
        noteParts.push('');
      }
      noteParts.push('Student Assessments:');
      if (shouldUseSpecificTimes) {
        const assessmentEntries: Array<{ sortTime: number; initials: string; grade: string; timeRange: string }> = [];
        studentAssessmentMeetings.forEach(meeting => {
          if (meeting.studentId) {
            const timeRange = formatTimeRange(meeting.date, meeting.endTime);
            assessmentEntries.push({
              sortTime: new Date(meeting.date).getTime(),
              initials: getStudentInitials(meeting.studentId),
              grade: getStudent(meeting.studentId)?.grade || '',
              timeRange,
            });
          }
        });
        assessmentEntries.sort((a, b) => a.sortTime - b.sortTime);
        const assessmentLine = assessmentEntries.map(e => `${e.initials} (${e.grade}) ${e.timeRange}`).join(', ');
        noteParts.push(assessmentLine);
      } else {
        const assessmentEntries = studentAssessmentMeetings
          .filter(m => m.studentId)
          .map(meeting => {
            const initials = getStudentInitials(meeting.studentId!);
            const student = getStudent(meeting.studentId!);
            const grade = student?.grade || '';
            return `${initials} (${grade})`;
          });
        assessmentEntries.sort();
        noteParts.push(assessmentEntries.join(', '));
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

  // 3 Year Reassessment: split by meeting vs updates vs assessment (from meeting activitySubtype)
  const threeYearReassessmentMeetings = meetings.filter(m => m.category === '3 year assessment');
  const threeYearMeetingStudentIds = new Set<string>();
  const threeYearUpdatesStudentIds = new Set<string>();
  const threeYearAssessmentStudentIds = new Set<string>();
  let threeYearMeetingWithoutStudent = false;
  let threeYearUpdatesWithoutStudent = false;
  let threeYearAssessmentWithoutStudent = false;
  threeYearReassessmentMeetings.forEach(m => {
    const subtype = m.activitySubtype ?? 'meeting';
    if (m.studentId) {
      if (subtype === 'updates') threeYearUpdatesStudentIds.add(m.studentId);
      else if (subtype === 'assessment') threeYearAssessmentStudentIds.add(m.studentId);
      else threeYearMeetingStudentIds.add(m.studentId);
    } else {
      if (subtype === 'updates') threeYearUpdatesWithoutStudent = true;
      else if (subtype === 'assessment') threeYearAssessmentWithoutStudent = true;
      else threeYearMeetingWithoutStudent = true;
    }
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
  const threeYearMeetingEntries = buildStudentEntries(threeYearMeetingStudentIds);
  const threeYearUpdatesEntries = buildStudentEntries(threeYearUpdatesStudentIds);
  const threeYearAssessmentEntries = buildStudentEntries(threeYearAssessmentStudentIds);
  const hasThreeYearMeeting = threeYearMeetingEntries.length > 0 || threeYearMeetingWithoutStudent;
  const hasThreeYearUpdates = threeYearUpdatesEntries.length > 0 || threeYearUpdatesWithoutStudent;
  const hasThreeYearAssessment = threeYearAssessmentEntries.length > 0 || threeYearAssessmentWithoutStudent;

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

  // 3 year reassessment meeting: / 3 year reassessment updates: / 3 year reassessment assessment:
  if (hasThreeYearMeeting) {
    noteParts.push('3 year reassessment meeting:');
    const lineParts: string[] = [...threeYearMeetingEntries];
    if (threeYearMeetingWithoutStudent) lineParts.push('3 year reassessment meeting');
    noteParts.push(lineParts.join(', '));
  }
  if (hasThreeYearUpdates) {
    noteParts.push('3 year reassessment updates:');
    const lineParts: string[] = [...threeYearUpdatesEntries];
    if (threeYearUpdatesWithoutStudent) lineParts.push('3 year reassessment updates');
    noteParts.push(lineParts.join(', '));
  }
  if (hasThreeYearAssessment) {
    noteParts.push('3 year reassessment assessment:');
    const lineParts: string[] = [...threeYearAssessmentEntries];
    if (threeYearAssessmentWithoutStudent) lineParts.push('3 year reassessment assessment');
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
  const studentAssessmentMeetingsProspective = meetings.filter(
    m => m.category === '3 year assessment' && m.activitySubtype === 'assessment' && m.studentId
  );
  const hasDirectSessionsProspective = uniqueDirectServices.length > 0;
  const hasSpeechScreeningProspective = speechScreeningMeetingsProspective.length > 0;
  const hasStudentAssessmentsProspective = studentAssessmentMeetingsProspective.length > 0;

  if (hasDirectSessionsProspective || hasSpeechScreeningProspective || hasStudentAssessmentsProspective) {
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

    // Student Assessments: 3 year assessment meetings with activitySubtype === 'assessment', with times
    if (hasStudentAssessmentsProspective) {
      // Add blank line for visual separation if Direct Therapy section exists above
      if (hasDirectSessionsProspective) {
        noteParts.push('');
      }
      noteParts.push('Student Assessments:');
      const shouldUseSpecificTimesProspective = useSpecificTimes || isTeletherapy;
      if (shouldUseSpecificTimesProspective) {
        const assessmentEntries: Array<{ sortTime: number; initials: string; grade: string; timeRange: string }> = [];
        studentAssessmentMeetingsProspective.forEach(meeting => {
          if (meeting.studentId) {
            const timeRange = formatTimeRange(meeting.date, meeting.endTime);
            assessmentEntries.push({
              sortTime: new Date(meeting.date).getTime(),
              initials: getStudentInitials(meeting.studentId),
              grade: getStudent(meeting.studentId)?.grade || '',
              timeRange,
            });
          }
        });
        assessmentEntries.sort((a, b) => a.sortTime - b.sortTime);
        const assessmentLine = assessmentEntries.map(e => `${e.initials} (${e.grade}) ${e.timeRange}`).join(', ');
        noteParts.push(assessmentLine);
      } else {
        const assessmentEntries = studentAssessmentMeetingsProspective
          .filter(m => m.studentId)
          .map(meeting => {
            const initials = getStudentInitials(meeting.studentId!);
            const student = getStudent(meeting.studentId!);
            const grade = student?.grade || '';
            return `${initials} (${grade})`;
          });
        assessmentEntries.sort();
        noteParts.push(assessmentEntries.join(', '));
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

  noteParts.push(''); // Empty line after service

  // Remove trailing empty line if present
  if (noteParts.length > 0 && noteParts[noteParts.length - 1] === '') {
    noteParts.pop();
  }

  return noteParts.join('\n');
};

