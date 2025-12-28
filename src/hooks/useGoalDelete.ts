import { useCallback } from 'react';
import { logError } from '../utils/logger';

interface UseGoalDeleteParams {
  removeGoal: (id: string) => Promise<void>;
  loadGoals: () => Promise<void>;
  loadSessions: () => Promise<void>;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
  confirm: (options: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }) => void;
}

export const useGoalDelete = ({
  removeGoal,
  loadGoals,
  loadSessions,
  showSnackbar,
  confirm,
}: UseGoalDeleteParams) => {
  const handleDelete = useCallback((goalId: string) => {
    confirm({
      title: 'Delete Goal',
      message: 'Are you sure you want to delete this goal? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await removeGoal(goalId);
          await loadGoals();
          await loadSessions();
          showSnackbar('Goal deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete goal', error);
          showSnackbar('Failed to delete goal. Please try again.', 'error');
        }
      },
    });
  }, [removeGoal, loadGoals, loadSessions, showSnackbar, confirm]);

  return { handleDelete };
};

