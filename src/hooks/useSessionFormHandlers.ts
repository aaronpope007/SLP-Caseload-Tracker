import { useCallback } from 'react';
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
  editingSession: any;
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
  const handleStudentToggle = useCallback(async (studentId: string) => {
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
  }, [formData, goals, editingSession, editingGroupSessionId, updateFormField]);

  const handleGoalToggle = useCallback((goalId: string, studentId: string) => {
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
  }, [formData, updateFormField]);

  const handlePerformanceUpdate = useCallback((goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => {
    updateFormField('performanceData', formData.performanceData.map((p) =>
      p.goalId === goalId && p.studentId === studentId ? { ...p, [field]: value } : p
    ));
  }, [formData.performanceData, updateFormField]);

  const handleCuingLevelToggle = useCallback((goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => {
    updateFormField('performanceData', formData.performanceData.map((p) => {
      if (p.goalId !== goalId || p.studentId !== studentId) return p;
      const currentLevels = p.cuingLevels || [];
      const newLevels = currentLevels.includes(cuingLevel)
        ? currentLevels.filter(l => l !== cuingLevel)
        : [...currentLevels, cuingLevel];
      return { ...p, cuingLevels: newLevels };
    }));
  }, [formData.performanceData, updateFormField]);

  const handleTrialUpdate = useCallback((goalId: string, studentId: string, isCorrect: boolean) => {
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
  }, [formData.performanceData, updateFormField]);

  return {
    handleStudentToggle,
    handleGoalToggle,
    handlePerformanceUpdate,
    handleCuingLevelToggle,
    handleTrialUpdate,
  };
};

