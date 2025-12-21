import React, { useState, useEffect } from 'react';
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
  TextField,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CardActions,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AutoAwesome as AutoAwesomeIcon,
  Psychology as PsychologyIcon,
  School as SchoolIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import type { Student, Goal, Session } from '../types';
import {
  getStudents,
  getGoalsByStudent,
  addGoal,
  updateGoal,
  deleteGoal,
  getSessionsByStudent,
  getGoals,
} from '../utils/storage-api';
import { generateId, formatDate, getGoalProgressChipProps } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm } from '../hooks/useConfirm';
import { useDirty } from '../hooks/useDirty';
import {
  generateGoalSuggestions,
  generateTreatmentRecommendations,
  generateIEPGoals,
  type GoalProgressData,
} from '../utils/gemini';
import {
  goalTemplates,
  getGoalTemplatesByDomain,
  getGoalTemplatesByKeywords,
  getUniqueDomains,
} from '../utils/goalTemplates';

export const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedSchool } = useSchool();
  const [student, setStudent] = useState<Student | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    baseline: '',
    target: '',
    status: 'in-progress' as 'in-progress' | 'achieved' | 'modified',
    domain: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    parentGoalId: '',
  });
  const [initialFormData, setInitialFormData] = useState(formData);
  const { confirm, ConfirmDialog } = useConfirm();

  // Check if form is dirty
  const isFormDirty = () => {
    if (!dialogOpen) return false;
    return (
      formData.description !== initialFormData.description ||
      formData.baseline !== initialFormData.baseline ||
      formData.target !== initialFormData.target ||
      formData.status !== initialFormData.status ||
      formData.domain !== initialFormData.domain ||
      formData.priority !== initialFormData.priority ||
      formData.parentGoalId !== initialFormData.parentGoalId
    );
  };

  // Use dirty hook to block navigation
  const { blocker, reset: resetDirty } = useDirty({
    isDirty: isFormDirty(),
    message: 'You have unsaved changes to this goal. Are you sure you want to leave?',
  });
  
  // Goal template selection
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof goalTemplates[0] | null>(null);
  const [templateFilterDomain, setTemplateFilterDomain] = useState<string>('');
  const [showRecommendedTemplates, setShowRecommendedTemplates] = useState(true);
  
  // Get recommended templates based on student concerns
  const getRecommendedTemplates = (): typeof goalTemplates => {
    if (!student || !showRecommendedTemplates) return [];
    return getGoalTemplatesByKeywords(student.concerns);
  };

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
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedSchool]);


  const loadStudent = async () => {
    if (id) {
      try {
        const students = await getStudents(selectedSchool);
        const found = students.find((s) => s.id === id);
        setStudent(found || null);
      } catch (error) {
        console.error('Failed to load student:', error);
      }
    }
  };

  const loadGoals = async () => {
    if (id) {
      try {
        const goals = await getGoalsByStudent(id, selectedSchool);
        setGoals(goals);
      } catch (error) {
        console.error('Failed to load goals:', error);
      }
    }
  };

  const loadSessions = async () => {
    if (id) {
      try {
        const studentSessions = await getSessionsByStudent(id, selectedSchool);
        setSessions(studentSessions);
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    }
  };

  // Helper to get recent performance for a goal (uses sessions from state)
  const getRecentPerformance = (goalId: string) => {
    if (!id) return { recentSessions: [], average: null };
    const goalSessions = sessions
      .filter(s => s.goalsTargeted.includes(goalId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
    
    const recentData = goalSessions.map(s => {
      const perf = s.performanceData.find((p: { goalId: string }) => p.goalId === goalId);
      return {
        date: s.date,
        accuracy: perf?.accuracy,
        correctTrials: perf?.correctTrials,
        incorrectTrials: perf?.incorrectTrials,
      };
    }).filter(d => d.accuracy !== undefined);

    const average = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + (d.accuracy || 0), 0) / recentData.length
      : null;

    return { recentSessions: recentData, average };
  };

  const handleOpenDialog = (goal?: Goal, parentGoalId?: string) => {
    let newFormData: {
      description: string;
      baseline: string;
      target: string;
      status: 'in-progress' | 'achieved' | 'modified';
      domain: string;
      priority: 'high' | 'medium' | 'low';
      parentGoalId: string;
    };
    if (goal) {
      setEditingGoal(goal);
      newFormData = {
        description: goal.description,
        baseline: goal.baseline,
        target: goal.target,
        status: goal.status,
        domain: goal.domain || '',
        priority: goal.priority || 'medium',
        parentGoalId: goal.parentGoalId || '',
      };
    } else {
      setEditingGoal(null);
      // If creating a sub-goal, inherit domain and priority from parent
      let inheritedDomain = '';
      let inheritedPriority: 'high' | 'medium' | 'low' = 'medium';
      if (parentGoalId) {
        const parentGoal = goals.find(g => g.id === parentGoalId);
        if (parentGoal) {
          inheritedDomain = parentGoal.domain || '';
          inheritedPriority = parentGoal.priority || 'medium';
        }
      }
      newFormData = {
        description: '',
        baseline: '',
        target: '',
        status: 'in-progress',
        domain: inheritedDomain,
        priority: inheritedPriority,
        parentGoalId: parentGoalId || '',
      };
    }
    setFormData(newFormData);
    setInitialFormData(newFormData);
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (isFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes to this goal. Are you sure you want to close?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          setDialogOpen(false);
          setEditingGoal(null);
          resetDirty();
        },
      });
    } else {
      setDialogOpen(false);
      setEditingGoal(null);
      resetDirty();
    }
  };

  const handleSave = async () => {
    if (!id) return;

    try {
      const goalData: Partial<Goal> = {
        description: formData.description,
        baseline: formData.baseline,
        target: formData.target,
        status: formData.status,
        domain: formData.domain || undefined,
        priority: formData.priority,
        parentGoalId: formData.parentGoalId || undefined,
        templateId: selectedTemplate?.id || undefined,
      };

      // Set dateAchieved if status is 'achieved' and it wasn't already set
      if (formData.status === 'achieved') {
        if (editingGoal && !editingGoal.dateAchieved) {
          // Goal is being marked as achieved for the first time
          goalData.dateAchieved = new Date().toISOString();
        } else if (!editingGoal) {
          // New goal created as achieved
          goalData.dateAchieved = new Date().toISOString();
        } else {
          // Goal already has dateAchieved, preserve it
          goalData.dateAchieved = editingGoal.dateAchieved;
        }
      } else if (editingGoal && editingGoal.dateAchieved) {
        // If status changed from achieved to something else, preserve the dateAchieved
        goalData.dateAchieved = editingGoal.dateAchieved;
      }

      if (editingGoal) {
        await updateGoal(editingGoal.id, goalData);
        
        // If this goal now has a parent, update parent's subGoalIds
        if (goalData.parentGoalId) {
          const allGoals = await getGoals();
          const parent = allGoals.find(g => g.id === goalData.parentGoalId);
          if (parent) {
            const subGoalIds = parent.subGoalIds || [];
            if (!subGoalIds.includes(editingGoal.id)) {
              await updateGoal(parent.id, { subGoalIds: [...subGoalIds, editingGoal.id] });
            }
          }
        }
      } else {
        const newGoal: Goal = {
          id: generateId(),
          studentId: id,
          description: formData.description,
          baseline: formData.baseline,
          target: formData.target,
          status: formData.status,
          dateCreated: new Date().toISOString(),
          dateAchieved: formData.status === 'achieved' ? new Date().toISOString() : undefined,
          domain: formData.domain || undefined,
          priority: formData.priority,
          parentGoalId: formData.parentGoalId || undefined,
          templateId: selectedTemplate?.id || undefined,
        };
        await addGoal(newGoal);
        
        // If this is a sub-goal, update parent's subGoalIds
        if (newGoal.parentGoalId) {
          const allGoals = await getGoals();
          const parent = allGoals.find(g => g.id === newGoal.parentGoalId);
          if (parent) {
            const subGoalIds = parent.subGoalIds || [];
            await updateGoal(parent.id, { subGoalIds: [...subGoalIds, newGoal.id] });
          }
        }
      }
      await loadGoals();
      await loadSessions(); // Reload sessions after goal changes
      resetDirty();
      setDialogOpen(false);
      setEditingGoal(null);
    } catch (error) {
      console.error('Failed to save goal:', error);
      alert('Failed to save goal. Please try again.');
    }
  };

  const handleUseTemplate = (template: typeof goalTemplates[0]) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      description: template.description,
      baseline: template.suggestedBaseline || '',
      target: template.suggestedTarget || '',
      domain: template.domain,
    });
    setTemplateDialogOpen(false);
  };

  const handleDelete = async (goalId: string) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      try {
        await deleteGoal(goalId);
        await loadGoals();
        await loadSessions(); // Reload sessions after goal deletion
      } catch (error) {
        console.error('Failed to delete goal:', error);
        alert('Failed to delete goal. Please try again.');
      }
    }
  };

  const handleDuplicateSubGoal = (subGoal: Goal) => {
    // Duplicate the sub-goal by pre-filling the form with its data
    // This opens the dialog as a new goal (not editing), so user can edit before saving
    const newFormData = {
      description: subGoal.description,
      baseline: subGoal.baseline,
      target: subGoal.target,
      status: subGoal.status as 'in-progress' | 'achieved' | 'modified',
      domain: subGoal.domain || '',
      priority: subGoal.priority || 'medium',
      parentGoalId: subGoal.parentGoalId || '', // Keep the same parent
    };
    setFormData(newFormData);
    setInitialFormData(newFormData);
    setEditingGoal(null); // Set to null so it's treated as a new goal
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  const handleCopyMainGoalToSubGoal = (mainGoal: Goal) => {
    // Copy the main goal by pre-filling the form with its data
    // This opens the dialog as a new sub-goal (with the main goal as parent)
    const newFormData = {
      description: mainGoal.description,
      baseline: mainGoal.baseline,
      target: mainGoal.target,
      status: mainGoal.status as 'in-progress' | 'achieved' | 'modified',
      domain: mainGoal.domain || '',
      priority: mainGoal.priority || 'medium',
      parentGoalId: mainGoal.id, // Set the main goal as the parent
    };
    setFormData(newFormData);
    setInitialFormData(newFormData);
    setEditingGoal(null); // Set to null so it's treated as a new goal
    setSelectedTemplate(null);
    setDialogOpen(true);
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
      const studentSessions = id ? await getSessionsByStudent(id, selectedSchool) : [];
      const goalProgressData: GoalProgressData[] = goals.map(goal => {
        const goalSessions = studentSessions.filter(s => s.goalsTargeted.includes(goal.id));
        const latestPerf = goalSessions
          .flatMap(s => s.performanceData.filter(p => p.goalId === goal.id))
          .filter(p => p.accuracy !== undefined)
          .sort((a, b) => {
            const dateA = studentSessions.find(s => s.performanceData.includes(a))?.date || '';
            const dateB = studentSessions.find(s => s.performanceData.includes(b))?.date || '';
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

      const recentSessions = studentSessions.slice(0, 5).map(s => ({
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
          (() => {
            // Organize goals: main goals first, then sub-goals grouped under parents
            const mainGoals = goals.filter(g => !g.parentGoalId);
            const subGoals = goals.filter(g => g.parentGoalId);
            const subGoalsByParent = new Map<string, Goal[]>();
            subGoals.forEach(sub => {
              const parentId = sub.parentGoalId!;
              if (!subGoalsByParent.has(parentId)) {
                subGoalsByParent.set(parentId, []);
              }
              subGoalsByParent.get(parentId)!.push(sub);
            });

            // Group main goals by domain for better organization
            const goalsByDomain = new Map<string, Goal[]>();
            const goalsWithoutDomain: Goal[] = [];
            mainGoals.forEach(goal => {
              if (goal.domain) {
                if (!goalsByDomain.has(goal.domain)) {
                  goalsByDomain.set(goal.domain, []);
                }
                goalsByDomain.get(goal.domain)!.push(goal);
              } else {
                goalsWithoutDomain.push(goal);
              }
            });

            return (
              <>
                {Array.from(goalsByDomain.entries()).map(([domain, domainGoals]) => (
                  <Grid item xs={12} key={domain}>
                    <Typography variant="h6" sx={{ mb: 1, mt: 1 }}>
                      {domain}
                    </Typography>
                    <Grid container spacing={2}>
                      {domainGoals.map((goal) => {
                        const subs = subGoalsByParent.get(goal.id) || [];
                        return (
                          <React.Fragment key={goal.id}>
                            <Grid item xs={12} md={6}>
                              <Card sx={{ borderLeft: `4px solid ${goal.priority === 'high' ? '#f44336' : goal.priority === 'medium' ? '#ff9800' : '#4caf50'}` }}>
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
                                      <Tooltip title="Copy to sub goal">
                                        <IconButton
                                          size="small"
                                          onClick={() => handleCopyMainGoalToSubGoal(goal)}
                                        >
                                          <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDelete(goal.id)}
                                        color="error"
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                                    <Chip
                                      label={goal.status}
                                      size="small"
                                      color={
                                        goal.status === 'achieved'
                                          ? 'success'
                                          : goal.status === 'modified' || goal.status === 'in-progress'
                                          ? 'warning'
                                          : 'default'
                                      }
                                    />
                                    {(() => {
                                      const recent = getRecentPerformance(goal.id);
                                      const chipProps = getGoalProgressChipProps(recent.average, goal.target);
                                      return (
                                        <Chip
                                          label={recent.average !== null ? `${Math.round(recent.average)}%` : 'not started'}
                                          size="small"
                                          color={chipProps.color}
                                          variant={chipProps.variant}
                                        />
                                      );
                                    })()}
                                    {goal.priority && (
                                      <Chip
                                        label={goal.priority}
                                        size="small"
                                        color={goal.priority === 'high' ? 'error' : goal.priority === 'medium' ? 'warning' : 'success'}
                                        variant="outlined"
                                      />
                                    )}
                                    {goal.domain && (
                                      <Chip
                                        label={goal.domain}
                                        size="small"
                                        variant="outlined"
                                      />
                                    )}
                                  </Box>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Baseline: {goal.baseline}
                                  </Typography>
                                  {(() => {
                                    const recent = getRecentPerformance(goal.id);
                                    if (recent.recentSessions.length > 0) {
                                      return (
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                          Recent: {recent.average !== null 
                                            ? `${Math.round(recent.average)}% (avg of ${recent.recentSessions.length} sessions)`
                                            : recent.recentSessions.map(s => `${Math.round(s.accuracy || 0)}%`).join(', ')
                                          }
                                        </Typography>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Target: {goal.target}
                                  </Typography>
                                  {subs.length > 0 && (
                                    <Box sx={{ mt: 2, pl: 2, borderLeft: '2px solid #e0e0e0' }}>
                                      <Typography variant="subtitle2" gutterBottom>
                                        Sub-goals ({subs.length}):
                                      </Typography>
                                      {subs.map(sub => {
                                        const subRecent = getRecentPerformance(sub.id);
                                        return (
                                          <Box key={sub.id} sx={{ mb: 1 }}>
                                            <Typography variant="body2">{sub.description}</Typography>
                                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                              <Chip 
                                                label={sub.status} 
                                                size="small"
                                                color={
                                                  sub.status === 'achieved'
                                                    ? 'success'
                                                    : sub.status === 'modified' || sub.status === 'in-progress'
                                                    ? 'warning'
                                                    : 'default'
                                                }
                                              />
                                              {(() => {
                                                const subChipProps = getGoalProgressChipProps(subRecent.average, sub.target);
                                                return (
                                                  <Chip
                                                    label={subRecent.average !== null ? `${Math.round(subRecent.average)}%` : 'not started'}
                                                    size="small"
                                                    color={subChipProps.color}
                                                    variant={subChipProps.variant}
                                                  />
                                                );
                                              })()}
                                              {sub.priority && (
                                                <Chip
                                                  label={sub.priority}
                                                  size="small"
                                                  color={sub.priority === 'high' ? 'error' : sub.priority === 'medium' ? 'warning' : 'success'}
                                                  variant="outlined"
                                                />
                                              )}
                                              <IconButton
                                                size="small"
                                                onClick={() => handleOpenDialog(sub)}
                                                title="Edit sub-goal"
                                              >
                                                <EditIcon fontSize="small" />
                                              </IconButton>
                                              <IconButton
                                                size="small"
                                                onClick={() => handleDuplicateSubGoal(sub)}
                                                title="Duplicate sub-goal"
                                              >
                                                <ContentCopyIcon fontSize="small" />
                                              </IconButton>
                                            </Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                              Created: {formatDate(sub.dateCreated)}
                                              {sub.status === 'achieved' && sub.dateAchieved && (
                                                <>
                                                  <br />
                                                  Achieved: {formatDate(sub.dateAchieved)}
                                                </>
                                              )}
                                            </Typography>
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  )}
                                  <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => handleOpenDialog(undefined, goal.id)}
                                    sx={{ mt: 1 }}
                                  >
                                    Add Sub-goal
                                  </Button>
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    Created: {formatDate(goal.dateCreated)}
                                    {goal.status === 'achieved' && goal.dateAchieved && (
                                      <>
                                        <br />
                                        Achieved: {formatDate(goal.dateAchieved)}
                                      </>
                                    )}
                                  </Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                          </React.Fragment>
                        );
                      })}
                    </Grid>
                  </Grid>
                ))}
                {goalsWithoutDomain.length > 0 && (
                  <Grid item xs={12}>
                    {goalsByDomain.size > 0 && (
                      <Typography variant="h6" sx={{ mb: 1, mt: 1 }}>
                        Other Goals
                      </Typography>
                    )}
                    <Grid container spacing={2}>
                      {goalsWithoutDomain.map((goal) => {
                        const subs = subGoalsByParent.get(goal.id) || [];
                        return (
                          <Grid item xs={12} md={6} key={goal.id}>
                            <Card sx={{ borderLeft: `4px solid ${goal.priority === 'high' ? '#f44336' : goal.priority === 'medium' ? '#ff9800' : '#4caf50'}` }}>
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
                                    <Tooltip title="Copy to sub goal">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleCopyMainGoalToSubGoal(goal)}
                                      >
                                        <ContentCopyIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDelete(goal.id)}
                                      color="error"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
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
                                  {(() => {
                                    const recent = getRecentPerformance(goal.id);
                                    const chipProps = getGoalProgressChipProps(recent.average, goal.target);
                                    return (
                                      <Chip
                                        label={recent.average !== null ? `${Math.round(recent.average)}%` : 'not started'}
                                        size="small"
                                        color={chipProps.color}
                                        variant={chipProps.variant}
                                      />
                                    );
                                  })()}
                                  {goal.priority && (
                                    <Chip
                                      label={goal.priority}
                                      size="small"
                                      color={goal.priority === 'high' ? 'error' : goal.priority === 'medium' ? 'warning' : 'success'}
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Baseline: {goal.baseline}
                                </Typography>
                                {(() => {
                                  const recent = getRecentPerformance(goal.id);
                                  if (recent.recentSessions.length > 0) {
                                    return (
                                      <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Recent: {recent.average !== null 
                                          ? `${Math.round(recent.average)}% (avg of ${recent.recentSessions.length} sessions)`
                                          : recent.recentSessions.map(s => `${Math.round(s.accuracy || 0)}%`).join(', ')
                                        }
                                      </Typography>
                                    );
                                  }
                                  return null;
                                })()}
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Target: {goal.target}
                                </Typography>
                                {subs.length > 0 && (
                                  <Box sx={{ mt: 2, pl: 2, borderLeft: '2px solid #e0e0e0' }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      Sub-goals ({subs.length}):
                                    </Typography>
                                    {subs.map(sub => {
                                      const subRecent = getRecentPerformance(sub.id);
                                      return (
                                        <Box key={sub.id} sx={{ mb: 1 }}>
                                          <Typography variant="body2">{sub.description}</Typography>
                                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                            <Chip 
                                              label={sub.status} 
                                              size="small"
                                              color={
                                                sub.status === 'achieved'
                                                  ? 'success'
                                                  : sub.status === 'modified' || sub.status === 'in-progress'
                                                  ? 'warning'
                                                  : 'default'
                                              }
                                            />
                                            {(() => {
                                              const subChipProps = getGoalProgressChipProps(subRecent.average, sub.target);
                                              return (
                                                <Chip
                                                  label={subRecent.average !== null ? `${Math.round(subRecent.average)}%` : 'not started'}
                                                  size="small"
                                                  color={subChipProps.color}
                                                  variant={subChipProps.variant}
                                                />
                                              );
                                            })()}
                                            {sub.priority && (
                                              <Chip
                                                label={sub.priority}
                                                size="small"
                                                color={sub.priority === 'high' ? 'error' : sub.priority === 'medium' ? 'warning' : 'success'}
                                                variant="outlined"
                                              />
                                            )}
                                            <IconButton
                                              size="small"
                                              onClick={() => handleOpenDialog(sub)}
                                              title="Edit sub-goal"
                                            >
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleDuplicateSubGoal(sub)}
                                              title="Duplicate sub-goal"
                                            >
                                              <ContentCopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                            Created: {formatDate(sub.dateCreated)}
                                            {sub.status === 'achieved' && sub.dateAchieved && (
                                              <>
                                                <br />
                                                Achieved: {formatDate(sub.dateAchieved)}
                                              </>
                                            )}
                                          </Typography>
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                )}
                                <Button
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => handleOpenDialog(undefined, goal.id)}
                                  sx={{ mt: 1 }}
                                >
                                  Add Sub-goal
                                </Button>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                  Created: {formatDate(goal.dateCreated)}
                                  {goal.status === 'achieved' && goal.dateAchieved && (
                                    <>
                                      <br />
                                      Achieved: {formatDate(goal.dateAchieved)}
                                    </>
                                  )}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Grid>
                )}
              </>
            );
          })()
        )}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingGoal 
            ? 'Edit Goal' 
            : formData.parentGoalId 
            ? 'Adding New Subgoal' 
            : 'Add New Goal'}
        </DialogTitle>
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
            {selectedTemplate && (
              <Alert severity="info">
                Using template: <strong>{selectedTemplate.title}</strong>
              </Alert>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Domain"
                fullWidth
                select
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                InputLabelProps={{
                  shrink: true,
                }}
                SelectProps={{ native: true }}
              >
                <option value="">None</option>
                {getUniqueDomains().map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </TextField>
              <TextField
                label="Priority"
                fullWidth
                select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'high' | 'medium' | 'low' })}
                InputLabelProps={{
                  shrink: true,
                }}
                SelectProps={{ native: true }}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </TextField>
            </Box>
            {!editingGoal && (() => {
              const mainGoals = goals.filter(g => !g.parentGoalId) as Goal[];
              return (
                <TextField
                  label="Parent Goal"
                  fullWidth
                  select
                  value={formData.parentGoalId}
                  onChange={(e) => setFormData({ ...formData, parentGoalId: e.target.value })}
                  helperText="Optional - for sub-goals"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  SelectProps={{ native: true }}
                >
                  <option value="">None (Main Goal)</option>
                  {mainGoals.map(goal => (
                    <option key={goal.id} value={goal.id}>{goal.description}</option>
                  ))}
                </TextField>
              );
            })()}
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
                    bgcolor: 'background.paper',
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
                    bgcolor: 'background.paper',
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

      {/* Goal Template Selection Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Goal Templates</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Filter by Domain</InputLabel>
              <Select
                value={templateFilterDomain}
                onChange={(e) => {
                  setTemplateFilterDomain(e.target.value);
                  setShowRecommendedTemplates(false);
                }}
                label="Filter by Domain"
              >
                <MenuItem value="">All Domains</MenuItem>
                {getUniqueDomains().map(domain => (
                  <MenuItem key={domain} value={domain}>{domain}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {showRecommendedTemplates && student && student.concerns.length > 0 && getRecommendedTemplates().length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Recommended for {student?.name} ({student?.concerns.join(', ')})
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {getRecommendedTemplates().slice(0, 4).map((template) => (
                    <Grid item xs={12} sm={6} key={template.id}>
                      <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {template.title}
                          </Typography>
                          <Chip label={template.domain} size="small" sx={{ mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {template.description}
                          </Typography>
                          {template.suggestedBaseline && (
                            <Typography variant="caption" display="block">
                              Baseline: {template.suggestedBaseline}
                            </Typography>
                          )}
                          {template.suggestedTarget && (
                            <Typography variant="caption" display="block">
                              Target: {template.suggestedTarget}
                            </Typography>
                          )}
                        </CardContent>
                        <CardActions>
                          <Button size="small" onClick={() => handleUseTemplate(template)}>
                            Use Template
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Divider sx={{ my: 2 }} />
              </Box>
            )}
            <Typography variant="h6" gutterBottom>
              {templateFilterDomain ? `${templateFilterDomain} Templates` : 'All Templates'}
            </Typography>
            <Grid container spacing={2}>
              {(templateFilterDomain
                ? getGoalTemplatesByDomain(templateFilterDomain)
                : goalTemplates
              ).map((template) => (
                <Grid item xs={12} sm={6} key={template.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {template.title}
                      </Typography>
                      <Chip label={template.domain} size="small" sx={{ mb: 1 }} />
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {template.description}
                      </Typography>
                      {template.suggestedBaseline && (
                        <Typography variant="caption" display="block">
                          Baseline: {template.suggestedBaseline}
                        </Typography>
                      )}
                      {template.suggestedTarget && (
                        <Typography variant="caption" display="block">
                          Target: {template.suggestedTarget}
                        </Typography>
                      )}
                    </CardContent>
                    <CardActions>
                      <Button size="small" onClick={() => handleUseTemplate(template)}>
                        Use Template
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation dialog for unsaved changes */}
      <ConfirmDialog />

      {/* Navigation blocker confirmation */}
      {blocker.state === 'blocked' && (
        <Dialog open={true} onClose={() => blocker.reset?.()}>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogContent>
            <Typography>
              You have unsaved changes to this goal. Are you sure you want to leave?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => blocker.reset?.()}>Cancel</Button>
            <Button
              onClick={() => {
                resetDirty();
                blocker.proceed?.();
              }}
              variant="contained"
              color="primary"
            >
              Discard Changes
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

