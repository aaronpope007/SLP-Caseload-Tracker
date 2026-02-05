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
} from '@mui/material';
import { ContentCopy as CopyIcon, AutoFixHigh as GenerateIcon } from '@mui/icons-material';
import { getStudents, getGoals, getSessions } from '../utils/storage-api';
import { formatDate } from '../utils/helpers';
import { generateIEPCommentUpdate, type GoalProgressData } from '../utils/gemini';
import { useSchool } from '../context/SchoolContext';
import { useSnackbar, useAIGeneration } from '../hooks';
import { getErrorMessage } from '../utils/validators';
import type { Student } from '../types';

export const IEPNotes = () => {
  const { selectedSchool } = useSchool();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { requireApiKey } = useAIGeneration();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentInputValue, setStudentInputValue] = useState<string>('');
  const [oldIEPNote, setOldIEPNote] = useState('');
  const [generatedNote, setGeneratedNote] = useState('');
  const [generating, setGenerating] = useState(false);
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
    if (!oldIEPNote.trim()) {
      showSnackbar('Please paste the current IEP Communication note to update', 'error');
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

      const update = await generateIEPCommentUpdate(
        apiKey,
        selectedStudent.name,
        oldIEPNote.trim(),
        goalsData,
        recentSessionsSummary
      );

      if (!isMountedRef.current) return;
      setGeneratedNote(update);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const errorMessage = getErrorMessage(err);
      showSnackbar(errorMessage, 'error');
      logError('Failed to generate IEP comment update', err);
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

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        IEP Communication Notes
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Generate updated IEP Communication sections for speech students based on recent sessions and goal progress.
        Select a student, paste the current IEP note, and get an AI-suggested update.
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
              label="Current IEP Communication Note"
              fullWidth
              multiline
              rows={6}
              value={oldIEPNote}
              onChange={(e) => setOldIEPNote(e.target.value)}
              placeholder="Paste the current IEP Communication/Comments section here. For example:&#10;&#10;Communication (updated 2/2025): Due to a nationwide shortage of speech-language pathologists, there has been a break in therapy from the end of October 2024 to the beginning of December 2025. [Student] has since resumed speech therapy services 2 times per week..."
              helperText="Paste the existing IEP note. Student-identifying information is stripped before sending to the AI."
            />

            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={generating || !selectedStudent || !oldIEPNote.trim()}
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <GenerateIcon />}
            >
              {generating ? 'Generating...' : 'Generate Updated Note'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {generatedNote && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Suggested Update</Typography>
              <IconButton onClick={handleCopy} color="primary" title="Copy to clipboard">
                <CopyIcon />
              </IconButton>
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

      <SnackbarComponent />
    </Box>
  );
};
