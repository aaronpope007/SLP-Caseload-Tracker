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
  // Memoize sessions by goal/student to avoid recalculating on every call
  // Optimized to build cache in a single pass through sessions
  const performanceCache = useMemo(() => {
    const cache = new Map<string, { recentSessions: any[], average: number | null }>();
    
    // Group sessions by goal/student combination for efficient processing
    const goalStudentMap = new Map<string, typeof sessions>();
    
    // Single pass: collect sessions by goal/student key
    sessions.forEach(session => {
      session.goalsTargeted.forEach(goalId => {
        const key = `${goalId}:${session.studentId}`;
        if (!goalStudentMap.has(key)) {
          goalStudentMap.set(key, []);
        }
        goalStudentMap.get(key)!.push(session);
      });
    });
    
    // Process each goal/student combination
    goalStudentMap.forEach((goalSessions, key) => {
      // Sort by date descending and take top 3
      const sortedSessions = [...goalSessions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);
      
      const [goalId] = key.split(':');
      const recentData = sortedSessions.map(s => {
        const perf = s.performanceData.find((p: { goalId: string }) => p.goalId === goalId);
        const accuracy = perf?.accuracy;
        // Parse accuracy to number if it's a string
        const accuracyNum = typeof accuracy === 'string' ? parseFloat(accuracy) : accuracy;
        return {
          date: s.date,
          accuracy: accuracyNum,
          correctTrials: perf?.correctTrials,
          incorrectTrials: perf?.incorrectTrials,
        };
      }).filter(d => {
        const accuracy = d.accuracy;
        return accuracy !== undefined && accuracy !== null && !isNaN(accuracy) && isFinite(accuracy);
      });

      const average = recentData.length > 0
        ? Math.round(recentData.reduce((sum, d) => sum + (d.accuracy || 0), 0) / recentData.length)
        : null;

      cache.set(key, { recentSessions: recentData, average });
    });
    
    return cache;
  }, [sessions]);
  
  const getRecentPerformance = useCallback((goalId: string, targetStudentId?: string) => {
    const effectiveStudentId = targetStudentId || studentId;
    if (!effectiveStudentId) return { recentSessions: [], average: null };
    
    const key = `${goalId}:${effectiveStudentId}`;
    const cached = performanceCache.get(key);
    
    if (cached) {
      return cached;
    }
    
    // Fallback for goals not in cache
    return { recentSessions: [], average: null };
  }, [performanceCache, studentId]);

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

