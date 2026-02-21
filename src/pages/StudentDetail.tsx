import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  EventNote as EventNoteIcon,
  Description as DescriptionIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Email as EmailIcon,
  OpenInNew as OpenInNewIcon,
  Archive as ArchiveIcon,
  ExpandMore as ExpandMoreIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import type { Student, Goal, Session, ReassessmentPlanItem } from '../types';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useGoalManagement, useGoalForm, useGoalTemplate, useGoalSubtree, useQuickGoals, useGoalSave, useGoalDialogHandlers, useGoalDelete, useTreatmentRecommendations, useAIFeatures, useDialog, useStudentData, useSessionData, usePerformanceHelpers, useGoalTemplateHandler, useGoalSubtreeHandler, useFormValidation } from '../hooks';
import { useDirty } from '../hooks/useDirty';
import { GoalFormDialog } from '../components/goal/GoalFormDialog';
import { GoalSuggestionsDialog } from '../components/goal/GoalSuggestionsDialog';
import { TreatmentRecommendationsDialog } from '../components/TreatmentRecommendationsDialog';
import { IEPGoalsDialog } from '../components/goal/IEPGoalsDialog';
import { GoalTemplateDialog } from '../components/goal/GoalTemplateDialog';
import { StudentInfoCard } from '../components/student/StudentInfoCard';
import { getIncompleteReassessmentItems, updateReassessmentPlanItem } from '../utils/storage-api';
import { formatDate } from '../utils/helpers';
import { GoalActionsBar } from '../components/goal/GoalActionsBar';
import { GoalsList } from '../components/goal/GoalsList';
import { CopySubtreeDialog } from '../components/goal/CopySubtreeDialog';
import { QuickGoalsDialog } from '../components/goal/QuickGoalsDialog';

