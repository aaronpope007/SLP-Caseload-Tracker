import { useCallback } from 'react';
import type { Session, Student, Goal, SOAPNote } from '../types';
import { generateId, fromLocalDateTimeString } from '../utils/helpers';
import { getSessions, getSOAPNotesBySession } from '../utils/storage-api';
import { generateSOAPNote, generateGroupSOAPNote } from '../utils/soapNoteGenerator';
import { logError } from '../utils/logger';

interface UseSessionSaveParams {
  formData: {
    studentIds: string[];
    date: string;
    endTime: string;
    goalsTargeted: string[];
    activitiesUsed: string[];
    performanceData: Array<{
      goalId: string;
      studentId: string;
      accuracy?: string;
      correctTrials?: number;
      incorrectTrials?: number;
      notes?: string;
      cuingLevels?: Array<'independent' | 'verbal' | 'visual' | 'tactile' | 'physical'>;
    }>;
    notes: string;
    isDirectServices: boolean;
    indirectServicesNotes: string;
    missedSession: boolean;
    selectedSubjectiveStatements: string[];
    customSubjective: string;
    plan: string;
  };
  editingSession: Session | null;
  editingGroupSessionId: string | null;
  students: Student[];
  goals: Goal[];
  createSession: (session: Session) => Promise<Session | null>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  createSOAPNote: (note: SOAPNote) => Promise<void>;
  updateSOAPNote: (id: string, note: SOAPNote) => Promise<void>;
  isGoalAchieved: (goal: Goal) => boolean;
  loadData: () => Promise<void>;
  closeDialog: () => void;
  resetForm: () => void;
  setStudentSearch: (search: string) => void;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
}

export const useSessionSave = ({
  formData,
  editingSession,
  editingGroupSessionId,
  students,
  goals,
  createSession,
  updateSession,
  deleteSession,
  createSOAPNote,
  updateSOAPNote,
  isGoalAchieved,
  loadData,
  closeDialog,
  resetForm,
  setStudentSearch,
  showSnackbar,
}: UseSessionSaveParams) => {
  const handleSave = useCallback(async () => {
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
            await updateSession(existingSession.id, sessionData);
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
              await createSOAPNote(soapNote);
            }
          } catch (error) {
            logError('Failed to auto-generate group SOAP note', error);
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
          : (isEditingSingleSession && editingSession && editingSession.groupSessionId) 
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
            id: isEditingSingleSession && editingSession
              ? editingSession.id
              : generateId(),
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

          if (isEditingSingleSession && editingSession) {
            await updateSession(editingSession.id, sessionData);
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
                    
                    await createSOAPNote(soapNote);
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
            
            await createSOAPNote(soapNote);
          } catch (error) {
            logError('Failed to auto-generate group SOAP note', error);
            // Don't fail the session save if SOAP note generation fails
          }
        }
      }

      await loadData();
      closeDialog();
      resetForm();
      setStudentSearch('');
      showSnackbar(editingSession ? 'Session updated successfully' : 'Session created successfully', 'success');
    } catch (error) {
      logError('Failed to save session', error);
      showSnackbar('Failed to save session. Please try again.', 'error');
    }
  }, [
    formData,
    editingSession,
    editingGroupSessionId,
    students,
    goals,
    createSession,
    updateSession,
    deleteSession,
    createSOAPNote,
    updateSOAPNote,
    isGoalAchieved,
    loadData,
    closeDialog,
    resetForm,
    setStudentSearch,
    showSnackbar,
  ]);

  return { handleSave };
};

