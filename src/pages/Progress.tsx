import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logError } from '../utils/logger';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Grid,
  LinearProgress,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Autocomplete,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Save as SaveIcon,
  FolderOpen as FolderOpenIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { getStudents, getGoals, getSessions, getCombinedProgressNotes, addCombinedProgressNote, updateCombinedProgressNote, deleteCombinedProgressNote } from '../utils/storage-api';
import { formatDate, generateId } from '../utils/helpers';
import { generateProgressNote, type GoalProgressData } from '../utils/gemini';
import { useSchool } from '../context/SchoolContext';
import { useAsyncOperation, useSnackbar, useAIGeneration } from '../hooks';
import { getErrorMessage } from '../utils/validators';
import type { Student, CombinedProgressNote } from '../types';

interface TimelineDataItem {
  date: string;
  sessionCount: number;
  goalsTargeted: number;
}

interface PerformanceHistoryItem {
  date: string;
  accuracy: number;
  correctTrials?: number;
  incorrectTrials?: number;
  notes?: string;
  cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
}

interface GoalProgressItem {
  goalId: string;
  goal: string;
  goalShort: string;
  baseline: number;
  target: number;
  current: number;
  sessions: number;
  status: 'in-progress' | 'achieved' | 'modified';
  performanceHistory: PerformanceHistoryItem[];
}

