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
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Psychology as PsychologyIcon,
  School as SchoolIcon,
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
import { generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm } from '../hooks/useConfirm';
import { useDirty } from '../hooks/useDirty';
import {
  generateGoalSuggestions,
  generateTreatmentRecommendations,
  generateIEPGoals,
  type GoalProgressData,
} from '../utils/gemini';
import { goalTemplates } from '../utils/goalTemplates';
import { GoalCard } from '../components/GoalCard';
import { GoalFormDialog } from '../components/GoalFormDialog';
import { GoalSuggestionsDialog } from '../components/GoalSuggestionsDialog';
import { TreatmentRecommendationsDialog } from '../components/TreatmentRecommendationsDialog';
import { IEPGoalsDialog } from '../components/IEPGoalsDialog';
import { GoalTemplateDialog } from '../components/GoalTemplateDialog';

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
                          <Grid item xs={12} md={6} key={goal.id}>
                            <GoalCard
                              goal={goal}
                              subGoals={subs}
                              getRecentPerformance={getRecentPerformance}
                              onEdit={handleOpenDialog}
                              onDelete={handleDelete}
                              onCopyToSubGoal={handleCopyMainGoalToSubGoal}
                              onAddSubGoal={(parentId) => handleOpenDialog(undefined, parentId)}
                              onEditSubGoal={handleOpenDialog}
                              onDuplicateSubGoal={handleDuplicateSubGoal}
                            />
                          </Grid>
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
                            <GoalCard
                              goal={goal}
                              subGoals={subs}
                              getRecentPerformance={getRecentPerformance}
                              onEdit={handleOpenDialog}
                              onDelete={handleDelete}
                              onCopyToSubGoal={handleCopyMainGoalToSubGoal}
                              onAddSubGoal={(parentId) => handleOpenDialog(undefined, parentId)}
                              onEditSubGoal={handleOpenDialog}
                              onDuplicateSubGoal={handleDuplicateSubGoal}
                            />
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

      <GoalFormDialog
        open={dialogOpen}
        editingGoal={editingGoal}
        formData={formData}
        mainGoals={goals.filter(g => !g.parentGoalId)}
        selectedTemplate={selectedTemplate}
        onClose={handleCloseDialog}
        onSave={handleSave}
        onFormDataChange={(data) => setFormData({ ...formData, ...data })}
        onOpenGoalSuggestions={() => {
          setGoalArea(formData.description || '');
          setGoalSuggestions('');
          setGoalSuggestionsError('');
          setGoalSuggestionsDialogOpen(true);
        }}
      />

      <GoalSuggestionsDialog
        open={goalSuggestionsDialogOpen}
        goalArea={goalArea}
        goalSuggestions={goalSuggestions}
        loading={loadingGoalSuggestions}
        error={goalSuggestionsError}
        onClose={() => setGoalSuggestionsDialogOpen(false)}
        onGoalAreaChange={setGoalArea}
        onGenerate={handleGenerateGoalSuggestions}
      />

      <TreatmentRecommendationsDialog
        open={treatmentRecsDialogOpen}
        recommendations={treatmentRecommendations}
        loading={loadingTreatmentRecs}
        error={treatmentRecsError}
        onClose={() => setTreatmentRecsDialogOpen(false)}
      />

      <IEPGoalsDialog
        open={iepGoalsDialogOpen}
        assessmentData={assessmentData}
        iepGoals={iepGoals}
        loading={loadingIepGoals}
        error={iepGoalsError}
        onClose={() => setIepGoalsDialogOpen(false)}
        onAssessmentDataChange={setAssessmentData}
        onGenerate={handleGenerateIEPGoals}
      />

      <GoalTemplateDialog
        open={templateDialogOpen}
        student={student}
        filterDomain={templateFilterDomain}
        showRecommendedTemplates={showRecommendedTemplates}
        onClose={() => setTemplateDialogOpen(false)}
        onFilterDomainChange={setTemplateFilterDomain}
        onShowRecommendedTemplatesChange={setShowRecommendedTemplates}
        onUseTemplate={handleUseTemplate}
      />

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

