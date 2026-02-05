import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from 'react';
import { logError } from '../utils/logger';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today as TodayIcon,
  Event as EventIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  EventBusy as EventBusyIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  addDays,
  setHours,
  setMinutes,
  parse,
  startOfDay,
  isAfter,
  isBefore,
  addMinutes,
} from 'date-fns';
import type { ScheduledSession, Student, Session, Goal, Meeting } from '../types';
import {
  getScheduledSessions,
  addScheduledSession,
  updateScheduledSession,
  deleteScheduledSession,
} from '../utils/storage-api';
import {
  getStudents,
  getSessions,
  getGoals,
  updateGoal,
  addSession,
  updateSession,
  deleteSession,
  getMeetings,
  createMeeting,
  deleteMeeting,
  updateMeeting,
} from '../utils/storage-api';
import { generateId, toLocalDateTimeString, fromLocalDateTimeString } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { SessionFormDialog } from '../components/session/SessionFormDialog';
import { StudentSelector } from '../components/student/StudentSelector';
import { CancellationEmailDialog } from '../components/CancellationEmailDialog';
import { MeetingFormDialog } from '../components/meeting/MeetingFormDialog';
import { useConfirm } from '../hooks/useConfirm';

type ViewMode = 'month' | 'week' | 'day';

interface CalendarEvent {
  id: string;
  scheduledSessionId: string;
  studentIds: string[];
  date: Date;
  startTime: string;
  endTime?: string;
  title: string;
  hasConflict: boolean;
  isLogged: boolean;
  isMissed: boolean;
  matchedSessions?: Session[]; // Store matched sessions for logged events
  isMeeting?: boolean; // True if this is a meeting (blocks time slot)
  meetingId?: string; // ID of the meeting if this is a meeting
}

