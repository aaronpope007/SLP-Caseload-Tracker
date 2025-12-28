import { useState, useCallback } from 'react';
import type { Goal } from '../types';
import { getGoals } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseQuickGoalsParams {
  studentId: string;
  createGoal: (goal: Goal) => Promise<Goal>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  loadGoals: () => Promise<void>;
  loadSessions: () => Promise<void>;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
}

export const useQuickGoals = ({
  studentId,
  createGoal,
  updateGoal,
  loadGoals,
  loadSessions,
  showSnackbar,
}: UseQuickGoalsParams) => {
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [parentDomain, setParentDomain] = useState<string | undefined>(undefined);
  const [parentTarget, setParentTarget] = useState<string | undefined>(undefined);

  const setQuickSubGoalParent = useCallback((id: string | undefined, domain?: string, target?: string) => {
    setParentId(id);
    setParentDomain(domain);
    setParentTarget(target);
  }, []);

  const clearQuickSubGoalParent = useCallback(() => {
    setParentId(undefined);
    setParentDomain(undefined);
    setParentTarget(undefined);
  }, []);

  const handleSaveQuickGoals = useCallback(async (newGoals: Goal[]) => {
    if (!studentId) return;

    try {
      // Ensure all goals have the correct studentId
      for (const goal of newGoals) {
        goal.studentId = studentId;
      }

      // Save all goals first (they're already in top-down order from the generator)
      for (const goal of newGoals) {
        try {
          await createGoal(goal);
        } catch (error) {
          logError(`Failed to add goal ${goal.id}`, error);
          throw new Error(`Failed to add goal: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Then update parent's subGoalIds for all goals that have a parent
      // Group by parent to avoid multiple updates to the same parent
      const goalsByParent = new Map<string, string[]>();
      for (const goal of newGoals) {
        if (goal.parentGoalId) {
          if (!goalsByParent.has(goal.parentGoalId)) {
            goalsByParent.set(goal.parentGoalId, []);
          }
          goalsByParent.get(goal.parentGoalId)!.push(goal.id);
        }
      }

      // Update each parent's subGoalIds
      // Reload goals to get the latest parent data
      const updatedAllGoals = await getGoals();
      for (const [parentId, newSubGoalIds] of goalsByParent.entries()) {
        const parent = updatedAllGoals.find(g => g.id === parentId);
        if (parent) {
          const existingSubGoalIds = parent.subGoalIds || [];
          // Only add IDs that aren't already in the list
          const idsToAdd = newSubGoalIds.filter(id => !existingSubGoalIds.includes(id));
          if (idsToAdd.length > 0) {
            const updatedSubGoalIds = [...existingSubGoalIds, ...idsToAdd];
            try {
              await updateGoal(parent.id, { subGoalIds: updatedSubGoalIds });
            } catch (error) {
              logError(`Failed to update parent goal ${parent.id}`, error);
              throw new Error(`Failed to update parent goal: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }

      // Reload goals to show the new goals
      await loadGoals();
      await loadSessions();

      showSnackbar(`Successfully created ${newGoals.length} goal(s).`, 'success');
    } catch (error) {
      logError('Failed to create quick goals', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create quick goals: ${errorMessage}. Please check the console for more details.`);
      throw error; // Re-throw so dialog can handle it
    }
  }, [studentId, createGoal, updateGoal, loadGoals, loadSessions, showSnackbar]);

  return {
    parentId,
    parentDomain,
    parentTarget,
    setQuickSubGoalParent,
    clearQuickSubGoalParent,
    handleSaveQuickGoals,
  };
};

