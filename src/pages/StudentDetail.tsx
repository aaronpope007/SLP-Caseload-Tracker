import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Snackbar,
  Alert,
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
  getSessionsByStudent,
  getGoals,
} from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useGoalManagement, useGoalForm, useAIFeatures, useDialog } from '../hooks';
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
import { StudentInfoCard } from '../components/StudentInfoCard';
import { GoalActionsBar } from '../components/GoalActionsBar';
import { GoalsList } from '../components/GoalsList';
import { CopySubtreeDialog } from '../components/CopySubtreeDialog';
import { QuickGoalsDialog } from '../components/QuickGoalsDialog';
import { copyGoalSubtree } from '../utils/goalSubtreeCopy';
import { logError } from '../utils/logger';

export const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedSchool } = useSchool();
  const [student, setStudent] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  
  // Goal management hook
  const {
    goals,
    loadGoals,
    createGoal,
    updateGoal: updateGoalById,
    deleteGoal: removeGoal,
  } = useGoalManagement({
    studentId: id || '',
    school: selectedSchool,
  });

  // Goal form hook
  const {
    formData,
    editingGoal,
    isDirty,
    initializeForm,
    updateFormField,
    resetForm,
  } = useGoalForm();

  // Dialog management
  const goalFormDialog = useDialog();
  const templateDialog = useDialog();
  const copySubtreeDialog = useDialog();
  const quickGoalsDialog = useDialog();
  const goalSuggestionsDialog = useDialog();
  const treatmentRecsDialog = useDialog();
  const iepGoalsDialog = useDialog();

  // Use dirty hook to block navigation
  const { blocker, reset: resetDirty } = useDirty({
    isDirty: goalFormDialog.open && isDirty(),
    message: 'You have unsaved changes to this goal. Are you sure you want to leave?',
  });
  
  // Goal template selection
  const [selectedTemplate, setSelectedTemplate] = useState<typeof goalTemplates[0] | null>(null);
  const [templateFilterDomain, setTemplateFilterDomain] = useState<string>('');
  const [showRecommendedTemplates, setShowRecommendedTemplates] = useState(true);

  // Copy subtree dialog state
  const [goalToCopySubtree, setGoalToCopySubtree] = useState<Goal | null>(null);

  // Quick goals dialog state
  const [quickSubGoalParentId, setQuickSubGoalParentId] = useState<string | undefined>(undefined);
  const [quickSubGoalParentDomain, setQuickSubGoalParentDomain] = useState<string | undefined>(undefined);
  const [quickSubGoalParentTarget, setQuickSubGoalParentTarget] = useState<string | undefined>(undefined);

  // AI Features Hook
  const apiKey = localStorage.getItem('gemini_api_key') || '';
  const aiFeatures = useAIFeatures({
    apiKey,
    studentName: student?.name || '',
    studentAge: student?.age || 0,
    studentGrade: student?.grade || '',
  });

  useEffect(() => {
    if (id) {
      loadStudent();
      loadGoals();
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedSchool]);

  // Check for addGoal query parameter and open dialog
  useEffect(() => {
    const addGoalParam = searchParams.get('addGoal');
    if (addGoalParam === 'true' && student && goals.length === 0 && !goalFormDialog.open) {
      initializeForm();
      setSelectedTemplate(null);
      goalFormDialog.openDialog();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, student, goals.length, goalFormDialog.open, setSearchParams, initializeForm, goalFormDialog]);

  // Check for goalId query parameter and open edit dialog for that goal
  useEffect(() => {
    const goalIdParam = searchParams.get('goalId');
    if (goalIdParam && student && goals.length > 0 && !goalFormDialog.open) {
      const goalToEdit = goals.find(g => g.id === goalIdParam);
      if (goalToEdit) {
        initializeForm(goalToEdit);
        setSelectedTemplate(null);
        goalFormDialog.openDialog();
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, student, goals.length, goalFormDialog.open, setSearchParams, goals, initializeForm, goalFormDialog]);


  const loadStudent = async () => {
    if (id) {
      try {
        const students = await getStudents(selectedSchool);
        const found = students.find((s) => s.id === id);
        setStudent(found || null);
      } catch (error) {
        logError('Failed to load student', error);
      }
    }
  };

  // loadGoals is now provided by useGoalManagement hook

  const loadSessions = async () => {
    if (id) {
      try {
        const studentSessions = await getSessionsByStudent(id, selectedSchool);
        setSessions(studentSessions);
      } catch (error) {
        logError('Failed to load sessions', error);
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
    const parentGoal = parentGoalId ? goals.find(g => g.id === parentGoalId) : undefined;
    initializeForm(goal, parentGoal);
    setSelectedTemplate(null);
    goalFormDialog.openDialog();
  };

  const handleCloseDialog = () => {
    if (isDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes to this goal. Are you sure you want to close?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          goalFormDialog.closeDialog();
          resetForm();
          resetDirty();
        },
      });
    } else {
      goalFormDialog.closeDialog();
      resetForm();
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
        await updateGoalById(editingGoal.id, goalData);
        
        // If this goal now has a parent, update parent's subGoalIds
        if (goalData.parentGoalId) {
          const allGoals = await getGoals();
          const parent = allGoals.find(g => g.id === goalData.parentGoalId);
          if (parent) {
            const subGoalIds = parent.subGoalIds || [];
            if (!subGoalIds.includes(editingGoal.id)) {
              await updateGoalById(parent.id, { subGoalIds: [...subGoalIds, editingGoal.id] });
            }
          }
        }
        showSnackbar('Goal updated successfully', 'success');
      } else {
        const newGoal = await createGoal({
          ...goalData,
          studentId: id,
          dateCreated: new Date().toISOString(),
        } as Goal);
        
        // If this is a sub-goal, update parent's subGoalIds
        if (newGoal && newGoal.parentGoalId) {
          const allGoals = await getGoals();
          const parent = allGoals.find(g => g.id === newGoal.parentGoalId);
          if (parent) {
            const subGoalIds = parent.subGoalIds || [];
            await updateGoalById(parent.id, { subGoalIds: [...subGoalIds, newGoal.id] });
          }
        }
        showSnackbar('Goal created successfully', 'success');
      }
      await loadGoals();
      await loadSessions();
      resetDirty();
      goalFormDialog.closeDialog();
      resetForm();
    } catch (error) {
      logError('Failed to save goal', error);
      showSnackbar('Failed to save goal. Please try again.', 'error');
    }
  };

  const handleUseTemplate = (template: typeof goalTemplates[0]) => {
    setSelectedTemplate(template);
    updateFormField('description', template.description);
    updateFormField('baseline', template.suggestedBaseline || '');
    updateFormField('target', template.suggestedTarget || '');
    updateFormField('domain', template.domain);
    templateDialog.closeDialog();
  };

  const handleDelete = (goalId: string) => {
    confirm({
      title: 'Delete Goal',
      message: 'Are you sure you want to delete this goal? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await removeGoal(goalId);
          await loadGoals();
          await loadSessions();
          showSnackbar('Goal deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete goal', error);
          showSnackbar('Failed to delete goal. Please try again.', 'error');
        }
      },
    });
  };

  const handleDuplicateSubGoal = (subGoal: Goal) => {
    // Duplicate the sub-goal by pre-filling the form with its data
    const parentGoal = subGoal.parentGoalId ? goals.find(g => g.id === subGoal.parentGoalId) : undefined;
    initializeForm(undefined, parentGoal);
    // Override with subGoal data
    updateFormField('description', subGoal.description);
    updateFormField('baseline', subGoal.baseline);
    updateFormField('target', subGoal.target);
    updateFormField('status', subGoal.status as 'in-progress' | 'achieved' | 'modified');
    updateFormField('domain', subGoal.domain || '');
    updateFormField('priority', subGoal.priority || 'medium');
    setSelectedTemplate(null);
    goalFormDialog.openDialog();
  };

  const handleCopyMainGoalToSubGoal = (mainGoal: Goal) => {
    // Copy the main goal as a new sub-goal with the main goal as parent
    initializeForm(undefined, mainGoal);
    // Override with mainGoal data
    updateFormField('description', mainGoal.description);
    updateFormField('baseline', mainGoal.baseline);
    updateFormField('target', mainGoal.target);
    updateFormField('status', mainGoal.status as 'in-progress' | 'achieved' | 'modified');
    updateFormField('domain', mainGoal.domain || '');
    updateFormField('priority', mainGoal.priority || 'medium');
    updateFormField('parentGoalId', mainGoal.id);
    setSelectedTemplate(null);
    goalFormDialog.openDialog();
  };

  const handleCopySubtree = (goal: Goal) => {
    setGoalToCopySubtree(goal);
    copySubtreeDialog.openDialog();
  };

  const handleConfirmCopySubtree = async (replacements: Array<{ from: string; to: string }>) => {
    if (!goalToCopySubtree || !id) return;

    try {
      // Get all goals to pass to the copy function
      // We need all goals (not just for this student) to properly map parent relationships
      const allGoals = await getGoals();
      
      // Determine the parent for the copied subtree
      // If the goal being copied has a parent, the new subtree should have the same parent
      // Otherwise, it will be a top-level goal
      const newParentGoalId = goalToCopySubtree.parentGoalId;

      // Copy the subtree - use allGoals to ensure we can find all parent relationships
      const { newGoals } = await copyGoalSubtree(
        goalToCopySubtree,
        allGoals,
        replacements,
        newParentGoalId
      );

      if (newGoals.length === 0) {
        alert('No goals were created. The selected goal may not have any sub-goals to copy.');
        return;
      }

      // Ensure all new goals have the correct studentId
      for (const newGoal of newGoals) {
        newGoal.studentId = id;
      }

      // Save all new goals first
      for (const newGoal of newGoals) {
        try {
          await createGoal(newGoal);
        } catch (error) {
          logError(`Failed to add goal ${newGoal.id}`, error);
          throw new Error(`Failed to add goal: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Then update parent's subGoalIds for all new goals that have a parent
      // Group by parent to avoid multiple updates to the same parent
      const goalsByParent = new Map<string, string[]>();
      for (const newGoal of newGoals) {
        if (newGoal.parentGoalId) {
          if (!goalsByParent.has(newGoal.parentGoalId)) {
            goalsByParent.set(newGoal.parentGoalId, []);
          }
          goalsByParent.get(newGoal.parentGoalId)!.push(newGoal.id);
        }
      }

      // Update each parent's subGoalIds
      // Reload goals to get the latest parent data
      const updatedAllGoals = await getGoals();
      for (const [parentId, newSubGoalIds] of goalsByParent.entries()) {
        const parent = updatedAllGoals.find(g => g.id === parentId);
        if (parent) {
          const existingSubGoalIds = parent.subGoalIds || [];
          // Only add IDs that aren't already in the list
          const idsToAdd = newSubGoalIds.filter(id => !existingSubGoalIds.includes(id));
          if (idsToAdd.length > 0) {
            const updatedSubGoalIds = [...existingSubGoalIds, ...idsToAdd];
            try {
              await updateGoalById(parent.id, { subGoalIds: updatedSubGoalIds });
            } catch (error) {
              logError(`Failed to update parent goal ${parent.id}`, error);
              throw new Error(`Failed to update parent goal: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }

      // Reload goals to show the new subtree
      await loadGoals();
      await loadSessions();
      
      copySubtreeDialog.closeDialog();
      setGoalToCopySubtree(null);
      
      // Show success message
      showSnackbar(`Successfully copied ${newGoals.length} goal(s) with replacements applied.`, 'success');
    } catch (error) {
      logError('Failed to copy subtree', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to copy subtree: ${errorMessage}. Please check the console for more details.`);
    }
  };

  // AI Feature Handlers - now using useAIFeatures hook
  // Treatment recommendations need session data, so we'll handle it inline
  const handleGenerateTreatmentRecommendations = async () => {
    if (!apiKey) {
      aiFeatures.setTreatmentRecsError('Please set your Gemini API key in Settings');
      return;
    }

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

      await aiFeatures.generateTreatmentRecs(goalProgressData);
    } catch (err) {
      aiFeatures.setTreatmentRecsError(err instanceof Error ? err.message : 'Failed to generate treatment recommendations');
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

      <StudentInfoCard
        name={student.name}
        age={student.age}
        grade={student.grade}
        status={student.status}
        concerns={student.concerns}
        frequencyPerWeek={student.frequencyPerWeek}
        frequencyType={student.frequencyType}
      />

      <GoalActionsBar
        onAddGoal={() => handleOpenDialog()}
        onQuickGoal={() => quickGoalsDialog.openDialog()}
        onGenerateIEPGoals={() => {
          aiFeatures.setAssessmentData('');
          aiFeatures.setIepGoals('');
          iepGoalsDialog.openDialog();
        }}
        onGenerateTreatmentRecommendations={async () => {
          aiFeatures.setTreatmentRecommendations('');
          await handleGenerateTreatmentRecommendations();
          treatmentRecsDialog.openDialog();
        }}
        hasGoals={goals.length > 0}
      />

      <Grid container spacing={2}>
        <GoalsList
          goals={goals}
          getRecentPerformance={getRecentPerformance}
          onEdit={handleOpenDialog}
          onDelete={handleDelete}
          onCopyToSubGoal={handleCopyMainGoalToSubGoal}
          onAddSubGoal={(parentId) => handleOpenDialog(undefined, parentId)}
          onQuickSubGoal={(parentId) => {
            const parentGoal = goals.find(g => g.id === parentId);
            setQuickSubGoalParentId(parentId);
            setQuickSubGoalParentDomain(parentGoal?.domain);
            setQuickSubGoalParentTarget(parentGoal?.target);
            quickGoalsDialog.openDialog();
          }}
          onEditSubGoal={handleOpenDialog}
          onDuplicateSubGoal={handleDuplicateSubGoal}
          onCopySubtree={handleCopySubtree}
        />
      </Grid>

      <GoalFormDialog
        open={goalFormDialog.open}
        editingGoal={editingGoal}
        formData={formData}
        allGoals={goals}
        selectedTemplate={selectedTemplate}
        onClose={handleCloseDialog}
        onSave={handleSave}
        onFormDataChange={(data) => {
          Object.entries(data).forEach(([key, value]) => {
            updateFormField(key as keyof typeof formData, value);
          });
        }}
        onOpenGoalSuggestions={() => {
          aiFeatures.setGoalArea(formData.description || '');
          aiFeatures.setGoalSuggestions('');
          goalSuggestionsDialog.openDialog();
        }}
      />

      <GoalSuggestionsDialog
        open={goalSuggestionsDialog.open}
        goalArea={aiFeatures.goalArea}
        goalSuggestions={aiFeatures.goalSuggestions}
        loading={aiFeatures.loadingGoalSuggestions}
        error={aiFeatures.goalSuggestionsError}
        onClose={goalSuggestionsDialog.closeDialog}
        onGoalAreaChange={aiFeatures.setGoalArea}
        onGenerate={aiFeatures.generateSuggestions}
      />

      <TreatmentRecommendationsDialog
        open={treatmentRecsDialog.open}
        recommendations={aiFeatures.treatmentRecommendations}
        loading={aiFeatures.loadingTreatmentRecs}
        error={aiFeatures.treatmentRecsError}
        onClose={treatmentRecsDialog.closeDialog}
      />

      <IEPGoalsDialog
        open={iepGoalsDialog.open}
        assessmentData={aiFeatures.assessmentData}
        iepGoals={aiFeatures.iepGoals}
        loading={aiFeatures.loadingIepGoals}
        error={aiFeatures.iepGoalsError}
        onClose={iepGoalsDialog.closeDialog}
        onAssessmentDataChange={aiFeatures.setAssessmentData}
        onGenerate={aiFeatures.generateIEPGoalsFromAssessment}
      />

      <GoalTemplateDialog
        open={templateDialog.open}
        student={student}
        filterDomain={templateFilterDomain}
        showRecommendedTemplates={showRecommendedTemplates}
        onClose={templateDialog.closeDialog}
        onFilterDomainChange={setTemplateFilterDomain}
        onShowRecommendedTemplatesChange={setShowRecommendedTemplates}
        onUseTemplate={handleUseTemplate}
      />

      <CopySubtreeDialog
        open={copySubtreeDialog.open}
        goal={goalToCopySubtree}
        onClose={() => {
          copySubtreeDialog.closeDialog();
          setGoalToCopySubtree(null);
        }}
        onConfirm={handleConfirmCopySubtree}
      />

      <QuickGoalsDialog
        open={quickGoalsDialog.open}
        studentId={id || ''}
        parentGoalId={quickSubGoalParentId}
        parentGoalDomain={quickSubGoalParentDomain}
        parentGoalTarget={quickSubGoalParentTarget}
        onClose={() => {
          quickGoalsDialog.closeDialog();
          setQuickSubGoalParentId(undefined);
          setQuickSubGoalParentDomain(undefined);
          setQuickSubGoalParentTarget(undefined);
        }}
        onSave={async (newGoals: Goal[]) => {
          if (!id) return;

          try {
            // Ensure all goals have the correct studentId
            for (const goal of newGoals) {
              goal.studentId = id;
            }

            // Save all goals first (they're already in top-down order from the generator)
            for (const goal of newGoals) {
              try {
                await createGoal(goal);
              } catch (error) {
                logError(`Failed to add goal ${goal.id}`, error);
                throw new Error(`Failed to add goal: ${error instanceof Error ? error.message : String(error)}`);
              }
            }

            // Then update parent's subGoalIds for all goals that have a parent
            // Group by parent to avoid multiple updates to the same parent
            const goalsByParent = new Map<string, string[]>();
            for (const goal of newGoals) {
              if (goal.parentGoalId) {
                if (!goalsByParent.has(goal.parentGoalId)) {
                  goalsByParent.set(goal.parentGoalId, []);
                }
                goalsByParent.get(goal.parentGoalId)!.push(goal.id);
              }
            }

            // Update each parent's subGoalIds
            // Reload goals to get the latest parent data
            const updatedAllGoals = await getGoals();
            for (const [parentId, newSubGoalIds] of goalsByParent.entries()) {
              const parent = updatedAllGoals.find(g => g.id === parentId);
              if (parent) {
                const existingSubGoalIds = parent.subGoalIds || [];
                // Only add IDs that aren't already in the list
                const idsToAdd = newSubGoalIds.filter(id => !existingSubGoalIds.includes(id));
                if (idsToAdd.length > 0) {
                  const updatedSubGoalIds = [...existingSubGoalIds, ...idsToAdd];
                  try {
                    await updateGoalById(parent.id, { subGoalIds: updatedSubGoalIds });
                  } catch (error) {
                    logError(`Failed to update parent goal ${parent.id}`, error);
                    throw new Error(`Failed to update parent goal: ${error instanceof Error ? error.message : String(error)}`);
                  }
                }
              }
            }

            // Reload goals to show the new goals
            await loadGoals();
            await loadSessions();

            showSnackbar(`Successfully created ${newGoals.length} goal(s).`, 'success');
          } catch (error) {
            logError('Failed to create quick goals', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Failed to create quick goals: ${errorMessage}. Please check the console for more details.`);
            throw error; // Re-throw so dialog can handle it
          }
        }}
      />

      {/* Confirmation dialog for unsaved changes */}
      <ConfirmDialog />

      {/* Snackbar for notifications */}
      <SnackbarComponent />

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

