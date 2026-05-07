import { useCallback, useRef, useEffect } from 'react';
import type { Student, Goal, Session } from '../types';
import { getStudents, getGoals } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseSessionDataLoaderParams {
  selectedSchool: string;
  setStudents: (students: Student[]) => void;
  setGoals: (goals: Goal[]) => void;
  loadSessions: (opts?: { studentId?: string; limit?: number }) => Promise<void>;
  /** When set, the loader fetches the full session history for that student. Otherwise only the most recent N sessions are fetched. */
  studentId?: string;
  /** Cap for the initial (no student selected) load. Defaults to 20. */
  defaultLimit?: number;
}

export const useSessionDataLoader = ({
  selectedSchool,
  setStudents,
  setGoals,
  loadSessions,
  studentId,
  defaultLimit = 20,
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
      if (studentId) {
        // Full history for the selected student.
        await loadSessions({ studentId });
      } else {
        // No student selected: only fetch the most recent N sessions to keep this tab snappy.
        await loadSessions({ limit: defaultLimit });
      }
      if (!isMountedRef.current) return;
      // Filter out archived students (archived is optional for backward compatibility)
      setStudents(schoolStudents.filter(s => s.archived !== true));
      // Sessions/history should be able to resolve archived goals too.
      const allGoals = await getGoals(true);
      if (!isMountedRef.current) return;
      setGoals(allGoals.filter(g => studentIds.has(g.studentId)));
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to load data', error);
    }
  }, [selectedSchool, setStudents, setGoals, loadSessions, studentId, defaultLimit]);

  return { loadData };
};

