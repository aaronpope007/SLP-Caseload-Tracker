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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
} from '@mui/material';
import { ContentCopy as CopyIcon, AutoFixHigh as GenerateIcon, Save as SaveIcon, Delete as DeleteIcon, EditNote as LoadIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { getStudents, getGoals, getSessions, getIEPNotesByStudent, addIEPNote, deleteIEPNote } from '../utils/storage-api';
import { formatDate, generateId, convertMarkupToHtml } from '../utils/helpers';
import { generateIEPCommentUpdate, type GoalProgressData } from '../utils/gemini';
import { useSchool } from '../context/SchoolContext';
import { useSnackbar, useAIGeneration } from '../hooks';
import { getErrorMessage } from '../utils/validators';
import type { Student, IEPNote } from '../types';

/** Number of most recent sessions sent to the AI for IEP summary and goal suggestions. */
export const SESSIONS_FOR_IEP_NOTES = 8;

export const IEPNotes = () => {
  const { selectedSchool } = useSchool();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { requireApiKey } = useAIGeneration();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentInputValue, setStudentInputValue] = useState<string>('');
  const [previousIEPNote, setPreviousIEPNote] = useState('');
  const [previousIEPGoals, setPreviousIEPGoals] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [generatedNote, setGeneratedNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [savedNotes, setSavedNotes] = useState<IEPNote[]>([]);
  const [saving, setSaving] = useState(false);
  const [formattedDialogOpen, setFormattedDialogOpen] = useState(false);
  const formattedContentRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const studentInputRef = useRef<string>('');

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const allStudents = (await getStudents(selectedSchool)).filter(
          (s) => s.status === 'active' && s.archived !== true
        );
        setStudents(allStudents);
        if (allStudents.length > 0) {
          const studentIdFromUrl = searchParams.get('studentId');
          const urlStudent = studentIdFromUrl ? allStudents.find((s) => s.id === studentIdFromUrl) : null;
          if (urlStudent) {
            setSelectedStudentId(urlStudent.id);
            setStudentInputValue(urlStudent.name);
          }
          // Do not auto-select a student on load; leave the field empty until the user chooses one.
        }
      } catch (error) {
        logError('Failed to load students', error);
      }
    };
    loadStudents();
  }, [selectedSchool, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const studentsForSchoolDeduped = useMemo(() => {
    const seen = new Set<string>();
    return studentsForSchool.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [studentsForSchool]);

  const filterStudentOptions = useCallback((options: Student[], inputValue: string) => {
    if (!inputValue) return options;
    const searchTerm = inputValue.toLowerCase().trim();
    const seen = new Set<string>();
    return options.filter((student) => {
      if (seen.has(student.id)) return false;
      const nameMatch = (student.name || '').toLowerCase().includes(searchTerm);
      const gradeMatch = (student.grade || '').toLowerCase().includes(searchTerm);
      const concernsMatch = student.concerns?.some((c) => c.toLowerCase().includes(searchTerm)) || false;
      const matches = nameMatch || gradeMatch || concernsMatch;
      if (matches) seen.add(student.id);
      return matches;
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

      const hasInput =
        previousIEPNote.trim().length > 0 ||
        previousIEPGoals.trim().length > 0 ||
        additionalNotes.trim().length > 0 ||
        goalsData.length > 0;
      if (!hasInput) {
        showSnackbar(
          'Provide at least one: Previous IEP notes, Previous IEP goals, Additional notes, or ensure the student has goals in the app.',
          'error'
        );
        setGenerating(false);
        return;
      }

      const recentSessionsSummary = sessions
        .slice(0, SESSIONS_FOR_IEP_NOTES)
        .map((s) => {
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
        previousIEPNote: previousIEPNote.trim() || undefined,
        previousIEPGoals: previousIEPGoals.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
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
        previousNote: previousIEPNote.trim(),
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
    setPreviousIEPNote(note.previousNote);
    setGeneratedNote(note.generatedNote);
    setPreviousIEPGoals('');
    setAdditionalNotes('');
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

  const handleCopyFormatted = async () => {
    if (!formattedContentRef.current) return;
    const plain = formattedContentRef.current.innerText || '';
    try {
      await navigator.clipboard.writeText(plain);
      showSnackbar('Formatted version copied to clipboard.', 'success');
    } catch {
      showSnackbar('Failed to copy to clipboard.', 'error');
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        IEP Communication Notes
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Paste the <strong>previous</strong> IEP notes and goals (the old data) below. Add any extra context in Additional notes. The AI uses the last {SESSIONS_FOR_IEP_NOTES} sessions for this student to generate an <strong>updated</strong> present levels of academic achievement and functional performance (reflecting current progress and cuing) and suggested goals. The returned text is new—it does not repeat the previous notes.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Autocomplete
              options={studentsForSchoolDeduped}
              getOptionLabel={(option) => (option ? `${option.name}${option.grade ? ` (${option.grade})` : ''}` : '')}
              filterOptions={(options, state) => filterStudentOptions(options, state.inputValue)}
              value={studentsForSchoolDeduped.find((s) => s.id === selectedStudentId) ?? null}
              inputValue={studentInputValue}
              onInputChange={(_, value) => {
                setStudentInputValue(value);
                studentInputRef.current = value;
              }}
              onChange={(_, newValue) => {
                setSelectedStudentId(newValue?.id ?? '');
                if (newValue) {
                  setStudentInputValue(newValue.name ?? '');
                } else {
                  setStudentInputValue('');
                }
                // Clear form and generated content when switching students so UI shows fresh state
                setPreviousIEPNote('');
                setPreviousIEPGoals('');
                setAdditionalNotes('');
                setGeneratedNote('');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Student"
                  InputLabelProps={{ shrink: true }}
                  onKeyDown={(e) => {
                    const filtered = filterStudentOptions(studentsForSchoolDeduped, studentInputRef.current);
                    handleAutocompleteKeyDown(e, filtered, (option) => {
                      setSelectedStudentId(option.id);
                      setStudentInputValue(option.name ?? '');
                    });
                  }}
                />
              )}
              isOptionEqualToValue={(option, value) => value != null && option.id === value.id}
            />

            <TextField
              label="1. Previous IEP Notes"
              fullWidth
              multiline
              rows={4}
              value={previousIEPNote}
              onChange={(e) => setPreviousIEPNote(e.target.value)}
              placeholder="Paste the previous IEP Communication/Comments section (present levels) here. This is OLD data—the AI will use it as context and produce updated language."
              helperText="Student-identifying information is stripped before sending to the AI."
            />

            <TextField
              label="2. Previous IEP Goals"
              fullWidth
              multiline
              rows={4}
              value={previousIEPGoals}
              onChange={(e) => setPreviousIEPGoals(e.target.value)}
              placeholder="Paste the previous IEP goals here. The AI will compare these to recent session performance and suggest updated goals."
            />

            <TextField
              label="3. Additional notes / Summary"
              fullWidth
              multiline
              rows={4}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Any additional context, notes, or summary to include (optional)."
            />

            <Typography variant="body2" color="text.secondary">
              Using the last {SESSIONS_FOR_IEP_NOTES} sessions for this student to build performance and cuing context for the AI.
            </Typography>

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
              <Typography variant="h6">Updated present levels &amp; suggested goals</Typography>
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
              This is AI-generated <strong>updated</strong> language (present levels and suggested goals), based on recent speech sessions—not a copy of the previous notes. You can edit the text below, then Save or Copy. Saved notes appear in the &quot;Saved notes&quot; list at the bottom of this page for the selected student.{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => setFormattedDialogOpen(true)}
                sx={{ cursor: 'pointer', fontWeight: 500 }}
              >
                View formatted version (copy/paste)
              </Link>
            </Alert>
            <TextField
              fullWidth
              multiline
              minRows={12}
              maxRows={24}
              value={generatedNote}
              onChange={(e) => setGeneratedNote(e.target.value)}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'action.hover',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                },
              }}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={formattedDialogOpen} onClose={() => setFormattedDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#fff' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', bgcolor: '#fff' }}>
          <span>Formatted version (copy/paste)</span>
          <Button variant="contained" size="small" startIcon={<CopyIcon />} onClick={handleCopyFormatted}>
            Copy formatted
          </Button>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#fff' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This view converts markdown (##, **bold**, -, etc.) into headings, bullet points, and bold text. Use &quot;Copy formatted&quot; above or below to paste into an IEP or document.
          </Typography>
          <Box
            ref={formattedContentRef}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              bgcolor: '#fff',
              minHeight: 200,
              '& h1': { fontSize: '1.25rem', mt: 1, mb: 0.5 },
              '& h2': { fontSize: '1.1rem', mt: 1.5, mb: 0.5 },
              '& h3': { fontSize: '1rem', mt: 1, mb: 0.5 },
              '& ul': { pl: 2, my: 0.5 },
              '& ol': { pl: 2, my: 0.5 },
              '& li': { my: 0.25 },
              '& strong': { fontWeight: 600 },
              '& p': { my: 0.5 },
              lineHeight: 1.6,
            }}
            dangerouslySetInnerHTML={{ __html: convertMarkupToHtml(generatedNote || '') }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" startIcon={<CopyIcon />} onClick={handleCopyFormatted}>
            Copy formatted
          </Button>
          <Button onClick={() => setFormattedDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {selectedStudent && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Saved notes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {savedNotes.length > 0
                ? 'Saved notes for this student. Click Load to put a note back into the Suggested Update area; you can edit it and save again.'
                : 'No saved notes yet for this student. After you Generate and optionally edit, click Save above to store a note here.'}
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
