import { useState, useEffect, useRef } from 'react';
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
  getStudents,
  getGoals,
  getSessionsByStudent,
  getSessions, // Needed for group session logic
} from '../utils/storage-api';
import { generateId, formatDateTime, toLocalDateTimeString, fromLocalDateTimeString } from '../utils/helpers';
import { generateSessionPlan } from '../utils/gemini';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useDialog, useSessionManagement, useSessionForm, useSOAPNoteManagement, useSessionPlanning } from '../hooks';
import { useSessionDialog } from '../context/SessionDialogContext';
import { SessionsList } from '../components/SessionsList';
import { SessionPlanDialog } from '../components/SessionPlanDialog';
import { LogActivityMenu } from '../components/LogActivityMenu';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { SOAPNoteDialog } from '../components/SOAPNoteDialog';
import type { SOAPNote } from '../types';
import { getSOAPNotesBySession } from '../utils/storage-api';
import { generateSOAPNote, generateGroupSOAPNote } from '../utils/soapNoteGenerator';
import { api } from '../utils/api';
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
      handleOpenDialog();
      // Clear the URL parameter
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, students.length, sessionFormDialog.open]);

  const loadData = async () => {
    try {
      const schoolStudents = await getStudents(selectedSchool);
      const studentIds = new Set(schoolStudents.map(s => s.id));
      await loadSessions();
      // Filter out archived students (archived is optional for backward compatibility)
      setStudents(schoolStudents.filter(s => s.archived !== true));
      const allGoals = await getGoals();
      setGoals(allGoals.filter(g => studentIds.has(g.studentId)));
    } catch (error) {
      logError('Failed to load data', error);
    }
  };

  const handleOpenDialog = async (session?: Session, groupSessionId?: string) => {
    if (session || groupSessionId) {
      // If groupSessionId is provided, load all sessions in the group
      if (groupSessionId) {
        const allSessions = await getSessions();
        const groupSessions = allSessions.filter(s => s.groupSessionId === groupSessionId);
        
        if (groupSessions.length > 0) {
          const firstSession = groupSessions[0];
          setEditingGroupSessionId(groupSessionId);
          
          // Collect all student IDs from the group
          const allStudentIds = groupSessions.map(s => s.studentId);
          
          // Collect all goals targeted across all sessions (filter out achieved goals)
          const allGoalsTargeted = new Set<string>();
          groupSessions.forEach(s => {
            s.goalsTargeted.forEach(gId => {
              const goal = goals.find(g => g.id === gId);
              if (goal && !isGoalAchieved(goal)) {
                allGoalsTargeted.add(gId);
              }
            });
          });
          
          // Collect all performance data from all sessions (only for active goals)
          const activeGoalsArray = Array.from(allGoalsTargeted);
          const allPerformanceData: typeof formData.performanceData = [];
          groupSessions.forEach(s => {
            s.performanceData.forEach(p => {
              if (activeGoalsArray.includes(p.goalId)) {
                allPerformanceData.push({
                  goalId: p.goalId,
                  studentId: s.studentId,
                  accuracy: p.accuracy?.toString() || '',
                  correctTrials: p.correctTrials || 0,
                  incorrectTrials: p.incorrectTrials || 0,
                  notes: p.notes || '',
                  cuingLevels: p.cuingLevels,
                });
              }
            });
          });
          
          // Use the first session's common data (date, endTime, activities, notes, etc.)
          const startDate = new Date(firstSession.date);
          const endDate = firstSession.endTime ? new Date(firstSession.endTime) : null;
          
          const newFormData = {
            studentIds: allStudentIds,
            date: toLocalDateTimeString(startDate),
            endTime: endDate ? toLocalDateTimeString(endDate) : '',
            goalsTargeted: activeGoalsArray,
            activitiesUsed: firstSession.activitiesUsed, // Use first session's activities (should be same for all)
            performanceData: allPerformanceData,
            notes: firstSession.notes, // Use first session's notes (should be same for all)
            isDirectServices: firstSession.isDirectServices === true,
            indirectServicesNotes: firstSession.indirectServicesNotes || '',
            missedSession: firstSession.missedSession || false,
            selectedSubjectiveStatements: firstSession.selectedSubjectiveStatements || [],
            customSubjective: firstSession.customSubjective || '',
            plan: firstSession.plan || '',
          };
          setFormData(newFormData);
        }
      } else if (session) {
        // Editing a single session
        const startDate = new Date(session.date);
        const endDate = session.endTime ? new Date(session.endTime) : null;
        // Filter out achieved goals when editing
        const activeGoalsTargeted = session.goalsTargeted.filter(gId => {
          const goal = goals.find(g => g.id === gId);
          return goal && !isGoalAchieved(goal);
        });
        
        initializeForm(session, null);
      }
    } else {
      // Creating a new session
      initializeForm();
    }
    sessionFormDialog.openDialog();
  };

  // Register the handler to open the dialog from context
  useEffect(() => {
    registerHandler(() => {
      handleOpenDialog();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerHandler]);

  // isDirty is now provided by useSessionForm hook

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
    } else {
      sessionFormDialog.closeDialog();
      resetForm();
      setStudentSearch('');
    }
  };

  const handleStudentToggle = async (studentId: string) => {
    const isSelected = formData.studentIds.includes(studentId);
    let newStudentIds: string[];
    let newGoalsTargeted: string[] = [...formData.goalsTargeted];
    let newPerformanceData = [...formData.performanceData];
    let newPlan = formData.plan;

    if (isSelected) {
      // Remove student
      newStudentIds = formData.studentIds.filter(id => id !== studentId);
      // Remove goals and performance data for this student
      const studentGoals = goals.filter(g => g.studentId === studentId).map(g => g.id);
      newGoalsTargeted = formData.goalsTargeted.filter(gId => !studentGoals.includes(gId));
      newPerformanceData = formData.performanceData.filter(p => p.studentId !== studentId);
    } else {
      // Add student
      newStudentIds = [...formData.studentIds, studentId];
      
      // If this is the first student selected and we're creating a new session, fetch last session's plan
      if (formData.studentIds.length === 0 && !editingSession && !editingGroupSessionId) {
        try {
          const studentSessions = await getSessionsByStudent(studentId);
          // Get the most recent direct services session that wasn't missed and has a plan
          const lastSession = studentSessions
            .filter(s => s.isDirectServices && !s.missedSession && s.plan)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
          if (lastSession && lastSession.plan) {
            newPlan = lastSession.plan;
          }
        } catch (error) {
          logError('Failed to fetch last session plan', error);
        }
      }
    }

    updateFormField('studentIds', newStudentIds);
    updateFormField('goalsTargeted', newGoalsTargeted);
    updateFormField('performanceData', newPerformanceData);
    updateFormField('plan', newPlan);
  };

  const handleGoalToggle = (goalId: string, studentId: string) => {
    const isSelected = formData.goalsTargeted.includes(goalId);
    let newGoalsTargeted: string[];
    let newPerformanceData = [...formData.performanceData];

    if (isSelected) {
      newGoalsTargeted = formData.goalsTargeted.filter((id) => id !== goalId);
      newPerformanceData = newPerformanceData.filter((p) => p.goalId !== goalId || p.studentId !== studentId);
    } else {
      newGoalsTargeted = [...formData.goalsTargeted, goalId];
      newPerformanceData.push({ goalId, studentId, notes: '', cuingLevels: [] }); // Don't initialize accuracy - let it be undefined so calculated shows
    }

    updateFormField('goalsTargeted', newGoalsTargeted);
    updateFormField('performanceData', newPerformanceData);
  };

  const handlePerformanceUpdate = (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => {
    updateFormField('performanceData', formData.performanceData.map((p) =>
      p.goalId === goalId && p.studentId === studentId ? { ...p, [field]: value } : p
    ));
  };

  const handleCuingLevelToggle = (goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => {
    updateFormField('performanceData', formData.performanceData.map((p) => {
      if (p.goalId !== goalId || p.studentId !== studentId) return p;
      const currentLevels = p.cuingLevels || [];
      const newLevels = currentLevels.includes(cuingLevel)
        ? currentLevels.filter(l => l !== cuingLevel)
        : [...currentLevels, cuingLevel];
      return { ...p, cuingLevels: newLevels };
    }));
  };

  const handleTrialUpdate = (goalId: string, studentId: string, isCorrect: boolean) => {
    updateFormField('performanceData', formData.performanceData.map((p) => {
      if (p.goalId !== goalId || p.studentId !== studentId) return p;
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
    }));
  };

  const handleSave = async () => {
    if (formData.studentIds.length === 0) {
      showSnackbar('Please select at least one student', 'error');
      return;
    }

    // Validate required fields for direct services
    if (formData.isDirectServices) {
      // Subjective is required: either checkbox selected OR custom text entered
      const hasSubjective = formData.selectedSubjectiveStatements.length > 0 || formData.customSubjective.trim().length > 0;
      if (!hasSubjective) {
        showSnackbar('Please select at least one subjective statement or enter a custom subjective statement.', 'error');
        return;
      }
      
      // Plan is required for direct services
      if (!formData.plan.trim()) {
        showSnackbar('Please enter a plan for the next session.', 'error');
        return;
      }
    }

    try {
      // If editing a group session, update all sessions in the group
      if (editingGroupSessionId) {
        const allSessions = await getSessions();
      const existingGroupSessions = allSessions.filter(s => s.groupSessionId === editingGroupSessionId);
      
      // Determine the groupSessionId to use (preserve existing or generate new if multiple students)
      const groupSessionId = formData.studentIds.length > 1 
        ? editingGroupSessionId // Preserve existing group ID
        : undefined; // Convert to individual session if only one student
      
      // Store created/updated sessions for group SOAP note generation
      const groupSessions: Session[] = [];
      
      // Update or create sessions for each selected student
      for (const studentId of formData.studentIds) {
        // Find existing session for this student in the group
        const existingSession = existingGroupSessions.find(s => s.studentId === studentId);
        
        // Filter goals and performance data for this student (exclude achieved goals)
        const studentGoals = goals.filter(g => g.studentId === studentId && !isGoalAchieved(g)).map(g => g.id);
        const studentGoalsTargeted = formData.goalsTargeted.filter(gId => studentGoals.includes(gId));
        const studentPerformanceData = formData.performanceData
          .filter(p => p.studentId === studentId && studentGoalsTargeted.includes(p.goalId))
          .map((p) => ({
            goalId: p.goalId,
            accuracy: p.accuracy ? parseFloat(p.accuracy) : undefined,
            correctTrials: p.correctTrials,
            incorrectTrials: p.incorrectTrials,
            notes: p.notes,
            cuingLevels: p.cuingLevels,
          }));

        const sessionData: Session = {
          id: existingSession ? existingSession.id : generateId(),
          studentId: studentId,
          date: fromLocalDateTimeString(formData.date),
          endTime: formData.endTime ? fromLocalDateTimeString(formData.endTime) : undefined,
          goalsTargeted: studentGoalsTargeted,
          activitiesUsed: formData.activitiesUsed,
          performanceData: studentPerformanceData,
          notes: formData.notes,
          isDirectServices: formData.isDirectServices === true,
          indirectServicesNotes: formData.indirectServicesNotes || undefined,
          groupSessionId: groupSessionId,
          missedSession: formData.isDirectServices ? (formData.missedSession || false) : undefined,
          selectedSubjectiveStatements: formData.selectedSubjectiveStatements.length > 0 ? formData.selectedSubjectiveStatements : undefined,
          customSubjective: formData.customSubjective.trim() || undefined,
          plan: formData.plan.trim() || undefined,
        };

        if (existingSession) {
          await updateSessionById(existingSession.id, sessionData);
          groupSessions.push(sessionData);
        } else {
          await createSession(sessionData);
          groupSessions.push(sessionData);
        }
      }
      
      // For group sessions, generate ONE SOAP note that includes all students
      if (groupSessionId && groupSessions.length > 0 && formData.isDirectServices && !formData.missedSession) {
        try {
          // Check if a SOAP note already exists for this group session
          const firstSessionId = groupSessions[0].id;
          const existingSOAPNotes = await getSOAPNotesBySession(firstSessionId);
          const existingGroupSOAPNote = existingSOAPNotes.find(note => {
            // Check if this note is for any session in the group
            return groupSessions.some(s => s.id === note.sessionId);
          });
          
          const generated = generateGroupSOAPNote(
            groupSessions,
            students,
            goals,
            formData.selectedSubjectiveStatements,
            formData.customSubjective,
            formData.plan.trim() || undefined
          );
          
          // Use the first student's ID for the SOAP note (since SOAP notes require a studentId)
          const firstStudentId = groupSessions[0].studentId;
          
          if (existingGroupSOAPNote) {
            // Update existing SOAP note
            const updatedSOAPNote: SOAPNote = {
              ...existingGroupSOAPNote,
              subjective: generated.subjective,
              objective: generated.objective,
              assessment: generated.assessment,
              plan: generated.plan,
              dateUpdated: new Date().toISOString(),
            };
            await soapNoteManagement.updateSOAPNote(existingGroupSOAPNote.id, updatedSOAPNote);
          } else {
            // Create new SOAP note
            const soapNote: SOAPNote = {
              id: generateId(),
              sessionId: firstSessionId, // Link to first session in the group
              studentId: firstStudentId, // Use first student's ID
              date: groupSessions[0].date,
              subjective: generated.subjective,
              objective: generated.objective,
              assessment: generated.assessment,
              plan: generated.plan,
              dateCreated: new Date().toISOString(),
              dateUpdated: new Date().toISOString(),
            };
            await soapNoteManagement.createSOAPNote(soapNote);
          }
        } catch (error) {
          logError('Failed to auto-generate group SOAP note', error);
          // Don't fail the session save if SOAP note generation fails
        }
      }
      
      // Delete sessions for students that were removed from the group
      for (const existingSession of existingGroupSessions) {
        if (!formData.studentIds.includes(existingSession.studentId)) {
          await removeSession(existingSession.id);
        }
      }
    } else {
      // Editing a single session or creating new
      // Determine groupSessionId:
      // - If multiple students selected, generate a new one
      // - If editing a single session, preserve existing groupSessionId if it exists
      // - Otherwise, undefined (individual session)
      const isEditingSingleSession = editingSession && formData.studentIds.length === 1 && formData.studentIds[0] === editingSession.studentId;
      const groupSessionId = formData.studentIds.length > 1 
        ? generateId() 
        : (isEditingSingleSession && editingSession.groupSessionId) 
          ? editingSession.groupSessionId 
          : undefined;

      // Store created sessions for group SOAP note generation
      const createdSessions: Session[] = [];

      // Create a session for each selected student
      for (const studentId of formData.studentIds) {
        // Filter goals and performance data for this student (exclude achieved goals)
        const studentGoals = goals.filter(g => g.studentId === studentId && !isGoalAchieved(g)).map(g => g.id);
        const studentGoalsTargeted = formData.goalsTargeted.filter(gId => studentGoals.includes(gId));
        const studentPerformanceData = formData.performanceData
          .filter(p => p.studentId === studentId && studentGoalsTargeted.includes(p.goalId))
          .map((p) => ({
            goalId: p.goalId,
            accuracy: p.accuracy ? parseFloat(p.accuracy) : undefined,
            correctTrials: p.correctTrials,
            incorrectTrials: p.incorrectTrials,
            notes: p.notes,
            cuingLevels: p.cuingLevels,
          }));

        const sessionData: Session = {
          id: isEditingSingleSession
            ? editingSession.id
            : generateId(),
          studentId: studentId,
          date: fromLocalDateTimeString(formData.date),
          endTime: formData.endTime ? fromLocalDateTimeString(formData.endTime) : undefined,
          goalsTargeted: studentGoalsTargeted,
          activitiesUsed: formData.activitiesUsed,
          performanceData: studentPerformanceData,
          notes: formData.notes,
          isDirectServices: formData.isDirectServices === true, // Explicitly ensure boolean
          indirectServicesNotes: formData.indirectServicesNotes || undefined,
          groupSessionId: groupSessionId, // Link related sessions together
          missedSession: formData.isDirectServices ? (formData.missedSession || false) : undefined, // Only set for Direct Services
          selectedSubjectiveStatements: formData.selectedSubjectiveStatements.length > 0 ? formData.selectedSubjectiveStatements : undefined,
          customSubjective: formData.customSubjective.trim() || undefined,
          plan: formData.plan.trim() || undefined,
        };

        if (isEditingSingleSession) {
          await updateSessionById(editingSession.id, sessionData);
        } else {
          const newSession = await createSession(sessionData);
          if (newSession) {
            createdSessions.push(newSession);
            
            // For individual sessions, auto-generate SOAP note
            if (!groupSessionId && sessionData.isDirectServices && !sessionData.missedSession) {
              try {
                const student = students.find(s => s.id === studentId);
                if (student) {
                  const studentGoals = goals.filter(g => g.studentId === studentId);
                  const generated = generateSOAPNote(
                    newSession,
                    student,
                    studentGoals,
                    newSession.selectedSubjectiveStatements || [],
                    newSession.customSubjective || ''
                  );
                  
                  const soapNote: SOAPNote = {
                    id: generateId(),
                    sessionId: newSession.id,
                    studentId: studentId,
                    date: newSession.date,
                    subjective: generated.subjective,
                    objective: generated.objective,
                    assessment: generated.assessment,
                    plan: generated.plan,
                    dateCreated: new Date().toISOString(),
                    dateUpdated: new Date().toISOString(),
                  };
                  
                  await soapNoteManagement.createSOAPNote(soapNote);
                }
              } catch (error) {
                logError('Failed to auto-generate SOAP note', error);
                // Don't fail the session save if SOAP note generation fails
              }
            }
          }
        }
      }

      // For group sessions, generate ONE SOAP note that includes all students
      if (groupSessionId && createdSessions.length > 0 && formData.isDirectServices && !formData.missedSession) {
        try {
          const generated = generateGroupSOAPNote(
            createdSessions,
            students,
            goals,
            formData.selectedSubjectiveStatements,
            formData.customSubjective,
            formData.plan.trim() || undefined
          );
          
          // Use the first student's ID for the SOAP note (since SOAP notes require a studentId)
          const firstStudentId = createdSessions[0].studentId;
          const firstSessionId = createdSessions[0].id;
          
          const soapNote: SOAPNote = {
            id: generateId(),
            sessionId: firstSessionId, // Link to first session in the group
            studentId: firstStudentId, // Use first student's ID
            date: createdSessions[0].date,
            subjective: generated.subjective,
            objective: generated.objective,
            assessment: generated.assessment,
            plan: generated.plan,
            dateCreated: new Date().toISOString(),
            dateUpdated: new Date().toISOString(),
          };
          
          await soapNoteManagement.createSOAPNote(soapNote);
        } catch (error) {
          logError('Failed to auto-generate group SOAP note', error);
          // Don't fail the session save if SOAP note generation fails
        }
      }
    }

      await loadData();
      sessionFormDialog.closeDialog();
      resetForm();
      setStudentSearch('');
      showSnackbar(editingSession ? 'Session updated successfully' : 'Session created successfully', 'success');
    } catch (error) {
      logError('Failed to save session', error);
      showSnackbar('Failed to save session. Please try again.', 'error');
    }
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Delete Session',
      message: 'Are you sure you want to delete this session? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await removeSession(id);
          await loadData();
          showSnackbar('Session deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete session', error);
          showSnackbar('Failed to delete session. Please try again.', 'error');
        }
      },
    });
  };


  const getStudentName = (studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || 'Unknown';
  };

  const getGoalDescription = (goalId: string) => {
    return goals.find((g) => g.id === goalId)?.description || 'Unknown Goal';
  };

  // Helper to get recent performance for a goal (uses sessions from state)
  const getRecentPerformance = (goalId: string, studentId: string) => {
    const goalSessions = sessions
      .filter(s => s.studentId === studentId && s.goalsTargeted.includes(goalId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
    
    const recentData = goalSessions.map(s => {
      const perf = s.performanceData.find(p => p.goalId === goalId);
      return perf?.accuracy;
    }).filter((a): a is number => a !== undefined);

    const average = recentData.length > 0
      ? recentData.reduce((sum, a) => sum + a, 0) / recentData.length
      : null;

    return average;
  };

  // Helper function to check if a goal is achieved (either directly or if it's a subgoal with an achieved parent)
  const isGoalAchieved = (goal: Goal): boolean => {
    // Check if goal itself is achieved
    if (goal.status === 'achieved') {
      return true;
    }
    // Check if it's a subgoal with an achieved parent
    if (goal.parentGoalId) {
      const parentGoal = goals.find(g => g.id === goal.parentGoalId);
      if (parentGoal && parentGoal.status === 'achieved') {
        return true;
      }
    }
    return false;
  };




  const handleGenerateSOAP = async (session: Session) => {
    try {
      // Fetch the latest session from the API to ensure we have the most recent data including customSubjective
      const latestSession = await api.sessions.getById(session.id);
      setSelectedSessionForSOAP(latestSession);
      // Check if SOAP note already exists for this session
      const existingNotes = await getSOAPNotesBySession(latestSession.id);
      if (existingNotes.length > 0) {
        setExistingSOAPNote(existingNotes[0]); // Use the first one if multiple exist
      } else {
        setExistingSOAPNote(undefined);
      }
      soapNoteDialog.openDialog();
    } catch (error) {
      logError('Failed to fetch latest session', error);
      // Fallback to using the session from state or parameter
      const latestSession = sessions.find(s => s.id === session.id) || session;
      setSelectedSessionForSOAP(latestSession);
      const existingNotes = await getSOAPNotesBySession(latestSession.id);
      if (existingNotes.length > 0) {
        setExistingSOAPNote(existingNotes[0]);
      } else {
        setExistingSOAPNote(undefined);
      }
      soapNoteDialog.openDialog();
    }
  };

  const handleSaveSOAPNote = async (soapNote: SOAPNote) => {
    try {
      if (existingSOAPNote) {
        await soapNoteManagement.updateSOAPNote(soapNote.id, soapNote);
      } else {
        await soapNoteManagement.createSOAPNote(soapNote);
      }
      soapNoteDialog.closeDialog();
      setSelectedSessionForSOAP(null);
      setExistingSOAPNote(undefined);
      showSnackbar('SOAP note saved successfully', 'success');
    } catch (error) {
      logError('Failed to save SOAP note', error);
      showSnackbar('Failed to save SOAP note. Please try again.', 'error');
    }
  };

  const handleGenerateSessionPlan = async () => {
    if (!sessionPlanning.planStudentId) {
      sessionPlanning.setError('Please select a student');
      return;
    }

    if (!apiKey) {
      sessionPlanning.setError('Please set your Gemini API key in Settings');
      return;
    }

    const student = students.find(s => s.id === sessionPlanning.planStudentId);
    if (!student) {
      sessionPlanning.setError('Student not found');
      return;
    }

    const studentGoals = goals.filter(g => g.studentId === sessionPlanning.planStudentId);
    if (studentGoals.length === 0) {
      sessionPlanning.setError('Selected student has no goals. Please add goals first.');
      return;
    }

    try {
      const recentSessions = (await getSessionsByStudent(sessionPlanning.planStudentId))
        .slice(0, 3)
        .map(s => ({
          date: formatDateTime(s.date),
          activitiesUsed: s.activitiesUsed,
          notes: s.notes,
        }));

      await sessionPlanning.generatePlan(
        student.name,
        student.age,
        studentGoals.map(g => ({
          description: g.description,
          baseline: g.baseline,
          target: g.target,
        })),
        recentSessions
      );
    } catch (err) {
      sessionPlanning.setError(err instanceof Error ? err.message : 'Failed to generate session plan');
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
              sessionPlanning.reset();
              sessionPlanDialog.openDialog();
            }}
          >
            Generate Session Plan
          </Button>
          <LogActivityMenu
            onAddSession={handleOpenDialog}
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
            onEdit={handleOpenDialog}
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
        onClose={handleCloseDialog}
        onSave={handleSave}
        onFormDataChange={(updates) => {
          Object.entries(updates).forEach(([key, value]) => {
            updateFormField(key as keyof typeof formData, value);
          });
        }}
        onStudentSearchChange={setStudentSearch}
        onStudentToggle={handleStudentToggle}
        onGoalToggle={handleGoalToggle}
        onPerformanceUpdate={handlePerformanceUpdate}
        onCuingLevelToggle={handleCuingLevelToggle}
        onTrialUpdate={handleTrialUpdate}
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
            open={soapNoteDialogOpen}
            session={selectedSessionForSOAP}
            student={student}
            goals={goals.filter(g => g.studentId === selectedSessionForSOAP.studentId)}
            existingSOAPNote={existingSOAPNote}
            onClose={() => {
              setSoapNoteDialogOpen(false);
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