export const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedSchool } = useSchool();
  const [student, setStudent] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [incompleteReassessmentItems, setIncompleteReassessmentItems] = useState<(ReassessmentPlanItem & { planTitle: string; planDueDate: string })[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { fieldErrors, clearError, handleApiError } = useFormValidation();
  
  // Track if component is mounted to prevent memory leaks
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Student data loading hook - must be declared early
  const { loadStudent } = useStudentData({
    studentId: id,
    selectedSchool,
    setStudent,
  });

  // Session data loading hook - must be declared early
  const { loadSessions } = useSessionData({
    studentId: id,
    selectedSchool,
    setSessions,
  });
  
  // Goal management hook
  const {
    goals,
    archivedGoals,
    loadGoals,
    loadArchivedGoals,
    createGoal,
    updateGoal: updateGoalById,
    deleteGoal: removeGoal,
    archiveGoals,
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
  
  // Wrapper for updateFormField to match useGoalTemplate's expected signature
  const updateFormFieldWrapper = useCallback((field: string, value: unknown) => {
    updateFormField(field as keyof typeof formData, value as typeof formData[keyof typeof formData]);
  }, [updateFormField]);

  // Goal template selection hook
  const goalTemplate = useGoalTemplate(updateFormFieldWrapper);

  // AI Features Hook - must be declared before useTreatmentRecommendations
  const apiKey = localStorage.getItem('gemini_api_key') || '';
  const aiFeatures = useAIFeatures({
    apiKey,
    studentName: student?.name || '',
    studentAge: student?.age || 0,
    studentGrade: student?.grade || '',
  });

  // Wrapper functions for goalSubtree to match expected types
  const createGoalWrapper = useCallback(async (goal: Goal): Promise<Goal> => {
    const result = await createGoal(goal);
    if (!result) {
      throw new Error('Failed to create goal');
    }
    return result;
  }, [createGoal]);

  const updateGoalWrapper = useCallback(async (goalId: string, updates: Partial<Goal>): Promise<void> => {
    await updateGoalById(goalId, updates);
  }, [updateGoalById]);

  // Copy subtree hook
  const goalSubtree = useGoalSubtree({
    studentId: id || '',
    createGoal: createGoalWrapper,
    updateGoal: updateGoalWrapper,
    loadGoals,
    loadSessions,
    showSnackbar,
  });

  // Quick goals hook
  const quickGoals = useQuickGoals({
    studentId: id || '',
    createGoal: createGoalWrapper,
    updateGoal: updateGoalWrapper,
    loadGoals,
    loadSessions,
    showSnackbar,
  });

  // Wrapper for updateFormField to match useGoalDialogHandlers' expected signature
  const updateFormFieldForHandlers = useCallback((field: string, value: unknown) => {
    updateFormField(field as keyof typeof formData, value as typeof formData[keyof typeof formData]);
  }, [updateFormField]);

  // Goal dialog handlers hook
  const goalDialogHandlers = useGoalDialogHandlers({
    goals,
    initializeForm,
    updateFormField: updateFormFieldForHandlers,
    clearTemplate: goalTemplate.clearTemplate,
    openDialog: goalFormDialog.openDialog,
    closeDialog: goalFormDialog.closeDialog,
    resetForm,
    resetDirty,
    isDirty,
    confirm,
  });

  // Goal save hook
  const { handleSave } = useGoalSave({
    studentId: id || '',
    formData,
    editingGoal,
    selectedTemplateId: goalTemplate.selectedTemplate?.id,
    createGoal,
    updateGoal: updateGoalWrapper,
    loadGoals,
    loadSessions,
    closeDialog: goalFormDialog.closeDialog,
    resetForm,
    resetDirty,
    showSnackbar,
    onValidationError: handleApiError,
  });

  // Goal delete hook
  const { handleDelete } = useGoalDelete({
    removeGoal,
    loadGoals,
    loadSessions,
    showSnackbar,
    confirm,
  });

  // Treatment recommendations hook
  const { handleGenerateTreatmentRecommendations } = useTreatmentRecommendations({
    studentId: id || '',
    selectedSchool,
    goals,
    apiKey,
    setError: aiFeatures.setTreatmentRecsError,
    generateTreatmentRecs: aiFeatures.generateTreatmentRecs,
  });

  const loadIncompleteReassessmentItems = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    try {
      const items = await getIncompleteReassessmentItems(id);
      if (!signal?.aborted) {
        setIncompleteReassessmentItems(items);
      }
    } catch (error) {
      // Silently fail - reassessment items are optional
    }
  }, [id]);

  useEffect(() => {
    const abortController = new AbortController();
    
    if (id) {
      loadStudent();
      loadGoals();
      loadSessions();
      loadIncompleteReassessmentItems(abortController.signal);
    }
    
    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedSchool]);

  // Check for addGoal query parameter and open dialog
  useEffect(() => {
    const addGoalParam = searchParams.get('addGoal');
    if (addGoalParam === 'true' && student && goals.length === 0 && !goalFormDialog.open) {
      initializeForm();
      goalTemplate.clearTemplate();
      goalFormDialog.openDialog();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, student, goals.length, goalFormDialog.open, setSearchParams, initializeForm, goalFormDialog, goalTemplate]);

  // Check for goalId query parameter and open edit dialog for that goal
  useEffect(() => {
    const goalIdParam = searchParams.get('goalId');
    if (goalIdParam && student && goals.length > 0 && !goalFormDialog.open) {
      const goalToEdit = goals.find(g => g.id === goalIdParam);
      if (goalToEdit) {
        initializeForm(goalToEdit);
        goalTemplate.clearTemplate();
        goalFormDialog.openDialog();
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, student, goals.length, goalFormDialog.open, setSearchParams, goals, initializeForm, goalFormDialog, goalTemplate]);

  // Performance helpers hook
  const { getRecentPerformance } = usePerformanceHelpers({
    sessions,
    goals,
    studentId: id,
  });

  // Goal template handler hook
  const { handleUseTemplate } = useGoalTemplateHandler({
    useTemplate: goalTemplate.useTemplate,
    closeDialog: templateDialog.closeDialog,
  });

  // Goal subtree handler hook
  const { handleCopySubtree } = useGoalSubtreeHandler({
    startCopySubtree: goalSubtree.startCopySubtree,
    openDialog: copySubtreeDialog.openDialog,
  });

  const handleArchiveGoals = useCallback(() => {
    confirm({
      title: 'Archive all goals?',
      message: "This will archive all current goals for this student (e.g. after a reassessment). You can add new goals afterward. Archived goals remain in the system but won't appear in the active list.",
      confirmText: 'Archive',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const count = await archiveGoals();
          showSnackbar(`Archived ${count} goal${count !== 1 ? 's' : ''}. Ready to add new goals.`, 'success');
        } catch {
          showSnackbar('Failed to archive goals', 'error');
        }
      },
    });
  }, [confirm, archiveGoals, showSnackbar]);

  const handleUnarchiveGoal = useCallback(async (goal: Goal) => {
    try {
      await updateGoalById(goal.id, { archived: false });
      await loadGoals(true); // Reload to refresh both active and archived lists
      showSnackbar('Goal restored to active', 'success');
    } catch (err) {
      handleApiError(err, 'Failed to restore goal');
    }
  }, [updateGoalById, loadGoals, showSnackbar, handleApiError]);

  const handleMarkGoalComplete = useCallback(async (goal: Goal) => {
    try {
      await updateGoalById(goal.id, {
        status: 'achieved',
        dateAchieved: new Date().toISOString().slice(0, 10),
      });
      await loadGoals();
      showSnackbar('Goal marked as completed', 'success');
    } catch (err) {
      handleApiError(err, 'Failed to mark goal as completed');
    }
  }, [updateGoalById, loadGoals, showSnackbar, handleApiError]);

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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon />
            Notes & Documentation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            View and manage this student&apos;s sessions, notes, evaluations, and communications.
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<EventNoteIcon />}
                endIcon={<OpenInNewIcon fontSize="small" />}
                onClick={() => navigate(`/sessions?studentId=${id}`)}
                sx={{ justifyContent: 'flex-start' }}
              >
                Session History
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<DescriptionIcon />}
                endIcon={<OpenInNewIcon fontSize="small" />}
                onClick={() => navigate(`/soap-notes?studentId=${id}`)}
                sx={{ justifyContent: 'flex-start' }}
              >
                SOAP Notes
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<DescriptionIcon />}
                endIcon={<OpenInNewIcon fontSize="small" />}
                onClick={() => navigate(`/iep-notes?studentId=${id}`)}
                sx={{ justifyContent: 'flex-start' }}
              >
                IEP Notes
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<TrendingUpIcon />}
                endIcon={<OpenInNewIcon fontSize="small" />}
                onClick={() => navigate(`/progress?studentId=${id}`)}
                sx={{ justifyContent: 'flex-start' }}
              >
                Progress Tracking
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<AssessmentIcon />}
                endIcon={<OpenInNewIcon fontSize="small" />}
                onClick={() => navigate(`/evaluations?studentId=${id}`)}
                sx={{ justifyContent: 'flex-start' }}
              >
                Evaluations
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<EmailIcon />}
                endIcon={<OpenInNewIcon fontSize="small" />}
                onClick={() => navigate(`/communications?studentId=${id}`)}
                sx={{ justifyContent: 'flex-start' }}
              >
                Communications
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <GoalActionsBar
        onAddGoal={() => goalDialogHandlers.handleOpenDialog()}
        onQuickGoal={() => quickGoalsDialog.openDialog()}
        onArchiveGoals={handleArchiveGoals}
        onGenerateIEPGoals={() => {
          aiFeatures.setAssessmentData('');
          aiFeatures.setIepGoals('');
          iepGoalsDialog.openDialog();
        }}
        onGenerateTreatmentRecommendations={async () => {
          if (!isMountedRef.current) return;
          aiFeatures.setTreatmentRecommendations('');
          await handleGenerateTreatmentRecommendations();
          if (!isMountedRef.current) return;
          treatmentRecsDialog.openDialog();
        }}
        hasGoals={goals.length > 0}
      />

      <Grid container spacing={2}>
        <GoalsList
          goals={goals}
          getRecentPerformance={getRecentPerformance}
          onEdit={goalDialogHandlers.handleOpenDialog}
          onDelete={handleDelete}
          onCopyToSubGoal={goalDialogHandlers.handleCopyMainGoalToSubGoal}
          onAddSubGoal={(parentId) => goalDialogHandlers.handleOpenDialog(undefined, parentId)}
          onQuickSubGoal={(parentId) => {
            const parentGoal = goals.find(g => g.id === parentId);
            quickGoals.setQuickSubGoalParent(parentId, parentGoal?.domain, parentGoal?.target);
            quickGoalsDialog.openDialog();
          }}
          onEditSubGoal={goalDialogHandlers.handleOpenDialog}
          onDuplicateSubGoal={goalDialogHandlers.handleDuplicateSubGoal}
          onCopySubtree={handleCopySubtree}
          onMarkComplete={handleMarkGoalComplete}
        />
      </Grid>

      <Accordion
        sx={{ mt: 2 }}
        onChange={async (_e, expanded) => {
          if (expanded) await loadArchivedGoals();
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArchiveIcon color="action" />
            <Typography>Archived goals</Typography>
            {archivedGoals.length > 0 && (
              <Chip label={archivedGoals.length} size="small" variant="outlined" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {archivedGoals.length === 0 ? (
            <Typography color="text.secondary">
              No archived goals. Goals are archived when you use &quot;Archive Goals &amp; Start Fresh&quot; after a reassessment.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {archivedGoals.map((goal) => (
                <Grid item xs={12} md={6} key={goal.id}>
                  <Card variant="outlined" sx={{ opacity: 0.9 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Chip label={goal.domain || 'General'} size="small" sx={{ mb: 1 }} />
                        <Button
                          size="small"
                          startIcon={<UnarchiveIcon />}
                          onClick={() => handleUnarchiveGoal(goal)}
                        >
                          Restore
                        </Button>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>{goal.description}</Typography>
                      {goal.baseline && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Baseline: {goal.baseline}
                        </Typography>
                      )}
                      {goal.target && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Target: {goal.target}
                        </Typography>
                      )}
                      {goal.dateArchived && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          Archived: {formatDate(goal.dateArchived)}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>

      {incompleteReassessmentItems.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AssignmentIcon />
              <Typography variant="h6">Reassessment Plan Items</Typography>
            </Box>
            <List>
              {incompleteReassessmentItems.map((item) => (
                <ListItem
                  key={item.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                  secondaryAction={
                    <Checkbox
                      checked={false}
                      onChange={async () => {
                        try {
                          await updateReassessmentPlanItem(item.id, {
                            completed: true,
                            completedDate: new Date().toISOString(),
                          });
                          await loadIncompleteReassessmentItems(); // No signal needed for manual refresh
                          showSnackbar('Item marked as completed', 'success');
                        } catch (error) {
                          showSnackbar('Failed to update item', 'error');
                        }
                      }}
                      icon={<CheckCircleIcon />}
                    />
                  }
                >
                  <ListItemText
                    primary={item.description}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip label={item.planTitle} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">
                          Due: {formatDate(item.dueDate)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <GoalFormDialog
        open={goalFormDialog.open}
        editingGoal={editingGoal}
        formData={formData}
        allGoals={goals}
        selectedTemplate={goalTemplate.selectedTemplate}
        onClose={goalDialogHandlers.handleCloseDialog}
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
        fieldErrors={fieldErrors}
        onClearError={clearError}
      />

      <GoalSuggestionsDialog
        open={goalSuggestionsDialog.open}
        goalArea={aiFeatures.goalArea}
        goalSuggestions={aiFeatures.goalSuggestions}
        loading={aiFeatures.loadingGoalSuggestions}
        error={aiFeatures.goalSuggestionsError}
        onClose={goalSuggestionsDialog.closeDialog}
        onGoalAreaChange={aiFeatures.setGoalArea}
        onGenerate={() => {
          aiFeatures.generateSuggestions(aiFeatures.goalArea, student?.concerns);
        }}
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
        onGenerate={() => {
          aiFeatures.generateIEPGoalsFromAssessment(aiFeatures.assessmentData, student?.concerns);
        }}
      />

      <GoalTemplateDialog
        open={templateDialog.open}
        student={student}
        filterDomain={goalTemplate.templateFilterDomain}
        showRecommendedTemplates={goalTemplate.showRecommendedTemplates}
        onClose={templateDialog.closeDialog}
        onFilterDomainChange={goalTemplate.setTemplateFilterDomain}
        onShowRecommendedTemplatesChange={goalTemplate.setShowRecommendedTemplates}
        onUseTemplate={handleUseTemplate}
      />

      <CopySubtreeDialog
        open={copySubtreeDialog.open}
        goal={goalSubtree.goalToCopy}
        onClose={() => {
          copySubtreeDialog.closeDialog();
          goalSubtree.cancelCopySubtree();
        }}
        onConfirm={goalSubtree.confirmCopySubtree}
      />

      <QuickGoalsDialog
        open={quickGoalsDialog.open}
        studentId={id || ''}
        parentGoalId={quickGoals.parentId}
        parentGoalDomain={quickGoals.parentDomain}
        parentGoalTarget={quickGoals.parentTarget}
        onClose={() => {
          quickGoalsDialog.closeDialog();
          quickGoals.clearQuickSubGoalParent();
        }}
        onSave={quickGoals.handleSaveQuickGoals}
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

