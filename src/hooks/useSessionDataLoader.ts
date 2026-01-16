import { useCallback, useRef, useEffect } from 'react';
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
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      const schoolStudents = await getStudents(selectedSchool);
      if (!isMountedRef.current) return;
      const studentIds = new Set(schoolStudents.map(s => s.id));
      await loadSessions();
      if (!isMountedRef.current) return;
      // Filter out archived students (archived is optional for backward compatibility)
      setStudents(schoolStudents.filter(s => s.archived !== true));
      const allGoals = await getGoals();
      if (!isMountedRef.current) return;
      setGoals(allGoals.filter(g => studentIds.has(g.studentId)));
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to load data', error);
    }
  }, [selectedSchool, setStudents, setGoals, loadSessions]);

  return { loadData };
};

