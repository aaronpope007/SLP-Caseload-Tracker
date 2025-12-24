import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Snackbar,
  Alert,
  Typography,
} from '@mui/material';
import type { Session, Evaluation, Student } from '../types';
import {
  getSessionsBySchool,
  getEvaluations,
  getStudents,
} from '../utils/storage-api';
import { formatDate, generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { getSchoolByName } from '../utils/storage-api';
import { SessionTimeItem } from '../components/SessionTimeItem';
import { EvaluationTimeItem } from '../components/EvaluationTimeItem';
import { TimesheetNoteDialog } from '../components/TimesheetNoteDialog';
import { SavedNotesDialog, type TimesheetNote } from '../components/SavedNotesDialog';
import { TimeTrackingFilter } from '../components/TimeTrackingFilter';
import { generateTimesheetNote } from '../utils/timesheetNoteGenerator';
import { useConfirm } from '../hooks/useConfirm';

interface TimeTrackingItem {
  id: string;
  type: 'session' | 'evaluation';
  date: string;
  data: Session | Evaluation;
}

const TIMESHEET_NOTES_STORAGE_KEY = 'slp_timesheet_notes';

// Storage functions for timesheet notes
const getTimesheetNotes = (school?: string): TimesheetNote[] => {
  const data = localStorage.getItem(TIMESHEET_NOTES_STORAGE_KEY);
  let notes: TimesheetNote[] = data ? JSON.parse(data) : [];
  
  if (school) {
    notes = notes.filter(n => n.school === school);
  }
  
  return notes.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
};

const saveTimesheetNote = (note: TimesheetNote): void => {
  const allNotes = getTimesheetNotes();
  allNotes.push(note);
  localStorage.setItem(TIMESHEET_NOTES_STORAGE_KEY, JSON.stringify(allNotes));
};

const deleteTimesheetNote = (id: string): void => {
  const allNotes = getTimesheetNotes();
  const filtered = allNotes.filter(n => n.id !== id);
  localStorage.setItem(TIMESHEET_NOTES_STORAGE_KEY, JSON.stringify(filtered));
};

export const TimeTracking = () => {
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
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
  const [timesheetDialogOpen, setTimesheetDialogOpen] = useState(false);
  const [timesheetNote, setTimesheetNote] = useState('');
  const [savedNotesDialogOpen, setSavedNotesDialogOpen] = useState(false);
  const [savedNotes, setSavedNotes] = useState<TimesheetNote[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadData = async () => {
    const schoolSessions = await getSessionsBySchool(selectedSchool);
    const schoolEvaluations = await getEvaluations(selectedSchool);
    const schoolStudents = await getStudents(selectedSchool);
    
    setSessions(schoolSessions);
    setEvaluations(schoolEvaluations);
    setStudents(schoolStudents);
  };

  useEffect(() => {
    loadData();
    loadSavedNotes();
  }, [selectedSchool]);


  const loadSavedNotes = () => {
    const notes = getTimesheetNotes(selectedSchool);
    setSavedNotes(notes);
  };

  // Combine sessions and evaluations into a single chronological list
  // For group sessions, only include one entry per group (using the session's date for sorting)
  const allItems: TimeTrackingItem[] = useMemo(() => {
    const items: TimeTrackingItem[] = [];
    const processedGroupIds = new Set<string>();
    
    // Process all sessions - both individual and group
    sessions.forEach(session => {
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
      items.push({
        id: evaluation.id,
        type: 'evaluation' as const,
        date: evaluation.dateCreated,
        data: evaluation,
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
  }, [sessions, evaluations]);

  // Filter items by selected date
  const filteredItems = useMemo(() => {
    if (!selectedDate) return allItems;
    
    // Parse selected date in local time (YYYY-MM-DD format from date input)
    const [year, month, day] = selectedDate.split('-').map(Number);
    const selectedDateLocal = new Date(year, month - 1, day);
    const selectedYear = selectedDateLocal.getFullYear();
    const selectedMonth = selectedDateLocal.getMonth();
    const selectedDay = selectedDateLocal.getDate();
    
    return allItems.filter(item => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getFullYear() === selectedYear &&
        itemDate.getMonth() === selectedMonth &&
        itemDate.getDate() === selectedDay
      );
    });
  }, [allItems, selectedDate]);

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
      getStudent,
      getStudentInitials,
      getGroupSessions,
      isTeletherapy,
      useSpecificTimes,
      formatTime12Hour,
      formatTimeRange,
    });
    
    setTimesheetNote(note);
    setTimesheetDialogOpen(true);
  };

  const handleSaveNote = () => {
    if (!timesheetNote.trim()) {
      setSnackbar({
        open: true,
        message: 'Cannot save empty note',
        severity: 'error',
      });
      return;
    }

    const note: TimesheetNote = {
      id: generateId(),
      content: timesheetNote,
      dateCreated: new Date().toISOString(),
      dateFor: selectedDate || undefined,
      school: selectedSchool,
    };

    saveTimesheetNote(note);
    loadSavedNotes();
    setSnackbar({
      open: true,
      message: 'Timesheet note saved!',
      severity: 'success',
    });
  };

  const handleLoadNote = (note: TimesheetNote) => {
    setTimesheetNote(note.content);
    if (note.dateFor) {
      setSelectedDate(note.dateFor);
    }
    setSavedNotesDialogOpen(false);
    setTimesheetDialogOpen(true);
  };

  const handleDeleteNote = (id: string) => {
    confirm({
      title: 'Delete Saved Note',
      message: 'Are you sure you want to delete this saved note? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        deleteTimesheetNote(id);
        loadSavedNotes();
        setSnackbar({
          open: true,
          message: 'Saved note deleted successfully',
          severity: 'success',
        });
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
        onOpenSavedNotes={() => setSavedNotesDialogOpen(true)}
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
            } else {
              return null;
            }
          })
        )}
      </Box>

      <TimesheetNoteDialog
        open={timesheetDialogOpen}
        note={timesheetNote}
        onClose={() => setTimesheetDialogOpen(false)}
        onSave={handleSaveNote}
        onNoteChange={setTimesheetNote}
      />

      <SavedNotesDialog
        open={savedNotesDialogOpen}
        notes={savedNotes}
        onClose={() => setSavedNotesDialogOpen(false)}
        onLoadNote={handleLoadNote}
        onDeleteNote={handleDeleteNote}
      />

      <ConfirmDialog />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity || 'success'}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

