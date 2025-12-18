import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Grid,
  Paper,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Description as DescriptionIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Save as SaveIcon,
  Folder as FolderIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
import type { Session, Evaluation, Student, Lunch } from '../types';
import {
  getSessionsBySchool,
  getEvaluations,
  getStudents,
  getLunches,
} from '../utils/storage';
import { formatDateTime, formatDate, generateId } from '../utils/helpers';
import { useStorageSync } from '../hooks/useStorageSync';
import { useSchool } from '../context/SchoolContext';
import { getSchoolByName } from '../utils/storage';

interface TimeTrackingItem {
  id: string;
  type: 'session' | 'evaluation' | 'lunch';
  date: string;
  data: Session | Evaluation | Lunch;
}

interface TimesheetNote {
  id: string;
  content: string;
  dateCreated: string;
  dateFor?: string; // The date filter that was used
  school: string;
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [lunches, setLunches] = useState<Lunch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timesheetDialogOpen, setTimesheetDialogOpen] = useState(false);
  const [timesheetNote, setTimesheetNote] = useState('');
  const [savedNotesDialogOpen, setSavedNotesDialogOpen] = useState(false);
  const [savedNotes, setSavedNotes] = useState<TimesheetNote[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadData = () => {
    const schoolSessions = getSessionsBySchool(selectedSchool);
    const schoolEvaluations = getEvaluations(selectedSchool);
    const schoolLunches = getLunches(selectedSchool);
    const schoolStudents = getStudents(selectedSchool);
    
    setSessions(schoolSessions);
    setEvaluations(schoolEvaluations);
    setLunches(schoolLunches);
    setStudents(schoolStudents);
  };

  useEffect(() => {
    loadData();
    loadSavedNotes();
  }, [selectedSchool]);

  useStorageSync(() => {
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
    
    // Add lunches
    lunches.forEach(lunch => {
      items.push({
        id: lunch.id,
        type: 'lunch' as const,
        date: lunch.startTime,
        data: lunch,
      });
    });

    // Sort all items by date/time chronologically (most recent first)
    // This ensures group sessions, individual sessions, evaluations, and lunches are all intermingled correctly
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
  }, [sessions, evaluations, lunches]);

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

  const handleGenerateTimesheetNote = () => {
    const school = getSchoolByName(selectedSchool);
    const isTeletherapy = school?.teletherapy || false;
    
    // Build timesheet note from filtered items
    const noteParts: string[] = [];
    
    if (isTeletherapy) {
      noteParts.push('Offsite');
    }
    
    // Filter to only sessions and lunches (not evaluations) and sort chronologically
    const sessionItems = filteredItems
      .filter(item => item.type === 'session' || item.type === 'lunch')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Separate direct and indirect services
    const directServices: Session[] = [];
    const indirectServices: Session[] = [];
    const processedDirectGroupIds = new Set<string>();
    const processedIndirectGroupIds = new Set<string>();
    
    sessionItems.forEach(item => {
      const session = item.data as Session;
      if (session.isDirectServices) {
        // For group sessions, only add once per group
        if (session.groupSessionId) {
          if (!processedDirectGroupIds.has(session.groupSessionId)) {
            processedDirectGroupIds.add(session.groupSessionId);
            directServices.push(session);
          }
        } else {
          directServices.push(session);
        }
      } else {
        // For group sessions, only add once per group
        if (session.groupSessionId) {
          if (!processedIndirectGroupIds.has(session.groupSessionId)) {
            processedIndirectGroupIds.add(session.groupSessionId);
            indirectServices.push(session);
          }
        } else {
          indirectServices.push(session);
        }
      }
    });
    
    // Process direct services with time ranges
    directServices.forEach(session => {
      const serviceType = session.missedSession ? 'Missed Direct services' : 'Direct services';
      const timeRange = formatTimeRange(session.date, session.endTime);
      const isGroup = isGroupSession(session);
      
      if (isGroup) {
        const groupSessions = getGroupSessions(session.groupSessionId!);
        // Sort group sessions by student name for consistency
        const sortedGroupSessions = [...groupSessions].sort((a, b) => 
          getStudentName(a.studentId).localeCompare(getStudentName(b.studentId))
        );
        
        const studentEntries = sortedGroupSessions.map(s => {
          const student = getStudent(s.studentId);
          const initials = getStudentInitials(s.studentId);
          const grade = student?.grade || '';
          return `${initials} (${grade})`;
        }).join(', ');
        
        noteParts.push(`${timeRange} ${serviceType}: ${studentEntries}`);
      } else {
        const student = getStudent(session.studentId);
        const initials = getStudentInitials(session.studentId);
        const grade = student?.grade || '';
        
        noteParts.push(`${timeRange} ${serviceType}: ${initials}(${grade})`);
      }
    });
    
    // Process indirect services - group all together without time ranges
    if (indirectServices.length > 0) {
      const indirectStudentEntries: string[] = [];
      const processedIndirectStudents = new Set<string>();
      
      indirectServices.forEach(session => {
        const isGroup = isGroupSession(session);
        
        if (isGroup) {
          const groupSessions = getGroupSessions(session.groupSessionId!);
          groupSessions.forEach(s => {
            if (!processedIndirectStudents.has(s.studentId)) {
              processedIndirectStudents.add(s.studentId);
              const student = getStudent(s.studentId);
              const initials = getStudentInitials(s.studentId);
              const grade = student?.grade || '';
              indirectStudentEntries.push(`${initials} (${grade})`);
            }
          });
        } else {
          if (!processedIndirectStudents.has(session.studentId)) {
            processedIndirectStudents.add(session.studentId);
            const student = getStudent(session.studentId);
            const initials = getStudentInitials(session.studentId);
            const grade = student?.grade || '';
            indirectStudentEntries.push(`${initials} (${grade})`);
          }
        }
      });
      
      // Sort student entries alphabetically for consistency
      indirectStudentEntries.sort();
      
      if (indirectStudentEntries.length > 0) {
        noteParts.push(`Indirect services: ${indirectStudentEntries.join(', ')}`);
      }
    }
    
    // Process lunches - add them with time ranges
    const lunchItems = filteredItems
      .filter(item => item.type === 'lunch')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    lunchItems.forEach(item => {
      const lunch = item.data as Lunch;
      const timeRange = formatTimeRange(lunch.startTime, lunch.endTime);
      noteParts.push(`${timeRange} Lunch`);
    });
    
    setTimesheetNote(noteParts.join('\n'));
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
    if (window.confirm('Are you sure you want to delete this saved note?')) {
      deleteTimesheetNote(id);
      loadSavedNotes();
    }
  };

  const renderSessionItem = (session: Session) => {
    const isGroup = isGroupSession(session);
    const serviceType = session.isDirectServices 
      ? (session.missedSession ? 'Missed Direct Services' : 'Direct Services')
      : 'Indirect Services';
    
    const directServicesInfo = "MN requires that specific start and end times are listed for any direct services provided remotely for each individual session. In the notes section of your entry for the school, list the specific start and end time of each direct telehealth session, with a separate line for each entry. If doing additional duties within a timeframe of billable services, you only need to include specific start/end times for the direct telehealth duties.";
    
    const indirectServicesInfo = "Any of the following activities: collaboration with teachers/staff, direct contact with the student to monitor and observe, modifying environment/items, preparation for sessions, or ordering/creation of materials for the student to support their IEP goals, setting up a therapeutic OT space for students, etc. It also includes performing documentation/record-keeping duties, including updating daily notes, scheduling, and updating caseload lists for Indigo sped director group schools. If you see a student for direct services and document \"Direct/indirect services,\" since you did preparation and documentation, you do not need to write \"Indirect services\" as well. You will only write this if you do other indirect services beyond the preparation and documentation of direct services, such as fulfilling monthly minutes.";
    
    if (isGroup) {
      const groupSessions = getGroupSessions(session.groupSessionId!);
      const studentNames = groupSessions.map(s => getStudentName(s.studentId)).join(', ');
      
      return (
        <Card key={session.groupSessionId} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <GroupIcon color="primary" />
                  <Typography variant="h6">
                    Group Session ({groupSessions.length} {groupSessions.length === 1 ? 'student' : 'students'})
                  </Typography>
                  <Chip
                    label="Group"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Tooltip
                    title={session.isDirectServices ? directServicesInfo : indirectServicesInfo}
                    arrow
                    placement="top"
                  >
                    <Chip
                      label={serviceType}
                      size="small"
                      color={session.isDirectServices ? 'primary' : 'secondary'}
                      icon={<InfoIcon sx={{ fontSize: 16 }} />}
                    />
                  </Tooltip>
                </Box>
                <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                  <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                  {formatDateTime(session.date)}
                  {session.endTime && ` - ${formatDateTime(session.endTime)}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Students:</strong> {studentNames}
                </Typography>
              </Box>
            </Box>
            {session.notes && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {session.notes}
              </Typography>
            )}
          </CardContent>
        </Card>
      );
    } else {
      const studentName = getStudentName(session.studentId);
      
      return (
        <Card key={session.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6">
                    {studentName}
                  </Typography>
                  <Chip
                    label="Individual"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Tooltip
                    title={session.isDirectServices ? directServicesInfo : indirectServicesInfo}
                    arrow
                    placement="top"
                  >
                    <Chip
                      label={serviceType}
                      size="small"
                      color={session.isDirectServices ? 'primary' : 'secondary'}
                      icon={<InfoIcon sx={{ fontSize: 16 }} />}
                    />
                  </Tooltip>
                </Box>
                <Typography color="text.secondary" variant="body2">
                  <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                  {formatDateTime(session.date)}
                  {session.endTime && ` - ${formatDateTime(session.endTime)}`}
                </Typography>
              </Box>
            </Box>
            {session.notes && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {session.notes}
              </Typography>
            )}
          </CardContent>
        </Card>
      );
    }
  };

  const renderEvaluationItem = (evaluation: Evaluation) => {
    const studentName = getStudentName(evaluation.studentId);
    
    return (
      <Card key={evaluation.id} sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <DescriptionIcon color="primary" />
                <Typography variant="h6">
                  {studentName} - Evaluation
                </Typography>
                <Chip
                  label={evaluation.evaluationType}
                  size="small"
                  color="info"
                />
              </Box>
              <Typography color="text.secondary" variant="body2">
                <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                {formatDateTime(evaluation.dateCreated)}
              </Typography>
              {evaluation.areasOfConcern && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Areas of Concern: {evaluation.areasOfConcern}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderLunchItem = (lunch: Lunch) => {
    return (
      <Card key={lunch.id} sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <RestaurantIcon color="primary" />
                <Typography variant="h6">
                  Lunch
                </Typography>
              </Box>
              <Typography color="text.secondary" variant="body2">
                <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                {formatDateTime(lunch.startTime)}
                {lunch.endTime && ` - ${formatDateTime(lunch.endTime)}`}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Time Tracking
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View all activities and evaluations in chronological order.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="Filter by Date"
              type="date"
              fullWidth
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<DescriptionIcon />}
                onClick={handleGenerateTimesheetNote}
                disabled={filteredItems.length === 0}
                sx={{ flex: 1 }}
              >
                Generate Timesheet Note
              </Button>
              <Button
                variant="outlined"
                startIcon={<FolderIcon />}
                onClick={() => setSavedNotesDialogOpen(true)}
              >
                Saved Notes
              </Button>
            </Box>
          </Grid>
          {selectedDate && (
            <Grid item xs={12}>
              <Button
                variant="text"
                size="small"
                onClick={() => setSelectedDate('')}
              >
                Clear Date Filter
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>

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
              return renderSessionItem(item.data as Session);
            } else if (item.type === 'evaluation') {
              return renderEvaluationItem(item.data as Evaluation);
            } else {
              return renderLunchItem(item.data as Lunch);
            }
          })
        )}
      </Box>

      <Dialog 
        open={timesheetDialogOpen} 
        onClose={() => setTimesheetDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Timesheet Note</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={15}
            value={timesheetNote}
            onChange={(e) => setTimesheetNote(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            navigator.clipboard.writeText(timesheetNote);
          }}>
            Copy to Clipboard
          </Button>
          <Button
            onClick={handleSaveNote}
            startIcon={<SaveIcon />}
            variant="outlined"
          >
            Save Note
          </Button>
          <Button onClick={() => setTimesheetDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={savedNotesDialogOpen}
        onClose={() => setSavedNotesDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Saved Timesheet Notes</DialogTitle>
        <DialogContent>
          {savedNotes.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
              No saved notes yet.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {savedNotes.map((note) => (
                <Card key={note.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          {formatDateTime(note.dateCreated)}
                          {note.dateFor && ` • For: ${formatDate(note.dateFor)}`}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 1,
                            whiteSpace: 'pre-wrap',
                            maxHeight: '150px',
                            overflow: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            bgcolor: 'background.default',
                            p: 1,
                            borderRadius: 1,
                          }}
                        >
                          {note.content}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleLoadNote(note)}
                        startIcon={<DescriptionIcon />}
                      >
                        Load
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleDeleteNote(note.id)}
                        startIcon={<DeleteIcon />}
                      >
                        Delete
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSavedNotesDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

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

