import { useCallback } from 'react';
import type { Student, Goal, Session } from '../types';
import { getStudents, getGoals, getSessions } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseSessionDataLoaderParams {
  selectedSchool: string;
  setStudents: (students: Student[]) => void;
  setGoals: (goals: Goal[]) => void;
  loadSessions: () => Promise<void>;
}

export const useSessionDataLoader = ({
  selectedSchool,
  setStudents,
  setGoals,
  loadSessions,
}: UseSessionDataLoaderParams) => {
  const loadData = useCallback(async () => {
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
  }, [selectedSchool, setStudents, setGoals, loadSessions]);

  return { loadData };
};

