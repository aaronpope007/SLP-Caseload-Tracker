import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  LinearProgress,
  TextField,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AutoAwesome as AutoAwesomeIcon,
  Psychology as PsychologyIcon,
  Description as DescriptionIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import type { Student, Goal } from '../types';
import {
  getStudents,
  getGoalsByStudent,
  addGoal,
  updateGoal,
  deleteGoal,
  getSessionsByStudent,
} from '../utils/storage';
import { generateId, formatDate } from '../utils/helpers';
import {
  generateGoalSuggestions,
  generateTreatmentRecommendations,
  generateIEPGoals,
  type GoalProgressData,
} from '../utils/gemini';

export const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    baseline: '',
    target: '',
    status: 'in-progress' as 'in-progress' | 'achieved' | 'modified',
  });

  // AI Features State
  const [goalSuggestionsDialogOpen, setGoalSuggestionsDialogOpen] = useState(false);
  const [goalArea, setGoalArea] = useState('');
  const [goalSuggestions, setGoalSuggestions] = useState('');
  const [loadingGoalSuggestions, setLoadingGoalSuggestions] = useState(false);
  const [goalSuggestionsError, setGoalSuggestionsError] = useState('');

  const [treatmentRecsDialogOpen, setTreatmentRecsDialogOpen] = useState(false);
  const [treatmentRecommendations, setTreatmentRecommendations] = useState('');
  const [loadingTreatmentRecs, setLoadingTreatmentRecs] = useState(false);
  const [treatmentRecsError, setTreatmentRecsError] = useState('');

  const [iepGoalsDialogOpen, setIepGoalsDialogOpen] = useState(false);
  const [assessmentData, setAssessmentData] = useState('');
  const [iepGoals, setIepGoals] = useState('');
  const [loadingIepGoals, setLoadingIepGoals] = useState(false);
  const [iepGoalsError, setIepGoalsError] = useState('');

  useEffect(() => {
    if (id) {
      loadStudent();
      loadGoals();
    }
  }, [id]);

  const loadStudent = () => {
    if (id) {
      const found = getStudents().find((s) => s.id === id);
      setStudent(found || null);
    }
  };

  const loadGoals = () => {
    if (id) {
      setGoals(getGoalsByStudent(id));
    }
  };

  const handleOpenDialog = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        description: goal.description,
        baseline: goal.baseline,
        target: goal.target,
        status: goal.status,
      });
    } else {
      setEditingGoal(null);
      setFormData({
        description: '',
        baseline: '',
        target: '',
        status: 'in-progress',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGoal(null);
  };

  const handleSave = () => {
    if (!id) return;

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        description: formData.description,
        baseline: formData.baseline,
        target: formData.target,
        status: formData.status,
      });
    } else {
      addGoal({
        id: generateId(),
        studentId: id,
        description: formData.description,
        baseline: formData.baseline,
        target: formData.target,
        status: formData.status,
        dateCreated: new Date().toISOString(),
      });
    }
    loadGoals();
    handleCloseDialog();
  };

  const handleDelete = (goalId: string) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      deleteGoal(goalId);
      loadGoals();
    }
  };

  // AI Feature Handlers
  const handleGenerateGoalSuggestions = async () => {
    if (!goalArea.trim()) {
      setGoalSuggestionsError('Please enter a goal area');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setGoalSuggestionsError('Please set your Gemini API key in Settings');
      return;
    }

    setLoadingGoalSuggestions(true);
    setGoalSuggestionsError('');

    try {
      const suggestions = await generateGoalSuggestions(
        apiKey,
        goalArea,
        student?.age || 0,
        student?.grade || '',
        student?.concerns || []
      );
      setGoalSuggestions(suggestions);
    } catch (err) {
      setGoalSuggestionsError(err instanceof Error ? err.message : 'Failed to generate goal suggestions');
    } finally {
      setLoadingGoalSuggestions(false);
    }
  };

  const handleGenerateTreatmentRecommendations = async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setTreatmentRecsError('Please set your Gemini API key in Settings');
      return;
    }

    setLoadingTreatmentRecs(true);
    setTreatmentRecsError('');

    try {
      // Convert goals to GoalProgressData format
      const sessions = id ? getSessionsByStudent(id) : [];
      const goalProgressData: GoalProgressData[] = goals.map(goal => {
        const goalSessions = sessions.filter(s => s.goalsTargeted.includes(goal.id));
        const latestPerf = goalSessions
          .flatMap(s => s.performanceData.filter(p => p.goalId === goal.id))
          .filter(p => p.accuracy !== undefined)
          .sort((a, b) => {
            const dateA = sessions.find(s => s.performanceData.includes(a))?.date || '';
            const dateB = sessions.find(s => s.performanceData.includes(b))?.date || '';
            return dateB.localeCompare(dateA);
          })[0];

        const baselineNum = parseFloat(goal.baseline) || 0;
        const targetNum = parseFloat(goal.target) || 100;
        const currentNum = latestPerf?.accuracy || baselineNum;

        return {
          goalDescription: goal.description,
          baseline: baselineNum,
          target: targetNum,
          current: currentNum,
          sessions: goalSessions.length,
          status: goal.status,
          performanceHistory: goalSessions.slice(0, 5).map(s => {
            const perf = s.performanceData.find(p => p.goalId === goal.id);
            return {
              date: s.date,
              accuracy: perf?.accuracy || 0,
              correctTrials: perf?.correctTrials,
              incorrectTrials: perf?.incorrectTrials,
              notes: perf?.notes || s.notes,
            };
          }),
        };
      });

      const recentSessions = sessions.slice(0, 5).map(s => ({
        date: s.date,
        performanceData: s.performanceData,
        notes: s.notes,
      }));

      const recommendations = await generateTreatmentRecommendations(
        apiKey,
        student?.name || '',
        student?.age || 0,
        goalProgressData,
        recentSessions
      );
      setTreatmentRecommendations(recommendations);
    } catch (err) {
      setTreatmentRecsError(err instanceof Error ? err.message : 'Failed to generate treatment recommendations');
    } finally {
      setLoadingTreatmentRecs(false);
    }
  };

  const handleGenerateIEPGoals = async () => {
    if (!assessmentData.trim()) {
      setIepGoalsError('Please enter assessment data');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setIepGoalsError('Please set your Gemini API key in Settings');
      return;
    }

    setLoadingIepGoals(true);
    setIepGoalsError('');

    try {
      const iepGoalsResult = await generateIEPGoals(
        apiKey,
        student?.name || '',
        student?.age || 0,
        student?.grade || '',
        assessmentData,
        student?.concerns || []
      );
      setIepGoals(iepGoalsResult);
    } catch (err) {
      setIepGoalsError(err instanceof Error ? err.message : 'Failed to generate IEP goals');
    } finally {
      setLoadingIepGoals(false);
    }
  };

  if (!student) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/students')}>
          Back to Students
        </Button>
        <Typography>Student not found</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/students')}
        sx={{ mb: 2 }}
      >
        Back to Students
      </Button>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h4">{student.name}</Typography>
              <Typography color="text.secondary">
                Age: {student.age} | Grade: {student.grade}
              </Typography>
            </Box>
            <Chip
              label={student.status}
              color={student.status === 'active' ? 'primary' : 'default'}
            />
          </Box>
          {student.concerns.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Concerns:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {student.concerns.map((concern, idx) => (
                  <Chip key={idx} label={concern} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">Goals</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<SchoolIcon />}
            onClick={() => {
              setAssessmentData('');
              setIepGoals('');
              setIepGoalsDialogOpen(true);
            }}
          >
            Generate IEP Goals
          </Button>
          <Button
            variant="outlined"
            startIcon={<PsychologyIcon />}
            onClick={() => {
              setTreatmentRecommendations('');
              handleGenerateTreatmentRecommendations();
              setTreatmentRecsDialogOpen(true);
            }}
            disabled={goals.length === 0}
          >
            Treatment Recommendations
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Goal
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {goals.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  No goals added yet. Click "Add Goal" to create one.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          goals.map((goal) => (
            <Grid item xs={12} md={6} key={goal.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6">{goal.description}</Typography>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(goal)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(goal.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Baseline: {goal.baseline}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Target: {goal.target}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Chip
                      label={goal.status}
                      size="small"
                      color={
                        goal.status === 'achieved'
                          ? 'success'
                          : goal.status === 'modified'
                          ? 'warning'
                          : 'default'
                      }
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Created: {formatDate(goal.dateCreated)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGoal ? 'Edit Goal' : 'Add New Goal'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="Goal Description"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
              />
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => {
                  setGoalArea(formData.description || '');
                  setGoalSuggestions('');
                  setGoalSuggestionsError('');
                  setGoalSuggestionsDialogOpen(true);
                }}
                sx={{ mt: 1 }}
                title="Get AI suggestions for this goal"
              >
                AI
              </Button>
            </Box>
            <TextField
              label="Baseline"
              fullWidth
              value={formData.baseline}
              onChange={(e) => setFormData({ ...formData, baseline: e.target.value })}
              helperText="Initial performance level"
            />
            <TextField
              label="Target"
              fullWidth
              value={formData.target}
              onChange={(e) => setFormData({ ...formData, target: e.target.value })}
              helperText="Desired performance level"
            />
            <TextField
              select
              label="Status"
              fullWidth
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as 'in-progress' | 'achieved' | 'modified',
                })
              }
              SelectProps={{
                native: true,
              }}
            >
              <option value="in-progress">In Progress</option>
              <option value="achieved">Achieved</option>
              <option value="modified">Modified</option>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.description}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Goal Suggestions Dialog */}
      <Dialog open={goalSuggestionsDialogOpen} onClose={() => setGoalSuggestionsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI Goal Writing Assistant</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Goal Area"
              fullWidth
              value={goalArea}
              onChange={(e) => setGoalArea(e.target.value)}
              placeholder="e.g., Articulation, Language, Fluency, Pragmatics"
              helperText="Enter the area you'd like to write goals for"
            />
            {goalSuggestionsError && (
              <Alert severity="error">{goalSuggestionsError}</Alert>
            )}
            <Button
              variant="contained"
              onClick={handleGenerateGoalSuggestions}
              disabled={loadingGoalSuggestions || !goalArea.trim()}
              startIcon={loadingGoalSuggestions ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
            >
              Generate Goal Suggestions
            </Button>
            {goalSuggestions && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Suggestions:</Typography>
                <Typography
                  component="div"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    maxHeight: '400px',
                    overflow: 'auto',
                  }}
                >
                  {goalSuggestions}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoalSuggestionsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Treatment Recommendations Dialog */}
      <Dialog open={treatmentRecsDialogOpen} onClose={() => setTreatmentRecsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Treatment Recommendations</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {treatmentRecsError && (
              <Alert severity="error">{treatmentRecsError}</Alert>
            )}
            {loadingTreatmentRecs && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            )}
            {treatmentRecommendations && (
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
                {treatmentRecommendations}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTreatmentRecsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* IEP Goals Dialog */}
      <Dialog open={iepGoalsDialogOpen} onClose={() => setIepGoalsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Generate IEP Goals from Assessment Data</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Assessment Data"
              fullWidth
              multiline
              rows={8}
              value={assessmentData}
              onChange={(e) => setAssessmentData(e.target.value)}
              placeholder="Enter assessment results, observations, test scores, areas of need, etc."
              helperText="Provide comprehensive assessment data to generate appropriate IEP goals"
            />
            {iepGoalsError && (
              <Alert severity="error">{iepGoalsError}</Alert>
            )}
            <Button
              variant="contained"
              onClick={handleGenerateIEPGoals}
              disabled={loadingIepGoals || !assessmentData.trim()}
              startIcon={loadingIepGoals ? <CircularProgress size={20} /> : <SchoolIcon />}
            >
              Generate IEP Goals
            </Button>
            {iepGoals && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Generated IEP Goals:</Typography>
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
                  {iepGoals}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIepGoalsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

