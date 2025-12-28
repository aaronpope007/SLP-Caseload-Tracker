import { useState, useCallback } from 'react';
import type { Goal } from '../types';
import { copyGoalSubtree } from '../utils/goalSubtreeCopy';
import { getGoals } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseGoalSubtreeParams {
  studentId: string;
  createGoal: (goal: Goal) => Promise<Goal>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  loadGoals: () => Promise<void>;
  loadSessions: () => Promise<void>;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
}

export const useGoalSubtree = ({
  studentId,
  createGoal,
  updateGoal,
  loadGoals,
  loadSessions,
  showSnackbar,
}: UseGoalSubtreeParams) => {
  const [goalToCopy, setGoalToCopy] = useState<Goal | null>(null);

  const startCopySubtree = useCallback((goal: Goal) => {
    setGoalToCopy(goal);
  }, []);

  const cancelCopySubtree = useCallback(() => {
    setGoalToCopy(null);
  }, []);

  const confirmCopySubtree = useCallback(async (replacements: Array<{ from: string; to: string }>) => {
    if (!goalToCopy || !studentId) return;

    try {
      // Get all goals to pass to the copy function
      // We need all goals (not just for this student) to properly map parent relationships
      const allGoals = await getGoals();
      
      // Determine the parent for the copied subtree
      // If the goal being copied has a parent, the new subtree should have the same parent
      // Otherwise, it will be a top-level goal
      const newParentGoalId = goalToCopy.parentGoalId;

      // Copy the subtree - use allGoals to ensure we can find all parent relationships
      const { newGoals } = await copyGoalSubtree(
        goalToCopy,
        allGoals,
        replacements,
        newParentGoalId
      );

      if (newGoals.length === 0) {
        alert('No goals were created. The selected goal may not have any sub-goals to copy.');
        return;
      }

      // Ensure all new goals have the correct studentId
      for (const newGoal of newGoals) {
        newGoal.studentId = studentId;
      }

      // Save all new goals first
      for (const newGoal of newGoals) {
        try {
          await createGoal(newGoal);
        } catch (error) {
          logError(`Failed to add goal ${newGoal.id}`, error);
          throw new Error(`Failed to add goal: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Then update parent's subGoalIds for all new goals that have a parent
      // Group by parent to avoid multiple updates to the same parent
      const goalsByParent = new Map<string, string[]>();
      for (const newGoal of newGoals) {
        if (newGoal.parentGoalId) {
          if (!goalsByParent.has(newGoal.parentGoalId)) {
            goalsByParent.set(newGoal.parentGoalId, []);
          }
          goalsByParent.get(newGoal.parentGoalId)!.push(newGoal.id);
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

      // Reload goals to show the new subtree
      await loadGoals();
      await loadSessions();
      
      setGoalToCopy(null);
      
      // Show success message
      showSnackbar(`Successfully copied ${newGoals.length} goal(s) with replacements applied.`, 'success');
    } catch (error) {
      logError('Failed to copy subtree', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to copy subtree: ${errorMessage}. Please check the console for more details.`);
    }
  }, [goalToCopy, studentId, createGoal, updateGoal, loadGoals, loadSessions, showSnackbar]);

  return {
    goalToCopy,
    startCopySubtree,
    cancelCopySubtree,
    confirmCopySubtree,
  };
};

