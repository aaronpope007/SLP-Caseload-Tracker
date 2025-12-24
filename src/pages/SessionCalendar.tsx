import { useState, useEffect, useMemo, useRef } from 'react';
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
} from 'date-fns';
import type { ScheduledSession, Student, Session, Goal, School } from '../types';
import {
  getScheduledSessions,
  addScheduledSession,
  updateScheduledSession,
  deleteScheduledSession,
} from '../utils/storage';
import {
  getStudents,
  getSessions,
  getGoals,
  addSession,
  updateSession,
  deleteSession,
  getSchoolByName,
} from '../utils/storage-api';
import { generateId, toLocalDateTimeString, fromLocalDateTimeString } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { StudentSelector } from '../components/StudentSelector';
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
}

export const SessionCalendar = () => {
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScheduledSession, setEditingScheduledSession] = useState<ScheduledSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedSession, setDraggedSession] = useState<string | null>(null);
  const [scheduleStudentSearch, setScheduleStudentSearch] = useState('');
  
  // Session form dialog state
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingGroupSessionId, setEditingGroupSessionId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [currentEvent, setCurrentEvent] = useState<CalendarEvent | null>(null);
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

  useEffect(() => {
    loadData();
  }, [selectedSchool]);

  const loadData = async () => {
    try {
      const schoolObj = await getSchoolByName(selectedSchool);
      setSchool(schoolObj || null);
      const schoolStudents = await getStudents(selectedSchool);
      setStudents(schoolStudents.filter(s => s.archived !== true));
      const allSessions = await getSessions();
      const studentIds = new Set(schoolStudents.map(s => s.id));
      setSessions(allSessions.filter(s => studentIds.has(s.studentId)));
      const allGoals = await getGoals();
      setGoals(allGoals.filter(g => studentIds.has(g.studentId)));
      const scheduled = getScheduledSessions(selectedSchool);
      setScheduledSessions(scheduled);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  // Get school hours, defaulting to 8 AM - 5 PM (8-17)
  const getSchoolHours = useMemo(() => {
    const startHour = school?.schoolHours?.startHour ?? 8;
    const endHour = school?.schoolHours?.endHour ?? 17;
    return { startHour, endHour };
  }, [school]);

  // Helper function to format student name with grade
  const formatStudentNameWithGrade = (studentId: string): string => {
    const student = students.find(s => s.id === studentId);
    if (!student) return 'Unknown';
    return student.grade ? `${student.name} (${student.grade})` : student.name;
  };

  // Generate calendar events from scheduled sessions
  const calendarEvents = useMemo((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const today = startOfDay(new Date());
    const endDate = addMonths(currentDate, 2); // Show events up to 2 months ahead

    scheduledSessions.forEach(scheduled => {
      if (scheduled.active === false) return;

      const start = parse(scheduled.startDate, 'yyyy-MM-dd', new Date());
      const end = scheduled.endDate ? parse(scheduled.endDate, 'yyyy-MM-dd', new Date()) : endDate;

      if (isBefore(end, today)) return;

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

      if (scheduled.recurrencePattern === 'weekly' && scheduled.dayOfWeek) {
        // Generate weekly recurring events
        let date = start;
        while (isBefore(date, end) || isSameDay(date, end)) {
          if (scheduled.dayOfWeek.includes(date.getDay())) {
            const dateStr = format(date, 'yyyy-MM-dd');
            // Skip cancelled dates
            if (!scheduled.cancelledDates || !scheduled.cancelledDates.includes(dateStr)) {
              events.push({
                id: `${scheduled.id}-${dateStr}`,
                scheduledSessionId: scheduled.id,
                studentIds: scheduled.studentIds,
                date: date,
                startTime: scheduled.startTime,
                endTime: scheduled.endTime || endTimeStr,
                title: `${scheduled.startTime}-${scheduled.endTime || endTimeStr} ${scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ')}`,
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
        let date = start;
        while (isBefore(date, end) || isSameDay(date, end)) {
          const dateStr = format(date, 'yyyy-MM-dd');
          // Skip cancelled dates
          if (!scheduled.cancelledDates || !scheduled.cancelledDates.includes(dateStr)) {
            events.push({
              id: `${scheduled.id}-${dateStr}`,
              scheduledSessionId: scheduled.id,
              studentIds: scheduled.studentIds,
              date: date,
              startTime: scheduled.startTime,
              endTime: scheduled.endTime || endTimeStr,
              title: `${scheduled.startTime}-${scheduled.endTime || endTimeStr} ${scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ')}`,
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
          if ((isAfter(date, start) || isSameDay(date, start)) && 
              (isBefore(date, end) || isSameDay(date, end))) {
            events.push({
              id: `${scheduled.id}-${dateStr}`,
              scheduledSessionId: scheduled.id,
              studentIds: scheduled.studentIds,
              date: date,
              startTime: scheduled.startTime,
              endTime: scheduled.endTime || endTimeStr,
              title: `${scheduled.startTime}-${scheduled.endTime || endTimeStr} ${scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ')}`,
              hasConflict: false,
              isLogged: false,
              isMissed: false,
            });
          }
        });
      } else if (scheduled.recurrencePattern === 'none') {
        // One-time event
        const dateStr = scheduled.startDate;
        // Skip if cancelled
        if (!scheduled.cancelledDates || !scheduled.cancelledDates.includes(dateStr)) {
          const date = parse(dateStr, 'yyyy-MM-dd', new Date());
          events.push({
            id: scheduled.id,
            scheduledSessionId: scheduled.id,
            studentIds: scheduled.studentIds,
            date: date,
            startTime: scheduled.startTime,
            endTime: scheduled.endTime || endTimeStr,
            title: `${scheduled.startTime}-${scheduled.endTime || endTimeStr} ${scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ')}`,
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
        addDays(eventStart, 1);

      const conflictingEvent = events.find(e => {
        if (e.id === event.id) return false;
        if (!e.studentIds.some(id => event.studentIds.includes(id))) return false;
        
        const eStart = setMinutes(setHours(e.date, parseInt(e.startTime.split(':')[0])), parseInt(e.startTime.split(':')[1]));
        const eEnd = e.endTime ? 
          setMinutes(setHours(e.date, parseInt(e.endTime.split(':')[0])), parseInt(e.endTime.split(':')[1])) :
          addDays(eStart, 1);

        return isSameDay(e.date, event.date) && 
               ((isAfter(eStart, eventStart) && isBefore(eStart, eventEnd)) ||
                (isAfter(eventStart, eStart) && isBefore(eventStart, eEnd)) ||
                isSameDay(eStart, eventStart));
      });

      event.hasConflict = !!conflictingEvent;
    });

    // Check if sessions have been logged for each event
    events.forEach(event => {
      // Check if there's a logged session that matches this scheduled event
      const eventDate = startOfDay(event.date);
      const eventStartTime = setMinutes(setHours(event.date, parseInt(event.startTime.split(':')[0])), parseInt(event.startTime.split(':')[1]));
      
      let isLogged = false;
      let isMissed = false;
      let matchedSession: Session | null = null;
      
      // Check if it matches by scheduledSessionId (primary method - most reliable)
      const matchingByScheduledId = sessions.find(session => {
        if (!session.scheduledSessionId) return false;
        if (session.scheduledSessionId !== event.scheduledSessionId) return false;
        const sessionDate = startOfDay(new Date(session.date));
        return isSameDay(sessionDate, eventDate);
      });
      
      if (matchingByScheduledId) {
        isLogged = true;
        matchedSession = matchingByScheduledId;
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
        if (matchedSession.groupSessionId) {
          // Get all sessions in the group
          matchedSessions = sessions.filter(s => s.groupSessionId === matchedSession!.groupSessionId);
        } else {
          // Single session
          matchedSessions = [matchedSession];
        }
      }
      
      // Check if the matched session (or any session in the group) is marked as missed
      if (isLogged && matchedSession) {
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

    return events;
  }, [scheduledSessions, students, currentDate, sessions]);

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

  const handleSave = () => {
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

    if (editingScheduledSession) {
      updateScheduledSession(editingScheduledSession.id, scheduledSession);
    } else {
      addScheduledSession(scheduledSession);
    }

    loadData();
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

  // Session form handlers
  const isGoalAchieved = (goal: Goal): boolean => {
    if (goal.status === 'achieved') {
      return true;
    }
    if (goal.parentGoalId) {
      const parentGoal = goals.find(g => g.id === goal.parentGoalId);
      if (parentGoal && parentGoal.status === 'achieved') {
        return true;
      }
    }
    return false;
  };

  const getRecentPerformance = (goalId: string, studentId: string) => {
    const goalSessions = sessions
      .filter(s => s.studentId === studentId && s.goalsTargeted.includes(goalId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
    
    const recentData = goalSessions.map(s => {
      const perf = s.performanceData.find(p => p.goalId === goalId);
      return perf?.accuracy;
    }).filter((a): a is number => a !== undefined);

    const average = recentData.length > 0
      ? recentData.reduce((sum, a) => sum + a, 0) / recentData.length
      : null;

    return average;
  };

  const handleOpenSessionDialog = (event: CalendarEvent) => {
    const scheduled = scheduledSessions.find(s => s.id === event.scheduledSessionId);
    if (!scheduled) return;

    // Check if this is an existing logged session
    if (event.isLogged && event.matchedSessions && event.matchedSessions.length > 0) {
      // Load existing session(s) for editing
      const matchedSessions = event.matchedSessions;
      
      if (matchedSessions.length === 1) {
        // Single session - edit it
        const session = matchedSessions[0];
        setEditingSession(session);
        setEditingGroupSessionId(null);
        
        const startDate = new Date(session.date);
        const endDate = session.endTime ? new Date(session.endTime) : null;
        
        // Filter out achieved goals when editing
        const activeGoalsTargeted = session.goalsTargeted.filter(gId => {
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
        };
        
        setSessionFormData(newFormData);
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
          session.goalsTargeted.forEach(gId => {
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
        };
        
        setSessionFormData(newFormData);
      }
    } else {
      // Create new session from scheduled event
      // Create date with the event's date and start time
      const [startHour, startMinute] = event.startTime.split(':').map(Number);
      const sessionDate = new Date(event.date);
      sessionDate.setHours(startHour, startMinute, 0, 0);

      // Calculate end time
      let endTimeDate: Date;
      if (event.endTime) {
        const [endHour, endMinute] = event.endTime.split(':').map(Number);
        endTimeDate = new Date(event.date);
        endTimeDate.setHours(endHour, endMinute, 0, 0);
      } else {
        // Default to 30 minutes later
        endTimeDate = new Date(sessionDate.getTime() + 30 * 60000);
      }

      // Filter goals to only active ones for the selected students
      const activeGoals = scheduled.goalsTargeted.filter(gId => {
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

      setSessionFormData({
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
      });
      setEditingSession(null);
      setEditingGroupSessionId(null);
    }
    
    setCurrentEvent(event); // Store the event so we can link the session when saving
    setSessionDialogOpen(true);
  };

  const handleCloseSessionDialog = () => {
    setSessionDialogOpen(false);
    setEditingSession(null);
    setEditingGroupSessionId(null);
    setStudentSearch('');
    setCurrentEvent(null);
  };

  const handleDeleteSession = () => {
    if (!editingSession && !editingGroupSessionId) {
      return;
    }

    const sessionCount = editingSession ? 1 : sessions.filter(s => s.groupSessionId === editingGroupSessionId).length;
    const sessionText = sessionCount === 1 ? 'session' : 'sessions';
    
    confirm({
      title: 'Delete Session',
      message: `Are you sure you want to delete this ${sessionText}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          if (editingSession) {
            // Delete single session
            await deleteSession(editingSession.id);
          } else if (editingGroupSessionId) {
            // Delete all sessions in the group
            const groupSessions = sessions.filter(s => s.groupSessionId === editingGroupSessionId);
            for (const session of groupSessions) {
              await deleteSession(session.id);
            }
          }

          // Reload data to update calendar
          await loadData();
          handleCloseSessionDialog();
        } catch (error) {
          console.error('Failed to delete session:', error);
          alert('Failed to delete session. Please try again.');
        }
      },
    });
  };

  const handleSaveSession = async () => {
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
        };

        await updateSession(editingSession.id, updates);
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
          };

          await updateSession(existingSession.id, updates);
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
            scheduledSessionId: currentEvent?.scheduledSessionId, // Link to the scheduled session
          };

          await addSession(sessionData);
        }
      }

      // Reload data to show the updated/new session and update calendar colors
      await loadData();
      handleCloseSessionDialog();
    } catch (error) {
      console.error('Failed to save session:', error);
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

  const handleDrop = (targetDate: Date) => {
    if (!draggedSession) return;

    const event = calendarEvents.find(e => e.id === draggedSession);
    if (!event) return;

    const scheduled = scheduledSessions.find(s => s.id === event.scheduledSessionId);
    if (!scheduled) return;

    // For one-time or specific dates, update the date
    if (scheduled.recurrencePattern === 'none') {
      updateScheduledSession(scheduled.id, {
        startDate: format(targetDate, 'yyyy-MM-dd'),
      });
    } else if (scheduled.recurrencePattern === 'specific-dates') {
      const oldDateStr = format(event.date, 'yyyy-MM-dd');
      const newDates = scheduled.specificDates?.filter(d => d !== oldDateStr) || [];
      newDates.push(format(targetDate, 'yyyy-MM-dd'));
      updateScheduledSession(scheduled.id, {
        specificDates: newDates.sort(),
      });
    }

    setDraggedSession(null);
    loadData();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCancelEvent = (event: CalendarEvent) => {
    const scheduled = scheduledSessions.find(s => s.id === event.scheduledSessionId);
    if (!scheduled) return;

    const dateStr = format(event.date, 'yyyy-MM-dd');
    const cancelledDates = scheduled.cancelledDates || [];
    
    // Don't allow cancelling sessions that have been logged
    const eventDate = startOfDay(event.date);
    const today = startOfDay(new Date());
    if (event.isLogged) {
      // Don't allow cancelling logged sessions (past or future)
      return;
    }

    if (!cancelledDates.includes(dateStr)) {
      updateScheduledSession(scheduled.id, {
        cancelledDates: [...cancelledDates, dateStr],
      });
      loadData();
    }
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
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isToday ? 'primary.light' : 'background.paper',
                            cursor: 'pointer',
                          }}
                          onDoubleClick={() => handleOpenDialog(day)}
                        >
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
                                  color={event.hasConflict ? 'error' : event.isMissed ? 'error' : event.isLogged ? 'success' : 'primary'}
                                  icon={<EventIcon />}
                                  draggable
                                  onDragStart={() => handleDragStart(event.id)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSessionDialog(event);
                                  }}
                                  sx={{
                                    fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                    height: '100%',
                                    width: '100%',
                                    justifyContent: 'flex-start',
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
                                      confirm({
                                        title: 'Cancel Session',
                                        message: `Cancel this session on ${format(event.date, 'MMM d, yyyy')}?`,
                                        confirmText: 'Cancel Session',
                                        cancelText: 'Keep Scheduled',
                                        onConfirm: () => {
                                          handleCancelEvent(event);
                                        },
                                      });
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
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isToday ? 'primary.light' : 'background.paper',
                            cursor: 'pointer',
                          }}
                          onDoubleClick={() => handleOpenDialog(day)}
                        >
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
                                  color={event.hasConflict ? 'error' : event.isMissed ? 'error' : event.isLogged ? 'success' : 'primary'}
                                  icon={<EventIcon />}
                                  draggable
                                  onDragStart={() => handleDragStart(event.id)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSessionDialog(event);
                                  }}
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: '100%',
                                    width: '100%',
                                    justifyContent: 'flex-start',
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
                                      confirm({
                                        title: 'Cancel Session',
                                        message: `Cancel this session on ${format(event.date, 'MMM d, yyyy')}?`,
                                        confirmText: 'Cancel Session',
                                        cancelText: 'Keep Scheduled',
                                        onConfirm: () => {
                                          handleCancelEvent(event);
                                        },
                                      });
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
                        fontWeight: isToday ? 'bold' : 'normal',
                        color: isToday ? 'primary.main' : isCurrentMonth ? 'text.primary' : 'text.disabled',
                        mb: 0.5,
                      }}
                    >
                      {format(day, 'd')}
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
                              color={event.hasConflict ? 'error' : event.isMissed ? 'error' : event.isLogged ? 'success' : 'primary'}
                              icon={<EventIcon />}
                              draggable
                              onDragStart={() => handleDragStart(event.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSessionDialog(event);
                              }}
                              sx={{
                                fontSize: '0.7rem',
                                height: 20,
                                flex: 1,
                                '& .MuiChip-label': { px: 0.5 },
                                justifyContent: 'flex-start',
                              }}
                            />
                            {canCancel && (
                              <IconButton
                                size="small"
                                className="cancel-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirm({
                                    title: 'Cancel Session',
                                    message: `Cancel this session on ${format(event.date, 'MMM d, yyyy')}?`,
                                    confirmText: 'Cancel Session',
                                    cancelText: 'Keep Scheduled',
                                    onConfirm: () => {
                                      handleCancelEvent(event);
                                    },
                                  });
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

      {/* Scheduled Sessions List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Scheduled Sessions
          </Typography>
          {scheduledSessions.length === 0 ? (
            <Typography color="text.secondary">
              No scheduled sessions. Click "Schedule Session" to create one.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {scheduledSessions.map(scheduled => {
                const studentNames = scheduled.studentIds.map(id => formatStudentNameWithGrade(id)).join(', ');
                return (
                  <Card key={scheduled.id} variant="outlined">
                    <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {studentNames}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {scheduled.startTime} {scheduled.endTime && `- ${scheduled.endTime}`}
                            {' • '}
                            {scheduled.recurrencePattern === 'weekly' && scheduled.dayOfWeek && (
                              <>Weekly on {scheduled.dayOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</>
                            )}
                            {scheduled.recurrencePattern === 'daily' && 'Daily'}
                            {scheduled.recurrencePattern === 'specific-dates' && `${scheduled.specificDates?.length || 0} specific dates`}
                            {scheduled.recurrencePattern === 'none' && 'One-time'}
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
            <StudentSelector
              students={students}
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
        onClose={handleCloseSessionDialog}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
        onFormDataChange={(updates) => setSessionFormData({ ...sessionFormData, ...updates })}
        onStudentSearchChange={setStudentSearch}
        onStudentToggle={handleStudentToggle}
        onGoalToggle={handleGoalToggle}
        onPerformanceUpdate={handlePerformanceUpdate}
        onCuingLevelToggle={handleCuingLevelToggle}
        onTrialUpdate={handleTrialUpdate}
        getRecentPerformance={getRecentPerformance}
        isGoalAchieved={isGoalAchieved}
      />
      <ConfirmDialog />
    </Box>
  );
};

