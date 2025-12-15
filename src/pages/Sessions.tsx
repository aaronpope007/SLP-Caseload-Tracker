import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Grid,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Remove as RemoveIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import type { Session, Student, Goal } from '../types';
import {
  getSessions,
  getStudents,
  getGoals,
  addSession,
  updateSession,
  deleteSession,
  getSessionsByStudent,
} from '../utils/storage';
import { generateId, formatDateTime, toLocalDateTimeString, fromLocalDateTimeString } from '../utils/helpers';
import { generateSessionPlan } from '../utils/gemini';
import { useStorageSync } from '../hooks/useStorageSync';
import { useSchool } from '../context/SchoolContext';

export const Sessions = () => {
  const navigate = useNavigate();
  const { selectedSchool } = useSchool();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  // Session Planning State
  const [sessionPlanDialogOpen, setSessionPlanDialogOpen] = useState(false);
  const [planStudentId, setPlanStudentId] = useState('');
  const [sessionPlan, setSessionPlan] = useState('');
  const [loadingSessionPlan, setLoadingSessionPlan] = useState(false);
  const [sessionPlanError, setSessionPlanError] = useState('');

  const [formData, setFormData] = useState({
    studentId: '',
    date: toLocalDateTimeString(new Date()),
    goalsTargeted: [] as string[],
    activitiesUsed: [] as string[],
    performanceData: [] as { goalId: string; accuracy?: string; correctTrials?: number; incorrectTrials?: number; notes?: string }[],
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [selectedSchool]);

  // Sync data across browser tabs
  useStorageSync(() => {
    loadData();
  }, [selectedSchool]);

  const loadData = () => {
    const schoolStudents = getStudents(selectedSchool);
    const studentIds = new Set(schoolStudents.map(s => s.id));
    const allSessions = getSessions();
    const schoolSessions = allSessions
      .filter(s => studentIds.has(s.studentId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSessions(schoolSessions);
    // Filter out archived students (archived is optional for backward compatibility)
    setStudents(schoolStudents.filter(s => s.archived !== true));
    const allGoals = getGoals();
    setGoals(allGoals.filter(g => studentIds.has(g.studentId)));
  };

  const handleOpenDialog = (session?: Session) => {
    if (session) {
      setEditingSession(session);
      setFormData({
        studentId: session.studentId,
        date: toLocalDateTimeString(new Date(session.date)),
        goalsTargeted: session.goalsTargeted,
        activitiesUsed: session.activitiesUsed,
        performanceData: session.performanceData.map(p => ({
          goalId: p.goalId,
          accuracy: p.accuracy?.toString() || '',
          correctTrials: p.correctTrials || 0,
          incorrectTrials: p.incorrectTrials || 0,
          notes: p.notes || '',
        })),
        notes: session.notes,
      });
    } else {
      setEditingSession(null);
      setFormData({
        studentId: '',
        date: toLocalDateTimeString(new Date()),
        goalsTargeted: [],
        activitiesUsed: [],
        performanceData: [],
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSession(null);
  };

  const handleStudentChange = (studentId: string) => {
    setFormData({
      ...formData,
      studentId,
      goalsTargeted: [],
      performanceData: [],
    });
  };

  const handleGoalToggle = (goalId: string) => {
    const isSelected = formData.goalsTargeted.includes(goalId);
    let newGoalsTargeted: string[];
    let newPerformanceData = [...formData.performanceData];

    if (isSelected) {
      newGoalsTargeted = formData.goalsTargeted.filter((id) => id !== goalId);
      newPerformanceData = newPerformanceData.filter((p) => p.goalId !== goalId);
    } else {
      newGoalsTargeted = [...formData.goalsTargeted, goalId];
      newPerformanceData.push({ goalId, accuracy: '', notes: '' });
    }

    setFormData({
      ...formData,
      goalsTargeted: newGoalsTargeted,
      performanceData: newPerformanceData,
    });
  };

  const handlePerformanceUpdate = (goalId: string, field: 'accuracy' | 'notes', value: string) => {
    setFormData({
      ...formData,
      performanceData: formData.performanceData.map((p) =>
        p.goalId === goalId ? { ...p, [field]: value } : p
      ),
    });
  };

  const handleTrialUpdate = (goalId: string, isCorrect: boolean) => {
    setFormData({
      ...formData,
      performanceData: formData.performanceData.map((p) => {
        if (p.goalId !== goalId) return p;
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

  const handleSave = () => {
    const sessionData: Session = {
      id: editingSession?.id || generateId(),
      studentId: formData.studentId,
      date: fromLocalDateTimeString(formData.date),
      goalsTargeted: formData.goalsTargeted,
      activitiesUsed: formData.activitiesUsed,
      performanceData: formData.performanceData.map((p) => ({
        goalId: p.goalId,
        accuracy: p.accuracy ? parseFloat(p.accuracy) : undefined,
        correctTrials: p.correctTrials,
        incorrectTrials: p.incorrectTrials,
        notes: p.notes,
      })),
      notes: formData.notes,
    };

    if (editingSession) {
      updateSession(editingSession.id, sessionData);
    } else {
      addSession(sessionData);
    }
    loadData();
    handleCloseDialog();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      deleteSession(id);
      loadData();
    }
  };

  const getStudentName = (studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || 'Unknown';
  };

  const getGoalDescription = (goalId: string) => {
    return goals.find((g) => g.id === goalId)?.description || 'Unknown Goal';
  };

  const availableGoals = formData.studentId
    ? goals.filter((g) => g.studentId === formData.studentId)
    : [];

  const handleGenerateSessionPlan = async () => {
    if (!planStudentId) {
      setSessionPlanError('Please select a student');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setSessionPlanError('Please set your Gemini API key in Settings');
      return;
    }

    const student = students.find(s => s.id === planStudentId);
    if (!student) {
      setSessionPlanError('Student not found');
      return;
    }

    const studentGoals = goals.filter(g => g.studentId === planStudentId);
    if (studentGoals.length === 0) {
      setSessionPlanError('Selected student has no goals. Please add goals first.');
      return;
    }

    setLoadingSessionPlan(true);
    setSessionPlanError('');

    try {
      const recentSessions = getSessionsByStudent(planStudentId)
        .slice(0, 3)
        .map(s => ({
          date: formatDateTime(s.date),
          activitiesUsed: s.activitiesUsed,
          notes: s.notes,
        }));

      const plan = await generateSessionPlan(
        apiKey,
        student.name,
        student.age,
        studentGoals.map(g => ({
          description: g.description,
          baseline: g.baseline,
          target: g.target,
        })),
        recentSessions
      );
      setSessionPlan(plan);
    } catch (err) {
      setSessionPlanError(err instanceof Error ? err.message : 'Failed to generate session plan');
    } finally {
      setLoadingSessionPlan(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" component="h1">
          Sessions
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<PsychologyIcon />}
            onClick={() => {
              setPlanStudentId('');
              setSessionPlan('');
              setSessionPlanError('');
              setSessionPlanDialogOpen(true);
            }}
          >
            Generate Session Plan
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Log Session
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {sessions.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  No sessions logged yet. Click "Log Session" to get started.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          sessions.map((session) => (
            <Grid item xs={12} key={session.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box>
                      <Typography variant="h6">
                        {getStudentName(session.studentId)}
                      </Typography>
                      <Typography color="text.secondary">
                        {formatDateTime(session.date)}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(session)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(session.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Goals Targeted:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {session.goalsTargeted.map((goalId) => (
                        <Chip
                          key={goalId}
                          label={getGoalDescription(goalId)}
                          size="small"
                        />
                      ))}
                    </Box>
                  </Box>
                  {session.activitiesUsed.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Activities:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {session.activitiesUsed.join(', ')}
                      </Typography>
                    </Box>
                  )}
                  {session.notes && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Notes:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {session.notes}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSession ? 'Edit Session' : 'Log New Session'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Student</InputLabel>
              <Select
                value={formData.studentId}
                onChange={(e) => handleStudentChange(e.target.value)}
                label="Student"
                required
              >
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Date & Time"
              type="datetime-local"
              fullWidth
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            {formData.studentId && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Goals Targeted:
                </Typography>
                {availableGoals.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    No goals found for this student. Add goals in the student's detail page.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                    {availableGoals.map((goal) => (
                      <Box key={goal.id}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formData.goalsTargeted.includes(goal.id)}
                              onChange={() => handleGoalToggle(goal.id)}
                            />
                          }
                          label={goal.description}
                        />
                        {formData.goalsTargeted.includes(goal.id) && (() => {
                          const perfData = formData.performanceData.find((p) => p.goalId === goal.id);
                          const correctTrials = perfData?.correctTrials || 0;
                          const incorrectTrials = perfData?.incorrectTrials || 0;
                          const totalTrials = correctTrials + incorrectTrials;
                          const calculatedAccuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
                          // Use calculated accuracy if trials exist, otherwise use manually entered accuracy
                          const displayAccuracy = totalTrials > 0 ? calculatedAccuracy : (perfData?.accuracy ? parseFloat(perfData.accuracy) : 0);
                          const displayText = totalTrials > 0 ? `${correctTrials}/${totalTrials} trials (${calculatedAccuracy}%)` : '0/0 trials (0%)';
                          
                          return (
                            <Box sx={{ ml: 4, display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleTrialUpdate(goal.id, false)}
                                  color="error"
                                  sx={{ border: '1px solid', borderColor: 'error.main' }}
                                >
                                  <RemoveIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleTrialUpdate(goal.id, true)}
                                  color="success"
                                  sx={{ border: '1px solid', borderColor: 'success.main' }}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                                <Typography variant="body2" sx={{ ml: 1, minWidth: '140px' }}>
                                  {displayText}
                                </Typography>
                              </Box>
                              <TextField
                                label="Accuracy %"
                                type="number"
                                size="small"
                                value={totalTrials > 0 ? calculatedAccuracy.toString() : (perfData?.accuracy || '')}
                                onChange={(e) => {
                                  // When manually entering, clear trials to allow manual override
                                  setFormData({
                                    ...formData,
                                    performanceData: formData.performanceData.map((p) =>
                                      p.goalId === goal.id
                                        ? { ...p, accuracy: e.target.value, correctTrials: 0, incorrectTrials: 0 }
                                        : p
                                    ),
                                  });
                                }}
                                helperText={totalTrials > 0 ? 'Auto-calculated from trials (clear to enter manually)' : 'Enter manually or use +/- buttons'}
                                sx={{ width: 140 }}
                              />
                              <TextField
                                label="Notes"
                                size="small"
                                fullWidth
                                value={perfData?.notes || ''}
                                onChange={(e) =>
                                  handlePerformanceUpdate(goal.id, 'notes', e.target.value)
                                }
                              />
                            </Box>
                          );
                        })()}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            <TextField
              label="Activities Used (comma-separated)"
              fullWidth
              value={formData.activitiesUsed.join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  activitiesUsed: e.target.value
                    .split(',')
                    .map((a) => a.trim())
                    .filter((a) => a.length > 0),
                })
              }
            />

            <TextField
              label="Session Notes"
              fullWidth
              multiline
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.studentId}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session Plan Dialog */}
      <Dialog open={sessionPlanDialogOpen} onClose={() => setSessionPlanDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI Session Planning</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Student</InputLabel>
              <Select
                value={planStudentId}
                onChange={(e) => setPlanStudentId(e.target.value)}
                label="Student"
              >
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {sessionPlanError && (
              <Alert severity="error">{sessionPlanError}</Alert>
            )}
            <Button
              variant="contained"
              onClick={handleGenerateSessionPlan}
              disabled={loadingSessionPlan || !planStudentId}
              startIcon={loadingSessionPlan ? <CircularProgress size={20} /> : <PsychologyIcon />}
            >
              Generate Session Plan
            </Button>
            {sessionPlan && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Generated Session Plan:</Typography>
                <Typography
                  component="div"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    maxHeight: '500px',
                    overflow: 'auto',
                  }}
                >
                  {sessionPlan}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionPlanDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

