import { useCallback } from 'react';
import type { Goal } from '../types';
import { getGoals } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseGoalSaveParams {
  studentId: string;
  formData: {
    description: string;
    baseline: string;
    target: string;
    status: 'in-progress' | 'achieved' | 'modified';
    domain?: string;
    priority: 'low' | 'medium' | 'high';
    parentGoalId?: string;
  };
  editingGoal: Goal | null;
  selectedTemplateId?: string;
  createGoal: (goal: Goal) => Promise<Goal | null>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  loadGoals: () => Promise<void>;
  loadSessions: () => Promise<void>;
  closeDialog: () => void;
  resetForm: () => void;
  resetDirty: () => void;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
}

export const useGoalSave = ({
  studentId,
  formData,
  editingGoal,
  selectedTemplateId,
  createGoal,
  updateGoal,
  loadGoals,
  loadSessions,
  closeDialog,
  resetForm,
  resetDirty,
  showSnackbar,
}: UseGoalSaveParams) => {
  const handleSave = useCallback(async () => {
    if (!studentId) return;

    try {
      const goalData: Partial<Goal> = {
        description: formData.description,
        baseline: formData.baseline,
        target: formData.target,
        status: formData.status,
        domain: formData.domain || undefined,
        priority: formData.priority,
        parentGoalId: formData.parentGoalId || undefined,
        templateId: selectedTemplateId || undefined,
      };

      // Set dateAchieved if status is 'achieved' and it wasn't already set
      if (formData.status === 'achieved') {
        if (editingGoal && !editingGoal.dateAchieved) {
          // Goal is being marked as achieved for the first time
          goalData.dateAchieved = new Date().toISOString();
        } else if (!editingGoal) {
          // New goal created as achieved
          goalData.dateAchieved = new Date().toISOString();
        } else {
          // Goal already has dateAchieved, preserve it
          goalData.dateAchieved = editingGoal.dateAchieved;
        }
      } else if (editingGoal && editingGoal.dateAchieved) {
        // If status changed from achieved to something else, preserve the dateAchieved
        goalData.dateAchieved = editingGoal.dateAchieved;
      }

      if (editingGoal) {
        await updateGoal(editingGoal.id, goalData);
        
        // If this goal now has a parent, update parent's subGoalIds
        if (goalData.parentGoalId) {
          const allGoals = await getGoals();
          const parent = allGoals.find(g => g.id === goalData.parentGoalId);
          if (parent) {
            const subGoalIds = parent.subGoalIds || [];
            if (!subGoalIds.includes(editingGoal.id)) {
              await updateGoal(parent.id, { subGoalIds: [...subGoalIds, editingGoal.id] });
            }
          }
        }
        showSnackbar('Goal updated successfully', 'success');
      } else {
        const newGoal = await createGoal({
          ...goalData,
          studentId: studentId,
          dateCreated: new Date().toISOString(),
        } as Goal);
        
        // If this is a sub-goal, update parent's subGoalIds
        if (newGoal && newGoal.parentGoalId) {
          const allGoals = await getGoals();
          const parent = allGoals.find(g => g.id === newGoal.parentGoalId);
          if (parent) {
            const subGoalIds = parent.subGoalIds || [];
            await updateGoal(parent.id, { subGoalIds: [...subGoalIds, newGoal.id] });
          }
        }
        showSnackbar('Goal created successfully', 'success');
      }
      await loadGoals();
      await loadSessions();
      resetDirty();
      closeDialog();
      resetForm();
    } catch (error) {
      logError('Failed to save goal', error);
      showSnackbar('Failed to save goal. Please try again.', 'error');
    }
  }, [
    studentId,
    formData,
    editingGoal,
    selectedTemplateId,
    createGoal,
    updateGoal,
    loadGoals,
    loadSessions,
    closeDialog,
    resetForm,
    resetDirty,
    showSnackbar,
  ]);

  return { handleSave };
};