export const Progress = () => {
  const { selectedSchool } = useSchool();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { requireApiKey } = useAIGeneration();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [progressData, setProgressData] = useState<TimelineDataItem[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgressItem[]>([]);
  const [goalNotes, setGoalNotes] = useState<Record<string, string>>({});
  const [combinedNote, setCombinedNote] = useState<string>('');
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [loadingNotes, setLoadingNotes] = useState<Record<string, boolean>>({});
  const [loadingCombined, setLoadingCombined] = useState<boolean>(false);
  const [savedNotes, setSavedNotes] = useState<CombinedProgressNote[]>([]);
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [loadingSavedNotes, setLoadingSavedNotes] = useState<boolean>(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [additionalContextForGeneration, setAdditionalContextForGeneration] = useState<string>('');
  const isMountedRef = useRef(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const loadStudents = async () => {
      try {
        // Filter out archived students (archived is optional for backward compatibility)
        const allStudents = (await getStudents(selectedSchool)).filter((s) => s.status === 'active' && s.archived !== true);
        setStudents(allStudents);
        if (allStudents.length > 0) {
          const studentIdFromUrl = searchParams.get('studentId');
          const urlStudent = studentIdFromUrl ? allStudents.find((s) => s.id === studentIdFromUrl) : null;
          if (urlStudent) {
            setSelectedStudentId(urlStudent.id);
          } else if (!selectedStudentId) {
            setSelectedStudentId(allStudents[0].id);
          }
        }
      } catch (error) {
        logError('Failed to load students', error);
      }
    };
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool, searchParams]);

  useEffect(() => {
    if (selectedStudentId) {
      loadProgressData();
      loadSavedNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId]);

  // Memory leak prevention
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadProgressData = async () => {
    try {
      const sessions = (await getSessions())
        .filter((s) => s.studentId === selectedStudentId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const goals = (await getGoals()).filter((g) => g.studentId === selectedStudentId);

    // Prepare session timeline data
    const timelineData = sessions.map((session) => ({
      date: formatDate(session.date),
      sessionCount: 1,
      goalsTargeted: (session.goalsTargeted || []).length,
    }));

    // Aggregate by date
    const aggregatedData = timelineData.reduce((acc: TimelineDataItem[], curr) => {
      const existing = acc.find((item) => item.date === curr.date);
      if (existing) {
        existing.sessionCount += curr.sessionCount;
        existing.goalsTargeted += curr.goalsTargeted;
      } else {
        acc.push({ ...curr });
      }
      return acc;
    }, []);

    setProgressData(aggregatedData);

    // Prepare goal progress data with detailed performance history
    const goalData = goals.map((goal) => {
      const goalSessions = sessions
        .filter((s) => (s.goalsTargeted || []).includes(goal.id))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date, most recent first
      
      // Get performance history for all sessions
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
      
      // Get the most recent 3 sessions for average calculation
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
        goalId: goal.id,
        goal: goal.description,
        goalShort: goal.description.substring(0, 30) + (goal.description.length > 30 ? '...' : ''),
        baseline: parseFloat(goal.baseline) || 0,
        target: parseFloat(goal.target) || 100,
        current: avgAccuracy,
        sessions: goalSessions.length,
        status: goal.status,
        performanceHistory,
      };
    });

      setGoalProgress(goalData);
      // Reset notes and selections when data changes
      setGoalNotes({});
      setCombinedNote('');
      setSelectedGoals(new Set());
    } catch (error) {
      logError('Failed to load progress data', error);
    }
  };

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Same search as Log Communication modal / Sessions: name, grade, concerns
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

  const handleGenerateGoalNote = async (goalIdx: number) => {
    const goal = goalProgress[goalIdx];
    if (!goal || !selectedStudent) return;

    const apiKey = requireApiKey();
    if (!apiKey) {
      return;
    }

    setLoadingNotes({ ...loadingNotes, [goal.goalId]: true });

    try {
      // Re-fetch the latest data to ensure we have up-to-date goal results
      const sessions = (await getSessions())
        .filter((s) => s.studentId === selectedStudentId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const goals = (await getGoals()).filter((g) => g.studentId === selectedStudentId);
      const targetGoal = goals.find((g) => g.id === goal.goalId);
      
      if (!targetGoal) {
        showSnackbar('Goal not found', 'error');
        return;
      }

      // Calculate fresh goal progress data
      const goalSessions = sessions
        .filter((s) => (s.goalsTargeted || []).includes(targetGoal.id))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const performanceHistory = goalSessions.map((s) => {
        const perf = s.performanceData.find((p) => p.goalId === targetGoal.id);
        return {
          date: formatDate(s.date),
          accuracy: perf?.accuracy || 0,
          correctTrials: perf?.correctTrials,
          incorrectTrials: perf?.incorrectTrials,
          notes: perf?.notes,
        };
      }).filter((p) => p.accuracy > 0 || p.correctTrials !== undefined);
      
      const recentSessions = goalSessions.slice(0, 3);
      const performanceData = recentSessions
        .map((s) => {
          const perf = s.performanceData.find((p) => p.goalId === targetGoal.id);
          return perf?.accuracy;
        })
        .filter((a) => a !== undefined) as number[];

      const avgAccuracy =
        performanceData.length > 0
          ? performanceData.reduce((a, b) => a + b, 0) / performanceData.length
          : 0;

      const goalData: GoalProgressData = {
        goalDescription: targetGoal.description,
        baseline: parseFloat(targetGoal.baseline) || 0,
        target: parseFloat(targetGoal.target) || 100,
        current: avgAccuracy,
        sessions: goalSessions.length,
        status: targetGoal.status,
        performanceHistory,
      };

      const note = await generateProgressNote(selectedStudent.name, [goalData], apiKey, additionalContextForGeneration || undefined);
      setGoalNotes({ ...goalNotes, [goal.goalId]: note });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      showSnackbar(errorMessage, 'error');
      logError('Failed to generate goal progress note', err);
    } finally {
      setLoadingNotes({ ...loadingNotes, [goal.goalId]: false });
    }
  };

  const handleToggleGoalSelection = (goalId: string) => {
    const newSelected = new Set(selectedGoals);
    if (newSelected.has(goalId)) {
      newSelected.delete(goalId);
    } else {
      newSelected.add(goalId);
    }
    setSelectedGoals(newSelected);
  };

  const handleSelectAllGoals = () => {
    if (selectedGoals.size === goalProgress.length) {
      setSelectedGoals(new Set());
    } else {
      setSelectedGoals(new Set(goalProgress.map((g) => g.goalId || `goal-${g.goal}`)));
    }
  };

  const handleGenerateCombinedNote = async () => {
    if (!selectedStudent) return;

    const apiKey = requireApiKey();
    if (!apiKey) {
      return;
    }

    setLoadingCombined(true);

    try {
      // Refresh data to ensure we have the latest goal results
      const sessions = (await getSessions())
        .filter((s) => s.studentId === selectedStudentId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const goals = (await getGoals()).filter((g) => g.studentId === selectedStudentId);
      
      // Calculate fresh goal progress data for all goals
      const allGoalData = goals.map((goal) => {
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
          goalId: goal.id,
          goalDescription: goal.description,
          baseline: parseFloat(goal.baseline) || 0,
          target: parseFloat(goal.target) || 100,
          current: avgAccuracy,
          sessions: goalSessions.length,
          status: goal.status,
          performanceHistory,
        };
      });

      const goalsToInclude = selectedGoals.size > 0
        ? allGoalData.filter((g) => selectedGoals.has(g.goalId))
        : allGoalData;

      if (goalsToInclude.length === 0) {
        showSnackbar('Please select at least one goal or leave all unchecked to include all goals.', 'error');
        return;
      }

      const goalsData: GoalProgressData[] = goalsToInclude.map((goal) => ({
        goalDescription: goal.goalDescription,
        baseline: goal.baseline,
        target: goal.target,
        current: goal.current,
        sessions: goal.sessions,
        status: goal.status,
        performanceHistory: goal.performanceHistory,
      }));

      const note = await generateProgressNote(selectedStudent.name, goalsData, apiKey, additionalContextForGeneration || undefined);
      if (!isMountedRef.current) return;
      setCombinedNote(note);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const errorMessage = getErrorMessage(err);
      showSnackbar(errorMessage, 'error');
      logError('Failed to generate combined progress note', err);
    } finally {
      if (isMountedRef.current) {
        setLoadingCombined(false);
      }
    }
  };

  const loadSavedNotes = async () => {
    if (!selectedStudentId || !isMountedRef.current) return;
    setLoadingSavedNotes(true);
    try {
      const notes = await getCombinedProgressNotes(selectedStudentId);
      if (!isMountedRef.current) return;
      setSavedNotes(notes);
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to load saved notes', error);
    } finally {
      if (isMountedRef.current) {
        setLoadingSavedNotes(false);
      }
    }
  };

  const handleSaveNote = async () => {
    if (!selectedStudentId || !combinedNote.trim()) {
      showSnackbar('Please generate a note before saving', 'error');
      return;
    }

    if (!isMountedRef.current) return;
    setSavingNote(true);
    try {
      const note: CombinedProgressNote = {
        id: generateId(),
        studentId: selectedStudentId,
        content: combinedNote,
        selectedGoalIds: JSON.stringify(Array.from(selectedGoals)),
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      };
      await addCombinedProgressNote(note);
      if (!isMountedRef.current) return;
      await loadSavedNotes();
      showSnackbar('Note saved successfully', 'success');
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to save note', error);
      showSnackbar('Failed to save note. Please try again.', 'error');
    } finally {
      if (isMountedRef.current) {
        setSavingNote(false);
      }
    }
  };

  const handleLoadNote = (note: CombinedProgressNote) => {
    setCombinedNote(note.content);
    if (note.selectedGoalIds) {
      try {
        const goalIds = JSON.parse(note.selectedGoalIds) as string[];
        setSelectedGoals(new Set(goalIds));
      } catch {
        // If parsing fails, just load the content
      }
    }
    setEditingNoteId(note.id);
  };

  const handleUpdateNote = async () => {
    if (!editingNoteId || !combinedNote.trim()) {
      showSnackbar('Please generate a note before updating', 'error');
      return;
    }

    if (!isMountedRef.current) return;
    setSavingNote(true);
    try {
      await updateCombinedProgressNote(editingNoteId, {
        content: combinedNote,
        selectedGoalIds: JSON.stringify(Array.from(selectedGoals)),
        dateUpdated: new Date().toISOString(),
      });
      if (!isMountedRef.current) return;
      await loadSavedNotes();
      showSnackbar('Note updated successfully', 'success');
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to update note', error);
      showSnackbar('Failed to update note. Please try again.', 'error');
    } finally {
      if (isMountedRef.current) {
        setSavingNote(false);
      }
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!isMountedRef.current) return;
    try {
      await deleteCombinedProgressNote(id);
      if (!isMountedRef.current) return;
      await loadSavedNotes();
      if (editingNoteId === id) {
        setEditingNoteId(null);
        setCombinedNote('');
        setSelectedGoals(new Set());
      }
      showSnackbar('Note deleted successfully', 'success');
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to delete note', error);
      showSnackbar('Failed to delete note. Please try again.', 'error');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Progress Tracking
        </Typography>
        <Autocomplete
          size="small"
          sx={{ minWidth: 240 }}
          options={students}
          getOptionLabel={(option) => option?.name ?? ''}
          filterOptions={(options, state) => filterStudentOptions(options, state.inputValue)}
          value={selectedStudentId ? students.find((s) => s.id === selectedStudentId) ?? null : null}
          onChange={(_, newValue) => setSelectedStudentId(newValue?.id ?? '')}
          renderInput={(params) => (
            <TextField {...params} label="Select Student" placeholder="Search by name, grade, or concerns" />
          )}
          isOptionEqualToValue={(option, value) => value != null && option.id === value.id}
          clearText="Clear"
        />
      </Box>

      {selectedStudentId && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {selectedStudent?.name} - Session Timeline
              </Typography>
              {progressData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="goalsTargeted"
                      stroke="#1976d2"
                      name="Goals Targeted"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No session data available yet
                </Typography>
              )}
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            {goalProgress.map((goal, idx) => {
              const progressPercent =
                goal.target > goal.baseline
                  ? ((goal.current - goal.baseline) /
                      (goal.target - goal.baseline)) *
                    100
                  : 0;

              // Prepare chart data for this individual goal
              const chartData = [
                {
                  name: 'Performance',
                  baseline: goal.baseline,
                  current: goal.current,
                  target: goal.target,
                },
              ];

              return (
                <Grid item xs={12} key={idx}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Goal overview:
                      </Typography>
                      <Typography variant="h6" gutterBottom sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                        {goal.goal}
                      </Typography>
                      <Box sx={{ mb: 3, mt: 2 }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="baseline" fill="#8884d8" name="Baseline" />
                            <Bar dataKey="current" fill="#82ca9d" name="Current" />
                            <Bar dataKey="target" fill="#ffc658" name="Target" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 1,
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            Progress
                          </Typography>
                          <Typography variant="body2">
                            {Math.max(0, Math.min(100, Math.round(progressPercent)))}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.max(0, Math.min(100, progressPercent))}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">
                            Baseline
                          </Typography>
                          <Typography variant="body2">{goal.baseline}%</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">
                            Current
                          </Typography>
                          <Typography variant="body2">{goal.current.toFixed(1)}%</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">
                            Target
                          </Typography>
                          <Typography variant="body2">{goal.target}%</Typography>
                        </Grid>
                      </Grid>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Sessions: {goal.sessions} | Status: {goal.status}
                      </Typography>
                      
                      {/* Cuing Level Progression Chart */}
                      {goal.performanceHistory.some(p => p.cuingLevels && p.cuingLevels.length > 0) && (
                        <Box sx={{ mt: 3, mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Cuing Level Progression:
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Shows the most intensive cuing level needed (lower = more independent). Multiple cues may have been used.
                          </Typography>
                          <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={goal.performanceHistory
                              .filter(p => p.cuingLevels && p.cuingLevels.length > 0)
                              .map(p => {
                                const cuingLevelMap: Record<string, number> = {
                                  independent: 0,
                                  verbal: 1,
                                  visual: 2,
                                  tactile: 3,
                                  physical: 4,
                                };
                                // Use the highest (most intensive) cuing level if multiple were used
                                const maxLevel = p.cuingLevels && p.cuingLevels.length > 0
                                  ? Math.max(...p.cuingLevels.map(l => cuingLevelMap[l] || 0))
                                  : 0;
                                const labels: Record<number, string> = {
                                  0: 'Independent',
                                  1: 'Verbal',
                                  2: 'Visual',
                                  3: 'Tactile',
                                  4: 'Physical',
                                };
                                return {
                                  date: p.date,
                                  cuingLevel: maxLevel,
                                  label: labels[maxLevel] || 'Unknown',
                                  cuingLevelsText: p.cuingLevels?.join(', ') || '',
                                };
                              })}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis 
                                domain={[0, 4]}
                                ticks={[0, 1, 2, 3, 4]}
                                tickFormatter={(value) => {
                                  const labels: Record<number, string> = {
                                    0: 'Ind',
                                    1: 'Verb',
                                    2: 'Vis',
                                    3: 'Tac',
                                    4: 'Phys',
                                  };
                                  return labels[value] || '';
                                }}
                              />
                              <Tooltip 
                                formatter={(value: number, payload: unknown) => {
                                  const labels: Record<number, string> = {
                                    0: 'Independent',
                                    1: 'Verbal',
                                    2: 'Visual',
                                    3: 'Tactile',
                                    4: 'Physical',
                                  };
                                  const text = labels[value] || 'Unknown';
                                  const payloadArray = Array.isArray(payload) ? payload : [];
                                  const firstPayload = payloadArray[0] as { payload?: { cuingLevelsText?: string } } | undefined;
                                  const multiple = firstPayload?.payload?.cuingLevelsText;
                                  return multiple && multiple.split(', ').length > 1 
                                    ? `${text} (Used: ${multiple})`
                                    : text;
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="cuingLevel"
                                stroke="#9c27b0"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name="Max Cuing Level"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      )}
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Progress Note:
                        </Typography>
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          value={goalNotes[goal.goalId] || ''}
                          onChange={(e) => setGoalNotes({ ...goalNotes, [goal.goalId]: e.target.value })}
                          placeholder="Generated progress note will appear here..."
                          sx={{ mb: 1 }}
                        />
                        <Button
                          variant="outlined"
                          onClick={() => handleGenerateGoalNote(idx)}
                          disabled={loadingNotes[goal.goalId]}
                          startIcon={loadingNotes[goal.goalId] ? <CircularProgress size={16} /> : null}
                        >
                          {loadingNotes[goal.goalId] ? 'Generating...' : 'Generate Goal Note'}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {goalProgress.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Combined Progress Note
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select specific goals to include, or leave all unchecked to include all goals.
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedGoals.size === goalProgress.length && goalProgress.length > 0}
                        indeterminate={selectedGoals.size > 0 && selectedGoals.size < goalProgress.length}
                        onChange={handleSelectAllGoals}
                      />
                    }
                    label="Select All Goals"
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  {goalProgress.map((goal) => {
                    const goalId = goal.goalId || `goal-${goal.goal}`;
                    return (
                      <FormControlLabel
                        key={goalId}
                        control={
                          <Checkbox
                            value={goalId}
                            checked={selectedGoals.has(goalId)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleGoalSelection(goalId);
                            }}
                          />
                        }
                        label={goal.goal}
                        sx={{ display: 'block', mb: 0.5 }}
                      />
                    );
                  })}
                </Box>

                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={4}
                  value={additionalContextForGeneration}
                  onChange={(e) => setAdditionalContextForGeneration(e.target.value)}
                  label="Additional context for the AI (optional)"
                  placeholder="e.g. I only saw this student for four sessions, so the data is limited."
                  helperText="Give Gemini extra context (e.g. limited sessions, partial data) so it can write a more nuanced note."
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  value={combinedNote}
                  onChange={(e) => setCombinedNote(e.target.value)}
                  placeholder="Generated progress note will appear here..."
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleGenerateCombinedNote}
                    disabled={loadingCombined}
                    startIcon={loadingCombined ? <CircularProgress size={16} /> : null}
                  >
                    {loadingCombined ? 'Generating...' : 'Generate Combined Note'}
                  </Button>
                  {combinedNote.trim() && (
                    <Button
                      variant="outlined"
                      onClick={editingNoteId ? handleUpdateNote : handleSaveNote}
                      disabled={savingNote}
                      startIcon={savingNote ? <CircularProgress size={16} /> : <SaveIcon />}
                    >
                      {savingNote ? 'Saving...' : editingNoteId ? 'Update Saved Note' : 'Save Note'}
                    </Button>
                  )}
                  {savedNotes.length > 0 && (
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>Load Saved Note</InputLabel>
                      <Select
                        value=""
                        label="Load Saved Note"
                        onChange={(e) => {
                          const noteId = e.target.value;
                          const note = savedNotes.find(n => n.id === noteId);
                          if (note) {
                            handleLoadNote(note);
                          }
                        }}
                      >
                        {savedNotes.map((note) => (
                          <MenuItem key={note.id} value={note.id}>
                            {formatDate(note.dateUpdated)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
                {savedNotes.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Saved Notes:
                    </Typography>
                    {savedNotes.map((note) => (
                      <Box
                        key={note.id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1,
                          mb: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          bgcolor: editingNoteId === note.id ? 'action.selected' : 'background.paper',
                        }}
                      >
                        <Typography variant="body2">
                          Saved: {formatDate(note.dateUpdated)}
                        </Typography>
                        <Box>
                          <IconButton
                            size="small"
                            onClick={() => handleLoadNote(note)}
                            title="Load this note"
                          >
                            <FolderOpenIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteNote(note.id)}
                            title="Delete this note"
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {goalProgress.length === 0 && (
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  No goals found for this student. Add goals in the student's detail page.
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {students.length === 0 && (
        <Card>
          <CardContent>
            <Typography color="text.secondary" align="center">
              No active students found. Add students to track progress.
            </Typography>
          </CardContent>
        </Card>
      )}

      <SnackbarComponent />
    </Box>
  );
};

