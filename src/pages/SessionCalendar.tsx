import { useState, useEffect, useMemo } from 'react';
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
import type { ScheduledSession, Student, Session, Goal } from '../types';
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
} from '../utils/storage-api';
import { generateId, toLocalDateTimeString, fromLocalDateTimeString } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { useConfirm } from '../hooks/useConfirm';

type ViewMode = 'month' | 'week';

interface CalendarEvent {
  id: string;
  scheduledSessionId: string;
  studentIds: string[];
  date: Date;
  startTime: string;
  endTime?: string;
  title: string;
  hasConflict: boolean;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScheduledSession, setEditingScheduledSession] = useState<ScheduledSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedSession, setDraggedSession] = useState<string | null>(null);
  
  // Session form dialog state
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingGroupSessionId, setEditingGroupSessionId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
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

  useEffect(() => {
    loadData();
  }, [selectedSchool]);

  const loadData = async () => {
    try {
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
            events.push({
              id: `${scheduled.id}-${format(date, 'yyyy-MM-dd')}`,
              scheduledSessionId: scheduled.id,
              studentIds: scheduled.studentIds,
              date: date,
              startTime: scheduled.startTime,
              endTime: scheduled.endTime || endTimeStr,
              title: scheduled.studentIds.map(id => students.find(s => s.id === id)?.name || 'Unknown').join(', '),
              hasConflict: false,
            });
          }
          date = addDays(date, 1);
        }
      } else if (scheduled.recurrencePattern === 'daily') {
        // Generate daily recurring events
        let date = start;
        while (isBefore(date, end) || isSameDay(date, end)) {
          events.push({
            id: `${scheduled.id}-${format(date, 'yyyy-MM-dd')}`,
            scheduledSessionId: scheduled.id,
            studentIds: scheduled.studentIds,
            date: date,
            startTime: scheduled.startTime,
            endTime: scheduled.endTime || endTimeStr,
            title: scheduled.studentIds.map(id => students.find(s => s.id === id)?.name || 'Unknown').join(', '),
            hasConflict: false,
          });
          date = addDays(date, 1);
        }
      } else if (scheduled.recurrencePattern === 'specific-dates' && scheduled.specificDates) {
        // Generate events for specific dates
        scheduled.specificDates.forEach(dateStr => {
          const date = parse(dateStr, 'yyyy-MM-dd', new Date());
          if ((isAfter(date, start) || isSameDay(date, start)) && 
              (isBefore(date, end) || isSameDay(date, end))) {
            events.push({
              id: `${scheduled.id}-${format(date, 'yyyy-MM-dd')}`,
              scheduledSessionId: scheduled.id,
              studentIds: scheduled.studentIds,
              date: date,
              startTime: scheduled.startTime,
              endTime: scheduled.endTime || endTimeStr,
              title: scheduled.studentIds.map(id => students.find(s => s.id === id)?.name || 'Unknown').join(', '),
              hasConflict: false,
            });
          }
        });
      } else if (scheduled.recurrencePattern === 'none') {
        // One-time event
        const date = parse(scheduled.startDate, 'yyyy-MM-dd', new Date());
        events.push({
          id: scheduled.id,
          scheduledSessionId: scheduled.id,
          studentIds: scheduled.studentIds,
          date: date,
          startTime: scheduled.startTime,
          endTime: scheduled.endTime || `${endHour}:${String(endMinute).padStart(2, '0')}`,
          title: scheduled.studentIds.map(id => students.find(s => s.id === id)?.name || 'Unknown').join(', '),
          hasConflict: false,
        });
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

    return events;
  }, [scheduledSessions, students, currentDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const daysInMonth = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleOpenDialog = (date?: Date, scheduledSession?: ScheduledSession) => {
    if (scheduledSession) {
      setEditingScheduledSession(scheduledSession);
      setFormData({
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
      });
    } else {
      setEditingScheduledSession(null);
      const dateToUse = date || new Date();
      setSelectedDate(dateToUse);
      setFormData({
        studentIds: [],
        startTime: '09:00',
        endTime: '09:30',
        recurrencePattern: 'weekly',
        dayOfWeek: [dateToUse.getDay()],
        specificDates: [],
        startDate: format(dateToUse, 'yyyy-MM-dd'),
        endDate: '',
        goalsTargeted: [],
        notes: '',
        isDirectServices: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingScheduledSession(null);
    setSelectedDate(null);
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
    handleCloseDialog();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this scheduled session?')) {
      deleteScheduledSession(id);
      loadData();
    }
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
    setSessionDialogOpen(true);
  };

  const handleCloseSessionDialog = () => {
    setSessionDialogOpen(false);
    setEditingSession(null);
    setEditingGroupSessionId(null);
    setStudentSearch('');
  };

  const handleSaveSession = async () => {
    if (sessionFormData.studentIds.length === 0) {
      alert('Please select at least one student');
      return;
    }

    try {
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
        };

        await addSession(sessionData);
      }

      // Reload data to show the new session
      loadData();
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
    return calendarEvents.filter(event => isSameDay(event.date, day));
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
              <IconButton onClick={handlePreviousMonth}>
                <ChevronLeft />
              </IconButton>
              <Typography variant="h5">
                {format(currentDate, 'MMMM yyyy')}
              </Typography>
              <IconButton onClick={handleNextMonth}>
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

          <Grid container spacing={0.5}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <Grid item xs key={day} sx={{ textAlign: 'center', py: 1, fontWeight: 'bold' }}>
                <Typography variant="body2" color="text.secondary">
                  {day}
                </Typography>
              </Grid>
            ))}
            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());

              return (
                <Grid
                  item
                  xs
                  key={day.toISOString()}
                  sx={{
                    minHeight: 120,
                    border: '1px solid',
                    borderColor: 'divider',
                    p: 0.5,
                    backgroundColor: isCurrentMonth ? 'background.paper' : 'action.hover',
                    cursor: 'pointer',
                    position: 'relative',
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {dayEvents.slice(0, 3).map(event => (
                      <Chip
                        key={event.id}
                        label={event.title}
                        size="small"
                        color={event.hasConflict ? 'error' : 'primary'}
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
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <Typography variant="caption" color="text.secondary">
                        +{dayEvents.length - 3} more
                      </Typography>
                    )}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
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
                const studentNames = scheduled.studentIds.map(id => students.find(s => s.id === id)?.name || 'Unknown').join(', ');
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingScheduledSession ? 'Edit Scheduled Session' : 'Schedule New Session'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Students</InputLabel>
              <Select
                multiple
                value={formData.studentIds}
                onChange={(e) => setFormData({ ...formData, studentIds: e.target.value as string[] })}
                label="Students"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => (
                      <Chip key={id} label={students.find(s => s.id === id)?.name || id} size="small" />
                    ))}
                  </Box>
                )}
              >
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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

