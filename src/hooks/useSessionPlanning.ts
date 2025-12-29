import { useState, useCallback } from 'react';
import { generateSessionPlan } from '../utils/gemini';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/validators';
import type { Goal } from '../types';

interface UseSessionPlanningOptions {
  apiKey: string;
}

export const useSessionPlanning = ({ apiKey }: UseSessionPlanningOptions) => {
  const [sessionPlan, setSessionPlan] = useState('');
  const [planStudentId, setPlanStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generatePlan = useCallback(async (
    studentName: string,
    studentAge: number,
    goals: Array<{ description: string; baseline: string; target: string }>,
    recentSessions?: Array<{ date: string; activitiesUsed: string[]; notes?: string }>
  ) => {
    if (!apiKey) {
      setError('API key is required. Please configure it in Settings.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const plan = await generateSessionPlan(
        apiKey,
        studentName,
        studentAge,
        goals,
        recentSessions
      );
      setSessionPlan(plan);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logError('Failed to generate session plan', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const reset = useCallback(() => {
    setSessionPlan('');
    setPlanStudentId('');
    setError('');
  }, []);

  return {
    sessionPlan,
    planStudentId,
    loading,
    error,
    generatePlan,
    setPlanStudentId,
    setSessionPlan,
    reset,
  };
};

