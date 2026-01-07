import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import type { Session, Student, Goal } from '../types';
import {
  getSessions, // Needed for group session logic
} from '../utils/storage-api';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useDialog, useSessionManagement, useSessionForm, useSessionFormHandlers, useSessionSave, useSessionDialogHandlers, useSessionDelete, useSOAPNoteGeneration, useSOAPNoteSave, useSOAPNoteManagement, useSessionPlanning, useSessionDataLoader, usePerformanceHelpers, useLookupHelpers, useSessionPlanGeneration } from '../hooks';
import { useSessionDialog } from '../context/SessionDialogContext';
import { SessionsList } from '../components/SessionsList';
import { SessionPlanDialog } from '../components/SessionPlanDialog';
import { LogActivityMenu } from '../components/LogActivityMenu';
import { SessionFormDialog } from '../components/SessionFormDialog';
import type { SessionFormData } from '../components/SessionFormDialog';
import { SOAPNoteDialog } from '../components/SOAPNoteDialog';
import type { SOAPNote } from '../types';
import { logError } from '../utils/logger';

export const Sessions = () => {
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const { registerHandler } = useSessionDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  
  // Session management hook
  const {
    sessions,
    loadSessions,
    createSession,
    updateSession: updateSessionById,
    deleteSession: removeSession,
  } = useSessionManagement({
    school: selectedSchool,
  });

  // Session form hook
  const {
    formData,
    editingSession,
    editingGroupSessionId,
    isDirty,
    initializeForm,
    updateFormField,
    resetForm,
    setEditingGroupSessionId,
  } = useSessionForm();

  // Dialog management
  const sessionFormDialog = useDialog();
  const sessionPlanDialog = useDialog();
  const soapNoteDialog = useDialog();

  // SOAP Note management
  const soapNoteManagement = useSOAPNoteManagement();

  // Session planning
  const apiKey = localStorage.getItem('gemini_api_key') || '';
  const sessionPlanning = useSessionPlanning({ apiKey });

  // Local state
  const [students, setStudents] = useState<Student[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedSessionForSOAP, setSelectedSessionForSOAP] = useState<Session | null>(null);
  const [existingSOAPNote, setExistingSOAPNote] = useState<SOAPNote | undefined>(undefined);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool]);

  // Check for URL parameter to open add session dialog
  useEffect(() => {
    const addParam = searchParams.get('add');
    if (addParam === 'true' && !sessionFormDialog.open && students.length > 0) {
      // Open dialog after data has loaded
      dialogHandlers.handleOpenDialog();
      // Clear the URL parameter
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, students.length, sessionFormDialog.open]);

  // Session data loader hook
  const { loadData } = useSessionDataLoader({
    selectedSchool,
    setStudents,
    setGoals,
    loadSessions,
  });


  // Register the handler to open the dialog from context
  useEffect(() => {
    registerHandler(() => {
      dialogHandlers.handleOpenDialog();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerHandler]);

  // isDirty is now provided by useSessionForm hook

  // Performance helpers hook - must be defined before hooks that use isGoalAchieved
  const { getRecentPerformance: getRecentPerformanceFull, isGoalAchieved } = usePerformanceHelpers({
    sessions,
    goals,
  });

  // Wrapper to extract just the average for GoalHierarchy component
  // Note: sessions dependency removed - getRecentPerformanceFull already handles sessions internally
  const getRecentPerformance = useCallback((goalId: string, studentId: string): number | null => {
    const result = getRecentPerformanceFull(goalId, studentId);
    return result.average;
  }, [getRecentPerformanceFull]);

  const handleCloseDialog = (forceClose = false) => {
    if (!forceClose && isDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close without saving?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          sessionFormDialog.closeDialog();
          resetForm();
          setStudentSearch('');
        },
      });
      // Return early to prevent dialog from closing
      return;
    } else {
      sessionFormDialog.closeDialog();
      resetForm();
      setStudentSearch('');
    }
  };

  // Session form handlers hook
  const formHandlers = useSessionFormHandlers({
    formData,
    goals,
    editingSession,
    editingGroupSessionId: editingGroupSessionId || undefined,
    updateFormField,
    isGoalAchieved,
  });

  // Session dialog handlers hook
  const dialogHandlers = useSessionDialogHandlers({
    formData,
    goals,
    setEditingGroupSessionId,
    setFormData: (data: Partial<SessionFormData>) => {
      // Update all fields in the form data
      Object.entries(data).forEach(([key, value]) => {
        updateFormField(key as keyof typeof formData, value);
      });
    },
    initializeForm,
    isGoalAchieved,
    openDialog: sessionFormDialog.openDialog,
  });

  // Session save hook
  const { handleSave } = useSessionSave({
    formData,
    editingSession,
    editingGroupSessionId,
    students,
    goals,
    createSession,
    updateSession: updateSessionById,
    deleteSession: removeSession,
    createSOAPNote: soapNoteManagement.createSOAPNote,
    updateSOAPNote: soapNoteManagement.updateSOAPNote,
    isGoalAchieved,
    loadData,
    closeDialog: sessionFormDialog.closeDialog,
    resetForm,
    setStudentSearch,
    showSnackbar,
  });


  // Session delete hook
  const { handleDelete } = useSessionDelete({
    removeSession,
    loadData,
    showSnackbar,
    confirm,
  });

  // SOAP note generation hook
  const { handleGenerateSOAP } = useSOAPNoteGeneration({
    sessions,
    setSelectedSessionForSOAP,
    setExistingSOAPNote,
    openDialog: soapNoteDialog.openDialog,
  });


  // Lookup helpers hook
  const { getStudentName, getGoalDescription } = useLookupHelpers({
    students,
    goals,
  });





  // SOAP note save hook
  const { handleSaveSOAPNote } = useSOAPNoteSave({
    existingSOAPNote,
    createSOAPNote: soapNoteManagement.createSOAPNote,
    updateSOAPNote: soapNoteManagement.updateSOAPNote,
    closeDialog: soapNoteDialog.closeDialog,
    setSelectedSessionForSOAP,
    setExistingSOAPNote,
    showSnackbar,
  });

  // Session plan generation hook
  const { handleGenerateSessionPlan } = useSessionPlanGeneration({
    students,
    goals,
    planStudentId: sessionPlanning.planStudentId,
    apiKey,
    setError: sessionPlanning.setError,
    generatePlan: sessionPlanning.generatePlan,
  });

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
              sessionPlanning.reset();
              sessionPlanDialog.openDialog();
            }}
          >
            Generate Session Plan
          </Button>
          <LogActivityMenu
            onAddSession={() => dialogHandlers.handleOpenDialog()}
          />
        </Box>
      </Box>

      <Grid container spacing={2}>
        {sessions.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  No sessions logged yet. Click "Log Activity" to get started.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          <SessionsList
            sessions={sessions}
            getStudentName={getStudentName}
            getGoalDescription={getGoalDescription}
            onEdit={dialogHandlers.handleOpenDialog}
            onDelete={handleDelete}
            onGenerateSOAP={handleGenerateSOAP}
          />
        )}
      </Grid>

      <SessionFormDialog
        open={sessionFormDialog.open}
        editingSession={editingSession}
        editingGroupSessionId={editingGroupSessionId}
        students={students}
        goals={goals}
        sessions={sessions}
        formData={formData}
        studentSearch={studentSearch}
        isDirty={isDirty}
        onClose={handleCloseDialog}
        onSave={handleSave}
        onFormDataChange={(updates) => {
          Object.entries(updates).forEach(([key, value]) => {
            updateFormField(key as keyof typeof formData, value);
          });
        }}
        onStudentSearchChange={setStudentSearch}
        onStudentToggle={formHandlers.handleStudentToggle}
        onGoalToggle={formHandlers.handleGoalToggle}
        onPerformanceUpdate={formHandlers.handlePerformanceUpdate}
        onCuingLevelToggle={formHandlers.handleCuingLevelToggle}
        onTrialUpdate={formHandlers.handleTrialUpdate}
        getRecentPerformance={getRecentPerformance}
        isGoalAchieved={isGoalAchieved}
      />

      <SessionPlanDialog
        open={sessionPlanDialog.open}
        onClose={sessionPlanDialog.closeDialog}
        students={students}
        planStudentId={sessionPlanning.planStudentId}
        sessionPlan={sessionPlanning.sessionPlan}
        sessionPlanError={sessionPlanning.error}
        loadingSessionPlan={sessionPlanning.loading}
        onStudentChange={sessionPlanning.setPlanStudentId}
        onGenerate={handleGenerateSessionPlan}
      />

      {selectedSessionForSOAP && (() => {
        const student = students.find(s => s.id === selectedSessionForSOAP.studentId);
        if (!student) {
          return null; // Don't render if student not found
        }
        return (
          <SOAPNoteDialog
            open={soapNoteDialog.open}
            session={selectedSessionForSOAP}
            student={student}
            goals={goals.filter(g => g.studentId === selectedSessionForSOAP.studentId)}
            existingSOAPNote={existingSOAPNote}
            onClose={() => {
              soapNoteDialog.closeDialog();
              setSelectedSessionForSOAP(null);
              setExistingSOAPNote(undefined);
            }}
            onSave={handleSaveSOAPNote}
          />
        );
      })()}
      <ConfirmDialog />

      <SnackbarComponent />
    </Box>
  );
};

