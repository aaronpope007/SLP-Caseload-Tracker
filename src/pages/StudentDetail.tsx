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
import { StudentInfoCard } from '../components/StudentInfoCard';
import { GoalActionsBar } from '../components/GoalActionsBar';
import { GoalsList } from '../components/GoalsList';
import { CopySubtreeDialog } from '../components/CopySubtreeDialog';
import { QuickGoalsDialog } from '../components/QuickGoalsDialog';
import { copyGoalSubtree } from '../utils/goalSubtreeCopy';

export const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Copy subtree dialog state
  const [copySubtreeDialogOpen, setCopySubtreeDialogOpen] = useState(false);
  const [goalToCopySubtree, setGoalToCopySubtree] = useState<Goal | null>(null);

  // Quick goals dialog state
  const [quickGoalsDialogOpen, setQuickGoalsDialogOpen] = useState(false);
  const [quickSubGoalParentId, setQuickSubGoalParentId] = useState<string | undefined>(undefined);
  const [quickSubGoalParentDomain, setQuickSubGoalParentDomain] = useState<string | undefined>(undefined);
  const [quickSubGoalParentTarget, setQuickSubGoalParentTarget] = useState<string | undefined>(undefined);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
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
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedSchool]);

  // Check for addGoal query parameter and open dialog
  useEffect(() => {
    const addGoalParam = searchParams.get('addGoal');
    if (addGoalParam === 'true' && student && goals.length === 0 && !dialogOpen) {
      // Open the add goal dialog
      setEditingGoal(null);
      setFormData({
        description: '',
        baseline: '',
        target: '',
        status: 'in-progress',
        domain: '',
        priority: 'medium',
        parentGoalId: '',
      });
      setInitialFormData({
        description: '',
        baseline: '',
        target: '',
        status: 'in-progress',
        domain: '',
        priority: 'medium',
        parentGoalId: '',
      });
      setSelectedTemplate(null);
      setDialogOpen(true);
      // Remove the query parameter from URL
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, student, goals.length, dialogOpen, setSearchParams]);

  // Check for goalId query parameter and open edit dialog for that goal
  useEffect(() => {
    const goalIdParam = searchParams.get('goalId');
    if (goalIdParam && student && goals.length > 0 && !dialogOpen) {
      const goalToEdit = goals.find(g => g.id === goalIdParam);
      if (goalToEdit) {
        // Open the edit goal dialog
        setEditingGoal(goalToEdit);
        setFormData({
          description: goalToEdit.description,
          baseline: goalToEdit.baseline,
          target: goalToEdit.target,
          status: goalToEdit.status,
          domain: goalToEdit.domain || '',
          priority: goalToEdit.priority || 'medium',
          parentGoalId: goalToEdit.parentGoalId || '',
        });
        setInitialFormData({
          description: goalToEdit.description,
          baseline: goalToEdit.baseline,
          target: goalToEdit.target,
          status: goalToEdit.status,
          domain: goalToEdit.domain || '',
          priority: goalToEdit.priority || 'medium',
          parentGoalId: goalToEdit.parentGoalId || '',
        });
        setSelectedTemplate(null);
        setDialogOpen(true);
        // Remove the query parameter from URL
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, student, goals.length, dialogOpen, setSearchParams, goals]);


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
      // If creating a sub-goal, inherit domain, priority, and target (accuracy) from parent
      let inheritedDomain = '';
      let inheritedPriority: 'high' | 'medium' | 'low' = 'medium';
      let inheritedTarget = '';
      if (parentGoalId) {
        const parentGoal = goals.find(g => g.id === parentGoalId);
        if (parentGoal) {
          inheritedDomain = parentGoal.domain || '';
          inheritedPriority = parentGoal.priority || 'medium';
          inheritedTarget = parentGoal.target || '';
        }
      }
      newFormData = {
        description: '',
        baseline: '',
        target: inheritedTarget,
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
        setSnackbar({
          open: true,
          message: 'Goal updated successfully',
          severity: 'success',
        });
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
        setSnackbar({
          open: true,
          message: 'Goal created successfully',
          severity: 'success',
        });
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

  const handleDelete = (goalId: string) => {
    confirm({
      title: 'Delete Goal',
      message: 'Are you sure you want to delete this goal? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteGoal(goalId);
          await loadGoals();
          await loadSessions(); // Reload sessions after goal deletion
          setSnackbar({
            open: true,
            message: 'Goal deleted successfully',
            severity: 'success',
          });
        } catch (error) {
          console.error('Failed to delete goal:', error);
          alert('Failed to delete goal. Please try again.');
        }
      },
    });
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

  const handleCopySubtree = (goal: Goal) => {
    setGoalToCopySubtree(goal);
    setCopySubtreeDialogOpen(true);
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
          await addGoal(newGoal);
        } catch (error) {
          console.error(`Failed to add goal ${newGoal.id}:`, error);
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
              await updateGoal(parent.id, { subGoalIds: updatedSubGoalIds });
            } catch (error) {
              console.error(`Failed to update parent goal ${parent.id}:`, error);
              throw new Error(`Failed to update parent goal: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }

      // Reload goals to show the new subtree
      await loadGoals();
      await loadSessions();
      
      setCopySubtreeDialogOpen(false);
      setGoalToCopySubtree(null);
      
      // Show success message
      setSnackbar({
        open: true,
        message: `Successfully copied ${newGoals.length} goal(s) with replacements applied.`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to copy subtree:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to copy subtree: ${errorMessage}. Please check the console for more details.`);
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
        onQuickGoal={() => setQuickGoalsDialogOpen(true)}
        onGenerateIEPGoals={() => {
          setAssessmentData('');
          setIepGoals('');
          setIepGoalsDialogOpen(true);
        }}
        onGenerateTreatmentRecommendations={() => {
          setTreatmentRecommendations('');
          handleGenerateTreatmentRecommendations();
          setTreatmentRecsDialogOpen(true);
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
            setQuickGoalsDialogOpen(true);
          }}
          onEditSubGoal={handleOpenDialog}
          onDuplicateSubGoal={handleDuplicateSubGoal}
          onCopySubtree={handleCopySubtree}
        />
      </Grid>

      <GoalFormDialog
        open={dialogOpen}
        editingGoal={editingGoal}
        formData={formData}
        allGoals={goals}
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

      <CopySubtreeDialog
        open={copySubtreeDialogOpen}
        goal={goalToCopySubtree}
        onClose={() => {
          setCopySubtreeDialogOpen(false);
          setGoalToCopySubtree(null);
        }}
        onConfirm={handleConfirmCopySubtree}
      />

      <QuickGoalsDialog
        open={quickGoalsDialogOpen}
        studentId={id || ''}
        parentGoalId={quickSubGoalParentId}
        parentGoalDomain={quickSubGoalParentDomain}
        parentGoalTarget={quickSubGoalParentTarget}
        onClose={() => {
          setQuickGoalsDialogOpen(false);
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
                await addGoal(goal);
              } catch (error) {
                console.error(`Failed to add goal ${goal.id}:`, error);
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
                    await updateGoal(parent.id, { subGoalIds: updatedSubGoalIds });
                  } catch (error) {
                    console.error(`Failed to update parent goal ${parent.id}:`, error);
                    throw new Error(`Failed to update parent goal: ${error instanceof Error ? error.message : String(error)}`);
                  }
                }
              }
            }

            // Reload goals to show the new goals
            await loadGoals();
            await loadSessions();

            setSnackbar({
              open: true,
              message: `Successfully created ${newGoals.length} goal(s).`,
              severity: 'success',
            });
          } catch (error) {
            console.error('Failed to create quick goals:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Failed to create quick goals: ${errorMessage}. Please check the console for more details.`);
            throw error; // Re-throw so dialog can handle it
          }
        }}
      />

      {/* Confirmation dialog for unsaved changes */}
      <ConfirmDialog />

      {/* Snackbar for notifications */}
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

