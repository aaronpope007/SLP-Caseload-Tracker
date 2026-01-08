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
      // Filter out any undefined or null values to prevent errors
      const validGoals = loadedGoals.filter((g): g is Goal => g !== undefined && g !== null);
      setGoals(validGoals);
    } catch (err) {
      logError('Failed to load goals', err);
      setError('Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [studentId, school]);

  const createGoal = useCallback(async (goalData: Partial<Goal> | Goal): Promise<Goal | null> => {
    if (!studentId) return null;

    try {
      // Construct the complete goal object
      const goalToCreate: Goal = {
        ...goalData,
        studentId,
        school,
      } as Goal;
      
      // Ensure the goal has required fields
      if (!goalToCreate.id) {
        logError('Goal missing required id field', { goalToCreate });
        throw new Error('Failed to create goal: missing required id field');
      }
      
      // Save the goal (addGoal returns void)
      await addGoal(goalToCreate);
      
      setGoals((prev) => {
        // Filter out any undefined values and add the new goal
        const validGoals = prev.filter((g): g is Goal => g !== undefined && g !== null);
        return [...validGoals, goalToCreate];
      });
      onGoalAdded?.(goalToCreate);
      return goalToCreate;
    } catch (err) {
      logError('Failed to create goal', err);
      setError('Failed to create goal');
      throw err;
    }
  }, [studentId, school, onGoalAdded]);

  const updateGoalById = useCallback(async (goalId: string, updates: Partial<Goal>): Promise<Goal | null> => {
    try {
      // Update the goal
      await updateGoal(goalId, updates);
      
      // Use functional update to get the existing goal and construct the updated one
      let updatedGoal: Goal | null = null;
      setGoals((prev) => {
        // Filter out any undefined values first
        const validGoals = prev.filter((g): g is Goal => g !== undefined && g !== null);
        
        // Find the existing goal
        const existingGoal = validGoals.find((g) => g.id === goalId);
        if (!existingGoal) {
          logError('Goal not found for update', { goalId });
          return validGoals;
        }

        // Construct the updated goal by merging existing goal with updates
        updatedGoal = {
          ...existingGoal,
          ...updates,
        };
        
        return validGoals.map((g) => (g.id === goalId ? updatedGoal! : g));
      });
      
      if (updatedGoal) {
        onGoalUpdated?.(updatedGoal);
        return updatedGoal;
      }
      return null;
    } catch (err) {
      logError('Failed to update goal', err);
      setError('Failed to update goal');
      throw err;
    }
  }, [onGoalUpdated]);

  const removeGoal = useCallback(async (goalId: string): Promise<void> => {
    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g !== undefined && g !== null && g.id !== goalId));
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

