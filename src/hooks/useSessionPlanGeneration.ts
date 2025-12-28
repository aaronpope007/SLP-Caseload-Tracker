import { useCallback } from 'react';
import type { Student, Goal } from '../types';
import { getSessionsByStudent } from '../utils/storage-api';
import { formatDateTime } from '../utils/helpers';

interface UseSessionPlanGenerationParams {
  students: Student[];
  goals: Goal[];
  planStudentId: string | null;
  apiKey: string;
  setError: (error: string) => void;
  generatePlan: (name: string, age: number, goals: Array<{ description: string; baseline: string; target: string }>, recentSessions: Array<{ date: string; activitiesUsed: string[]; notes: string }>) => Promise<void>;
}

export const useSessionPlanGeneration = ({
  students,
  goals,
  planStudentId,
  apiKey,
  setError,
  generatePlan,
}: UseSessionPlanGenerationParams) => {
  const handleGenerateSessionPlan = useCallback(async () => {
    if (!planStudentId) {
      setError('Please select a student');
      return;
    }

    if (!apiKey) {
      setError('Please set your Gemini API key in Settings');
      return;
    }

    const student = students.find(s => s.id === planStudentId);
    if (!student) {
      setError('Student not found');
      return;
    }

    const studentGoals = goals.filter(g => g.studentId === planStudentId);
    if (studentGoals.length === 0) {
      setError('Selected student has no goals. Please add goals first.');
      return;
    }

    try {
      const recentSessions = (await getSessionsByStudent(planStudentId))
        .slice(0, 3)
        .map(s => ({
          date: formatDateTime(s.date),
          activitiesUsed: s.activitiesUsed,
          notes: s.notes,
        }));

      await generatePlan(
        student.name,
        student.age,
        studentGoals.map(g => ({
          description: g.description,
          baseline: g.baseline,
          target: g.target,
        })),
        recentSessions
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate session plan');
    }
  }, [students, goals, planStudentId, apiKey, setError, generatePlan]);

  return { handleGenerateSessionPlan };
};

