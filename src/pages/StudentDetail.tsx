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
import type { Student, Goal, Session, GoalTemplate } from '../types';
import {
  getGoals,
} from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useGoalManagement, useGoalForm, useGoalTemplate, useGoalSubtree, useQuickGoals, useGoalSave, useGoalDialogHandlers, useGoalDelete, useTreatmentRecommendations, useAIFeatures, useDialog, useStudentData, useSessionData, usePerformanceHelpers, useGoalTemplateHandler, useGoalSubtreeHandler } from '../hooks';
import { useDirty } from '../hooks/useDirty';
import {
  generateGoalSuggestions,
  generateTreatmentRecommendations,
  generateIEPGoals,
  type GoalProgressData,
} from '../utils/gemini';
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
  
  // Goal template selection hook
  const goalTemplate = useGoalTemplate(updateFormField);

  // Copy subtree hook
  const goalSubtree = useGoalSubtree({
    studentId: id || '',
    createGoal,
    updateGoal: updateGoalById,
    loadGoals,
    loadSessions,
    showSnackbar,
  });

  // Quick goals hook
  const quickGoals = useQuickGoals({
    studentId: id || '',
    createGoal,
    updateGoal: updateGoalById,
    loadGoals,
    loadSessions,
    showSnackbar,
  });

  // Goal dialog handlers hook
  const goalDialogHandlers = useGoalDialogHandlers({
    goals,
    initializeForm,
    updateFormField,
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
    updateGoal: updateGoalById,
    loadGoals,
    loadSessions,
    closeDialog: goalFormDialog.closeDialog,
    resetForm,
    resetDirty,
    showSnackbar,
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
      goalTemplate.clearTemplate();
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
        goalTemplate.clearTemplate();
        goalFormDialog.openDialog();
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, student, goals.length, goalFormDialog.open, setSearchParams, goals, initializeForm, goalFormDialog, goalTemplate]);


  // Student data loading hook
  const { loadStudent } = useStudentData({
    studentId: id,
    selectedSchool,
    setStudent,
  });

  // Session data loading hook
  const { loadSessions } = useSessionData({
    studentId: id,
    selectedSchool,
    setSessions,
  });

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
        onAddGoal={() => goalDialogHandlers.handleOpenDialog()}
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
        />
      </Grid>

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

