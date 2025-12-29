import { useCallback } from 'react';
import type { Goal } from '../types';

interface UseGoalDialogHandlersParams {
  goals: Goal[];
  initializeForm: (goal?: Goal, parentGoal?: Goal) => void;
  updateFormField: (field: string, value: unknown) => void;
  clearTemplate: () => void;
  openDialog: () => void;
  closeDialog: () => void;
  resetForm: () => void;
  resetDirty: () => void;
  isDirty: () => boolean;
  confirm: (options: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }) => void;
}

export const useGoalDialogHandlers = ({
  goals,
  initializeForm,
  updateFormField,
  clearTemplate,
  openDialog,
  closeDialog,
  resetForm,
  resetDirty,
  isDirty,
  confirm,
}: UseGoalDialogHandlersParams) => {
  const handleOpenDialog = useCallback((goal?: Goal, parentGoalId?: string) => {
    const parentGoal = parentGoalId ? goals.find(g => g.id === parentGoalId) : undefined;
    initializeForm(goal, parentGoal);
    clearTemplate();
    openDialog();
  }, [goals, initializeForm, clearTemplate, openDialog]);

  const handleCloseDialog = useCallback(() => {
    if (isDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes to this goal. Are you sure you want to close?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          closeDialog();
          resetForm();
          resetDirty();
        },
      });
    } else {
      closeDialog();
      resetForm();
      resetDirty();
    }
  }, [isDirty, confirm, closeDialog, resetForm, resetDirty]);

  const handleDuplicateSubGoal = useCallback((subGoal: Goal) => {
    // Duplicate the sub-goal by pre-filling the form with its data
    const parentGoal = subGoal.parentGoalId ? goals.find(g => g.id === subGoal.parentGoalId) : undefined;
    initializeForm(undefined, parentGoal);
    // Override with subGoal data
    updateFormField('description', subGoal.description);
    updateFormField('baseline', subGoal.baseline);
    updateFormField('target', subGoal.target);
    updateFormField('status', subGoal.status as 'in-progress' | 'achieved' | 'modified');
    updateFormField('domain', subGoal.domain || '');
    updateFormField('priority', subGoal.priority || 'medium');
    clearTemplate();
    openDialog();
  }, [goals, initializeForm, updateFormField, clearTemplate, openDialog]);

  const handleCopyMainGoalToSubGoal = useCallback((mainGoal: Goal) => {
    // Copy the main goal as a new sub-goal with the main goal as parent
    initializeForm(undefined, mainGoal);
    // Override with mainGoal data
    updateFormField('description', mainGoal.description);
    updateFormField('baseline', mainGoal.baseline);
    updateFormField('target', mainGoal.target);
    updateFormField('status', mainGoal.status as 'in-progress' | 'achieved' | 'modified');
    updateFormField('domain', mainGoal.domain || '');
    updateFormField('priority', mainGoal.priority || 'medium');
    updateFormField('parentGoalId', mainGoal.id);
    clearTemplate();
    openDialog();
  }, [initializeForm, updateFormField, clearTemplate, openDialog]);

  return {
    handleOpenDialog,
    handleCloseDialog,
    handleDuplicateSubGoal,
    handleCopyMainGoalToSubGoal,
  };
};

