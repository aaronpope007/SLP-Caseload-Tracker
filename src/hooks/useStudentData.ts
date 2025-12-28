import { useCallback } from 'react';
import type { Student } from '../types';
import { getStudents } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseStudentDataParams {
  studentId: string | undefined;
  selectedSchool: string;
  setStudent: (student: Student | null) => void;
}

export const useStudentData = ({
  studentId,
  selectedSchool,
  setStudent,
}: UseStudentDataParams) => {
  const loadStudent = useCallback(async () => {
    if (studentId) {
      try {
        const students = await getStudents(selectedSchool);
        const found = students.find((s) => s.id === studentId);
        setStudent(found || null);
      } catch (error) {
        logError('Failed to load student', error);
      }
    }
  }, [studentId, selectedSchool, setStudent]);

  return { loadStudent };
};

