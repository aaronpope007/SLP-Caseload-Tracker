import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  TextField,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import type { SOAPNote, Session, Student } from '../types';
import {
  getSOAPNotes,
  deleteSOAPNote,
  updateSOAPNote,
  addSOAPNote,
  getSessions,
  getStudents,
  getGoals,
} from '../utils/storage-api';
import { formatDateTime } from '../utils/helpers';
import { logError } from '../utils/logger';
import { SOAPNoteDialog } from '../components/SOAPNoteDialog';
import { useSchool } from '../context/SchoolContext';
import { useConfirm } from '../hooks/useConfirm';

export const SOAPNotes = () => {
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const [soapNotes, setSoapNotes] = useState<SOAPNote[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<SOAPNote | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    loadData();
  }, [selectedSchool]);

  const loadData = async () => {
    try {
      const allNotes = await getSOAPNotes();
      const allSessions = await getSessions();
      const allStudents = await getStudents(selectedSchool);
      const allGoals = await getGoals();

      // Filter SOAP notes by school (via sessions and students)
      const studentIds = new Set(allStudents.map(s => s.id));
      const schoolSessions = allSessions.filter(s => studentIds.has(s.studentId));
      const sessionIds = new Set(schoolSessions.map(s => s.id));
      const schoolNotes = allNotes.filter(note => sessionIds.has(note.sessionId));

      setSoapNotes(schoolNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setSessions(allSessions);
      setStudents(allStudents);
      setGoals(allGoals);
    } catch (error) {
      logError('Failed to load data', error);
    }
  };

  const getStudent = (studentId: string): Student | undefined => {
    return students.find(s => s.id === studentId);
  };

  const getSession = (sessionId: string): Session | undefined => {
    return sessions.find(s => s.id === sessionId);
  };

  const getGroupSessions = (groupSessionId: string): Session[] => {
    return sessions.filter(s => s.groupSessionId === groupSessionId);
  };

  const isGroupSOAPNote = (note: SOAPNote): boolean => {
    const session = getSession(note.sessionId);
    return session ? !!session.groupSessionId : false;
  };

  const getGroupSOAPNoteInfo = (note: SOAPNote): { isGroup: boolean; studentCount: number; studentNames: string[] } => {
    const session = getSession(note.sessionId);
    if (session?.groupSessionId) {
      const groupSessions = getGroupSessions(session.groupSessionId);
      const studentNames = groupSessions
        .map(s => getStudent(s.studentId)?.name)
        .filter((name): name is string => name !== undefined);
      return {
        isGroup: true,
        studentCount: groupSessions.length,
        studentNames,
      };
    }
    return {
      isGroup: false,
      studentCount: 1,
      studentNames: [],
    };
  };

  const handleEdit = (note: SOAPNote) => {
    const session = getSession(note.sessionId);
    if (session) {
      setSelectedNote(note);
      setDialogOpen(true);
    }
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Delete SOAP Note',
      message: 'Are you sure you want to delete this SOAP note? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteSOAPNote(id);
          await loadData();
          setSnackbar({
            open: true,
            message: 'SOAP note deleted successfully',
            severity: 'success',
          });
        } catch (error) {
          logError('Failed to delete SOAP note', error);
          alert('Failed to delete SOAP note. Please try again.');
        }
      },
    });
  };

  const handleSave = async (soapNote: SOAPNote) => {
    try {
      if (selectedNote) {
        // Only send the fields that can be updated (exclude id, dateCreated)
        await updateSOAPNote(soapNote.id, {
          subjective: soapNote.subjective,
          objective: soapNote.objective,
          assessment: soapNote.assessment,
          plan: soapNote.plan,
          dateUpdated: soapNote.dateUpdated,
        });
        setSnackbar({
          open: true,
          message: 'SOAP note updated successfully',
          severity: 'success',
        });
      } else {
        await addSOAPNote(soapNote);
        setSnackbar({
          open: true,
          message: 'SOAP note created successfully',
          severity: 'success',
        });
      }
      await loadData();
      setDialogOpen(false);
      setSelectedNote(null);
    } catch (error) {
      logError('Failed to save SOAP note', error);
      alert('Failed to save SOAP note. Please try again.');
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedNote(null);
  };


  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" component="h1">
          SOAP Notes
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {soapNotes.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" align="center">
                No SOAP notes found. Generate SOAP notes from sessions to get started.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          soapNotes.map((note) => {
            const student = getStudent(note.studentId);
            const session = getSession(note.sessionId);
            const groupInfo = getGroupSOAPNoteInfo(note);

            return (
              <Accordion key={note.id}>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    '& .MuiAccordionSummary-content': {
                      alignItems: 'center',
                      gap: 2,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      {groupInfo.isGroup ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <GroupIcon color="primary" />
                            <Typography variant="h6">
                              Group SOAP Note ({groupInfo.studentCount} {groupInfo.studentCount === 1 ? 'student' : 'students'})
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Students: {groupInfo.studentNames.join(', ')}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="h6" sx={{ minWidth: 200 }}>
                          {student?.name || 'Unknown Student'}
                        </Typography>
                      )}
                      <Typography color="text.secondary" variant="body2">
                        {formatDateTime(note.date)}
                      </Typography>
                      {session && (
                        <Chip
                          label={session.isDirectServices ? 'Direct Services' : 'Indirect Services'}
                          size="small"
                          color={session.isDirectServices ? 'primary' : 'secondary'}
                        />
                      )}
                      {groupInfo.isGroup && (
                        <Chip
                          label="Group"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(note)}
                        title="Edit SOAP Note"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(note.id)}
                        color="error"
                        title="Delete SOAP Note"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                        S - Subjective
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
                        {note.subjective}
                      </Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                        O - Objective
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
                        {note.objective}
                      </Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                        A - Assessment
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
                        {note.assessment}
                      </Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                        P - Plan
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
                        {note.plan}
                      </Typography>
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </Box>

      {selectedNote && (() => {
        const session = getSession(selectedNote.sessionId);
        const student = getStudent(selectedNote.studentId);
        if (!session || !student) return null;

        const studentGoals = goals.filter(g => g.studentId === student.id);
        return (
          <SOAPNoteDialog
            open={dialogOpen}
            session={session}
            student={student}
            goals={studentGoals}
            existingSOAPNote={selectedNote}
            onClose={handleCloseDialog}
            onSave={handleSave}
          />
        );
      })()}

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

