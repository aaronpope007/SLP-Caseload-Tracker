import { useCallback, useMemo } from 'react';
import type { Student, Goal } from '../types';

interface UseLookupHelpersParams {
  students: Student[];
  goals: Goal[];
}

export const useLookupHelpers = ({
  students,
  goals,
}: UseLookupHelpersParams) => {
  const getStudentName = useCallback((studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || 'Unknown';
  }, [students]);

  const getGoalDescription = useCallback((goalId: string) => {
    return goals.find((g) => g.id === goalId)?.description || 'Unknown Goal';
  }, [goals]);

  return { getStudentName, getGoalDescription };
};

