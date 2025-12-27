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
  getSessions,
  getStudents,
  getGoals,
  addSession,
  updateSession,
  deleteSession,
  getSessionsByStudent,
} from '../utils/storage-api';
import { generateId, formatDateTime, toLocalDateTimeString, fromLocalDateTimeString } from '../utils/helpers';
import { generateSessionPlan } from '../utils/gemini';
import { useSchool } from '../context/SchoolContext';
import { useConfirm } from '../hooks/useConfirm';
import { useSessionDialog } from '../context/SessionDialogContext';
import { SessionCard } from '../components/SessionCard';
import { SessionPlanDialog } from '../components/SessionPlanDialog';
import { GroupSessionAccordion } from '../components/GroupSessionAccordion';
import { LogActivityMenu } from '../components/LogActivityMenu';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { SOAPNoteDialog } from '../components/SOAPNoteDialog';
import type { SOAPNote } from '../types';
import { getSOAPNotesBySession, addSOAPNote, updateSOAPNote } from '../utils/storage-api';
import { generateSOAPNote, generateGroupSOAPNote } from '../utils/soapNoteGenerator';
import { api } from '../utils/api';

export const Sessions = () => {
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const { registerHandler } = useSessionDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingGroupSessionId, setEditingGroupSessionId] = useState<string | null>(null);
  const initialFormDataRef = useRef<typeof formData | null>(null);

  // Session Planning State
  const [sessionPlanDialogOpen, setSessionPlanDialogOpen] = useState(false);
  const [planStudentId, setPlanStudentId] = useState('');
  const [sessionPlan, setSessionPlan] = useState('');
  const [loadingSessionPlan, setLoadingSessionPlan] = useState(false);
  const [sessionPlanError, setSessionPlanError] = useState('');
  
  // Student search state
  const [studentSearch, setStudentSearch] = useState('');
  

  // SOAP Note dialog state
  const [soapNoteDialogOpen, setSoapNoteDialogOpen] = useState(false);
  const [selectedSessionForSOAP, setSelectedSessionForSOAP] = useState<Session | null>(null);
  const [existingSOAPNote, setExistingSOAPNote] = useState<SOAPNote | undefined>(undefined);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [formData, setFormData] = useState({
    studentIds: [] as string[], // Changed to support multiple students
    date: toLocalDateTimeString(new Date()),
    endTime: '',
    goalsTargeted: [] as string[],
    activitiesUsed: [] as string[],
    performanceData: [] as { goalId: string; studentId: string; accuracy?: string; correctTrials?: number; incorrectTrials?: number; notes?: string; cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[] }[], // Added studentId to track which student's goal
    notes: '',
    isDirectServices: true, // Default to Direct Services
    indirectServicesNotes: '',
    missedSession: false, // Whether this was a missed session (only for Direct Services)
    selectedSubjectiveStatements: [] as string[],
    customSubjective: '',
    plan: '', // Plan for next session (required for direct services)
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool]);

  // Check for URL parameter to open add session dialog
  useEffect(() => {
    const addParam = searchParams.get('add');
    if (addParam === 'true' && !dialogOpen && students.length > 0) {
      // Open dialog after data has loaded
      handleOpenDialog();
      // Clear the URL parameter
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, students.length, dialogOpen]);

  const loadData = async () => {
    try {
      const schoolStudents = await getStudents(selectedSchool);
      const studentIds = new Set(schoolStudents.map(s => s.id));
      const allSessions = await getSessions();
      const schoolSessions = allSessions
        .filter(s => studentIds.has(s.studentId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(schoolSessions);
      // Filter out archived students (archived is optional for backward compatibility)
      setStudents(schoolStudents.filter(s => s.archived !== true));
      const allGoals = await getGoals();
      setGoals(allGoals.filter(g => studentIds.has(g.studentId)));
    } catch (error) {
      console.error('Failed to load data:', error);
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
          setEditingSession(firstSession);
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
          };
          setFormData(newFormData);
          initialFormDataRef.current = JSON.parse(JSON.stringify(newFormData));
        }
      } else if (session) {
        // Editing a single session
        setEditingSession(session);
        setEditingGroupSessionId(null);
        const startDate = new Date(session.date);
        const endDate = session.endTime ? new Date(session.endTime) : null;
        // Filter out achieved goals when editing
        const activeGoalsTargeted = session.goalsTargeted.filter(gId => {
          const goal = goals.find(g => g.id === gId);
          return goal && !isGoalAchieved(goal);
        });
        
        const newFormData = {
          studentIds: [session.studentId], // Convert single student to array for editing
          date: toLocalDateTimeString(startDate),
          endTime: endDate ? toLocalDateTimeString(endDate) : '',
          goalsTargeted: activeGoalsTargeted,
          activitiesUsed: session.activitiesUsed,
          performanceData: session.performanceData
            .filter(p => activeGoalsTargeted.includes(p.goalId))
            .map(p => ({
              goalId: p.goalId,
              studentId: session.studentId, // Add studentId to performance data
              accuracy: p.accuracy?.toString() || '',
              correctTrials: p.correctTrials || 0,
              incorrectTrials: p.incorrectTrials || 0,
              notes: p.notes || '',
              cuingLevels: p.cuingLevels,
            })),
          notes: session.notes,
          isDirectServices: session.isDirectServices === true, // Explicitly check for true
          indirectServicesNotes: session.indirectServicesNotes || '',
          missedSession: session.missedSession || false,
          selectedSubjectiveStatements: session.selectedSubjectiveStatements || [],
          customSubjective: session.customSubjective || '',
          plan: session.plan || '',
        };
        setFormData(newFormData);
        initialFormDataRef.current = JSON.parse(JSON.stringify(newFormData));
      }
    } else {
      // Creating a new session
      const now = new Date();
      const defaultEndTime = new Date(now.getTime() + 30 * 60000); // Default to 30 minutes later
      setEditingSession(null);
      setEditingGroupSessionId(null);
      const newFormData = {
        studentIds: [],
        date: toLocalDateTimeString(now),
        endTime: toLocalDateTimeString(defaultEndTime),
        goalsTargeted: [],
        activitiesUsed: [],
        performanceData: [],
        notes: '',
        isDirectServices: true,
        indirectServicesNotes: '',
        missedSession: false,
        selectedSubjectiveStatements: [],
        customSubjective: '',
        plan: '',
      };
      setFormData(newFormData);
      initialFormDataRef.current = JSON.parse(JSON.stringify(newFormData));
    }
    setDialogOpen(true);
  };

  // Register the handler to open the dialog from context
  useEffect(() => {
    registerHandler(() => {
      handleOpenDialog();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerHandler]);

  const isFormDirty = () => {
    if (!initialFormDataRef.current) return false;
    const initial = initialFormDataRef.current;
    
    // Compare form data with initial state
    const hasChanges = 
      JSON.stringify(formData.studentIds.sort()) !== JSON.stringify(initial.studentIds.sort()) ||
      formData.date !== initial.date ||
      formData.endTime !== initial.endTime ||
      JSON.stringify(formData.goalsTargeted.sort()) !== JSON.stringify(initial.goalsTargeted.sort()) ||
      JSON.stringify(formData.activitiesUsed.sort()) !== JSON.stringify(initial.activitiesUsed.sort()) ||
      formData.notes !== initial.notes ||
      formData.isDirectServices !== initial.isDirectServices ||
      formData.indirectServicesNotes !== initial.indirectServicesNotes ||
      formData.missedSession !== initial.missedSession ||
      JSON.stringify(formData.selectedSubjectiveStatements.sort()) !== JSON.stringify(initial.selectedSubjectiveStatements.sort()) ||
      formData.customSubjective !== initial.customSubjective ||
      formData.plan !== initial.plan ||
      JSON.stringify(formData.performanceData) !== JSON.stringify(initial.performanceData);
    
    return hasChanges;
  };

  const handleCloseDialog = (forceClose = false) => {
    if (!forceClose && isFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close without saving?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          doCloseDialog();
        },
      });
    } else {
      doCloseDialog();
    }
  };

  const doCloseDialog = () => {
    setDialogOpen(false);
    setEditingSession(null);
    setEditingGroupSessionId(null);
    setStudentSearch('');
    initialFormDataRef.current = null;
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
          console.error('Failed to fetch last session plan:', error);
        }
      }
    }

    setFormData({
      ...formData,
      studentIds: newStudentIds,
      goalsTargeted: newGoalsTargeted,
      performanceData: newPerformanceData,
      plan: newPlan,
    });
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

    setFormData({
      ...formData,
      goalsTargeted: newGoalsTargeted,
      performanceData: newPerformanceData,
    });
  };

  const handlePerformanceUpdate = (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => {
    setFormData({
      ...formData,
      performanceData: formData.performanceData.map((p) =>
        p.goalId === goalId && p.studentId === studentId ? { ...p, [field]: value } : p
      ),
    });
  };

  const handleCuingLevelToggle = (goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => {
    setFormData({
      ...formData,
      performanceData: formData.performanceData.map((p) => {
        if (p.goalId !== goalId || p.studentId !== studentId) return p;
        const currentLevels = p.cuingLevels || [];
        const newLevels = currentLevels.includes(cuingLevel)
          ? currentLevels.filter(l => l !== cuingLevel)
          : [...currentLevels, cuingLevel];
        return { ...p, cuingLevels: newLevels };
      }),
    });
  };

  const handleTrialUpdate = (goalId: string, studentId: string, isCorrect: boolean) => {
    setFormData({
      ...formData,
      performanceData: formData.performanceData.map((p) => {
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
      }),
    });
  };

  const handleSave = async () => {
    if (formData.studentIds.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one student',
        severity: 'error',
      });
      return;
    }

    // Validate required fields for direct services
    if (formData.isDirectServices) {
      // Subjective is required: either checkbox selected OR custom text entered
      const hasSubjective = formData.selectedSubjectiveStatements.length > 0 || formData.customSubjective.trim().length > 0;
      if (!hasSubjective) {
        setSnackbar({
          open: true,
          message: 'Please select at least one subjective statement or enter a custom subjective statement.',
          severity: 'error',
        });
        return;
      }
      
      // Plan is required for direct services
      if (!formData.plan.trim()) {
        setSnackbar({
          open: true,
          message: 'Please enter a plan for the next session.',
          severity: 'error',
        });
        return;
      }
    }

    // Reset initial form data before saving to prevent dirty check from triggering
    initialFormDataRef.current = null;

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
          await updateSession(existingSession.id, sessionData);
          groupSessions.push(sessionData);
        } else {
          await addSession(sessionData);
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
            await updateSOAPNote(existingGroupSOAPNote.id, updatedSOAPNote);
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
            await addSOAPNote(soapNote);
          }
        } catch (error) {
          console.error('Failed to auto-generate group SOAP note:', error);
          // Don't fail the session save if SOAP note generation fails
        }
      }
      
      // Delete sessions for students that were removed from the group
      for (const existingSession of existingGroupSessions) {
        if (!formData.studentIds.includes(existingSession.studentId)) {
          await deleteSession(existingSession.id);
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
          await updateSession(editingSession.id, sessionData);
        } else {
          await addSession(sessionData);
          createdSessions.push(sessionData);
          
          // For individual sessions, auto-generate SOAP note
          if (!groupSessionId && sessionData.isDirectServices && !sessionData.missedSession) {
            try {
              const student = students.find(s => s.id === studentId);
              if (student) {
                const studentGoals = goals.filter(g => g.studentId === studentId);
                const generated = generateSOAPNote(
                  sessionData,
                  student,
                  studentGoals,
                  sessionData.selectedSubjectiveStatements || [],
                  sessionData.customSubjective || ''
                );
                
                const soapNote: SOAPNote = {
                  id: generateId(),
                  sessionId: sessionData.id,
                  studentId: studentId,
                  date: sessionData.date,
                  subjective: generated.subjective,
                  objective: generated.objective,
                  assessment: generated.assessment,
                  plan: generated.plan,
                  dateCreated: new Date().toISOString(),
                  dateUpdated: new Date().toISOString(),
                };
                
                await addSOAPNote(soapNote);
              }
            } catch (error) {
              console.error('Failed to auto-generate SOAP note:', error);
              // Don't fail the session save if SOAP note generation fails
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
          
          await addSOAPNote(soapNote);
        } catch (error) {
          console.error('Failed to auto-generate group SOAP note:', error);
          // Don't fail the session save if SOAP note generation fails
        }
      }
    }

      await loadData();
      doCloseDialog(); // Use doCloseDialog directly since we've already saved
      setSnackbar({
        open: true,
        message: editingSession ? 'Session updated successfully' : 'Session created successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to save session:', error);
      alert('Failed to save session. Please try again.');
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
          await deleteSession(id);
          await loadData();
          setSnackbar({
            open: true,
            message: 'Session deleted successfully',
            severity: 'success',
          });
        } catch (error) {
          console.error('Failed to delete session:', error);
          alert('Failed to delete session. Please try again.');
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
      setSoapNoteDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch latest session:', error);
      // Fallback to using the session from state or parameter
      const latestSession = sessions.find(s => s.id === session.id) || session;
      setSelectedSessionForSOAP(latestSession);
      const existingNotes = await getSOAPNotesBySession(latestSession.id);
      if (existingNotes.length > 0) {
        setExistingSOAPNote(existingNotes[0]);
      } else {
        setExistingSOAPNote(undefined);
      }
      setSoapNoteDialogOpen(true);
    }
  };

  const handleSaveSOAPNote = async (soapNote: SOAPNote) => {
    try {
      if (existingSOAPNote) {
        await updateSOAPNote(soapNote.id, soapNote);
      } else {
        await addSOAPNote(soapNote);
      }
      setSoapNoteDialogOpen(false);
      setSelectedSessionForSOAP(null);
      setExistingSOAPNote(undefined);
    } catch (error) {
      console.error('Failed to save SOAP note:', error);
      alert('Failed to save SOAP note. Please try again.');
    }
  };

  const handleGenerateSessionPlan = async () => {
    if (!planStudentId) {
      setSessionPlanError('Please select a student');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setSessionPlanError('Please set your Gemini API key in Settings');
      return;
    }

    const student = students.find(s => s.id === planStudentId);
    if (!student) {
      setSessionPlanError('Student not found');
      return;
    }

    const studentGoals = goals.filter(g => g.studentId === planStudentId);
    if (studentGoals.length === 0) {
      setSessionPlanError('Selected student has no goals. Please add goals first.');
      return;
    }

    setLoadingSessionPlan(true);
    setSessionPlanError('');

    try {
      const recentSessions = (await getSessionsByStudent(planStudentId))
        .slice(0, 3)
        .map(s => ({
          date: formatDateTime(s.date),
          activitiesUsed: s.activitiesUsed,
          notes: s.notes,
        }));

      const plan = await generateSessionPlan(
        apiKey,
        student.name,
        student.age,
        studentGoals.map(g => ({
          description: g.description,
          baseline: g.baseline,
          target: g.target,
        })),
        recentSessions
      );
      setSessionPlan(plan);
    } catch (err) {
      setSessionPlanError(err instanceof Error ? err.message : 'Failed to generate session plan');
    } finally {
      setLoadingSessionPlan(false);
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
              setPlanStudentId('');
              setSessionPlan('');
              setSessionPlanError('');
              setSessionPlanDialogOpen(true);
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
        ) : (() => {
          // Group sessions by groupSessionId
          const groupedSessions = new Map<string, Session[]>();
          const individualSessions: Session[] = [];

          sessions.forEach((session) => {
            if (session.groupSessionId) {
              if (!groupedSessions.has(session.groupSessionId)) {
                groupedSessions.set(session.groupSessionId, []);
              }
              groupedSessions.get(session.groupSessionId)!.push(session);
            } else {
              individualSessions.push(session);
            }
          });

          // Create a combined array of all session entries, sorted chronologically (most recent first)
          interface SessionDisplayItem {
            type: 'group' | 'individual';
            groupSessionId?: string;
            groupSessions?: Session[];
            session?: Session;
            date: string; // For sorting
          }

          const allSessionItems: SessionDisplayItem[] = [];

          // Add group sessions (one entry per group)
          groupedSessions.forEach((groupSessions, groupSessionId) => {
            const firstSession = groupSessions[0];
            allSessionItems.push({
              type: 'group',
              groupSessionId,
              groupSessions,
              date: firstSession.date,
            });
          });

          // Add individual sessions
          individualSessions.forEach((session) => {
            allSessionItems.push({
              type: 'individual',
              session,
              date: session.date,
            });
          });

          // Sort all items by date (most recent first)
          allSessionItems.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA; // Most recent first
          });

          // Helper function to render a single session
          const renderSession = (session: Session) => (
            <SessionCard
              key={session.id}
              session={session}
              getStudentName={getStudentName}
              getGoalDescription={getGoalDescription}
              onEdit={handleOpenDialog}
              onDelete={handleDelete}
              onGenerateSOAP={handleGenerateSOAP}
            />
          );

          return (
            <>
              {/* All Sessions - Group and Individual intermingled chronologically */}
              {allSessionItems.map((item) => {
                if (item.type === 'group' && item.groupSessions && item.groupSessionId) {
                  return (
                    <Grid item xs={12} key={item.groupSessionId}>
                      <GroupSessionAccordion
                        groupSessionId={item.groupSessionId}
                        groupSessions={item.groupSessions}
                        getStudentName={getStudentName}
                        renderSession={renderSession}
                        onEdit={(groupSessionId) => handleOpenDialog(undefined, groupSessionId)}
                      />
                    </Grid>
                  );
                } else if (item.type === 'individual' && item.session) {
                  return (
                    <Grid item xs={12} key={item.session.id}>
                      {renderSession(item.session)}
                    </Grid>
                  );
                }
                return null;
              })}
            </>
          );
        })()}
      </Grid>

      <SessionFormDialog
        open={dialogOpen}
        editingSession={editingSession}
        editingGroupSessionId={editingGroupSessionId}
        students={students}
        goals={goals}
        sessions={sessions}
        formData={formData}
        studentSearch={studentSearch}
        onClose={handleCloseDialog}
        onSave={handleSave}
        onFormDataChange={(updates) => setFormData({ ...formData, ...updates })}
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
        open={sessionPlanDialogOpen}
        onClose={() => setSessionPlanDialogOpen(false)}
        students={students}
        planStudentId={planStudentId}
        sessionPlan={sessionPlan}
        sessionPlanError={sessionPlanError}
        loadingSessionPlan={loadingSessionPlan}
        onStudentChange={setPlanStudentId}
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
    </Box>
  );
};

