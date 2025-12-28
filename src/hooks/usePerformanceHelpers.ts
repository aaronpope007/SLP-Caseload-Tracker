import { useCallback, useMemo } from 'react';
import type { Session, Goal } from '../types';

interface UsePerformanceHelpersParams {
  sessions: Session[];
  goals: Goal[];
  studentId?: string;
}

export const usePerformanceHelpers = ({
  sessions,
  goals,
  studentId,
}: UsePerformanceHelpersParams) => {
  const getRecentPerformance = useCallback((goalId: string, targetStudentId?: string) => {
    const effectiveStudentId = targetStudentId || studentId;
    if (!effectiveStudentId) return { recentSessions: [], average: null };
    
    const goalSessions = sessions
      .filter(s => s.studentId === effectiveStudentId && s.goalsTargeted.includes(goalId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
    
    const recentData = goalSessions.map(s => {
      const perf = s.performanceData.find((p: { goalId: string }) => p.goalId === goalId);
      return {
        date: s.date,
        accuracy: perf?.accuracy,
        correctTrials: perf?.correctTrials,
        incorrectTrials: perf?.incorrectTrials,
      };
    }).filter(d => d.accuracy !== undefined);

    const average = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + (d.accuracy || 0), 0) / recentData.length
      : null;

    return { recentSessions: recentData, average };
  }, [sessions, studentId]);

  const isGoalAchieved = useCallback((goal: Goal): boolean => {
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
  }, [goals]);

  return { getRecentPerformance, isGoalAchieved };
};