export const SessionCalendar = () => {
  const { selectedSchool, availableSchools } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScheduledSession, setEditingScheduledSession] = useState<ScheduledSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedSession, setDraggedSession] = useState<string | null>(null);
  const [scheduleStudentSearch, setScheduleStudentSearch] = useState('');
  const [scheduleFormSchool, setScheduleFormSchool] = useState('');
  
  // Session form dialog state
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingGroupSessionId, setEditingGroupSessionId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [currentEvent, setCurrentEvent] = useState<CalendarEvent | null>(null);
  
  // Cancellation email dialog state
  const [cancellationEmailDialogOpen, setCancellationEmailDialogOpen] = useState(false);
  const [pendingCancellation, setPendingCancellation] = useState<{
    event?: CalendarEvent;
    events?: CalendarEvent[];
    dateStr: string;
  } | null>(null);

  // Meeting dialog state
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  
  const [sessionFormData, setSessionFormData] = useState({
    studentIds: [] as string[],
    date: toLocalDateTimeString(new Date()),
    endTime: '',
    goalsTargeted: [] as string[],
    activitiesUsed: [] as string[],
    performanceData: [] as { goalId: string; studentId: string; accuracy?: string; correctTrials?: number; incorrectTrials?: number; notes?: string; cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[] }[],
    notes: '',
    isDirectServices: true,
    indirectServicesNotes: '',
    missedSession: false,
    selectedSubjectiveStatements: [] as string[],
    customSubjective: '',
    plan: '',
  });

  const [formData, setFormData] = useState({
    studentIds: [] as string[],
    startTime: '09:00',
    endTime: '09:30',
    recurrencePattern: 'weekly' as ScheduledSession['recurrencePattern'],
    dayOfWeek: [] as number[],
    specificDates: [] as string[],
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    goalsTargeted: [] as string[],
    notes: '',
    isDirectServices: true,
  });
  const initialFormDataRef = useRef<typeof formData | null>(null);
  const initialSessionFormDataRef = useRef<typeof sessionFormData | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allStudents = await getStudents();
      if (isMountedRef.current) {
        setStudents(allStudents.filter(s => s.archived !== true));
      }
      const allSessions = await getSessions();
      if (isMountedRef.current) {
        setSessions(allSessions);
      }
      const allGoals = await getGoals();
      if (isMountedRef.current) {
        setGoals(allGoals);
      }
      const scheduled = await getScheduledSessions();
      if (isMountedRef.current) {
        setScheduledSessions(scheduled);
      }
      const allMeetings = await getMeetings();
      if (isMountedRef.current) {
        setMeetings(allMeetings);
      }
    } catch (error) {
      if (isMountedRef.current) {
        logError('Calendar: Error loading data', error);
      }
    }
  };

  // Fixed schedule hours 8 AM - 4 PM for all schools (helps when viewing multiple schools)
  const getSchoolHours = useMemo(() => {
    return { startHour: 8, endHour: 16 };
  }, []);

  // Helper function to format student name with grade
  const formatStudentNameWithGrade = (studentId: string): string => {
    const student = students.find(s => s.id === studentId);
    if (!student) return 'Unknown';
    return student.grade ? `${student.name} (${student.grade})` : student.name;
  };

  // Helper to get school name for event (from first student or meeting)
  const getSchoolForStudentIds = (studentIds: string[]): string | undefined => {
    if (!studentIds.length) return undefined;
    return students.find(s => s.id === studentIds[0])?.school;
  };

  // Helper function to parse date string (handles both ISO strings and yyyy-MM-dd format)
  const parseDateString = (dateStr: string): Date => {
    // If it's an ISO string, extract just the date part (yyyy-MM-dd)
    if (dateStr.includes('T')) {
      const datePart = dateStr.split('T')[0];
      return parse(datePart, 'yyyy-MM-dd', new Date());
    }
    // Otherwise, parse as yyyy-MM-dd
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  };

  // Generate calendar events from scheduled sessions
  const calendarEvents = useMemo((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const today = startOfDay(new Date());
    const viewStart = startOfMonth(currentDate);
    const viewEnd = endOfMonth(addMonths(currentDate, 2)); // Show events up to 2 months ahead
    // Use a longer range (1 year) for recurring sessions without an endDate
    const defaultRecurringEnd = endOfMonth(addMonths(currentDate, 12));

    // Ensure scheduledSessions is an array
    if (!Array.isArray(scheduledSessions)) {
      return events;
    }

    scheduledSessions.forEach(scheduled => {
      // Check active status - allow undefined to default to active
      if (scheduled.active === false) {
        return;
      }

      const start = parseDateString(scheduled.startDate);
      // For recurring sessions without an endDate, use a longer default range (1 year)
      // For one-time sessions, still use viewEnd to limit scope
      const end = scheduled.endDate 
        ? parseDateString(scheduled.endDate) 
        : (scheduled.recurrencePattern === 'none' ? viewEnd : defaultRecurringEnd);

      // Skip if the scheduled session has ended before the view start
      if (isBefore(end, viewStart)) {
        return;
      }
      
      // Skip if the scheduled session starts after the view end (for one-time sessions)
      // For recurring sessions, we'll still generate events within the view range
      if (scheduled.recurrencePattern === 'none' && isAfter(start, viewEnd)) {
        return;
      }

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
        const endHour = startHour;
        let endMinute = startMinute + 30;
        let finalEndHour = endHour;
        if (endMinute >= 60) {
          finalEndHour += Math.floor(endMinute / 60);
          endMinute = endMinute % 60;
        }
        endTimeStr = `${String(finalEndHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
      }

      const dayOfWeekArray = Array.isArray(scheduled.dayOfWeek) ? scheduled.dayOfWeek : [];
      if (scheduled.recurrencePattern === 'weekly' && dayOfWeekArray.length > 0) {
        // Generate weekly recurring events
        // Start from the scheduled start date, but only generate events within the view range
        let date = start;
        
        // If start is before viewStart, find the first occurrence of a scheduled day that's >= viewStart
        if (isBefore(start, viewStart)) {
          date = viewStart;
          // Find the first day that matches one of the scheduled days of week
          while (!dayOfWeekArray.includes(date.getDay())) {
            date = addDays(date, 1);
            // Safety check: if we've gone past the end date or too far, break
            if (isAfter(date, end) || isAfter(date, addMonths(viewStart, 2))) break;
          }
        }
        
        // Generate events within the view range
        while ((isBefore(date, end) || isSameDay(date, end)) && (isBefore(date, viewEnd) || isSameDay(date, viewEnd))) {
          if (dayOfWeekArray.includes(date.getDay())) {
            const dateStr = format(date, 'yyyy-MM-dd');
            // Skip cancelled dates
            if (!scheduled.cancelledDates || !scheduled.cancelledDates.includes(dateStr)) {
              const schoolSuffix = getSchoolForStudentIds(scheduled.studentIds);
              const titleBase = `${scheduled.startTime}-${scheduled.endTime || endTimeStr} ${scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ')}`;
              events.push({
                id: `${scheduled.id}-${dateStr}`,
                scheduledSessionId: scheduled.id,
                studentIds: scheduled.studentIds,
                date: date,
                startTime: scheduled.startTime,
                endTime: scheduled.endTime || endTimeStr,
                title: schoolSuffix ? `${titleBase} — ${schoolSuffix}` : titleBase,
                hasConflict: false,
                isLogged: false,
                isMissed: false,
              });
            }
          }
          date = addDays(date, 1);
        }
      } else if (scheduled.recurrencePattern === 'daily') {
        // Generate daily recurring events
        // Start from the later of: scheduled start date or view start date
        let date = isAfter(start, viewStart) ? start : viewStart;
        // Make sure we don't start before the scheduled start date
        if (isBefore(date, start)) {
          date = start;
        }
        
        while ((isBefore(date, end) || isSameDay(date, end)) && (isBefore(date, viewEnd) || isSameDay(date, viewEnd))) {
          const dateStr = format(date, 'yyyy-MM-dd');
          // Skip cancelled dates
          if (!scheduled.cancelledDates || !scheduled.cancelledDates.includes(dateStr)) {
            const schoolSuffix = getSchoolForStudentIds(scheduled.studentIds);
            const titleBase = `${scheduled.startTime}-${scheduled.endTime || endTimeStr} ${scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ')}`;
            events.push({
              id: `${scheduled.id}-${dateStr}`,
              scheduledSessionId: scheduled.id,
              studentIds: scheduled.studentIds,
              date: date,
              startTime: scheduled.startTime,
              endTime: scheduled.endTime || endTimeStr,
              title: schoolSuffix ? `${titleBase} — ${schoolSuffix}` : titleBase,
              hasConflict: false,
              isLogged: false,
              isMissed: false,
            });
          }
          date = addDays(date, 1);
        }
      } else if (scheduled.recurrencePattern === 'specific-dates' && scheduled.specificDates) {
        // Generate events for specific dates
        scheduled.specificDates.forEach(dateStr => {
          // Skip cancelled dates
          if (scheduled.cancelledDates && scheduled.cancelledDates.includes(dateStr)) {
            return;
          }
          const date = parse(dateStr, 'yyyy-MM-dd', new Date());
          // Check if date is within the scheduled range AND within the visible view range
          if ((isAfter(date, start) || isSameDay(date, start)) && 
              (isBefore(date, end) || isSameDay(date, end)) &&
              (isAfter(date, viewStart) || isSameDay(date, viewStart)) &&
              (isBefore(date, viewEnd) || isSameDay(date, viewEnd))) {
            const schoolSuffix = getSchoolForStudentIds(scheduled.studentIds);
            const titleBase = `${scheduled.startTime}-${scheduled.endTime || endTimeStr} ${scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ')}`;
            events.push({
              id: `${scheduled.id}-${dateStr}`,
              scheduledSessionId: scheduled.id,
              studentIds: scheduled.studentIds,
              date: date,
              startTime: scheduled.startTime,
              endTime: scheduled.endTime || endTimeStr,
              title: schoolSuffix ? `${titleBase} — ${schoolSuffix}` : titleBase,
              hasConflict: false,
              isLogged: false,
              isMissed: false,
            });
          }
        });
      } else if (scheduled.recurrencePattern === 'none') {
        // One-time event
        const eventDate = parseDateString(scheduled.startDate);
        const dateStr = format(eventDate, 'yyyy-MM-dd');
        
        // Skip if cancelled
        if (scheduled.cancelledDates && scheduled.cancelledDates.includes(dateStr)) {
          return;
        }
        
        // Only include if the event date is within the visible range
        if ((isAfter(eventDate, viewStart) || isSameDay(eventDate, viewStart)) && 
            (isBefore(eventDate, viewEnd) || isSameDay(eventDate, viewEnd))) {
          const schoolSuffix = getSchoolForStudentIds(scheduled.studentIds);
          const titleBase = `${scheduled.startTime}-${scheduled.endTime || endTimeStr} ${scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ')}`;
          events.push({
            id: scheduled.id,
            scheduledSessionId: scheduled.id,
            studentIds: scheduled.studentIds,
            date: eventDate,
            startTime: scheduled.startTime,
            endTime: scheduled.endTime || endTimeStr,
            title: schoolSuffix ? `${titleBase} — ${schoolSuffix}` : titleBase,
            hasConflict: false,
            isLogged: false,
            isMissed: false,
          });
        }
      }
    });

    // Check for conflicts (overlapping sessions)
    events.forEach(event => {
      const eventStart = setMinutes(setHours(event.date, parseInt(event.startTime.split(':')[0])), parseInt(event.startTime.split(':')[1]));
      const eventEnd = event.endTime ? 
        setMinutes(setHours(event.date, parseInt(event.endTime.split(':')[0])), parseInt(event.endTime.split(':')[1])) :
        addMinutes(eventStart, 30); // Default to 30 minutes if no end time

      const conflictingEvent = events.find(e => {
        if (e.id === event.id) return false;
        // Only check conflicts if there's a shared student
        if (!e.studentIds.some(id => event.studentIds.includes(id))) return false;
        // Only check conflicts on the same day
        if (!isSameDay(e.date, event.date)) return false;
        
        const eStart = setMinutes(setHours(e.date, parseInt(e.startTime.split(':')[0])), parseInt(e.startTime.split(':')[1]));
        const eEnd = e.endTime ? 
          setMinutes(setHours(e.date, parseInt(e.endTime.split(':')[0])), parseInt(e.endTime.split(':')[1])) :
          addMinutes(eStart, 30); // Default to 30 minutes if no end time

        // Check for actual time overlap (not just same start time)
        // Two events conflict if they overlap in time:
        // - eStart is between eventStart and eventEnd (exclusive of exact end time)
        // - eEnd is between eventStart and eventEnd (exclusive of exact start time)
        // - eStart <= eventStart && eEnd >= eventEnd (e completely contains event)
        // - eStart >= eventStart && eEnd <= eventEnd (event completely contains e)
        const eStartTime = eStart.getTime();
        const eEndTime = eEnd.getTime();
        const eventStartTime = eventStart.getTime();
        const eventEndTime = eventEnd.getTime();

        // Check for overlap: events overlap if one starts before the other ends
        return (eStartTime < eventEndTime && eEndTime > eventStartTime);
      });

      event.hasConflict = !!conflictingEvent;
    });

    // Check if sessions have been logged for each event
    // First, create a set of existing session IDs for quick lookup
    const existingSessionIds = new Set(sessions.map(s => s.id));
    
    events.forEach(event => {
      // Check if there's a logged session that matches this scheduled event
      const eventDate = startOfDay(event.date);
      const eventStartTime = setMinutes(setHours(event.date, parseInt(event.startTime.split(':')[0])), parseInt(event.startTime.split(':')[1]));
      
      let isLogged = false;
      let isMissed = false;
      let matchedSession: Session | null = null;
      
      // Check if it matches by scheduledSessionId (primary method - most reliable)
      // Find all sessions that match by scheduledSessionId and date, then pick the one with closest time match
      // IMPORTANT: When multiple sessions share the same scheduledSessionId on the same day,
      // we must match by time to ensure we get the correct one (e.g., 11:20 session vs 13:05 session)
      const matchingByScheduledId = sessions
        .filter(session => {
          if (!session.scheduledSessionId) return false;
          if (session.scheduledSessionId !== event.scheduledSessionId) return false;
          const sessionDate = startOfDay(new Date(session.date));
          if (!isSameDay(sessionDate, eventDate)) return false;
          
          // CRITICAL FIX: Only match sessions where the time is within a reasonable window (2 hours)
          // This prevents matching the wrong session when multiple sessions share the same scheduledSessionId
          const sessionTime = new Date(session.date);
          const timeDiff = Math.abs(sessionTime.getTime() - eventStartTime.getTime());
          return timeDiff <= 2 * 60 * 60 * 1000; // 2 hours in milliseconds
        })
        .map(session => {
          // Calculate time difference for sorting
          const sessionTime = new Date(session.date);
          const timeDiff = Math.abs(sessionTime.getTime() - eventStartTime.getTime());
          return { session, timeDiff };
        })
        .sort((a, b) => a.timeDiff - b.timeDiff) // Sort by closest time match
        .map(item => item.session)[0]; // Get the closest match
      
      if (matchingByScheduledId) {
        // Verify the session still exists (hasn't been deleted)
        if (existingSessionIds.has(matchingByScheduledId.id)) {
          isLogged = true;
          matchedSession = matchingByScheduledId;
        }
      } else {
        // Fallback: match by students and time/date
        // For single student sessions
        if (event.studentIds.length === 1) {
          const studentId = event.studentIds[0];
          // First try to match by time (within 2 hours) for better accuracy
          let matchingSession = sessions.find(session => {
            if (session.studentId !== studentId) return false;
            const sessionDate = startOfDay(new Date(session.date));
            if (!isSameDay(sessionDate, eventDate)) return false;
            
            // Check if time is reasonably close (within 2 hours)
            const sessionTime = new Date(session.date);
            const timeDiff = Math.abs(sessionTime.getTime() - eventStartTime.getTime());
            return timeDiff <= 2 * 60 * 60 * 1000; // 2 hours in milliseconds
          });
          
          // If no time match, fall back to date-only matching (any session on that day)
          if (!matchingSession) {
            matchingSession = sessions.find(session => {
              if (session.studentId !== studentId) return false;
              const sessionDate = startOfDay(new Date(session.date));
              return isSameDay(sessionDate, eventDate);
            });
          }
          
          if (matchingSession) {
            isLogged = true;
            matchedSession = matchingSession;
          }
        } else {
          // For group sessions, check if all scheduled students have sessions on this day
          // First, try to match via groupSessionId (sessions created together)
          const sessionsOnThisDay = sessions.filter(session => {
            const sessionDate = startOfDay(new Date(session.date));
            return isSameDay(sessionDate, eventDate);
          });
          
          // Group sessions by groupSessionId
          const groupSessionsMap = new Map<string, Session[]>();
          sessionsOnThisDay.forEach(session => {
            if (session.groupSessionId) {
              if (!groupSessionsMap.has(session.groupSessionId)) {
                groupSessionsMap.set(session.groupSessionId, []);
              }
              groupSessionsMap.get(session.groupSessionId)!.push(session);
            }
          });
          
          // Check each group to see if all scheduled students are present
          for (const [groupId, groupSessions] of groupSessionsMap.entries()) {
            const groupStudentIds = groupSessions.map(s => s.studentId);
            
            // Check if all scheduled students are in this logged group
            const allStudentsMatch = event.studentIds.every(id => groupStudentIds.includes(id)) &&
                                     groupStudentIds.length === event.studentIds.length;
            
            if (allStudentsMatch) {
              // Check if time is reasonably close (check first session in group)
              const firstSession = groupSessions[0];
              const sessionTime = new Date(firstSession.date);
              const timeDiff = Math.abs(sessionTime.getTime() - eventStartTime.getTime());
              if (timeDiff <= 2 * 60 * 60 * 1000) { // 2 hours in milliseconds
                isLogged = true;
                matchedSession = firstSession; // Use first session to check missed status
                break;
              }
            }
          }
          
          // If not found via groupSessionId, check if all students have individual sessions on this day
          if (!isLogged) {
            // First try to match by time (within 2 hours) for better accuracy
            const studentsWithSessionsByTime = new Set<string>();
            sessionsOnThisDay.forEach(session => {
              // Check if this session's student is in our scheduled list
              if (event.studentIds.includes(session.studentId)) {
                // Check if time is reasonably close
                const sessionTime = new Date(session.date);
                const timeDiff = Math.abs(sessionTime.getTime() - eventStartTime.getTime());
                if (timeDiff <= 2 * 60 * 60 * 1000) { // 2 hours in milliseconds
                  studentsWithSessionsByTime.add(session.studentId);
                }
              }
            });
            
            // Check if all scheduled students have matching sessions by time
            let allLogged = event.studentIds.every(id => studentsWithSessionsByTime.has(id));
            
            // If not all matched by time, fall back to date-only matching
            if (!allLogged) {
              const studentsWithSessionsByDate = new Set<string>();
              sessionsOnThisDay.forEach(session => {
                if (event.studentIds.includes(session.studentId)) {
                  studentsWithSessionsByDate.add(session.studentId);
                }
              });
              allLogged = event.studentIds.every(id => studentsWithSessionsByDate.has(id));
            }
            
            if (allLogged) {
              isLogged = true;
              // Find a matching session to check missed status (prefer time match, fall back to any)
              let firstMatchingSession = sessionsOnThisDay.find(session => {
                if (!event.studentIds.includes(session.studentId)) return false;
                const sessionTime = new Date(session.date);
                const timeDiff = Math.abs(sessionTime.getTime() - eventStartTime.getTime());
                return timeDiff <= 2 * 60 * 60 * 1000;
              });
              if (!firstMatchingSession) {
                firstMatchingSession = sessionsOnThisDay.find(session => 
                  event.studentIds.includes(session.studentId)
                );
              }
              if (firstMatchingSession) {
                matchedSession = firstMatchingSession;
              }
            }
          }
        }
      }
      
      // Collect all matched sessions (for group sessions, get all sessions in the group)
      let matchedSessions: Session[] = [];
      if (isLogged && matchedSession) {
        // Verify the matched session still exists before proceeding
        if (!existingSessionIds.has(matchedSession.id)) {
          // Session was deleted, mark as not logged
          isLogged = false;
          matchedSession = null;
        } else {
          if (matchedSession.groupSessionId) {
            // Get all sessions in the group - filter to only include existing ones
            matchedSessions = sessions.filter(s => 
              s.groupSessionId === matchedSession!.groupSessionId && existingSessionIds.has(s.id)
            );
            // If no sessions in the group exist anymore, mark as not logged
            if (matchedSessions.length === 0) {
              isLogged = false;
              matchedSession = null;
            }
          } else {
            // Single session
            matchedSessions = [matchedSession];
          }
        }
      }
      
      // Check if the matched session (or any session in the group) is marked as missed
      if (isLogged && matchedSession && matchedSessions.length > 0) {
        // For single student sessions, check the matched session directly
        if (event.studentIds.length === 1) {
          isMissed = matchedSession.missedSession === true;
        } else {
          // For group sessions, check if any session in the group is missed
          // If matchedSession has a groupSessionId, check all sessions in that group
          if (matchedSession.groupSessionId) {
            const groupSessions = sessions.filter(s => s.groupSessionId === matchedSession!.groupSessionId);
            isMissed = groupSessions.some(s => s.missedSession === true);
          } else {
            // If no groupSessionId, check the matched session
            isMissed = matchedSession.missedSession === true;
          }
        }
      }
      
      event.isLogged = isLogged;
      event.isMissed = isMissed;
      event.matchedSessions = matchedSessions.length > 0 ? matchedSessions : undefined;
    });

    // Add logged sessions that don't have a corresponding scheduled session
    const scheduledSessionIds = new Set(Array.isArray(scheduledSessions) ? scheduledSessions.map(ss => ss.id) : []);
    const loggedSessionsWithoutSchedule: CalendarEvent[] = [];
    
    sessions.forEach(session => {
      // Skip if this session is already matched to a scheduled session
      const alreadyMatched = events.some(event => 
        event.matchedSessions?.some(ms => ms.id === session.id)
      );
      if (alreadyMatched) return;
      
      // Skip if this session has a scheduledSessionId that exists
      if (session.scheduledSessionId && scheduledSessionIds.has(session.scheduledSessionId)) {
        return;
      }
      
      // Check if session date is within visible range
      const sessionDate = startOfDay(new Date(session.date));
      if (isBefore(sessionDate, viewStart) || isAfter(sessionDate, viewEnd)) {
        return;
      }
      
      // Get session time
      const sessionTime = new Date(session.date);
      const startTime = format(sessionTime, 'HH:mm');
      let endTime: string;
      if (session.endTime) {
        const endTimeDate = new Date(session.endTime);
        endTime = format(endTimeDate, 'HH:mm');
      } else {
        // Default to 30 minutes if no end time
        const defaultEnd = addMinutes(sessionTime, 30);
        endTime = format(defaultEnd, 'HH:mm');
      }
      
      // Get student name and school
      const student = students.find(s => s.id === session.studentId);
      const studentName = student ? (student.grade ? `${student.name} (${student.grade})` : student.name) : 'Unknown';
      const schoolSuffix = student?.school;
      const titleBase = `${startTime}-${endTime} ${studentName}`;
      
      loggedSessionsWithoutSchedule.push({
        id: `logged-${session.id}`,
        scheduledSessionId: session.scheduledSessionId || '',
        studentIds: [session.studentId],
        date: sessionDate,
        startTime: startTime,
        endTime: endTime,
        title: schoolSuffix ? `${titleBase} — ${schoolSuffix}` : titleBase,
        hasConflict: false,
        isLogged: true,
        isMissed: session.missedSession || false,
        matchedSessions: [session],
      });
    });
    
    // Final verification pass: ensure all events with matched sessions only reference existing sessions
    events.forEach(event => {
      if (event.matchedSessions && event.matchedSessions.length > 0) {
        // Filter out any deleted sessions from matched sessions
        const validMatchedSessions = event.matchedSessions.filter(session => 
          existingSessionIds.has(session.id)
        );
        
        // If no valid matched sessions remain, mark as not logged
        if (validMatchedSessions.length === 0) {
          event.isLogged = false;
          event.isMissed = false;
          event.matchedSessions = undefined;
        } else {
          // Update matched sessions to only include existing ones
          event.matchedSessions = validMatchedSessions;
        }
      }
    });
    
    // Combine scheduled events with logged sessions without schedule
    // Filter out logged sessions without schedule that reference deleted sessions
    const validLoggedSessionsWithoutSchedule = loggedSessionsWithoutSchedule.filter(loggedEvent => {
      // These events should always have matchedSessions with exactly one session
      if (loggedEvent.matchedSessions && loggedEvent.matchedSessions.length > 0) {
        // Check if the session still exists
        const sessionExists = loggedEvent.matchedSessions.every(session => 
          existingSessionIds.has(session.id)
        );
        return sessionExists;
      }
      return true;
    });
    
    // Add meetings as blocked time slots
    const meetingEvents: CalendarEvent[] = meetings
      .filter(meeting => {
        const meetingDate = startOfDay(new Date(meeting.date));
        return !isBefore(meetingDate, viewStart) && !isAfter(meetingDate, viewEnd);
      })
      .map(meeting => {
        const meetingDate = new Date(meeting.date);
        const startTime = format(meetingDate, 'HH:mm');
        let endTime: string;
        if (meeting.endTime) {
          const endTimeDate = new Date(meeting.endTime);
          endTime = format(endTimeDate, 'HH:mm');
        } else {
          // Default to 1 hour if no end time
          const defaultEnd = addMinutes(meetingDate, 60);
          endTime = format(defaultEnd, 'HH:mm');
        }
        
        const schoolSuffix = meeting.school;
        const titleBase = `${startTime}-${endTime} Meeting: ${meeting.title}`;
        return {
          id: `meeting-${meeting.id}`,
          scheduledSessionId: '',
          studentIds: [],
          date: startOfDay(meetingDate),
          startTime: startTime,
          endTime: endTime,
          title: schoolSuffix ? `${titleBase} — ${schoolSuffix}` : titleBase,
          hasConflict: false,
          isLogged: false,
          isMissed: false,
          isMeeting: true,
          meetingId: meeting.id,
        };
      });
    
    // Combine: scheduled events (which may or may not be logged) + valid logged sessions without schedule + meetings
    return [...events, ...validLoggedSessionsWithoutSchedule, ...meetingEvents];
  }, [scheduledSessions, students, currentDate, sessions, meetings]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start week on Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }); // End week on Sunday
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  // Filter out weekends (Saturday = 6, Sunday = 0)
  const daysInMonth = allDays.filter(day => {
    const dayOfWeek = day.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude Sunday (0) and Saturday (6)
  });

  const handlePreviousPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const isSessionFormDirty = () => {
    if (!initialSessionFormDataRef.current) return false;
    const initial = initialSessionFormDataRef.current;
    return (
      JSON.stringify(sessionFormData.studentIds) !== JSON.stringify(initial.studentIds) ||
      sessionFormData.date !== initial.date ||
      sessionFormData.endTime !== initial.endTime ||
      JSON.stringify(sessionFormData.goalsTargeted) !== JSON.stringify(initial.goalsTargeted) ||
      JSON.stringify(sessionFormData.activitiesUsed) !== JSON.stringify(initial.activitiesUsed) ||
      JSON.stringify(sessionFormData.performanceData) !== JSON.stringify(initial.performanceData) ||
      sessionFormData.notes !== initial.notes ||
      sessionFormData.isDirectServices !== initial.isDirectServices ||
      sessionFormData.indirectServicesNotes !== initial.indirectServicesNotes ||
      sessionFormData.missedSession !== initial.missedSession ||
      JSON.stringify(sessionFormData.selectedSubjectiveStatements) !== JSON.stringify(initial.selectedSubjectiveStatements) ||
      sessionFormData.customSubjective !== initial.customSubjective ||
      (sessionFormData.plan || '') !== (initial.plan || '')
    );
  };

  const isFormDirty = () => {
    if (!initialFormDataRef.current) return false;
    const initial = initialFormDataRef.current;
    
    // Compare form data with initial state
    const hasChanges = 
      JSON.stringify(formData.studentIds.sort()) !== JSON.stringify(initial.studentIds.sort()) ||
      formData.startTime !== initial.startTime ||
      formData.endTime !== initial.endTime ||
      formData.recurrencePattern !== initial.recurrencePattern ||
      JSON.stringify(formData.dayOfWeek.sort()) !== JSON.stringify(initial.dayOfWeek.sort()) ||
      JSON.stringify(formData.specificDates.sort()) !== JSON.stringify(initial.specificDates.sort()) ||
      formData.startDate !== initial.startDate ||
      formData.endDate !== initial.endDate ||
      JSON.stringify(formData.goalsTargeted.sort()) !== JSON.stringify(initial.goalsTargeted.sort()) ||
      formData.notes !== initial.notes ||
      formData.isDirectServices !== initial.isDirectServices;
    
    return hasChanges;
  };

  const doOpenDialog = (date?: Date, scheduledSession?: ScheduledSession) => {
    if (scheduledSession) {
      setEditingScheduledSession(scheduledSession);
      const schoolForEdit = scheduledSession.studentIds.length
        ? students.find(s => s.id === scheduledSession.studentIds[0])?.school ?? selectedSchool
        : selectedSchool;
      setScheduleFormSchool(schoolForEdit);
      const newFormData = {
        studentIds: scheduledSession.studentIds,
        startTime: scheduledSession.startTime,
        endTime: scheduledSession.endTime || 
          (scheduledSession.duration ? 
            `${Math.floor((parseInt(scheduledSession.startTime.split(':')[0]) * 60 + parseInt(scheduledSession.startTime.split(':')[1]) + scheduledSession.duration) / 60)}:${String((parseInt(scheduledSession.startTime.split(':')[1]) + scheduledSession.duration) % 60).padStart(2, '0')}` :
            '09:30'),
        recurrencePattern: scheduledSession.recurrencePattern,
        dayOfWeek: scheduledSession.dayOfWeek || [],
        specificDates: scheduledSession.specificDates || [],
        startDate: format(parse(scheduledSession.startDate, 'yyyy-MM-dd', new Date()), 'yyyy-MM-dd'),
        endDate: scheduledSession.endDate ? format(parse(scheduledSession.endDate, 'yyyy-MM-dd', new Date()), 'yyyy-MM-dd') : '',
        goalsTargeted: scheduledSession.goalsTargeted,
        notes: scheduledSession.notes || '',
        isDirectServices: scheduledSession.isDirectServices !== false,
      };
      setFormData(newFormData);
      initialFormDataRef.current = { ...newFormData };
    } else {
      setEditingScheduledSession(null);
      setScheduleFormSchool(selectedSchool);
      const dateToUse = date || new Date();
      setSelectedDate(dateToUse);
      const newFormData = {
        studentIds: [],
        startTime: '09:00',
        endTime: '09:30',
        recurrencePattern: 'weekly' as ScheduledSession['recurrencePattern'],
        dayOfWeek: [dateToUse.getDay()],
        specificDates: [],
        startDate: format(dateToUse, 'yyyy-MM-dd'),
        endDate: '',
        goalsTargeted: [],
        notes: '',
        isDirectServices: true,
      };
      setFormData(newFormData);
      initialFormDataRef.current = { ...newFormData };
    }
    setDialogOpen(true);
  };

  const handleOpenDialog = (date?: Date, scheduledSession?: ScheduledSession) => {
    // If opening a new session (not editing) and form is dirty, confirm first
    if (!scheduledSession && dialogOpen && isFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to discard them and create a new scheduled session?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          doOpenDialog(date, scheduledSession);
        },
      });
    } else {
      doOpenDialog(date, scheduledSession);
    }
  };

  const handleCloseDialog = (forceClose = false) => {
    if (!forceClose && isFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close without saving?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          doCloseDialog();
        },
      });
    } else {
      doCloseDialog();
    }
  };

  const doCloseDialog = () => {
    setDialogOpen(false);
    setEditingScheduledSession(null);
    setSelectedDate(null);
    setScheduleStudentSearch('');
    initialFormDataRef.current = null;
  };

  const handleScheduleStudentToggle = (studentId: string) => {
    const isSelected = formData.studentIds.includes(studentId);
    if (isSelected) {
      setFormData({ ...formData, studentIds: formData.studentIds.filter(id => id !== studentId) });
    } else {
      setFormData({ ...formData, studentIds: [...formData.studentIds, studentId] });
    }
  };

  const handleSave = async () => {
    if (!isMountedRef.current) return;
    if (formData.studentIds.length === 0) {
      alert('Please select at least one student');
      return;
    }

    const scheduledSession: ScheduledSession = {
      id: editingScheduledSession?.id || generateId(),
      studentIds: formData.studentIds,
      startTime: formData.startTime,
      endTime: formData.endTime,
      recurrencePattern: formData.recurrencePattern,
      dayOfWeek: formData.recurrencePattern === 'weekly' ? formData.dayOfWeek : undefined,
      specificDates: formData.recurrencePattern === 'specific-dates' ? formData.specificDates : undefined,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      goalsTargeted: formData.goalsTargeted,
      notes: formData.notes,
      isDirectServices: formData.isDirectServices,
      dateCreated: editingScheduledSession?.dateCreated || new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      active: true,
    };

    try {
      if (editingScheduledSession) {
        await updateScheduledSession(editingScheduledSession.id, scheduledSession);
      } else {
        await addScheduledSession(scheduledSession);
      }
      if (!isMountedRef.current) return;
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Calendar: Error saving scheduled session', error);
      alert('Failed to save scheduled session. Please try again.');
      return;
    }

    await loadData();
    if (!isMountedRef.current) return;
    initialFormDataRef.current = null;
    doCloseDialog();
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Delete Scheduled Session',
      message: 'Are you sure you want to delete this scheduled session? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        deleteScheduledSession(id);
        loadData();
      },
    });
  };

  // Pre-index sessions by (studentId, goalId) for O(1) lookup instead of O(n) filtering
  // This dramatically improves performance when getRecentPerformance is called many times
  const sessionsByStudentAndGoal = useMemo(() => {
    const index = new Map<string, Session[]>();
    sessions.forEach(session => {
      const studentId = session.studentId;
      (session.goalsTargeted || []).forEach(goalId => {
        const key = `${studentId}:${goalId}`;
        if (!index.has(key)) {
          index.set(key, []);
        }
        index.get(key)!.push(session);
      });
    });
    // Sort each array by date descending (most recent first)
    index.forEach((sessionArray) => {
      sessionArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
    return index;
  }, [sessions]);

  // Pre-index goals by ID for O(1) lookup
  const goalsById = useMemo(() => {
    const index = new Map<string, Goal>();
    goals.forEach(goal => {
      index.set(goal.id, goal);
    });
    return index;
  }, [goals]);

  // Memoize isGoalAchieved to prevent unnecessary recalculations
  const isGoalAchieved = useCallback((goal: Goal): boolean => {
    if (goal.status === 'achieved') {
      return true;
    }
    if (goal.parentGoalId) {
      const parentGoal = goalsById.get(goal.parentGoalId);
      if (parentGoal && parentGoal.status === 'achieved') {
        return true;
      }
    }
    return false;
  }, [goalsById]);

  // Memoize getRecentPerformance with pre-indexed data for O(1) lookup
  const getRecentPerformance = useCallback((goalId: string, studentId: string): number | null => {
    const key = `${studentId}:${goalId}`;
    const goalSessions = sessionsByStudentAndGoal.get(key) || [];
    const recentSessions = goalSessions.slice(0, 3);
    
    const recentData = recentSessions.map(s => {
      const perf = s.performanceData.find(p => p.goalId === goalId);
      return perf?.accuracy;
    }).filter((a): a is number => a !== undefined);

    const average = recentData.length > 0
      ? recentData.reduce((sum, a) => sum + a, 0) / recentData.length
      : null;

    return average;
  }, [sessionsByStudentAndGoal]);

  const handleMarkGoalMet = useCallback(async (goal: Goal) => {
    try {
      await updateGoal(goal.id, {
        status: 'achieved',
        dateAchieved: new Date().toISOString().slice(0, 10),
      });
      await loadData();
    } catch (error) {
      if (isMountedRef.current) {
        logError('Calendar: Error marking goal as met', error);
      }
    }
  }, []);

  const handleOpenSessionDialog = (event: CalendarEvent) => {
    if (!Array.isArray(scheduledSessions)) return;
    const scheduled = scheduledSessions.find(s => s.id === event.scheduledSessionId);
    if (!scheduled) return;

    // Check if this is an existing logged session
    // CRITICAL FIX: When matching sessions, we need to filter by time to ensure we get the correct session
    // when multiple sessions share the same scheduledSessionId on the same day (e.g., 11:20 session vs 13:05 session)
    if (event.isLogged && event.matchedSessions && event.matchedSessions.length > 0) {
      // Load existing session(s) for editing
      // Verify we're using the correct session by matching the time
      const eventStartTime = setMinutes(setHours(event.date, parseInt(event.startTime.split(':')[0])), parseInt(event.startTime.split(':')[1]));
      
      // Filter and sort matched sessions by time proximity to ensure we get the right one
      // CRITICAL FIX: Filter out sessions that are too far apart in time (more than 2 hours)
      // This prevents editing the wrong session when multiple sessions share the same scheduledSessionId on the same day
      const matchedSessions = event.matchedSessions
        .map(session => {
          const sessionTime = new Date(session.date);
          const timeDiff = Math.abs(sessionTime.getTime() - eventStartTime.getTime());
          return { session, timeDiff };
        })
        .filter(item => item.timeDiff <= 2 * 60 * 60 * 1000) // Only include sessions within 2 hours
        .sort((a, b) => a.timeDiff - b.timeDiff) // Sort by closest time match
        .map(item => item.session); // Extract sessions in order
      
      // If no sessions match after time filtering, treat as unlogged and create new session
      if (matchedSessions.length > 0) {
        if (matchedSessions.length === 1) {
        // Single session - edit it
        const session = matchedSessions[0];
        setEditingSession(session);
        setEditingGroupSessionId(null);
        
        const startDate = new Date(session.date);
        const endDate = session.endTime ? new Date(session.endTime) : null;
        
        // Filter out achieved goals when editing
        const activeGoalsTargeted = (session.goalsTargeted || []).filter(gId => {
          const goal = goals.find(g => g.id === gId);
          return goal && !isGoalAchieved(goal);
        });
        
        const newFormData = {
          studentIds: [session.studentId],
          date: toLocalDateTimeString(startDate),
          endTime: endDate ? toLocalDateTimeString(endDate) : '',
          goalsTargeted: activeGoalsTargeted,
          activitiesUsed: session.activitiesUsed,
          performanceData: session.performanceData
            .filter(p => activeGoalsTargeted.includes(p.goalId))
            .map(p => ({
              goalId: p.goalId,
              studentId: session.studentId,
              accuracy: p.accuracy?.toString(),
              correctTrials: p.correctTrials,
              incorrectTrials: p.incorrectTrials,
              notes: p.notes,
              cuingLevels: p.cuingLevels,
            })),
          notes: session.notes,
          isDirectServices: session.isDirectServices === true,
          indirectServicesNotes: session.indirectServicesNotes || '',
          missedSession: session.missedSession || false,
          selectedSubjectiveStatements: session.selectedSubjectiveStatements || [],
          customSubjective: session.customSubjective || '',
          plan: session.plan || '',
        };
        
        setSessionFormData(newFormData);
        initialSessionFormDataRef.current = { ...newFormData };
      } else {
        // Group session - edit all sessions in the group
        const firstSession = matchedSessions[0];
        setEditingSession(null);
        setEditingGroupSessionId(firstSession.groupSessionId || null);
        
        // Collect all student IDs from the matched sessions
        const allStudentIds = matchedSessions.map(s => s.studentId);
        
        // Use the first session's date/time (they should be the same for group sessions)
        const startDate = new Date(firstSession.date);
        const endDate = firstSession.endTime ? new Date(firstSession.endTime) : null;
        
        // Collect all goals and performance data from all sessions
        const allGoalsTargeted = new Set<string>();
        const allPerformanceData: typeof sessionFormData.performanceData = [];
        
        matchedSessions.forEach(session => {
          (session.goalsTargeted || []).forEach(gId => {
            const goal = goals.find(g => g.id === gId);
            if (goal && !isGoalAchieved(goal)) {
              allGoalsTargeted.add(gId);
            }
          });
          
          session.performanceData.forEach(p => {
            const goal = goals.find(g => g.id === p.goalId);
            if (goal && !isGoalAchieved(goal)) {
              allPerformanceData.push({
                goalId: p.goalId,
                studentId: session.studentId,
                accuracy: p.accuracy?.toString(),
                correctTrials: p.correctTrials,
                incorrectTrials: p.incorrectTrials,
                notes: p.notes,
                cuingLevels: p.cuingLevels,
              });
            }
          });
        });
        
        const newFormData = {
          studentIds: allStudentIds,
          date: toLocalDateTimeString(startDate),
          endTime: endDate ? toLocalDateTimeString(endDate) : '',
          goalsTargeted: Array.from(allGoalsTargeted),
          activitiesUsed: firstSession.activitiesUsed, // Use first session's activities (should be same for all)
          performanceData: allPerformanceData,
          notes: firstSession.notes, // Use first session's notes (should be same for all)
          isDirectServices: firstSession.isDirectServices === true,
          indirectServicesNotes: firstSession.indirectServicesNotes || '',
          missedSession: matchedSessions.some(s => s.missedSession === true),
          selectedSubjectiveStatements: firstSession.selectedSubjectiveStatements || [],
          customSubjective: firstSession.customSubjective || '',
          plan: firstSession.plan || '',
        };
        
        setSessionFormData(newFormData);
        initialSessionFormDataRef.current = { ...newFormData };
        }
        
        // Open session dialog for both single and group sessions
        setSessionDialogOpen(true);
        setCurrentEvent(event);
        return;
      }
      // If no matched sessions after filtering, fall through to create new session
    }
    
    // Create new session from scheduled event (either event is not logged, or no sessions matched after time filtering)
    if (scheduled) {
      // Create new session from scheduled event
      // Use the scheduled session's times directly to ensure accuracy
      const [startHour, startMinute] = scheduled.startTime.split(':').map(Number);
      const sessionDate = new Date(event.date);
      sessionDate.setHours(startHour, startMinute, 0, 0);

      // Calculate end time from scheduled session
      let endTimeDate: Date;
      if (scheduled.endTime) {
        // Use explicit endTime from scheduled session
        const [endHour, endMinute] = scheduled.endTime.split(':').map(Number);
        endTimeDate = new Date(event.date);
        endTimeDate.setHours(endHour, endMinute, 0, 0);
      } else if (scheduled.duration) {
        // Calculate from duration if available
        endTimeDate = new Date(sessionDate.getTime() + scheduled.duration * 60000);
      } else {
        // Fallback to 30 minutes if neither is available
        endTimeDate = new Date(sessionDate.getTime() + 30 * 60000);
      }

      // Filter goals to only active ones for the selected students
      const activeGoals = (scheduled.goalsTargeted || []).filter(gId => {
        const goal = goals.find(g => g.id === gId);
        return goal && !isGoalAchieved(goal) && scheduled.studentIds.includes(goal.studentId);
      });

      // Initialize performance data for each student-goal combination
      const performanceData = activeGoals.flatMap(goalId => {
        return scheduled.studentIds
          .filter(studentId => {
            const goal = goals.find(g => g.id === goalId);
            return goal?.studentId === studentId;
          })
          .map(studentId => ({
            goalId,
            studentId,
            notes: '',
            cuingLevels: [] as ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[],
          }));
      });

      const newFormData = {
        studentIds: scheduled.studentIds,
        date: toLocalDateTimeString(sessionDate),
        endTime: toLocalDateTimeString(endTimeDate),
        goalsTargeted: activeGoals,
        activitiesUsed: [],
        performanceData,
        notes: scheduled.notes || '',
        isDirectServices: scheduled.isDirectServices !== false,
        indirectServicesNotes: '',
        missedSession: false,
        selectedSubjectiveStatements: [],
        customSubjective: '',
        plan: '',
      };
      setSessionFormData(newFormData);
      initialSessionFormDataRef.current = { ...newFormData };
      setEditingSession(null);
      setEditingGroupSessionId(null);
    }
    
    setCurrentEvent(event); // Store the event so we can link the session when saving
    setSessionDialogOpen(true);
  };

  const handleCloseSessionDialog = (forceClose = false) => {
    if (!forceClose && isSessionFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close without saving?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          setSessionDialogOpen(false);
          setEditingSession(null);
          setEditingGroupSessionId(null);
          setStudentSearch('');
          setCurrentEvent(null);
          initialSessionFormDataRef.current = null;
        },
      });
      // Return early to prevent dialog from closing
      return;
    } else {
      setSessionDialogOpen(false);
      setEditingSession(null);
      setEditingGroupSessionId(null);
      setStudentSearch('');
      setCurrentEvent(null);
      initialSessionFormDataRef.current = null;
    }
  };

  const handleDeleteSession = () => {
    // Prevent deletion if we don't have a valid session or group to delete
    if (!editingSession && !editingGroupSessionId) {
      return;
    }

    // Additional safety check: if editingGroupSessionId is null/undefined, 
    // we should not proceed (this prevents accidentally deleting all sessions with null groupSessionId)
    if (!editingSession && (editingGroupSessionId === null || editingGroupSessionId === undefined)) {
      return;
    }

    // Prevent deletion of future sessions that aren't logged yet
    // Future sessions should be cancelled, not deleted (they don't exist as logged sessions)
    if (currentEvent && !currentEvent.isLogged) {
      alert('Cannot delete a future session that hasn\'t been logged. Use the cancel button to cancel this scheduled session instead.');
      return;
    }

    let sessionCount: number;
    if (editingSession) {
      sessionCount = 1;
    } else if (editingGroupSessionId) {
      // Only count sessions that actually have this specific groupSessionId
      // This prevents matching null values which would match all individual sessions
      sessionCount = sessions.filter(s => s.groupSessionId === editingGroupSessionId && s.groupSessionId !== null).length;
      if (sessionCount === 0) {
        // No sessions found with this groupSessionId, don't proceed
        return;
      }
    } else {
      return;
    }

    const sessionText = sessionCount === 1 ? 'session' : 'sessions';
    
    confirm({
      title: 'Delete Session',
      message: `Are you sure you want to delete this ${sessionText}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        if (!isMountedRef.current) return;
        try {
          if (editingSession) {
            // Delete single session
            await deleteSession(editingSession.id);
          } else if (editingGroupSessionId) {
            // Delete all sessions in the group
            // Only delete sessions with this specific groupSessionId (not null)
            const groupSessions = sessions.filter(s => s.groupSessionId === editingGroupSessionId && s.groupSessionId !== null);
            for (const session of groupSessions) {
              await deleteSession(session.id);
              if (!isMountedRef.current) return;
            }
          }

          if (!isMountedRef.current) return;
          // Reload data to update calendar
          await loadData();
          if (!isMountedRef.current) return;
          handleCloseSessionDialog();
        } catch (error) {
          if (!isMountedRef.current) return;
          logError('Failed to delete session', error);
          alert('Failed to delete session. Please try again.');
        }
      },
    });
  };

  const handleSaveSession = async () => {
    if (!isMountedRef.current) return;
    if (sessionFormData.studentIds.length === 0) {
      alert('Please select at least one student');
      return;
    }

    try {
      // Check if we're editing existing session(s)
      if (editingSession) {
        // Editing a single session
        const studentGoals = goals.filter(g => g.studentId === editingSession.studentId && !isGoalAchieved(g)).map(g => g.id);
        const studentGoalsTargeted = sessionFormData.goalsTargeted.filter(gId => studentGoals.includes(gId));
        const studentPerformanceData = sessionFormData.performanceData
          .filter(p => p.studentId === editingSession.studentId && studentGoalsTargeted.includes(p.goalId))
          .map((p) => ({
            goalId: p.goalId,
            accuracy: p.accuracy ? parseFloat(p.accuracy) : undefined,
            correctTrials: p.correctTrials,
            incorrectTrials: p.incorrectTrials,
            notes: p.notes,
            cuingLevels: p.cuingLevels,
          }));

        const updates: Partial<Session> = {
          date: fromLocalDateTimeString(sessionFormData.date),
          endTime: sessionFormData.endTime ? fromLocalDateTimeString(sessionFormData.endTime) : undefined,
          goalsTargeted: studentGoalsTargeted,
          activitiesUsed: sessionFormData.activitiesUsed,
          performanceData: studentPerformanceData,
          notes: sessionFormData.notes,
          isDirectServices: sessionFormData.isDirectServices === true,
          indirectServicesNotes: sessionFormData.indirectServicesNotes || undefined,
          missedSession: sessionFormData.isDirectServices ? (sessionFormData.missedSession || false) : undefined,
          selectedSubjectiveStatements: sessionFormData.selectedSubjectiveStatements.length > 0 ? sessionFormData.selectedSubjectiveStatements : undefined,
          customSubjective: sessionFormData.customSubjective.trim() || undefined,
          plan: sessionFormData.plan.trim() || undefined,
        };

        await updateSession(editingSession.id, updates);
        if (!isMountedRef.current) return;
      } else if (editingGroupSessionId) {
        // Editing a group session - update all sessions in the group
        const groupSessions = sessions.filter(s => s.groupSessionId === editingGroupSessionId);
        
        for (const existingSession of groupSessions) {
          const studentGoals = goals.filter(g => g.studentId === existingSession.studentId && !isGoalAchieved(g)).map(g => g.id);
          const studentGoalsTargeted = sessionFormData.goalsTargeted.filter(gId => studentGoals.includes(gId));
          const studentPerformanceData = sessionFormData.performanceData
            .filter(p => p.studentId === existingSession.studentId && studentGoalsTargeted.includes(p.goalId))
            .map((p) => ({
              goalId: p.goalId,
              accuracy: p.accuracy ? parseFloat(p.accuracy) : undefined,
              correctTrials: p.correctTrials,
              incorrectTrials: p.incorrectTrials,
              notes: p.notes,
              cuingLevels: p.cuingLevels,
            }));

          const updates: Partial<Session> = {
            date: fromLocalDateTimeString(sessionFormData.date),
            endTime: sessionFormData.endTime ? fromLocalDateTimeString(sessionFormData.endTime) : undefined,
            goalsTargeted: studentGoalsTargeted,
            activitiesUsed: sessionFormData.activitiesUsed,
            performanceData: studentPerformanceData,
            notes: sessionFormData.notes,
            isDirectServices: sessionFormData.isDirectServices === true,
            indirectServicesNotes: sessionFormData.indirectServicesNotes || undefined,
            missedSession: sessionFormData.isDirectServices ? (sessionFormData.missedSession || false) : undefined,
            selectedSubjectiveStatements: sessionFormData.selectedSubjectiveStatements.length > 0 ? sessionFormData.selectedSubjectiveStatements : undefined,
            customSubjective: sessionFormData.customSubjective.trim() || undefined,
            plan: sessionFormData.plan.trim() || undefined,
          };

          await updateSession(existingSession.id, updates);
          if (!isMountedRef.current) return;
        }
      } else {
        // Creating new session(s)
        const groupSessionId = sessionFormData.studentIds.length > 1 ? generateId() : undefined;

        for (const studentId of sessionFormData.studentIds) {
          const studentGoals = goals.filter(g => g.studentId === studentId && !isGoalAchieved(g)).map(g => g.id);
          const studentGoalsTargeted = sessionFormData.goalsTargeted.filter(gId => studentGoals.includes(gId));
          const studentPerformanceData = sessionFormData.performanceData
            .filter(p => p.studentId === studentId && studentGoalsTargeted.includes(p.goalId))
            .map((p) => ({
              goalId: p.goalId,
              accuracy: p.accuracy ? parseFloat(p.accuracy) : undefined,
              correctTrials: p.correctTrials,
              incorrectTrials: p.incorrectTrials,
              notes: p.notes,
              cuingLevels: p.cuingLevels,
            }));

          const sessionData: Session = {
            id: generateId(),
            studentId: studentId,
            date: fromLocalDateTimeString(sessionFormData.date),
            endTime: sessionFormData.endTime ? fromLocalDateTimeString(sessionFormData.endTime) : undefined,
            goalsTargeted: studentGoalsTargeted,
            activitiesUsed: sessionFormData.activitiesUsed,
            performanceData: studentPerformanceData,
            notes: sessionFormData.notes,
            isDirectServices: sessionFormData.isDirectServices === true,
            indirectServicesNotes: sessionFormData.indirectServicesNotes || undefined,
            groupSessionId: groupSessionId,
            missedSession: sessionFormData.isDirectServices ? (sessionFormData.missedSession || false) : undefined,
            selectedSubjectiveStatements: sessionFormData.selectedSubjectiveStatements.length > 0 ? sessionFormData.selectedSubjectiveStatements : undefined,
            customSubjective: sessionFormData.customSubjective.trim() || undefined,
            plan: sessionFormData.plan.trim() || undefined,
            scheduledSessionId: currentEvent?.scheduledSessionId, // Link to the scheduled session
          };

          await addSession(sessionData);
          if (!isMountedRef.current) return;
        }
      }

      if (!isMountedRef.current) return;
      // Reload data to show the updated/new session and update calendar colors
      await loadData();
      if (!isMountedRef.current) return;
      handleCloseSessionDialog(true); // Force close without confirmation since we just saved
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to save session', error);
      alert('Failed to save session. Please try again.');
    }
  };

  const handleStudentToggle = (studentId: string) => {
    const isSelected = sessionFormData.studentIds.includes(studentId);
    let newStudentIds: string[];
    let newGoalsTargeted: string[] = [...sessionFormData.goalsTargeted];
    let newPerformanceData = [...sessionFormData.performanceData];

    if (isSelected) {
      newStudentIds = sessionFormData.studentIds.filter(id => id !== studentId);
      const studentGoals = goals.filter(g => g.studentId === studentId).map(g => g.id);
      newGoalsTargeted = sessionFormData.goalsTargeted.filter(gId => !studentGoals.includes(gId));
      newPerformanceData = sessionFormData.performanceData.filter(p => p.studentId !== studentId);
    } else {
      newStudentIds = [...sessionFormData.studentIds, studentId];
    }

    setSessionFormData({
      ...sessionFormData,
      studentIds: newStudentIds,
      goalsTargeted: newGoalsTargeted,
      performanceData: newPerformanceData,
    });
  };

  const handleGoalToggle = (goalId: string, studentId: string) => {
    const isSelected = sessionFormData.goalsTargeted.includes(goalId);
    let newGoalsTargeted: string[];
    let newPerformanceData = [...sessionFormData.performanceData];

    if (isSelected) {
      newGoalsTargeted = sessionFormData.goalsTargeted.filter((id) => id !== goalId);
      newPerformanceData = newPerformanceData.filter((p) => p.goalId !== goalId || p.studentId !== studentId);
    } else {
      newGoalsTargeted = [...sessionFormData.goalsTargeted, goalId];
      newPerformanceData.push({ goalId, studentId, notes: '', cuingLevels: [] });
    }

    setSessionFormData({
      ...sessionFormData,
      goalsTargeted: newGoalsTargeted,
      performanceData: newPerformanceData,
    });
  };

  const handlePerformanceUpdate = (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => {
    setSessionFormData({
      ...sessionFormData,
      performanceData: sessionFormData.performanceData.map((p) =>
        p.goalId === goalId && p.studentId === studentId ? { ...p, [field]: value } : p
      ),
    });
  };

  const handleCuingLevelToggle = (goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => {
    setSessionFormData({
      ...sessionFormData,
      performanceData: sessionFormData.performanceData.map((p) => {
        if (p.goalId !== goalId || p.studentId !== studentId) return p;
        const currentLevels = p.cuingLevels || [];
        const newLevels = currentLevels.includes(cuingLevel)
          ? currentLevels.filter(l => l !== cuingLevel)
          : [...currentLevels, cuingLevel];
        return { ...p, cuingLevels: newLevels };
      }),
    });
  };

  const handleTrialUpdate = (goalId: string, studentId: string, isCorrect: boolean) => {
    setSessionFormData({
      ...sessionFormData,
      performanceData: sessionFormData.performanceData.map((p) => {
        if (p.goalId !== goalId || p.studentId !== studentId) return p;
        const correctTrials = (p.correctTrials || 0) + (isCorrect ? 1 : 0);
        const incorrectTrials = (p.incorrectTrials || 0) + (isCorrect ? 0 : 1);
        const totalTrials = correctTrials + incorrectTrials;
        const accuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
        return {
          ...p,
          correctTrials,
          incorrectTrials,
          accuracy: accuracy.toString(),
        };
      }),
    });
  };

  // Memoized callback for form data changes to prevent memory leaks from excessive re-renders
  const sessionFormDataRef = useRef(sessionFormData);
  sessionFormDataRef.current = sessionFormData;
  const handleSessionFormDataChange = useCallback((updates: Partial<typeof sessionFormData>) => {
    setSessionFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    const events = calendarEvents.filter(event => isSameDay(event.date, day));
    // Sort events by start time chronologically
    return events.sort((a, b) => {
      const [aHour, aMinute] = a.startTime.split(':').map(Number);
      const [bHour, bMinute] = b.startTime.split(':').map(Number);
      const aTime = aHour * 60 + aMinute;
      const bTime = bHour * 60 + bMinute;
      return aTime - bTime;
    });
  };

  // Get week days (Monday to Friday)
  const getWeekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Mon-Fri
  }, [currentDate]);

  // Generate time slots for week view based on school hours (30-minute intervals)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    const { startHour, endHour } = getSchoolHours;
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      if (hour < endHour - 1) {
        slots.push(`${String(hour).padStart(2, '0')}:30`);
      }
    }
    // Add final :30 slot if end hour is not on the hour
    // For now, we'll just add :30 slots up to endHour-1, so if endHour is 17 (5 PM), last slot is 16:30
    return slots;
  }, [getSchoolHours]);

  // Convert time string to minutes from midnight
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Get all events for a specific day, sorted by start time
  const getEventsForDaySorted = (day: Date): CalendarEvent[] => {
    return calendarEvents
      .filter(event => isSameDay(event.date, day))
      .sort((a, b) => {
        const aTime = timeToMinutes(a.startTime);
        const bTime = timeToMinutes(b.startTime);
        return aTime - bTime;
      });
  };

  // Calculate event height in pixels based on duration
  const getEventHeight = (event: CalendarEvent): number => {
    const [startHour, startMin] = event.startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const [endHour, endMin] = (event.endTime || '').split(':').map(Number);
    const endMinutes = endHour * 60 + endMin;
    const duration = endMinutes - startMinutes;
    // Each 30-minute slot is 60px, so calculate proportional height
    return Math.max((duration / 30) * 60, 40); // Minimum 40px height
  };

  // Calculate top position in pixels from start of day using school hours
  const getEventTopPosition = (event: CalendarEvent): number => {
    const [startHour, startMin] = event.startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const { startHour: schoolStartHour } = getSchoolHours;
    const dayStartMinutes = schoolStartHour * 60; // School start hour
    const minutesFromDayStart = startMinutes - dayStartMinutes;
    // Each 30-minute slot is 60px
    return (minutesFromDayStart / 30) * 60;
  };

  // Check if a time slot overlaps with any event
  const slotHasEvents = (day: Date, slot: string): boolean => {
    const slotMinutes = timeToMinutes(slot);
    const nextSlotMinutes = slotMinutes + 30;
    
    return calendarEvents.some(event => {
      if (!isSameDay(event.date, day)) return false;
      const eventStartMinutes = timeToMinutes(event.startTime);
      const eventEndMinutes = event.endTime ? timeToMinutes(event.endTime) : eventStartMinutes + 30;
      
      // Check if event overlaps with this slot
      return eventStartMinutes < nextSlotMinutes && eventEndMinutes > slotMinutes;
    });
  };

  const handleDragStart = (eventId: string) => {
    setDraggedSession(eventId);
  };

  const handleDrop = async (targetDate: Date) => {
    if (!isMountedRef.current) return;
    if (!draggedSession) return;

    const event = calendarEvents.find(e => e.id === draggedSession);
    if (!event) return;

    if (!Array.isArray(scheduledSessions)) return;
    const scheduled = scheduledSessions.find(s => s.id === event.scheduledSessionId);
    if (!scheduled) return;

    // For one-time or specific dates, update the date
    if (scheduled.recurrencePattern === 'none') {
      await updateScheduledSession(scheduled.id, {
        startDate: format(targetDate, 'yyyy-MM-dd'),
      });
      if (!isMountedRef.current) return;
    } else if (scheduled.recurrencePattern === 'specific-dates') {
      const oldDateStr = format(event.date, 'yyyy-MM-dd');
      const newDates = scheduled.specificDates?.filter(d => d !== oldDateStr) || [];
      newDates.push(format(targetDate, 'yyyy-MM-dd'));
      await updateScheduledSession(scheduled.id, {
        specificDates: newDates.sort(),
      });
      if (!isMountedRef.current) return;
    }

    setDraggedSession(null);
    await loadData();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const performCancellation = async (event: CalendarEvent) => {
    if (!isMountedRef.current) return;
    if (!Array.isArray(scheduledSessions)) return;
    const scheduled = scheduledSessions.find(s => s.id === event.scheduledSessionId);
    if (!scheduled) return;

    const dateStr = format(event.date, 'yyyy-MM-dd');
    const cancelledDates = scheduled.cancelledDates || [];
    
    // Don't allow cancelling sessions that have been logged
    if (event.isLogged) {
      // Don't allow cancelling logged sessions (past or future)
      return;
    }

    // Only cancel this specific date - ensure we're not overwriting other cancelled dates
    if (!cancelledDates.includes(dateStr)) {
      await updateScheduledSession(scheduled.id, {
        cancelledDates: [...cancelledDates, dateStr],
      });
      if (!isMountedRef.current) return;
      await loadData();
    }
  };

  const handleCancelEvent = async (event: CalendarEvent) => {
    if (!Array.isArray(scheduledSessions)) return;
    const scheduled = scheduledSessions.find(s => s.id === event.scheduledSessionId);
    if (!scheduled) return;

    const dateStr = format(event.date, 'yyyy-MM-dd');
    
    // Don't allow cancelling sessions that have been logged
    if (event.isLogged) {
      return;
    }

    // Open cancellation email dialog
    setPendingCancellation({ event, dateStr });
    setCancellationEmailDialogOpen(true);
  };

  const handleDeleteMeeting = async (event: CalendarEvent) => {
    if (!event.isMeeting || !event.meetingId) return;

    confirm({
      title: 'Delete Meeting',
      message: `Are you sure you want to delete "${event.title}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        if (!isMountedRef.current) return;
        try {
          await deleteMeeting(event.meetingId!);
          if (!isMountedRef.current) return;
          await loadData();
        } catch (error) {
          if (!isMountedRef.current) return;
          logError('Failed to delete meeting', error);
          alert('Failed to delete meeting. Please try again.');
        }
      },
    });
  };

  const handleOpenMeetingDialog = (event: CalendarEvent) => {
    if (!event.isMeeting || !event.meetingId) return;
    
    const meeting = meetings.find(m => m.id === event.meetingId);
    if (meeting) {
      setEditingMeeting(meeting);
      setMeetingDialogOpen(true);
    }
  };

  const handleSaveMeeting = async (meeting: Omit<Meeting, 'id' | 'dateCreated' | 'dateUpdated'>) => {
    if (!isMountedRef.current) return;
    try {
      if (editingMeeting) {
        await updateMeeting(editingMeeting.id, meeting);
      } else {
        await createMeeting(meeting);
      }
      if (!isMountedRef.current) return;
      await loadData();
      if (!isMountedRef.current) return;
      setMeetingDialogOpen(false);
      setEditingMeeting(null);
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to save meeting', error);
      alert('Failed to save meeting. Please try again.');
    }
  };

  const handleCloseMeetingDialog = () => {
    setMeetingDialogOpen(false);
    setEditingMeeting(null);
  };

  const handleCancellationEmailSent = async () => {
    if (!isMountedRef.current) return;
    if (pendingCancellation?.event) {
      await performCancellation(pendingCancellation.event);
      if (!isMountedRef.current) return;
      setPendingCancellation(null);
    } else if (pendingCancellation?.events) {
      // Handle multiple events cancellation
      for (const event of pendingCancellation.events) {
        await performCancellation(event);
        if (!isMountedRef.current) return;
      }
      setPendingCancellation(null);
    }
  };

  const handleCancelAllEventsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayEvents = calendarEvents.filter(event => isSameDay(event.date, day));
    
    // Filter out logged events - only cancel events that haven't been logged
    const cancellableEvents = dayEvents.filter(event => !event.isLogged);
    
    if (cancellableEvents.length === 0) {
      // No cancellable events for this day
      return;
    }

    // Group events by scheduledSessionId to avoid duplicate updates
    const scheduledSessionMap = new Map<string, CalendarEvent[]>();
    cancellableEvents.forEach(event => {
      const existing = scheduledSessionMap.get(event.scheduledSessionId) || [];
      scheduledSessionMap.set(event.scheduledSessionId, [...existing, event]);
    });

    confirm({
      title: 'Cancel All Appointments',
      message: `Cancel all ${cancellableEvents.length} appointment${cancellableEvents.length === 1 ? '' : 's'} on ${format(day, 'MMM d, yyyy')}? This will mark all appointments for this day as cancelled.`,
      confirmText: 'Cancel All',
      cancelText: 'Keep Scheduled',
      onConfirm: async () => {
        // Open cancellation email dialog for all events
        // Collect all unique student IDs from all events
        const allStudentIds = new Set<string>();
        cancellableEvents.forEach(event => {
          event.studentIds.forEach(id => allStudentIds.add(id));
        });

        // Use the first event for time/date info (they should all be on the same day)
        const firstEvent = cancellableEvents[0];
        if (firstEvent) {
          setPendingCancellation({ events: cancellableEvents, dateStr });
          setCancellationEmailDialogOpen(true);
        }
      },
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Session Planning Calendar
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="month">Month</ToggleButton>
            <ToggleButton value="week">Week</ToggleButton>
            <ToggleButton value="day">Day</ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Schedule Session
          </Button>
          <Button
            variant="outlined"
            startIcon={<EventIcon />}
            onClick={() => {
              setEditingMeeting(null);
              setMeetingDialogOpen(true);
            }}
          >
            Schedule meeting
          </Button>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={handlePreviousPeriod}>
                <ChevronLeft />
              </IconButton>
              <Typography variant="h5">
                {viewMode === 'week' 
                  ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                  : viewMode === 'day'
                  ? format(currentDate, 'EEEE, MMMM d, yyyy')
                  : format(currentDate, 'MMMM yyyy')}
              </Typography>
              <IconButton onClick={handleNextPeriod}>
                <ChevronRight />
              </IconButton>
              <Button
                variant="outlined"
                startIcon={<TodayIcon />}
                onClick={handleToday}
                size="small"
              >
                Today
              </Button>
            </Box>
          </Box>

          {calendarEvents.some(e => e.hasConflict) && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Some sessions have scheduling conflicts. Please review and resolve them.
            </Alert>
          )}

          {viewMode === 'day' ? (
            // Day View with Time Column
            <Box>
              <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                {/* Time Column */}
                <Box
                  sx={{
                    width: { xs: 60, sm: 80 },
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      height: 48,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Time
                    </Typography>
                  </Box>
                  {timeSlots.map((slot, index) => (
                    <Box
                      key={slot}
                      sx={{
                        height: 60,
                        borderBottom: index % 2 === 1 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        pr: 1,
                      }}
                    >
                      {index % 2 === 0 && (
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                        >
                          {format(parse(slot, 'HH:mm', new Date()), 'h:mm a')}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>

                {/* Day Column */}
                <Box sx={{ flex: 1 }}>
                  {(() => {
                    const day = currentDate;
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <Box>
                        {/* Day Header */}
                        <Box
                          sx={{
                            height: 48,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 1,
                            backgroundColor: isToday ? 'primary.light' : 'background.paper',
                            cursor: 'pointer',
                          }}
                          onDoubleClick={() => handleOpenDialog(day)}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <Typography
                              variant="body2"
                              fontWeight={isToday ? 'bold' : 'normal'}
                              color={isToday ? 'primary.contrastText' : 'text.primary'}
                            >
                              {format(day, 'EEEE')}
                            </Typography>
                            <Typography
                              variant="caption"
                              color={isToday ? 'primary.contrastText' : 'text.secondary'}
                            >
                              {format(day, 'MMMM d, yyyy')}
                            </Typography>
                          </Box>
                          {(() => {
                            const cancellableEvents = calendarEvents.filter(
                              event => isSameDay(event.date, day) && !event.isLogged
                            );
                            if (cancellableEvents.length > 0) {
                              return (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelAllEventsForDay(day);
                                  }}
                                  sx={{
                                    color: isToday ? 'primary.contrastText' : 'text.secondary',
                                    '&:hover': {
                                      backgroundColor: isToday ? 'primary.main' : 'action.hover',
                                    },
                                  }}
                                  title="Cancel all appointments for this day"
                                >
                                  <EventBusyIcon fontSize="small" />
                                </IconButton>
                              );
                            }
                            return null;
                          })()}
                        </Box>

                        {/* Time Slots for this day - Background grid */}
                        <Box 
                          sx={{ 
                            position: 'relative',
                            height: timeSlots.length * 60, // Total height for all slots
                          }}
                          onDrop={() => handleDrop(day)}
                          onDragOver={handleDragOver}
                        >
                          {/* Render time slot rows for gap visualization */}
                          {timeSlots.map((slot, slotIndex) => {
                            const isHourMark = slot.endsWith(':00');
                            const hasEvents = slotHasEvents(day, slot);
                            
                            return (
                              <Box
                                key={`slot-${day.toISOString()}-${slot}`}
                                sx={{
                                  position: 'absolute',
                                  top: slotIndex * 60,
                                  left: 0,
                                  right: 0,
                                  height: 60,
                                  borderBottom: isHourMark ? '2px solid' : slotIndex % 2 === 1 ? '1px solid' : 'none',
                                  borderColor: 'divider',
                                  backgroundColor: hasEvents ? 'transparent' : '#f5f5f5',
                                  borderLeft: hasEvents ? 'none' : '4px solid #d0d0d0',
                                  pointerEvents: 'none',
                                  zIndex: 0,
                                }}
                              />
                            );
                          })}
                          
                          {/* Render events positioned absolutely by their actual times */}
                          {getEventsForDaySorted(day).map((event) => {
                            const eventDate = startOfDay(event.date);
                            const today = startOfDay(new Date());
                            const canCancel = !event.isLogged;
                            const topPosition = getEventTopPosition(event);
                            const eventHeight = getEventHeight(event);

                            return (
                              <Box
                                key={event.id}
                                sx={{
                                  position: 'absolute',
                                  top: `${topPosition}px`,
                                  left: { xs: 2, sm: 4 },
                                  right: { xs: 2, sm: 4 },
                                  height: `${eventHeight}px`,
                                  zIndex: 1,
                                  '&:hover .cancel-button': {
                                    opacity: 1,
                                  },
                                }}
                              >
                                <Chip
                                  label={event.title}
                                  size="small"
                                  color={
                                    event.isMeeting 
                                      ? 'default' 
                                      : event.hasConflict 
                                        ? 'error' 
                                        : event.isMissed 
                                          ? 'error' 
                                          : event.isLogged 
                                            ? 'success' 
                                            : 'primary'
                                  }
                                  icon={<EventIcon />}
                                  draggable={!event.isMeeting}
                                  onDragStart={!event.isMeeting ? () => handleDragStart(event.id) : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.isMeeting) {
                                      handleOpenMeetingDialog(event);
                                      return;
                                    }
                                    handleOpenSessionDialog(event);
                                  }}
                                  sx={{
                                    fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                    height: '100%',
                                    width: '100%',
                                    justifyContent: 'flex-start',
                                    ...(event.isMeeting && {
                                      backgroundColor: '#ba68c8', // Light purple
                                      color: '#fff',
                                      '&:hover': {
                                        backgroundColor: '#ab47bc', // Slightly darker purple on hover
                                      },
                                    }),
                                    '& .MuiChip-label': {
                                      whiteSpace: 'normal',
                                      display: 'flex',
                                      alignItems: 'center',
                                      height: '100%',
                                      padding: { xs: '4px 8px', sm: '4px 12px' },
                                    },
                                  }}
                                />
                                {canCancel && (
                                  <IconButton
                                    size="small"
                                    className="cancel-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (event.isMeeting) {
                                        handleDeleteMeeting(event);
                                      } else {
                                        confirm({
                                          title: 'Cancel Session',
                                          message: `Cancel this session on ${format(event.date, 'MMM d, yyyy')}?`,
                                          confirmText: 'Cancel Session',
                                          cancelText: 'Keep Scheduled',
                                          onConfirm: () => {
                                            handleCancelEvent(event);
                                          },
                                        });
                                      }
                                    }}
                                    sx={{
                                      position: 'absolute',
                                      top: -8,
                                      right: -8,
                                      opacity: 0,
                                      transition: 'opacity 0.2s',
                                      padding: '2px',
                                      backgroundColor: 'background.paper',
                                      '&:hover': {
                                        backgroundColor: 'error.light',
                                        color: 'error.main',
                                      },
                                    }}
                                  >
                                    <CloseIcon sx={{ fontSize: '0.9rem' }} />
                                  </IconButton>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })()}
                </Box>
              </Box>
            </Box>
          ) : viewMode === 'week' ? (
            // Week View with Time Column
            <Box>
              <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider' }}>
                {/* Time Column */}
                <Box
                  sx={{
                    width: 80,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      height: 48,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Time
                    </Typography>
                  </Box>
                  {timeSlots.map((slot, index) => (
                    <Box
                      key={slot}
                      sx={{
                        height: 60,
                        borderBottom: index % 2 === 1 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        pr: 1,
                      }}
                    >
                      {index % 2 === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {format(parse(slot, 'HH:mm', new Date()), 'h:mm a')}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>

                {/* Day Columns */}
                <Box sx={{ display: 'flex', flex: 1 }}>
                  {getWeekDays.map((day, dayIndex) => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentWeek = isSameMonth(day, currentDate) || 
                      Math.abs(day.getMonth() - currentDate.getMonth()) <= 1;
                    
                    return (
                      <Box
                        key={day.toISOString()}
                        sx={{
                          flex: 1,
                          borderRight: dayIndex < 4 ? '1px solid' : 'none',
                          borderColor: 'divider',
                          minWidth: 0,
                        }}
                      >
                        {/* Day Header */}
                        <Box
                          sx={{
                            height: 48,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 0.5,
                            backgroundColor: isToday ? 'primary.light' : 'background.paper',
                            cursor: 'pointer',
                          }}
                          onDoubleClick={() => handleOpenDialog(day)}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <Typography
                              variant="body2"
                              fontWeight={isToday ? 'bold' : 'normal'}
                              color={isToday ? 'primary.contrastText' : 'text.primary'}
                            >
                              {format(day, 'EEE')}
                            </Typography>
                            <Typography
                              variant="caption"
                              color={isToday ? 'primary.contrastText' : 'text.secondary'}
                            >
                              {format(day, 'M/d')}
                            </Typography>
                          </Box>
                          {(() => {
                            const cancellableEvents = calendarEvents.filter(
                              event => isSameDay(event.date, day) && !event.isLogged
                            );
                            if (cancellableEvents.length > 0) {
                              return (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelAllEventsForDay(day);
                                  }}
                                  sx={{
                                    color: isToday ? 'primary.contrastText' : 'text.secondary',
                                    padding: '4px',
                                    '&:hover': {
                                      backgroundColor: isToday ? 'primary.main' : 'action.hover',
                                    },
                                  }}
                                  title="Cancel all appointments for this day"
                                >
                                  <EventBusyIcon sx={{ fontSize: '1rem' }} />
                                </IconButton>
                              );
                            }
                            return null;
                          })()}
                        </Box>

                        {/* Time Slots for this day - Background grid */}
                        <Box 
                          sx={{ 
                            position: 'relative',
                            height: timeSlots.length * 60, // Total height for all slots
                          }}
                          onDrop={() => handleDrop(day)}
                          onDragOver={handleDragOver}
                        >
                          {/* Render time slot rows for gap visualization */}
                          {timeSlots.map((slot, slotIndex) => {
                            const isHourMark = slot.endsWith(':00');
                            const hasEvents = slotHasEvents(day, slot);
                            
                            return (
                              <Box
                                key={`slot-${day.toISOString()}-${slot}`}
                                sx={{
                                  position: 'absolute',
                                  top: slotIndex * 60,
                                  left: 0,
                                  right: 0,
                                  height: 60,
                                  borderBottom: isHourMark ? '2px solid' : slotIndex % 2 === 1 ? '1px solid' : 'none',
                                  borderColor: 'divider',
                                  backgroundColor: hasEvents ? 'transparent' : '#f5f5f5',
                                  borderLeft: hasEvents ? 'none' : '4px solid #d0d0d0',
                                  pointerEvents: 'none',
                                  zIndex: 0,
                                }}
                              />
                            );
                          })}
                          
                          {/* Render events positioned absolutely by their actual times */}
                          {getEventsForDaySorted(day).map((event) => {
                            const eventDate = startOfDay(event.date);
                            const today = startOfDay(new Date());
                            const canCancel = !event.isLogged;
                            const topPosition = getEventTopPosition(event);
                            const eventHeight = getEventHeight(event);

                            return (
                              <Box
                                key={event.id}
                                sx={{
                                  position: 'absolute',
                                  top: `${topPosition}px`,
                                  left: 4,
                                  right: 4,
                                  height: `${eventHeight}px`,
                                  zIndex: 1,
                                  '&:hover .cancel-button': {
                                    opacity: 1,
                                  },
                                }}
                              >
                                <Chip
                                  label={event.title}
                                  size="small"
                                  color={
                                    event.isMeeting 
                                      ? 'default' 
                                      : event.hasConflict 
                                        ? 'error' 
                                        : event.isMissed 
                                          ? 'error' 
                                          : event.isLogged 
                                            ? 'success' 
                                            : 'primary'
                                  }
                                  icon={<EventIcon />}
                                  draggable={!event.isMeeting}
                                  onDragStart={!event.isMeeting ? () => handleDragStart(event.id) : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.isMeeting) {
                                      handleOpenMeetingDialog(event);
                                      return;
                                    }
                                    handleOpenSessionDialog(event);
                                  }}
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: '100%',
                                    width: '100%',
                                    justifyContent: 'flex-start',
                                    ...(event.isMeeting && {
                                      backgroundColor: '#ba68c8', // Light purple
                                      color: '#fff',
                                      '&:hover': {
                                        backgroundColor: '#ab47bc', // Slightly darker purple on hover
                                      },
                                    }),
                                    '& .MuiChip-label': {
                                      whiteSpace: 'normal',
                                      display: 'flex',
                                      alignItems: 'center',
                                      height: '100%',
                                    },
                                  }}
                                />
                                {canCancel && (
                                  <IconButton
                                    size="small"
                                    className="cancel-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (event.isMeeting) {
                                        handleDeleteMeeting(event);
                                      } else {
                                        confirm({
                                          title: 'Cancel Session',
                                          message: `Cancel this session on ${format(event.date, 'MMM d, yyyy')}?`,
                                          confirmText: 'Cancel Session',
                                          cancelText: 'Keep Scheduled',
                                          onConfirm: () => {
                                            handleCancelEvent(event);
                                          },
                                        });
                                      }
                                    }}
                                    sx={{
                                      position: 'absolute',
                                      top: -8,
                                      right: -8,
                                      opacity: 0,
                                      transition: 'opacity 0.2s',
                                      padding: '2px',
                                      backgroundColor: 'background.paper',
                                      '&:hover': {
                                        backgroundColor: 'error.light',
                                        color: 'error.main',
                                      },
                                    }}
                                  >
                                    <CloseIcon sx={{ fontSize: '0.9rem' }} />
                                  </IconButton>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          ) : (
            // Month View
          <Box>
            {/* Day Headers */}
            <Box 
              sx={{ 
                display: 'flex',
                mb: 0.5,
                borderBottom: '2px solid',
                borderColor: 'divider',
              }}
            >
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                <Box
                  key={day}
                  sx={{
                    flex: '1 1 0',
                    textAlign: 'center',
                    py: 1.5,
                    fontWeight: 'bold',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {day}
                  </Typography>
                </Box>
              ))}
            </Box>
            
            {/* Calendar Days */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
              }}
            >
              {daysInMonth.map(day => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <Box
                    key={day.toISOString()}
                    sx={{
                      flex: '1 1 calc(20% - 4px)', // 100% / 5 columns minus gap (Mon-Fri only)
                      minWidth: 0,
                      minHeight: 120,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 0.5,
                      backgroundColor: isCurrentMonth ? 'background.paper' : 'action.hover',
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                    onDoubleClick={() => handleOpenDialog(day)}
                    onDrop={() => handleDrop(day)}
                    onDragOver={handleDragOver}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          fontWeight: isToday ? 'bold' : 'normal',
                          color: isToday ? 'primary.main' : isCurrentMonth ? 'text.primary' : 'text.disabled',
                        }}
                      >
                        {format(day, 'd')}
                      </Box>
                      {(() => {
                        const cancellableEvents = dayEvents.filter(event => !event.isLogged);
                        if (cancellableEvents.length > 0) {
                          return (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelAllEventsForDay(day);
                              }}
                              sx={{
                                padding: '2px',
                                '&:hover': {
                                  backgroundColor: 'error.light',
                                  color: 'error.main',
                                },
                              }}
                              title="Cancel all appointments for this day"
                            >
                              <EventBusyIcon sx={{ fontSize: '0.875rem' }} />
                            </IconButton>
                          );
                        }
                        return null;
                      })()}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
                      {dayEvents.map(event => {
                        const eventDate = startOfDay(event.date);
                        const today = startOfDay(new Date());
                        const isFuture = isAfter(eventDate, today) || isSameDay(eventDate, today);
                        const canCancel = !event.isLogged;

                        return (
                          <Box
                            key={event.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              position: 'relative',
                              '&:hover .cancel-button': {
                                opacity: 1,
                              },
                            }}
                          >
                            <Chip
                              label={event.title}
                              size="small"
                              color={
                                event.isMeeting 
                                  ? 'default' 
                                  : event.hasConflict 
                                    ? 'error' 
                                    : event.isMissed 
                                      ? 'error' 
                                      : event.isLogged 
                                        ? 'success' 
                                        : 'primary'
                              }
                              icon={<EventIcon />}
                              draggable={!event.isMeeting}
                              onDragStart={!event.isMeeting ? () => handleDragStart(event.id) : undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (event.isMeeting) {
                                  handleOpenMeetingDialog(event);
                                  return;
                                }
                                handleOpenSessionDialog(event);
                              }}
                              sx={{
                                fontSize: '0.7rem',
                                height: 20,
                                flex: 1,
                                '& .MuiChip-label': { px: 0.5 },
                                justifyContent: 'flex-start',
                                ...(event.isMeeting && {
                                  backgroundColor: '#ba68c8', // Light purple
                                  color: '#fff',
                                  '&:hover': {
                                    backgroundColor: '#ab47bc', // Slightly darker purple on hover
                                  },
                                }),
                              }}
                            />
                            {canCancel && (
                              <IconButton
                                size="small"
                                className="cancel-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (event.isMeeting) {
                                    handleDeleteMeeting(event);
                                  } else {
                                    confirm({
                                      title: 'Cancel Session',
                                      message: `Cancel this session on ${format(event.date, 'MMM d, yyyy')}?`,
                                      confirmText: 'Cancel Session',
                                      cancelText: 'Keep Scheduled',
                                      onConfirm: () => {
                                        handleCancelEvent(event);
                                      },
                                    });
                                  }
                                }}
                                sx={{
                                  opacity: 0,
                                  transition: 'opacity 0.2s',
                                  padding: '2px',
                                  '&:hover': {
                                    backgroundColor: 'error.light',
                                    color: 'error.main',
                                  },
                                }}
                              >
                                <CloseIcon sx={{ fontSize: '0.9rem' }} />
                              </IconButton>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Recurring Sessions List */}
      <Card>
        <CardContent>
          <Accordion defaultExpanded={false}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              slotProps={{
                content: {
                  component: 'div',
                },
              }}
            >
              <Typography variant="h6" component="div">
                Scheduled Recurring Sessions
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(!Array.isArray(scheduledSessions) || scheduledSessions.filter(s => s.recurrencePattern !== 'none').length === 0) ? (
                <Typography color="text.secondary">
                  No scheduled recurring sessions. Click "Schedule Session" to create one.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {(Array.isArray(scheduledSessions) ? scheduledSessions : [])
                    .filter(s => s.recurrencePattern !== 'none')
                    .map(scheduled => {
                      const studentNames = scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ');
                      const schoolName = getSchoolForStudentIds(scheduled.studentIds);
                      return (
                        <Card key={scheduled.id} variant="outlined">
                          <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {studentNames}{schoolName ? ` — ${schoolName}` : ''}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {scheduled.startTime} {scheduled.endTime && `- ${scheduled.endTime}`}
                                  {' • '}
                                  {scheduled.recurrencePattern === 'weekly' && Array.isArray(scheduled.dayOfWeek) && scheduled.dayOfWeek.length > 0 && (
                                    <>Weekly on {(scheduled.dayOfWeek as number[]).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</>
                                  )}
                                  {scheduled.recurrencePattern === 'daily' && 'Daily'}
                                  {scheduled.recurrencePattern === 'specific-dates' && `${scheduled.specificDates?.length || 0} specific dates`}
                                </Typography>
                                {scheduled.notes && (
                                  <Typography variant="body2" sx={{ mt: 1 }}>
                                    {scheduled.notes}
                                  </Typography>
                                )}
                              </Box>
                              <Box>
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenDialog(undefined, scheduled)}
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(scheduled.id)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      {/* Schedule Session Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={(event, reason) => {
          // Prevent closing on backdrop click or escape key - let the handler decide
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            handleCloseDialog();
          }
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {editingScheduledSession ? 'Edit Scheduled Session' : 'Schedule New Session'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>School</InputLabel>
              <Select
                value={scheduleFormSchool}
                onChange={(e) => {
                  const newSchool = e.target.value;
                  setScheduleFormSchool(newSchool);
                  setFormData(prev => ({
                    ...prev,
                    studentIds: prev.studentIds.filter(id => students.find(s => s.id === id && s.school === newSchool)),
                  }));
                }}
                label="School"
              >
                {availableSchools.map((schoolName) => (
                  <MenuItem key={schoolName} value={schoolName}>
                    {schoolName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <StudentSelector
              students={students.filter(s => s.school === scheduleFormSchool)}
              selectedStudentIds={formData.studentIds}
              searchTerm={scheduleStudentSearch}
              onSearchChange={setScheduleStudentSearch}
              onStudentToggle={handleScheduleStudentToggle}
              autoFocus={!editingScheduledSession}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Time"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Time"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>

            <TextField
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Recurrence Pattern</InputLabel>
              <Select
                value={formData.recurrencePattern}
                onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value as ScheduledSession['recurrencePattern'] })}
                label="Recurrence Pattern"
              >
                <MenuItem value="none">One-time</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="specific-dates">Specific Dates</MenuItem>
              </Select>
            </FormControl>

            {formData.recurrencePattern === 'weekly' && (
              <FormControl fullWidth>
                <InputLabel>Days of Week</InputLabel>
                <Select
                  multiple
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value as number[] })}
                  label="Days of Week"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((d) => (
                        <Chip key={d} label={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <MenuItem key={day} value={day}>
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {formData.recurrencePattern === 'specific-dates' && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Select specific dates (one per line, format: YYYY-MM-DD)
                </Typography>
                <TextField
                  multiline
                  rows={4}
                  placeholder="2024-01-15\n2024-01-22\n2024-01-29"
                  value={formData.specificDates.join('\n')}
                  onChange={(e) => {
                    const dates = e.target.value.split('\n').filter(d => d.trim());
                    setFormData({ ...formData, specificDates: dates });
                  }}
                  fullWidth
                />
              </Box>
            )}

            {(formData.recurrencePattern === 'weekly' || formData.recurrencePattern === 'daily') && (
              <TextField
                label="End Date (Optional)"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            )}

            <FormControl fullWidth>
              <InputLabel>Goals Targeted</InputLabel>
              <Select
                multiple
                value={formData.goalsTargeted}
                onChange={(e) => setFormData({ ...formData, goalsTargeted: e.target.value as string[] })}
                label="Goals Targeted"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.slice(0, 3).map((id) => {
                      const goal = goals.find(g => g.id === id);
                      return <Chip key={id} label={goal?.description || id} size="small" />;
                    })}
                    {selected.length > 3 && <Chip label={`+${selected.length - 3} more`} size="small" />}
                  </Box>
                )}
              >
                {formData.studentIds.flatMap(studentId =>
                  goals.filter(g => g.studentId === studentId).map(goal => (
                    <MenuItem key={goal.id} value={goal.id}>
                      {students.find(s => s.id === goal.studentId)?.name}: {goal.description}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <TextField
              label="Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session Form Dialog */}
      <SessionFormDialog
        open={sessionDialogOpen}
        editingSession={editingSession}
        editingGroupSessionId={editingGroupSessionId}
        students={students}
        goals={goals}
        sessions={sessions}
        formData={sessionFormData}
        studentSearch={studentSearch}
        isDirty={isSessionFormDirty}
        onClose={handleCloseSessionDialog}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
        onFormDataChange={handleSessionFormDataChange}
        onStudentSearchChange={setStudentSearch}
        onStudentToggle={handleStudentToggle}
        onGoalToggle={handleGoalToggle}
        onPerformanceUpdate={handlePerformanceUpdate}
        onCuingLevelToggle={handleCuingLevelToggle}
        onTrialUpdate={handleTrialUpdate}
        getRecentPerformance={getRecentPerformance}
        isGoalAchieved={isGoalAchieved}
        onMarkGoalMet={handleMarkGoalMet}
      />
      <ConfirmDialog />
      
      {pendingCancellation && (pendingCancellation.event || pendingCancellation.events) && (
        <CancellationEmailDialog
          open={cancellationEmailDialogOpen}
          onClose={async () => {
            if (!isMountedRef.current) return;
            setCancellationEmailDialogOpen(false);
            // Perform cancellation when dialog closes (whether email was sent or not)
            if (pendingCancellation?.event) {
              await performCancellation(pendingCancellation.event);
              if (!isMountedRef.current) return;
            } else if (pendingCancellation?.events) {
              for (const event of pendingCancellation.events) {
                await performCancellation(event);
                if (!isMountedRef.current) return;
              }
            }
            setPendingCancellation(null);
          }}
          studentIds={
            pendingCancellation.event
              ? pendingCancellation.event.studentIds
              : pendingCancellation.events
              ? Array.from(new Set(pendingCancellation.events.flatMap(e => e.studentIds)))
              : []
          }
          students={students}
          sessionDate={
            pendingCancellation.event
              ? pendingCancellation.event.date
              : pendingCancellation.events && pendingCancellation.events.length > 0
              ? pendingCancellation.events[0].date
              : new Date()
          }
          sessionTime={
            pendingCancellation.event
              ? pendingCancellation.event.startTime
              : pendingCancellation.events && pendingCancellation.events.length > 0
              ? pendingCancellation.events[0].startTime
              : '09:00'
          }
          sessionEndTime={
            pendingCancellation.event
              ? pendingCancellation.event.endTime
              : pendingCancellation.events && pendingCancellation.events.length > 0
              ? pendingCancellation.events[0].endTime
              : undefined
          }
        />
      )}

      {/* Meeting Edit Dialog */}
      <MeetingFormDialog
        open={meetingDialogOpen}
        editingMeeting={editingMeeting}
        onClose={handleCloseMeetingDialog}
        onSave={handleSaveMeeting}
        students={students}
      />
    </Box>
  );
};

