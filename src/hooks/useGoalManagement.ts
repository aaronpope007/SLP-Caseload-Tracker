import { useState, useCallback } from 'react';
import type { Goal } from '../types';
import { getGoalsByStudent, addGoal, updateGoal, deleteGoal } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseGoalManagementOptions {
  studentId: string;
  school?: string;
  onGoalAdded?: (goal: Goal) => void;
  onGoalUpdated?: (goal: Goal) => void;
  onGoalDeleted?: (goalId: string) => void;
}

export const useGoalManagement = ({
  studentId,
  school,
  onGoalAdded,
  onGoalUpdated,
  onGoalDeleted,
}: UseGoalManagementOptions) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadGoals = useCallback(async () => {
    if (!studentId) return;
    
    setLoading(true);
    setError(undefined);
    try {
      const loadedGoals = await getGoalsByStudent(studentId, school);
      setGoals(loadedGoals);
    } catch (err) {
      logError('Failed to load goals', err);
      setError('Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [studentId, school]);

  const createGoal = useCallback(async (goalData: Partial<Goal>): Promise<Goal | null> => {
    if (!studentId) return null;

    try {
      const newGoal = await addGoal({
        ...goalData,
        studentId,
        school,
      } as Goal);
      
      setGoals((prev) => [...prev, newGoal]);
      onGoalAdded?.(newGoal);
      return newGoal;
    } catch (err) {
      logError('Failed to create goal', err);
      setError('Failed to create goal');
      throw err;
    }
  }, [studentId, school, onGoalAdded]);

  const updateGoalById = useCallback(async (goalId: string, updates: Partial<Goal>): Promise<Goal | null> => {
    try {
      const updatedGoal = await updateGoal(goalId, updates);
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updatedGoal : g)));
      onGoalUpdated?.(updatedGoal);
      return updatedGoal;
    } catch (err) {
      logError('Failed to update goal', err);
      setError('Failed to update goal');
      throw err;
    }
  }, [onGoalUpdated]);

  const removeGoal = useCallback(async (goalId: string): Promise<void> => {
    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      onGoalDeleted?.(goalId);
    } catch (err) {
      logError('Failed to delete goal', err);
      setError('Failed to delete goal');
      throw err;
    }
  }, [onGoalDeleted]);

  return {
    goals,
    loading,
    error,
    loadGoals,
    createGoal,
    updateGoal: updateGoalById,
    deleteGoal: removeGoal,
    setGoals, // Allow manual updates if needed
  };
};

