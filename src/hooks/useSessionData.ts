import { useCallback } from 'react';
import type { Session } from '../types';
import { getSessionsByStudent } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseSessionDataParams {
  studentId: string | undefined;
  selectedSchool: string;
  setSessions: (sessions: Session[]) => void;
}

export const useSessionData = ({
  studentId,
  selectedSchool,
  setSessions,
}: UseSessionDataParams) => {
  const loadSessions = useCallback(async () => {
    if (studentId) {
      try {
        const studentSessions = await getSessionsByStudent(studentId, selectedSchool);
        setSessions(studentSessions);
      } catch (error) {
        logError('Failed to load sessions', error);
      }
    }
  }, [studentId, selectedSchool, setSessions]);

  return { loadSessions };
};

