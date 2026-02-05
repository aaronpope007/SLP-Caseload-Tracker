import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { logError } from '../utils/logger';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import { ContentCopy as CopyIcon, AutoFixHigh as GenerateIcon, Save as SaveIcon, Delete as DeleteIcon, EditNote as LoadIcon } from '@mui/icons-material';
import { getStudents, getGoals, getSessions, getIEPNotesByStudent, addIEPNote, deleteIEPNote } from '../utils/storage-api';
import { formatDate, generateId } from '../utils/helpers';
import { generateIEPCommentUpdate, type GoalProgressData } from '../utils/gemini';
import { useSchool } from '../context/SchoolContext';
import { useSnackbar, useAIGeneration } from '../hooks';
import { getErrorMessage } from '../utils/validators';
import type { Student, IEPNote } from '../types';

export const IEPNotes = () => {
  const { selectedSchool } = useSchool();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { requireApiKey } = useAIGeneration();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentInputValue, setStudentInputValue] = useState<string>('');
  const [oldIEPNote, setOldIEPNote] = useState('');
  const [summaryStatement, setSummaryStatement] = useState('');
  const [generatedNote, setGeneratedNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [savedNotes, setSavedNotes] = useState<IEPNote[]>([]);
  const [saving, setSaving] = useState(false);
  const isMountedRef = useRef(true);
  const studentInputRef = useRef<string>('');

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const allStudents = (await getStudents(selectedSchool)).filter(
          (s) => s.status === 'active' && s.archived !== true
        );
        setStudents(allStudents);
        if (allStudents.length > 0) {
          const currentInList = allStudents.find((s) => s.id === selectedStudentId);
          if (!currentInList) {
            const first = allStudents[0];
            setSelectedStudentId(first.id);
            setStudentInputValue(first.name);
          }
        }
      } catch (error) {
        logError('Failed to load students', error);
      }
    };
    loadStudents();
  }, [selectedSchool]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadSavedNotes = async () => {
      if (!selectedStudentId) {
        setSavedNotes([]);
        return;
      }
      try {
        const notes = await getIEPNotesByStudent(selectedStudentId);
        setSavedNotes(notes);
      } catch (error) {
        logError('Failed to load saved IEP notes', error);
        setSavedNotes([]);
      }
    };
    loadSavedNotes();
  }, [selectedStudentId]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const studentsForSchool = useMemo(
    () => students.filter((s) => !selectedSchool || s.school === selectedSchool),
    [students, selectedSchool]
  );

  const filterStudentOptions = useCallback((options: Student[], inputValue: string) => {
    if (!inputValue) return options;
    const searchTerm = inputValue.toLowerCase().trim();
    return options.filter((student) => {
      const nameMatch = (student.name || '').toLowerCase().includes(searchTerm);
      const gradeMatch = (student.grade || '').toLowerCase().includes(searchTerm);
      const concernsMatch = student.concerns?.some((c) => c.toLowerCase().includes(searchTerm)) || false;
      return nameMatch || gradeMatch || concernsMatch;
    });
  }, []);

  const handleAutocompleteKeyDown = useCallback((
    e: React.KeyboardEvent,
    filtered: Student[],
    onSelect: (option: Student) => void
  ) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      if (filtered.length === 1 && !e.shiftKey) {
        e.preventDefault();
        onSelect(filtered[0]);
      }
    }
  }, []);

  const handleGenerate = async () => {
    if (!selectedStudent) {
      showSnackbar('Please select a student', 'error');
      return;
    }

    const apiKey = requireApiKey();
    if (!apiKey) return;

    setGenerating(true);
    setGeneratedNote('');

    try {
      const sessions = (await getSessions())
        .filter((s) => s.studentId === selectedStudentId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const goals = (await getGoals()).filter((g) => g.studentId === selectedStudentId);

      const goalsData: GoalProgressData[] = goals.map((goal) => {
        const goalSessions = sessions
          .filter((s) => (s.goalsTargeted || []).includes(goal.id))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const performanceHistory = goalSessions.map((s) => {
          const perf = s.performanceData.find((p) => p.goalId === goal.id);
          return {
            date: formatDate(s.date),
            accuracy: perf?.accuracy || 0,
            correctTrials: perf?.correctTrials,
            incorrectTrials: perf?.incorrectTrials,
            notes: perf?.notes,
            cuingLevels: perf?.cuingLevels,
          };
        }).filter((p) => p.accuracy > 0 || p.correctTrials !== undefined);

        const recentSessions = goalSessions.slice(0, 3);
        const performanceData = recentSessions
          .map((s) => {
            const perf = s.performanceData.find((p) => p.goalId === goal.id);
            return perf?.accuracy;
          })
          .filter((a) => a !== undefined) as number[];

        const avgAccuracy =
          performanceData.length > 0
            ? performanceData.reduce((a, b) => a + b, 0) / performanceData.length
            : 0;

        return {
          goalDescription: goal.description,
          baseline: parseFloat(goal.baseline) || 0,
          target: parseFloat(goal.target) || 100,
          current: avgAccuracy,
          sessions: goalSessions.length,
          status: goal.status,
          performanceHistory,
        };
      });

      const hasInput = oldIEPNote.trim().length > 0 || summaryStatement.trim().length > 0 || goalsData.length > 0;
      if (!hasInput) {
        showSnackbar('Provide at least one: Communication note, Summary statement, or ensure the student has goals.', 'error');
        setGenerating(false);
        return;
      }

      const recentSessionsSummary = sessions.slice(0, 8).map((s) => {
        const goalsTargeted = s.goalsTargeted?.length ?? 0;
        const perfSummary = s.performanceData
          ?.map((p) => {
            let part = `${p.accuracy?.toFixed(0) ?? 'N/A'}%`;
            if (p.cuingLevels && p.cuingLevels.length > 0) {
              part += ` (cuing: ${p.cuingLevels.join(', ')})`;
            }
            return part;
          })
          .join(', ');
        return `${formatDate(s.date)}: ${goalsTargeted} goal(s) targeted${perfSummary ? ` - ${perfSummary}` : ''}${s.notes ? ` | Notes: ${s.notes.substring(0, 80)}${s.notes.length > 80 ? '...' : ''}` : ''}`;
      }).join('\n');

      const update = await generateIEPCommentUpdate({
        apiKey,
        studentName: selectedStudent.name,
        oldIEPNote: oldIEPNote.trim() || undefined,
        summaryStatement: summaryStatement.trim() || undefined,
        goalsData,
        recentSessionsSummary,
      });

      if (!isMountedRef.current) return;
      setGeneratedNote(update);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const errorMessage = getErrorMessage(err);
      showSnackbar(errorMessage, 'error');
      logError('Failed to generate IEP content', err);
    } finally {
      if (isMountedRef.current) {
        setGenerating(false);
      }
    }
  };

  const handleCopy = async () => {
    if (generatedNote) {
      try {
        await navigator.clipboard.writeText(generatedNote);
        showSnackbar('Copied to clipboard!', 'success');
      } catch (err: unknown) {
        showSnackbar('Failed to copy to clipboard', 'error');
      }
    }
  };

  const handleSave = async () => {
    if (!selectedStudent || !generatedNote.trim()) {
      showSnackbar('Generate a note first, then save.', 'error');
      return;
    }
    setSaving(true);
    try {
      const note: IEPNote = {
        id: generateId(),
        studentId: selectedStudent.id,
        previousNote: oldIEPNote.trim(),
        generatedNote: generatedNote.trim(),
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      };
      await addIEPNote(note);
      setSavedNotes((prev) => [note, ...prev]);
      showSnackbar('IEP note saved.', 'success');
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      showSnackbar(errorMessage, 'error');
      logError('Failed to save IEP note', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadNote = (note: IEPNote) => {
    setOldIEPNote(note.previousNote);
    setGeneratedNote(note.generatedNote);
    setSummaryStatement('');
    showSnackbar('Loaded saved note.', 'success');
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteIEPNote(id);
      setSavedNotes((prev) => prev.filter((n) => n.id !== id));
      showSnackbar('Saved note deleted.', 'success');
    } catch (err: unknown) {
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        IEP Communication Notes
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Generate updated IEP Communication section, summary statement, and/or suggested goal changes based on recent sessions and goal progress.
        Provide a Communication note and/or Summary statement (optional). If the student has goals, the AI will compare progress to session data and suggest goal changes.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Autocomplete
              options={studentsForSchool}
              getOptionLabel={(option) => `${option.name}${option.grade ? ` (${option.grade})` : ''}`}
              filterOptions={(options, state) => filterStudentOptions(options, state.inputValue)}
              value={selectedStudent || null}
              inputValue={studentInputValue}
              onInputChange={(_, value) => {
                setStudentInputValue(value);
                studentInputRef.current = value;
              }}
              onChange={(_, newValue) => {
                setSelectedStudentId(newValue?.id || '');
                if (newValue) {
                  setStudentInputValue(newValue.name);
                } else {
                  setStudentInputValue('');
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Student"
                  InputLabelProps={{ shrink: true }}
                  onKeyDown={(e) => {
                    const filtered = filterStudentOptions(studentsForSchool, studentInputRef.current);
                    handleAutocompleteKeyDown(e, filtered, (option) => {
                      setSelectedStudentId(option.id);
                      setStudentInputValue(option.name);
                    });
                  }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />

            <TextField
              label="Current IEP Communication Note (optional)"
              fullWidth
              multiline
              rows={4}
              value={oldIEPNote}
              onChange={(e) => setOldIEPNote(e.target.value)}
              placeholder="Paste the current IEP Communication/Comments section here. If provided, the AI will return an updated Communication section."
              helperText="Student-identifying information is stripped before sending to the AI."
            />

            <TextField
              label="Summary statement / Present levels (optional)"
              fullWidth
              multiline
              rows={4}
              value={summaryStatement}
              onChange={(e) => setSummaryStatement(e.target.value)}
              placeholder="Paste the current summary or present levels statement. If provided, the AI will return a suggested summary. If both this and goals exist, the AI will return a new summary and goal ideas."
              helperText="If you provide this and the student has goals, the AI will return a new summary statement and suggested goal changes."
            />

            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={generating || !selectedStudent}
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <GenerateIcon />}
            >
              {generating ? 'Generating...' : 'Generate'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {generatedNote && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Suggested Update</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSave}
                  disabled={saving || !selectedStudent}
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <IconButton onClick={handleCopy} color="primary" title="Copy to clipboard">
                  <CopyIcon />
                </IconButton>
              </Box>
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              This is an AI-generated suggestion. Review and edit as needed before pasting into the IEP.
            </Alert>
            <Box
              sx={{
                p: 2,
                bgcolor: 'action.hover',
                borderRadius: 1,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
              }}
            >
              {generatedNote}
            </Box>
          </CardContent>
        </Card>
      )}

      {selectedStudent && savedNotes.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Saved notes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Load a saved note to edit or paste again. Saved notes are stored per student.
            </Typography>
            <List dense disablePadding>
              {savedNotes.map((note) => (
                <ListItem
                  key={note.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: 'background.paper',
                  }}
                  secondaryAction={
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleLoadNote(note)}
                        title="Load this note"
                        color="primary"
                      >
                        <LoadIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleDeleteNote(note.id)}
                        title="Delete"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  }
                >
                  <ListItemText
                    primary={formatDate(note.dateUpdated)}
                    secondary={note.generatedNote.length > 120 ? `${note.generatedNote.substring(0, 120)}…` : note.generatedNote}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'body2', sx: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <SnackbarComponent />
    </Box>
  );
};
