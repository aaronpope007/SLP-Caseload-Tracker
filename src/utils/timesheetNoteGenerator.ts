import type { Session, Student, Evaluation, Communication, ScheduledSession } from '../types';
import { parse, format, isSameDay, isBefore, isAfter, setHours, setMinutes } from 'date-fns';

interface TimeTrackingItem {
  id: string;
  type: 'session' | 'evaluation';
  date: string;
  data: Session | Evaluation;
}

interface GenerateTimesheetNoteParams {
  filteredItems: TimeTrackingItem[];
  sessions: Session[];
  communications: Communication[];
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
  getStudent,
  getStudentInitials,
  getGroupSessions,
  isTeletherapy,
  useSpecificTimes,
  formatTime12Hour,
  formatTimeRange,
}: GenerateTimesheetNoteParams): string => {
  const noteParts: string[] = [];

  // Filter to only sessions (not evaluations)
  const sessionItems = filteredItems.filter(item => item.type === 'session');

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

  // Build direct services entry
  // Per SSG SLP-SLPA billing rules: For tele services, exact time in/out is REQUIRED for each direct session
  if (directServices.length > 0) {
    let directStudentEntries: string[];
    
    // For tele services, always require specific times
    const shouldUseSpecificTimes = useSpecificTimes || isTeletherapy;
    
    if (shouldUseSpecificTimes) {
      // Group sessions by time range and create entries with times
      const timeRangeMap = new Map<string, Array<{ session: Session; timeRange: string }>>();
      
      directServices.forEach(session => {
        const timeRange = formatTimeRange(session.date, session.endTime);
        const key = timeRange;
        
        if (!timeRangeMap.has(key)) {
          timeRangeMap.set(key, []);
        }
        timeRangeMap.get(key)!.push({ session, timeRange });
      });
      
      // Build entries: "FG (5) 8:10am-8:30am, AS (2) 8:30am-8:50am"
      const entries: string[] = [];
      const sortedTimeRanges = Array.from(timeRangeMap.entries()).sort((a, b) => {
        // Sort by start time
        const timeA = new Date(a[1][0].session.date).getTime();
        const timeB = new Date(b[1][0].session.date).getTime();
        return timeA - timeB;
      });
      
      sortedTimeRanges.forEach(([timeRange, sessionData]) => {
        const studentEntries = sessionData.map(({ session }) => {
          const student = getStudent(session.studentId);
          const initials = getStudentInitials(session.studentId);
          const grade = student?.grade || '';
          return { entry: `${initials} (${grade}) ${timeRange}`, initials };
        });
        // Sort by initials within each time range group
        studentEntries.sort((a, b) => a.initials.localeCompare(b.initials));
        entries.push(...studentEntries.map(e => e.entry));
      });
      
      directStudentEntries = entries;
    } else {
      // Original format without times
      directStudentEntries = directServices.map(session => {
        const student = getStudent(session.studentId);
        const initials = getStudentInitials(session.studentId);
        const grade = student?.grade || '';
        return `${initials} (${grade})`;
      });
      // Sort by initials for consistency
      directStudentEntries.sort();
    }

    const serviceLabel = isTeletherapy ? 'Offsite Direct services:' : 'Direct services:';
    noteParts.push(serviceLabel);
    noteParts.push(directStudentEntries.join(', '));
    noteParts.push(''); // Empty line after service
  }

  // Per SSG SLP-SLPA billing rules: Missed sessions are NOT billed or added as notes.
  // Students from missed sessions are included in indirect services instead.

  // Build indirect services entry with sub-sections
  // Collect students for each sub-section
  
  // Documentation: Students who completed a session today (including preparation for missed sessions)
  // Per SSG rules: Missed sessions are replaced with indirect work (documentation/lesson planning)
  const documentationStudentIds = new Set<string>();
  directServices.forEach(session => {
    documentationStudentIds.add(session.studentId);
  });
  // Include missed session students in documentation (replacing missed work with indirect work)
  missedDirectServices.forEach(session => {
    documentationStudentIds.add(session.studentId);
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

  // Build indirect services section with sub-sections
  const indirectServiceLabel = isTeletherapy ? 'Offsite Indirect services including:' : 'Indirect services including:';
  noteParts.push(indirectServiceLabel);
  
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
  getStudent: (studentId: string) => Student | undefined;
  getStudentInitials: (studentId: string) => string;
  isTeletherapy: boolean;
  useSpecificTimes: boolean;
  formatTimeRange: (startDate: string, endDate?: string) => string;
}

export const generateProspectiveTimesheetNote = ({
  scheduledSessions,
  targetDate,
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

  // Build direct services entry
  if (uniqueDirectServices.length > 0) {
    let directStudentEntries: string[];
    
    const shouldUseSpecificTimes = useSpecificTimes || isTeletherapy;
    
    if (shouldUseSpecificTimes) {
      // Group by time range and create entries with times
      const timeRangeMap = new Map<string, Array<{ session: ProspectiveSessionData; timeRange: string }>>();
      
      uniqueDirectServices.forEach(session => {
        const timeRange = formatTimeRange(session.date.toISOString(), session.endDate?.toISOString());
        const key = timeRange;
        
        if (!timeRangeMap.has(key)) {
          timeRangeMap.set(key, []);
        }
        timeRangeMap.get(key)!.push({ session, timeRange });
      });
      
      // Build entries sorted by time
      const entries: string[] = [];
      const sortedTimeRanges = Array.from(timeRangeMap.entries()).sort((a, b) => {
        const timeA = a[1][0].session.date.getTime();
        const timeB = b[1][0].session.date.getTime();
        return timeA - timeB;
      });
      
      sortedTimeRanges.forEach(([timeRange, sessionData]) => {
        const studentEntries = sessionData.map(({ session }) => {
          const initials = getStudentInitials(session.studentId);
          const student = getStudent(session.studentId);
          const grade = student?.grade || '';
          return { entry: `${initials} (${grade}) ${timeRange}`, initials };
        });
        studentEntries.sort((a, b) => a.initials.localeCompare(b.initials));
        entries.push(...studentEntries.map(e => e.entry));
      });
      
      directStudentEntries = entries;
    } else {
      directStudentEntries = uniqueDirectServices.map(session => {
        const initials = getStudentInitials(session.studentId);
        const student = getStudent(session.studentId);
        const grade = student?.grade || '';
        return `${initials} (${grade})`;
      });
      directStudentEntries.sort();
    }

    const serviceLabel = isTeletherapy ? 'Offsite Direct services:' : 'Direct services:';
    noteParts.push(serviceLabel);
    noteParts.push(directStudentEntries.join(', '));
    noteParts.push(''); // Empty line after service
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

  // Build indirect services section
  const indirectServiceLabel = isTeletherapy ? 'Offsite Indirect services including:' : 'Indirect services including:';
  noteParts.push(indirectServiceLabel);
  
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
  
  noteParts.push(''); // Empty line after service

  // Remove trailing empty line if present
  if (noteParts.length > 0 && noteParts[noteParts.length - 1] === '') {
    noteParts.pop();
  }

  return noteParts.join('\n');
};

