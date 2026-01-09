import { useCallback } from 'react';
import type { Session, Goal } from '../types';
import type { SessionFormData } from '../components/session/SessionFormDialog';
import { getSessions } from '../utils/storage-api';
import { toLocalDateTimeString } from '../utils/helpers';

interface UseSessionDialogHandlersParams {
  formData: {
    performanceData: Array<{
      goalId: string;
      studentId: string;
      accuracy?: string;
      correctTrials?: number;
      incorrectTrials?: number;
      notes?: string;
      cuingLevels?: Array<'independent' | 'verbal' | 'visual' | 'tactile' | 'physical'>;
    }>;
  };
  goals: Goal[];
  setEditingGroupSessionId: (id: string | null) => void;
  setFormData: (data: any) => void;
  initializeForm: (session?: Session, parentGoal?: any) => void;
  isGoalAchieved: (goal: Goal) => boolean;
  openDialog: () => void;
}

export const useSessionDialogHandlers = ({
  formData,
  goals,
  setEditingGroupSessionId,
  setFormData,
  initializeForm,
  isGoalAchieved,
  openDialog,
}: UseSessionDialogHandlersParams) => {
  const handleOpenDialog = useCallback(async (session?: Session, groupSessionId?: string) => {
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
            (s.goalsTargeted || []).forEach(gId => {
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
        // Filter out achieved goals when editing
        const activeGoalsTargeted = (session.goalsTargeted || []).filter(gId => {
          const goal = goals.find(g => g.id === gId);
          return goal && !isGoalAchieved(goal);
        });
        
        initializeForm(session, null);
      }
    } else {
      // Creating a new session
      initializeForm();
    }
    openDialog();
  }, [
    formData,
    goals,
    setEditingGroupSessionId,
    setFormData,
    initializeForm,
    isGoalAchieved,
    openDialog,
  ]);

  return { handleOpenDialog };
};

