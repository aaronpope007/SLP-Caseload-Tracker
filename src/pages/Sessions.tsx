import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { endOfDay, startOfDay } from 'date-fns';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Snackbar,
  Alert,
  Autocomplete,
  TextField,
  Stack,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { Session, Student, Goal } from '../types';
import {
  getSessions, // Needed for group session logic
  updateGoal,
} from '../utils/storage-api';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useDialog, useSessionManagement, useSessionForm, useSessionFormHandlers, useSessionSave, useSessionDialogHandlers, useSessionDelete, useSOAPNoteGeneration, useSOAPNoteSave, useSOAPNoteManagement, useSessionPlanning, useSessionDataLoader, usePerformanceHelpers, useLookupHelpers, useSessionPlanGeneration } from '../hooks';
import { useSessionDialog } from '../context/SessionDialogContext';
import { SessionsList } from '../components/session/SessionsList';
import { SessionPlanDialog } from '../components/session/SessionPlanDialog';
import { LogActivityMenu } from '../components/LogActivityMenu';
import { SessionFormDialog } from '../components/session/SessionFormDialog';
import type { SessionFormData } from '../components/session/SessionFormDialog';
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
  const [studentFilterId, setStudentFilterId] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<Date | null>(null);
  const [endDateFilter, setEndDateFilter] = useState<Date | null>(null);
  const [selectedSessionForSOAP, setSelectedSessionForSOAP] = useState<Session | null>(null);
  const [existingSOAPNote, setExistingSOAPNote] = useState<SOAPNote | undefined>(undefined);

  // Same search as Log Communication modal: name, grade, concerns
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

  const studentsForSchool = useMemo(
    () => students.filter((s) => !selectedSchool || s.school === selectedSchool),
    [students, selectedSchool]
  );

  const studentsForSchoolDeduped = useMemo(() => {
    const seen = new Set<string>();
    return studentsForSchool.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [studentsForSchool]);

  const dateRangePredicate = useCallback((s: Session) => {
    if (!startDateFilter && !endDateFilter) return true;
    const t = new Date(s.date).getTime();
    const startMs = startDateFilter ? startOfDay(startDateFilter).getTime() : null;
    const endMs = endDateFilter ? endOfDay(endDateFilter).getTime() : null;
    if (startMs != null && t < startMs) return false;
    if (endMs != null && t > endMs) return false;
    return true;
  }, [startDateFilter, endDateFilter]);

  // Filter sessions by selected student (include full group sessions when any member matches),
  // then apply inclusive date range filter.
  const filteredSessions = useMemo(() => {
    const studentFiltered = (() => {
      if (!studentFilterId) return sessions;
      const groupIdsWithStudent = new Set(
        sessions
          .filter((s) => s.studentId === studentFilterId && s.groupSessionId)
          .map((s) => s.groupSessionId!)
      );
      return sessions.filter(
        (s) =>
          s.studentId === studentFilterId ||
          (s.groupSessionId != null && groupIdsWithStudent.has(s.groupSessionId))
      );
    })();

    return studentFiltered.filter(dateRangePredicate);
  }, [sessions, studentFilterId, dateRangePredicate]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool, studentFilterId]);

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

  // Pre-select student when navigating from student detail (?studentId=...)
  useEffect(() => {
    const studentIdParam = searchParams.get('studentId');
    if (studentIdParam && studentsForSchool.some((s) => s.id === studentIdParam)) {
      setStudentFilterId(studentIdParam);
    }
  }, [searchParams, studentsForSchool]);

  // Session data loader hook
  const { loadData } = useSessionDataLoader({
    selectedSchool,
    setStudents,
    setGoals,
    loadSessions,
    studentId: studentFilterId || undefined,
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

  const SPEDFORMS_CLAUDE_INSTRUCTIONS = `IEP Progress Note — SpedForms Copy-Paste Generator
You are helping an MNPS school-based speech-language pathologist write IEP progress notes in Minnesota SpedForms format. For each annual goal, produce a single block of copy-paste text to go in the objectives field of the progress note. Follow these rules:
Write in professional, third-person SLP documentation language appropriate for a Minnesota school IEP
For each goal, state the checkbox recommendation (Insufficient Progress / Adequate Progress / Goal Met) based on the data provided
In the text block, address each objective under that goal in order, including current performance data, trend, cueing level, and what will be addressed next
If an objective has no data yet because intervention hasn't started, state that clearly and note that baseline will be established upon initiation
Do not include goal text verbatim — summarize clinically
Keep each block concise but complete — appropriate for a SpedForms text field
Format: one labeled block per annual goal, preceded by the checkbox recommendation
What I will provide:
The annual goal and its objectives (copied from the IEP)
A progress report from my data tracking app with recent session percentages, session-by-session data, cueing notes, and status
Produce one copy-paste block per goal. Label each block clearly (e.g., Goal 1 — Articulation / Goal 2 — Language).`;

  const formatSessionsForClipboard = useCallback((items: Session[]) => {
    const header = [
      'Date',
      'EndTime',
      'Student',
      'ServiceType',
      'Missed',
      'GroupSessionId',
      'GoalsTargeted',
      'Performance',
      'Activities',
      'Notes',
      'IndirectNotes',
    ].join('\t');

    const rows = items
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((s) => {
        const goalsText = (s.goalsTargeted || [])
          .map((gid) => getGoalDescription(gid))
          .join(' | ');

        const perfText = (s.performanceData || [])
          .map((p) => {
            const name = getGoalDescription(p.goalId);
            const bits: string[] = [];
            if (p.accuracy !== undefined) bits.push(`accuracy=${p.accuracy}%`);
            if (p.correctTrials !== undefined) bits.push(`correct=${p.correctTrials}`);
            if (p.incorrectTrials !== undefined) bits.push(`incorrect=${p.incorrectTrials}`);
            if (p.cuingLevels && p.cuingLevels.length > 0) bits.push(`cuing=${p.cuingLevels.join(',')}`);
            if (p.notes) bits.push(`notes=${p.notes.replace(/\s+/g, ' ').trim()}`);
            return `${name}${bits.length ? ` (${bits.join('; ')})` : ''}`;
          })
          .join(' | ');

        const activities = (s.activitiesUsed || []).join(', ');
        const serviceType = s.isDirectServices === true ? 'Direct' : 'Indirect';
        const missed = s.missedSession === true ? 'Yes' : 'No';

        const cols = [
          s.date,
          s.endTime ?? '',
          getStudentName(s.studentId),
          serviceType,
          missed,
          s.groupSessionId ?? '',
          goalsText,
          perfText,
          activities,
          (s.notes ?? '').replace(/\s+/g, ' ').trim(),
          (s.indirectServicesNotes ?? '').replace(/\s+/g, ' ').trim(),
        ];

        // Avoid breaking TSV with newlines/tabs
        return cols.map((c) => String(c).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t');
      });

    const tsv = [header, ...rows].join('\n');
    return `${SPEDFORMS_CLAUDE_INSTRUCTIONS}\n\n---\n\n${tsv}`;
  }, [getGoalDescription, getStudentName]);

  const handleCopyFilteredSessions = useCallback(async () => {
    if (filteredSessions.length === 0) {
      showSnackbar('No sessions to copy for the current filters.', 'warning');
      return;
    }
    const text = formatSessionsForClipboard(filteredSessions);
    try {
      await navigator.clipboard.writeText(text);
      showSnackbar(`Copied ${filteredSessions.length} session${filteredSessions.length === 1 ? '' : 's'} to clipboard.`, 'success');
    } catch (err) {
      logError('Failed to copy sessions to clipboard', err);
      showSnackbar('Failed to copy to clipboard. Your browser may block clipboard access.', 'error');
    }
  }, [filteredSessions, formatSessionsForClipboard, showSnackbar]);

  // Memoized callback for form data changes to prevent unnecessary re-renders
  const handleFormDataChange = useCallback((updates: Partial<SessionFormData>) => {
    Object.entries(updates).forEach(([key, value]) => {
      updateFormField(key as keyof typeof formData, value);
    });
  }, [updateFormField]);

  const handleMarkGoalMet = useCallback(async (goal: Goal) => {
    try {
      await updateGoal(goal.id, {
        status: 'achieved',
        dateAchieved: new Date().toISOString().slice(0, 10),
      });
      await loadData();
      showSnackbar('Goal marked as met');
    } catch (error) {
      logError('Sessions: Error marking goal as met', error);
      showSnackbar('Failed to mark goal as met', 'error');
    }
  }, [loadData, showSnackbar]);

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
          <Button
            variant="outlined"
            startIcon={<CopyIcon />}
            onClick={handleCopyFilteredSessions}
            disabled={filteredSessions.length === 0}
          >
            Copy session data
          </Button>
        </Box>
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 240 }}
          options={studentsForSchoolDeduped}
          getOptionLabel={(option) => option?.name ?? ''}
          filterOptions={(options, state) => filterStudentOptions(options, state.inputValue)}
          value={studentFilterId ? studentsForSchoolDeduped.find((s) => s.id === studentFilterId) ?? null : null}
          onChange={(_, newValue) => setStudentFilterId(newValue?.id ?? '')}
          renderInput={(params) => (
            <TextField {...params} label="Filter by student" placeholder="Search by name, grade, or concerns" />
          )}
          isOptionEqualToValue={(option, value) => value != null && option.id === value.id}
          clearText="Clear"
        />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Start date"
            value={startDateFilter}
            onChange={(v) => setStartDateFilter(v)}
            slotProps={{
              textField: { size: 'small', sx: { minWidth: 180 } },
            }}
          />
          <DatePicker
            label="End date"
            value={endDateFilter}
            onChange={(v) => setEndDateFilter(v)}
            slotProps={{
              textField: { size: 'small', sx: { minWidth: 180 } },
            }}
          />
        </LocalizationProvider>
      </Stack>

      {!studentFilterId && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Showing the 20 most recent sessions. Select a student to load their full history.
        </Typography>
      )}

      <Grid container spacing={2}>
        {filteredSessions.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  {sessions.length === 0
                    ? 'No sessions logged yet. Click "Log Activity" to get started.'
                    : studentFilterId
                      ? 'No sessions found for this student.'
                      : 'No sessions logged yet. Click "Log Activity" to get started.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          <SessionsList
            sessions={filteredSessions}
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
        onFormDataChange={handleFormDataChange}
        onStudentSearchChange={setStudentSearch}
        onStudentToggle={formHandlers.handleStudentToggle}
        onGoalToggle={formHandlers.handleGoalToggle}
        onPerformanceUpdate={formHandlers.handlePerformanceUpdate}
        onCuingLevelToggle={formHandlers.handleCuingLevelToggle}
        onTrialUpdate={formHandlers.handleTrialUpdate}
        getRecentPerformance={getRecentPerformance}
        getRecentPerformanceFull={getRecentPerformanceFull}
        isGoalAchieved={isGoalAchieved}
        onMarkGoalMet={handleMarkGoalMet}
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

