import { useCallback } from 'react';
import type { Goal } from '../types';
import { getGoals } from '../utils/storage-api';
import { logError } from '../utils/logger';
import { ApiError } from '../utils/api';

type ConfirmFn = (options: {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}) => void;

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
  onValidationError?: (error: ApiError) => boolean;
  confirm: ConfirmFn;
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
  onValidationError,
  confirm,
}: UseGoalSaveParams) => {
  const performSave = useCallback(async (targetOverride?: string) => {
    if (!studentId) return;

    try {
      const goalData: Partial<Goal> = {
        description: formData.description,
        baseline: formData.baseline,
        target: targetOverride !== undefined ? targetOverride : formData.target,
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

      const userName = typeof localStorage !== 'undefined' ? localStorage.getItem('user_name') || undefined : undefined;

      if (editingGoal) {
        await updateGoal(editingGoal.id, { ...goalData, modifiedBy: userName });
        
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
          createdBy: userName,
        });
        
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
      
      // Handle validation errors from the API
      if (error instanceof ApiError && onValidationError?.(error)) {
        showSnackbar('Please fix the validation errors', 'error');
        return;
      }
      
      showSnackbar('Failed to save goal. Please try again.', 'error');
    }
  }, [studentId, formData, editingGoal, selectedTemplateId, createGoal, updateGoal, loadGoals, loadSessions, closeDialog, resetForm, resetDirty, showSnackbar, onValidationError]);

  const handleSave = useCallback(() => {
    if (!studentId) return;

    const hasNoTarget = !editingGoal && !formData.target?.trim();
    const defaultTarget80 = typeof localStorage !== 'undefined' && localStorage.getItem('default_goal_target_80') === 'true';

    if (hasNoTarget) {
      if (defaultTarget80) {
        performSave('80%');
      } else {
        confirm({
          title: 'No Target Set',
          message: 'Would you like to use 80% as the target?',
          confirmText: 'Use 80%',
          cancelText: 'No, save without target',
          onConfirm: () => performSave('80%'),
          onCancel: () => performSave(''),
        });
      }
    } else {
      performSave();
    }
  }, [studentId, formData, editingGoal, confirm, performSave]);

  return { handleSave };
};

