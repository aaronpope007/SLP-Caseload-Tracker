import { useState, useEffect, useMemo } from 'react';
import { logError } from '../utils/logger';
import {
  Box,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import type { Session, Evaluation, Student, Communication, ScheduledSession, ArticulationScreener, Meeting } from '../types';
import {
  getSessions,
  getEvaluations,
  getStudents,
  getScheduledSessions,
  getArticulationScreeners,
  getMeetings,
  createMeeting,
  updateMeeting,
} from '../utils/storage-api';
import { api } from '../utils/api';
import { formatDate, generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { getSchoolByName } from '../utils/storage-api';
import { SessionTimeItem } from '../components/session/SessionTimeItem';
import { EvaluationTimeItem } from '../components/EvaluationTimeItem';
import { ArticulationScreenerTimeItem } from '../components/ArticulationScreenerTimeItem';
import { MeetingTimeItem } from '../components/meeting/MeetingTimeItem';
import { TimesheetNoteDialog } from '../components/TimesheetNoteDialog';
import { SavedNotesDialog } from '../components/SavedNotesDialog';
import { TimeTrackingFilter } from '../components/TimeTrackingFilter';
import { MeetingFormDialog } from '../components/meeting/MeetingFormDialog';
import { generateTimesheetNote, generateProspectiveTimesheetNote } from '../utils/timesheetNoteGenerator';
import { useConfirm, useSnackbar, useDialog } from '../hooks';
import type { TimesheetNote } from '../types';
import { migrateTimesheetNotes } from '../utils/migrateTimesheetNotes';

interface TimeTrackingItem {
  id: string;
  type: 'session' | 'evaluation' | 'screener' | 'meeting';
  date: string;
  data: Session | Evaluation | ArticulationScreener | Meeting;
}

// Storage functions for timesheet notes (now using API)
const getTimesheetNotes = async (school?: string): Promise<TimesheetNote[]> => {
  try {
    return await api.timesheetNotes.getAll(school);
  } catch (error) {
    logError('Failed to fetch timesheet notes', error);
    return [];
  }
};

const saveTimesheetNote = async (note: TimesheetNote): Promise<void> => {
  await api.timesheetNotes.create(note);
};

const deleteTimesheetNote = async (id: string): Promise<void> => {
  await api.timesheetNotes.delete(id);
};

export const TimeTracking = () => {
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const timesheetDialog = useDialog();
  const savedNotesDialog = useDialog();
  const meetingDialog = useDialog();
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [meetingDefaultCategory, setMeetingDefaultCategory] = useState<'IEP' | 'Assessment' | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [screeners, setScreeners] = useState<ArticulationScreener[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  // Get current date in YYYY-MM-DD format for date input
  const getCurrentDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDateString());
  const [useSpecificTimes, setUseSpecificTimes] = useState(false);
  const [timesheetNote, setTimesheetNote] = useState('');
  const [savedNotes, setSavedNotes] = useState<TimesheetNote[]>([]);

  // Per SSG SLP-SLPA billing rules: For tele services, exact time in/out is REQUIRED for direct services
  // Check if school is tele services and default useSpecificTimes to true
  useEffect(() => {
    const checkTeletherapy = async () => {
      if (selectedSchool) {
        const school = await getSchoolByName(selectedSchool);
        if (school?.teletherapy) {
          setUseSpecificTimes(true);
        }
      }
    };
    checkTeletherapy();
  }, [selectedSchool]);

  const loadData = async () => {
    // Load all sessions, evaluations, and screeners (will be filtered by selectedSchool)
    const allSessions = await getSessions();
    const allEvaluations = await getEvaluations();
    const allScreeners = await getArticulationScreeners();
    const allStudents = await getStudents();
    
    setSessions(allSessions);
    setEvaluations(allEvaluations);
    setScreeners(allScreeners);
    setStudents(allStudents);
    
    // Load communications for the selected school
    try {
      const schoolCommunications = await api.communications.getAll(undefined, undefined, selectedSchool);
      setCommunications(schoolCommunications);
    } catch (error) {
      logError('Failed to fetch communications', error);
      setCommunications([]);
    }

    // Load meetings for the selected school
    try {
      const schoolMeetings = await getMeetings(undefined, selectedSchool);
      setMeetings(schoolMeetings);
    } catch (error) {
      logError('Failed to fetch meetings', error);
      setMeetings([]);
    }
    
    // Load scheduled sessions for the selected school
    try {
      const schoolScheduledSessions = await getScheduledSessions(selectedSchool);
      setScheduledSessions(schoolScheduledSessions);
    } catch (error) {
      logError('Failed to fetch scheduled sessions', error);
      setScheduledSessions([]);
    }
  };

  useEffect(() => {
    loadData();
    
    // Migrate old localStorage data on mount (one-time migration)
    // This will run once per component mount if localStorage data exists
    const migrateData = async () => {
      const TIMESHEET_NOTES_STORAGE_KEY = 'slp_timesheet_notes';
      const hasLocalStorageData = localStorage.getItem(TIMESHEET_NOTES_STORAGE_KEY);
      if (hasLocalStorageData) {
        try {
          await migrateTimesheetNotes();
        } catch (error) {
          logError('Failed to migrate timesheet notes', error);
        }
      }
    };
    
    const initializeNotes = async () => {
      await migrateData();
      await loadSavedNotes();
    };
    
    initializeNotes();
  }, [selectedSchool]);


  const loadSavedNotes = async () => {
    const notes = await getTimesheetNotes(selectedSchool);
    setSavedNotes(notes);
  };

  // Helper function to get school for a session or evaluation
  const getSchoolForItem = (studentId: string): string | undefined => {
    const student = students.find(s => s.id === studentId);
    return student?.school;
  };

  // Combine sessions and evaluations into a single chronological list
  // For group sessions, only include one entry per group (using the session's date for sorting)
  // Filter by the actively selected school from context
  const allItems: TimeTrackingItem[] = useMemo(() => {
    const items: TimeTrackingItem[] = [];
    const processedGroupIds = new Set<string>();
    
    // Process all sessions - both individual and group
    sessions.forEach(session => {
      // Filter by the actively selected school
      const sessionSchool = getSchoolForItem(session.studentId);
      if (sessionSchool !== selectedSchool) {
        return; // Skip this session if it doesn't match the selected school
      }
      
      if (session.groupSessionId) {
        // For group sessions, only add one entry per group
        if (!processedGroupIds.has(session.groupSessionId)) {
          processedGroupIds.add(session.groupSessionId);
          items.push({
            id: session.groupSessionId,
            type: 'session' as const,
            date: session.date,
            data: session,
          });
        }
      } else {
        // Individual sessions
        items.push({
          id: session.id,
          type: 'session' as const,
          date: session.date,
          data: session,
        });
      }
    });
    
    // Add evaluations
    evaluations.forEach(evaluation => {
      // Filter by the actively selected school
      const evaluationSchool = getSchoolForItem(evaluation.studentId);
      if (evaluationSchool !== selectedSchool) {
        return; // Skip this evaluation if it doesn't match the selected school
      }
      
      items.push({
        id: evaluation.id,
        type: 'evaluation' as const,
        date: evaluation.dateCreated,
        data: evaluation,
      });
    });
    
    // Add articulation screeners
    screeners.forEach(screener => {
      // Filter by the actively selected school
      const screenerSchool = getSchoolForItem(screener.studentId);
      if (screenerSchool !== selectedSchool) {
        return; // Skip this screener if it doesn't match the selected school
      }
      
      items.push({
        id: screener.id,
        type: 'screener' as const,
        date: screener.date,
        data: screener,
      });
    });

    // Add meetings (filter by selected school)
    meetings.forEach(meeting => {
      if (meeting.school !== selectedSchool) return;
      items.push({
        id: meeting.id,
        type: 'meeting' as const,
        date: meeting.date,
        data: meeting,
      });
    });
    
    // Sort all items by date/time chronologically (most recent first)
    // This ensures group sessions, individual sessions, and evaluations are all intermingled correctly
    const sorted = items.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      // Handle invalid dates
      if (isNaN(dateA) || isNaN(dateB)) {
        return 0;
      }
      return dateB - dateA; // Most recent first
    });
    
    return sorted;
  }, [sessions, evaluations, screeners, meetings, students, selectedSchool]);

  // Get calendar date (YYYY-MM-DD) for filtering. Use LOCAL date so that an event at 6pm Jan 29
  // (stored as 2026-01-30T02:00:00.000Z) shows on 1/29 only, and the 9:15 am Jan 30 event shows on 1/30 only.
  // Date-only strings (no "T") use the string as-is to avoid UTC-midnight shifting to previous day.
  const getItemCalendarDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('T')) {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return dateStr.slice(0, 10);
  };

  // Filter items by selected date
  const filteredItems = useMemo(() => {
    if (!selectedDate) return allItems;
    return allItems.filter(item => getItemCalendarDate(item.date) === selectedDate);
  }, [allItems, selectedDate]);

  // Filter communications by selected date (already filtered by school in loadData)
  const filteredCommunications = useMemo(() => {
    if (!selectedDate) return communications;
    return communications.filter(comm =>
      comm.date ? getItemCalendarDate(comm.date) === selectedDate : false
    );
  }, [communications, selectedDate]);

  // Filter meetings by selected date (for timesheet note - speech screening in indirect services)
  const filteredMeetings = useMemo(() => {
    if (!selectedDate) return meetings;
    return meetings.filter(meeting => getItemCalendarDate(meeting.date) === selectedDate);
  }, [meetings, selectedDate]);

  const getStudentName = (studentId: string) => {
    return students.find(s => s.id === studentId)?.name || 'Unknown';
  };

  const getStudent = (studentId: string) => {
    return students.find(s => s.id === studentId);
  };

  const getStudentInitials = (studentId: string): string => {
    const student = getStudent(studentId);
    if (!student || !student.name) return '??';
    const nameParts = student.name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    } else if (nameParts.length === 1) {
      return nameParts[0][0].toUpperCase();
    }
    return '??';
  };

  const formatTime12Hour = (dateString: string): string => {
    const date = new Date(dateString);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const formatTimeRange = (startDate: string, endDate?: string): string => {
    const startTime = formatTime12Hour(startDate);
    if (endDate) {
      const endTime = formatTime12Hour(endDate);
      return `${startTime}-${endTime}`;
    }
    return startTime;
  };

  const isGroupSession = (session: Session) => {
    return !!session.groupSessionId;
  };

  const getGroupSessions = (groupSessionId: string) => {
    return sessions.filter(s => s.groupSessionId === groupSessionId);
  };

  const handleGenerateTimesheetNote = async () => {
    const school = await getSchoolByName(selectedSchool);
    const isTeletherapy = school?.teletherapy || false;
    
    const note = generateTimesheetNote({
      filteredItems,
      sessions,
      communications: filteredCommunications,
      meetings: filteredMeetings,
      getStudent,
      getStudentInitials,
      getGroupSessions,
      isTeletherapy,
      useSpecificTimes,
      formatTime12Hour,
      formatTimeRange,
    });
    
    setTimesheetNote(note);
    timesheetDialog.openDialog();
  };

  const handleGenerateProspectiveNote = async () => {
    if (!selectedDate) {
      showSnackbar('Please select a date first', 'error');
      return;
    }

    const school = await getSchoolByName(selectedSchool);
    const isTeletherapy = school?.teletherapy || false;
    
    const note = generateProspectiveTimesheetNote({
      scheduledSessions,
      targetDate: selectedDate,
      meetings: filteredMeetings,
      getStudent,
      getStudentInitials,
      isTeletherapy,
      useSpecificTimes,
      formatTimeRange,
    });
    
    setTimesheetNote(note);
    timesheetDialog.openDialog();
  };

  const handleSaveNote = async () => {
    if (!timesheetNote.trim()) {
      showSnackbar('Cannot save empty note', 'error');
      return;
    }

    try {
      const note: TimesheetNote = {
        id: generateId(),
        content: timesheetNote,
        dateCreated: new Date().toISOString(),
        dateFor: selectedDate || undefined,
        school: selectedSchool,
      };
      await saveTimesheetNote(note);
      await loadSavedNotes();
      showSnackbar('Timesheet note saved!', 'success');
    } catch (error) {
      logError('Failed to save timesheet note', error);
      showSnackbar('Failed to save timesheet note. Please try again.', 'error');
    }
  };

  const handleLoadNote = (note: TimesheetNote) => {
    setTimesheetNote(note.content);
    if (note.dateFor) {
      setSelectedDate(note.dateFor);
    }
    savedNotesDialog.closeDialog();
    timesheetDialog.openDialog();
  };

  const handleAddIEPActivity = () => {
    setEditingMeeting(null);
    setMeetingDefaultCategory('IEP');
    meetingDialog.openDialog();
  };

  const handleAdd3YearReassessment = () => {
    setEditingMeeting(null);
    setMeetingDefaultCategory('Assessment');
    meetingDialog.openDialog();
  };

  const handleCloseMeetingDialog = () => {
    meetingDialog.closeDialog();
    setEditingMeeting(null);
    setMeetingDefaultCategory(null);
  };

  const handleSaveMeeting = async (meeting: Omit<Meeting, 'id' | 'dateCreated' | 'dateUpdated'>) => {
    try {
      if (editingMeeting) {
        await updateMeeting(editingMeeting.id, meeting);
        showSnackbar('Meeting updated', 'success');
      } else {
        await createMeeting(meeting);
        showSnackbar('Activity added', 'success');
      }
      await loadData();
      handleCloseMeetingDialog();
    } catch (error) {
      logError('Failed to save meeting', error);
      showSnackbar('Failed to save. Please try again.', 'error');
    }
  };

  const handleDeleteNote = (id: string) => {
    confirm({
      title: 'Delete Saved Note',
      message: 'Are you sure you want to delete this saved note? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteTimesheetNote(id);
          await loadSavedNotes();
          showSnackbar('Saved note deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete timesheet note', error);
          showSnackbar('Failed to delete timesheet note. Please try again.', 'error');
        }
      },
    });
  };


  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Time Tracking
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View all activities and evaluations in chronological order.
      </Typography>

      <TimeTrackingFilter
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onGenerateTimesheet={handleGenerateTimesheetNote}
        onGenerateProspectiveNote={handleGenerateProspectiveNote}
        onOpenSavedNotes={() => savedNotesDialog.openDialog()}
        onAddIEPActivity={handleAddIEPActivity}
        onAdd3YearReassessment={handleAdd3YearReassessment}
        hasItems={filteredItems.length > 0}
        useSpecificTimes={useSpecificTimes}
        onUseSpecificTimesChange={setUseSpecificTimes}
      />

      <Box>
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" align="center">
                {selectedDate 
                  ? `No activities found for ${formatDate(selectedDate)}.`
                  : 'No activities or evaluations logged yet.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map(item => {
            if (item.type === 'session') {
              const session = item.data as Session;
              const isGroup = isGroupSession(session);
              return (
                <SessionTimeItem
                  key={session.id}
                  session={session}
                  isGroup={isGroup}
                  groupSessions={isGroup ? getGroupSessions(session.groupSessionId!) : undefined}
                  getStudentName={getStudentName}
                />
              );
            } else if (item.type === 'evaluation') {
              return (
                <EvaluationTimeItem
                  key={item.id}
                  evaluation={item.data as Evaluation}
                  getStudentName={getStudentName}
                />
              );
            } else if (item.type === 'screener') {
              return (
                <ArticulationScreenerTimeItem
                  key={item.id}
                  screener={item.data as ArticulationScreener}
                  getStudentName={getStudentName}
                />
              );
            } else if (item.type === 'meeting') {
              return (
                <MeetingTimeItem
                  key={item.id}
                  meeting={item.data as Meeting}
                  getStudentName={getStudentName}
                />
              );
            } else {
              return null;
            }
          })
        )}
      </Box>

      <TimesheetNoteDialog
        open={timesheetDialog.open}
        note={timesheetNote}
        onClose={timesheetDialog.closeDialog}
        onSave={handleSaveNote}
        onNoteChange={setTimesheetNote}
      />

      <SavedNotesDialog
        open={savedNotesDialog.open}
        notes={savedNotes}
        onClose={savedNotesDialog.closeDialog}
        onLoadNote={handleLoadNote}
        onDeleteNote={handleDeleteNote}
      />

      <MeetingFormDialog
        open={meetingDialog.open}
        editingMeeting={editingMeeting}
        onClose={handleCloseMeetingDialog}
        onSave={handleSaveMeeting}
        students={students}
        defaultCategory={editingMeeting ? undefined : meetingDefaultCategory ?? undefined}
        defaultDate={selectedDate || undefined}
      />

      <ConfirmDialog />
      <SnackbarComponent />
    </Box>
  );
};

