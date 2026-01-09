import { useCallback, useRef } from 'react';
import type { Goal } from '../types';
import { getSessionsByStudent } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseSessionFormHandlersParams {
  formData: {
    studentIds: string[];
    goalsTargeted: string[];
    performanceData: Array<{
      goalId: string;
      studentId: string;
      accuracy?: string;
      correctTrials?: number;
      incorrectTrials?: number;
      notes?: string;
      cuingLevels?: Array<'independent' | 'verbal' | 'visual' | 'tactile' | 'physical'>;
    }>;
    plan: string;
  };
  goals: Goal[];
  editingSession: Session | null;
  editingGroupSessionId: string | undefined;
  updateFormField: (field: string, value: any) => void;
  isGoalAchieved: (goal: Goal) => boolean;
}

export const useSessionFormHandlers = ({
  formData,
  goals,
  editingSession,
  editingGroupSessionId,
  updateFormField,
  isGoalAchieved,
}: UseSessionFormHandlersParams) => {
  // Use refs to keep callbacks stable - prevents memory leaks from excessive re-renders
  const formDataRef = useRef(formData);
  const goalsRef = useRef(goals);
  const editingSessionRef = useRef(editingSession);
  const editingGroupSessionIdRef = useRef(editingGroupSessionId);
  
  // Update refs on each render (direct assignment is more efficient than useEffect)
  formDataRef.current = formData;
  goalsRef.current = goals;
  editingSessionRef.current = editingSession;
  editingGroupSessionIdRef.current = editingGroupSessionId;

  const handleStudentToggle = useCallback(async (studentId: string) => {
    const currentFormData = formDataRef.current;
    const currentGoals = goalsRef.current;
    const currentEditingSession = editingSessionRef.current;
    const currentEditingGroupSessionId = editingGroupSessionIdRef.current;
    
    const isSelected = currentFormData.studentIds.includes(studentId);
    let newStudentIds: string[];
    let newGoalsTargeted: string[] = [...currentFormData.goalsTargeted];
    let newPerformanceData = [...currentFormData.performanceData];
    let newPlan = currentFormData.plan;

    if (isSelected) {
      // Remove student
      newStudentIds = currentFormData.studentIds.filter(id => id !== studentId);
      // Remove goals and performance data for this student
      const studentGoals = currentGoals.filter(g => g.studentId === studentId).map(g => g.id);
      newGoalsTargeted = currentFormData.goalsTargeted.filter(gId => !studentGoals.includes(gId));
      newPerformanceData = currentFormData.performanceData.filter(p => p.studentId !== studentId);
    } else {
      // Add student
      newStudentIds = [...currentFormData.studentIds, studentId];
      
      // If this is the first student selected and we're creating a new session, fetch last session's plan
      if (currentFormData.studentIds.length === 0 && !currentEditingSession && !currentEditingGroupSessionId) {
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
  }, [updateFormField]);

  const handleGoalToggle = useCallback((goalId: string, studentId: string) => {
    const currentFormData = formDataRef.current;
    const isSelected = currentFormData.goalsTargeted.includes(goalId);
    let newGoalsTargeted: string[];
    let newPerformanceData = [...currentFormData.performanceData];

    if (isSelected) {
      newGoalsTargeted = currentFormData.goalsTargeted.filter((id) => id !== goalId);
      newPerformanceData = newPerformanceData.filter((p) => p.goalId !== goalId || p.studentId !== studentId);
    } else {
      newGoalsTargeted = [...currentFormData.goalsTargeted, goalId];
      newPerformanceData.push({ goalId, studentId, notes: '', cuingLevels: [] }); // Don't initialize accuracy - let it be undefined so calculated shows
    }

    updateFormField('goalsTargeted', newGoalsTargeted);
    updateFormField('performanceData', newPerformanceData);
  }, [updateFormField]);

  const handlePerformanceUpdate = useCallback((goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => {
    const currentFormData = formDataRef.current;
    updateFormField('performanceData', currentFormData.performanceData.map((p) =>
      p.goalId === goalId && p.studentId === studentId ? { ...p, [field]: value } : p
    ));
  }, [updateFormField]);

  const handleCuingLevelToggle = useCallback((goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => {
    const currentFormData = formDataRef.current;
    updateFormField('performanceData', currentFormData.performanceData.map((p) => {
      if (p.goalId !== goalId || p.studentId !== studentId) return p;
      const currentLevels = p.cuingLevels || [];
      const newLevels = currentLevels.includes(cuingLevel)
        ? currentLevels.filter(l => l !== cuingLevel)
        : [...currentLevels, cuingLevel];
      return { ...p, cuingLevels: newLevels };
    }));
  }, [updateFormField]);

  const handleTrialUpdate = useCallback((goalId: string, studentId: string, isCorrect: boolean) => {
    const currentFormData = formDataRef.current;
    updateFormField('performanceData', currentFormData.performanceData.map((p) => {
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
  }, [updateFormField]);

  return {
    handleStudentToggle,
    handleGoalToggle,
    handlePerformanceUpdate,
    handleCuingLevelToggle,
    handleTrialUpdate,
  };
};

